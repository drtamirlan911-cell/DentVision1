import prisma from '../../lib/prisma.js';

let ready: Promise<void> | null = null;

/** Reconcile both historical dental_lab_order_events DDL shapes before event writes. */
export function ensureDentalLabOrderEventsTable(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "dental_lab_order_events" (
        "id" TEXT NOT NULL,
        "labOrderId" TEXT NOT NULL,
        "clinicId" TEXT NOT NULL,
        "fromStatus" TEXT,
        "toStatus" TEXT NOT NULL,
        "note" TEXT,
        "actorUserId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "dental_lab_order_events_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(`ALTER TABLE "dental_lab_order_events" ADD COLUMN IF NOT EXISTS "note" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "dental_lab_order_events" ALTER COLUMN "fromStatus" DROP NOT NULL`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "dental_lab_order_events_labOrderId_createdAt_idx" ON "dental_lab_order_events"("labOrderId", "createdAt")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "dental_lab_order_events_clinicId_createdAt_idx" ON "dental_lab_order_events"("clinicId", "createdAt")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "dental_lab_order_events_actorUserId_createdAt_idx" ON "dental_lab_order_events"("actorUserId", "createdAt")`);
  })().catch((error) => { ready = null; throw error; });
  return ready;
}
