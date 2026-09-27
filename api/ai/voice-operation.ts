import {
  FunctionDeclaration,
  GoogleGenAI,
  LiveServerMessage,
  Modality,
  Type,
} from '@google/genai';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb',
    },
  },
};

const GEMINI_VOICE_MODEL = 'gemini-3.1-flash-live-preview';
const GEMINI_VOICE_MODEL_LABEL = 'Gemini 3 Flash Live';
const DEFAULT_FALLBACK_KEY =
  'AQ.Ab8RN6IzXZb4IOblOZeUiqd9AVja-94Yv9PBsLCrX8DaNjMPKg';

function getGeminiClient(): GoogleGenAI | null {
  const envKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  const apiKey =
    envKey && envKey !== 'MY_GEMINI_API_KEY' ? envKey : DEFAULT_FALLBACK_KEY;
  if (!apiKey) return null;

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function normalizeStr(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

const SPANISH_NUMBERS: Record<string, number> = {
  un: 1,
  una: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
};

function parseVoiceOperationSmartFallback(
  rawText: string,
  productCatalog: any[] = [],
  todayDate: string = new Date().toISOString().slice(0, 10)
): any {
  const text = (rawText || '').trim();
  const norm = normalizeStr(text);

  let tipo: 'venta' | 'compra' | 'inversion' = 'venta';
  if (/\b(inversion|activo|impresora|maquinaria|bambu lab|herramienta)\b/.test(norm)) {
    tipo = 'inversion';
  } else if (
    /\b(compra|comprado|pedido|bobina|bobinas|filamento|aliexpress|temu|amazon compra|gasto|reposicion)\b/.test(norm) &&
    !/\b(venta de|vendido)\b/.test(norm)
  ) {
    tipo = 'compra';
  }

  let unidades = 1;
  const unitsExplicitMatch = norm.match(
    /\b(\d+|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\s*(unidades|unidad|uds|ud|piezas|pieza|bobinas|bobina)\b/
  );
  if (unitsExplicitMatch) {
    const val = unitsExplicitMatch[1];
    unidades = SPANISH_NUMBERS[val] ?? (parseInt(val, 10) || 1);
  } else {
    const afterVentaMatch = norm.match(
      /\b(?:venta de|vendido|compra de|comprado|pedido de)\s+(\d+|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/
    );
    if (afterVentaMatch) {
      const val = afterVentaMatch[1];
      unidades = SPANISH_NUMBERS[val] ?? (parseInt(val, 10) || 1);
    }
  }
  if (unidades < 1) unidades = 1;

  let matchedCatalog: any;
  let bestScore = 0;

  for (const item of productCatalog) {
    if (!item?.producto) continue;
    const itemNorm = normalizeStr(item.producto);
    if (!itemNorm) continue;

    if (norm.includes(itemNorm)) {
      const score = itemNorm.length + 100;
      if (score > bestScore) {
        bestScore = score;
        matchedCatalog = item;
      }
      continue;
    }

    const tokens = itemNorm
      .split(/[\s\-()/]+/)
      .filter((t) => t.length >= 2 && !['de', 'el', 'la', 'los', 'las', 'para', 'con'].includes(t));
    if (tokens.length === 0) continue;

    let matchedTokens = 0;
    for (const token of tokens) {
      if (norm.includes(token)) matchedTokens++;
    }
    const ratio = matchedTokens / tokens.length;
    if (matchedTokens >= 2 || (tokens.length === 1 && matchedTokens === 1 && tokens[0].length >= 4)) {
      const score = matchedTokens * 15 + ratio * 20;
      if (score > bestScore) {
        bestScore = score;
        matchedCatalog = item;
      }
    }
  }

  let lugarVenta = tipo === 'venta' ? 'Wallapop' : 'Internet';
  if (/\bvinted\b/.test(norm)) lugarVenta = 'Vinted';
  else if (/\bwallapop\b/.test(norm)) lugarVenta = 'Wallapop';
  else if (/\betsy\b/.test(norm)) lugarVenta = 'Etsy';
  else if (/\bebay\b/.test(norm)) lugarVenta = 'eBay';
  else if (/\bamazon\b/.test(norm)) lugarVenta = 'Amazon';
  else if (/\bcults3d|cults\b/.test(norm)) lugarVenta = 'Cults3D';
  else if (/\b(en persona|mano|efectivo|presencial)\b/.test(norm)) lugarVenta = 'En persona';
  else if (/\b(internet|web|aliexpress|temu)\b/.test(norm)) lugarVenta = 'Internet';

  let estado = tipo === 'venta' ? 'Cobrado' : 'Pagado';
  if (/\b(en produccion|produccion|imprimiendo|fabricando)\b/.test(norm)) {
    estado = 'En producción';
  } else if (/\b(pendiente de cobro|por cobrar|falta cobrar)\b/.test(norm)) {
    estado = 'Pendiente de cobro';
  } else if (/\b(pendiente de pago|por pagar|falta pagar)\b/.test(norm)) {
    estado = 'Pendiente de pago';
  } else if (/\b(enviado|en camino|correos|inpost|seur)\b/.test(norm)) {
    estado = 'Enviado';
  } else if (/\b(cancelado|anulado|devuelto)\b/.test(norm)) {
    estado = 'Cancelado';
  } else if (/\b(pagado)\b/.test(norm)) {
    estado = 'Pagado';
  } else if (/\b(cobrado)\b/.test(norm)) {
    estado = 'Cobrado';
  }

  let vendedor = 'Jorge';
  const hasJorge = /\bjorge\b/.test(norm);
  const hasSandra = /\bsandra\b/.test(norm);
  const hasAlejandro = /\balejandro\b/.test(norm);
  if (hasJorge && hasSandra) vendedor = 'Jorge, Sandra';
  else if (hasSandra) vendedor = 'Sandra';
  else if (hasAlejandro) vendedor = 'Alejandro';

  let material = matchedCatalog?.material || (tipo === 'venta' ? 'PETG Negro (Elegoo)' : '');
  if (/\bpetg\b.*\bcf\b|\bfibra de carbono\b/.test(norm)) {
    material = 'PETG Negro CF (Bambu / Elegoo)';
  } else if (/\bpetg\b.*\brojo\b/.test(norm)) {
    material = 'PETG Rojo (Winkle)';
  } else if (/\bpetg\b/.test(norm)) {
    material = 'PETG Negro (Elegoo)';
  } else if (/\basa\b/.test(norm)) {
    material = 'ASA Negro (Winkle)';
  } else if (/\bpla\b/.test(norm)) {
    material = 'PLA Negro (Elegoo / i3D)';
  } else if (/\btpu\b/.test(norm)) {
    material = 'TPU Negro';
  }

  let fecha = todayDate;
  if (/\bayer\b/.test(norm)) {
    const d = new Date(`${todayDate}T12:00:00`);
    d.setDate(d.getDate() - 1);
    fecha = d.toISOString().slice(0, 10);
  }

  let precio = 0;
  let costes = 0;
  const costExplicitMatch = norm.match(
    /\b(?:coste|costes|costo|gasto|costado)\s*(?:de)?\s*(\d+(?:[.,]\d{1,2})?)\s*(?:euros|euro|€)?/
  );
  if (costExplicitMatch) {
    costes = parseFloat(costExplicitMatch[1].replace(',', '.')) || 0;
  }

  const priceExplicitMatch =
    norm.match(/\b(?:precio|por|a|en|vendido por|venta por)\s*(\d+(?:[.,]\d{1,2})?)\s*(?:euros|euro|€)\b/) ||
    norm.match(/\b(\d+(?:[.,]\d{1,2})?)\s*(?:euros|euro|€)\b/);

  if (priceExplicitMatch) {
    const extractedAmount = parseFloat(priceExplicitMatch[1].replace(',', '.')) || 0;
    if (tipo === 'compra' || tipo === 'inversion') {
      if (costes === 0) costes = extractedAmount;
      precio = 0;
    } else {
      precio = extractedAmount;
    }
  }

  if (tipo === 'venta' && costes === 0 && matchedCatalog && matchedCatalog.costeUnitario > 0) {
    costes = Number((matchedCatalog.costeUnitario * unidades).toFixed(2));
  }

  const costeUnitario =
    unidades > 0 && costes > 0
      ? Number((costes / unidades).toFixed(2))
      : matchedCatalog?.costeUnitario || 0;

  let producto = matchedCatalog?.producto || '';
  if (!producto) {
    let cleaned = text
      .replace(/^(?:nueva\s+)?(?:venta|compra|pedido|inversion|operacion)\s+(?:de\s+)?/i, '')
      .replace(/^(?:\d+|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(?:unidades\s+de\s+|piezas\s+de\s+)?/i, '')
      .replace(/\b(?:por|a|precio)\s+\d+(?:[.,]\d{1,2})?\s*(?:euros|euro|€)?.*$/i, '')
      .replace(/\b(?:en|por)\s+(?:wallapop|vinted|etsy|ebay|amazon|internet|persona|cults3d).*$/i, '')
      .replace(/[.,;]+$/, '')
      .trim();
    producto = cleaned
      ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
      : tipo === 'compra'
      ? 'Pedido filamento 3D'
      : 'Producto 3D';
  }

  return {
    transcripcion: text,
    tipo,
    producto,
    unidades,
    fecha,
    material,
    precio,
    costes,
    costeUnitario,
    lugarVenta,
    estado,
    vendedor,
    comentarios: '',
    esPedidoFilamento:
      tipo === 'compra' && /\b(filamento|bobina|bobinas|petg|pla|asa|tpu)\b/.test(norm),
  };
}

const rellenarOperacionDeclaration: FunctionDeclaration = {
  name: 'rellenarOperacionFormare3D',
  description:
    'Rellena todos los apartados del formulario de operación de Formare 3D a partir de lo que ha dicho el usuario por voz.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      transcripcion: { type: Type.STRING },
      tipo: { type: Type.STRING },
      producto: { type: Type.STRING },
      unidades: { type: Type.INTEGER },
      fecha: { type: Type.STRING },
      material: { type: Type.STRING },
      precio: { type: Type.NUMBER },
      costes: { type: Type.NUMBER },
      costeUnitario: { type: Type.NUMBER },
      lugarVenta: { type: Type.STRING },
      estado: { type: Type.STRING },
      vendedor: { type: Type.STRING },
      comentarios: { type: Type.STRING },
      esPedidoFilamento: { type: Type.BOOLEAN },
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

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const {
      audioBase64,
      transcriptText = '',
      productCatalog = [],
      todayDate = new Date().toISOString().slice(0, 10),
    } = body;

    const cleanTranscript = String(transcriptText || '').trim();
    if (!audioBase64 && !cleanTranscript) {
      return res.status(400).json({
        error: 'No se recibió audio ni texto para procesar.',
      });
    }

    const ai = getGeminiClient();
    if (ai) {
      const catalogContext = Array.isArray(productCatalog)
        ? productCatalog
            .slice(0, 80)
            .map(
              (c: any) =>
                `- "${c.producto}" (Coste base 1 ud: ${c.costeUnitario}€, Material habitual: "${c.material || 'PETG Negro (Elegoo)'}")`
            )
            .join('\n')
        : '';

      const systemInstruction = `Eres el asistente de voz en tiempo real de Formare 3D (modelo Gemini 3 Flash Live), una empresa de impresión 3D gestionada por Jorge, Sandra y Alejandro.
Llama INMEDIATAMENTE a la función "rellenarOperacionFormare3D" con todos los campos extraídos.
Fecha actual (hoy): ${todayDate}.
Catálogo de productos de Formare 3D:
${catalogContext || '(Catálogo vacío)'}`;

      const liveData = await new Promise<any>((resolve) => {
        let settled = false;
        let liveSession: any = null;
        let inputTranscriptPieces = '';

        const finish = (val: any) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          try {
            liveSession?.close?.();
          } catch {
            // Ignore
          }
          resolve(val);
        };

        const timer = setTimeout(() => {
          const combined = (inputTranscriptPieces.trim() || cleanTranscript).trim();
          finish(
            combined
              ? parseVoiceOperationSmartFallback(combined, productCatalog, todayDate)
              : null
          );
        }, 8500);

        ai.live
          .connect({
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
                if (inText) inputTranscriptPieces += ' ' + inText;

                const toolCalls = (message as any)?.toolCall?.functionCalls;
                if (Array.isArray(toolCalls) && toolCalls.length > 0) {
                  const call =
                    toolCalls.find((fc: any) => fc.name === 'rellenarOperacionFormare3D') ||
                    toolCalls[0];
                  if (call && call.args) {
                    const args = call.args as any;
                    const fallback = parseVoiceOperationSmartFallback(
                      `${args.transcripcion || inputTranscriptPieces || cleanTranscript} ${args.producto || ''}`,
                      productCatalog,
                      todayDate
                    );
                    const uds =
                      Number(args.unidades) >= 1
                        ? Math.round(Number(args.unidades))
                        : fallback.unidades || 1;
                    const cleanProd = String(args.producto || '')
                      .replace(/^(?:\d+|un|una|dos|tres|cuatro|cinco)\s+/i, '')
                      .trim();
                    const matched = productCatalog.find(
                      (c: any) =>
                        c.producto.toLowerCase() === cleanProd.toLowerCase() ||
                        c.producto.toLowerCase() === (fallback.producto || '').toLowerCase()
                    );
                    const costes =
                      Number(args.costes) > 0
                        ? Number(args.costes)
                        : matched && matched.costeUnitario > 0
                        ? Number((matched.costeUnitario * uds).toFixed(2))
                        : fallback.costes;
                    finish({
                      transcripcion:
                        args.transcripcion || inputTranscriptPieces.trim() || cleanTranscript,
                      tipo:
                        args.tipo === 'compra' || args.tipo === 'inversion'
                          ? args.tipo
                          : 'venta',
                      producto: matched ? matched.producto : cleanProd || fallback.producto,
                      unidades: uds,
                      fecha:
                        args.fecha && /^\d{4}-\d{2}-\d{2}$/.test(args.fecha)
                          ? args.fecha
                          : fallback.fecha || todayDate,
                      material:
                        args.material ||
                        matched?.material ||
                        fallback.material ||
                        'PETG Negro (Elegoo)',
                      precio: Number(args.precio) > 0 ? Number(args.precio) : fallback.precio,
                      costes,
                      costeUnitario:
                        uds > 0 && costes > 0
                          ? Number((costes / uds).toFixed(2))
                          : matched?.costeUnitario || fallback.costeUnitario || 0,
                      lugarVenta: String(args.lugarVenta || fallback.lugarVenta || 'Wallapop'),
                      estado: String(args.estado || fallback.estado || 'Cobrado'),
                      vendedor: String(args.vendedor || fallback.vendedor || 'Jorge'),
                      comentarios: String(args.comentarios || ''),
                      esPedidoFilamento: Boolean(
                        args.esPedidoFilamento ?? fallback.esPedidoFilamento
                      ),
                    });
                    return;
                  }
                }

                if (message.serverContent?.turnComplete) {
                  const combined = (inputTranscriptPieces.trim() || cleanTranscript).trim();
                  if (combined) {
                    finish(
                      parseVoiceOperationSmartFallback(combined, productCatalog, todayDate)
                    );
                  }
                }
              },
              onerror: () => finish(null),
              onclose: () => {
                if (!settled) {
                  const combined = (inputTranscriptPieces.trim() || cleanTranscript).trim();
                  finish(
                    combined
                      ? parseVoiceOperationSmartFallback(combined, productCatalog, todayDate)
                      : null
                  );
                }
              },
            },
          })
          .then(async (session) => {
            liveSession = session;
            if (cleanTranscript) {
              session.sendClientContent({
                turns: [
                  {
                    role: 'user',
                    parts: [
                      {
                        text: `Dictado por voz del usuario: "${cleanTranscript}". Llama inmediatamente a rellenarOperacionFormare3D.`,
                      },
                    ],
                  },
                ],
                turnComplete: true,
              });
            } else if (audioBase64) {
              const pcmBuf = Buffer.from(audioBase64, 'base64');
              const silence = Buffer.alloc(48000);
              const fullBuf = Buffer.concat([pcmBuf, silence]);
              const step = 6400;
              for (let i = 0; i < fullBuf.length; i += step) {
                if (settled) break;
                session.sendRealtimeInput({
                  audio: {
                    data: fullBuf.subarray(i, i + step).toString('base64'),
                    mimeType: 'audio/pcm;rate=16000',
                  },
                });
                await new Promise((r) => setTimeout(r, 10));
              }
              if (!settled) {
                session.sendRealtimeInput({ audioStreamEnd: true });
              }
            }
          })
          .catch(() => finish(null));
      });

      if (liveData && liveData.producto) {
        return res.status(200).json({
          ok: true,
          modelUsed: GEMINI_VOICE_MODEL,
          modelLabel: GEMINI_VOICE_MODEL_LABEL,
          data: liveData,
        });
      }
    }

    if (cleanTranscript) {
      const fallbackData = parseVoiceOperationSmartFallback(
        cleanTranscript,
        productCatalog,
        todayDate
      );
      return res.status(200).json({
        ok: true,
        modelUsed: GEMINI_VOICE_MODEL,
        modelLabel: GEMINI_VOICE_MODEL_LABEL,
        data: fallbackData,
      });
    }

    return res.status(400).json({
      error: 'No se detectó voz suficiente. Habla cerca del micrófono o escribe el dictado.',
    });
  } catch (err: any) {
    console.error('Vercel /api/ai/voice-operation error:', err);
    return res.status(500).json({
      error:
        err?.message ||
        'No se pudo procesar el dictado por voz en este momento. Inténtalo de nuevo.',
    });
  }
}
