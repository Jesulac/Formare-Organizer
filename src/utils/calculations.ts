import { Operation, OperationType } from '../types/operation';

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
  // Replace comma with dot and remove € sign and non-numeric characters except minus and dot
  let cleaned = input.replace(/\s/g, '').replace('€', '').replace(',', '.');
  let num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Calculate net profit based on operation type, price (revenue), material costs, and operational costs
 */
export function calculateBeneficio(
  precio: number | null,
  costes: number,
  costesOperativos: number = 0,
  tipo: OperationType = 'venta'
): number {
  const p = precio || 0;
  // Costes are usually positive numbers representing cost, but if user enters negative numbers like -10.98, handle absolute cost
  const c = Math.abs(costes || 0);
  const cop = Math.abs(costesOperativos || 0);

  if (tipo === 'venta') {
    return p - c - cop;
  } else if (tipo === 'compra' || tipo === 'inversion') {
    // For purchases/investments, profit is negative of the total outgoing cost
    return - (p > 0 ? p : (c + cop));
  } else if (tipo === 'cierre') {
    // Cierre row can specify its own profit or price - costs
    return p - c - cop;
  }
  return p - c - cop;
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
      // Could be YYYY-MM-DD or DD-MM-YYYY
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
export function formatDateDisplay(dateStr: string): string {
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
