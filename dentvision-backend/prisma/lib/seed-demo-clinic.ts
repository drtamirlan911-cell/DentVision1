import type { PrismaClient, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';

export const DEMO_CLINIC = {
  name: 'DentVision Demo Clinic',
  city: 'Алматы',
  address: 'пр. Достык 45, офис 12',
  phone: '+77001234567',
  plan: 'PRO' as const,
};

export const DEMO_PATIENTS = [
  { firstName: 'Иван', lastName: 'Петров', phone: '+77001111111', gender: 'male', birthYear: 1985 },
  { firstName: 'Мария', lastName: 'Иванова', phone: '+77002222222', gender: 'female', birthYear: 1990 },
  { firstName: 'Алексей', lastName: 'Смирнов', phone: '+77003333333', gender: 'male', birthYear: 1978 },
  { firstName: 'Елена', lastName: 'Козлова', phone: '+77004444444', gender: 'female', birthYear: 1992 },
  { firstName: 'Нурлан', lastName: 'Сатпаев', phone: '+77005555555', gender: 'male', birthYear: 1988 },
  { firstName: 'Асель', lastName: 'Турсунова', phone: '+77006666666', gender: 'female', birthYear: 1995 },
];

type CreatedUser = { id: string; email: string; role: UserRole };

const CLINIC_ROLES: UserRole[] = ['OWNER', 'DOCTOR', 'ASSISTANT', 'ADMIN', 'CASHIER', 'LAB', 'STUDENT'];

export async function seedDemoClinic(
  prisma: PrismaClient,
  users: CreatedUser[],
) {
  const clinicId = randomUUID();
  const clinic = await prisma.clinic.create({
    data: { id: clinicId, ...DEMO_CLINIC },
  });

  const byRole = (role: UserRole) => users.find((u) => u.role === role);
  const owner = byRole('OWNER');
  const doctor = byRole('DOCTOR');
  const surgeon = users.find((u) => u.email === 'surgeon@dentvision.kz');

  const memberSpecs: { userId: string; role: UserRole }[] = [];
  for (const role of CLINIC_ROLES) {
    const u = role === 'DOCTOR' ? doctor : byRole(role);
    if (u) memberSpecs.push({ userId: u.id, role });
  }
  if (surgeon && surgeon.id !== doctor?.id) {
    memberSpecs.push({ userId: surgeon.id, role: 'DOCTOR' });
  }

  for (const m of memberSpecs) {
    await prisma.clinicMember.create({
      data: { id: randomUUID(), clinicId, userId: m.userId, role: m.role },
    });
  }

  const patients = [];
  for (const p of DEMO_PATIENTS) {
    const patient = await prisma.patient.create({
      data: {
        id: randomUUID(),
        clinicId,
        firstName: p.firstName,
        lastName: p.lastName,
        phone: p.phone,
        gender: p.gender,
        birthDate: new Date(p.birthYear, 5, 15),
        notes: 'Тестовый пациент DentVision',
      },
    });
    patients.push(patient);
  }

  const doctorId = doctor?.id || owner?.id;
  if (doctorId && patients.length >= 2) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    await prisma.appointment.createMany({
      data: [
        {
          id: randomUUID(),
          clinicId,
          patientId: patients[0].id,
          doctorId,
          date: today,
          time: '10:00',
          duration: 60,
          status: 'CONFIRMED',
          type: 'Терапия',
          notes: 'Тестовая запись',
        },
        {
          id: randomUUID(),
          clinicId,
          patientId: patients[1].id,
          doctorId,
          date: tomorrow,
          time: '14:30',
          duration: 45,
          status: 'PENDING',
          type: 'Консультация',
        },
      ],
    });

    await prisma.visit.create({
      data: {
        id: randomUUID(),
        patientId: patients[0].id,
        doctorId,
        date: new Date(Date.now() - 7 * 86400000),
        diagnosis: 'K02.1 Кариес дентина',
        complaints: 'Чувствительность к холодному',
        notes: 'Планируется реставрация',
      },
    });
  }

  return { clinic, patients, memberCount: memberSpecs.length };
}
