import {
  FunctionDeclaration,
  GoogleGenAI,
  LiveServerMessage,
  Modality,
  Type,
} from '@google/genai';
import {
  CatalogItemInput,
  ExtractedVoiceOperation,
  parseVoiceOperationSmartFallback,
} from '../utils/voiceParser';

export const GEMINI_VOICE_MODEL = 'gemini-3.8-live';

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

const rellenarOperacionDeclaration: FunctionDeclaration = {
  name: 'rellenarOperacionFormare3D',
  description:
    'Rellena todos los apartados del formulario de operación de Formare 3D a partir de lo que ha dicho el usuario por voz.',
  parameters: {
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
        description:
          'Wallapop, Vinted, Etsy, eBay, Amazon, Internet, En persona, Cults3D u Otro',
      },
      estado: {
        type: Type.STRING,
        description:
          'Cobrado, Pagado, Pendiente de pago, En producción, Pendiente de cobro, Enviado, Cancelado u Otro',
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
  },
};

export interface VoiceOperationRequest {
  audioBase64?: string;
  mimeType?: string;
  transcriptText?: string;
  productCatalog?: CatalogItemInput[];
  todayDate?: string;
}

export interface VoiceOperationResponse {
  ok: boolean;
  modelUsed: string;
  data: ExtractedVoiceOperation;
}

