import { Operation } from '../types/operation';
import {
  saveToSupabase,
  loadFromSupabase,
  isSupabaseConfigured,
  subscribeToSupabaseRealtime,
} from './supabase';

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
        `${op.id}:${op.editCount ?? 0}:${op.updatedAt ?? 0}:${op.producto}:${op.unidades ?? 1}:${op.precio ?? 0}:${op.costes ?? 0}:${op.costesOperativos ?? 0}:${op.estado}:${op.lugarVenta}:${op.fecha}:${op.fechaLimite ?? ''}:${op.vendedor ?? ''}:${op.material ?? ''}:${op.comentarios ?? ''}:${op.fotoQr ? op.fotoQr.length : 0}:${op.empresaEnvio ?? ''}`
    )
    .join('|');
  const adjEntries = Object.entries(filamentAdjustments || {}).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  const adjPart = adjEntries.map(([k, v]) => `${k}=${v}`).join(',');
  const delPart = (deletedOperationIds || []).slice().sort().join(',');
  return `${operations.length}#${opsPart}#${adjPart}#${delPart}`;
}

const SYNTHETIC_CREATED_AT_THRESHOLD = 1799900000000;

export function getValidUpdatedAt(ts?: number): number {
  if (typeof ts !== 'number' || isNaN(ts) || ts <= 1) return 0;
  if (ts >= SYNTHETIC_CREATED_AT_THRESHOLD) return 0;
  return ts;
}

let highestKnownTimestamp = Date.now();
let latestSaveSequence = 0;
let lastKnownSyncId = '';

export function getLatestSaveSequence(): number {
  return latestSaveSequence;
}

