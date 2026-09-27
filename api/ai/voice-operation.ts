const GATEWAY_URL = 'https://api.kilo.ai/api/gateway/chat/completions';
const GATEWAY_MODELS = [
  'stepfun/step-3.7-flash:free',
  'stepfun/step-3.7-flash',
  'kilo-auto/free',
];

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

  let estado = tipo === 'venta' ? 'En producción' : 'Pagado';
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
      text = '',
      transcriptText = '',
      productCatalog = [],
      todayDate = new Date().toISOString().slice(0, 10),
    } = body;

    const cleanInput = String(text || transcriptText || '').trim();
    if (!cleanInput) {
      return res.status(400).json({
        error: 'Escribe los datos de la operación para que la IA los procese.',
      });
    }

    const catalogContext = Array.isArray(productCatalog)
      ? productCatalog
          .slice(0, 60)
          .map(
            (c: any) =>
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
              { role: 'user', content: cleanInput },
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
          const fallback = parseVoiceOperationSmartFallback(
            `${cleanInput} ${parsed.producto || ''}`,
            productCatalog,
            todayDate
          );
          const rawTipo = String(parsed.tipo || '').toLowerCase().trim();
          const tipo =
            rawTipo.includes('compra') || rawTipo.includes('pedido')
              ? 'compra'
              : rawTipo.includes('inver') || rawTipo.includes('activo')
              ? 'inversion'
              : rawTipo.includes('venta')
              ? 'venta'
              : fallback.tipo || 'venta';
          const uds =
            Number(parsed.unidades) >= 1
              ? Math.round(Number(parsed.unidades))
              : fallback.unidades || 1;
          const cleanProd = String(parsed.producto || '')
            .replace(/^(?:\d+|un|una|dos|tres|cuatro|cinco)\s+/i, '')
            .trim();
          const matched = productCatalog.find(
            (c: any) =>
              c.producto.toLowerCase() === cleanProd.toLowerCase() ||
              c.producto.toLowerCase() === (fallback.producto || '').toLowerCase()
          );
          const costes =
            Number(parsed.costes) > 0
              ? Number(Number(parsed.costes).toFixed(2))
              : matched && matched.costeUnitario > 0
              ? Number((matched.costeUnitario * uds).toFixed(2))
              : fallback.costes;

          return res.status(200).json({
            ok: true,
            data: {
              transcripcion: cleanInput,
              tipo,
              producto: matched ? matched.producto : cleanProd || fallback.producto,
              unidades: uds,
              fecha:
                parsed.fecha && /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.fecha))
                  ? String(parsed.fecha)
                  : fallback.fecha || todayDate,
              material:
                (parsed.material && String(parsed.material).trim()) ||
                matched?.material ||
                fallback.material ||
                (tipo === 'venta' ? 'PETG Negro (Elegoo)' : ''),
              precio:
                tipo === 'compra' || tipo === 'inversion'
                  ? 0
                  : Number(parsed.precio) > 0
                  ? Number(Number(parsed.precio).toFixed(2))
                  : fallback.precio,
              costes,
              costeUnitario:
                uds > 0 && costes > 0
                  ? Number((costes / uds).toFixed(2))
                  : matched?.costeUnitario || fallback.costeUnitario || 0,
              lugarVenta: String(
                parsed.lugarVenta || fallback.lugarVenta || (tipo === 'venta' ? 'Wallapop' : 'Internet')
              ),
              estado: String(
                parsed.estado || fallback.estado || (tipo === 'venta' ? 'En producción' : 'Pagado')
              ),
              vendedor: String(parsed.vendedor || fallback.vendedor || 'Jorge'),
              comentarios: String(parsed.comentarios || ''),
              esPedidoFilamento: Boolean(
                parsed.esPedidoFilamento ?? fallback.esPedidoFilamento
              ),
            },
          });
        }
      } catch {
        clearTimeout(timer);
      }
    }

    const fallbackData = parseVoiceOperationSmartFallback(
      cleanInput,
      productCatalog,
      todayDate
    );
    return res.status(200).json({
      ok: true,
      data: fallbackData,
    });
  } catch (err: any) {
    return res.status(500).json({
      error:
        err?.message ||
        'No se pudo procesar el texto con Inteligencia Artificial. Inténtalo de nuevo.',
    });
  }
}
