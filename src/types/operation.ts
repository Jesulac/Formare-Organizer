export type OperationType = 'venta' | 'compra' | 'inversion' | 'cierre' | 'otro';

export type Platform = 
  | 'Wallapop'
  | 'Vinted'
  | 'Etsy'
  | 'eBay'
  | 'Cults3D'
  | 'En persona'
  | 'Internet'
  | 'Otro';

export type Status = 
  | 'Cobrado✅'
  | 'Pagado⭕'
  | 'Pendiente de cobro'
  | 'Enviado📦'
  | 'En producción'
  | 'Cancelado'
  | 'Otro';

export interface Operation {
  id: string;
  fecha: string; // ISO format YYYY-MM-DD or DD/MM/YYYY
  producto: string;
  material?: string;
  precio: number | null; // Gross sales revenue in EUR
  costes: number; // Purchase or material cost in EUR
  costesOperativos: number; // Operational costs in EUR
  beneficio: number; // Calculated net profit in EUR
  lugarVenta: Platform;
  estado: Status;
  comentarios?: string;
  vendedor?: string;
  tipo: OperationType;
  createdAt: number;
}

export type TimeFilter = 'todo' | 'hoy' | 'semana' | 'mes' | 'ano' | 'personalizado';

export type SortField = 'fecha' | 'precio' | 'costes' | 'beneficio' | 'producto';
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