export function nextMonotonicTimestamp(minTimestamp: number = 0): number {
  const now = Date.now();
  const validMin = getValidUpdatedAt(minTimestamp);
  const candidate = Math.max(now, highestKnownTimestamp + 1, validMin + 1);
  highestKnownTimestamp = candidate;
  return candidate;
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
  const rawUpdatedAt = typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 1;
  const updatedAt = getValidUpdatedAt(rawUpdatedAt) || (rawUpdatedAt > 1 ? Date.now() : 1);
  if (updatedAt > highestKnownTimestamp) {
    highestKnownTimestamp = updatedAt;
  }
  const hasUserTimestampOrRev = updatedAt > 1 || revision > 1;
  const clientId =
    parsed.clientId ||
    (hasUserTimestampOrRev ? 'user-local-persisted' : 'local-init');
  const deletedOperationIds = Array.isArray(parsed.deletedOperationIds)
    ? parsed.deletedOperationIds.filter((id: any) => typeof id === 'string')
    : [];
  const deletedSet = new Set(deletedOperationIds);
  const cleanOps = parsed.operations
    .filter(
      (op: any) => op && op.id && !deletedSet.has(op.id) && !isLegacyGhostOperation(op)
    )
    .map((op: any) => {
      const validOpUpd = getValidUpdatedAt(op.updatedAt);
      if (validOpUpd > highestKnownTimestamp) {
        highestKnownTimestamp = validOpUpd;
      }
      return {
        ...op,
        updatedAt: validOpUpd > 0 ? validOpUpd : undefined,
        editCount: typeof op.editCount === 'number' && op.editCount > 0 ? op.editCount : 0,
      };
    });
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
 * Non-destructively merge local and remote payloads so that a redeploy, cold-start,
 * or stale serverless instance never overwrites user-created or user-edited operations.
 */
export function mergePersistedPayloads(
  local: PersistedPayload,
  remote: PersistedPayload
): { merged: PersistedPayload; needsServerPush: boolean } {
  const remoteIsInit =
    !remote.clientId || remote.clientId === 'server-init' || (remote.updatedAt || 0) <= 1;
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
    const nextUpd = Math.max(getValidUpdatedAt(local.updatedAt) || Date.now(), 2);
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
        updatedAt: getValidUpdatedAt(remote.updatedAt) || Date.now(),
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

  const localRev = local.revision || 1;
  const remoteRev = remote.revision || 1;
  const localPayloadTime = getValidUpdatedAt(local.updatedAt) || 1;
  const remotePayloadTime = getValidUpdatedAt(remote.updatedAt) || 1;
  const localIsNewerOverall =
    localRev !== remoteRev
      ? localRev > remoteRev
      : localPayloadTime >= remotePayloadTime;

  for (const id of allIds) {
    if (deletedSet.has(id)) continue;
    const lOp = localMap.get(id);
    const rOp = remoteMap.get(id);

    if (lOp && !rOp) {
      const lOpTime = getValidUpdatedAt(lOp.updatedAt);
      const lEdit = typeof lOp.editCount === 'number' ? lOp.editCount : 0;
      if (localIsNewerOverall || lEdit > 0 || lOpTime > remotePayloadTime) {
        mergedOps.push(lOp);
        localContributedNewer = true;
      } else {
        deletedSet.add(id);
      }
    } else if (!lOp && rOp) {
      const rOpTime = getValidUpdatedAt(rOp.updatedAt);
      const rEdit = typeof rOp.editCount === 'number' ? rOp.editCount : 0;
      if (!localIsNewerOverall || rEdit > 0 || rOpTime > localPayloadTime) {
        mergedOps.push(rOp);
      } else {
        deletedSet.add(id);
        localContributedNewer = true;
      }
    } else if (lOp && rOp) {
      // NEVER use op.createdAt here because createdAt uses synthetic 1800000000000+ sort keys!
      const lEdit = typeof lOp.editCount === 'number' ? lOp.editCount : 0;
      const rEdit = typeof rOp.editCount === 'number' ? rOp.editCount : 0;
      const lTime = getValidUpdatedAt(lOp.updatedAt);
      const rTime = getValidUpdatedAt(rOp.updatedAt);

      let pickLocal: boolean;
      if (lEdit !== rEdit) {
        pickLocal = lEdit > rEdit;
      } else if (lTime !== rTime) {
        pickLocal = lTime > rTime;
      } else {
        pickLocal = localIsNewerOverall;
      }

      const winner = pickLocal ? lOp : rOp;
      const loser = pickLocal ? rOp : lOp;

      // If winner lost fotoQr due to localStorage quota stripping, restore fotoQr from loser
      const restoredFotoQr =
        winner.estado === 'Pendiente de cobro'
          ? undefined
          : winner.fotoQr || loser.fotoQr;

      mergedOps.push({
        ...winner,
        fotoQr: restoredFotoQr,
      });

      if (pickLocal && (lEdit > rEdit || lTime > rTime || lOp.costes !== rOp.costes || lOp.precio !== rOp.precio || lOp.estado !== rOp.estado)) {
        localContributedNewer = true;
      }
    }
  }

  const mergedAdjustments: Record<string, number> = localIsNewerOverall
    ? { ...(remote.filamentAdjustments || {}), ...(local.filamentAdjustments || {}) }
    : { ...(local.filamentAdjustments || {}), ...(remote.filamentAdjustments || {}) };

  const nextRevision = Math.max(localRev, remoteRev);
  const nextUpdatedAt = Math.max(localPayloadTime, remotePayloadTime);
  const winningClientId = localIsNewerOverall
    ? local.clientId || CLIENT_INSTANCE_ID
    : remote.clientId || local.clientId || CLIENT_INSTANCE_ID;

  const needsServerPush =
    localRev > remoteRev ||
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
  if (payload.syncId) {
    lastKnownSyncId = payload.syncId;
  }

  const buildTextOnlyPayload = (): PersistedPayload => ({
    ...payload,
    operations: payload.operations.map((op) => ({
      ...op,
      fotoQr: undefined,
    })),
  });

  try {
    localStorage.removeItem(PREV_STORAGE_KEY_V5);
    localStorage.removeItem(PREV_STORAGE_KEY_V3);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    const serialized = JSON.stringify(payload);
    // Keep localStorage well below the 5MB UTF-16 browser limit (~2.5M chars)
    // Full QR images remain stored in IndexedDB and Server
    if (serialized.length > 1400000) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(buildTextOnlyPayload()));
    } else {
      localStorage.setItem(LOCAL_STORAGE_KEY, serialized);
    }
  } catch {
    try {
      // Remove existing key first to free quota before writing compact payload
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(buildTextOnlyPayload()));
    } catch (innerErr) {
      console.warn('localStorage quota exceeded, relying on IndexedDB & Server:', innerErr);
    }
  }
}

export async function saveToServer(
  payload: PersistedPayload
): Promise<{ revision: number; updatedAt: number; syncId: string } | null> {
  try {
    const bodyStr = JSON.stringify(payload);
    const res = await fetch('/api/operations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyStr,
      keepalive: bodyStr.length < 60000,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && typeof data.revision === 'number') {
      const srvUpd = getValidUpdatedAt(data.updatedAt) || payload.updatedAt;
      if (srvUpd > highestKnownTimestamp) {
        highestKnownTimestamp = srvUpd;
      }
      return {
        revision: Math.max(data.revision, payload.revision),
        updatedAt: Math.max(srvUpd, payload.updatedAt),
        syncId: data.syncId || `${data.revision}-${srvUpd}-${payload.clientId}`,
      };
    }
  } catch {
    // Offline or static fallback
  }
  return null;
}

