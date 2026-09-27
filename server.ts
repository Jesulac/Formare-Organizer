import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'operations-db.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API: Get persisted operations
  app.get('/api/operations', (_req, res) => {
    try {
      ensureDataDir();
      if (fs.existsSync(DB_FILE)) {
        const content = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(content);
        res.setHeader('Cache-Control', 'no-store');
        return res.json(parsed);
      }
      return res.json({ version: 3, updatedAt: 0, operations: null });
    } catch (err) {
      console.error('Error reading operations DB:', err);
      return res.status(500).json({ error: 'Failed to read operations' });
    }
  });

  // API: Save persisted operations
  app.post('/api/operations', (req, res) => {
    try {
      ensureDataDir();
      const {
        version = 3,
        updatedAt = Date.now(),
        operations,
        filamentAdjustments = {},
      } = req.body || {};
      if (!Array.isArray(operations)) {
        return res.status(400).json({ error: 'operations must be an array' });
      }
      const payload = { version, updatedAt, operations, filamentAdjustments };
      fs.writeFileSync(DB_FILE, JSON.stringify(payload, null, 2), 'utf-8');
      return res.json({ ok: true, updatedAt });
    } catch (err) {
      console.error('Error writing operations DB:', err);
      return res.status(500).json({ error: 'Failed to save operations' });
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
