import { useState, useEffect, useMemo } from 'react';
import { 
  Operation, 
  FilterOptions, 
  ProductCatalogItem,
  FilamentSpool,
  MonthlySummary,
  ShippingCompany
} from '../types/operation';
import { initialOperations } from '../data/initialData';
import { 
  calculateBeneficio, 
  calculateDeadlineDate, 
  calculateFilamentGrams, 
  extractUnits, 
  normalizeStatus, 
  parseDate 
} from '../utils/calculations';

const STORAGE_KEY = 'wallapop_organizer_ops_v1';
const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function sanitizeAndMigrateOperations(rawList: any[]): Operation[] {
  const now = Date.now();
  return rawList
    // Filter out legacy manual summary rows like "febrero 2026", "marzo 2026" since we generate complete automatic monthly summaries
    .filter((op) => op && op.tipo !== 'cierre')
    .map((op) => {
      const unidades = extractUnits(op.comentarios, op.unidades);
      const estado = normalizeStatus(op.estado);
      const tipo = op.tipo || 'venta';
      const fechaLimite =
        tipo === 'venta'
          ? op.fechaLimite || calculateDeadlineDate(op.fecha, op.lugarVenta || 'Wallapop', tipo)
          : '';
      const costes = typeof op.costes === 'number' ? op.costes : 0;
      const costeUnitario =
        typeof op.costeUnitario === 'number' && op.costeUnitario > 0
          ? op.costeUnitario
          : unidades > 0
          ? Number((costes / unidades).toFixed(2))
          : costes;

      // Auto-delete QR data older than 10 days
      let fotoQr = op.fotoQr;
      let empresaEnvio = op.empresaEnvio;
      let fechaSubidaQr = op.fechaSubidaQr;
      if (fechaSubidaQr && now - fechaSubidaQr > TEN_DAYS_MS) {
        fotoQr = undefined;
        empresaEnvio = undefined;
        fechaSubidaQr = undefined;
      }

      const isFilamentoOrder =
        op.esPedidoFilamento ??
        (tipo === 'compra' &&
          ((op.producto && op.producto.toLowerCase().includes('filamento')) ||
            (op.material && /(pla|petg|asa|tpu)/i.test(op.material))));

      const beneficio = calculateBeneficio(
        op.precio ?? null,
        costes,
        0,
        tipo
      );

      return {
        ...op,
        unidades,
        costeUnitario,
        costes,
        costesOperativos: 0,
        beneficio,
        estado,
        tipo,
        fechaLimite,
        fotoQr,
        empresaEnvio,
        fechaSubidaQr,
        esPedidoFilamento: isFilamentoOrder,
      } as Operation;
    });
}

function normalizeFilamentKey(raw: string): string {
  const s = raw.toLowerCase().trim();
  if (s.includes('petg') && s.includes('rojo')) return 'PETG Rojo (Winkle)';
  if (s.includes('petg') && (s.includes('cf') || s.includes('fc') || s.includes('fcf'))) return 'PETG Negro CF (Bambu / Elegoo)';
  if (s.includes('petg') && s.includes('bambu')) return 'PETG Negro (Bambulab)';
  if (s.includes('petg') && s.includes('esun')) return 'PETG Negro (eSun)';
  if (s.includes('petg') && s.includes('sunlu')) return 'PETG Negro (Sunlu)';
  if (s.includes('petg')) return 'PETG Negro (Elegoo)';
  if (s.includes('asa')) return 'ASA Negro (Winkle)';
  if (s.includes('tpu')) return 'TPU Negro';
  if (s.includes('pla') && s.includes('rojo')) return 'PLA Rojo (Elegoo)';
  if (s.includes('pla') && s.includes('azul')) return 'PLA Azul (eSun)';
  if (s.includes('pla') && s.includes('blanco')) return 'PLA Blanco (Elegoo)';
  if (s.includes('pla')) return 'PLA Negro (Elegoo / i3D)';
  return raw.trim();
}

