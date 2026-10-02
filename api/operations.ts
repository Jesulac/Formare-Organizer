import fs from 'fs';
import os from 'os';
import path from 'path';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

interface ServerPersistedState {
  version: number;
  revision: number;
  updatedAt: number;
  syncId?: string;
  clientId?: string;
  operations: any[] | null;
  filamentAdjustments: Record<string, number>;
  deletedOperationIds?: string[];
}

const TMP_DB_FILE = path.join(os.tmpdir(), 'formare3d-operations-runtime-v6.json');
const REPO_DB_FILE = path.join(process.cwd(), 'data', 'operations-db.json');

function filterOutGhostOps(ops: any[], deletedIds: string[] = []): any[] {
  const delSet = new Set(deletedIds);
  return ops.filter((op) => {
    if (!op || typeof op !== 'object' || !op.id) return false;
    if (delSet.has(op.id)) return false;
    const prod = String(op.producto || '').toLowerCase().trim();
    if (
      prod.includes('pedido filamento pla azul (esun)') &&
      !String(op.id).startsWith('op-v7-')
    ) {
      return false;
    }
    return true;
  });
}

function loadServerlessState(): ServerPersistedState {
  const g = globalThis as any;
  if (g.__FORMARE3D_STATE__ && Array.isArray(g.__FORMARE3D_STATE__.operations)) {
    return g.__FORMARE3D_STATE__;
  }

  for (const file of [TMP_DB_FILE, REPO_DB_FILE]) {
    try {
      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.operations)) {
          const isTmp = file === TMP_DB_FILE;
          const rev =
            isTmp && typeof parsed.revision === 'number' && parsed.revision >= 1
              ? parsed.revision
              : 1;
          const updatedAt =
            isTmp && typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 1;
          const clientId = isTmp && parsed.clientId ? parsed.clientId : 'server-init';
          const delIds =
            isTmp && Array.isArray(parsed.deletedOperationIds)
              ? parsed.deletedOperationIds
              : [];
          const state: ServerPersistedState = {
            version: 6,
            revision: rev,
            updatedAt,
            syncId: isTmp && parsed.syncId ? parsed.syncId : `${rev}-${updatedAt}-${clientId}`,
            clientId,
            operations: filterOutGhostOps(parsed.operations, delIds),
            filamentAdjustments:
              parsed.filamentAdjustments && typeof parsed.filamentAdjustments === 'object'
                ? parsed.filamentAdjustments
                : {},
            deletedOperationIds: delIds,
          };
          g.__FORMARE3D_STATE__ = state;
          return state;
        }
      }
    } catch {
      // Try next file
    }
  }

  const fallback: ServerPersistedState = {
    version: 6,
    revision: 1,
    updatedAt: 1,
    syncId: '1-1-server-init',
    clientId: 'server-init',
    operations: null,
    filamentAdjustments: {},
    deletedOperationIds: [],
  };
  g.__FORMARE3D_STATE__ = fallback;
  return fallback;
}

function saveServerlessState(state: ServerPersistedState) {
  const g = globalThis as any;
  g.__FORMARE3D_STATE__ = state;
  try {
    fs.writeFileSync(TMP_DB_FILE, JSON.stringify(state), 'utf-8');
  } catch {
    // Ignore read-only fs errors
  }
}

export default function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).end();
  }

  const isStream =
    req.query?.stream === '1' ||
    (typeof req.url === 'string' && req.url.includes('/stream'));

  if (req.method === 'GET' && isStream) {
    // Vercel Serverless Functions do not support persistent streaming sockets.
    // Close cleanly without looping to protect Vercel Origin Transfer quota:
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'close');
    res.write(`: serverless-mode\n\n`);
    return res.end();
  }

  const state = loadServerlessState();
  const syncId = state.syncId || `${state.revision || 1}-${state.updatedAt || 1}`;
  const etag = `"${syncId}"`;
  res.setHeader('ETag', etag);

  const clientEtag = req.headers['if-none-match'];
  if (clientEtag && (clientEtag === etag || clientEtag === syncId)) {
    return res.status(304).end();
  }

  if (req.method === 'HEAD') {
    res.setHeader('Content-Length', '0');
    return res.status(200).end();
  }

  // Ultra-lightweight version check (~80 bytes) so clients don't download the whole DB
  if (req.query?.check === '1' || req.query?.version === '1') {
    res.setHeader('Cache-Control', 'private, no-cache');
    return res.status(200).json({
      version: state.version || 6,
      revision: state.revision || 1,
      updatedAt: state.updatedAt || 1,
      syncId,
      clientId: state.clientId || 'server',
      opCount: Array.isArray(state.operations) ? state.operations.length : 0,
    });
  }

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (req.method === 'GET') {
    return res.status(200).json(state);
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const {
        operations,
        filamentAdjustments = {},
        deletedOperationIds = [],
        revision: incomingRevision = 1,
        clientId = 'unknown',
      } = body;

      if (!Array.isArray(operations)) {
        return res.status(400).json({ error: 'operations must be an array' });
      }

      const current = loadServerlessState();
      const nextRevision = Math.max(
        (current.revision || 1) + 1,
        typeof incomingRevision === 'number' ? incomingRevision : 2
      );
      const updatedAt = Math.max(Date.now(), (current.updatedAt || 1) + 1);
      const syncId = `${nextRevision}-${updatedAt}-${clientId}`;

      const mergedDeleted = Array.from(
        new Set([
          ...(Array.isArray(current.deletedOperationIds) ? current.deletedOperationIds : []),
          ...(Array.isArray(deletedOperationIds) ? deletedOperationIds : []),
        ])
      );

      const existingMap = new Map<string, any>();
      if (Array.isArray(current.operations)) {
        for (const op of current.operations) {
          if (op && op.id) existingMap.set(op.id, op);
        }
      }

      const incomingCleaned = filterOutGhostOps(operations, mergedDeleted);
      const mergedOps = incomingCleaned.map((incOp) => {
        const prevOp = existingMap.get(incOp.id);
        if (!prevOp) return incOp;
        const incEdit = typeof incOp.editCount === 'number' ? incOp.editCount : 0;
        const prevEdit = typeof prevOp.editCount === 'number' ? prevOp.editCount : 0;
        const incUpd =
          typeof incOp.updatedAt === 'number' && incOp.updatedAt < 1799900000000
            ? incOp.updatedAt
            : 0;
        const prevUpd =
          typeof prevOp.updatedAt === 'number' && prevOp.updatedAt < 1799900000000
            ? prevOp.updatedAt
            : 0;

        const pickIncoming =
          incEdit !== prevEdit ? incEdit >= prevEdit : incUpd >= prevUpd;
        const winner = pickIncoming ? incOp : prevOp;
        const loser = pickIncoming ? prevOp : incOp;
        const restoredQr =
          winner.estado === 'Pendiente de cobro'
            ? undefined
            : winner.fotoQr || loser.fotoQr;
        return {
          ...winner,
          fotoQr: restoredQr,
        };
      });

      const nextState: ServerPersistedState = {
        version: 6,
        revision: nextRevision,
        updatedAt,
        syncId,
        clientId,
        operations: mergedOps,
        filamentAdjustments:
          filamentAdjustments && typeof filamentAdjustments === 'object'
            ? filamentAdjustments
            : {},
        deletedOperationIds: mergedDeleted,
      };

      saveServerlessState(nextState);

      return res.status(200).json({
        ok: true,
        revision: nextRevision,
        updatedAt,
        syncId,
        clientId,
      });
    } catch (err) {
      console.error('Error in Vercel POST /api/operations:', err);
      return res.status(500).json({ error: 'Failed to save operations' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
