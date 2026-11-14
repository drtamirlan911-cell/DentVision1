import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import prisma from '../src/lib/prisma.js';
import { decryptAiAdminJson, decryptAiAdminText, encryptAiAdminJson, encryptAiAdminText, getAiAdminExternalUserIdHashes, hashAiAdminExternalUserId, isAiAdminTextEncryptedWithActiveKey } from '../src/modules/ai-admin/conversation/phi.js';

type Target = 'staging' | 'production';
type Options = { apply: boolean; target: Target | null; batchSize: number };
type Row = {
  id: string; clinicId: string; channel: string;
  externalUserId: string | null; externalUserIdCiphertext: string | null; externalUserIdHash: string | null;
  patientName: string | null; patientPhone: string | null;
  patientNameCiphertext: string | null; patientPhoneCiphertext: string | null;
};
type Prepared = {
  externalUserIdCiphertext: string | null; externalUserIdHash: string | null;
  patientNameCiphertext: string | null; patientPhoneCiphertext: string | null;
};
type MessageRow = { id: string; content: string; toolResult: unknown };
type EscalationRow = { id: string; reason: string; lastUserMessage: string };
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
  if (env.AI_ADMIN_EXTERNAL_ID_STRICT_WRITE !== 'true') throw new Error('Backfill writes require AI_ADMIN_EXTERNAL_ID_STRICT_WRITE=true after the compatibility rollout');
  if (env.AI_ADMIN_EXTERNAL_ID_LEGACY_WORKERS_DRAINED !== 'I_HAVE_DRAINED_ALL_LEGACY_WORKERS') {
    throw new Error('Backfill writes require explicit confirmation that all legacy workers are drained');
  }

  // Bind the operator target confirmation to Prisma's actual datasource URL.
  // Never log either URL: both may contain database credentials.
  const expectedDatabaseUrlEnv = target === 'staging'
    ? 'AI_ADMIN_EXTERNAL_ID_BACKFILL_STAGING_DATABASE_URL'
    : 'AI_ADMIN_EXTERNAL_ID_BACKFILL_PRODUCTION_DATABASE_URL';
  const actualDatabaseUrl = env.DATABASE_URL?.trim();
  const expectedDatabaseUrl = env[expectedDatabaseUrlEnv]?.trim();
  if (!actualDatabaseUrl || !expectedDatabaseUrl) {
    throw new Error('Write mode requires DATABASE_URL and ' + expectedDatabaseUrlEnv);
  }
  if (actualDatabaseUrl !== expectedDatabaseUrl) {
    throw new Error('DATABASE_URL does not match the configured ' + target + ' backfill database');
  }

  return { apply: true, target, batchSize };
}

function encryptAndVerify(value: string | null, existing: string | null, label: string): string | null {
  if (!existing && (value === null || value === '')) return null;
  const plaintext = existing ? decryptAiAdminText(existing) : value!;
  if (value !== null && value !== '' && plaintext !== value) {
    throw new Error(label + ' ciphertext does not match the legacy value');
  }
  const ciphertext = existing && isAiAdminTextEncryptedWithActiveKey(existing)
    ? existing
    : encryptAiAdminText(plaintext);
  if (decryptAiAdminText(ciphertext) !== plaintext) {
    throw new Error(label + ' ciphertext failed round-trip validation');
  }
  return ciphertext;
}

function reencryptStoredText(value: string, label: string): string {
  const plaintext = value.startsWith('ENC:') ? decryptAiAdminText(value) : value;
  const ciphertext = isAiAdminTextEncryptedWithActiveKey(value) ? value : encryptAiAdminText(plaintext);
  if (decryptAiAdminText(ciphertext) !== plaintext) throw new Error(label + ' failed key-rotation round-trip validation');
  return ciphertext;
}

function reencryptStoredJson(value: unknown, label: string): unknown {
  if (value === null || value === undefined) return value;
  const plaintext = decryptAiAdminJson(value);
  const ciphertext = typeof value === 'string' && isAiAdminTextEncryptedWithActiveKey(value)
    ? value
    : encryptAiAdminJson(plaintext);
  const verified = decryptAiAdminJson(ciphertext);
  if (JSON.stringify(verified) !== JSON.stringify(plaintext)) {
    throw new Error(label + ' failed key-rotation round-trip validation');
  }
  return ciphertext;
}

