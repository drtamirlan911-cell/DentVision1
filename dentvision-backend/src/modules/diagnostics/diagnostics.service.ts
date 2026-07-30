import prisma from '../../lib/prisma.js';
import { uid } from '../../lib/helpers.js';
import { writeAuditLog } from '../compliance/audit.service.js';
import { simpleChat } from '../ai/llm/client.js';
import type { ReferralStatus, DiagnosticCategory, ReferralPriority } from '@prisma/client';

// ─── Centers ───

export async function listCenters(search?: string, city?: string) {
  const where: any = { active: true };
  if (search) where.name = { contains: search, mode: 'insensitive' };
  if (city) where.city = { contains: city, mode: 'insensitive' };
  return prisma.diagnosticCenter.findMany({
    where,
    include: { _count: { select: { studies: true, operators: true } } },
    orderBy: { rating: 'desc' },
  });
}

export async function getCenter(id: string) {
  return prisma.diagnosticCenter.findUnique({
    where: { id },
    include: {
      studies: { where: { active: true } },
      operators: { where: { active: true }, include: { user: { select: { id: true, firstName: true, lastName: true } } } },
      radiologists: { where: { active: true }, include: { user: { select: { id: true, firstName: true, lastName: true } } } },
      _count: { select: { bookings: true } },
    },
  });
}

async function syncOrgFromEntity(
  type: 'DiagnosticCenter' | 'Laboratory',
  id: string,
  data: { name: string; city?: string | null; address?: string | null; phone?: string | null; email?: string | null },
) {
  await prisma.organization.upsert({
    where: { originalType_originalId: { originalType: type, originalId: id } },
    update: { name, address: data.address || null, phone: data.phone || null, email: data.email || null, contacts: data.city ? { city: data.city } : undefined },
    create: {
      id: uid(),
      name,
      type: type === 'DiagnosticCenter' ? 'DIAGNOSTIC_CENTER' : 'LABORATORY',
      address: data.address || null,
      phone: data.phone || null,
      email: data.email || null,
      contacts: data.city ? { city: data.city } : undefined,
      originalType: type,
      originalId: id,
    },
  });
}

export async function createCenter(data: {
  name: string; city?: string; address?: string; phone?: string; email?: string;
}) {
  const id = uid();
  const center = await prisma.diagnosticCenter.create({
    data: { id, ...data },
  });
  await syncOrgFromEntity('DiagnosticCenter', id, data);
  return center;
}

export async function updateCenter(id: string, data: any) {
  return prisma.diagnosticCenter.update({ where: { id }, data });
}

// ─── Laboratories ───

export async function listLaboratories(search?: string) {
  const where: any = { active: true };
  if (search) where.name = { contains: search, mode: 'insensitive' };
  return prisma.laboratory.findMany({
    where,
    include: { _count: { select: { tests: true } } },
    orderBy: { rating: 'desc' },
  });
}

export async function getLaboratory(id: string) {
  return prisma.laboratory.findUnique({
    where: { id },
    include: { tests: { where: { active: true } } },
  });
}

export async function createLaboratory(data: {
  name: string; city?: string; address?: string; phone?: string; email?: string;
}) {
  const id = uid();
  const lab = await prisma.laboratory.create({
    data: { id, ...data },
  });
  await syncOrgFromEntity('Laboratory', id, data);
  return lab;
}

export async function updateLaboratory(id: string, data: any) {
  return prisma.laboratory.update({ where: { id }, data });
}

// ─── Registration Requests ───

export async function createRegistrationRequest(data: {
  type: 'center' | 'laboratory';
  name: string; city?: string; address?: string; phone?: string; email?: string; comment?: string;
}) {
  return prisma.registrationRequest.create({
    data: { id: uid(), ...data, status: 'PENDING' },
  });
}

export async function listRegistrationRequests(status?: string) {
  const where: any = {};
  if (status) where.status = status;
  return prisma.registrationRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
}

