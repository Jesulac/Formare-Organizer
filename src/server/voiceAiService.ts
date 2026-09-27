import { GoogleGenAI, Type } from '@google/genai';
import {
  CatalogItemInput,
  ExtractedVoiceOperation,
  parseVoiceOperationSmartFallback,
} from '../utils/voiceParser';

const EXTRACTION_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
] as const;

const TRANSCRIPTION_MODELS = [
  'gemini-3.5-transcribe',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
] as const;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface VoiceOperationRequest {
  audioBase64?: string;
  mimeType?: string;
  transcriptText?: string;
  productCatalog?: CatalogItemInput[];
  todayDate?: string;
}

export interface VoiceOperationResponse {
  ok: boolean;
  modelsUsed: {
    transcriptionModel: string;
    extractionModel: string;
  };
  data: ExtractedVoiceOperation;
}

export async function processVoiceOperationRequest(
  body: VoiceOperationRequest
): Promise<VoiceOperationResponse> {
  const {
    audioBase64,
    mimeType = 'audio/webm',
    transcriptText = '',
    productCatalog = [],
    todayDate = new Date().toISOString().slice(0, 10),
  } = body || {};

  let finalTranscript = (transcriptText || '').trim();
  let usedTranscriptionModel = finalTranscript ? 'browser-speech + gemini-3.5-transcribe' : 'gemini-3.5-transcribe';
  let usedExtractionModel = 'gemini-3.8-flash';

  const ai = getGeminiClient();

  // Step 1: If we have audio and no transcript yet (or want high-accuracy transcription), try transcription models with fallback
  if (ai && audioBase64 && !finalTranscript) {
    for (const modelName of TRANSCRIPTION_MODELS) {
      try {
        const transcribeRes = await ai.models.generateContent({
          model: modelName,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType || 'audio/webm',
                  data: audioBase64,
                },
              },
              {
                text: 'Transcribe exactamente en español lo que dice el usuario sobre una operación de impresión 3D (venta, compra, producto, precio, costes, material, unidades, lugar de venta, estado, vendedor, comentarios). Devuelve únicamente el texto transcrito.',
              },
            ],
          },
        });
        if (transcribeRes.text && transcribeRes.text.trim()) {
          finalTranscript = transcribeRes.text.trim();
          usedTranscriptionModel = modelName;
          break;
        }
      } catch (err: any) {
        console.warn(`Transcription model ${modelName} busy/failed, trying next:`, err?.status || err?.message);
        await sleep(250);
      }
    }
  }

  // Step 2: Structured extraction with multi-model cascade (gemini-3.8-flash -> gemini-3.1-flash-lite -> gemini-flash-latest)
  if (ai && (finalTranscript || audioBase64)) {
    const catalogContext = Array.isArray(productCatalog)
      ? productCatalog
          .slice(0, 80)
          .map(
            (c) =>
              `- "${c.producto}" (Coste base 1 ud: ${c.costeUnitario}€, Material habitual: "${c.material || 'PETG Negro (Elegoo)'}")`
          )
          .join('\n')
      : '';

    const systemInstruction = `Eres el asistente inteligente de Formare 3D, una empresa de impresión 3D gestionada por Jorge, Sandra y Alejandro.
Tu tarea es escuchar/leer el dictado por voz del usuario y rellenar TODOS los campos del formulario de operación en formato JSON estructurado.

Fecha actual de referencia (hoy): ${todayDate}.

Catálogo de productos conocidos en Formare 3D (usa el nombre exacto, su costeUnitario y su material habitual si el usuario menciona uno de estos productos y no especifica otro coste/material):
${catalogContext || '(Catálogo vacío)'}

Reglas de negocio de Formare 3D:
1. "tipo": Puede ser "venta", "compra" o "inversion". Por defecto es "venta", salvo que diga "compra", "pedido de filamento", "pedido Aliexpress/Temu", "bobina", "inversión", "maquinaria", etc.
2. "producto": Nombre limpio del producto (ej. "Volante F1 Logitech", "Persiana Reposavasos Audi A3 8P", "Guardabarros patinete Xiaomi", "Pedido filamento PETG negro", etc.). Si coincide con uno del catálogo, usa el nombre del catálogo.
3. "unidades": Número entero de unidades (por defecto 1).
4. "precio": Precio de venta en euros (ej. 18.5). Si es una "compra" o "inversion", pon 0.
5. "costes": Coste total del filamento o de la compra en euros. Si es una venta de un producto del catálogo y el usuario no dice el coste, calcula costeUnitario_del_catalogo * unidades.
6. "costeUnitario": Coste por 1 unidad en euros (costes / unidades).
7. "material": Material empleado (ej. "PETG Negro (Elegoo)", "ASA Negro (Winkle)", "PLA Negro (Elegoo / i3D)", "PETG Negro CF (Bambu / Elegoo)", "PETG Rojo (Winkle)", "TPU Negro"). Si el producto está en el catálogo y no menciona material, usa el material habitual del catálogo.
8. "lugarVenta": Uno de: "Wallapop", "Vinted", "Etsy", "eBay", "Amazon", "Internet", "En persona", "Cults3D", "Otro". Por defecto "Wallapop" para ventas y "Internet" para compras.
9. "estado": Uno de: "Cobrado", "Pagado", "Pendiente de pago", "En producción", "Pendiente de cobro", "Enviado", "Cancelado", "Otro".
   - En ventas: si dice "en producción" -> "En producción"; si dice "enviado" -> "Enviado"; si dice "pendiente" o "pendiente de cobro" -> "Pendiente de cobro"; si dice "cobrado" -> "Cobrado". Por defecto en ventas nuevas usa "Cobrado".
   - En compras: por defecto "Pagado".
10. "vendedor": "Jorge", "Sandra", "Alejandro", "Jorge, Sandra" u otro nombre mencionado. Por defecto "Jorge".
11. "fecha": Fecha en formato YYYY-MM-DD. Si no menciona fecha o dice "hoy", usa "${todayDate}". Si dice "ayer", resta 1 día.
12. "esPedidoFilamento": true si es una compra de bobina(s) de filamento (PLA, PETG, ASA, TPU), false en caso contrario.
13. "comentarios": Cualquier detalle adicional mencionado por el usuario.
14. "transcripcion": El texto exacto de lo que ha dicho el usuario en español.`;

    const contentsParts: any[] = [];
    if (audioBase64 && !finalTranscript) {
      contentsParts.push({
        inlineData: {
          mimeType: mimeType || 'audio/webm',
          data: audioBase64,
        },
      });
    }
    contentsParts.push({
      text: finalTranscript
        ? `Dictado del usuario transcrito: "${finalTranscript}". Extrae todos los campos de la operación.`
        : 'Escucha este audio del usuario y extrae su transcripción y todos los campos de la operación.',
    });

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        transcripcion: {
          type: Type.STRING,
          description: 'Transcripción en español de lo que dijo el usuario.',
        },
        tipo: {
          type: Type.STRING,
          description: 'venta, compra o inversion',
        },
        producto: {
          type: Type.STRING,
          description: 'Nombre del producto o pedido',
        },
        unidades: {
          type: Type.INTEGER,
          description: 'Número de unidades (mínimo 1)',
        },
        fecha: {
          type: Type.STRING,
          description: 'Fecha en formato YYYY-MM-DD',
        },
        material: {
          type: Type.STRING,
          description: 'Material o filamento utilizado',
        },
        precio: {
          type: Type.NUMBER,
          description: 'Precio de venta total en euros (0 si es compra)',
        },
        costes: {
          type: Type.NUMBER,
          description: 'Coste total de filamento o coste de compra en euros',
        },
        costeUnitario: {
          type: Type.NUMBER,
          description: 'Coste unitario por unidad en euros',
        },
        lugarVenta: {
          type: Type.STRING,
          description: 'Wallapop, Vinted, Etsy, eBay, Amazon, Internet, En persona, Cults3D u Otro',
        },
        estado: {
          type: Type.STRING,
          description: 'Cobrado, Pagado, Pendiente de pago, En producción, Pendiente de cobro, Enviado, Cancelado u Otro',
        },
        vendedor: {
          type: Type.STRING,
          description: 'Jorge, Sandra, Alejandro, Jorge, Sandra u Otro',
        },
        comentarios: {
          type: Type.STRING,
          description: 'Comentarios u observaciones adicionales',
        },
        esPedidoFilamento: {
          type: Type.BOOLEAN,
          description: 'true si es una compra de bobina de filamento',
        },
      },
      required: [
        'transcripcion',
        'tipo',
        'producto',
        'unidades',
        'fecha',
        'material',
        'precio',
        'costes',
        'lugarVenta',
        'estado',
        'vendedor',
        'esPedidoFilamento',
      ],
    };

    for (let attempt = 0; attempt < 2; attempt++) {
      for (const modelName of EXTRACTION_MODELS) {
        try {
          const extractionRes = await ai.models.generateContent({
            model: modelName,
            contents: { parts: contentsParts },
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              responseSchema,
            },
          });

          const rawJson = extractionRes.text?.trim() || '';
          if (rawJson) {
            const parsed = JSON.parse(rawJson);
            usedExtractionModel = modelName;
            return {
              ok: true,
              modelsUsed: {
                transcriptionModel: usedTranscriptionModel,
                extractionModel: usedExtractionModel,
              },
              data: {
                ...parsed,
                transcripcion: parsed.transcripcion || finalTranscript,
              },
            };
          }
        } catch (err: any) {
          console.warn(
            `Extraction model ${modelName} (attempt ${attempt + 1}) overloaded or failed, trying fallback:`,
            err?.status || err?.message
          );
          await sleep(300 * (attempt + 1));
        }
      }
    }
  }

  // Step 3: Resilient Smart Fallback — if all Gemini models return 503 UNAVAILABLE or API key is not set on Vercel
  if (finalTranscript) {
    const fallbackData = parseVoiceOperationSmartFallback(
      finalTranscript,
      productCatalog,
      todayDate
    );
    return {
      ok: true,
      modelsUsed: {
        transcriptionModel: usedTranscriptionModel,
        extractionModel: 'gemini-3.8-flash (smart-fallback)',
      },
      data: fallbackData,
    };
  }

  throw new Error(
    'No se pudo transcribir el audio en este momento. Intenta hablar de nuevo o escribe el dictado en el cuadro de texto.'
  );
}