export function prepareAiAdminMessageBackfillRow(row: MessageRow): { content: string; toolResult: unknown } {
  return {
    content: reencryptStoredText(row.content, 'AI Admin message content'),
    toolResult: reencryptStoredJson(row.toolResult, 'AI Admin tool result'),
  };
}

export function prepareAiAdminEscalationBackfillRow(row: EscalationRow): { reason: string; lastUserMessage: string } {
  return {
    reason: reencryptStoredText(row.reason, 'AI Admin escalation reason'),
    lastUserMessage: reencryptStoredText(row.lastUserMessage, 'AI Admin escalation last user message'),
  };
}

export function prepareAiAdminExternalIdBackfillRow(row: Row): Prepared {
  const decryptedExternalUserId = row.externalUserIdCiphertext
    ? decryptAiAdminText(row.externalUserIdCiphertext)
    : null;
  const externalUserId = row.externalUserId?.trim() || decryptedExternalUserId?.trim() || null;
  const externalIdentity = externalUserId
    ? { clinicId: row.clinicId, channel: row.channel, externalUserId }
    : null;
  const externalUserIdHash = externalIdentity
    ? hashAiAdminExternalUserId(externalIdentity)
    : row.externalUserIdHash;

  if (row.externalUserIdHash && externalIdentity) {
    const readableHashes = getAiAdminExternalUserIdHashes(externalIdentity);
    if (!readableHashes.includes(row.externalUserIdHash)) {
      throw new Error('Existing external identifier blind index does not match the readable keyring');
    }
  }
  if (!externalUserId && Boolean(row.externalUserIdCiphertext) !== Boolean(row.externalUserIdHash)) {
    throw new Error('External identifier ciphertext/index pair is incomplete');
  }

  const externalUserIdCiphertext = encryptAndVerify(externalUserId, row.externalUserIdCiphertext, 'External identifier');
  const patientNameCiphertext = encryptAndVerify(row.patientName, row.patientNameCiphertext, 'Patient name');
  const patientPhoneCiphertext = encryptAndVerify(row.patientPhone, row.patientPhoneCiphertext, 'Patient phone');
  return { externalUserIdCiphertext, externalUserIdHash, patientNameCiphertext, patientPhoneCiphertext };
}

async function fetchBatch(batchSize: number, cursorId?: string): Promise<Row[]> {
  return prisma.aiAdminSession.findMany({
    where: {
      OR: [
        { externalUserId: { not: null } },
        { externalUserIdCiphertext: { not: null } },
        { patientName: { not: null } },
        { patientPhone: { not: null } },
        { patientNameCiphertext: { not: null } },
        { patientPhoneCiphertext: { not: null } },
      ],
    },
    select: {
      id: true, clinicId: true, channel: true,
      externalUserId: true, externalUserIdCiphertext: true, externalUserIdHash: true,
      patientName: true, patientPhone: true, patientNameCiphertext: true, patientPhoneCiphertext: true,
    },
    orderBy: { id: 'asc' }, take: batchSize,
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
  }) as Promise<Row[]>;
}

async function fetchMessageBatch(batchSize: number, cursorId?: string): Promise<MessageRow[]> {
  return prisma.aiAdminMessage.findMany({
    select: { id: true, content: true, toolResult: true },
    orderBy: { id: 'asc' },
    take: batchSize,
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
  }) as Promise<MessageRow[]>;
}

async function fetchEscalationBatch(batchSize: number, cursorId?: string): Promise<EscalationRow[]> {
  return prisma.aiAdminEscalation.findMany({
    select: { id: true, reason: true, lastUserMessage: true },
    orderBy: { id: 'asc' },
    take: batchSize,
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
  }) as Promise<EscalationRow[]>;
}

async function preflightHistoryRows(batchSize: number): Promise<{ messages: number; escalations: number }> {
  let messageCursor: string | undefined;
  let messages = 0;
  while (true) {
    const rows = await fetchMessageBatch(batchSize, messageCursor);
    if (!rows.length) break;
    for (const row of rows) { prepareAiAdminMessageBackfillRow(row); messages += 1; }
    messageCursor = rows[rows.length - 1].id;
    if (rows.length < batchSize) break;
  }

  let escalationCursor: string | undefined;
  let escalations = 0;
  while (true) {
    const rows = await fetchEscalationBatch(batchSize, escalationCursor);
    if (!rows.length) break;
    for (const row of rows) { prepareAiAdminEscalationBackfillRow(row); escalations += 1; }
    escalationCursor = rows[rows.length - 1].id;
    if (rows.length < batchSize) break;
  }
  return { messages, escalations };
}

