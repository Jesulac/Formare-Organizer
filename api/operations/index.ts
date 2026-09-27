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
  clientId?: string;
  operations: any[] | null;
  filamentAdjustments: Record<string, number>;
}

const TMP_DB_FILE = path.join(os.tmpdir(), 'formare3d-operations-db.json');
const REPO_DB_FILE = path.join(process.cwd(), 'data', 'operations-db.json');

function loadServerlessState(): ServerPersistedState {
  const g = globalThis as any;
  if (g.__FORMARE3D_STATE__ && Array.isArray(g.__FORMARE3D_STATE__.operations)) {
    return g.__FORMARE3D_STATE__;
  }

  const candidateFiles = [TMP_DB_FILE, REPO_DB_FILE];
  for (const file of candidateFiles) {
    try {
      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.operations)) {
          const state: ServerPersistedState = {
            version: 5,
            revision: typeof parsed.revision === 'number' && parsed.revision >= 1 ? parsed.revision : 1,
            updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 1,
            clientId: parsed.clientId || 'server-init',
            operations: parsed.operations,
            filamentAdjustments:
              parsed.filamentAdjustments && typeof parsed.filamentAdjustments === 'object'
                ? parsed.filamentAdjustments
                : {},
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
    version: 5,
    revision: 1,
    updatedAt: 1,
    clientId: 'server-init',
    operations: null,
    filamentAdjustments: {},
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
    // Ignore read-only fs errors in serverless environments
  }
}

export default function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const state = loadServerlessState();
    return res.status(200).json(state);
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const {
        operations,
        filamentAdjustments = {},
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
      const updatedAt = Date.now();

      const nextState: ServerPersistedState = {
        version: 5,
        revision: nextRevision,
        updatedAt,
        clientId,
        operations,
        filamentAdjustments:
          filamentAdjustments && typeof filamentAdjustments === 'object'
            ? filamentAdjustments
            : {},
      };

      saveServerlessState(nextState);

      return res.status(200).json({
        ok: true,
        revision: nextRevision,
        updatedAt,
        clientId,
      });
    } catch (err) {
      console.error('Error in Vercel POST /api/operations:', err);
      return res.status(500).json({ error: 'Failed to save operations' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
