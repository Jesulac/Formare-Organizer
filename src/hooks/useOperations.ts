import { useState, useEffect, useMemo } from 'react';
import { 
  Operation, 
  FilterOptions, 
  OperationType, 
  Platform, 
  Status 
} from '../types/operation';
import { initialOperations } from '../data/initialData';
import { calculateBeneficio, parseDate } from '../utils/calculations';

const STORAGE_KEY = 'wallapop_organizer_ops_v1';

export function useOperations() {
  const [operations, setOperations] = useState<Operation[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to parse operations from localStorage', e);
    }
    return initialOperations;
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
    const beneficio = calculateBeneficio(
      opData.precio,
      opData.costes,
      opData.costesOperativos,
      opData.tipo
    );

    const newOp: Operation = {
      ...opData,
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
        const beneficio = calculateBeneficio(
          updated.precio,
          updated.costes,
          updated.costesOperativos,
          updated.tipo
        );

        return {
          ...updated,
          beneficio,
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
      producto: `${target.producto} (Copia)`,
      createdAt: Date.now(),
    };

    setOperations((prev) => [dup, ...prev]);
  };

  const resetToDefaultData = () => {
    setOperations(initialOperations);
  };

  const clearAllData = () => {
    setOperations([]);
  };

  const exportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(operations, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `wallapop-vinted-ventas-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const importJSON = (jsonString: string): boolean => {
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed)) {
        setOperations(parsed);
        return true;
      }
    } catch (e) {
      console.error('Failed to import JSON', e);
    }
    return false;
  };

  // Filtered & Sorted Operations list
  const filteredOperations = useMemo(() => {
    return operations
      .filter((op) => {
        // Text Search (product, material, comments, seller)
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

        // Platform filter
        if (filters.platform !== 'all' && op.lugarVenta !== filters.platform) {
          return false;
        }

        // Status filter
        if (filters.status !== 'all' && op.estado !== filters.status) {
          return false;
        }

        // Tipo filter
        if (filters.tipo !== 'all' && op.tipo !== filters.tipo) {
          return false;
        }

        // Seller filter
        if (filters.vendedor !== 'all') {
          if (!op.vendedor || !op.vendedor.toLowerCase().includes(filters.vendedor.toLowerCase())) {
            return false;
          }
        }

        // Time filter
        if (filters.timeFilter !== 'todo') {
          const opDate = parseDate(op.fecha);
          const now = new Date();
          const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

          if (filters.timeFilter === 'hoy') {
            if (opDate < startOfDay) return false;
          } else if (filters.timeFilter === 'semana') {
            const startOfWeek = new Date(startOfDay);
            const day = startOfWeek.getDay() || 7; // Get current day of week (1-7)
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

  // Financial Dashboard Statistics
  const stats = useMemo(() => {
    let totalIngresos = 0;
    let totalCostes = 0;
    let totalBeneficio = 0;
    let pendienteCobro = 0;

    filteredOperations.forEach((op) => {
      // Exclude cierre rows from aggregate sum if they represent monthly summaries to avoid double counting
      if (op.tipo === 'cierre') {
        return;
      }

      if (op.precio && op.precio > 0) {
        totalIngresos += op.precio;
      }

      // Add material costs + operational costs
      const costTotal = (op.costes || 0) + (op.costesOperativos || 0);
      totalCostes += costTotal;

      totalBeneficio += op.beneficio;

      // Pending receivables or pending orders
      if (
        op.estado === 'Pendiente de cobro' ||
        op.estado === 'Enviado📦' ||
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
    const set = new Set<string>();
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
    stats,
    filters,
    setFilters,
    uniqueSellers,
    addOperation,
    updateOperation,
    deleteOperation,
    duplicateOperation,
    resetToDefaultData,
    clearAllData,
    exportJSON,
    importJSON,
  };
}
