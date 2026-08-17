import { PrismaClient } from '@prisma/client';

import { decryptField, hmacIin } from '../src/lib/phi.js';

const prisma = new PrismaClient();

const BATCH_SIZE = 500;

/**
 * One-time backfill for Patient.iinHash on rows created before the
 * cross-clinic-access feature. Naturally idempotent (only touches rows still
 * missing the hash), so safe to re-run on every deploy — same reasoning as
 * migrate-unified-schema.ts's failures being loud-but-non-fatal rather than
 * refusing to deploy.
 */
export async function backfillIinHash(): Promise<{ updated: number; skipped: number }> {
  let updated = 0;
  let skipped = 0;
  // A row whose decrypt/hash fails stays `iinHash: null` forever, so it would
  // match the same query again next pass — exclude already-attempted ids
  // within this run rather than looping on it. It's picked up again on the
  // next deploy's run, same as migrate-unified-schema.ts's failure handling.
  const attemptedIds: string[] = [];

  for (;;) {
    const rows = await prisma.patient.findMany({
      where: { iin: { not: null }, iinHash: null, id: { notIn: attemptedIds } },
      select: { id: true, iin: true },
      take: BATCH_SIZE,
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      attemptedIds.push(row.id);
      try {
        const plain = decryptField(row.iin);
        const hash = hmacIin(plain);
        if (!hash) {
          skipped += 1;
          continue;
        }
        await prisma.patient.update({ where: { id: row.id }, data: { iinHash: hash } });
        updated += 1;
      } catch (err) {
        skipped += 1;
        console.error(`  ✗ Patient ${row.id}: ${(err as Error).message}`);
      }
    }

    if (rows.length < BATCH_SIZE) break;
  }

  return { updated, skipped };
}

async function main() {
  console.log('=== Backfill Patient.iinHash ===\n');
  const { updated, skipped } = await backfillIinHash();
  console.log(`\n=== Backfill complete: ${updated} updated, ${skipped} skipped ===`);
}

// Only run when executed directly (`tsx prisma/backfill-iin-hash.ts`), not
// when imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .catch((e) => {
      console.error('[BACKFILL] Failed:', e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
