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
  calculateSandraCommission,
  extractUnits, 
  getOperationConsumedGrams,
  normalizeStatus, 
  parseDate,
  parseMaterialItems
} from '../utils/calculations';
import {
  loadFromLocalStorageSync,
  loadFromIndexedDB,
  loadFromServer,
  cachePayloadLocally,
  persistOperationsAllLayers,
  subscribeToRealtimeUpdates,
  computeStateFingerprint,
  mergePersistedPayloads,
  nextMonotonicTimestamp,
  getValidUpdatedAt,
  isUserEditedPayload,
  CLIENT_INSTANCE_ID,
  PersistedPayload,
} from '../utils/storage';
import { generateMonthlySalesPdf } from '../utils/pdfReport';

const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export function sanitizeAndMigrateOperations(rawList: any[]): Operation[] {
  const now = Date.now();
  return rawList
    .filter((op) => {
      if (!op || op.tipo === 'cierre') return false;
      const prod = String(op.producto || '').toLowerCase().trim();
      if (
        prod.includes('pedido filamento pla azul (esun)') &&
        !String(op.id || '').startsWith('op-v7-')
      ) {
        return false;
      }
      return true;
    })
    .map((op) => {
      const unidades = extractUnits(op.comentarios, op.unidades);
      const estado = normalizeStatus(op.estado);
      const tipo = op.tipo || 'venta';
      const fechaLimite =
        tipo === 'venta'
          ? op.fechaLimite || calculateDeadlineDate(op.fecha, op.lugarVenta || 'Wallapop', tipo)
          : '';
      const costes = typeof op.costes === 'number' && !isNaN(op.costes) ? op.costes : 0;
      const otrosCostes =
        typeof op.costesOperativos === 'number' && op.costesOperativos > 0
          ? op.costesOperativos
          : 0;
      const baseCostes = Math.max(0, Number((costes - otrosCostes).toFixed(2)));
      const costeUnitario =
        typeof op.costeUnitario === 'number' && !isNaN(op.costeUnitario) && op.costeUnitario >= 0
          ? op.costeUnitario
          : unidades > 0
          ? Number((baseCostes / unidades).toFixed(2))
          : baseCostes;

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

      const isFilamentoOrder =
        tipo === 'compra' &&
        Boolean(
          op.esPedidoFilamento ??
            ((op.producto && op.producto.toLowerCase().includes('filamento')) ||
              (op.material && /(pla|petg|asa|tpu)/i.test(op.material)))
        );

      const beneficio = calculateBeneficio(
        op.precio ?? null,
        costes,
        0,
        tipo,
        op.vendedor
      );

      const validUpdatedAt = getValidUpdatedAt(op.updatedAt);
      const editCount =
        typeof op.editCount === 'number' && op.editCount > 0 ? op.editCount : 0;

      return {
        ...op,
        unidades,
        costeUnitario,
        costes,
        costesOperativos: otrosCostes,
        beneficio,
        estado,
        tipo,
        fechaLimite,
        fotoQr,
        empresaEnvio,
        fechaSubidaQr,
        esPedidoFilamento: isFilamentoOrder,
        updatedAt: validUpdatedAt > 0 ? validUpdatedAt : undefined,
        editCount,
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
    if (op.tipo !== 'venta') return;
    const parsedItems = parseMaterialItems(op.material, op.materialesDetalle).filter(
      (item) =>
        item.material &&
        !item.material.toLowerCase().includes('tornillo') &&
        !item.material.toLowerCase().includes('tuerca')
    );

    const hasExplicitGrams = parsedItems.some((item) => item.gramos && item.gramos > 0);
    if (!hasExplicitGrams && (!op.costes || op.costes <= 0)) return;

    const targetItems =
      parsedItems.length > 0 ? parsedItems : [{ material: op.material || 'PETG Negro (Elegoo)' }];
    const uds = op.unidades && op.unidades > 0 ? op.unidades : 1;
    const pureFilamentCost = Math.max(
      0,
      Math.abs(op.costes || 0) - Math.abs(op.costesOperativos || 0)
    );
    const effectiveCost = pureFilamentCost > 0 ? pureFilamentCost : Math.abs(op.costes || 0);
    const costPerPart = effectiveCost / targetItems.length;

    targetItems.forEach((item) => {
      const key = normalizeFilamentKey(item.material);
      const spool = spoolsMap.get(key);
      const precioBobina = spool ? spool.precioBobina : 15.99;
      const gramos =
        item.gramos && item.gramos > 0
          ? Number((item.gramos * uds).toFixed(2))
          : calculateFilamentGrams(costPerPart, precioBobina);

      if (gramos <= 0) return;

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
      const consumidosRedondeados = Number(item.gramosConsumidos.toFixed(2));
      const initAjuste = filamentAdjustments[`__init_adj__:${item.nombre}`] ?? 0;
      const effectiveGramosIniciales = Math.max(0, Number((item.gramosIniciales + initAjuste).toFixed(2)));
      const effectiveBobinas = Number((effectiveGramosIniciales / 1000).toFixed(1));
      const baseRestantes = Number((effectiveGramosIniciales - consumidosRedondeados).toFixed(2));
      const ajuste = filamentAdjustments[item.nombre] ?? 0;
      const gramosRestantes = Math.max(0, Number((baseRestantes + ajuste).toFixed(2)));
      return {
        id: `spool-${idx}`,
        nombre: item.nombre,
        gramosIniciales: effectiveGramosIniciales,
        precioBobina: item.precioBobina,
        bobinasCompradas: effectiveBobinas,
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

  const deletedIdsRef = useRef<string[]>(
    initialLocalPayload && Array.isArray(initialLocalPayload.deletedOperationIds)
      ? initialLocalPayload.deletedOperationIds
      : []
  );

  const localUpdatedAtRef = useRef<number>(
    initialLocalPayload && typeof initialLocalPayload.updatedAt === 'number'
      ? initialLocalPayload.updatedAt
      : 1
  );

  const lastAppliedSyncIdRef = useRef<string>(
    initialLocalPayload?.syncId || ''
  );
  const inFlightSavesRef = useRef<number>(0);
  const lastLocalSaveAtRef = useRef<number>(0);
  const hasLocalEditsRef = useRef<boolean>(
    isUserEditedPayload(initialLocalPayload)
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

  // Apply remote payload safely using non-destructive smart merge so deploys never wipe local changes
  const applyRemotePayload = useCallback(
    (remote: PersistedPayload, options?: { isLocalHydration?: boolean }) => {
      if (!remote || !Array.isArray(remote.operations)) return;
      if (inFlightSavesRef.current > 0) return;

      // Cooldown protection: if the user just saved locally within the last 1.8s, ignore remote server polls
      if (
        !options?.isLocalHydration &&
        Date.now() - lastLocalSaveAtRef.current < 1800
      ) {
        return;
      }

      const remoteSyncId =
        remote.syncId || `${remote.revision}-${remote.updatedAt}-${remote.clientId || 'remote'}`;
      if (
        !options?.isLocalHydration &&
        remoteSyncId &&
        remoteSyncId === lastAppliedSyncIdRef.current
      ) {
        return;
      }

      const currentLocalSnapshot: PersistedPayload = {
        version: 6,
        revision: revisionRef.current,
        updatedAt: localUpdatedAtRef.current,
        clientId: hasLocalEditsRef.current ? CLIENT_INSTANCE_ID : 'local-init',
        operations: operationsRef.current,
        filamentAdjustments: filamentAdjustmentsRef.current,
        deletedOperationIds: deletedIdsRef.current,
      };

      const { merged, needsServerPush } = mergePersistedPayloads(
        currentLocalSnapshot,
        remote
      );

      if (isUserEditedPayload(merged) || isUserEditedPayload(remote)) {
        hasLocalEditsRef.current = true;
      }

      const clean = sanitizeAndMigrateOperations(merged.operations);
      const adj =
        merged.filamentAdjustments && typeof merged.filamentAdjustments === 'object'
          ? merged.filamentAdjustments
          : {};
      const delIds = Array.isArray(merged.deletedOperationIds)
        ? merged.deletedOperationIds
        : [];

      const mergedFp = computeStateFingerprint(clean, adj, delIds);
      const currentFp = computeStateFingerprint(
        operationsRef.current,
        filamentAdjustmentsRef.current,
        deletedIdsRef.current
      );

      if (!options?.isLocalHydration) {
        lastAppliedSyncIdRef.current = remoteSyncId;
      }
      revisionRef.current = Math.max(revisionRef.current, merged.revision || 1);
      localUpdatedAtRef.current = Math.max(
        localUpdatedAtRef.current,
        getValidUpdatedAt(merged.updatedAt) || 1
      );
      deletedIdsRef.current = delIds;

      if (mergedFp !== currentFp) {
        operationsRef.current = clean;
        filamentAdjustmentsRef.current = adj;
        setOperations(clean);
        setFilamentAdjustments(adj);
        setLastSavedAt(Date.now());
      }

      void cachePayloadLocally({
        ...merged,
        operations: clean,
        filamentAdjustments: adj,
        deletedOperationIds: delIds,
      });

      // If local browser had newer edits than the server (e.g., after a new deploy or refresh), push merged state back to server
      if (needsServerPush && hasLocalEditsRef.current && !options?.isLocalHydration) {
        inFlightSavesRef.current += 1;
        void persistOperationsAllLayers(
          clean,
          adj,
          revisionRef.current + 1,
          delIds
        )
          .then((confirmed) => {
            revisionRef.current = Math.max(revisionRef.current, confirmed.revision);
            localUpdatedAtRef.current = Math.max(
              localUpdatedAtRef.current,
              confirmed.updatedAt
            );
            lastAppliedSyncIdRef.current = confirmed.syncId;
          })
          .finally(() => {
            inFlightSavesRef.current = Math.max(0, inFlightSavesRef.current - 1);
          });
      }
    },
    []
  );

  // Hydrate from IndexedDB and Server on mount using non-destructive merge AND subscribe to real-time updates
  useEffect(() => {
    let cancelled = false;

    async function hydrateAsync() {
      // 1. Hydrate from IndexedDB first (restores any QR images stripped from localStorage and any latest local edits)
      const idbPayload = await loadFromIndexedDB();
      if (cancelled) return;

      if (idbPayload && Array.isArray(idbPayload.operations)) {
        if (isUserEditedPayload(idbPayload)) {
          hasLocalEditsRef.current = true;
        }
        applyRemotePayload(idbPayload, { isLocalHydration: true });
      }

      // 2. Then fetch from Server and non-destructively merge with combined local (localStorage + IndexedDB) state
      const serverPayload = await loadFromServer();
      if (cancelled) return;

      if (serverPayload && Array.isArray(serverPayload.operations)) {
        applyRemotePayload(serverPayload);
      }
    }

    void hydrateAsync();
    const unsubscribe = subscribeToRealtimeUpdates((remote) => {
      applyRemotePayload(remote);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [applyRemotePayload]);

  // Helper to update state AND persist across all layers immediately (outside React setState updater!)
  const commitStateChange = useCallback(
    (
      nextOps: Operation[],
      nextAdj: Record<string, number>,
      notificationMsg: string,
      modifiedId?: string,
      nextDeletedIds: string[] = deletedIdsRef.current
    ) => {
      const now = nextMonotonicTimestamp(localUpdatedAtRef.current);
      const nextRevision = revisionRef.current + 1;
      revisionRef.current = nextRevision;
      localUpdatedAtRef.current = now;
      lastLocalSaveAtRef.current = Date.now();
      hasLocalEditsRef.current = true;
      operationsRef.current = nextOps;
      filamentAdjustmentsRef.current = nextAdj;
      deletedIdsRef.current = nextDeletedIds;

      setOperations(nextOps);
      setFilamentAdjustments(nextAdj);
      triggerNotification(notificationMsg, modifiedId);

      inFlightSavesRef.current += 1;
      void persistOperationsAllLayers(
        nextOps,
        nextAdj,
        nextRevision,
        nextDeletedIds
      )
        .then((confirmed) => {
          revisionRef.current = Math.max(revisionRef.current, confirmed.revision);
          localUpdatedAtRef.current = Math.max(
            localUpdatedAtRef.current,
            confirmed.updatedAt
          );
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
        opData.tipo,
        opData.vendedor
      );

      const now = nextMonotonicTimestamp(localUpdatedAtRef.current);
      const nextRev = revisionRef.current + 1;
      const newId = `op-v7-${now}-${Math.random().toString(36).substring(2, 6)}`;

      const clearQrForPending = estado === 'Pendiente de cobro';
      const isFilamentoOrder =
        opData.tipo === 'compra' &&
        Boolean(
          opData.esPedidoFilamento ??
            ((opData.producto && opData.producto.toLowerCase().includes('filamento')) ||
              (opData.material && /(pla|petg|asa|tpu)/i.test(opData.material)))
        );

      const otrosCostes =
        typeof opData.costesOperativos === 'number' && opData.costesOperativos > 0
          ? opData.costesOperativos
          : 0;
      const baseCostes = Math.max(0, Number(((opData.costes || 0) - otrosCostes).toFixed(2)));

      const newOp: Operation = {
        ...opData,
        unidades,
        costeUnitario: opData.costeUnitario ?? Number((baseCostes / unidades).toFixed(2)),
        costesOperativos: otrosCostes,
        estado,
        fechaLimite,
        fotoQr: clearQrForPending ? undefined : opData.fotoQr,
        empresaEnvio: clearQrForPending ? undefined : opData.empresaEnvio,
        fechaSubidaQr: clearQrForPending ? undefined : opData.fechaSubidaQr,
        esPedidoFilamento: isFilamentoOrder,
        id: newId,
        beneficio,
        createdAt: 1800000000000 + nextRev * 1000 + (now % 1000),
        updatedAt: now,
        editCount: 1,
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
      const mutationTs = nextMonotonicTimestamp(localUpdatedAtRef.current);
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

        const uds = updated.unidades && updated.unidades > 0 ? updated.unidades : 1;
        const extraOtros =
          typeof updated.costesOperativos === 'number' && updated.costesOperativos > 0
            ? updated.costesOperativos
            : 0;

        // If costes was explicitly edited (e.g. in OperationModal), always honor opData.costes and sync costeUnitario
        if (opData.costes !== undefined) {
          updated.costes = Number(opData.costes.toFixed(2));
          const baseCost = Math.max(0, Number((updated.costes - extraOtros).toFixed(2)));
          updated.costeUnitario =
            opData.costeUnitario !== undefined
              ? opData.costeUnitario
              : Number((baseCost / uds).toFixed(2));
        } else if (
          opData.unidades !== undefined &&
          updated.costeUnitario !== undefined &&
          updated.costeUnitario >= 0
        ) {
          // If only units changed (e.g. via +/- table buttons), scale total cost from costeUnitario
          updated.costes = Number(
            (updated.costeUnitario * uds + extraOtros).toFixed(2)
          );
        }

        const beneficio = calculateBeneficio(
          updated.precio,
          updated.costes,
          0,
          updated.tipo,
          updated.vendedor
        );

        const nextEditCount = (typeof op.editCount === 'number' ? op.editCount : 0) + 1;
        const nextOpUpdatedAt = nextMonotonicTimestamp(
          Math.max(mutationTs, getValidUpdatedAt(op.updatedAt))
        );

        return {
          ...updated,
          beneficio,
          updatedAt: nextOpUpdatedAt,
          editCount: nextEditCount,
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
      const mutationTs = nextMonotonicTimestamp(localUpdatedAtRef.current);
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

        const nextEditCount = (typeof op.editCount === 'number' ? op.editCount : 0) + 1;
        const nextOpUpdatedAt = nextMonotonicTimestamp(
          Math.max(mutationTs, getValidUpdatedAt(op.updatedAt))
        );

        return {
          ...op,
          fotoQr,
          empresaEnvio: nextEmpresaEnvio,
          fechaSubidaQr: nextFechaSubidaQr,
          updatedAt: nextOpUpdatedAt,
          editCount: nextEditCount,
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
      const nextDeleted = Array.from(new Set([...deletedIdsRef.current, id]));
      commitStateChange(
        nextOps,
        filamentAdjustmentsRef.current,
        'Operación eliminada y guardada en tiempo real',
        undefined,
        nextDeleted
      );
    },
    [commitStateChange]
  );

  const duplicateOperation = useCallback(
    (id: string) => {
      const target = operationsRef.current.find((op) => op.id === id);
      if (!target) return;
      const now = nextMonotonicTimestamp(localUpdatedAtRef.current);
      const nextRev = revisionRef.current + 1;
      const newId = `op-v7-${now}-${Math.random().toString(36).substring(2, 6)}`;
      const dup: Operation = {
        ...target,
        id: newId,
        producto: `${target.producto}`,
        createdAt: 1800000000000 + nextRev * 1000 + (now % 1000),
        updatedAt: now,
        editCount: 1,
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

  const exportMonthlyPDF = useCallback(
    (monthKey?: string) => {
      try {
        const { monthLabel } = generateMonthlySalesPdf(
          operationsRef.current,
          monthKey
        );
        triggerNotification(`Resumen PDF de ${monthLabel} descargado`);
      } catch (err) {
        console.error('Error generating PDF:', err);
      }
    },
    [triggerNotification]
  );

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
          materialesDetalle: op.materialesDetalle || existing?.materialesDetalle,
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

  const updateFilamentInitial = useCallback(
    (spoolName: string, targetInitialGrams: number) => {
      const currentSpools = computeSpoolsList(
        operationsRef.current,
        filamentAdjustmentsRef.current
      );
      const targetSpool = currentSpools.find((s) => s.nombre === spoolName);
      if (!targetSpool) return;

      const currentInitAdj = filamentAdjustmentsRef.current[`__init_adj__:${spoolName}`] ?? 0;
      const rawBaseInitial = targetSpool.gramosIniciales - currentInitAdj;
      const validInitial = Math.max(0, Math.round(targetInitialGrams));
      const newInitAdjustment = validInitial - rawBaseInitial;

      const nextAdj: Record<string, number> = {
        ...filamentAdjustmentsRef.current,
        [`__init_adj__:${spoolName}`]: newInitAdjustment,
      };

      // If user previously set a manual remaining grams value, keep that visible remaining value stable
      if (filamentAdjustmentsRef.current[spoolName] !== undefined) {
        const newBaseRestantes = validInitial - targetSpool.gramosConsumidos;
        nextAdj[spoolName] = targetSpool.gramosRestantes - newBaseRestantes;
      }

      commitStateChange(
        operationsRef.current,
        nextAdj,
        `Gramos iniciales de ${spoolName} actualizados a ${validInitial}g y guardado`
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

        if (filters.sortBy === 'fechaLimite') {
          const aHasDeadline = Boolean(a.tipo === 'venta' && a.fechaLimite);
          const bHasDeadline = Boolean(b.tipo === 'venta' && b.fechaLimite);
          // Always keep operations with a deadline above operations without a deadline
          if (aHasDeadline !== bHasDeadline) {
            return aHasDeadline ? -1 : 1;
          }
          if (aHasDeadline && bHasDeadline) {
            const valA = parseDate(a.fechaLimite!).getTime();
            const valB = parseDate(b.fechaLimite!).getTime();
            if (valA !== valB) {
              return filters.sortOrder === 'asc' ? valA - valB : valB - valA;
            }
          }
          const dateA = parseDate(a.fecha).getTime();
          const dateB = parseDate(b.fecha).getTime();
          if (dateA !== dateB) {
            return filters.sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
          }
          return (b.createdAt || 0) - (a.createdAt || 0);
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
          beneficioSandra: 0,
          costesVentas: 0,
          dineroNeto: 0,
          gramosConsumidos: 0,
        };
      }

      const summary = map[key];
      if (op.tipo === 'venta') {
        summary.numVentas += 1;
        summary.dineroBruto = Number((summary.dineroBruto + (op.precio || 0)).toFixed(2));
        summary.costesVentas = Number(
          (summary.costesVentas + Math.abs(op.costes || 0)).toFixed(2)
        );
        summary.gramosConsumidos = Number(
          (summary.gramosConsumidos + getOperationConsumedGrams(op, 15.99)).toFixed(2)
        );
        // Si el vendedor es "Sandra" o "Jorge, Sandra", se suma B. Sandra (precio * 0.15)
        const bSandra = calculateSandraCommission(
          op.precio,
          op.vendedor,
          op.tipo
        );
        summary.beneficioSandra = Number((summary.beneficioSandra + bSandra).toFixed(2));
        summary.dineroGastadoCompras = Number(
          (summary.dineroGastadoCompras + bSandra).toFixed(2)
        );
      } else if (op.tipo === 'compra' || op.tipo === 'inversion') {
        summary.numPedidos += 1;
        summary.dineroGastadoCompras = Number(
          (summary.dineroGastadoCompras + Math.abs(op.costes || 0)).toFixed(2)
        );
      }
      // Beneficio neto del mes: Bruto - Gastos de producción (costesVentas) - B. Sandra (beneficioSandra)
      summary.dineroNeto = Number(
        (summary.dineroBruto - summary.costesVentas - summary.beneficioSandra).toFixed(2)
      );
    });

    return map;
  }, [filteredOperations]);

  // Financial Dashboard Statistics
  const stats = useMemo(() => {
    let totalIngresos = 0;
    let gastosProduccion = 0;
    let gastosGenerales = 0;
    let totalBeneficioSandra = 0;
    let pendienteCobro = 0;

    filteredOperations.forEach((op) => {
      if (op.tipo === 'cierre') return;

      const costTotal = Math.abs(op.costes || 0);
      if (op.tipo === 'venta') {
        if (op.precio && op.precio > 0) {
          totalIngresos += op.precio;
        }
        gastosProduccion += costTotal;
        // Si el vendedor es "Sandra" o "Jorge, Sandra", se suma precio * 0.15 a Gastos en General y se resta del Beneficio Neto
        const bSandra = calculateSandraCommission(
          op.precio,
          op.vendedor,
          op.tipo
        );
        totalBeneficioSandra += bSandra;
        gastosGenerales += bSandra;
      } else if (op.tipo === 'compra' || op.tipo === 'inversion') {
        gastosGenerales += costTotal;
      }

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

    // El beneficio neto resta los gastos de producción y el beneficio de Sandra (Ventas - Gastos de Producción - B. Sandra)
    const totalBeneficio = Number(
      (totalIngresos - gastosProduccion - totalBeneficioSandra).toFixed(2)
    );

    return {
      totalIngresos,
      gastosProduccion,
      gastosGenerales,
      totalCostes: gastosProduccion + gastosGenerales,
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
    updateFilamentInitial,
    deleteFilamentSpool,
    attachQrToOperation,
    deleteOperation,
    duplicateOperation,
    resetToDefaultData,
    clearAllData,
    exportJSON,
    exportMonthlyPDF,
    importJSON,
  };
}
