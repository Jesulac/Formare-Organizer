import { Operation } from '../types/operation';

export const LOCAL_STORAGE_KEY = 'formare3d_ops_v5';
const PREV_STORAGE_KEY = 'formare3d_ops_v3';
const LEGACY_STORAGE_KEY = 'wallapop_organizer_ops_v1';
const IDB_NAME = 'formare3d_database';
const IDB_STORE = 'operations_store';
const IDB_KEY = 'current_payload_v5';
const PREV_IDB_KEY = 'current_payload';
const BROADCAST_CHANNEL_NAME = 'formare3d_realtime_v5';

export const CLIENT_INSTANCE_ID = `client-${Math.random().toString(36).substring(2, 10)}-${Date.now()}`;

export interface PersistedPayload {
  version: number;
  revision: number;
  updatedAt: number;
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

function normalizeRevision(parsed: any): number {
  if (typeof parsed?.revision === 'number' && parsed.revision >= 1) {
    return parsed.revision;
  }
  // Migrate from v3 where updatedAt was used: avoid treating the sandbox 2026-09 seed timestamp as higher than user edits
  const hasFilamentAdjustments =
    parsed?.filamentAdjustments &&
    typeof parsed.filamentAdjustments === 'object' &&
    Object.keys(parsed.filamentAdjustments).length > 0;
  const opsCount = Array.isArray(parsed?.operations) ? parsed.operations.length : 141;
  if (hasFilamentAdjustments || opsCount !== 141) {
    return 2;
  }
  return 1;
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
    const result = await new Promise<PersistedPayload | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(IDB_KEY);
      req.onsuccess = () => {
        if (req.result && Array.isArray(req.result.operations)) {
          resolve({
            version: 5,
            revision: normalizeRevision(req.result),
            updatedAt: req.result.updatedAt || 1,
            clientId: req.result.clientId,
            operations: req.result.operations,
            filamentAdjustments: req.result.filamentAdjustments || {},
          });
          return;
        }
        const prevReq = store.get(PREV_IDB_KEY);
        prevReq.onsuccess = () => {
          if (prevReq.result && Array.isArray(prevReq.result.operations)) {
            resolve({
              version: 5,
              revision: normalizeRevision(prevReq.result),
              updatedAt: 1,
              clientId: prevReq.result.clientId,
              operations: prevReq.result.operations,
              filamentAdjustments: prevReq.result.filamentAdjustments || {},
            });
          } else {
            resolve(null);
          }
        };
        prevReq.onerror = () => resolve(null);
      };
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch {
    return null;
  }
}

export function loadFromLocalStorageSync(): PersistedPayload | null {
  try {
    const rawV5 = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (rawV5) {
      const parsed = JSON.parse(rawV5);
      if (parsed && Array.isArray(parsed.operations)) {
        return {
          version: 5,
          revision: normalizeRevision(parsed),
          updatedAt: parsed.updatedAt || 1,
          clientId: parsed.clientId,
          operations: parsed.operations,
          filamentAdjustments:
            parsed.filamentAdjustments && typeof parsed.filamentAdjustments === 'object'
              ? parsed.filamentAdjustments
              : {},
        };
      }
    }

    const rawV3 = localStorage.getItem(PREV_STORAGE_KEY);
    if (rawV3) {
      const parsed = JSON.parse(rawV3);
      if (parsed && Array.isArray(parsed.operations)) {
        return {
          version: 5,
          revision: normalizeRevision(parsed),
          updatedAt: 1,
          operations: parsed.operations,
          filamentAdjustments:
            parsed.filamentAdjustments && typeof parsed.filamentAdjustments === 'object'
              ? parsed.filamentAdjustments
              : {},
        };
      }
    }

    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const parsedLegacy = JSON.parse(legacyRaw);
      if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
        return {
          version: 5,
          revision: 1,
          updatedAt: 1,
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

export async function saveToServer(payload: PersistedPayload): Promise<number | null> {
  try {
    const res = await fetch('/api/operations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && typeof data.revision === 'number') {
      return data.revision;
    }
  } catch {
    // Expected on static-only deployments; IndexedDB + localStorage handle persistence
  }
  return null;
}

export async function loadFromServer(): Promise<PersistedPayload | null> {
  try {
    const res = await fetch(`/api/operations?t=${Date.now()}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && Array.isArray(data.operations)) {
      return {
        version: 5,
        revision: normalizeRevision(data),
        updatedAt: data.updatedAt || 1,
        clientId: data.clientId,
        operations: data.operations,
        filamentAdjustments:
          data.filamentAdjustments && typeof data.filamentAdjustments === 'object'
            ? data.filamentAdjustments
            : {},
      };
    }
  } catch {
    // Static environment fallback
  }
  return null;
}

export async function cachePayloadLocally(payload: PersistedPayload): Promise<void> {
  saveToLocalStorageSync(payload);
  await saveToIndexedDB(payload);
}

export async function persistOperationsAllLayers(
  operations: Operation[],
  filamentAdjustments: Record<string, number>,
  nextRevision: number
): Promise<number> {
  const updatedAt = Date.now();
  const payload: PersistedPayload = {
    version: 5,
    revision: nextRevision,
    updatedAt,
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
  const [, serverRevision] = await Promise.all([
    saveToIndexedDB(payload),
    saveToServer(payload),
  ]);

  const finalRevision =
    typeof serverRevision === 'number' && serverRevision > nextRevision
      ? serverRevision
      : nextRevision;

  if (finalRevision !== nextRevision) {
    const updatedPayload: PersistedPayload = {
      ...payload,
      revision: finalRevision,
    };
    saveToLocalStorageSync(updatedPayload);
    void saveToIndexedDB(updatedPayload);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('formare3d-saved', { detail: { revision: finalRevision, updatedAt } })
    );
  }

  return finalRevision;
}

export function subscribeToRealtimeUpdates(
  onRemotePayload: (payload: PersistedPayload) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  let isDisposed = false;
  let eventSource: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const handleIncoming = (raw: any) => {
    if (isDisposed || !raw || !Array.isArray(raw.operations)) return;
    if (raw.clientId && raw.clientId === CLIENT_INSTANCE_ID) return;
    onRemotePayload({
      version: 5,
      revision: normalizeRevision(raw),
      updatedAt: raw.updatedAt || Date.now(),
      clientId: raw.clientId,
      operations: raw.operations,
      filamentAdjustments:
        raw.filamentAdjustments && typeof raw.filamentAdjustments === 'object'
          ? raw.filamentAdjustments
          : {},
    });
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
          reconnectTimer = setTimeout(connectSSE, 3000);
        }
      };
    } catch {
      // Fallback to polling if SSE not available
    }
  };
  connectSSE();

  // 4. Periodic poll + visibility/focus check so no update is ever missed
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
  }, 3500);

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
