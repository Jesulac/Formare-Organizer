import {
  CatalogItemInput,
  ExtractedVoiceOperation,
  parseVoiceOperationSmartFallback,
} from '../utils/voiceParser';

const GATEWAY_URL = 'https://api.kilo.ai/api/gateway/chat/completions';
const GATEWAY_MODELS = [
  'stepfun/step-3.7-flash:free',
  'stepfun/step-3.7-flash',
  'kilo-auto/free',
];

export interface VoiceOperationRequest {
  text?: string;
  transcriptText?: string;
  productCatalog?: CatalogItemInput[];
  todayDate?: string;
}

export interface VoiceOperationResponse {
  ok: boolean;
  data: ExtractedVoiceOperation;
}

function extractJsonFromText(content: string): any | null {
  if (!content || typeof content !== 'string') return null;
  const cleaned = content
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function enrichWithCatalog(
  raw: Partial<ExtractedVoiceOperation>,
  inputText: string,
  productCatalog: CatalogItemInput[],
  todayDate: string
): ExtractedVoiceOperation {
  const fallback = parseVoiceOperationSmartFallback(
    `${inputText || ''} ${raw.producto || ''}`,
    productCatalog,
    todayDate
  );

  const rawTipo = String(raw.tipo || '').toLowerCase().trim();
  const tipo: 'venta' | 'compra' | 'inversion' =
    rawTipo.includes('compra') || rawTipo.includes('pedido')
      ? 'compra'
      : rawTipo.includes('inver') || rawTipo.includes('activo')
      ? 'inversion'
      : rawTipo.includes('venta')
      ? 'venta'
      : fallback.tipo || 'venta';

  const unidades =
    Number(raw.unidades) >= 1
      ? Math.round(Number(raw.unidades))
      : fallback.unidades || 1;

  const cleanProdName = String(raw.producto || '')
    .replace(/^(?:\d+|un|una|dos|tres|cuatro|cinco)\s+/i, '')
    .trim();

  const matchedItem = productCatalog.find(
    (c) =>
      c.producto.toLowerCase() === cleanProdName.toLowerCase() ||
      c.producto.toLowerCase() === (fallback.producto || '').toLowerCase()
  );

  const producto = matchedItem
    ? matchedItem.producto
    : cleanProdName || fallback.producto;

  const material =
    (raw.material && String(raw.material).trim()) ||
    matchedItem?.material ||
    fallback.material ||
    (tipo === 'venta' ? 'PETG Negro (Elegoo)' : '');

  const rawCostes = Number(raw.costes);
  const costes =
    !isNaN(rawCostes) && rawCostes > 0
      ? Number(rawCostes.toFixed(2))
      : matchedItem && matchedItem.costeUnitario > 0
      ? Number((matchedItem.costeUnitario * unidades).toFixed(2))
      : fallback.costes;

  const costeUnitario =
    unidades > 0 && costes > 0
      ? Number((costes / unidades).toFixed(2))
      : matchedItem?.costeUnitario || fallback.costeUnitario || 0;

  const rawPrecio = Number(raw.precio);
  const precio =
    tipo === 'compra' || tipo === 'inversion'
      ? 0
      : !isNaN(rawPrecio) && rawPrecio > 0
      ? Number(rawPrecio.toFixed(2))
      : fallback.precio;

  const fecha =
    raw.fecha && /^\d{4}-\d{2}-\d{2}$/.test(String(raw.fecha))
      ? String(raw.fecha)
      : fallback.fecha || todayDate;

  return {
    transcripcion: inputText,
    tipo,
    producto,
    unidades,
    fecha,
    material,
    precio,
    costes,
    costeUnitario,
    lugarVenta: String(
      raw.lugarVenta || fallback.lugarVenta || (tipo === 'venta' ? 'Wallapop' : 'Internet')
    ),
    estado: String(
      raw.estado || fallback.estado || (tipo === 'venta' ? 'Cobrado' : 'Pagado')
    ),
    vendedor: String(raw.vendedor || fallback.vendedor || 'Jorge'),
    comentarios: String(raw.comentarios || ''),
    esPedidoFilamento:
      typeof raw.esPedidoFilamento === 'boolean'
        ? raw.esPedidoFilamento
        : fallback.esPedidoFilamento,
  };
}

async function runGatewayAiExtraction(
  inputText: string,
  productCatalog: CatalogItemInput[],
  todayDate: string
): Promise<ExtractedVoiceOperation | null> {
  const catalogContext = Array.isArray(productCatalog)
    ? productCatalog
        .slice(0, 60)
        .map(
          (c) =>
            `- "${c.producto}" (${c.costeUnitario}€/ud, ${c.material || 'PETG Negro (Elegoo)'})`
        )
        .join('\n')
    : '';

  const systemPrompt = `Extrae los datos de la operación de Formare 3D y devuelve SOLO un objeto JSON válido sin pensar largo ni añadir texto adicional.
Hoy: ${todayDate}.
Catálogo Formare 3D:
${catalogContext || '(Vacío)'}

Claves JSON exactas:
- "tipo": "venta" | "compra" | "inversion"
- "producto": nombre limpio del producto (usa el del catálogo si coincide)
- "unidades": entero >= 1
- "fecha": "YYYY-MM-DD" (por defecto "${todayDate}")
- "material": filamento usado (ej. "PETG Negro (Elegoo)", "ASA Negro (Winkle)", "PLA Negro (Elegoo / i3D)", "PETG Negro CF (Bambu / Elegoo)", "PETG Rojo (Winkle)", "TPU Negro")
- "precio": número en euros (0 si es compra o inversion)
- "costes": coste total en euros (si es venta de catálogo y no indica coste: costeUnitario * unidades)
- "costeUnitario": coste de 1 unidad en euros
- "lugarVenta": "Wallapop" | "Vinted" | "Etsy" | "eBay" | "Amazon" | "Internet" | "En persona" | "Cults3D" | "Otro"
- "estado": "Cobrado" | "Pagado" | "Pendiente de pago" | "En producción" | "Pendiente de cobro" | "Enviado" | "Cancelado" | "Otro"
- "vendedor": "Jorge" | "Sandra" | "Alejandro" | "Jorge, Sandra" | "Otro"
- "comentarios": string
- "esPedidoFilamento": boolean`;

  for (const model of GATEWAY_MODELS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 22000);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (process.env.KILO_API_KEY) {
        headers['Authorization'] = `Bearer ${process.env.KILO_API_KEY}`;
      }

      const response = await fetch(GATEWAY_URL, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model,
          temperature: 0,
          reasoning_effort: 'low',
          reasoning: { effort: 'low' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: inputText },
          ],
        }),
      });

      clearTimeout(timer);

      if (!response.ok) {
        continue;
      }

      const json: any = await response.json();
      const rawContent = json?.choices?.[0]?.message?.content || '';
      const parsed = extractJsonFromText(rawContent);

      if (parsed && typeof parsed === 'object') {
        return enrichWithCatalog(parsed, inputText, productCatalog, todayDate);
      }
    } catch {
      clearTimeout(timer);
    }
  }

  return null;
}

export async function processVoiceOperationRequest(
  body: VoiceOperationRequest
): Promise<VoiceOperationResponse> {
  const {
    text = '',
    transcriptText = '',
    productCatalog = [],
    todayDate = new Date().toISOString().slice(0, 10),
  } = body || {};

  const cleanInput = String(text || transcriptText || '').trim();
  if (!cleanInput) {
    throw new Error('Escribe los datos de la operación para que la IA los procese.');
  }

  const aiResult = await runGatewayAiExtraction(
    cleanInput,
    productCatalog,
    todayDate
  );

  if (aiResult && aiResult.producto) {
    return {
      ok: true,
      data: aiResult,
    };
  }

  const fallbackData = parseVoiceOperationSmartFallback(
    cleanInput,
    productCatalog,
    todayDate
  );

  return {
    ok: true,
    data: fallbackData,
  };
}
