import { Operation } from '../types/operation';

const LOCAL_STORAGE_KEY = 'formare3d_ops_v3';
const LEGACY_STORAGE_KEY = 'wallapop_organizer_ops_v1';
const IDB_NAME = 'formare3d_database';
const IDB_STORE = 'operations_store';
const IDB_KEY = 'current_payload';

export interface PersistedPayload {
  version: number;
  updatedAt: number;
  operations: Operation[];
  filamentAdjustments?: Record<string, number>;
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
      req.onsuccess = () => resolve(req.result || null);
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
    const rawV3 = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (rawV3) {
      const parsed = JSON.parse(rawV3);
      if (parsed && Array.isArray(parsed.operations)) {
        return {
          version: parsed.version || 3,
          updatedAt: parsed.updatedAt || Date.now(),
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
          version: 3,
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
    // Keep legacy key in sync for backwards compatibility
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(payload.operations));
  } catch (err) {
    // If localStorage hits 5MB quota due to many base64 photos, store lightweight copy in localStorage
    // while IndexedDB and the backend server store the full high-res photos
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

export async function saveToServer(payload: PersistedPayload): Promise<void> {
  try {
    await fetch('/api/operations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Expected on static-only deployments (e.g. Vercel static); IndexedDB + localStorage handle persistence
  }
}

export async function loadFromServer(): Promise<PersistedPayload | null> {
  try {
    const res = await fetch('/api/operations', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && Array.isArray(data.operations)) {
      return {
        version: data.version || 3,
        updatedAt: data.updatedAt || 0,
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

export async function persistOperationsAllLayers(
  operations: Operation[],
  filamentAdjustments?: Record<string, number>
): Promise<number> {
  const updatedAt = Date.now();
  const payload: PersistedPayload = {
    version: 3,
    updatedAt,
    operations,
    filamentAdjustments: filamentAdjustments || {},
  };

  saveToLocalStorageSync(payload);
  await Promise.all([
    saveToIndexedDB(payload),
    saveToServer(payload),
  ]);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('formare3d-saved', { detail: { updatedAt } }));
  }

  return updatedAt;
}
