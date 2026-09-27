import fs from 'fs';
import os from 'os';
import path from 'path';

const TMP_DB_FILE = path.join(os.tmpdir(), 'formare3d-operations-db.json');
const REPO_DB_FILE = path.join(process.cwd(), 'data', 'operations-db.json');

export default function handler(_req: any, res: any) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');

  const g = globalThis as any;
  let state = g.__FORMARE3D_STATE__;

  if (!state) {
    for (const file of [TMP_DB_FILE, REPO_DB_FILE]) {
      try {
        if (fs.existsSync(file)) {
          const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
          if (parsed && Array.isArray(parsed.operations)) {
            state = {
              version: 5,
              revision: typeof parsed.revision === 'number' && parsed.revision >= 1 ? parsed.revision : 1,
              updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 1,
              clientId: parsed.clientId || 'server-init',
              operations: parsed.operations,
              filamentAdjustments: parsed.filamentAdjustments || {},
            };
            g.__FORMARE3D_STATE__ = state;
            break;
          }
        }
      } catch {
        // Ignore
      }
    }
  }

  if (state && Array.isArray(state.operations)) {
    res.write(`data: ${JSON.stringify(state)}\n\n`);
  } else {
    res.write(`: connected\n\n`);
  }

  res.end();
}
