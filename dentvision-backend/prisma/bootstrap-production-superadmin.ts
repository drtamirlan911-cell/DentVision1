import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[SUPERADMIN] Skipping production superadmin bootstrap outside production.');
    return;
  }

  const email = (process.env.SUPERADMIN_EMAIL || 'superadmin@dentvision.kz').trim().toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD;

  if (!password || password.length < 12) {
    throw new Error('[SUPERADMIN] SUPERADMIN_PASSWORD must be set in production and contain at least 12 characters.');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: passwordHash,
      firstName: 'DentVision',
      lastName: 'SuperAdmin',
      role: 'SUPERADMIN',
    },
    create: {
      id: randomUUID(),
      email,
      password: passwordHash,
      firstName: 'DentVision',
      lastName: 'SuperAdmin',
      role: 'SUPERADMIN',
    },
    select: { id: true, email: true },
  });

  const role = await prisma.role.upsert({
    where: { key: 'superadmin' },
    update: { name: 'Суперадминистратор', isSystem: true },
    create: {
      id: randomUUID(),
      key: 'superadmin',
      name: 'Суперадминистратор',
      description: 'Full platform access — all permissions',
      isSystem: true,
    },
    select: { id: true },
  });

  let person = await prisma.person.findFirst({
    where: { userId: user.id, organizationId: null },
    select: { id: true },
  });

  if (!person) {
    person = await prisma.person.create({
      data: {
        id: randomUUID(),
        fullName: 'DentVision SuperAdmin',
        personType: 'STAFF',
        userId: user.id,
        email,
      },
      select: { id: true },
    });
  } else {
    await prisma.person.update({
      where: { id: person.id },
      data: { fullName: 'DentVision SuperAdmin', email },
    });
  }

  await prisma.personRole.upsert({
    where: {
      personId_roleId_scopeKey: {
        personId: person.id,
        roleId: role.id,
        scopeKey: 'platform',
      },
    },
    update: { scopeType: 'platform', scopeId: null },
    create: {
      id: randomUUID(),
      personId: person.id,
      roleId: role.id,
      scopeType: 'platform',
      scopeId: null,
      scopeKey: 'platform',
    },
  });

  console.log(`[SUPERADMIN] Ready: ${email} -> platform:superadmin`);
}

main()
  .catch((error) => {
    console.error('[SUPERADMIN] Bootstrap failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
