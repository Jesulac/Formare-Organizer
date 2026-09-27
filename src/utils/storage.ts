import { Operation } from '../types/operation';

export const LOCAL_STORAGE_KEY = 'formare3d_ops_v6';
const PREV_STORAGE_KEY_V5 = 'formare3d_ops_v5';
const PREV_STORAGE_KEY_V3 = 'formare3d_ops_v3';
const LEGACY_STORAGE_KEY = 'wallapop_organizer_ops_v1';
const IDB_NAME = 'formare3d_database';
const IDB_STORE = 'operations_store';
const IDB_KEY = 'current_payload_v6';
const PREV_IDB_KEY_V5 = 'current_payload_v5';
const PREV_IDB_KEY = 'current_payload';
const BROADCAST_CHANNEL_NAME = 'formare3d_realtime_v6';

export const CLIENT_INSTANCE_ID = `client-${Math.random().toString(36).substring(2, 10)}-${Date.now()}`;

export interface PersistedPayload {
  version: number;
  revision: number;
  updatedAt: number;
  syncId?: string;
  clientId?: string;
  operations: Operation[];
  filamentAdjustments?: Record<string, number>;
  deletedOperationIds?: string[];
}

let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  } catch {
    broadcastChannel = null;
  }
}

export function computeStateFingerprint(
  operations: Operation[],
  filamentAdjustments?: Record<string, number>,
  deletedOperationIds?: string[]
): string {
  const opsPart = operations
    .map(
      (op) =>
        `${op.id}:${op.producto}:${op.unidades ?? 1}:${op.precio ?? 0}:${op.costes ?? 0}:${op.costesOperativos ?? 0}:${op.estado}:${op.lugarVenta}:${op.fecha}:${op.fechaLimite ?? ''}:${op.vendedor ?? ''}:${op.material ?? ''}:${op.comentarios ?? ''}:${op.fotoQr ? op.fotoQr.length : 0}:${op.empresaEnvio ?? ''}`
    )
    .join('|');
  const adjEntries = Object.entries(filamentAdjustments || {}).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  const adjPart = adjEntries.map(([k, v]) => `${k}=${v}`).join(',');
  const delPart = (deletedOperationIds || []).slice().sort().join(',');
  return `${operations.length}#${opsPart}#${adjPart}#${delPart}`;
}

function isLegacyGhostOperation(op: any): boolean {
  if (!op || typeof op !== 'object') return true;
  const prod = String(op.producto || '').toLowerCase().trim();
  if (
    prod.includes('pedido filamento pla azul (esun)') &&
    !String(op.id || '').startsWith('op-v7-')
  ) {
    return true;
  }
  return false;
}

function normalizePayload(parsed: any): PersistedPayload | null {
  if (!parsed || !Array.isArray(parsed.operations)) return null;
  const revision =
    typeof parsed.revision === 'number' && parsed.revision >= 1 ? parsed.revision : 1;
  const updatedAt = typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 1;
  const hasUserTimestampOrRev =
    (typeof parsed.updatedAt === 'number' && parsed.updatedAt > 1) ||
    (typeof parsed.revision === 'number' && parsed.revision > 1);
  const clientId =
    parsed.clientId ||
    (hasUserTimestampOrRev ? 'user-local-persisted' : 'local-init');
  const deletedOperationIds = Array.isArray(parsed.deletedOperationIds)
    ? parsed.deletedOperationIds.filter((id: any) => typeof id === 'string')
    : [];
  const deletedSet = new Set(deletedOperationIds);
  const cleanOps = parsed.operations.filter(
    (op: any) => op && op.id && !deletedSet.has(op.id) && !isLegacyGhostOperation(op)
  );
  return {
    version: 6,
    revision,
    updatedAt,
    syncId: parsed.syncId || `${revision}-${updatedAt}-${clientId}`,
    clientId,
    operations: cleanOps,
    filamentAdjustments:
      parsed.filamentAdjustments && typeof parsed.filamentAdjustments === 'object'
        ? parsed.filamentAdjustments
        : {},
    deletedOperationIds,
  };
}

export function isUserEditedPayload(payload: PersistedPayload | null | undefined): boolean {
  if (!payload) return false;
  if (payload.clientId === 'server-init' || payload.clientId === 'local-init') {
    return false;
  }
  return Boolean(payload.clientId) || (payload.updatedAt || 0) > 1 || (payload.revision || 0) > 1;
}

/**
 * Non-destructively merge local and remote payloads so that a redeploy or cold-start
 * never overwrites or loses user-created or user-edited operations, and deleted items never resurrect.
 */