export interface ServerCheckResult {
  hasChanges: boolean;
  syncId?: string;
  revision?: number;
  updatedAt?: number;
  clientId?: string;
}

export async function checkServerSync(knownSyncId?: string): Promise<ServerCheckResult | null> {
  try {
    const syncToCompare = knownSyncId || lastKnownSyncId;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (syncToCompare) {
      headers['If-None-Match'] = `"${syncToCompare}"`;
    }

    const res = await fetch('/api/operations?check=1', {
      method: 'GET',
      headers,
    });

    if (res.status === 304) {
      // 304 Not Modified: 0 bytes transferred
      return { hasChanges: false, syncId: syncToCompare };
    }

    if (!res.ok) return null;

    const data = await res.json();
    if (data && typeof data.revision === 'number') {
      const serverSyncId = data.syncId || `${data.revision}-${data.updatedAt}-${data.clientId}`;
      const isOurs = data.clientId && data.clientId === CLIENT_INSTANCE_ID;
      const isSameSync = syncToCompare && serverSyncId === syncToCompare;

      if (isOurs || isSameSync) {
        return {
          hasChanges: false,
          syncId: serverSyncId,
          revision: data.revision,
          updatedAt: data.updatedAt,
          clientId: data.clientId,
        };
      }

      return {
        hasChanges: true,
        syncId: serverSyncId,
        revision: data.revision,
        updatedAt: data.updatedAt,
        clientId: data.clientId,
      };
    }
  } catch {
    // Offline or static fallback
  }
  return null;
}

export async function loadFromServer(knownSyncId?: string): Promise<PersistedPayload | null> {
  // If Supabase is configured, fetch directly from Supabase (works on GitHub Pages without any backend!)
  if (isSupabaseConfigured()) {
    try {
      const supaPayload = await loadFromSupabase();
      if (supaPayload) {
        if (supaPayload.syncId) {
          lastKnownSyncId = supaPayload.syncId;
        }
        return supaPayload;
      }
    } catch {
      // Fallback to server/local
    }
  }

  try {
    const syncToCompare = knownSyncId || lastKnownSyncId;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (syncToCompare) {
      headers['If-None-Match'] = `"${syncToCompare}"`;
    }

    const res = await fetch('/api/operations', {
      method: 'GET',
      headers,
    });

    if (res.status === 304) {
      // HTTP 304: Nothing changed, 0 bytes body transferred!
      return null;
    }

    if (!res.ok) return null;
    const data = await res.json();
    const payload = normalizePayload(data);
    if (payload?.syncId) {
      lastKnownSyncId = payload.syncId;
    }
    return payload;
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
): Promise<{ revision: number; updatedAt: number; syncId: string }> {
  const mySaveSeq = ++latestSaveSequence;
  const updatedAt = nextMonotonicTimestamp();
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

  // 1. Save synchronously to localStorage immediately
  saveToLocalStorageSync(payload);

  // 2. Broadcast immediately to other open tabs in same browser
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(payload);
    } catch {
      // Ignore broadcast errors
    }
  }

  // 3. Persist to IndexedDB, Server and Supabase in parallel
  const [, serverMeta] = await Promise.all([
    saveToIndexedDB(payload),
    saveToServer(payload),
    isSupabaseConfigured() ? saveToSupabase(payload) : Promise.resolve(false),
  ]);

  // 4. CRITICAL: If a newer save started while we were awaiting network/IDB, do NOT overwrite with older state!
  if (mySaveSeq !== latestSaveSequence) {
    return { revision: nextRevision, updatedAt, syncId: localSyncId };
  }

  const finalRevision = serverMeta ? Math.max(serverMeta.revision, nextRevision) : nextRevision;
  const finalUpdatedAt = serverMeta ? Math.max(serverMeta.updatedAt, updatedAt) : updatedAt;
  const finalSyncId = serverMeta ? serverMeta.syncId : localSyncId;

  const updatedPayload: PersistedPayload = {
    ...payload,
    revision: finalRevision,
    updatedAt: finalUpdatedAt,
    syncId: finalSyncId,
  };
  saveToLocalStorageSync(updatedPayload);
  void saveToIndexedDB(updatedPayload);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('formare3d-saved', {
        detail: { revision: finalRevision, updatedAt: finalUpdatedAt, syncId: finalSyncId },
      })
    );
  }

  lastKnownSyncId = finalSyncId;
  return { revision: finalRevision, updatedAt: finalUpdatedAt, syncId: finalSyncId };
}