export async function approveRegistrationRequest(id: string, reviewerId: string) {
  const req = await prisma.registrationRequest.findUnique({ where: { id } });
  if (!req) throw new Error('Registration request not found');
  if (req.status !== 'PENDING') throw new Error('Request already processed');

  if (req.type === 'center') {
    const id = uid();
    await prisma.diagnosticCenter.create({
      data: {
        id, name: req.name, city: req.city,
        address: req.address, phone: req.phone, email: req.email,
        active: true,
      },
    });
    await syncOrgFromEntity('DiagnosticCenter', id, { name: req.name, city: req.city, address: req.address, phone: req.phone, email: req.email });
  } else {
    const id = uid();
    await prisma.laboratory.create({
      data: {
        id, name: req.name, city: req.city,
        address: req.address, phone: req.phone, email: req.email,
        active: true,
      },
    });
    await syncOrgFromEntity('Laboratory', id, { name: req.name, city: req.city, address: req.address, phone: req.phone, email: req.email });
  }

  return prisma.registrationRequest.update({
    where: { id },
    data: { status: 'APPROVED', reviewerId, updatedAt: new Date() },
  });
}

export async function rejectRegistrationRequest(id: string, reviewerId: string, reason?: string) {
  const req = await prisma.registrationRequest.findUnique({ where: { id } });
  if (!req) throw new Error('Registration request not found');
  if (req.status !== 'PENDING') throw new Error('Request already processed');

  return prisma.registrationRequest.update({
    where: { id },
    data: { status: 'REJECTED', reviewerId, reviewNote: reason, updatedAt: new Date() },
  });
}

// ─── Studies ───

export async function listStudies(centerId?: string, category?: string) {
  const where: any = { active: true };
  if (centerId) where.centerId = centerId;
  if (category) where.category = category;
  return prisma.diagnosticStudy.findMany({ where, orderBy: { name: 'asc' } });
}

export async function listLabTests(labId?: string, category?: string) {
  const where: any = { active: true };
  if (labId) where.labId = labId;
  if (category) where.category = category;
  return prisma.laboratoryTest.findMany({ where, orderBy: { name: 'asc' } });
}

// ─── Referrals ───

const referralInclude = {
  clinic: { select: { id: true, name: true } },
  center: { select: { id: true, name: true } },
  lab: { select: { id: true, name: true } },
  doctor: { select: { id: true, firstName: true, lastName: true } },
  patient: { select: { id: true, firstName: true, lastName: true } },
  operator: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
  radiologist: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
  files: { select: { id: true, fileName: true, fileType: true, createdAt: true } },
  result: { select: { id: true, aiGenerated: true, createdAt: true } },
  _count: { select: { comments: true } },
};

