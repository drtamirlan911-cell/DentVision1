import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import prisma from '../src/lib/prisma.js';
import { decryptAiAdminText, encryptAiAdminText, hashAiAdminExternalUserId } from '../src/modules/ai-admin/conversation/phi.js';

type Target = 'staging' | 'production';
type Options = { apply: boolean; target: Target | null; batchSize: number };
type Row = { id: string; clinicId: string; channel: string; externalUserId: string | null; externalUserIdCiphertext: string | null; externalUserIdHash: string | null };
type Prepared = { ciphertext: string; hash: string };
const DEFAULT_BATCH_SIZE = 250;
const MAX_BATCH_SIZE = 1000;
function logInfo(message: string): void { process.stdout.write(message + '\n'); }

export function parseAiAdminExternalIdBackfillOptions(args: string[], env: NodeJS.ProcessEnv): Options {
  const read = (key: string) => args.find((value) => value.startsWith(key + '='))?.slice(key.length + 1);
  const rawBatchSize = read('--batch-size');
  const batchSize = rawBatchSize === undefined ? DEFAULT_BATCH_SIZE : Number(rawBatchSize);
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH_SIZE) throw new Error('Invalid --batch-size (expected 1..1000)');
  if (!args.includes('--apply')) return { apply: false, target: null, batchSize };
  const target = read('--target');
  if (target !== 'staging' && target !== 'production') throw new Error('Write mode requires --target=staging or --target=production');
  if (read('--confirm-target') !== target) throw new Error('--confirm-target must match --target');
  if (env.AI_ADMIN_EXTERNAL_ID_BACKFILL_TARGET !== target) throw new Error('AI_ADMIN_EXTERNAL_ID_BACKFILL_TARGET must match the confirmed target');
  if (target === 'production' && (!args.includes('--allow-production') || read('--confirm-production-write') !== 'I_HAVE_BACKUP_AND_APPROVAL')) {
    throw new Error('Production write also requires --allow-production and --confirm-production-write=I_HAVE_BACKUP_AND_APPROVAL');
  }
  return { apply: true, target, batchSize };
}

export function prepareAiAdminExternalIdBackfillRow(row: Row): Prepared {
  if (!row.externalUserId) throw new Error('Missing legacy external identifier; refusing to guess an identity');
  const hash = hashAiAdminExternalUserId({ clinicId: row.clinicId, channel: row.channel, externalUserId: row.externalUserId });
  if (row.externalUserIdHash && row.externalUserIdHash !== hash) throw new Error('Existing external identifier blind index does not match the legacy value');
  const ciphertext = row.externalUserIdCiphertext ?? encryptAiAdminText(row.externalUserId);
  if (decryptAiAdminText(ciphertext) !== row.externalUserId) throw new Error('External identifier ciphertext failed round-trip validation');
  return { ciphertext, hash };
}

async function fetchBatch(batchSize: number, cursorId?: string): Promise<Row[]> {
  return prisma.aiAdminSession.findMany({
    where: { externalUserId: { not: null } },
    select: { id: true, clinicId: true, channel: true, externalUserId: true, externalUserIdCiphertext: true, externalUserIdHash: true },
    orderBy: { id: 'asc' }, take: batchSize,
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
  }) as Promise<Row[]>;
}

async function preflight(batchSize: number): Promise<{ scanned: number; ready: number }> {
  let cursorId: string | undefined;
  let scanned = 0;
  while (true) {
    const rows = await fetchBatch(batchSize, cursorId);
    if (!rows.length) break;
    for (const row of rows) { prepareAiAdminExternalIdBackfillRow(row); scanned += 1; }
    cursorId = rows[rows.length - 1].id;
    if (rows.length < batchSize) break;
  }
  return { scanned, ready: scanned };
}

async function applyBackfill(batchSize: number): Promise<number> {
  let cursorId: string | undefined;
  let scanned = 0;
  let updated = 0;
  while (true) {
    const rows = await fetchBatch(batchSize, cursorId);
    if (!rows.length) break;
    for (const row of rows) {
      scanned += 1;
      const prepared = prepareAiAdminExternalIdBackfillRow(row);
      const changed = await prisma.aiAdminSession.updateMany({
        where: { id: row.id, externalUserId: row.externalUserId, externalUserIdCiphertext: row.externalUserIdCiphertext, externalUserIdHash: row.externalUserIdHash },
        data: { externalUserId: null, externalUserIdCiphertext: prepared.ciphertext, externalUserIdHash: prepared.hash },
      });
      if (changed.count !== 1) {
        const winner = await prisma.aiAdminSession.findFirst({
          where: { id: row.id, externalUserId: null, externalUserIdCiphertext: { not: null }, externalUserIdHash: prepared.hash },
          select: { id: true },
        });
        if (!winner) throw new Error('Concurrent external-identity change detected; stopped before processing more rows');
        continue;
      }
      updated += 1;
    }
    cursorId = rows[rows.length - 1].id;
    logInfo('[ai-admin-external-id-backfill] progress scanned=' + scanned + ' updated=' + updated);
    if (rows.length < batchSize) break;
  }
  return updated;
}

function assertKeyAndRoundTrip(): void {
  const sample = 'ai-admin-external-id-backfill-check';
  if (decryptAiAdminText(encryptAiAdminText(sample)) !== sample) throw new Error('AI Admin external-identity encryption key failed round-trip validation');
}

async function main(): Promise<void> {
  const options = parseAiAdminExternalIdBackfillOptions(process.argv.slice(2), process.env);
  assertKeyAndRoundTrip();
  logInfo('[ai-admin-external-id-backfill] mode=' + (options.apply ? 'APPLY' : 'DRY-RUN') + ' batchSize=' + options.batchSize + (options.target ? ' target=' + options.target : ''));
  logInfo('[ai-admin-external-id-backfill] preflight started; no contact identifiers are logged');
  const counts = await preflight(options.batchSize);
  logInfo('[ai-admin-external-id-backfill] preflight scanned=' + counts.scanned + ' ready=' + counts.ready);
  if (!options.apply) { logInfo('[ai-admin-external-id-backfill] dry-run complete; no rows were changed'); return; }
  logInfo('[ai-admin-external-id-backfill] complete updated=' + await applyBackfill(options.batchSize));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    const kind = error instanceof Error ? error.name : 'NonError';
    console.error('[ai-admin-external-id-backfill] failed (' + kind + '); no contact identifiers were logged');
    process.exitCode = 1;
  }).finally(async () => { await prisma.$disconnect(); });
}
