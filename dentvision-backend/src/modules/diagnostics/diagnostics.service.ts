import prisma from '../../lib/prisma.js';
import { uid } from '../../lib/helpers.js';
import { writeAuditLog } from '../compliance/audit.service.js';
import { simpleChat } from '../ai/llm/client.js';
import { publish } from '../../lib/events.js';
import { createNotificationForCenter, NOTIFICATION_TYPES } from '../../services/notification.service.js';
import type { ReferralStatus, DiagnosticCategory, ReferralPriority } from '@prisma/client';

// ─── Center Subscription ───

export async function ensureCenterSubscription(centerId: string) {
  try {
    const existing = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, status, paid_until FROM "center_subscriptions" WHERE center_id::text = $1`, centerId
    );
    if (existing.length === 0) {
      // Auto-create trial subscription (30 days free)
      await prisma.$executeRawUnsafe(
        `INSERT INTO "center_subscriptions" (center_id, status, trial_end) VALUES ($1, 'trial', now() + interval '30 days')`, centerId
      );
      return { active: true, status: 'trial' as const };
    }
    const sub = existing[0];
    const trialEnd = sub.trial_end ? new Date(sub.trial_end) : null;
    const paidUntil = sub.paid_until ? new Date(sub.paid_until) : null;
    const effectiveEnd = paidUntil || trialEnd;
    if (effectiveEnd && new Date() > effectiveEnd && (sub.status === 'active' || sub.status === 'trial')) {
      await prisma.$executeRawUnsafe(`UPDATE "center_subscriptions" SET status = 'expired' WHERE id::text = $1`, sub.id);
      // Notify center members that they're no longer visible to clinics
      try {
        const members = await prisma.diagnosticCenterMember.findMany({ where: { centerId }, select: { userId: true } });
        for (const m of members) {
          await prisma.notification.create({
            data: {
              id: uid(), userId: m.userId, type: 'system',
              title: 'Подписка истекла',
              message: 'Ваш центр больше не отображается в списке для клиник. Продлите подписку, чтобы снова принимать направления.',
              link: '/diagnostics/center-dashboard',
            },
          });
        }
      } catch { /* notification failure non-fatal */ }
      return { active: false, status: 'expired' as const };
    }
    return { active: sub.status === 'active' || sub.status === 'trial', status: sub.status as string };
  } catch {
    return { active: true, status: 'trial' as const }; // fail open if table missing
  }
}

export async function getCenterSubscription(centerId: string) {
  try {
    const result = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "center_subscriptions" WHERE center_id::text = $1`, centerId
    );
    return result[0] || null;
  } catch { return null; }
}

const DIAGNOSTIC_COMMISSION_BPS = 1000; // 10%

// ─── Centers ───

export async function listCenters(search?: string, city?: string) {
  const where: any = { active: true };
  if (search) where.name = { contains: search, mode: 'insensitive' };
  if (city) where.city = { contains: city, mode: 'insensitive' };

  // Show centers that have an active/trial subscription, or no subscription record yet.
  // A subscription row is only created on the first accepted referral, so centers
  // without one must still be visible to clinics.
  try {
    const [allActive, subs] = await Promise.all([
      prisma.diagnosticCenter.findMany({ where: { active: true }, select: { id: true } }),
      prisma.$queryRawUnsafe<Array<{ center_id: string; status: string }>>(
        `SELECT center_id, status FROM "center_subscriptions"`
      ),
    ]);
    const subByCenter = new Map(subs.map((r) => [r.center_id, r.status]));
    const visibleIds = allActive
      .filter((c) => {
        const st = subByCenter.get(c.id);
        return !st || st === 'active' || st === 'trial';
      })
      .map((c) => c.id);
    where.id = { in: visibleIds };
  } catch { /* table may not exist — show all */ }

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
  try {
    await prisma.organization.upsert({
      where: { originalType_originalId: { originalType: type, originalId: id } },
      update: { name: data.name, address: data.address || null, phone: data.phone || null, email: data.email || null, contacts: data.city ? { city: data.city } : undefined },
      create: {
        id,
        name: data.name,
        type: type === 'DiagnosticCenter' ? 'DIAGNOSTIC_CENTER' : 'LABORATORY',
        address: data.address || null,
        phone: data.phone || null,
        email: data.email || null,
        contacts: data.city ? { city: data.city } : undefined,
        originalType: type,
        originalId: id,
      },
    });
  } catch (e) {
    console.warn(`[Diagnostics] syncOrgFromEntity failed (non-fatal, table may not exist): ${type} ${id}`);
  }
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
  userId?: string;
}) {
  return prisma.registrationRequest.create({
    data: { id: uid(), ...data, status: 'PENDING' },
  });
}