export function useOperations() {
  const [operations, setOperations] = useState<Operation[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return sanitizeAndMigrateOperations(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to parse operations from localStorage', e);
    }
    return sanitizeAndMigrateOperations(initialOperations);
  });

  // Filters state
  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    timeFilter: 'todo',
    platform: 'all',
    status: 'all',
    tipo: 'all',
    vendedor: 'all',
    sortBy: 'fecha',
    sortOrder: 'desc',
  });

  // Save to localStorage whenever operations change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(operations));
    } catch (e) {
      console.error('Failed to save operations to localStorage', e);
    }
  }, [operations]);

  // CRUD Actions
  const addOperation = (opData: Omit<Operation, 'id' | 'createdAt' | 'beneficio'>) => {
    const unidades = opData.unidades && opData.unidades > 0 ? opData.unidades : 1;
    const estado = normalizeStatus(opData.estado);
    const fechaLimite =
      opData.tipo === 'venta'
        ? opData.fechaLimite || calculateDeadlineDate(opData.fecha, opData.lugarVenta, opData.tipo)
        : '';

    const beneficio = calculateBeneficio(
      opData.precio,
      opData.costes,
      0,
      opData.tipo
    );

    const newOp: Operation = {
      ...opData,
      unidades,
      costeUnitario: opData.costeUnitario ?? Number((opData.costes / unidades).toFixed(2)),
      costesOperativos: 0,
      estado,
      fechaLimite,
      id: `op-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      beneficio,
      createdAt: Date.now(),
    };

    setOperations((prev) => [newOp, ...prev]);
    return newOp;
  };

  const updateOperation = (id: string, opData: Partial<Operation>) => {
    setOperations((prev) =>
      prev.map((op) => {
        if (op.id !== id) return op;

        const updated = { ...op, ...opData };
        if (updated.estado) {
          updated.estado = normalizeStatus(updated.estado);
        }
        if (updated.tipo === 'venta' && (opData.fecha || opData.lugarVenta || opData.tipo)) {
          if (!opData.fechaLimite) {
            updated.fechaLimite = calculateDeadlineDate(updated.fecha, updated.lugarVenta, updated.tipo);
          }
        } else if (updated.tipo !== 'venta') {
          updated.fechaLimite = '';
        }

        const beneficio = calculateBeneficio(
          updated.precio,
          updated.costes,
          0,
          updated.tipo
        );

        return {
          ...updated,
          beneficio,
        };
      })
    );
  };

  const attachQrToOperation = (
    id: string,
    fotoQr: string | undefined,
    empresaEnvio?: ShippingCompany
  ) => {
    setOperations((prev) =>
      prev.map((op) => {
        if (op.id !== id) return op;
        return {
          ...op,
          fotoQr,
          empresaEnvio: fotoQr ? empresaEnvio || op.empresaEnvio || 'Correos' : undefined,
          fechaSubidaQr: fotoQr ? Date.now() : undefined,
        };
      })
    );
  };

  const deleteOperation = (id: string) => {
    setOperations((prev) => prev.filter((op) => op.id !== id));
  };

  const duplicateOperation = (id: string) => {
    const target = operations.find((op) => op.id === id);
    if (!target) return;

    const dup: Operation = {
      ...target,
      id: `op-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      producto: `${target.producto}`,
      createdAt: Date.now(),
    };

    setOperations((prev) => [dup, ...prev]);
  };

  const resetToDefaultData = () => {
    const clean = sanitizeAndMigrateOperations(initialOperations);
    setOperations(clean);
  };

  const clearAllData = () => {
    setOperations([]);
  };

  const exportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(operations, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `formare-3d-operaciones-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const importJSON = (jsonString: string): boolean => {
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed)) {
        setOperations(sanitizeAndMigrateOperations(parsed));
        return true;
      }
    } catch (e) {
      console.error('Failed to import JSON', e);
    }
    return false;
  };

  // Catalog of sold products with their unit filament cost & material (NO sale price stored!)
  const productCatalog = useMemo<ProductCatalogItem[]>(() => {
    const map = new Map<string, ProductCatalogItem>();
    // Traverse oldest to newest so latest unit cost wins
    [...operations]
      .sort((a, b) => parseDate(a.fecha).getTime() - parseDate(b.fecha).getTime())
      .forEach((op) => {
        if (op.tipo !== 'venta') return;
        const name = op.producto.trim();
        if (!name) return;
        const key = name.toLowerCase();
        const uds = op.unidades && op.unidades > 0 ? op.unidades : 1;
        const unitCost =
          op.costeUnitario && op.costeUnitario > 0
            ? op.costeUnitario
            : Number((Math.abs(op.costes || 0) / uds).toFixed(2));

        const existing = map.get(key);
        map.set(key, {
          producto: existing ? existing.producto : name,
          costeUnitario: unitCost > 0 ? unitCost : existing?.costeUnitario || 0,
          material: op.material || existing?.material || '',
        });
      });

    return Array.from(map.values()).sort((a, b) => a.producto.localeCompare(b.producto, 'es'));
  }, [operations]);

  // Filament Stock Database (1000g per spool bought, rule-of-three consumption on sales)
  const filamentStock = useMemo<FilamentSpool[]>(() => {
    const spoolsMap = new Map<
      string,
      {
        nombre: string;
        bobinasCompradas: number;
        gramosIniciales: number;
        totalGastadoCompras: number;
        precioBobina: number;
        gramosConsumidos: number;
        ultimaCompraFecha?: string;
      }
    >();

    // Base initial spools so every active material starts with at least 1 spool (1000g)
    const defaultFilaments: Array<{ nombre: string; precio: number }> = [
      { nombre: 'PETG Negro (Elegoo)', precio: 15.0 },
      { nombre: 'PETG Negro CF (Bambu / Elegoo)', precio: 16.5 },
      { nombre: 'PETG Negro (Bambulab)', precio: 12.86 },
      { nombre: 'PETG Negro (eSun)', precio: 13.43 },
      { nombre: 'PETG Negro (Sunlu)', precio: 14.99 },
      { nombre: 'PETG Rojo (Winkle)', precio: 15.99 },
      { nombre: 'ASA Negro (Winkle)', precio: 19.99 },
      { nombre: 'PLA Negro (Elegoo / i3D)', precio: 15.99 },
      { nombre: 'PLA Rojo (Elegoo)', precio: 14.99 },
      { nombre: 'PLA Azul (eSun)', precio: 12.99 },
      { nombre: 'PLA Blanco (Elegoo)', precio: 14.99 },
      { nombre: 'TPU Negro', precio: 18.99 },
    ];

    defaultFilaments.forEach((f) => {
      spoolsMap.set(f.nombre, {
        nombre: f.nombre,
        bobinasCompradas: 1,
        gramosIniciales: 1000,
        totalGastadoCompras: f.precio,
        precioBobina: f.precio,
        gramosConsumidos: 0,
      });
    });

    // 1. Process all filament purchases (each unit = 1000g)
    operations.forEach((op) => {
      const isFilamentoPurchase =
        op.tipo === 'compra' &&
        (op.esPedidoFilamento ||
          op.producto.toLowerCase().includes('filamento') ||
          (op.material && /(pla|petg|asa|tpu)/i.test(op.material)));

      if (isFilamentoPurchase) {
        const rawMat = op.material || op.producto;
        const key = normalizeFilamentKey(rawMat);
        const units = op.unidades && op.unidades > 0 ? op.unidades : 1;
        const cost = Math.abs(op.costes || 0);
        const unitPrice = cost > 0 ? Number((cost / units).toFixed(2)) : 15.99;

        const current = spoolsMap.get(key) || {
          nombre: key,
          bobinasCompradas: 0,
          gramosIniciales: 0,
          totalGastadoCompras: 0,
          precioBobina: unitPrice,
          gramosConsumidos: 0,
        };

        current.bobinasCompradas += units;
        current.gramosIniciales += units * 1000;
        current.totalGastadoCompras += cost;
        current.precioBobina = unitPrice;
        if (!current.ultimaCompraFecha || parseDate(op.fecha) > parseDate(current.ultimaCompraFecha)) {
          current.ultimaCompraFecha = op.fecha;
        }
        spoolsMap.set(key, current);
      }
    });

    // 2. Process all sales and subtract consumed grams via rule of three:
    // gramos = (costeGastadoEnVenta * 1000) / precioBobina
    operations.forEach((op) => {
      if (op.tipo !== 'venta' || !op.costes || op.costes <= 0) return;
      const rawMat = op.material || 'PETG Negro (Elegoo)';
      // Split if multiple filaments are listed with "+" or "/"
      const parts = rawMat
        .split(/[+/]/)
        .map((p) => p.trim())
        .filter((p) => p && !p.toLowerCase().includes('tornillo') && !p.toLowerCase().includes('tuerca'));

      const targetParts = parts.length > 0 ? parts : [rawMat];
      const costPerPart = Math.abs(op.costes) / targetParts.length;

      targetParts.forEach((part) => {
        const key = normalizeFilamentKey(part);
        const spool = spoolsMap.get(key);
        const precioBobina = spool ? spool.precioBobina : 15.99;
        const gramos = calculateFilamentGrams(costPerPart, precioBobina);

        if (spool) {
          spool.gramosConsumidos += gramos;
        } else {
          spoolsMap.set(key, {
            nombre: key,
            bobinasCompradas: 1,
            gramosIniciales: 1000,
            totalGastadoCompras: 15.99,
            precioBobina: 15.99,
            gramosConsumidos: gramos,
          });
        }
      });
    });

    return Array.from(spoolsMap.values()).map((item, idx) => ({
      id: `spool-${idx}`,
      nombre: item.nombre,
      gramosIniciales: item.gramosIniciales,
      precioBobina: item.precioBobina,
      bobinasCompradas: item.bobinasCompradas,
      gramosConsumidos: Math.round(item.gramosConsumidos),
      gramosRestantes: Math.max(0, Math.round(item.gramosIniciales - item.gramosConsumidos)),
      ultimaCompraFecha: item.ultimaCompraFecha,
    }));
  }, [operations]);

  // Filtered & Sorted Operations list
  const filteredOperations = useMemo(() => {
    return operations
      .filter((op) => {
        if (filters.search.trim()) {
          const q = filters.search.toLowerCase().trim();
          const matchProduct = op.producto.toLowerCase().includes(q);
          const matchMaterial = op.material?.toLowerCase().includes(q) || false;
          const matchSeller = op.vendedor?.toLowerCase().includes(q) || false;
          const matchComments = op.comentarios?.toLowerCase().includes(q) || false;
          const matchPlatform = op.lugarVenta.toLowerCase().includes(q);

          if (!matchProduct && !matchMaterial && !matchSeller && !matchComments && !matchPlatform) {
            return false;
          }
        }

        if (filters.platform !== 'all' && op.lugarVenta !== filters.platform) {
          return false;
        }

        if (filters.status !== 'all' && op.estado !== filters.status) {
          return false;
        }

        if (filters.tipo !== 'all' && op.tipo !== filters.tipo) {
          return false;
        }

        if (filters.vendedor !== 'all') {
          if (!op.vendedor || !op.vendedor.toLowerCase().includes(filters.vendedor.toLowerCase())) {
            return false;
          }
        }

        if (filters.timeFilter !== 'todo') {
          const opDate = parseDate(op.fecha);
          const now = new Date();
          const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

          if (filters.timeFilter === 'hoy') {
            if (opDate < startOfDay) return false;
          } else if (filters.timeFilter === 'semana') {
            const startOfWeek = new Date(startOfDay);
            const day = startOfWeek.getDay() || 7;
            if (day !== 1) startOfWeek.setHours(-24 * (day - 1));
            if (opDate < startOfWeek) return false;
          } else if (filters.timeFilter === 'mes') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            if (opDate < startOfMonth) return false;
          } else if (filters.timeFilter === 'ano') {
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            if (opDate < startOfYear) return false;
          } else if (filters.timeFilter === 'personalizado') {
            if (filters.startDate) {
              const start = parseDate(filters.startDate);
              if (opDate < start) return false;
            }
            if (filters.endDate) {
              const end = parseDate(filters.endDate);
              end.setHours(23, 59, 59, 999);
              if (opDate > end) return false;
            }
          }
        }

        return true;
      })
      .sort((a, b) => {
        let valA: any;
        let valB: any;

        if (filters.sortBy === 'fecha') {
          valA = parseDate(a.fecha).getTime();
          valB = parseDate(b.fecha).getTime();
        } else if (filters.sortBy === 'precio') {
          valA = a.precio || 0;
          valB = b.precio || 0;
        } else if (filters.sortBy === 'costes') {
          valA = a.costes || 0;
          valB = b.costes || 0;
        } else if (filters.sortBy === 'beneficio') {
          valA = a.beneficio || 0;
          valB = b.beneficio || 0;
        } else if (filters.sortBy === 'producto') {
          valA = a.producto.toLowerCase();
          valB = b.producto.toLowerCase();
        }

        if (valA < valB) return filters.sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return filters.sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [operations, filters]);

  // Monthly Summaries Map (keyed by YYYY-MM)
  const monthlySummaries = useMemo<Record<string, MonthlySummary>>(() => {
    const map: Record<string, MonthlySummary> = {};

    filteredOperations.forEach((op) => {
      const d = parseDate(op.fecha);
      const year = d.getFullYear();
      const monthIdx = d.getMonth();
      const key = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
      const label = `${MONTH_NAMES[monthIdx]} ${year}`;

      if (!map[key]) {
        map[key] = {
          monthKey: key,
          monthLabel: label,
          numVentas: 0,
          numPedidos: 0,
          dineroBruto: 0,
          dineroGastadoCompras: 0,
          costesVentas: 0,
          dineroNeto: 0,
          gramosConsumidos: 0,
        };
      }

      const summary = map[key];
      if (op.tipo === 'venta') {
        summary.numVentas += 1;
        summary.dineroBruto += op.precio || 0;
        summary.costesVentas += Math.abs(op.costes || 0);
        summary.gramosConsumidos += calculateFilamentGrams(Math.abs(op.costes || 0), 15.99);
      } else if (op.tipo === 'compra' || op.tipo === 'inversion') {
        summary.numPedidos += 1;
        summary.dineroGastadoCompras += Math.abs(op.costes || 0);
      }
      summary.dineroNeto =
        summary.dineroBruto - summary.costesVentas - summary.dineroGastadoCompras;
    });

    return map;
  }, [filteredOperations]);

  // Financial Dashboard Statistics
  const stats = useMemo(() => {
    let totalIngresos = 0;
    let totalCostes = 0;
    let totalBeneficio = 0;
    let pendienteCobro = 0;

    filteredOperations.forEach((op) => {
      if (op.tipo === 'cierre') return;

      if (op.precio && op.precio > 0) {
        totalIngresos += op.precio;
      }

      const costTotal = Math.abs(op.costes || 0);
      totalCostes += costTotal;
      totalBeneficio += op.beneficio;

      if (
        op.estado === 'Pendiente de cobro' ||
        op.estado === 'Enviado' ||
        op.estado === 'En producción'
      ) {
        if (op.precio && op.precio > 0) {
          pendienteCobro += op.precio;
        } else {
          pendienteCobro += op.beneficio > 0 ? op.beneficio : 0;
        }
      }
    });

    return {
      totalIngresos,
      totalCostes,
      totalBeneficio,
      pendienteCobro,
      count: filteredOperations.length,
    };
  }, [filteredOperations]);

  // Get list of unique sellers for filter dropdown
  const uniqueSellers = useMemo(() => {
    const set = new Set<string>(['Jorge', 'Sandra', 'Alejandro']);
    operations.forEach((op) => {
      if (op.vendedor) {
        op.vendedor.split(',').forEach((s) => set.add(s.trim()));
      }
    });
    return Array.from(set).sort();
  }, [operations]);

  return {
    operations: filteredOperations,
    rawOperations: operations,
    productCatalog,
    filamentStock,
    monthlySummaries,
    stats,
    filters,
    setFilters,
    uniqueSellers,
    addOperation,
    updateOperation,
    attachQrToOperation,
    deleteOperation,
    duplicateOperation,
    resetToDefaultData,
    clearAllData,
    exportJSON,
    importJSON,
  };
}
