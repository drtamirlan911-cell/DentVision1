#!/usr/bin/env node
/**
 * After prisma is installed, wrap node_modules/.bin/prisma so
 * `--accept-data-loss` is always stripped (Render Dashboard still passes it).
 */
const fs = require('node:fs');
const path = require('node:path');

const binDir = path.resolve(__dirname, '../node_modules/.bin');
const prismaBin = path.join(binDir, 'prisma');
const prismaReal = path.join(binDir, 'prisma.real');
const wrapperSrc = path.resolve(__dirname, 'safe-prisma.sh');

if (!fs.existsSync(prismaBin) && !fs.existsSync(prismaReal)) {
  console.warn('[safe-prisma] skip: prisma bin missing');
  process.exit(0);
}

if (fs.existsSync(prismaBin) && !fs.existsSync(prismaReal)) {
  fs.renameSync(prismaBin, prismaReal);
}

fs.copyFileSync(wrapperSrc, prismaBin);
fs.chmodSync(prismaBin, 0o755);
console.log('[safe-prisma] installed wrapper (strips --accept-data-loss)');