export function subscribeToRealtimeUpdates(
  onRemotePayload: (payload: PersistedPayload) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  let isDisposed = false;
  let eventSource: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let focusDebounce: ReturnType<typeof setTimeout> | null = null;
  let isChecking = false;
  let sseFailures = 0;

  const handleIncoming = (raw: any) => {
    if (isDisposed) return;
    const norm = normalizePayload(raw);
    if (!norm) return;
    if (norm.clientId && norm.clientId === CLIENT_INSTANCE_ID) return;
    if (norm.syncId) {
      lastKnownSyncId = norm.syncId;
    }
    onRemotePayload(norm);
  };

  // 1. BroadcastChannel listener (0ms, 0 bytes network bandwidth across tabs in same browser)
  const onBroadcastMessage = (event: MessageEvent) => {
    handleIncoming(event.data);
  };
  broadcastChannel?.addEventListener('message', onBroadcastMessage);

  // 2. window 'storage' event listener (cross-tab localStorage sync, 0 bytes network)
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

  // 3. Server-Sent Events (SSE) stream for instant push (with loop prevention for Serverless)
  const connectSSE = () => {
    if (isDisposed || typeof EventSource === 'undefined') return;
    try {
      eventSource = new EventSource('/api/operations/stream');
      eventSource.onmessage = (e) => {
        if (!e.data) return;
        sseFailures = 0;
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
        sseFailures++;
        // If SSE fails or closes (typical for Vercel serverless functions),
        // do NOT loop reconnect every 4s, which wastes bandwidth.
        if (!isDisposed && sseFailures <= 2) {
          reconnectTimer = setTimeout(connectSSE, 25000);
        }
      };
    } catch {
      // Fallback
    }
  };
  connectSSE();

  // 4. Ultra-lightweight check: ONLY downloads the full database if revision/syncId changed
  const syncFromServer = async () => {
    if (isDisposed || isChecking) return;
    isChecking = true;
    try {
      const seqBeforeFetch = latestSaveSequence;
      // Step A: Fast ~70 bytes metadata check (or HTTP 304 with 0 bytes)
      const checkRes = await checkServerSync(lastKnownSyncId);
      if (isDisposed || seqBeforeFetch !== latestSaveSequence) return;

      // If nothing changed on the server, DO NOT download the full operations list!
      if (!checkRes || !checkRes.hasChanges) {
        return;
      }

      // Step B: Only when a real change was detected from another device, fetch the full payload
      const serverPayload = await loadFromServer(lastKnownSyncId);
      if (isDisposed || seqBeforeFetch !== latestSaveSequence) return;
      if (serverPayload) {
        handleIncoming(serverPayload);
      }
    } finally {
      isChecking = false;
    }
  };

  // Poll only every 30 seconds when the tab is active/visible (costs ~70 bytes per check instead of 1.5MB every 2s)
  const pollInterval = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      void syncFromServer();
    }
  }, 30000);

  // When user returns to tab (focus / visible), trigger lightweight check
  const onFocusOrVisible = () => {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      if (focusDebounce) clearTimeout(focusDebounce);
      focusDebounce = setTimeout(() => {
        void syncFromServer();
      }, 300);
    }
  };
  window.addEventListener('focus', onFocusOrVisible);
  document.addEventListener('visibilitychange', onFocusOrVisible);

  // 5. Supabase Realtime channel (instant live push across devices without backend)
  let unsubscribeSupabase: (() => void) | null = null;
  if (isSupabaseConfigured()) {
    unsubscribeSupabase = subscribeToSupabaseRealtime((supaPayload) => {
      handleIncoming(supaPayload);
    });
  }

  return () => {
    isDisposed = true;
    broadcastChannel?.removeEventListener('message', onBroadcastMessage);
    window.removeEventListener('storage', onStorageEvent);
    window.removeEventListener('focus', onFocusOrVisible);
    document.removeEventListener('visibilitychange', onFocusOrVisible);
    clearInterval(pollInterval);
    if (focusDebounce) clearTimeout(focusDebounce);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    eventSource?.close();
    unsubscribeSupabase?.();
  };
}
