import { isDeepStrictEqual } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Prisma } from '@prisma/client';
import prisma from '../src/lib/prisma.js';
import { decryptMedicalHistory, encryptMedicalHistory } from '../src/lib/phi.js';

const ENVELOPE_KEY = '__dentvisionEncryptedV1';
type Target = 'staging' | 'production';
type Options = { apply: boolean; target: Target | null; batchSize: number };
type Row = { id: string; medicalHistory: Prisma.JsonValue | null };
type Counts = { scanned: number; plaintext: number; envelope: number; legacyCiphertext: number; nullValues: number };
const DEFAULT_BATCH_SIZE = 250;
const MAX_BATCH_SIZE = 1000;

export function parseBackfillOptions(args: string[], env: NodeJS.ProcessEnv): Options {
  const read = (key: string) => args.find((value) => value.startsWith(key + '='))?.slice(key.length + 1);
  const rawBatchSize = read('--batch-size');
  const batchSize = rawBatchSize === undefined ? DEFAULT_BATCH_SIZE : Number(rawBatchSize);
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH_SIZE) {
    throw new Error('Invalid --batch-size (expected 1..1000)');
  }
  if (!args.includes('--apply')) return { apply: false, target: null, batchSize };

  const target = read('--target');
  if (target !== 'staging' && target !== 'production') {
    throw new Error('Write mode requires --target=staging or --target=production');
  }
  if (read('--confirm-target') !== target) throw new Error('--confirm-target must match --target');
  if (env.MEDICAL_HISTORY_BACKFILL_TARGET !== target) {
    throw new Error('MEDICAL_HISTORY_BACKFILL_TARGET must match the confirmed target');
  }
  if (target === 'production' &&
      (!args.includes('--allow-production') ||
       read('--confirm-production-write') !== 'I_HAVE_BACKUP_AND_APPROVAL')) {
    throw new Error('Production write also requires --allow-production and --confirm-production-write=I_HAVE_BACKUP_AND_APPROVAL');
  }
  return { apply: true, target, batchSize };
}

export function classifyMedicalHistory(value: unknown): 'null' | 'plaintext' | 'envelope' | 'legacy-ciphertext' {
  if (value == null) return 'null';
  if (typeof value === 'object' && !Array.isArray(value)) {
    const payload = (value as Record<string, unknown>)[ENVELOPE_KEY];
    if (typeof payload === 'string' && payload.startsWith('ENC:')) return 'envelope';
  }
  if (typeof value === 'string' && value.startsWith('ENC:')) return 'legacy-ciphertext';
  return 'plaintext';
}

function json(value: unknown): string {
  const result = JSON.stringify(value);
  if (result === undefined) throw new Error('A medical-history value is not JSON serializable');
  return result;
}

function assertKeyAndRoundTrip(): void {
  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 32) {
    throw new Error('ENCRYPTION_KEY must be configured (minimum 32 characters)');
  }
  const sentinel = { _backfillCheck: true, nested: ['medical-history-key-check'] };
  const encrypted = encryptMedicalHistory(sentinel);
  if (classifyMedicalHistory(encrypted) !== 'envelope' ||
      !isDeepStrictEqual(decryptMedicalHistory(encrypted), sentinel)) {
    throw new Error('Medical-history encryption round-trip check failed');
  }
}

async function* batches(batchSize: number): AsyncGenerator<Row[]> {
  let cursor: string | undefined;
  for (;;) {
    const rows: Row[] = await prisma.patient.findMany({
      ...(cursor ? { where: { id: { gt: cursor } } } : {}),
      orderBy: { id: 'asc' },
      take: batchSize,
      select: { id: true, medicalHistory: true },
    });
    if (!rows.length) return;
    yield rows;
    cursor = rows[rows.length - 1].id;
    if (rows.length < batchSize) return;
  }
}

function newCounts(): Counts {
  return { scanned: 0, plaintext: 0, envelope: 0, legacyCiphertext: 0, nullValues: 0 };
}

async function preflight(batchSize: number): Promise<Counts> {
  const counts = newCounts();
  for await (const rows of batches(batchSize)) {
    for (const row of rows) {
      counts.scanned += 1;
      const kind = classifyMedicalHistory(row.medicalHistory);
      if (kind === 'null') { counts.nullValues += 1; continue; }
      if (kind === 'envelope') {
        decryptMedicalHistory(row.medicalHistory);
        counts.envelope += 1;
        continue;
      }
      if (kind === 'legacy-ciphertext') {
        decryptMedicalHistory(row.medicalHistory);
        counts.legacyCiphertext += 1;
        continue;
      }
      const encrypted = encryptMedicalHistory(row.medicalHistory);
      if (classifyMedicalHistory(encrypted) !== 'envelope' ||
          !isDeepStrictEqual(decryptMedicalHistory(encrypted), row.medicalHistory)) {
        throw new Error('A history value failed encryption round-trip validation');
      }
      counts.plaintext += 1;
    }
  }
  return counts;
}

async function applyBackfill(batchSize: number): Promise<number> {
  let updated = 0;
  let scanned = 0;
  for await (const rows of batches(batchSize)) {
    for (const row of rows) {
      scanned += 1;
      if (classifyMedicalHistory(row.medicalHistory) !== 'plaintext') continue;
      const encrypted = encryptMedicalHistory(row.medicalHistory);
      if (classifyMedicalHistory(encrypted) !== 'envelope' ||
          !isDeepStrictEqual(decryptMedicalHistory(encrypted), row.medicalHistory)) {
        throw new Error('A history value failed validation during write pass');
      }
      const originalJson = json(row.medicalHistory);
      const encryptedJson = json(encrypted);
      const changed = await prisma.$executeRaw`
        UPDATE "patients"
        SET "medicalHistory" = ${encryptedJson}::jsonb,
            "updatedAt" = NOW()
        WHERE "id" = ${row.id}
          AND "medicalHistory" = ${originalJson}::jsonb
      `;
      if (changed !== 1) {
        throw new Error('Concurrent history change detected; no further rows were written. Review and rerun from the start.');
      }
      updated += 1;
    }
    console.log('[medical-history-backfill] progress scanned=' + scanned + ' encrypted=' + updated);
  }
  return updated;
}

async function main(): Promise<void> {
  const options = parseBackfillOptions(process.argv.slice(2), process.env);
  assertKeyAndRoundTrip();
  console.log('[medical-history-backfill] mode=' + (options.apply ? 'APPLY' : 'DRY-RUN') +
    ' batchSize=' + options.batchSize + (options.target ? ' target=' + options.target : ''));
  console.log('[medical-history-backfill] full preflight started; no patient content or identifiers are logged');
  const counts = await preflight(options.batchSize);
  console.log('[medical-history-backfill] preflight scanned=' + counts.scanned +
    ' plaintext=' + counts.plaintext + ' envelope=' + counts.envelope +
    ' legacyCiphertext=' + counts.legacyCiphertext + ' null=' + counts.nullValues);
  if (!options.apply) {
    console.log('[medical-history-backfill] dry run complete; no rows changed');
    return;
  }
  console.log('[medical-history-backfill] starting write pass after successful preflight');
  const updated = await applyBackfill(options.batchSize);
  console.log('[medical-history-backfill] complete updated=' + updated +
    '; rerunning is safe because encrypted values are skipped');
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  main()
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'unknown error';
      console.error('[medical-history-backfill] ABORTED: ' + message.slice(0, 400));
      process.exitCode = 1;
    })
    .finally(async () => { await prisma.$disconnect().catch(() => {}); });
}