/**
 * Grant an approved registration applicant access to the created org:
 * membership row + Person + unified role, so the org appears in
 * /api/iam/me/contexts and switch-context works for any org type.
 */
/**
 * DiagnosticCenterMember/LaboratoryMember role → unified Role key.
 *
 * `radiologist` and `operator` have no seeded counterpart (see
 * prisma/seed-permissions.ts) and are deliberately absent: assigning them a
 * role they do not have is what the old hardcoded 'org_admin' did.
 */
export const DIAGNOSTICS_ROLE_TO_ROLE_KEY: Record<string, string> = {
  owner: 'owner',
  admin: 'admin',
  manager: 'manager',
};

export async function grantDiagnosticsAccess(
  type: 'DiagnosticCenter' | 'Laboratory',
  entityId: string,
  userId: string,
  role: string,
) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true },
    });
    if (!user) return false;

    const entity = type === 'DiagnosticCenter'
      ? await prisma.diagnosticCenter.findUnique({ where: { id: entityId } })
      : await prisma.laboratory.findUnique({ where: { id: entityId } });
    if (!entity) return false;

    await syncOrgFromEntity(type, entityId, {
      name: entity.name, city: entity.city, address: entity.address, phone: entity.phone, email: entity.email,
    });
    const org = await prisma.organization.findFirst({ where: { originalType: type, originalId: entityId } });
    if (!org) return false;

    if (type === 'DiagnosticCenter') {
      await prisma.diagnosticCenterMember.upsert({
        where: { centerId_userId: { centerId: entityId, userId } },
        update: { role },
        create: { id: uid(), centerId: entityId, userId, role },
      });
    } else {
      await prisma.laboratoryMember.upsert({
        where: { labId_userId: { labId: entityId, userId } },
        update: { role },
        create: { id: uid(), labId: entityId, userId, role },
      });
    }

    const fullName = `${user.firstName} ${user.lastName}`.trim() || user.email || 'Участник';
    const originalType = type === 'DiagnosticCenter' ? 'DiagnosticCenterMember' : 'LaboratoryMember';
    // Keyed on this membership alone. It used to reuse whatever Person the user
    // already had and move it here, which quietly severed their clinic (or
    // other organization) membership in the unified model.
    let person = await prisma.person.findFirst({
      where: { originalType, originalId: `${entityId}:${userId}` },
    });
    if (person) {
      person = await prisma.person.update({
        where: { id: person.id },
        data: { fullName, personType: 'STAFF', organizationId: org.id, originalType, originalId: `${entityId}:${userId}` },
      });
    } else {
      person = await prisma.person.create({
        data: {
          id: uid(), fullName, personType: 'STAFF', organizationId: org.id, userId: user.id,
          originalType, originalId: `${entityId}:${userId}`,
        },
      });
    }

    const roleKey = DIAGNOSTICS_ROLE_TO_ROLE_KEY[String(role).toLowerCase()];
    if (!roleKey) {
      // Fail closed rather than granting a fallback: this used to assign
      // 'org_admin' to every member regardless of their actual role, so a
      // radiologist or operator held full organization-admin rights in the
      // unified model. Without a PersonRole they fall back to the legacy
      // member-role checks, which is the accurate, narrower answer.
      console.warn(
        `[Diagnostics] No unified role for ${type} member role '${role}' (user ${userId}) — PersonRole not assigned`,
      );
      return true;
    }

    const dbRole = await prisma.role.findUnique({ where: { key: roleKey } });
    if (dbRole) {
      await prisma.personRole.upsert({
        where: { personId_roleId: { personId: person.id, roleId: dbRole.id } },
        update: {},
        create: { personId: person.id, roleId: dbRole.id },
      });
    }
    return true;
  } catch (e) {
    console.warn(`[Diagnostics] grantDiagnosticsAccess failed (${type} ${entityId}):`, (e as Error).message);
    return false;
  }
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

  const applicantId = (req as any).userId || reviewerId;

  if (req.type === 'center') {
    const centerId = uid();
    await prisma.diagnosticCenter.create({
      data: {
        id: centerId, name: req.name, city: req.city,
        address: req.address, phone: req.phone, email: req.email,
        active: true,
      },
    });
    // Grant the applicant access (owner). Falls back to the approving admin.
    await grantDiagnosticsAccess('DiagnosticCenter', centerId, applicantId, 'owner');
    await syncOrgFromEntity('DiagnosticCenter', centerId, { name: req.name, city: req.city, address: req.address, phone: req.phone, email: req.email });
  } else {
    const labId = uid();
    await prisma.laboratory.create({
      data: {
        id: labId, name: req.name, city: req.city,
        address: req.address, phone: req.phone, email: req.email,
        active: true,
      },
    });
    await grantDiagnosticsAccess('Laboratory', labId, applicantId, 'owner');
    await syncOrgFromEntity('Laboratory', labId, { name: req.name, city: req.city, address: req.address, phone: req.phone, email: req.email });
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
      // A referral sent to a center/lab should be SENT, not DRAFT
      status: (data.centerId || data.labId) ? 'SENT' : 'DRAFT',
    },
  });

  await writeAuditLog({
    action: 'REFERRAL_CREATED', entity: 'referral', entityId: referral.id,
    details: { category: data.category, studyType: data.studyType },
    userId, clinicId: data.clinicId,
  });

  publish('referral.created', {
    referralId: referral.id,
    clinicId: data.clinicId || '',
    centerId: data.centerId || '',
    doctorId: userId,
    patientName: data.patientName || '',
    studyType: data.studyType || '',
    status: (data.centerId || data.labId) ? 'SENT' : 'DRAFT',
    userId,
  });

  // Notify the center/lab that a new referral arrived
  if (data.centerId) {
    await createNotificationForCenter(data.centerId, {
      type: NOTIFICATION_TYPES.REFERRAL_SENT,
      title: 'Новое направление',
      message: `${data.patientName || 'Пациент'} — ${data.studyType || 'исследование'}`,
      link: `/center-workspace?tab=referrals`,
    });
  }

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
  const referral = await prisma.referral.findUnique({ where: { id } });
  if (!referral) throw new Error('Referral not found');

  // Enforce center subscription check when accepting referrals
  if (status === 'ACCEPTED' && referral.centerId) {
    const sub = await ensureCenterSubscription(referral.centerId);
    if (!sub.active) {
      throw new Error('Подписка диагностического центра истекла. Для приёма направлений требуется активная подписка (20 000 ₸/мес).');
    }
  }

  const update: any = { status };
  if (status === 'ACCEPTED' || status === 'IN_PROGRESS') {
    // Auto-populate cost from center's own price list (platform knows the price)
    let resolvedCost = cost;
    if (resolvedCost === undefined && referral.centerId && referral.studyType) {
      try {
        const study = await prisma.diagnosticStudy.findFirst({
          where: { centerId: referral.centerId, active: true, name: { contains: referral.studyType, mode: 'insensitive' } },
          select: { price: true },
        });
        if (study?.price) resolvedCost = Number(study.price);
      } catch { /* use whatever center provided */ }
    }
    if (resolvedCost === undefined) {
      throw new Error('Укажите стоимость исследования или установите цену в прайс-листе центра.');
    }
    update.cost = resolvedCost;
    // Platform fee: 10% of cost — always enforced
    update.platformFee = platformFee !== undefined ? platformFee : Math.round(Number(resolvedCost) * 0.1);
  }
  if (status === 'COMPLETED') update.completedAt = new Date();
  if (status === 'COMPLETED' && cost !== undefined) { update.cost = cost; update.paid = false; }
  if (status === 'CANCELLED') { update.cancelledAt = new Date(); update.cancelReason = reason; }

  const updatedReferral = await prisma.referral.update({ where: { id }, data: update });

  // Notify diagnostic center/lab when referral is sent to them
  if (status === 'SENT' && updatedReferral.centerId) {
    await createNotificationForCenter(updatedReferral.centerId, {
      type: NOTIFICATION_TYPES.REFERRAL_SENT,
      title: 'Новое направление',
      message: `${updatedReferral.patientName || 'Пациент'} — ${updatedReferral.studyType || 'исследование'}`,
      link: `/center-workspace?tab=referrals`,
    });
  }

  // Notify referring doctor when center accepts and sets cost
  if (status === 'ACCEPTED' && updatedReferral.doctorId) {
    const costMsg = updatedReferral.cost ? ` Стоимость: ${Number(updatedReferral.cost).toLocaleString()} ₸` : '';
    await createNotification({
      userId: updatedReferral.doctorId,
      type: NOTIFICATION_TYPES.REFERRAL_ACCEPTED,
      title: 'Направление принято',
      message: `#${id.slice(0, 8)}: ${updatedReferral.patientName} — ${updatedReferral.studyType}.${costMsg}`,
      link: `/diagnostics/referrals/${id}`,
    });
  }

  // Notify the referring doctor when results are ready
  if (status === 'COMPLETED' && updatedReferral.doctorId) {
    await createNotification({
      userId: updatedReferral.doctorId,
      type: NOTIFICATION_TYPES.REFERRAL_RESULT,
      title: 'Результат диагностики готов',
      message: `Направление #${id.slice(0, 8)}: ${updatedReferral.patientName} — ${updatedReferral.studyType}. Результат готов к просмотру.`,
      link: `/diagnostics/referrals/${id}`,
    });
  }

  await writeAuditLog({
    action: 'REFERRAL_STATUS_CHANGED', entity: 'referral', entityId: id,
    details: { status, reason },
    userId, clinicId: updatedReferral.clinicId,
  });

  // Publish lifecycle events for workflow engine / notifications
  publish(`referral.${status.toLowerCase()}` as any, {
    referralId: id,
    clinicId: updatedReferral.clinicId || '',
    centerId: updatedReferral.centerId || '',
    doctorId: updatedReferral.doctorId || '',
    patientName: updatedReferral.patientName || '',
    studyType: updatedReferral.studyType || '',
    status,
    userId,
    cost: updatedReferral.cost,
    platformFee: updatedReferral.platformFee,
  });

  return updatedReferral;
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
    include: { clinic: { select: { name: true } }, files: { select: { fileUrl: true, fileName: true } } },
  });
  if (!referral) throw new Error('Referral not found');

  const category = referral.category as string;
  // 3D imaging categories — never auto-modify Patient Card
  const imagingCategories = ['CBCT', 'OPG', 'TRG', 'TMJ', 'STL', 'FACE_SCAN', 'DICOM'];
  if (imagingCategories.includes(category)) {
    const aiContent = await simpleChat(
      `Ты — врач-рентгенолог. Опиши результат ${referral.studyType} для пациента ${referral.patientName}.
Жалобы: ${referral.complaints || 'не указаны'}. Предв. диагноз: ${referral.preliminaryDx || 'нет'}.
Цель: ${referral.studyGoal || 'не указана'}. Выдай заключение: 1) описание, 2) находки, 3) заключение, 4) рекомендации.`,
      'Заключение рентгенолога на русском языке.',
      { maxTokens: 1000 },
    );
    return upsertResult(referralId, aiContent);
  }

  // Lab categories — extract indicators, compare with patient history, propose changes
  const labCategories = ['ALLERGY', 'HISTOLOGY', 'PCR', 'MICROBIOLOGY', 'BLOOD', 'GENETICS', 'BIOPSY', 'SALIVA', 'PATHOLOGY'];
  if (labCategories.includes(category)) {
    return aiAnalyzeLabResult(referralId, referral, userId);
  }

  // Generic prompt
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
  return upsertResult(referralId, aiContent);
}

