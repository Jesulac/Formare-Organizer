import 'dotenv/config';
import express, { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { processVoiceOperationRequest } from './src/server/voiceAiService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'operations-db.json');
const DB_TMP_FILE = path.join(DATA_DIR, 'operations-db.json.tmp');

interface ServerPersistedState {
  version: number;
  revision: number;
  updatedAt: number;
  syncId: string;
  clientId?: string;
  operations: any[] | null;
  filamentAdjustments: Record<string, number>;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadStateFromDisk(): ServerPersistedState {
  try {
    ensureDataDir();
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && Array.isArray(parsed.operations)) {
        const revision =
          typeof parsed.revision === 'number' && parsed.revision >= 1 ? parsed.revision : 2;
        const updatedAt =
          typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now();
        const clientId = parsed.clientId || 'server-persisted';
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
    }
  } catch (err) {
    console.error('Error reading operations DB from disk:', err);
  }
  return {
    version: 6,
    revision: 1,
    updatedAt: 1,
    syncId: '1-1-server-init',
    clientId: 'server-init',
    operations: null,
    filamentAdjustments: {},
  };
}

let currentServerState: ServerPersistedState = loadStateFromDisk();
const sseClients = new Set<Response>();

function saveStateToDisk(state: ServerPersistedState) {
  try {
    ensureDataDir();
    const serialized = JSON.stringify(state, null, 2);
    fs.writeFileSync(DB_TMP_FILE, serialized, 'utf-8');
    fs.renameSync(DB_TMP_FILE, DB_FILE);
  } catch (err) {
    console.error('Error writing operations DB to disk:', err);
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
    } catch (fallbackErr) {
      console.error('Fallback write error:', fallbackErr);
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

  // API: Voice-to-Operation AI extraction using Gemini 3 Flash Live
  app.post('/api/ai/voice-operation', async (req, res) => {
    try {
      const { audioBase64, transcriptText = '' } = req.body || {};
      if (!audioBase64 && !String(transcriptText).trim()) {
        return res.status(400).json({
          error: 'No se recibió audio ni texto para procesar.',
        });
      }

      const result = await processVoiceOperationRequest(req.body || {});
      return res.json(result);
    } catch (err: any) {
      console.error('Error in /api/ai/voice-operation:', err);
      return res.status(500).json({
        error:
          err?.message ||
          'No se pudo procesar el dictado por voz en este momento. Inténtalo de nuevo.',
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
