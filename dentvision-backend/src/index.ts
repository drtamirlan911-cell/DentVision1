/**
 * Render dashboard still runs:
 *   cd dentvision-backend && npx tsx src/index.ts
 *
 * The real production API lives in /server (CRM, School, AI, Jobs…).
 * This file is a thin launcher so existing Build/Start settings keep working.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const serverDir = path.join(repoRoot, 'server');
const serverEntry = path.join(serverDir, 'index.js');

if (!fs.existsSync(serverEntry)) {
  console.error('[BOOT] Missing server entry:', serverEntry);
  process.exit(1);
}

console.log('[BOOT] Launching DentVision API from /server');
console.log('[BOOT] entry:', serverEntry);

const child = spawn(process.execPath, [serverEntry], {
  cwd: serverDir,
  env: process.env,
  stdio: 'inherit',
});

const shutdown = (signal: NodeJS.Signals) => {
  if (!child.killed) child.kill(signal);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

child.on('exit', (code, signal) => {
  if (signal) {
    console.log(`[BOOT] server exited via ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
