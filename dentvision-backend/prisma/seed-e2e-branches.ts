import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();

/**
 * E2E clinic branches. Patient/appointment flows enforce branch scope for
 * clinic staff. The deterministic E2E identities are clinic members, but the
 * original fixture created no branch assignment.
 *
 * The current branches table requires updatedAt, while other legacy/default
 * fields are database-managed. Write only the columns proven by the live E2E
 * schema and assign the branch through clinic_members.branch_id.
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
        (id, clinic_id, code, name, active, "updatedAt")
      VALUES
        (${branchId}, ${clinicId}, ${code}, ${name}, true, NOW())
    `;
  } else {
    await prisma.$executeRaw`
      UPDATE branches
      SET name = ${name}, active = true, "updatedAt" = NOW()
      WHERE id = ${branchId}
    `;
  }

  await prisma.$executeRaw`
    UPDATE clinic_members
    SET branch_id = ${branchId}
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