async function runGeminiLiveExtraction(
  ai: GoogleGenAI,
  req: Required<
    Pick<VoiceOperationRequest, 'mimeType' | 'transcriptText' | 'productCatalog' | 'todayDate'>
  > & { audioBase64?: string }
): Promise<ExtractedVoiceOperation | null> {
  const { audioBase64, mimeType, transcriptText, productCatalog, todayDate } = req;

  const catalogContext = Array.isArray(productCatalog)
    ? productCatalog
        .slice(0, 80)
        .map(
          (c) =>
            `- "${c.producto}" (Coste base 1 ud: ${c.costeUnitario}€, Material habitual: "${c.material || 'PETG Negro (Elegoo)'}")`
        )
        .join('\n')
    : '';

  const systemInstruction = `Eres el asistente de voz en tiempo real de Formare 3D (modelo Gemini 3.8 Live), una empresa de impresión 3D gestionada por Jorge, Sandra y Alejandro.
Tu única tarea es escuchar el audio o leer el dictado del usuario y llamar INMEDIATAMENTE a la función "rellenarOperacionFormare3D" con todos los campos de la operación.

Fecha actual de referencia (hoy): ${todayDate}.

Catálogo de productos de Formare 3D (usa el nombre exacto, su costeUnitario y su material habitual si el usuario menciona uno de estos productos y no especifica otro coste/material):
${catalogContext || '(Catálogo vacío)'}

Reglas de negocio de Formare 3D:
1. "tipo": "venta", "compra" o "inversion". Por defecto "venta", salvo que mencione "compra", "pedido de filamento", "bobina", "inversión", "maquinaria", etc.
2. "producto": Nombre limpio del producto. Si coincide con uno del catálogo, usa el nombre exacto del catálogo.
3. "unidades": Número entero de unidades (por defecto 1).
4. "precio": Precio de venta en euros (ej. 18.5). Si es "compra" o "inversion", pon 0.
5. "costes": Coste total del filamento o de la compra en euros. Si es una venta de un producto del catálogo y el usuario no dice el coste, calcula costeUnitario_del_catalogo * unidades.
6. "costeUnitario": Coste por 1 unidad en euros (costes / unidades).
7. "material": Material empleado (ej. "PETG Negro (Elegoo)", "ASA Negro (Winkle)", "PLA Negro (Elegoo / i3D)", "PETG Negro CF (Bambu / Elegoo)", "PETG Rojo (Winkle)", "TPU Negro").
8. "lugarVenta": "Wallapop", "Vinted", "Etsy", "eBay", "Amazon", "Internet", "En persona", "Cults3D" u "Otro". Por defecto "Wallapop" para ventas y "Internet" para compras.
9. "estado": "Cobrado", "Pagado", "Pendiente de pago", "En producción", "Pendiente de cobro", "Enviado", "Cancelado" u "Otro".
10. "vendedor": "Jorge", "Sandra", "Alejandro", "Jorge, Sandra" u otro nombre mencionado. Por defecto "Jorge".
11. "fecha": Fecha en formato YYYY-MM-DD (por defecto "${todayDate}").
12. "esPedidoFilamento": true si es una compra de bobina(s) de filamento, false en caso contrario.
13. "comentarios": Cualquier detalle adicional mencionado por el usuario.
14. "transcripcion": El texto exacto de lo que ha dicho el usuario en español.

IMPORTANTE: Llama SIEMPRE a la herramienta "rellenarOperacionFormare3D" en cuanto recibas el audio o texto.`;

  return new Promise<ExtractedVoiceOperation | null>(async (resolve) => {
    let settled = false;
    let liveSession: any = null;
    let inputTranscriptPieces = '';

    const finish = (result: ExtractedVoiceOperation | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      try {
        liveSession?.close?.();
      } catch {
        // Ignore close error
      }
      resolve(result);
    };

    const timeoutId = setTimeout(() => {
      if (inputTranscriptPieces.trim() || transcriptText.trim()) {
        const fallback = parseVoiceOperationSmartFallback(
          inputTranscriptPieces.trim() || transcriptText.trim(),
          productCatalog,
          todayDate
        );
        finish(fallback);
      } else {
        finish(null);
      }
    }, 9500);

    try {
      const sessionPromise = ai.live.connect({
        model: GEMINI_VOICE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction,
          tools: [{ functionDeclarations: [rellenarOperacionDeclaration] }],
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            const inText = (message as any)?.serverContent?.inputTranscription?.text;
            if (inText) {
              inputTranscriptPieces += ' ' + inText;
            }

            const toolCalls = (message as any)?.toolCall?.functionCalls;
            if (Array.isArray(toolCalls) && toolCalls.length > 0) {
              const call = toolCalls.find(
                (fc: any) => fc.name === 'rellenarOperacionFormare3D'
              ) || toolCalls[0];
              if (call && call.args) {
                const args = call.args as any;
                const finalTrans =
                  args.transcripcion ||
                  inputTranscriptPieces.trim() ||
                  transcriptText.trim();
                finish({
                  transcripcion: finalTrans,
                  tipo:
                    args.tipo === 'compra' || args.tipo === 'inversion'
                      ? args.tipo
                      : 'venta',
                  producto: String(args.producto || ''),
                  unidades: Number(args.unidades) >= 1 ? Number(args.unidades) : 1,
                  fecha: String(args.fecha || todayDate),
                  material: String(args.material || ''),
                  precio: Number(args.precio) || 0,
                  costes: Number(args.costes) || 0,
                  costeUnitario: Number(args.costeUnitario) || 0,
                  lugarVenta: String(args.lugarVenta || 'Wallapop'),
                  estado: String(args.estado || 'Cobrado'),
                  vendedor: String(args.vendedor || 'Jorge'),
                  comentarios: String(args.comentarios || ''),
                  esPedidoFilamento: Boolean(args.esPedidoFilamento),
                });
                return;
              }
            }

            if (message.serverContent?.turnComplete) {
              const combinedTranscript = (
                inputTranscriptPieces.trim() || transcriptText.trim()
              ).trim();
              if (combinedTranscript) {
                finish(
                  parseVoiceOperationSmartFallback(
                    combinedTranscript,
                    productCatalog,
                    todayDate
                  )
                );
              }
            }
          },
          onerror: (err: any) => {
            console.warn('Gemini 3.8 Live session error:', err?.message || err);
            finish(null);
          },
          onclose: () => {
            if (!settled) {
              const combinedTranscript = (
                inputTranscriptPieces.trim() || transcriptText.trim()
              ).trim();
              finish(
                combinedTranscript
                  ? parseVoiceOperationSmartFallback(
                      combinedTranscript,
                      productCatalog,
                      todayDate
                    )
                  : null
              );
            }
          },
        },
      });

      liveSession = await sessionPromise;

      // Stream 16kHz PCM audio if provided
      if (audioBase64 && mimeType.includes('pcm')) {
        const chunkSize = 32000; // ~1s of 16kHz 16-bit PCM in base64
        for (let offset = 0; offset < audioBase64.length; offset += chunkSize) {
          const slice = audioBase64.slice(offset, offset + chunkSize);
          liveSession.sendRealtimeInput({
            audio: {
              data: slice,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        }
      }

      // Send prompt instruction to trigger immediate tool call
      const textPrompt = transcriptText.trim()
        ? `Dictado por voz del usuario: "${transcriptText.trim()}". Llama ahora a la función rellenarOperacionFormare3D con todos los apartados.`
        : 'He terminado de hablar. Llama ahora a la función rellenarOperacionFormare3D con todos los apartados extraídos del audio.';

      liveSession.sendRealtimeInput({
        text: textPrompt,
      });
    } catch (err: any) {
      console.warn('Could not connect to gemini-3.8-live:', err?.message || err);
      finish(null);
    }
  });
}

export async function processVoiceOperationRequest(
  body: VoiceOperationRequest
): Promise<VoiceOperationResponse> {
  const {
    audioBase64,
    mimeType = 'audio/pcm;rate=16000',
    transcriptText = '',
    productCatalog = [],
    todayDate = new Date().toISOString().slice(0, 10),
  } = body || {};

  const cleanTranscript = (transcriptText || '').trim();
  const ai = getGeminiClient();

  if (ai && (audioBase64 || cleanTranscript)) {
    const liveResult = await runGeminiLiveExtraction(ai, {
      audioBase64,
      mimeType,
      transcriptText: cleanTranscript,
      productCatalog,
      todayDate,
    });

    if (liveResult && liveResult.producto) {
      return {
        ok: true,
        modelUsed: GEMINI_VOICE_MODEL,
        data: liveResult,
      };
    }
  }

  if (cleanTranscript) {
    const fallbackData = parseVoiceOperationSmartFallback(
      cleanTranscript,
      productCatalog,
      todayDate
    );
    return {
      ok: true,
      modelUsed: GEMINI_VOICE_MODEL,
      data: fallbackData,
    };
  }

  throw new Error(
    'No se detectó voz suficiente. Habla cerca del micrófono o escribe el dictado en el cuadro.'
  );
}