async function preflight(batchSize: number): Promise<{ scanned: number; ready: number; messages: number; escalations: number }> {
  const incompleteIndexPairs = await prisma.aiAdminSession.count({
    where: {
      externalUserId: null,
      OR: [
        { externalUserIdCiphertext: null, externalUserIdHash: { not: null } },
        { externalUserIdCiphertext: { not: null }, externalUserIdHash: null },
      ],
    },
  });
  if (incompleteIndexPairs > 0) throw new Error('Found incomplete external-identifier ciphertext/index pairs; manual reconciliation is required');

  let cursorId: string | undefined;
  let scanned = 0;
  while (true) {
    const rows = await fetchBatch(batchSize, cursorId);
    if (!rows.length) break;
    for (const row of rows) { prepareAiAdminExternalIdBackfillRow(row); scanned += 1; }
    cursorId = rows[rows.length - 1].id;
    if (rows.length < batchSize) break;
  }
  const history = await preflightHistoryRows(batchSize);
  return { scanned, ready: scanned, ...history };
}

async function applyMessageBackfill(batchSize: number): Promise<number> {
  let cursorId: string | undefined;
  let updated = 0;
  while (true) {
    const rows = await fetchMessageBatch(batchSize, cursorId);
    if (!rows.length) break;
    for (const row of rows) {
      const prepared = prepareAiAdminMessageBackfillRow(row);
      if (
        row.content === prepared.content
        && JSON.stringify(row.toolResult) === JSON.stringify(prepared.toolResult)
      ) continue;
      const changed = await prisma.aiAdminMessage.updateMany({
        where: { id: row.id, content: row.content },
        data: { content: prepared.content, toolResult: prepared.toolResult as any },
      });
      if (changed.count !== 1) {
        const latest = await prisma.aiAdminMessage.findUnique({
          where: { id: row.id }, select: { content: true, toolResult: true },
        });
        if (
          !latest || latest.content !== prepared.content
          || JSON.stringify(latest.toolResult) !== JSON.stringify(prepared.toolResult)
        ) {
          throw new Error('Concurrent AI Admin message change detected; stopped before processing more rows');
        }
        continue;
      }
      updated += 1;
    }
    cursorId = rows[rows.length - 1].id;
    logInfo('[ai-admin-external-id-backfill] message progress updated=' + updated);
    if (rows.length < batchSize) break;
  }
  return updated;
}

async function applyEscalationBackfill(batchSize: number): Promise<number> {
  let cursorId: string | undefined;
  let updated = 0;
  while (true) {
    const rows = await fetchEscalationBatch(batchSize, cursorId);
    if (!rows.length) break;
    for (const row of rows) {
      const prepared = prepareAiAdminEscalationBackfillRow(row);
      if (row.reason === prepared.reason && row.lastUserMessage === prepared.lastUserMessage) continue;
      const changed = await prisma.aiAdminEscalation.updateMany({
        where: { id: row.id, reason: row.reason, lastUserMessage: row.lastUserMessage },
        data: prepared,
      });
      if (changed.count !== 1) {
        const latest = await prisma.aiAdminEscalation.findUnique({
          where: { id: row.id }, select: { reason: true, lastUserMessage: true },
        });
        if (!latest || latest.reason !== prepared.reason || latest.lastUserMessage !== prepared.lastUserMessage) {
          throw new Error('Concurrent AI Admin escalation change detected; stopped before processing more rows');
        }
        continue;
      }
      updated += 1;
    }
    cursorId = rows[rows.length - 1].id;
    logInfo('[ai-admin-external-id-backfill] escalation progress updated=' + updated);
    if (rows.length < batchSize) break;
  }
  return updated;
}