export async function listReferrals(opts: {
  clinicId?: string;
  doctorId?: string;
  centerId?: string;
  labId?: string;
  status?: string;
  patientId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const where: any = {};
  if (opts.clinicId) where.clinicId = opts.clinicId;
  if (opts.doctorId) where.doctorId = opts.doctorId;
  if (opts.centerId) where.centerId = opts.centerId;
  if (opts.labId) where.labId = opts.labId;
  if (opts.status) where.status = opts.status;
  if (opts.patientId) where.patientId = opts.patientId;
  if (opts.search) {
    where.OR = [
      { patientName: { contains: opts.search, mode: 'insensitive' } },
      { patientIin: { contains: opts.search } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.referral.findMany({
      where,
      include: referralInclude,
      orderBy: { createdAt: 'desc' },
      take: opts.limit || 50,
      skip: opts.offset || 0,
    }),
    prisma.referral.count({ where }),
  ]);
  return { items, total };
}

export async function getReferral(id: string) {
  return prisma.referral.findUnique({
    where: { id },
    include: {
      ...referralInclude,
      comments: {
        include: { author: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}

export async function createReferral(data: {
  patientName: string; patientIin?: string; patientBirth?: string; patientGender?: string;
  patientPhone?: string; patientEmail?: string; pregnancy?: boolean; allergies?: string; specialNotes?: string;
  clinicId: string; doctorId: string; doctorName?: string; doctorPhone?: string; doctorEmail?: string;
  category: DiagnosticCategory; studyType: string; anatomicalSites?: any;
  complaints?: string; preliminaryDx?: string; studyGoal?: string; commentForDoctor?: string; commentForLab?: string;
  priority?: ReferralPriority; centerId?: string; labId?: string; patientId?: string;
}, userId: string) {
  // Daily limit check for users without clinic
  if (!data.clinicId) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const count = await prisma.referral.count({
      where: { doctorId: userId, createdAt: { gte: today } },
    });
    if (count >= 5) throw new Error('Daily referral limit reached (5). Upgrade to clinic plan.');
  }

  const referral = await prisma.referral.create({
    data: {
      id: uid(),
      ...data,
      patientBirth: data.patientBirth ? new Date(data.patientBirth) : undefined,
      anatomicalSites: data.anatomicalSites || undefined,
    },
  });

  await writeAuditLog({
    action: 'REFERRAL_CREATED', entity: 'referral', entityId: referral.id,
    details: { category: data.category, studyType: data.studyType },
    userId, clinicId: data.clinicId,
  });

  return referral;
}

export async function updateReferral(id: string, data: any, userId: string) {
  const referral = await prisma.referral.update({ where: { id }, data });

  await writeAuditLog({
    action: 'REFERRAL_UPDATED', entity: 'referral', entityId: id,
    details: { updated: Object.keys(data) },
    userId, clinicId: referral.clinicId,
  });

  return referral;
}

export async function changeReferralStatus(id: string, status: ReferralStatus, userId: string, reason?: string, cost?: number, platformFee?: number) {
  const update: any = { status };
  if (status === 'ACCEPTED' || status === 'IN_PROGRESS') {
    if (cost !== undefined) update.cost = cost;
    if (platformFee !== undefined) update.platformFee = platformFee;
  }
  if (status === 'COMPLETED') update.completedAt = new Date();
  if (status === 'COMPLETED' && cost !== undefined) { update.cost = cost; update.paid = false; }
  if (status === 'CANCELLED') { update.cancelledAt = new Date(); update.cancelReason = reason; }

  const referral = await prisma.referral.update({ where: { id }, data: update });

  // Notify the referring doctor when results are ready
  if (status === 'COMPLETED' && referral.doctorId) {
    await prisma.notification.create({
      data: {
        id: uid(),
        userId: referral.doctorId,
        type: 'workflow',
        title: 'Результат диагностики готов',
        message: `Направление #${id.slice(0, 8)}: ${referral.patientName} — ${referral.studyType}. Результат готов к просмотру.`,
        link: `/diagnostics/referrals/${id}`,
      },
    });
  }

  await writeAuditLog({
    action: 'REFERRAL_STATUS_CHANGED', entity: 'referral', entityId: id,
    details: { status, reason },
    userId, clinicId: referral.clinicId,
  });

  return referral;
}

export async function deleteReferral(id: string, userId: string) {
  const referral = await prisma.referral.findUnique({ where: { id } });
  if (!referral) throw new Error('Not found');
  if (referral.status !== 'DRAFT') throw new Error('Only draft referrals can be deleted');

  await prisma.referral.delete({ where: { id } });

  await writeAuditLog({
    action: 'REFERRAL_DELETED', entity: 'referral', entityId: id,
    userId, clinicId: referral.clinicId,
  });
}

// ─── Files ───

export async function uploadReferralFile(data: {
  referralId: string; fileName: string; fileData: string; fileType: string; fileSize?: number; uploadedBy: string;
}) {
  const file = await prisma.referralFile.create({
    data: { id: uid(), referralId: data.referralId, fileName: data.fileName, fileUrl: data.fileData, fileType: data.fileType, fileSize: data.fileSize, uploadedBy: data.uploadedBy },
  });

  await writeAuditLog({
    action: 'FILE_UPLOADED', entity: 'referral', entityId: data.referralId,
    details: { fileName: data.fileName, fileType: data.fileType },
    userId: data.uploadedBy,
  });

  return file;
}

export async function deleteReferralFile(id: string, userId: string) {
  const file = await prisma.referralFile.findUnique({ where: { id } });
  if (!file) throw new Error('File not found');

  await prisma.referralFile.delete({ where: { id } });

  await writeAuditLog({
    action: 'FILE_DELETED', entity: 'referral', entityId: file.referralId,
    details: { fileName: file.fileName },
    userId,
  });
}

// ─── Comments ───

export async function addComment(referralId: string, authorId: string, text: string) {
  return prisma.referralComment.create({
    data: { id: uid(), referralId, authorId, text },
    include: { author: { select: { id: true, firstName: true, lastName: true } } },
  });
}

// ─── Dashboard ───

export async function getDashboardStats(clinicId?: string) {
  const where: any = {};
  if (clinicId) where.clinicId = clinicId;

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const [total, todayCount, pending, completed, overdue, recent] = await Promise.all([
    prisma.referral.count({ where }),
    prisma.referral.count({ where: { ...where, createdAt: { gte: today } } }),
    prisma.referral.count({ where: { ...where, status: { in: ['SENT', 'ACCEPTED', 'SCHEDULED', 'PATIENT_ARRIVED', 'IN_PROGRESS'] } } }),
    prisma.referral.count({ where: { ...where, status: 'COMPLETED' } }),
    prisma.referral.count({ where: { ...where, status: { not: 'CANCELLED' }, scheduledDate: { lt: today } } }),
    prisma.referral.findMany({
      where,
      include: referralInclude,
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  return { total, todayCount, pending, completed, overdue, recent };
}

// ─── Results ───

export async function aiGenerateResult(referralId: string, userId: string) {
  const referral = await prisma.referral.findUnique({
    where: { id: referralId },
    include: { clinic: { select: { name: true } } },
  });
  if (!referral) throw new Error('Referral not found');

  const prompt = `Ты — ассистент стоматолога. На основе данных направления напиши заключение диагностического исследования.

Пациент: ${referral.patientName}
Исследование: ${referral.studyType}
Жалобы: ${referral.complaints || 'не указаны'}
Предварительный диагноз: ${referral.preliminaryDx || 'не указан'}
Цель: ${referral.studyGoal || 'не указана'}
Аллергии: ${referral.allergies || 'нет'}
Особые отметки: ${referral.specialNotes || 'нет'}
Клиника: ${referral.clinic?.name || 'не указана'}

Напиши заключение в формате:
1. Описание исследования
2. Результаты
3. Заключение
4. Рекомендации`;

  const aiContent = await simpleChat(prompt, 'Сгенерируй заключение на русском языке.', { maxTokens: 1000 });

  const existing = await prisma.diagnosticResult.findUnique({ where: { referralId } });

  if (existing) {
    return prisma.diagnosticResult.update({
      where: { referralId },
      data: { reportText: aiContent, aiGenerated: true },
    });
  }

  return prisma.diagnosticResult.create({
    data: { id: uid(), referralId, reportText: aiContent, aiGenerated: true },
  });
}

export async function saveAndSignResult(data: {
  referralId: string; reportText: string; conclusion?: string; doctorId: string;
}) {
  const referral = await prisma.referral.findUnique({
    where: { id: data.referralId },
    include: { result: true },
  });
  if (!referral) throw new Error('Referral not found');

  const result = await prisma.diagnosticResult.upsert({
    where: { referralId: data.referralId },
    update: {
      reportText: data.reportText,
      conclusion: data.conclusion || undefined,
      signedBy: data.doctorId,
      signedAt: new Date(),
    },
    create: {
      id: uid(),
      referralId: data.referralId,
      reportText: data.reportText,
      conclusion: data.conclusion || undefined,
      signedBy: data.doctorId,
      signedAt: new Date(),
    },
  });

  await prisma.referral.update({
    where: { id: data.referralId },
    data: { status: 'REVIEWED', reviewedAt: new Date(), reviewerId: data.doctorId },
  });

  if (referral.patientId) {
    await prisma.visit.create({
      data: {
        id: uid(),
        patientId: referral.patientId,
        doctorId: data.doctorId,
        diagnosis: referral.preliminaryDx || undefined,
        complaints: referral.complaints || undefined,
        treatment: { type: 'diagnostic_result', studyType: referral.studyType, reportText: data.reportText, conclusion: data.conclusion },
        notes: `Результат диагностики: ${referral.studyType}. Направление #${referral.id.slice(0, 8)}`,
      },
    });
  }

  // Notify the diagnostic center/lab that result was reviewed
  const notifyUserIds: string[] = [];
  if (referral.centerId) {
    const centerMembers = await prisma.diagnosticCenterMember.findMany({
      where: { centerId: referral.centerId, role: { in: ['admin', 'manager'] } },
    });
    notifyUserIds.push(...centerMembers.map(m => m.userId));
  }
  if (referral.labId) {
    const labMembers = await prisma.laboratoryMember.findMany({
      where: { labId: referral.labId, role: { in: ['admin', 'manager'] } },
    });
    notifyUserIds.push(...labMembers.map(m => m.userId));
  }
  for (const uid2 of [...new Set(notifyUserIds)]) {
    await prisma.notification.create({
      data: {
        id: uid(),
        userId: uid2,
        type: 'workflow',
        title: 'Результат подтверждён',
        message: `Врач ${referral.doctorName || 'доктор'} подтвердил результат по направлению #${referral.id.slice(0, 8)} (${referral.patientName})`,
        link: `/diagnostics/referrals/${referral.id}`,
      },
    });
  }

  await writeAuditLog({
    action: 'RESULT_SIGNED', entity: 'referral', entityId: data.referralId,
    details: { studyType: referral.studyType, signedBy: data.doctorId },
    userId: data.doctorId, clinicId: referral.clinicId,
  });

  return result;
}

// ─── Seed test data ───

export async function seedTestData() {
  const existing = await prisma.diagnosticCenter.count();
  if (existing > 0) throw new Error('Test data already exists');

  // Centers
  const center1 = await prisma.diagnosticCenter.create({
    data: {
      id: uid(), name: 'DentaScan Алматы', city: 'Алматы',
      address: 'ул. Толе би, 185', phone: '+77011234567', email: 'info@dentascan.kz',
      active: true, rating: 4.8,
    },
  });
  const center2 = await prisma.diagnosticCenter.create({
    data: {
      id: uid(), name: '3D Диагностика Астана', city: 'Астана',
      address: 'пр. Қабанбай батыра, 15', phone: '+77021234567', email: 'info@3dastana.kz',
      active: true, rating: 4.6,
    },
  });
  const center3 = await prisma.diagnosticCenter.create({
    data: {
      id: uid(), name: 'МРТ-Эксперт Шымкент', city: 'Шымкент',
      address: 'ул. Байтурсынова, 10', phone: '+77031234567', email: 'info@mrt-shym.kz',
      active: true, rating: 4.5,
    },
  });

  // Laboratories
  const lab1 = await prisma.laboratory.create({
    data: {
      id: uid(), name: 'LabaLab Алматы', city: 'Алматы',
      address: 'ул. Абая, 52', phone: '+77011235555', email: 'info@labalab.kz',
      active: true, rating: 4.7,
    },
  });
  const lab2 = await prisma.laboratory.create({
    data: {
      id: uid(), name: 'БиоТест Астана', city: 'Астана',
      address: 'ул. Сарайшык, 5', phone: '+77021235555', email: 'info@biotest.kz',
      active: true, rating: 4.4,
    },
  });

  // Studies for centers
  const studies = [
    { name: 'Конусно-лучевая КТ (КЛКТ)', category: 'CBCT' as const, centerId: center1.id },
    { name: 'Панорамный снимок (ОПТГ)', category: 'OPG' as const, centerId: center1.id },
    { name: 'Телерентгенограмма (ТРГ)', category: 'TRG' as const, centerId: center1.id },
    { name: 'МРТ височно-нижнечелюстного сустава', category: 'TMJ' as const, centerId: center1.id },
    { name: 'Конусно-лучевая КТ (КЛКТ)', category: 'CBCT' as const, centerId: center2.id },
    { name: 'Панорамный снимок (ОПТГ)', category: 'OPG' as const, centerId: center2.id },
    { name: 'МРТ челюстно-лицевой области', category: 'TMJ' as const, centerId: center2.id },
    { name: 'Конусно-лучевая КТ (КЛКТ)', category: 'CBCT' as const, centerId: center3.id },
    { name: 'Панорамный снимок (ОПТГ)', category: 'OPG' as const, centerId: center3.id },
  ];
  for (const s of studies) {
    await prisma.diagnosticStudy.create({ data: { id: uid(), ...s } });
  }

  // Lab tests
  const tests = [
    { name: 'Клинический анализ крови', category: 'BLOOD' as const, labId: lab1.id },
    { name: 'Биохимический анализ крови', category: 'BLOOD' as const, labId: lab1.id },
    { name: 'Гистологическое исследование', category: 'HISTOLOGY' as const, labId: lab1.id },
    { name: 'Анализ на ВИЧ', category: 'BLOOD' as const, labId: lab1.id },
    { name: 'Микробиологический посев', category: 'MICROBIOLOGY' as const, labId: lab2.id },
    { name: 'Цитологическое исследование', category: 'PATHOLOGY' as const, labId: lab2.id },
    { name: 'Аллергопроба', category: 'ALLERGY' as const, labId: lab2.id },
  ];
  for (const t of tests) {
    await prisma.laboratoryTest.create({ data: { id: uid(), ...t } });
  }

  return {
    centers: [center1.name, center2.name, center3.name],
    labs: [lab1.name, lab2.name],
    studies: studies.length,
    tests: tests.length,
  };
}
