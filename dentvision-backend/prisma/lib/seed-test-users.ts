import type { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

export const TEST_USER_PASSWORD = 'Demo1234!';

export type TestUserSpec = {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  spec?: string;
};

export const TEST_USERS: TestUserSpec[] = [
  { email: 'owner@dentvision.kz', firstName: 'Арман', lastName: 'Касымов', role: 'OWNER', spec: 'Владелец (тест)' },
  { email: 'doctor@dentvision.kz', firstName: 'Доктор', lastName: 'Иванов', role: 'DOCTOR', spec: 'Терапевт' },
  { email: 'surgeon@dentvision.kz', firstName: 'Айдар', lastName: 'Нурланов', role: 'DOCTOR', spec: 'Хирург' },
  { email: 'assistant@dentvision.kz', firstName: 'Алина', lastName: 'Серикова', role: 'ASSISTANT' },
  { email: 'admin@dentvision.kz', firstName: 'Мария', lastName: 'Петрова', role: 'ADMIN' },
  { email: 'cashier@dentvision.kz', firstName: 'Ольга', lastName: 'Сидорова', role: 'CASHIER' },
  { email: 'lab@dentvision.kz', firstName: 'Сергей', lastName: 'Козлов', role: 'LAB' },
  { email: 'student@dentvision.kz', firstName: 'Жанель', lastName: 'Абдраимова', role: 'STUDENT' },
  { email: 'super@dentvision.kz', firstName: 'Super', lastName: 'Admin', role: 'SUPERADMIN' },
];

export async function seedTestUsersOnly(prisma: PrismaClient) {
  const password = await bcrypt.hash(TEST_USER_PASSWORD, 12);
  const created = [];

  for (const u of TEST_USERS) {
    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: u.email,
        password,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        spec: u.spec || null,
      },
      select: { id: true, email: true, role: true, firstName: true, lastName: true },
    });
    created.push(user);
  }

  return created;
}