export function mergePersistedPayloads(
  local: PersistedPayload,
  remote: PersistedPayload
): { merged: PersistedPayload; needsServerPush: boolean } {
  const remoteIsInit =
    !remote.clientId || remote.clientId === 'server-init' || remote.updatedAt <= 1;
  const localHasEdits = isUserEditedPayload(local);

  // Case 1: Server is on fresh deploy/cold-start seed (server-init) and browser has user data.
  // Keep browser state 100% intact and push it to the server immediately.
  if (remoteIsInit && localHasEdits) {
    const localDeleted = Array.from(new Set(local.deletedOperationIds || []));
    const localDeletedSet = new Set(localDeleted);
    const cleanLocalOps = (local.operations || []).filter(
      (op) => op && op.id && !localDeletedSet.has(op.id) && !isLegacyGhostOperation(op)
    );
    const nextRev = Math.max(local.revision || 1, remote.revision || 1);
    const nextUpd = Math.max(local.updatedAt || Date.now(), 2);
    const winClient = local.clientId || CLIENT_INSTANCE_ID;
    return {
      merged: {
        version: 6,
        revision: nextRev,
        updatedAt: nextUpd,
        syncId: `${nextRev}-${nextUpd}-${winClient}`,
        clientId: winClient,
        operations: cleanLocalOps,
        filamentAdjustments: { ...(local.filamentAdjustments || {}) },
        deletedOperationIds: localDeleted,
      },
      needsServerPush: true,
    };
  }

  // Case 2: Browser has only initial seed (no user edits) and server has real user data.
  if (!localHasEdits && !remoteIsInit) {
    const remoteDeleted = Array.from(new Set(remote.deletedOperationIds || []));
    const remoteDeletedSet = new Set(remoteDeleted);
    const cleanRemoteOps = (remote.operations || []).filter(
      (op) => op && op.id && !remoteDeletedSet.has(op.id) && !isLegacyGhostOperation(op)
    );
    return {
      merged: {
        version: 6,
        revision: remote.revision || 1,
        updatedAt: remote.updatedAt || Date.now(),
        syncId:
          remote.syncId ||
          `${remote.revision || 1}-${remote.updatedAt || 1}-${remote.clientId || 'remote'}`,
        clientId: remote.clientId || CLIENT_INSTANCE_ID,
        operations: cleanRemoteOps,
        filamentAdjustments: { ...(remote.filamentAdjustments || {}) },
        deletedOperationIds: remoteDeleted,
      },
      needsServerPush: false,
    };
  }

  // Case 3: Both local and remote have user edits (or both are init). Merge per operation ID.
  const deletedSet = new Set<string>([
    ...(local.deletedOperationIds || []),
    ...(remote.deletedOperationIds || []),
  ]);

  const localMap = new Map<string, Operation>();
  for (const op of local.operations || []) {
    if (op && op.id && !deletedSet.has(op.id) && !isLegacyGhostOperation(op)) {
      localMap.set(op.id, op);
    }
  }

  const remoteMap = new Map<string, Operation>();
  for (const op of remote.operations || []) {
    if (op && op.id && !deletedSet.has(op.id) && !isLegacyGhostOperation(op)) {
      remoteMap.set(op.id, op);
    }
  }

  const allIds = new Set<string>([...localMap.keys(), ...remoteMap.keys()]);
  const mergedOps: Operation[] = [];
  let localContributedNewer = false;

  const localPayloadTime = local.updatedAt || 1;
  const remotePayloadTime = remote.updatedAt || 1;
  const localIsNewerOverall = localPayloadTime >= remotePayloadTime;

  for (const id of allIds) {
    if (deletedSet.has(id)) continue;
    const lOp = localMap.get(id);
    const rOp = remoteMap.get(id);

    if (lOp && !rOp) {
      const lOpTime = lOp.updatedAt || 0;
      // Keep lOp if local snapshot is newer overall OR lOp was explicitly updated after remote snapshot
      if (localIsNewerOverall || lOpTime > remotePayloadTime) {
        mergedOps.push(lOp);
        localContributedNewer = true;
      } else {
        deletedSet.add(id);
      }
    } else if (!lOp && rOp) {
      const rOpTime = rOp.updatedAt || 0;
      // Keep rOp only if remote snapshot is newer overall OR rOp was explicitly updated after local snapshot
      if (!localIsNewerOverall || rOpTime > localPayloadTime) {
        mergedOps.push(rOp);
      } else {
        deletedSet.add(id);
        localContributedNewer = true;
      }
    } else if (lOp && rOp) {
      const lTime = lOp.updatedAt || lOp.createdAt || localPayloadTime;
      const rTime = rOp.updatedAt || rOp.createdAt || remotePayloadTime;
      if (lTime > rTime || (lTime === rTime && localIsNewerOverall)) {
        mergedOps.push(lOp);
        if (lTime > rTime) localContributedNewer = true;
      } else {
        mergedOps.push(rOp);
      }
    }
  }

  const mergedAdjustments: Record<string, number> = localIsNewerOverall
    ? { ...(remote.filamentAdjustments || {}), ...(local.filamentAdjustments || {}) }
    : { ...(local.filamentAdjustments || {}), ...(remote.filamentAdjustments || {}) };

  const nextRevision = Math.max(local.revision || 1, remote.revision || 1);
  const nextUpdatedAt = Math.max(localPayloadTime, remotePayloadTime);
  const winningClientId = localIsNewerOverall
    ? local.clientId || CLIENT_INSTANCE_ID
    : remote.clientId || local.clientId || CLIENT_INSTANCE_ID;

  const needsServerPush =
    localPayloadTime > remotePayloadTime ||
    localContributedNewer ||
    (local.deletedOperationIds || []).some(
      (id) => !(remote.deletedOperationIds || []).includes(id)
    );

  return {
    merged: {
      version: 6,
      revision: nextRevision,
      updatedAt: nextUpdatedAt,
      syncId: `${nextRevision}-${nextUpdatedAt}-${winningClientId}`,
      clientId: winningClientId,
      operations: mergedOps,
      filamentAdjustments: mergedAdjustments,
      deletedOperationIds: Array.from(deletedSet),
    },
    needsServerPush,
  };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveToIndexedDB(payload: PersistedPayload): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(payload, IDB_KEY);
      store.delete(PREV_IDB_KEY_V5);
      store.delete(PREV_IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('IndexedDB save fallback:', err);
  }
}