async function applyBackfill(batchSize: number): Promise<{ sessions: number; messages: number; escalations: number }> {
  let cursorId: string | undefined;
  let scanned = 0;
  let updated = 0;
  while (true) {
    const rows = await fetchBatch(batchSize, cursorId);
    if (!rows.length) break;
    for (const row of rows) {
      scanned += 1;
      const prepared = prepareAiAdminExternalIdBackfillRow(row);
      const needsUpdate = row.externalUserId !== null
        || row.patientName !== null
        || row.patientPhone !== null
        || prepared.externalUserIdCiphertext !== row.externalUserIdCiphertext
        || prepared.externalUserIdHash !== row.externalUserIdHash
        || prepared.patientNameCiphertext !== row.patientNameCiphertext
        || prepared.patientPhoneCiphertext !== row.patientPhoneCiphertext;
      if (!needsUpdate) continue;
      const changed = await prisma.aiAdminSession.updateMany({
        where: {
          id: row.id, externalUserId: row.externalUserId, externalUserIdCiphertext: row.externalUserIdCiphertext,
          externalUserIdHash: row.externalUserIdHash, patientName: row.patientName, patientPhone: row.patientPhone,
          patientNameCiphertext: row.patientNameCiphertext, patientPhoneCiphertext: row.patientPhoneCiphertext,
        },
        data: {
          externalUserId: null, externalUserIdCiphertext: prepared.externalUserIdCiphertext, externalUserIdHash: prepared.externalUserIdHash,
          patientName: null, patientPhone: null, patientNameCiphertext: prepared.patientNameCiphertext, patientPhoneCiphertext: prepared.patientPhoneCiphertext,
        },
      });
      if (changed.count !== 1) {
        const winner = await prisma.aiAdminSession.findUnique({
          where: { id: row.id },
          select: {
            externalUserId: true, patientName: true, patientPhone: true,
            externalUserIdCiphertext: true, externalUserIdHash: true,
            patientNameCiphertext: true, patientPhoneCiphertext: true,
          },
        });
        if (!winner || winner.externalUserId !== null || winner.patientName !== null || winner.patientPhone !== null ||
            winner.externalUserIdCiphertext !== prepared.externalUserIdCiphertext || winner.externalUserIdHash !== prepared.externalUserIdHash ||
            winner.patientNameCiphertext !== prepared.patientNameCiphertext || winner.patientPhoneCiphertext !== prepared.patientPhoneCiphertext) {
          throw new Error('Concurrent external-identity/PHI change detected; stopped before processing more rows');
        }
        continue;
      }
      updated += 1;
    }
    cursorId = rows[rows.length - 1].id;
    logInfo('[ai-admin-external-id-backfill] progress scanned=' + scanned + ' updated=' + updated);
    if (rows.length < batchSize) break;
  }
  return {
    sessions: updated,
    messages: await applyMessageBackfill(batchSize),
    escalations: await applyEscalationBackfill(batchSize),
  };
}

function assertKeyAndRoundTrip(): void {
  const sample = 'ai-admin-external-id-backfill-check';
  if (decryptAiAdminText(encryptAiAdminText(sample)) !== sample) throw new Error('AI Admin encryption keyring failed round-trip validation');
}

async function main(): Promise<void> {
  const options = parseAiAdminExternalIdBackfillOptions(process.argv.slice(2), process.env);
  assertKeyAndRoundTrip();
  logInfo('[ai-admin-external-id-backfill] mode=' + (options.apply ? 'APPLY' : 'DRY-RUN') + ' batchSize=' + options.batchSize + (options.target ? ' target=' + options.target : ''));
  logInfo('[ai-admin-external-id-backfill] preflight started; no contact identifiers are logged');
  const counts = await preflight(options.batchSize);
  logInfo('[ai-admin-external-id-backfill] preflight sessions=' + counts.scanned + ' messages=' + counts.messages + ' escalations=' + counts.escalations + ' ready=' + counts.ready);
  if (!options.apply) { logInfo('[ai-admin-external-id-backfill] dry-run complete; no rows were changed'); return; }
  const updated = await applyBackfill(options.batchSize);
  logInfo('[ai-admin-external-id-backfill] complete sessions=' + updated.sessions + ' messages=' + updated.messages + ' escalations=' + updated.escalations);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    const kind = error instanceof Error ? error.name : 'NonError';
    console.error('[ai-admin-external-id-backfill] failed (' + kind + '); no contact identifiers were logged');
    process.exitCode = 1;
  }).finally(async () => { await prisma.$disconnect(); });
}
