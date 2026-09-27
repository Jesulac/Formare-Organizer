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
  filamentAdjustments?: Record<string, number>
): string {
  const opsPart = operations
    .map(
      (op) =>
        `${op.id}:${op.producto}:${op.unidades ?? 1}:${op.precio ?? 0}:${op.costes ?? 0}:${op.estado}:${op.lugarVenta}:${op.fecha}:${op.fechaLimite ?? ''}:${op.vendedor ?? ''}:${op.material ?? ''}:${op.comentarios ?? ''}:${op.fotoQr ? op.fotoQr.length : 0}:${op.empresaEnvio ?? ''}`
    )
    .join('|');
  const adjEntries = Object.entries(filamentAdjustments || {}).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  const adjPart = adjEntries.map(([k, v]) => `${k}=${v}`).join(',');
  return `${operations.length}#${opsPart}#${adjPart}`;
}

function normalizePayload(parsed: any): PersistedPayload | null {
  if (!parsed || !Array.isArray(parsed.operations)) return null;
  const revision =
    typeof parsed.revision === 'number' && parsed.revision >= 1 ? parsed.revision : 1;
  const updatedAt = typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 1;
  const clientId = parsed.clientId || 'local-init';
  return {
    version: 6,
    revision,
    updatedAt,
    syncId: parsed.syncId || `${revision}-${updatedAt}-${clientId}`,
    clientId,
    operations: parsed.operations,
    filamentAdjustments:
      parsed.filamentAdjustments && typeof parsed.filamentAdjustments === 'object'
        ? parsed.filamentAdjustments
        : {},
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
          } else {
            next();
          }
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
        const parsed = JSON.parse(raw);
        const norm = normalizePayload(parsed);
        if (norm) return norm;
      }
    }

    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const parsedLegacy = JSON.parse(legacyRaw);
      if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
        return {
          version: 6,
          revision: 1,
          updatedAt: 1,
          syncId: '1-1-legacy',
          clientId: 'legacy',
          operations: parsedLegacy,
          filamentAdjustments: {},
        };
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
  } catch {
    try {
      const lightweightPayload: PersistedPayload = {
        ...payload,
        operations: payload.operations.map((op) => ({
          ...op,
          fotoQr: op.fotoQr && op.fotoQr.length > 40000 ? undefined : op.fotoQr,
        })),
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(lightweightPayload));
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
  nextRevision: number
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
