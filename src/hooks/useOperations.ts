import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import {
  loadFromLocalStorageSync,
  loadFromIndexedDB,
  loadFromServer,
  cachePayloadLocally,
  persistOperationsAllLayers,
  subscribeToRealtimeUpdates,
  computeStateFingerprint,
  PersistedPayload,
} from '../utils/storage';

const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export function sanitizeAndMigrateOperations(rawList: any[]): Operation[] {
  const now = Date.now();
  return rawList
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

      // Auto-delete QR data older than 10 days OR when status is 'Pendiente de cobro'
      let fotoQr = op.fotoQr;
      let empresaEnvio = op.empresaEnvio;
      let fechaSubidaQr = op.fechaSubidaQr;
      if (
        estado === 'Pendiente de cobro' ||
        (fechaSubidaQr && now > fechaSubidaQr && now - fechaSubidaQr > TEN_DAYS_MS)
      ) {
        fotoQr = undefined;
        empresaEnvio = undefined;
        fechaSubidaQr = undefined;
      }

      const isFilamentoOrder = Boolean(
        op.esPedidoFilamento ??
          (tipo === 'compra' &&
            ((op.producto && op.producto.toLowerCase().includes('filamento')) ||
              (op.material && /(pla|petg|asa|tpu)/i.test(op.material))))
      );

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

export function normalizeFilamentKey(raw: string): string {
  const s = raw.toLowerCase().trim();
  if (!s) return 'PETG Negro (Elegoo)';
  if (s.includes('petg') && s.includes('rojo')) return 'PETG Rojo (Winkle)';
  if (s.includes('petg') && (s.includes('cf') || s.includes('fc') || s.includes('fcf'))) return 'PETG Negro CF (Bambu / Elegoo)';
  if (s.includes('petg') && s.includes('bambu')) return 'PETG Negro (Bambulab)';
  if (s.includes('petg') && s.includes('esun')) return 'PETG Negro (eSun)';
  if (s.includes('petg') && s.includes('sunlu')) return 'PETG Negro (Sunlu)';
  if (s.includes('petg') && (s.includes('negro') || s.includes('elegoo') || s === 'petg')) return 'PETG Negro (Elegoo)';
  if (s.includes('asa') && (s.includes('negro') || s.includes('winkle') || s === 'asa')) return 'ASA Negro (Winkle)';
  if (s.includes('tpu') && (s.includes('negro') || s === 'tpu')) return 'TPU Negro';
  if (s.includes('pla') && s.includes('rojo')) return 'PLA Rojo (Elegoo)';
  if (s.includes('pla') && s.includes('azul')) return 'PLA Azul (eSun)';
  if (s.includes('pla') && s.includes('blanco')) return 'PLA Blanco (Elegoo)';
  if (s.includes('pla') && (s.includes('negro') || s.includes('elegoo') || s.includes('i3d') || s === 'pla')) {
    return 'PLA Negro (Elegoo / i3D)';
  }
  return raw.trim();
}

const DEFAULT_FILAMENTS: Array<{ nombre: string; precio: number; bobinasBase: number }> = [
  { nombre: 'PETG Negro (Elegoo)', precio: 15.0, bobinasBase: 6 },
  { nombre: 'PETG Negro CF (Bambu / Elegoo)', precio: 16.5, bobinasBase: 3 },
  { nombre: 'PETG Negro (Bambulab)', precio: 12.86, bobinasBase: 3 },
  { nombre: 'PETG Negro (eSun)', precio: 13.43, bobinasBase: 3 },
  { nombre: 'PETG Negro (Sunlu)', precio: 14.99, bobinasBase: 1 },
  { nombre: 'PETG Rojo (Winkle)', precio: 15.99, bobinasBase: 2 },
  { nombre: 'ASA Negro (Winkle)', precio: 19.99, bobinasBase: 3 },
  { nombre: 'PLA Negro (Elegoo / i3D)', precio: 15.99, bobinasBase: 2 },
  { nombre: 'PLA Rojo (Elegoo)', precio: 14.99, bobinasBase: 1 },
  { nombre: 'PLA Azul (eSun)', precio: 12.99, bobinasBase: 1 },
  { nombre: 'PLA Blanco (Elegoo)', precio: 14.99, bobinasBase: 1 },
  { nombre: 'TPU Negro', precio: 18.99, bobinasBase: 1 },
];

function computeSpoolsList(
  operations: Operation[],
  filamentAdjustments: Record<string, number>
): FilamentSpool[] {
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

  DEFAULT_FILAMENTS.forEach((f) => {
    spoolsMap.set(f.nombre, {
      nombre: f.nombre,
      bobinasCompradas: f.bobinasBase,
      gramosIniciales: f.bobinasBase * 1000,
      totalGastadoCompras: Number((f.precio * f.bobinasBase).toFixed(2)),
      precioBobina: f.precio,
      gramosConsumidos: 0,
    });
  });

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

  operations.forEach((op) => {
    if (op.tipo !== 'venta' || !op.costes || op.costes <= 0) return;
    const rawMat = op.material || 'PETG Negro (Elegoo)';
    const parts = rawMat
      .split(/[+/]|\s+y\s+/i)
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

  return Array.from(spoolsMap.values())
    .filter((item) => filamentAdjustments[`__deleted__:${item.nombre}`] !== 1)
    .map((item, idx) => {
      const consumidosRedondeados = Math.round(item.gramosConsumidos);
      const baseRestantes = Math.round(item.gramosIniciales - consumidosRedondeados);
      const ajuste = filamentAdjustments[item.nombre] ?? 0;
      const gramosRestantes = Math.max(0, baseRestantes + ajuste);
      return {
        id: `spool-${idx}`,
        nombre: item.nombre,
        gramosIniciales: item.gramosIniciales,
        precioBobina: item.precioBobina,
        bobinasCompradas: item.bobinasCompradas,
        gramosConsumidos: consumidosRedondeados,
        gramosRestantes,
        ajusteManualGramos: ajuste,
        ultimaCompraFecha: item.ultimaCompraFecha,
      };
    });
}

export function useOperations() {
  const initialLocalPayload = useMemo(() => loadFromLocalStorageSync(), []);

  const revisionRef = useRef<number>(
    initialLocalPayload && typeof initialLocalPayload.revision === 'number'
      ? initialLocalPayload.revision
      : 1
  );

  const [operations, setOperations] = useState<Operation[]>(() => {
    if (initialLocalPayload && Array.isArray(initialLocalPayload.operations)) {
      return sanitizeAndMigrateOperations(initialLocalPayload.operations);
    }
    return sanitizeAndMigrateOperations(initialOperations);
  });

  const [filamentAdjustments, setFilamentAdjustments] = useState<Record<string, number>>(() => {
    if (
      initialLocalPayload &&
      initialLocalPayload.filamentAdjustments &&
      typeof initialLocalPayload.filamentAdjustments === 'object'
    ) {
      return initialLocalPayload.filamentAdjustments;
    }
    return {};
  });

  const operationsRef = useRef<Operation[]>(operations);
  operationsRef.current = operations;

  const filamentAdjustmentsRef = useRef<Record<string, number>>(filamentAdjustments);
  filamentAdjustmentsRef.current = filamentAdjustments;

  const lastAppliedSyncIdRef = useRef<string>(
    initialLocalPayload?.syncId || ''
  );
  const inFlightSavesRef = useRef<number>(0);
  const hasLocalEditsRef = useRef<boolean>(
    Boolean(
      initialLocalPayload?.clientId &&
        initialLocalPayload.clientId !== 'server-init' &&
        initialLocalPayload.clientId !== 'local-init'
    )
  );

  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [lastModifiedId, setLastModifiedId] = useState<string | null>(null);
  const [saveNotification, setSaveNotification] = useState<string | null>(null);

  const triggerNotification = useCallback((msg: string, opId?: string) => {
    setSaveNotification(msg);
    setLastSavedAt(Date.now());
    if (opId) {
      setLastModifiedId(opId);
    }
  }, []);

  // Apply remote payload when any change arrives via SSE, BroadcastChannel, Storage, or 1.5s Poll
  const applyRemotePayload = useCallback((remote: PersistedPayload) => {
    if (!remote || !Array.isArray(remote.operations)) return;
    if (inFlightSavesRef.current > 0) return;
    if (remote.clientId === 'server-init' && hasLocalEditsRef.current) return;

    const remoteSyncId =
      remote.syncId || `${remote.revision}-${remote.updatedAt}-${remote.clientId || 'remote'}`;
    if (remoteSyncId && remoteSyncId === lastAppliedSyncIdRef.current) return;

    const clean = sanitizeAndMigrateOperations(remote.operations);
    const adj =
      remote.filamentAdjustments && typeof remote.filamentAdjustments === 'object'
        ? remote.filamentAdjustments
        : {};

    const remoteFp = computeStateFingerprint(clean, adj);
    const currentFp = computeStateFingerprint(
      operationsRef.current,
      filamentAdjustmentsRef.current
    );

    lastAppliedSyncIdRef.current = remoteSyncId;
    revisionRef.current = Math.max(revisionRef.current, remote.revision || 1);

    if (remoteFp !== currentFp) {
      operationsRef.current = clean;
      filamentAdjustmentsRef.current = adj;
      setOperations(clean);
      setFilamentAdjustments(adj);
      setLastSavedAt(Date.now());
    }

    void cachePayloadLocally({
      ...remote,
      syncId: remoteSyncId,
      operations: clean,
      filamentAdjustments: adj,
    });
  }, []);

  // Hydrate from IndexedDB and Server on mount AND subscribe to real-time updates
  useEffect(() => {
    let cancelled = false;

    async function hydrateAsync() {
      const [idbPayload, serverPayload] = await Promise.all([
        loadFromIndexedDB(),
        loadFromServer(),
      ]);
      if (cancelled) return;

      // 1. If the server has live persisted state (not a cold-started empty 'server-init'), the server is authoritative
      if (
        serverPayload &&
        Array.isArray(serverPayload.operations) &&
        serverPayload.clientId !== 'server-init'
      ) {
        applyRemotePayload(serverPayload);
        return;
      }

      // 2. If server is at 'server-init' (e.g. Vercel serverless cold-start) and browser has user edits, re-hydrate server
      const bestLocal =
        idbPayload &&
        Array.isArray(idbPayload.operations) &&
        (!initialLocalPayload || idbPayload.updatedAt >= initialLocalPayload.updatedAt)
          ? idbPayload
          : initialLocalPayload;

      if (
        bestLocal &&
        Array.isArray(bestLocal.operations) &&
        bestLocal.clientId &&
        bestLocal.clientId !== 'server-init' &&
        bestLocal.clientId !== 'local-init'
      ) {
        applyRemotePayload(bestLocal);
        const confirmed = await persistOperationsAllLayers(
          operationsRef.current,
          filamentAdjustmentsRef.current,
          revisionRef.current
        );
        if (!cancelled) {
          revisionRef.current = confirmed.revision;
          lastAppliedSyncIdRef.current = confirmed.syncId;
        }
        return;
      }

      // 3. Otherwise apply serverPayload if present
      if (serverPayload && Array.isArray(serverPayload.operations)) {
        applyRemotePayload(serverPayload);
      }
    }

    void hydrateAsync();
    const unsubscribe = subscribeToRealtimeUpdates(applyRemotePayload);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [applyRemotePayload, initialLocalPayload]);

  // Helper to update state AND persist across all layers immediately (outside React setState updater!)
  const commitStateChange = useCallback(
    (
      nextOps: Operation[],
      nextAdj: Record<string, number>,
      notificationMsg: string,
      modifiedId?: string
    ) => {
      const nextRevision = revisionRef.current + 1;
      revisionRef.current = nextRevision;
      hasLocalEditsRef.current = true;
      operationsRef.current = nextOps;
      filamentAdjustmentsRef.current = nextAdj;

      setOperations(nextOps);
      setFilamentAdjustments(nextAdj);
      triggerNotification(notificationMsg, modifiedId);

      inFlightSavesRef.current += 1;
      void persistOperationsAllLayers(nextOps, nextAdj, nextRevision)
        .then((confirmed) => {
          revisionRef.current = Math.max(revisionRef.current, confirmed.revision);
          lastAppliedSyncIdRef.current = confirmed.syncId;
        })
        .finally(() => {
          inFlightSavesRef.current = Math.max(0, inFlightSavesRef.current - 1);
        });
    },
    [triggerNotification]
  );

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

  // CRUD Actions
  const addOperation = useCallback(
    (opData: Omit<Operation, 'id' | 'createdAt' | 'beneficio'>) => {
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

      const now = Date.now();
      const nextRev = revisionRef.current + 1;
      const newId = `op-${now}-${Math.random().toString(36).substring(2, 6)}`;

      const clearQrForPending = estado === 'Pendiente de cobro';
      const isFilamentoOrder = Boolean(
        opData.esPedidoFilamento ??
          (opData.tipo === 'compra' &&
            ((opData.producto && opData.producto.toLowerCase().includes('filamento')) ||
              (opData.material && /(pla|petg|asa|tpu)/i.test(opData.material))))
      );

      const newOp: Operation = {
        ...opData,
        unidades,
        costeUnitario: opData.costeUnitario ?? Number((opData.costes / unidades).toFixed(2)),
        costesOperativos: 0,
        estado,
        fechaLimite,
        fotoQr: clearQrForPending ? undefined : opData.fotoQr,
        empresaEnvio: clearQrForPending ? undefined : opData.empresaEnvio,
        fechaSubidaQr: clearQrForPending ? undefined : opData.fechaSubidaQr,
        esPedidoFilamento: isFilamentoOrder,
        id: newId,
        beneficio,
        createdAt: 1800000000000 + nextRev * 1000 + (now % 1000),
      };

      const nextOps = [newOp, ...operationsRef.current];
      let nextAdj = { ...filamentAdjustmentsRef.current };

      // If this is a filament purchase, un-delete if previously deleted and ensure +1000g * unidades visibly adds to remaining grams
      if (isFilamentoOrder) {
        const key = normalizeFilamentKey(newOp.material || newOp.producto);
        if (nextAdj[`__deleted__:${key}`]) {
          delete nextAdj[`__deleted__:${key}`];
        }
        const prevSpools = computeSpoolsList(operationsRef.current, filamentAdjustmentsRef.current);
        const prevSpool = prevSpools.find((s) => s.nombre === key);
        const prevVisibleRemaining = prevSpool ? prevSpool.gramosRestantes : 0;
        const expectedRemaining = prevVisibleRemaining + unidades * 1000;

        const nextSpoolsRaw = computeSpoolsList(nextOps, nextAdj);
        const updatedSpool = nextSpoolsRaw.find((s) => s.nombre === key);
        if (updatedSpool && updatedSpool.gramosRestantes < expectedRemaining) {
          const baseRestantes = updatedSpool.gramosIniciales - updatedSpool.gramosConsumidos;
          nextAdj = {
            ...nextAdj,
            [key]: expectedRemaining - baseRestantes,
          };
        }
      }

      commitStateChange(nextOps, nextAdj, 'Operación añadida y guardada en tiempo real', newId);
      return newOp;
    },
    [commitStateChange]
  );

  const updateOperation = useCallback(
    (id: string, opData: Partial<Operation>) => {
      const nextOps = operationsRef.current.map((op) => {
        if (op.id !== id) return op;

        const updated = { ...op, ...opData };
        if (updated.estado) {
          updated.estado = normalizeStatus(updated.estado);
        }

        // If status is 'Pendiente de cobro', automatically delete QR from storage as requested
        if (updated.estado === 'Pendiente de cobro') {
          updated.fotoQr = undefined;
          updated.empresaEnvio = undefined;
          updated.fechaSubidaQr = undefined;
        }

        // Recalculate deadline date when sale date/platform/type changes unless explicitly provided
        if (updated.tipo === 'venta') {
          if (opData.fechaLimite !== undefined) {
            updated.fechaLimite = opData.fechaLimite;
          } else if (opData.fecha || opData.lugarVenta || opData.tipo || !updated.fechaLimite) {
            updated.fechaLimite = calculateDeadlineDate(
              updated.fecha,
              updated.lugarVenta,
              updated.tipo
            );
          }
        } else {
          updated.fechaLimite = '';
        }

        // If units changed and we have unit cost, recalculate total filament cost unless costes was explicitly passed
        if (
          opData.unidades !== undefined &&
          opData.costes === undefined &&
          updated.costeUnitario &&
          updated.costeUnitario > 0
        ) {
          updated.costes = Number((updated.costeUnitario * updated.unidades).toFixed(2));
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
      });

      commitStateChange(
        nextOps,
        filamentAdjustmentsRef.current,
        'Cambios guardados en tiempo real',
        id
      );
    },
    [commitStateChange]
  );

  const attachQrToOperation = useCallback(
    (id: string, fotoQr: string | undefined, empresaEnvio?: ShippingCompany) => {
      let isCarrierOnlyChange = false;
      const nextOps = operationsRef.current.map((op) => {
        if (op.id !== id) return op;
        const qrChanged = op.fotoQr !== fotoQr;
        if (!qrChanged && empresaEnvio !== undefined) {
          isCarrierOnlyChange = true;
        }
        const nextEmpresaEnvio =
          empresaEnvio !== undefined
            ? empresaEnvio
            : fotoQr
            ? op.empresaEnvio || 'Correos'
            : undefined;
        const nextFechaSubidaQr = fotoQr
          ? qrChanged
            ? Date.now()
            : op.fechaSubidaQr || Date.now()
          : undefined;

        return {
          ...op,
          fotoQr,
          empresaEnvio: nextEmpresaEnvio,
          fechaSubidaQr: nextFechaSubidaQr,
        };
      });

      commitStateChange(
        nextOps,
        filamentAdjustmentsRef.current,
        isCarrierOnlyChange
          ? `Método de envío (${empresaEnvio}) guardado`
          : fotoQr
          ? 'Foto / QR guardado en tiempo real'
          : 'Foto / QR eliminado',
        id
      );
    },
    [commitStateChange]
  );

  const deleteOperation = useCallback(
    (id: string) => {
      const nextOps = operationsRef.current.filter((op) => op.id !== id);
      commitStateChange(
        nextOps,
        filamentAdjustmentsRef.current,
        'Operación eliminada y guardada en tiempo real'
      );
    },
    [commitStateChange]
  );

  const duplicateOperation = useCallback(
    (id: string) => {
      const target = operationsRef.current.find((op) => op.id === id);
      if (!target) return;
      const now = Date.now();
      const nextRev = revisionRef.current + 1;
      const newId = `op-${now}-${Math.random().toString(36).substring(2, 6)}`;
      const dup: Operation = {
        ...target,
        id: newId,
        producto: `${target.producto}`,
        createdAt: 1800000000000 + nextRev * 1000 + (now % 1000),
      };
      const nextOps = [dup, ...operationsRef.current];
      commitStateChange(
        nextOps,
        filamentAdjustmentsRef.current,
        'Operación duplicada y guardada en tiempo real',
        newId
      );
    },
    [commitStateChange]
  );

  const resetToDefaultData = useCallback(() => {
    const clean = sanitizeAndMigrateOperations(initialOperations);
    commitStateChange(clean, {}, 'Datos iniciales restaurados y guardados');
  }, [commitStateChange]);

  const clearAllData = useCallback(() => {
    commitStateChange([], {}, 'Todas las operaciones vaciadas y guardado');
  }, [commitStateChange]);

  const exportJSON = useCallback(() => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(
        JSON.stringify(
          {
            version: 5,
            revision: revisionRef.current,
            operations: operationsRef.current,
            filamentAdjustments: filamentAdjustmentsRef.current,
          },
          null,
          2
        )
      );
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `formare-3d-operaciones-${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    triggerNotification('Archivo JSON exportado');
  }, [triggerNotification]);

  const importJSON = useCallback(
    (jsonString: string): boolean => {
      try {
        const parsed = JSON.parse(jsonString);
        const list = Array.isArray(parsed)
          ? parsed
          : parsed && Array.isArray(parsed.operations)
          ? parsed.operations
          : null;
        if (list) {
          const clean = sanitizeAndMigrateOperations(list);
          const importedAdj =
            parsed &&
            parsed.filamentAdjustments &&
            typeof parsed.filamentAdjustments === 'object'
              ? parsed.filamentAdjustments
              : filamentAdjustmentsRef.current;
          commitStateChange(clean, importedAdj, 'Copia de seguridad importada y guardada');
          return true;
        }
      } catch (e) {
        console.error('Failed to import JSON', e);
      }
      return false;
    },
    [commitStateChange]
  );

  // Catalog of sold products with their unit filament cost & material (NO sale price stored!)
  const productCatalog = useMemo<ProductCatalogItem[]>(() => {
    const map = new Map<string, ProductCatalogItem>();
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

  // Filament Stock Database (1000g per spool bought, rule-of-three consumption on sales + manual adjustment)
  const filamentStock = useMemo<FilamentSpool[]>(() => {
    return computeSpoolsList(operations, filamentAdjustments);
  }, [operations, filamentAdjustments]);

  const updateFilamentRemaining = useCallback(
    (spoolName: string, targetRemainingGrams: number) => {
      const currentSpools = computeSpoolsList(
        operationsRef.current,
        filamentAdjustmentsRef.current
      );
      const targetSpool = currentSpools.find((s) => s.nombre === spoolName);
      if (!targetSpool) return;
      const baseRestantes = targetSpool.gramosIniciales - targetSpool.gramosConsumidos;
      const validTarget = Math.max(0, Math.round(targetRemainingGrams));
      const newAdjustment = validTarget - baseRestantes;

      const nextAdj = {
        ...filamentAdjustmentsRef.current,
        [spoolName]: newAdjustment,
      };

      commitStateChange(
        operationsRef.current,
        nextAdj,
        `Stock de ${spoolName} actualizado a ${validTarget}g y guardado`
      );
    },
    [commitStateChange]
  );

  const deleteFilamentSpool = useCallback(
    (spoolName: string) => {
      const nextAdj = {
        ...filamentAdjustmentsRef.current,
        [`__deleted__:${spoolName}`]: 1,
      };
      commitStateChange(
        operationsRef.current,
        nextAdj,
        `Filamento "${spoolName}" eliminado del stock`
      );
    },
    [commitStateChange]
  );

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
        if (filters.sortBy === 'fecha') {
          // User-created operations (createdAt >= 1800000000000) appear at the top when sorting descending
          const aIsRecentUser = (a.createdAt || 0) >= 1800000000000;
          const bIsRecentUser = (b.createdAt || 0) >= 1800000000000;
          if (aIsRecentUser !== bIsRecentUser) {
            if (filters.sortOrder === 'desc') {
              return aIsRecentUser ? -1 : 1;
            } else {
              return aIsRecentUser ? 1 : -1;
            }
          }

          const valA = parseDate(a.fecha).getTime();
          const valB = parseDate(b.fecha).getTime();
          if (valA !== valB) {
            return filters.sortOrder === 'asc' ? valA - valB : valB - valA;
          }
          return filters.sortOrder === 'asc'
            ? (a.createdAt || 0) - (b.createdAt || 0)
            : (b.createdAt || 0) - (a.createdAt || 0);
        }

        let valA: any;
        let valB: any;

        if (filters.sortBy === 'precio') {
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
        return (b.createdAt || 0) - (a.createdAt || 0);
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
    lastSavedAt,
    lastModifiedId,
    saveNotification,
    clearNotification: () => setSaveNotification(null),
    addOperation,
    updateOperation,
    updateFilamentRemaining,
    deleteFilamentSpool,
    attachQrToOperation,
    deleteOperation,
    duplicateOperation,
    resetToDefaultData,
    clearAllData,
    exportJSON,
    importJSON,
  };
}
