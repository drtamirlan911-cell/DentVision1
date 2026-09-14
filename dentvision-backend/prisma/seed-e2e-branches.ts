import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();

/**
 * E2E clinic branches.
 *
 * The patient/appointment flows now enforce branch scope for clinic staff.
 * The deterministic E2E identities are clinic members, but the original
 * fixture only created clinics and memberships, leaving every member without
 * a branch. That made the first patient POST fail with the legitimate
 * `Сотруднику не назначен филиал` guard and caused appointment tests to
 * cascade with undefined patient IDs.
 *
 * Keep this fixture deterministic and scoped to the two E2E clinics only.
 */
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
        (id, clinic_id, code, name, active, is_default, created_at, updated_at)
      VALUES
        (${branchId}, ${clinicId}, ${code}, ${name}, true, true, NOW(), NOW())
    `;
  } else {
    await prisma.$executeRaw`
      UPDATE branches
      SET name = ${name}, active = true, is_default = true, updated_at = NOW()
      WHERE id = ${branchId}
    `;
  }

  await prisma.$executeRaw`
    UPDATE clinic_members
    SET branch_id = ${branchId}, updated_at = NOW()
    WHERE clinic_id = ${clinicId}
      AND branch_id IS NULL
  `;

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
