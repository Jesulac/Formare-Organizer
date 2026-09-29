export type OperationType = 'venta' | 'compra' | 'inversion' | 'cierre' | 'otro';

export type Platform = 
  | 'Wallapop'
  | 'Vinted'
  | 'Etsy'
  | 'eBay'
  | 'Amazon'
  | 'Cults3D'
  | 'En persona'
  | 'Internet'
  | 'Otro';

export type Status = 
  | 'Cobrado'
  | 'Pagado'
  | 'Pendiente de pago'
  | 'En producción'
  | 'Pendiente de cobro'
  | 'Enviado'
  | 'Cancelado'
  | 'Otro';

export type ShippingCompany = 'Correos' | 'InPost' | 'Seur' | 'Vinted Go' | 'Otro';

export interface MaterialItem {
  material: string;
  gramos?: number; // Grams per unit of product
}

export interface Operation {
  id: string;
  fecha: string; // ISO format YYYY-MM-DD or DD/MM/YYYY
  producto: string;
  unidades: number; // Default 1, multiplies unit cost
  costeUnitario?: number; // Base filament cost per 1 unit
  material?: string;
  materialesDetalle?: MaterialItem[]; // Multi-material breakdown with filament and grams
  precio: number | null; // Gross sales revenue in EUR
  costes: number; // Total filament or purchase cost in EUR
  costesOperativos: number; // Legacy field kept for compatibility (0)
  beneficio: number; // Calculated net profit in EUR
  lugarVenta: Platform;
  estado: Status;
  comentarios?: string;
  vendedor?: string;
  tipo: OperationType;
  fechaLimite?: string; // Auto-calculated shipping deadline for sales, empty for purchases
  fotoQr?: string; // Base64 image attached to this order (QR / barcode / photo)
  empresaEnvio?: ShippingCompany; // Correos, InPost, Seur, Vinted Go, Otro
  fechaSubidaQr?: number; // Timestamp in ms when QR was uploaded (auto-deletes after 10 days)
  esPedidoFilamento?: boolean; // True if purchase is a 1000g filament spool order
  createdAt: number;
  updatedAt?: number;
  editCount?: number;
}

export interface ProductCatalogItem {
  producto: string;
  costeUnitario: number;
  material: string;
  materialesDetalle?: MaterialItem[];
}

export interface FilamentSpool {
  id: string;
  nombre: string; // Material/filament identifier
  gramosIniciales: number; // 1000g per spool ordered
  precioBobina: number; // Price per 1000g spool in EUR
  bobinasCompradas: number;
  gramosConsumidos: number; // Calculated via rule of three from sales
  gramosRestantes: number; // gramosIniciales - gramosConsumidos + ajusteManualGramos
  ajusteManualGramos?: number; // Manual wear/waste offset in grams so user edits persist alongside automatic sales calculations
  ultimaCompraFecha?: string;
}

export interface MonthlySummary {
  monthKey: string; // YYYY-MM
  monthLabel: string; // e.g., "Septiembre 2026"
  numVentas: number;
  numPedidos: number; // Compras
  dineroBruto: number; // Total sales price
  dineroGastadoCompras: number; // Total spent on purchases + B. Sandra
  beneficioSandra: number; // Total B. Sandra (precio * 0.15) in the month
  costesVentas: number; // Filament costs of sales
  dineroNeto: number; // Net profit (Bruto - costesVentas)
  gramosConsumidos: number; // Total filament grams consumed in the month (max 2 decimals)
}

export type TimeFilter = 'todo' | 'hoy' | 'semana' | 'mes' | 'ano' | 'personalizado';

export type SortField = 'fecha' | 'fechaLimite' | 'precio' | 'costes' | 'beneficio' | 'producto';
export type SortOrder = 'asc' | 'desc';

export interface FilterOptions {
  search: string;
  timeFilter: TimeFilter;
  platform: string; // 'all' or Platform
  status: string; // 'all' or Status
  tipo: string; // 'all' or OperationType
  vendedor: string; // 'all' or Seller Name
  startDate?: string;
  endDate?: string;
  sortBy: SortField;
  sortOrder: SortOrder;
}