async function upsertResult(referralId: string, aiContent: string) {
  const existing = await prisma.diagnosticResult.findUnique({ where: { referralId } });
  if (existing) {
    return prisma.diagnosticResult.update({ where: { referralId }, data: { reportText: aiContent, aiGenerated: true } });
  }
  return prisma.diagnosticResult.create({ data: { id: uid(), referralId, reportText: aiContent, aiGenerated: true } });
}

async function aiAnalyzeLabResult(referralId: string, referral: any, _userId: string) {
  // Build prompt to extract structured indicators from lab result data
  const fileUrls = referral.files?.map((f: any) => f.fileUrl).filter(Boolean) || [];
  const hasFiles = fileUrls.length > 0;

  const prompt = `Ты — лабораторный аналитик. Пациент: ${referral.patientName}. Исследование: ${referral.studyType}.
${hasFiles ? 'К направлению приложены файлы результатов анализов.' : 'Анализируй по типу исследования.'}

Извлеки из результатов следующие показатели (если применимо):
- Название показателя
- Значение
- Единица измерения
- Референсные значения (норма)
- Отклонение (↑ или ↓)

Для каждого показателя отметь: "в норме", "выше нормы", "ниже нормы".

Клиника: ${referral.clinic?.name || ''}.
Направляющий врач: ${referral.doctorName || ''}.

Выдай ответ в формате:
📋 **Показатели:**

| Показатель | Значение | Норма | Отклонение |
|---|---|---|---|
| ... | ... | ... | ... |

📝 **Заключение:** (общая оценка результатов)

⚠️ **Рекомендации:** (что проверить / проконсультироваться)

💡 **Предложение:** AI обнаружил следующие изменения. Рекомендуется добавить их в карточку пациента после подтверждения врача.`;

  const aiContent = await simpleChat(prompt, 'Проанализируй лабораторные показатели на русском.', { maxTokens: 1200 });

  // Store AI analysis with indicators flag for doctor review
  const result = await prisma.diagnosticResult.upsert({
    where: { referralId },
    update: {
      reportText: aiContent,
      aiGenerated: true,
      aiSummary: '🔬 Лабораторные показатели извлечены. Требуется подтверждение врача для внесения в карту пациента.',
    },
    create: {
      id: uid(),
      referralId,
      reportText: aiContent,
      aiGenerated: true,
      aiSummary: '🔬 Лабораторные показатели извлечены. Требуется подтверждение врача для внесения в карту пациента.',
    },
  });

  // Notify referring doctor that indicators need review
  if (referral.doctorId && referral.clinicId) {
    await dispatchNotifications([{
      userId: referral.doctorId,
      clinicId: referral.clinicId,
      type: 'workflow',
      title: 'AI обнаружил лабораторные данные',
      message: `Направление #${referralId.slice(0, 8)} — ${referral.patientName}. Показатели извлечены. Проверьте и подтвердите внесение в карту пациента.`,
      link: `/diagnostics/referrals/${referralId}`,
    }]);
  }

  return result;
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
    data: { status: 'COMPLETED', completedAt: new Date() },
  });

  if (referral.patientId) {
    await prisma.visit.create({
      data: {
        id: uid(),
        patientId: referral.patientId,
        doctorId: data.doctorId,
        diagnosis: referral.preliminaryDx || data.conclusion || undefined,
        complaints: referral.complaints || undefined,
        treatment: {
          type: 'diagnostic_result',
          studyType: referral.studyType,
          reportText: data.reportText,
          conclusion: data.conclusion,
          _aiGenerated: true,
          _source: 'diagnostic',
        },
        notes: `[AI-ввод] Результат диагностики: ${referral.studyType}. Направление #${referral.id.slice(0, 8)}. Проверьте данные.`,
      },
    });
  }

  // Collect notification recipients: center/lab staff + referring clinic
  const notifyUserIds = new Set<string>();

  // Referring doctor
  if (referral.doctorId) notifyUserIds.add(referral.doctorId);

  // Clinic members who can see the result
  if (referral.clinicId) {
    const clinicMembers = await prisma.clinicMember.findMany({
      where: { clinicId: referral.clinicId, role: { in: ['OWNER', 'ADMIN', 'DOCTOR'] } },
      select: { userId: true, clinicId: true },
    }).catch(() => [] as Array<{ userId: string; clinicId: string }>);
    // Notify the referring doctor's colleagues (skip the doctor themselves, already added)
    for (const m of clinicMembers) {
      if (m.userId !== referral.doctorId) notifyUserIds.add(m.userId);
    }
  }

  // Center/lab staff
  if (referral.centerId) {
    const centerMembers = await prisma.diagnosticCenterMember.findMany({
      where: { centerId: referral.centerId, role: { in: ['admin', 'manager'] } },
    }).catch(() => [] as Array<{ userId: string }>);
    for (const m of centerMembers) notifyUserIds.add(m.userId);
  }
  if (referral.labId) {
    const labMembers = await prisma.laboratoryMember.findMany({
      where: { labId: referral.labId, role: { in: ['admin', 'manager'] } },
    }).catch(() => [] as Array<{ userId: string }>);
    for (const m of labMembers) notifyUserIds.add(m.userId);
  }

  if (notifyUserIds.size > 0) {
    const title = 'Результат диагностики подтверждён';
    const message = `Врач ${referral.doctorName || 'доктор'} подтвердил результат по направлению #${referral.id.slice(0, 8)} (${referral.patientName}). Данные автоматически внесены в карту пациента.`;
    await dispatchNotifications(
      Array.from(notifyUserIds).map((userId) => ({
        userId,
        clinicId: referral.clinicId || undefined,
        type: 'workflow' as const,
        title,
        message,
        link: `/diagnostics/referrals/${referral.id}`,
      })),
    );
  }

  await writeAuditLog({
    action: 'RESULT_SIGNED', entity: 'referral', entityId: data.referralId,
    details: { studyType: referral.studyType, signedBy: data.doctorId },
    userId: data.doctorId, clinicId: referral.clinicId,
  });

  publish('diagnostics.result_ready', {
    referralId: data.referralId,
    resultId: result.id,
    clinicId: referral.clinicId || '',
    centerId: referral.centerId || '',
    doctorId: data.doctorId,
    patientName: referral.patientName || '',
    studyType: referral.studyType || '',
    userId: data.doctorId,
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