export async function loadFromIndexedDB(): Promise<PersistedPayload | null> {
  try {
    const db = await openDatabase();
    const result = await new Promise<PersistedPayload | null>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const tryKeys = [IDB_KEY, PREV_IDB_KEY_V5, PREV_IDB_KEY];
      let idx = 0;

      const next = () => {
        if (idx >= tryKeys.length) {
          resolve(null);
          return;
        }
        const key = tryKeys[idx++];
        const req = store.get(key);
        req.onsuccess = () => {
          const norm = normalizePayload(req.result);
          if (norm) {
            resolve(norm);
            return;
          }
          next();
        };
        req.onerror = () => next();
      };

      next();
    });
    db.close();
    return result;
  } catch {
    return null;
  }
}

export function loadFromLocalStorageSync(): PersistedPayload | null {
  try {
    for (const key of [LOCAL_STORAGE_KEY, PREV_STORAGE_KEY_V5, PREV_STORAGE_KEY_V3]) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          const norm = normalizePayload(parsed);
          if (norm) {
            return norm;
          }
        } catch {
          // Continue checking fallback keys
        }
      }
    }

    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const parsedLegacy = JSON.parse(legacyRaw);
      if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
        return normalizePayload({
          version: 6,
          revision: 2,
          updatedAt: 2,
          syncId: '2-2-legacy',
          clientId: 'legacy',
          operations: parsedLegacy,
          filamentAdjustments: {},
          deletedOperationIds: [],
        });
      }
    }
  } catch (err) {
    console.error('Error reading localStorage:', err);
  }
  return null;
}

