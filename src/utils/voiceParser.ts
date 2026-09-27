export interface CatalogItemInput {
  producto: string;
  costeUnitario: number;
  material?: string;
}

export interface ExtractedVoiceOperation {
  transcripcion: string;
  tipo: 'venta' | 'compra' | 'inversion';
  producto: string;
  unidades: number;
  fecha: string;
  material: string;
  precio: number;
  costes: number;
  costeUnitario: number;
  lugarVenta: string;
  estado: string;
  vendedor: string;
  comentarios: string;
  esPedidoFilamento: boolean;
}

function normalizeStr(str: string): string {
  return str
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

export function parseVoiceOperationSmartFallback(
  rawText: string,
  productCatalog: CatalogItemInput[] = [],
  todayDate: string = new Date().toISOString().slice(0, 10)
): ExtractedVoiceOperation {
  const text = (rawText || '').trim();
  const norm = normalizeStr(text);

  // 1. Detect operation type (venta, compra, inversion)
  let tipo: 'venta' | 'compra' | 'inversion' = 'venta';
  if (
    /\b(inversion|activo|impresora|maquinaria|bambu lab|herramienta)\b/.test(norm)
  ) {
    tipo = 'inversion';
  } else if (
    /\b(compra|comprado|pedido|bobina|bobinas|filamento|aliexpress|temu|amazon compra|gasto|reposicion)\b/.test(
      norm
    ) &&
    !/\b(venta de|vendido)\b/.test(norm)
  ) {
    tipo = 'compra';
  }

  // 2. Detect units (unidades)
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

  // 3. Match product from catalog or extract clean product name
  let matchedCatalog: CatalogItemInput | undefined;
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

    // Token overlap score
    const tokens = itemNorm
      .split(/[\s\-()/]+/)
      .filter((t) => t.length >= 2 && !['de', 'el', 'la', 'los', 'las', 'para', 'con'].includes(t));
    if (tokens.length === 0) continue;

    let matchedTokens = 0;
    for (const token of tokens) {
      if (norm.includes(token)) {
        matchedTokens++;
      }
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

  // 4. Detect platform (lugarVenta)
  let lugarVenta = tipo === 'venta' ? 'Wallapop' : 'Internet';
  if (/\bvinted\b/.test(norm)) lugarVenta = 'Vinted';
  else if (/\bwallapop\b/.test(norm)) lugarVenta = 'Wallapop';
  else if (/\betsy\b/.test(norm)) lugarVenta = 'Etsy';
  else if (/\bebay\b/.test(norm)) lugarVenta = 'eBay';
  else if (/\bamazon\b/.test(norm)) lugarVenta = 'Amazon';
  else if (/\bcults3d|cults\b/.test(norm)) lugarVenta = 'Cults3D';
  else if (/\b(en persona|mano|efectivo|presencial)\b/.test(norm)) lugarVenta = 'En persona';
  else if (/\b(internet|web|aliexpress|temu)\b/.test(norm)) lugarVenta = 'Internet';

  // 5. Detect status (estado)
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

  // 6. Detect seller (vendedor)
  let vendedor = 'Jorge';
  const hasJorge = /\bjorge\b/.test(norm);
  const hasSandra = /\bsandra\b/.test(norm);
  const hasAlejandro = /\balejandro\b/.test(norm);
  if (hasJorge && hasSandra) {
    vendedor = 'Jorge, Sandra';
  } else if (hasSandra) {
    vendedor = 'Sandra';
  } else if (hasAlejandro) {
    vendedor = 'Alejandro';
  } else if (hasJorge) {
    vendedor = 'Jorge';
  }

  // 7. Detect material
  let material = matchedCatalog?.material || (tipo === 'venta' ? 'PETG Negro (Elegoo)' : '');
  if (/\bpetg\b.*\bcf\b|\bfibra de carbono\b/.test(norm)) {
    material = 'PETG Negro CF (Bambu / Elegoo)';
  } else if (/\bpetg\b.*\brojo\b/.test(norm)) {
    material = 'PETG Rojo (Winkle)';
  } else if (/\bpetg\b.*\bblanco\b/.test(norm)) {
    material = 'PETG Blanco';
  } else if (/\bpetg\b/.test(norm)) {
    material = 'PETG Negro (Elegoo)';
  } else if (/\basa\b/.test(norm)) {
    material = 'ASA Negro (Winkle)';
  } else if (/\bpla\b.*\b(blanco|gris|rojo|azul)\b/.test(norm)) {
    const colorMatch = norm.match(/\bpla\s+(blanco|gris|rojo|azul)\b/);
    const col = colorMatch ? colorMatch[1].charAt(0).toUpperCase() + colorMatch[1].slice(1) : 'Negro';
    material = `PLA ${col}`;
  } else if (/\bpla\b/.test(norm)) {
    material = 'PLA Negro (Elegoo / i3D)';
  } else if (/\btpu\b/.test(norm)) {
    material = 'TPU Negro';
  }

  // 8. Detect date (fecha)
  let fecha = todayDate;
  if (/\banteayer\b/.test(norm)) {
    const d = new Date(`${todayDate}T12:00:00`);
    d.setDate(d.getDate() - 2);
    fecha = d.toISOString().slice(0, 10);
  } else if (/\bayer\b/.test(norm)) {
    const d = new Date(`${todayDate}T12:00:00`);
    d.setDate(d.getDate() - 1);
    fecha = d.toISOString().slice(0, 10);
  } else {
    const isoMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (isoMatch) {
      fecha = isoMatch[1];
    }
  }

  // 9. Detect price (precio) and cost (costes)
  let precio = 0;
  let costes = 0;

  // Check explicit cost mention first: "coste 3 euros", "costes 4,50"
  const costExplicitMatch = norm.match(
    /\b(?:coste|costes|costo|gasto|costado)\s*(?:de)?\s*(\d+(?:[.,]\d{1,2})?)\s*(?:euros|euro|€)?/
  );
  if (costExplicitMatch) {
    costes = parseFloat(costExplicitMatch[1].replace(',', '.')) || 0;
  }

  // Check explicit price mention: "por 18 euros", "a 25 euros", "precio 20", "18€"
  const priceExplicitMatch = norm.match(
    /\b(?:precio|por|a|en|vendido por|venta por)\s*(\d+(?:[.,]\d{1,2})?)\s*(?:euros|euro|€)\b/
  ) || norm.match(/\b(\d+(?:[.,]\d{1,2})?)\s*(?:euros|euro|€)\b/);

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

  // 10. Determine clean product name if not matched in catalog
  let producto = matchedCatalog?.producto || '';
  if (!producto) {
    let cleaned = text
      .replace(/^(?:nueva\s+)?(?:venta|compra|pedido|inversion|operacion)\s+(?:de\s+)?/i, '')
      .replace(/^(?:\d+|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(?:unidades\s+de\s+|piezas\s+de\s+)?/i, '')
      .replace(/\b(?:por|a|precio)\s+\d+(?:[.,]\d{1,2})?\s*(?:euros|euro|€)?.*$/i, '')
      .replace(/\b(?:en|por)\s+(?:wallapop|vinted|etsy|ebay|amazon|internet|persona|cults3d).*$/i, '')
      .replace(/\b(?:estado\s+)?(?:en produccion|produccion|cobrado|pagado|pendiente de cobro|pendiente de pago|enviado|cancelado).*$/i, '')
      .replace(/\b(?:vendedor|vendedora)\s+(?:jorge|sandra|alejandro).*$/i, '')
      .replace(/[.,;]+$/, '')
      .trim();

    if (!cleaned) {
      cleaned = tipo === 'compra' ? 'Pedido filamento 3D' : text.slice(0, 60).trim() || 'Producto 3D';
    } else {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    producto = cleaned;
  }

  const esPedidoFilamento =
    tipo === 'compra' &&
    /\b(filamento|bobina|bobinas|petg|pla|asa|tpu)\b/.test(norm);

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
    esPedidoFilamento,
  };
}
