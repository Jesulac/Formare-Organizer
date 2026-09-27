import 'dotenv/config';
import express, { Response } from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { processVoiceOperationRequest } from './src/server/voiceAiService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const SEED_DB_FILE = path.join(DATA_DIR, 'operations-db.json');
const RUNTIME_DB_FILE = path.join(os.tmpdir(), 'formare3d-operations-runtime-v6.json');
const RUNTIME_TMP_FILE = path.join(os.tmpdir(), 'formare3d-operations-runtime-v6.json.tmp');

interface ServerPersistedState {
  version: number;
  revision: number;
  updatedAt: number;
  syncId: string;
  clientId?: string;
  operations: any[] | null;
  filamentAdjustments: Record<string, number>;
  deletedOperationIds?: string[];
}

function loadStateFromDisk(): ServerPersistedState {
  // 1. Check runtime file in tmpdir (live session edits outside git-tracked repo)
  try {
    if (fs.existsSync(RUNTIME_DB_FILE)) {
      const content = fs.readFileSync(RUNTIME_DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && Array.isArray(parsed.operations)) {
        const revision =
          typeof parsed.revision === 'number' && parsed.revision >= 1 ? parsed.revision : 1;
        const updatedAt =
          typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 1;
        const clientId = parsed.clientId || 'server-init';
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
          deletedOperationIds: Array.isArray(parsed.deletedOperationIds)
            ? parsed.deletedOperationIds
            : [],
        };
      }
    }
  } catch (err) {
    console.error('Error reading runtime operations DB:', err);
  }

  // 2. Fallback to read-only repository seed (always marked as server-init so browser data takes precedence)
  try {
    if (fs.existsSync(SEED_DB_FILE)) {
      const content = fs.readFileSync(SEED_DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && Array.isArray(parsed.operations)) {
        return {
          version: 6,
          revision: 1,
          updatedAt: 1,
          syncId: '1-1-server-init',
          clientId: 'server-init',
          operations: parsed.operations,
          filamentAdjustments:
            parsed.filamentAdjustments && typeof parsed.filamentAdjustments === 'object'
              ? parsed.filamentAdjustments
              : {},
          deletedOperationIds: [],
        };
      }
    }
  } catch (err) {
    console.error('Error reading seed operations DB:', err);
  }

  return {
    version: 6,
    revision: 1,
    updatedAt: 1,
    syncId: '1-1-server-init',
    clientId: 'server-init',
    operations: null,
    filamentAdjustments: {},
    deletedOperationIds: [],
  };
}

let currentServerState: ServerPersistedState = loadStateFromDisk();
const sseClients = new Set<Response>();

function saveStateToDisk(state: ServerPersistedState) {
  try {
    const serialized = JSON.stringify(state, null, 2);
    fs.writeFileSync(RUNTIME_TMP_FILE, serialized, 'utf-8');
    fs.renameSync(RUNTIME_TMP_FILE, RUNTIME_DB_FILE);
  } catch (err) {
    console.error('Error writing runtime operations DB:', err);
    try {
      fs.writeFileSync(RUNTIME_DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
    } catch (fallbackErr) {
      console.error('Fallback runtime write error:', fallbackErr);
    }
  }
}

function broadcastStateToClients(state: ServerPersistedState) {
  const payloadStr = `data: ${JSON.stringify(state)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payloadStr);
    } catch {
      sseClients.delete(client);
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Real-time Server-Sent Events (SSE) stream for instant multi-tab / multi-device sync
  app.get('/api/operations/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    sseClients.add(res);

    if (currentServerState.operations) {
      res.write(`data: ${JSON.stringify(currentServerState)}\n\n`);
    }

    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(res);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  // API: Get persisted operations (also supports ?stream=1)
  app.get('/api/operations', (req, res) => {
    if (req.query?.stream === '1') {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      if (currentServerState.operations) {
        res.write(`data: ${JSON.stringify(currentServerState)}\n\n`);
      }
      return res.end();
    }

    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      return res.json(currentServerState);
    } catch (err) {
      console.error('Error reading operations DB:', err);
      return res.status(500).json({ error: 'Failed to read operations' });
    }
  });

  // API: Save persisted operations and broadcast in real time
  app.post('/api/operations', (req, res) => {
    try {
      const {
        operations,
        filamentAdjustments = {},
        deletedOperationIds = [],
        revision: incomingRevision = 1,
        clientId = 'unknown',
      } = req.body || {};

      if (!Array.isArray(operations)) {
        return res.status(400).json({ error: 'operations must be an array' });
      }

      const nextRevision = Math.max(
        (currentServerState.revision || 1) + 1,
        typeof incomingRevision === 'number' ? incomingRevision : 2
      );
      const updatedAt = Math.max(Date.now(), (currentServerState.updatedAt || 1) + 1);
      const syncId = `${nextRevision}-${updatedAt}-${clientId}`;

      const mergedDeleted = Array.from(
        new Set([
          ...(Array.isArray(currentServerState.deletedOperationIds)
            ? currentServerState.deletedOperationIds
            : []),
          ...(Array.isArray(deletedOperationIds) ? deletedOperationIds : []),
        ])
      );

      currentServerState = {
        version: 6,
        revision: nextRevision,
        updatedAt,
        syncId,
        clientId,
        operations,
        filamentAdjustments:
          filamentAdjustments && typeof filamentAdjustments === 'object'
            ? filamentAdjustments
            : {},
        deletedOperationIds: mergedDeleted,
      };

      saveStateToDisk(currentServerState);
      broadcastStateToClients(currentServerState);

      res.setHeader('Cache-Control', 'no-store');
      return res.json({
        ok: true,
        revision: nextRevision,
        updatedAt,
        syncId,
        clientId,
      });
    } catch (err) {
      console.error('Error writing operations DB:', err);
      return res.status(500).json({ error: 'Failed to save operations' });
    }
  });

  // API: AI text-to-operation extraction
  app.post('/api/ai/voice-operation', async (req, res) => {
    try {
      const { text = '', transcriptText = '' } = req.body || {};
      if (!String(text || transcriptText).trim()) {
        return res.status(400).json({
          error: 'Escribe los datos de la operación para procesarlos con IA.',
        });
      }

      const result = await processVoiceOperationRequest(req.body || {});
      return res.json(result);
    } catch (err: any) {
      console.error('Error in /api/ai/voice-operation:', err);
      return res.status(500).json({
        error:
          err?.message ||
          'No se pudo procesar el texto con Inteligencia Artificial en este momento.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Formare 3D server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
