import { MaterialItem, Operation, OperationType, Platform, Status } from '../types/operation';

/**
 * Format number to Euro currency string (e.g., 12.5 -> "12,50 €")
 */
export function formatEuro(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '0,00 €';
  const isNegative = amount < 0;
  const absVal = Math.abs(amount);
  const formatted = absVal.toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${isNegative ? '-' : ''}${formatted} €`;
}

/**
 * Parse string or number to clean number in EUR
 */
export function parseEuro(input: string | number | null | undefined): number {
  if (typeof input === 'number') return isNaN(input) ? 0 : input;
  if (!input) return 0;
  let cleaned = input.replace(/\s/g, '').replace('€', '').replace(',', '.');
  let num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Normalize status string by removing emojis or legacy characters
 */
export function normalizeStatus(rawStatus: string | undefined | null): Status {
  if (!rawStatus) return 'En producción';
  const cleaned = rawStatus
    .replace(/[✅⭕📦\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .toLowerCase();

  if (cleaned.includes('cobrado')) return 'Cobrado';
  if (cleaned.includes('pendiente de pago')) return 'Pendiente de pago';
  if (cleaned.includes('pagado')) return 'Pagado';
  if (cleaned.includes('pendiente')) return 'Pendiente de cobro';
  if (cleaned.includes('enviado')) return 'Enviado';
  if (cleaned.includes('producc')) return 'En producción';
  if (cleaned.includes('cancelado')) return 'Cancelado';
  return 'Otro';
}

/**
 * Extract units count from comments if not explicitly set
 */
export function extractUnits(comentarios?: string, existingUnits?: number): number {
  if (typeof existingUnits === 'number' && existingUnits > 0) {
    return existingUnits;
  }
  if (comentarios) {
    const match = comentarios.match(/(\d+)\s*(unidades|uds|bobinas|filamentos)/i);
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10);
      if (parsed > 0) return parsed;
    }
  }
  return 1;
}

/**
 * Calculate net profit based on operation type, price (revenue), and total costs
 */
export function calculateBeneficio(
  precio: number | null,
  costes: number,
  costesOperativos: number = 0,
  tipo: OperationType = 'venta',
  vendedor?: string
): number {
  const p = precio || 0;
  const c = Math.abs(costes || 0);
  const cop = Math.abs(costesOperativos || 0);
  const bSandra = calculateSandraCommission(p, vendedor, tipo);

  if (tipo === 'venta') {
    return Number((p - c - cop - bSandra).toFixed(2));
  } else if (tipo === 'compra' || tipo === 'inversion') {
    return -Number((p > 0 ? p : c + cop).toFixed(2));
  } else if (tipo === 'cierre') {
    return Number((p - c - cop).toFixed(2));
  }
  return Number((p - c - cop).toFixed(2));
}

/**
 * Calculate the 15% general expense for sales where the seller is "Sandra" or "Jorge, Sandra" (precio * 0.15)
 */
export function calculateSandraExpense(
  op: Pick<Operation, 'tipo' | 'precio' | 'vendedor'>
): number {
  if (op.tipo !== 'venta') return 0;
  const vendedorNorm = (op.vendedor || '').toLowerCase();
  if (!vendedorNorm.includes('sandra')) return 0;
  const precio = op.precio && op.precio > 0 ? op.precio : 0;
  if (precio <= 0) return 0;
  return Number((precio * 0.15).toFixed(2));
}

/**
 * Check if seller includes Sandra ("Sandra" or "Jorge, Sandra")
 */
export function hasSandraSeller(vendedor?: string): boolean {
  if (!vendedor) return false;
  return vendedor.toLowerCase().includes('sandra');
}

/**
 * Calculate 15% (precio * 0.15) general expense when seller is "Sandra" or "Jorge, Sandra"
 */
export function calculateSandraCommission(
  precio: number | null | undefined,
  vendedor?: string,
  tipo: OperationType = 'venta'
): number {
  if (tipo !== 'venta') return 0;
  if (!hasSandraSeller(vendedor)) return 0;
  const p = precio && precio > 0 ? precio : 0;
  return Number((p * 0.15).toFixed(2));
}

/**
 * Add calendar days to a Date
 */
function addCalendarDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add business days (Monday-Friday, skipping Saturday and Sunday) to a Date
 */
function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added++;
    }
  }
  return result;
}

/**
 * Calculate shipping deadline (Fecha límite) automatically for sales:
 * - Wallapop: 5 calendar days (días naturales)
 * - Vinted: 5 business days (días laborables)
 * - Etsy: 3 business days (días laborables)
 * - eBay: 3 business days (días laborables)
 * - Amazon: 3 business days (días laborables)
 * - Compras / Inversiones / Cierres: empty string ''
 */
export function calculateDeadlineDate(
  fechaStr: string,
  platform: Platform,
  tipo: OperationType
): string {
  if (tipo !== 'venta' || !fechaStr) {
    return '';
  }

  const baseDate = parseDate(fechaStr);
  let targetDate: Date | null = null;

  switch (platform) {
    case 'Wallapop':
      targetDate = addCalendarDays(baseDate, 5);
      break;
    case 'Vinted':
      targetDate = addBusinessDays(baseDate, 5);
      break;
    case 'Etsy':
    case 'eBay':
    case 'Amazon':
      targetDate = addBusinessDays(baseDate, 3);
      break;
    case 'En persona':
    case 'Cults3D':
      return '';
    default:
      targetDate = addCalendarDays(baseDate, 5);
      break;
  }

  if (!targetDate) return '';
  return formatDateInput(targetDate.toISOString());
}

/**
 * Rule of three for filament grams consumed:
 * Each spool has 1000g and costs `precioBobina` €.
 * Grams consumed = (costeGastadoEnVenta * 1000) / precioBobina
 */
export function calculateFilamentGrams(
  costeGastadoEnVenta: number,
  precioBobina1000g: number = 15.99
): number {
  const cost = Math.abs(costeGastadoEnVenta || 0);
  const spoolPrice = precioBobina1000g > 0 ? precioBobina1000g : 15.99;
  return Number(((cost * 1000) / spoolPrice).toFixed(2));
}

/**
 * Parse a single material chunk like "PETG Negro (Elegoo) (120.5g)" or "PLA Rojo 45,2g"
 * into { material, gramos }
 */
export function parseSingleMaterialChunk(chunk: string): MaterialItem {
  const trimmed = chunk.trim();
  if (!trimmed) return { material: '' };

  // Match trailing "(120g)" or "(120.5 g)" or "- 120,5g" or "120g"
  const parenMatch = trimmed.match(/^(.*?)\s*\(\s*(\d+(?:[.,]\d+)?)\s*g(?:ramos?)?\s*\)\s*$/i);
  if (parenMatch && parenMatch[1].trim()) {
    const g = parseFloat(parenMatch[2].replace(',', '.'));
    return {
      material: parenMatch[1].trim(),
      gramos: !isNaN(g) && g > 0 ? Number(g.toFixed(2)) : undefined,
    };
  }

  const suffixMatch = trimmed.match(/^(.*?)(?:\s*[-:]\s*|\s+)(\d+(?:[.,]\d+)?)\s*g(?:ramos?)?\s*$/i);
  if (suffixMatch && suffixMatch[1].trim() && !/\b(1000)\b/.test(suffixMatch[2])) {
    const g = parseFloat(suffixMatch[2].replace(',', '.'));
    return {
      material: suffixMatch[1].trim(),
      gramos: !isNaN(g) && g > 0 ? Number(g.toFixed(2)) : undefined,
    };
  }

  return { material: trimmed };
}

/**
 * Parse raw material string and/or structured materialesDetalle into MaterialItem[]
 */
export function parseMaterialItems(
  rawMaterial?: string,
  existingDetalle?: MaterialItem[]
): MaterialItem[] {
  if (Array.isArray(existingDetalle) && existingDetalle.length > 0) {
    const cleaned = existingDetalle
      .map((item) => ({
        material: (item.material || '').trim(),
        gramos:
          typeof item.gramos === 'number' && !isNaN(item.gramos) && item.gramos > 0
            ? Number(item.gramos.toFixed(2))
            : undefined,
      }))
      .filter((item) => item.material.length > 0);
    if (cleaned.length > 0) return cleaned;
  }

  const str = (rawMaterial || '').trim();
  if (!str) return [];

  // Split by "+" or " y " (avoid splitting inside parentheses like "(Bambu / Elegoo)" or "(Elegoo / i3D)")
  const parts = str
    .split(/\s*\+\s*|\s+y\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return [parseSingleMaterialChunk(str)];
  }

  return parts.map(parseSingleMaterialChunk).filter((item) => item.material.length > 0);
}

/**
 * Format MaterialItem[] into display string for Operation.material
 * - If 1 item without grams -> "PETG Negro (Elegoo)"
 * - If multiple items (or with grams) -> "PETG Negro (Elegoo) (120.5g) + PLA Rojo (Elegoo) (45g)"
 */
export function formatMaterialItems(items: MaterialItem[], includeGramsWhenSingle = false): string {
  const valid = items
    .map((i) => ({
      material: (i.material || '').trim(),
      gramos: typeof i.gramos === 'number' && i.gramos > 0 ? Number(i.gramos.toFixed(2)) : undefined,
    }))
    .filter((i) => i.material.length > 0);

  if (valid.length === 0) return '';
  if (valid.length === 1 && !includeGramsWhenSingle) {
    return valid[0].material;
  }

  return valid
    .map((i) => (i.gramos && i.gramos > 0 ? `${i.material} (${i.gramos}g)` : i.material))
    .join(' + ');
}

/**
 * Calculate total filament grams consumed by a sale operation (respects multi-material explicit grams if present)
 */
export function getOperationConsumedGrams(
  op: Pick<Operation, 'tipo' | 'costes' | 'unidades' | 'material' | 'materialesDetalle'>,
  defaultSpoolPrice: number = 15.99
): number {
  if (op.tipo !== 'venta') return 0;
  const items = parseMaterialItems(op.material, op.materialesDetalle).filter(
    (item) =>
      item.material &&
      !item.material.toLowerCase().includes('tornillo') &&
      !item.material.toLowerCase().includes('tuerca')
  );

  const uds = op.unidades && op.unidades > 0 ? op.unidades : 1;
  const hasExplicitGrams = items.some((i) => i.gramos && i.gramos > 0);

  if (hasExplicitGrams) {
    const itemsWithoutGrams = items.filter((i) => !i.gramos || i.gramos <= 0);
    let totalGrams = 0;
    items.forEach((i) => {
      if (i.gramos && i.gramos > 0) {
        totalGrams += i.gramos * uds;
      }
    });
    if (itemsWithoutGrams.length > 0 && op.costes && op.costes > 0) {
      const shareCost = Math.abs(op.costes) / items.length;
      totalGrams +=
        itemsWithoutGrams.length * calculateFilamentGrams(shareCost, defaultSpoolPrice);
    }
    return Number(totalGrams.toFixed(2));
  }

  return calculateFilamentGrams(Math.abs(op.costes || 0), defaultSpoolPrice);
}

/**
 * Strategy Pricing Rules:
 * If cost < 1€ -> Price = Cost * 8
 * If cost >= 1€ and cost <= 3€ -> Price = Cost * 7
 * If cost > 3€ -> Price = Cost * 6
 * Max Discount Price = Cost * 5
 */
export interface PricingCalculation {
  cost: number;
  multiplier: number;
  recommendedPrice: number;
  maxDiscountPrice: number;
  profitRecommended: number;
  profitDiscount: number;
}

export function calculatePricingRules(materialCost: number): PricingCalculation {
  const cost = Math.max(0, materialCost);
  let multiplier = 8;

  if (cost < 1) {
    multiplier = 8;
  } else if (cost >= 1 && cost <= 3) {
    multiplier = 7;
  } else {
    multiplier = 6;
  }

  const recommendedPrice = cost * multiplier;
  const maxDiscountPrice = cost * 5;

  return {
    cost,
    multiplier,
    recommendedPrice,
    maxDiscountPrice,
    profitRecommended: recommendedPrice - cost,
    profitDiscount: maxDiscountPrice - cost,
  };
}

/**
 * Fastener Cost Rules:
 * Screw: 0.07 €/ud
 * Nut: 0.04 €/ud
 */
export function calculateFastenerCost(screws: number, nuts: number): number {
  const screwCost = Math.max(0, screws) * 0.07;
  const nutCost = Math.max(0, nuts) * 0.04;
  return screwCost + nutCost;
}

/**
 * Revenue Split Rules:
 * 20% Costes Operativos
 * 20% Stock
 * 30% Productor
 * 30% Beneficio Empresa
 */
export interface RevenueSplitResult {
  amount: number;
  operativos: number; // 20%
  stock: number;      // 20%
  productor: number;  // 30%
  empresa: number;    // 30%
}

export function calculateRevenueSplit(amount: number): RevenueSplitResult {
  const val = Math.max(0, amount);
  return {
    amount: val,
    operativos: val * 0.20,
    stock: val * 0.20,
    productor: val * 0.30,
    empresa: val * 0.30,
  };
}

/**
 * Parse date string into Date object safely
 * Supports DD/MM/YYYY, YYYY-MM-DD
 */
export function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
  }

  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      } else {
        return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      }
    }
  }

  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Format Date to standard DD/MM/YYYY
 */
export function formatDateDisplay(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  const d = parseDate(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format Date to YYYY-MM-DD for HTML <input type="date">
 */
export function formatDateInput(dateStr: string): string {
  const d = parseDate(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${year}-${month}-${day}`;
}

/**
 * Compress an uploaded image file (QR / barcode / photo) to a compact Data URL
 */
export function compressImageFile(file: File, maxWidth = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = event.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