export function saveToLocalStorageSync(payload: PersistedPayload): void {
  try {
    const serialized = JSON.stringify(payload);
    localStorage.setItem(LOCAL_STORAGE_KEY, serialized);
    localStorage.removeItem(PREV_STORAGE_KEY_V5);
    localStorage.removeItem(PREV_STORAGE_KEY_V3);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    try {
      const lightweightPayload: PersistedPayload = {
        ...payload,
        operations: payload.operations.map((op) => ({
          ...op,
          fotoQr: op.fotoQr && op.fotoQr.length > 40000 ? undefined : op.fotoQr,
        })),
      };
      const serializedLight = JSON.stringify(lightweightPayload);
      localStorage.setItem(LOCAL_STORAGE_KEY, serializedLight);
      localStorage.removeItem(PREV_STORAGE_KEY_V5);
      localStorage.removeItem(PREV_STORAGE_KEY_V3);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (innerErr) {
      console.warn('localStorage quota exceeded, relying on IndexedDB & Server:', innerErr);
    }
  }
}

export async function saveToServer(
  payload: PersistedPayload
): Promise<{ revision: number; updatedAt: number; syncId: string } | null> {
  try {
    const res = await fetch('/api/operations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && typeof data.revision === 'number') {
      return {
        revision: data.revision,
        updatedAt: data.updatedAt || payload.updatedAt,
        syncId: data.syncId || `${data.revision}-${data.updatedAt || payload.updatedAt}-${payload.clientId}`,
      };
    }
  } catch {
    // Offline or static fallback
  }
  return null;
}

export async function loadFromServer(): Promise<PersistedPayload | null> {
  try {
    const res = await fetch(`/api/operations?t=${Date.now()}`, {
      method: 'GET',
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return normalizePayload(data);
  } catch {
    return null;
  }
}

export async function cachePayloadLocally(payload: PersistedPayload): Promise<void> {
  saveToLocalStorageSync(payload);
  await saveToIndexedDB(payload);
}

export async function persistOperationsAllLayers(
  operations: Operation[],
  filamentAdjustments: Record<string, number>,
  nextRevision: number,
  deletedOperationIds: string[] = []
): Promise<{ revision: number; syncId: string }> {
  const updatedAt = Date.now();
  const localSyncId = `${nextRevision}-${updatedAt}-${CLIENT_INSTANCE_ID}`;
  const payload: PersistedPayload = {
    version: 6,
    revision: nextRevision,
    updatedAt,
    syncId: localSyncId,
    clientId: CLIENT_INSTANCE_ID,
    operations,
    filamentAdjustments: filamentAdjustments || {},
    deletedOperationIds,
  };

  // 1. Save synchronously to localStorage
  saveToLocalStorageSync(payload);

  // 2. Broadcast immediately to other open tabs in same browser
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(payload);
    } catch {
      // Ignore broadcast errors
    }
  }

  // 3. Persist to IndexedDB and Server in parallel
  const [, serverMeta] = await Promise.all([
    saveToIndexedDB(payload),
    saveToServer(payload),
  ]);

  const finalRevision = serverMeta ? serverMeta.revision : nextRevision;
  const finalSyncId = serverMeta ? serverMeta.syncId : localSyncId;

  const updatedPayload: PersistedPayload = {
    ...payload,
    revision: finalRevision,
    updatedAt: serverMeta ? serverMeta.updatedAt : updatedAt,
    syncId: finalSyncId,
  };
  saveToLocalStorageSync(updatedPayload);
  void saveToIndexedDB(updatedPayload);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('formare3d-saved', {
        detail: { revision: finalRevision, updatedAt: updatedPayload.updatedAt, syncId: finalSyncId },
      })
    );
  }

  return { revision: finalRevision, syncId: finalSyncId };
}

export function subscribeToRealtimeUpdates(
  onRemotePayload: (payload: PersistedPayload) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  let isDisposed = false;
  let eventSource: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const handleIncoming = (raw: any) => {
    if (isDisposed) return;
    const norm = normalizePayload(raw);
    if (!norm) return;
    if (norm.clientId && norm.clientId === CLIENT_INSTANCE_ID) return;
    onRemotePayload(norm);
  };

  // 1. BroadcastChannel listener (0ms same-browser cross-tab sync)
  const onBroadcastMessage = (event: MessageEvent) => {
    handleIncoming(event.data);
  };
  broadcastChannel?.addEventListener('message', onBroadcastMessage);

  // 2. window 'storage' event listener (cross-tab localStorage sync)
  const onStorageEvent = (event: StorageEvent) => {
    if (event.key === LOCAL_STORAGE_KEY && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue);
        handleIncoming(parsed);
      } catch {
        // Ignore parse error
      }
    }
  };
  window.addEventListener('storage', onStorageEvent);

  // 3. Server-Sent Events (SSE) stream for instant cross-device / multi-tab push
  const connectSSE = () => {
    if (isDisposed || typeof EventSource === 'undefined') return;
    try {
      eventSource = new EventSource('/api/operations/stream');
      eventSource.onmessage = (e) => {
        if (!e.data) return;
        try {
          const parsed = JSON.parse(e.data);
          handleIncoming(parsed);
        } catch {
          // Ignore malformed SSE message
        }
      };
      eventSource.onerror = () => {
        eventSource?.close();
        eventSource = null;
        if (!isDisposed) {
          reconnectTimer = setTimeout(connectSSE, 4000);
        }
      };
    } catch {
      // Fallback to polling if SSE not available
    }
  };
  connectSSE();

  // 4. Fast periodic poll (every 1.5s) + visibility/focus check for Vercel & cross-device sync
  const syncFromServer = async () => {
    if (isDisposed) return;
    const serverPayload = await loadFromServer();
    if (serverPayload) {
      handleIncoming(serverPayload);
    }
  };

  const pollInterval = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      void syncFromServer();
    }
  }, 1500);

  const onFocusOrVisible = () => {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      void syncFromServer();
    }
  };
  window.addEventListener('focus', onFocusOrVisible);
  document.addEventListener('visibilitychange', onFocusOrVisible);

  return () => {
    isDisposed = true;
    broadcastChannel?.removeEventListener('message', onBroadcastMessage);
    window.removeEventListener('storage', onStorageEvent);
    window.removeEventListener('focus', onFocusOrVisible);
    document.removeEventListener('visibilitychange', onFocusOrVisible);
    clearInterval(pollInterval);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    eventSource?.close();
  };
}
