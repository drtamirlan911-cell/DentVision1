import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();

/** E2E clinic branches required by branch-scoped CRM fixtures. */
async function ensureBranch(clinicId: string, code: string, name: string) {
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM branches
    WHERE clinic_id = ${clinicId} AND code = ${code}
    LIMIT 1
  `;

  const branchId = existing[0]?.id || randomUUID();
  if (!existing[0]) {
    await prisma.$executeRaw`
      INSERT INTO branches
        (id, clinic_id, code, name, active, updated_at)
      VALUES
        (${branchId}, ${clinicId}, ${code}, ${name}, true, NOW())
    `;
  } else {
    await prisma.$executeRaw`
      UPDATE branches
      SET name = ${name}, active = true, updated_at = NOW()
      WHERE id = ${branchId}
    `;
  }

  // E2E identities are deterministic: every clinic member must be assigned to
  // the clinic's deterministic branch, not only members that happen to have a
  // NULL assignment from an earlier fixture.
  const defaultColumn = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'branches'
        AND column_name = 'isDefault'
    ) AS exists
  `;
  if (defaultColumn[0]?.exists) {
    await prisma.$executeRaw`
      UPDATE branches
      SET "isDefault" = (id = ${branchId}), updated_at = NOW()
      WHERE clinic_id = ${clinicId}
    `;
  }

  await prisma.$executeRaw`
    UPDATE clinic_members
    SET branch_id = ${branchId}
    WHERE "clinicId" = ${clinicId}
  `;

  const invalidAssignments = await prisma.$queryRaw<Array<{ userId: string }>>`
    SELECT "userId"
    FROM clinic_members
    WHERE "clinicId" = ${clinicId}
      AND (branch_id IS NULL OR branch_id <> ${branchId})
    LIMIT 1
  `;
  if (invalidAssignments.length) {
    throw new Error(`[SEED:E2E:BRANCHES] Clinic member branch assignment mismatch in ${clinicId}`);
  }

  return branchId;
}

async function main() {
  const clinics = await prisma.clinic.findMany({
    where: { name: { in: ['E2E Clinic A', 'E2E Clinic B'] } },
    select: { id: true, name: true },
  });

  for (const clinic of clinics) {
    const suffix = clinic.name.endsWith('A') ? 'A' : 'B';
    await ensureBranch(clinic.id, `E2E-${suffix}-MAIN`, `${clinic.name} — Main`);
  }

  console.log(`[SEED:E2E:BRANCHES] ensured ${clinics.length} default branch(es)`);
}

main()
  .catch((error) => {
    console.error('[SEED:E2E:BRANCHES] Failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
