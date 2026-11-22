import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { uid } from '../../lib/helpers.js';
import { parseTengeToMinor, serializeBigInt, tengeToMinor } from '../../lib/money.js';
import { writeAuditLog } from '../compliance/audit.service.js';
import { getOrCreateWallet } from '../finance/finance.service.js';
import { availableBalanceMinor, requestPayout, PayoutError } from '../finance/payout.service.js';
import { getPartnerEconomicsTransparency } from '../finance/partner-economics.service.js';
import { assertClinicOrgAccess } from '../../lib/orgContext.js';
import { resolveClinicAccess as resolveClinicSubscriptionAccess } from '../billing/planEntitlements.js';
import { publish } from '../../lib/events.js';
import {
  medicalLabCapabilitiesForRoles,
  medicalLabRoleAllows,
  medicalLabRolesForWorkspace,
  selectUniqueMedicalLabMembershipId,
  type MedicalLabCapability,
} from './medicalLabAccess.js';
import { resetMedicalLabResultForRework, validateMedicalLabResultSet } from './medicalLabResults.js';
import { buildMedicalLabBarcode, isMedicalLabSpecimenTransitionAllowed, normalizeMedicalLabBarcode } from './medicalLabSpecimens.js';

export const medicalLabLifecycleRouter = Router();
medicalLabLifecycleRouter.use(authenticate);

const STATUSES = ['draft', 'ordered', 'sample_collected', 'received', 'processing', 'result_ready', 'verified', 'cancelled'] as const;
const TRANSITIONS: Record<string, readonly string[]> = {
  draft: ['ordered', 'cancelled'],
  ordered: ['sample_collected', 'cancelled'],
  sample_collected: ['received', 'cancelled'],
  received: ['processing', 'cancelled'],
  processing: ['result_ready', 'cancelled'],
  result_ready: ['verified', 'processing'],
  verified: [],
  cancelled: [],
};

export function isMedicalLabTransitionAllowed(from: string, to: string): boolean {
  return from === to || (TRANSITIONS[from] || []).includes(to);
}

type OrderRow = {
  id: string; clinicId: string; patientId: string | null; treatmentCaseId: string | null;
  labId: string | null; orderedByUserId: string; status: string; priority: string;
  notes: string | null; specimenType: string | null; collectedAt: Date | null;
  receivedAt: Date | null; resultReadyAt: Date | null; verifiedAt: Date | null;
  interpretation: string | null; metadata: unknown; accessionRequired: boolean; createdAt: Date; updatedAt: Date | null;
};

async function resolveLaboratoryScopeId(user: AuthRequest['user']): Promise<string | null> {
  if (!user?.id || String(user.organizationType || '').toUpperCase() !== 'LABORATORY') return null;

  // The active Organization.originalId is authoritative. Never recover from a
  // broken active scope by silently selecting the user's first lab membership.
  const directEntityId = String(user.organizationOriginalId || '').trim();
  if (directEntityId) {
    const direct = await prisma.laboratory.findUnique({ where: { id: directEntityId }, select: { id: true } });
    return direct?.id ?? null;
  }

  // Older tokens may not carry organizationOriginalId. Resolve the original
  // entity from the exact active Organization record, not from a global list.
  const organizationId = String(user.organizationId || '').trim();
  if (organizationId) {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { originalId: true, type: true },
    });
    if (String(organization?.type || '').toUpperCase() !== 'LABORATORY' || !organization.originalId) return null;
    const direct = await prisma.laboratory.findUnique({ where: { id: organization.originalId }, select: { id: true } });
    return direct?.id ?? null;
  }

  // Legacy compatibility is safe only when membership is unambiguous.
  const memberships = await prisma.laboratoryMember.findMany({
    where: { userId: user.id },
    select: { labId: true },
    take: 2,
  });
  const uniqueMembershipId = selectUniqueMedicalLabMembershipId(memberships);
  if (!uniqueMembershipId) return null;
  const memberLab = await prisma.laboratory.findUnique({
    where: { id: uniqueMembershipId },
    select: { id: true },
  });
  return memberLab?.id ?? null;
}

async function resolveMedicalLabRoleKeys(user: AuthRequest['user']): Promise<string[]> {
  if (!user?.id || String(user.organizationType || '').toUpperCase() !== 'LABORATORY' || !user.organizationId) return [];
  const person = await prisma.person.findFirst({
    where: { userId: user.id, organizationId: user.organizationId },
    select: {
      personRoles: {
        where: { scopeType: 'organization', scopeId: user.organizationId },
        select: { role: { select: { key: true } } },
      },
    },
  });
  return medicalLabRolesForWorkspace(person?.personRoles.map((assignment) => assignment.role.key) || []);
}

async function requireMedicalLabCapability(
  user: AuthRequest['user'],
  capability: MedicalLabCapability,
): Promise<boolean> {
  const roles = await resolveMedicalLabRoleKeys(user);
  return medicalLabRoleAllows(roles, capability);
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

async function getOrder(id: string): Promise<OrderRow | null> {
  const rows = await prisma.$queryRawUnsafe<OrderRow[]>(`
    SELECT "id","clinicId","patientId","treatmentCaseId","labId","orderedByUserId","status","priority","notes","specimenType","collectedAt","receivedAt","resultReadyAt","verifiedAt","interpretation","metadata","accessionRequired","createdAt","updatedAt"
    FROM "medical_lab_orders" WHERE "id" = $1 LIMIT 1`, id);
  return rows[0] ?? null;
}

/** Clinic-originated writes obey trial expiry; laboratory-context work may finish an already-assigned order. */
async function ensureClinicSubscriptionWritableIfClinicActor(req: AuthRequest, res: any, clinicId: string): Promise<boolean> {
  if (req.user?.role === 'SUPERADMIN' || (req.user as any)?.organizationType === 'LABORATORY') return true;
  try {
    const isClinicActor = await assertClinicOrgAccess(req.user!, clinicId);
    if (!isClinicActor) {
      res.status(403).json({ ok: false, error: 'Нет доступа к клинике' });
      return false;
    }
    const access = await resolveClinicSubscriptionAccess(clinicId);
    if (!access) {
      res.status(503).json({ ok: false, error: 'Не удалось проверить подписку клиники', code: 'CLINIC_ACCESS_UNVERIFIED' });
      return false;
    }
    if (access.writeBlocked) {
      res.status(402).json({
        ok: false,
        error: 'Клиника работает в режиме только для чтения после окончания пробного периода.',
        code: 'SUBSCRIPTION_EXPIRED',
        data: { upgradePath: '/crm/billing' },
      });
      return false;
    }
    return true;
  } catch (error) {
    console.error('[medical-lab] clinic subscription write gate', error);
    res.status(503).json({ ok: false, error: 'Не удалось проверить подписку клиники', code: 'CLINIC_ACCESS_UNVERIFIED' });
    return false;
  }
}

medicalLabLifecycleRouter.get('/capabilities', async (req: AuthRequest, res) => {
  try {
    const labId = await resolveLaboratoryScopeId(req.user);
    if (!labId) return res.status(403).json({ ok: false, error: 'Нет активного контекста медицинской лаборатории' } satisfies ApiResponse);
    const roles = await resolveMedicalLabRoleKeys(req.user);
    return res.json({
      ok: true,
      data: { laboratoryId: labId, roles, capabilities: medicalLabCapabilitiesForRoles(roles) },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[medical-lab] capabilities read failed', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить права медицинской лаборатории' } satisfies ApiResponse);
  }
});

async function canAccessOrder(user: AuthRequest['user'], order: OrderRow, write = false): Promise<boolean> {
  if (user?.role === 'SUPERADMIN') return true;

  // Receiving laboratory context is authoritative. Some lab users also carry
  // a legacy clinicId in the JWT; checking the clinic first would silently
  // scope them to the wrong tenant and could expose/deny the wrong orders.
  if ((user as any)?.organizationType === 'LABORATORY') {
    return Boolean(order.labId && (await resolveLaboratoryScopeId(user)) === order.labId);
  }

  if (order.clinicId === user?.clinicId) {
    const role = String(user?.role || '').toUpperCase();
    if (['OWNER', 'ADMIN'].includes(role)) return true;
    const branchIds = (user?.branchIds ?? []).filter(Boolean);
    if (branchIds.length === 0 || !order.patientId) return false;
    const patient = await prisma.patient.findFirst({
      where: { id: order.patientId, clinicId: order.clinicId, branchId: { in: branchIds } },
      select: { id: true },
    });
    return Boolean(patient);
  }

  if (!write && order.clinicId) return assertClinicOrgAccess(user!, order.clinicId);
  return false;
}

async function recordEvent(orderId: string, clinicId: string, fromStatus: string | null, toStatus: string, userId: string, note?: string) {
  await prisma.$executeRawUnsafe(`INSERT INTO "medical_lab_events" ("id","orderId","clinicId","fromStatus","toStatus","note","actorUserId","createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_TIMESTAMP)`, uid(), orderId, clinicId, fromStatus, toStatus, note ?? null, userId);
}

medicalLabLifecycleRouter.get('/finance', async (req: AuthRequest, res) => {
  try {
    const labId = await resolveLaboratoryScopeId(req.user);
    if (!labId || !(await requireMedicalLabCapability(req.user, 'finance.read'))) {
      return res.status(403).json({ ok: false, error: 'Финансы доступны только уполномоченным сотрудникам активной медицинской лаборатории' } satisfies ApiResponse);
    }

    const wallet = await getOrCreateWallet('PARTNER', labId);
    const [available, payouts, economics] = await Promise.all([
      availableBalanceMinor(wallet.id),
      prisma.payout.findMany({
        where: { walletId: wallet.id },
        select: { id: true, amount: true, status: true, createdAt: true, updatedAt: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      getPartnerEconomicsTransparency({ vertical: 'MEDICAL_ANALYSIS', partnerId: labId }),
    ]);

    return res.json({
      ok: true,
      data: serializeBigInt({
        wallet,
        availableBalanceMinor: available,
        canRequestPayout: await requireMedicalLabCapability(req.user, 'finance.manage'),
        payouts,
        economics: {
          period: economics.period,
          totals: economics.totals,
          rows: economics.rows.slice(0, 50),
          discrepancies: economics.discrepancies,
        },
      }),
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[medical-lab] finance read failed', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить финансы медицинской лаборатории' } satisfies ApiResponse);
  }
});

medicalLabLifecycleRouter.post('/payouts', async (req: AuthRequest, res) => {
  try {
    const labId = await resolveLaboratoryScopeId(req.user);
    if (!labId || !(await requireMedicalLabCapability(req.user, 'finance.manage'))) {
      return res.status(403).json({ ok: false, error: 'Запрашивать выплаты могут только владелец и финансовая роль активной медицинской лаборатории' } satisfies ApiResponse);
    }

    const rawAmount = req.body?.amount;
    if (typeof rawAmount !== 'string' && typeof rawAmount !== 'number') {
      return res.status(400).json({ ok: false, error: 'Укажите сумму выплаты в тенге' } satisfies ApiResponse);
    }

    let amountMinor: bigint;
    try {
      amountMinor = parseTengeToMinor(rawAmount);
    } catch {
      return res.status(400).json({ ok: false, error: 'Некорректная сумма выплаты' } satisfies ApiResponse);
    }

    try {
      const payout = await requestPayout({ ownerType: 'PARTNER', ownerId: labId, amountMinor });
      await writeAuditLog({
        action: 'MEDICAL_LAB_PAYOUT_REQUESTED',
        entity: 'payout',
        entityId: payout.id,
        details: { laboratoryId: labId, amountMinor: payout.amount.toString() },
        userId: req.user!.id,
      });
      return res.status(201).json({ ok: true, data: serializeBigInt(payout) } satisfies ApiResponse);
    } catch (error) {
      if (error instanceof PayoutError) {
        return res.status(error.code === 'INSUFFICIENT_FUNDS' ? 409 : 400)
          .json({ ok: false, error: error.message, code: error.code } satisfies ApiResponse);
      }
      throw error;
    }
  } catch (error) {
    console.error('[medical-lab] payout request failed', error);
    return res.status(500).json({ ok: false, error: 'Не удалось создать запрос на выплату' } satisfies ApiResponse);
  }
});

medicalLabLifecycleRouter.get('/orders', async (req: AuthRequest, res) => {
  try {
    const patientId = typeof req.query.patientId === 'string' ? req.query.patientId : null;
    const caseId = typeof req.query.caseId === 'string' ? req.query.caseId : null;
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    const where: string[] = [];
    const args: unknown[] = [];

    // Organization context takes precedence over any legacy clinicId carried
    // by the authentication payload. Medical-lab staff must never fall back to
    // clinic scoping for their own laboratory orders.
    if ((req.user as any)?.organizationType === 'LABORATORY') {
      const labId = await resolveLaboratoryScopeId(req.user);
      if (!labId) return res.status(403).json({ ok: false, error: 'Медицинская лаборатория не привязана к рабочему контексту' } satisfies ApiResponse);
      args.push(String(labId)); where.push(`o."labId" = $1`);
    } else if (req.user?.clinicId) {
      const clinicId = req.user.clinicId;
      args.push(clinicId); where.push(`o."clinicId" = $1`);
      const role = String(req.user?.role || '').toUpperCase();
      const branchIds = (req.user?.branchIds ?? []).filter(Boolean);
      if (!['SUPERADMIN', 'OWNER', 'ADMIN'].includes(role)) {
        if (branchIds.length === 0) return res.json({ ok: true, data: [] } satisfies ApiResponse);
        args.push(branchIds); where.push(`EXISTS (SELECT 1 FROM "patients" p WHERE p."id" = o."patientId" AND p."branchId" = ANY(${args.length}::text[]))`);
      }
    } else {
      return res.status(403).json({ ok: false, error: 'Нет рабочего контекста' } satisfies ApiResponse);
    }
    if (patientId) { args.push(patientId); where.push(`o."patientId" = $${args.length}`); }
    if (caseId) { args.push(caseId); where.push(`o."treatmentCaseId" = $${args.length}`); }
    if (status && STATUSES.includes(status as any)) { args.push(status); where.push(`o."status" = $${args.length}`); }
    const rows = await prisma.$queryRawUnsafe<OrderRow[]>(`SELECT o.* FROM "medical_lab_orders" o WHERE ${where.join(' AND ')} ORDER BY o."createdAt" DESC LIMIT 200`, ...args);
    return res.json({ ok: true, data: rows } satisfies ApiResponse);
  } catch (e: any) { return res.status(500).json({ ok: false, error: e.message || 'Не удалось получить медицинские анализы' } satisfies ApiResponse); }
});

medicalLabLifecycleRouter.post('/orders', requirePermission('patient.read'), async (req: AuthRequest, res) => {
  try {
    const clinicId = String(req.user?.clinicId || '');
    if ((req.user as any)?.organizationType === 'LABORATORY' || !clinicId) return res.status(403).json({ ok: false, error: 'Действие доступно из клиники' });
    if (req.body?.clinicId && String(req.body.clinicId) !== clinicId) return res.status(403).json({ ok: false, error: 'Нельзя создать направление в другом активном контексте' });
    if (!(await assertClinicOrgAccess(req.user!, clinicId))) return res.status(403).json({ ok: false, error: 'Нет доступа к клинике' });
    if (!(await ensureClinicSubscriptionWritableIfClinicActor(req, res, clinicId))) return;
    const { patientId = null, treatmentCaseId = null, labId = null, priority = 'routine', notes = null, specimenType = null, tests = [], metadata = null } = req.body || {};
    if (patientId) {
      const role = String(req.user?.role || '').toUpperCase();
      const branchIds = (req.user?.branchIds ?? []).filter(Boolean);
      const patient = await prisma.patient.findFirst({
        where: { id: String(patientId), clinicId, ...(['SUPERADMIN', 'OWNER', 'ADMIN'].includes(role) ? {} : { branchId: branchIds.length > 0 ? { in: branchIds } : '__NO_BRANCH_ACCESS__' }) },
        select: { id: true },
      });
      if (!patient) return res.status(400).json({ ok: false, error: 'Пациент не относится к выбранной клинике' });
    }
    if (treatmentCaseId) {
      const cases = await prisma.$queryRawUnsafe<{ id: string; clinicId: string; patientId: string }[]>(`SELECT "id","clinicId","patientId" FROM "treatment_cases" WHERE "id"=$1 LIMIT 1`, String(treatmentCaseId));
      if (!cases[0] || cases[0].clinicId !== clinicId || (patientId && cases[0].patientId !== String(patientId))) return res.status(400).json({ ok: false, error: 'Клинический кейс не принадлежит пациенту/клинике' });
    }
    if (labId) {
      const lab = await prisma.laboratory.findUnique({ where: { id: String(labId) }, select: { id: true, active: true } });
      if (!lab?.active) return res.status(400).json({ ok: false, error: 'Медицинская лаборатория недоступна' });
    }
    const id = uid();
    const requestedTests = Array.isArray(tests) ? tests : [];
    const testIds = requestedTests.map((test: any) => test?.testId ? String(test.testId) : '').filter(Boolean);
    const pricedTests = testIds.length
      ? await prisma.laboratoryTest.findMany({ where: { id: { in: testIds } }, select: { id: true, labId: true, name: true, price: true } })
      : [];
    const pricedById = new Map(pricedTests.map((test) => [test.id, test]));
    for (const test of requestedTests) {
      if (!test?.testId) continue;
      const catalog = pricedById.get(String(test.testId));
      if (!catalog || (labId && catalog.labId !== String(labId))) return res.status(400).json({ ok: false, error: 'Анализ не принадлежит выбранной лаборатории' });
    }
    await prisma.$executeRawUnsafe(`INSERT INTO "medical_lab_orders" ("id","clinicId","patientId","treatmentCaseId","labId","orderedByUserId","status","priority","notes","specimenType","metadata","accessionRequired","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,'ordered',$7,$8,$9,$10,$11,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`, id, clinicId, patientId ? String(patientId) : null, treatmentCaseId ? String(treatmentCaseId) : null, labId ? String(labId) : null, req.user!.id, String(priority), notes ? String(notes) : null, specimenType ? String(specimenType) : null, metadata ?? null, Boolean(labId));
    for (const test of requestedTests) {
      const catalog = test?.testId ? pricedById.get(String(test.testId)) : undefined;
      const priceMinor = catalog?.price != null ? tengeToMinor(Number(catalog.price) || 0) : null;
      await prisma.$executeRawUnsafe(`INSERT INTO "medical_lab_order_tests" ("id","orderId","testId","priceMinor","name","analyteCode","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`, uid(), id, test.testId ? String(test.testId) : null, priceMinor, String(test.name || catalog?.name || 'Анализ'), test.analyteCode ? String(test.analyteCode) : null);
    }
    await recordEvent(id, clinicId, 'draft', 'ordered', req.user!.id);
    publish('medicalLabOrder.created', { orderId: id, clinicId, patientId, treatmentCaseId, labId, userId: req.user!.id });
    return res.status(201).json({ ok: true, data: await getOrder(id) } satisfies ApiResponse);
  } catch (e: any) { return res.status(400).json({ ok: false, error: e.message || 'Не удалось создать направление в медицинскую лабораторию' } satisfies ApiResponse); }
});

medicalLabLifecycleRouter.get('/orders/:id', async (req: AuthRequest, res) => {
  try {
    const order = await getOrder(req.params.id as string);
    if (!order) return res.status(404).json({ ok: false, error: 'Направление не найдено' });
    if (!(await canAccessOrder(req.user!, order))) return res.status(403).json({ ok: false, error: 'Нет доступа' });
    const [tests, events, specimens, specimenEvents, roleKeys] = await Promise.all([
      prisma.$queryRawUnsafe(`SELECT * FROM "medical_lab_order_tests" WHERE "orderId"=$1 ORDER BY "createdAt" ASC`, order.id),
      prisma.$queryRawUnsafe(`SELECT * FROM "medical_lab_events" WHERE "orderId"=$1 ORDER BY "createdAt" ASC`, order.id),
      prisma.$queryRawUnsafe(`SELECT * FROM "medical_lab_specimens" WHERE "orderId"=$1 ORDER BY "createdAt" ASC`, order.id),
      prisma.$queryRawUnsafe(`SELECT * FROM "medical_lab_specimen_events" WHERE "orderId"=$1 ORDER BY "createdAt" ASC`, order.id),
      resolveMedicalLabRoleKeys(req.user),
    ]);
    const capabilities = medicalLabCapabilitiesForRoles(roleKeys);
    return res.json({ ok: true, data: { order, tests, events, specimens, specimenEvents, capabilities, isLaboratoryWorkspace: String(req.user?.organizationType || '').toUpperCase() === 'LABORATORY' } } satisfies ApiResponse);
  } catch (e: any) { return res.status(500).json({ ok: false, error: e.message || 'Ошибка направления' } satisfies ApiResponse); }
});


medicalLabLifecycleRouter.post('/orders/:id/specimens', async (req: AuthRequest, res) => {
  try {
    const order = await getOrder(req.params.id as string);
    if (!order) return res.status(404).json({ ok: false, error: 'Направление не найдено' });
    if (!(await canAccessOrder(req.user!, order, true))) return res.status(403).json({ ok: false, error: 'Нет доступа' });
    const isLabWorkspace = String(req.user?.organizationType || '').toUpperCase() === 'LABORATORY';
    if (!isLabWorkspace || !order.labId || !(await requireMedicalLabCapability(req.user, 'specimen.collect'))) {
      return res.status(403).json({ ok: false, error: 'Регистрация проб доступна только уполномоченной роли принимающей лаборатории', code: 'MEDICAL_LAB_SPECIMEN_ACCESSION_FORBIDDEN' });
    }
    if (!order.accessionRequired) return res.status(409).json({ ok: false, error: 'Accession-контур не включён для этого исторического направления' });
    if (!['ordered', 'sample_collected'].includes(order.status)) {
      return res.status(409).json({ ok: false, error: 'Проба регистрируется до приёмки в лаборатории' });
    }
    const specimenType = String(req.body?.specimenType || order.specimenType || '').trim().slice(0, 120);
    const containerType = String(req.body?.containerType || '').trim().slice(0, 80) || null;
    const location = String(req.body?.location || '').trim().slice(0, 120) || null;
    const volume = req.body?.volume === undefined || req.body?.volume === null || req.body?.volume === '' ? null : Number(req.body.volume);
    const volumeUnit = String(req.body?.volumeUnit || '').trim().slice(0, 16) || null;
    if (!specimenType) return res.status(400).json({ ok: false, error: 'Укажите тип биоматериала' });
    if (volume !== null && (!Number.isFinite(volume) || volume <= 0 || volume > 100000)) return res.status(400).json({ ok: false, error: 'Некорректный объём образца' });
    if (volume !== null && !volumeUnit) return res.status(400).json({ ok: false, error: 'Укажите единицу объёма' });
    const id = uid();
    const suppliedBarcode = req.body?.barcode === undefined ? null : normalizeMedicalLabBarcode(req.body.barcode);
    if (req.body?.barcode !== undefined && !suppliedBarcode) return res.status(400).json({ ok: false, error: 'Barcode имеет недопустимый формат' });
    const barcode = suppliedBarcode || buildMedicalLabBarcode(id);
    let specimen: any;
    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRawUnsafe<Array<{ id: string; status: string; labId: string | null }>>(
        'SELECT "id","status","labId" FROM "medical_lab_orders" WHERE "id"=$1 FOR UPDATE', order.id,
      );
      if (!locked[0] || locked[0].labId !== order.labId || !['ordered', 'sample_collected'].includes(locked[0].status)) {
        throw new Error('Статус направления изменился. Обновите карточку.');
      }
      const rows = await tx.$queryRawUnsafe<any[]>(
        'INSERT INTO "medical_lab_specimens" ("id","orderId","labId","accessionNumber","specimenType","containerType","volume","volumeUnit","status","location","collectedAt","createdByUserId","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,\'collected\',$9,CURRENT_TIMESTAMP,$10,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING *',
        id, order.id, order.labId, barcode, specimenType, containerType, volume, volumeUnit, location, req.user!.id,
      );
      specimen = rows[0];
      await tx.$executeRawUnsafe(
        'INSERT INTO "medical_lab_specimen_events" ("id","specimenId","orderId","labId","eventType","fromStatus","toStatus","location","note","actorUserId","createdAt") VALUES ($1,$2,$3,$4,\'COLLECTED\',NULL,\'collected\',$5,$6,$7,CURRENT_TIMESTAMP)',
        uid(), id, order.id, order.labId, location, 'Образец зарегистрирован и получил accession barcode.', req.user!.id,
      );
      if (locked[0].status === 'ordered') {
        await tx.$executeRawUnsafe(
          'UPDATE "medical_lab_orders" SET "status"=\'sample_collected\',"collectedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "status"=\'ordered\'',
          order.id,
        );
        await tx.$executeRawUnsafe(
          'INSERT INTO "medical_lab_events" ("id","orderId","clinicId","fromStatus","toStatus","note","actorUserId","createdAt") VALUES ($1,$2,$3,\'ordered\',\'sample_collected\',$4,$5,CURRENT_TIMESTAMP)',
          uid(), order.id, order.clinicId, 'Первый физический образец зарегистрирован.', req.user!.id,
        );
      }
    });
    publish('medicalLabSpecimen.accessioned', { orderId: order.id, specimenId: id, labId: order.labId, accessionNumber: barcode, userId: req.user!.id });
    return res.status(201).json({ ok: true, data: specimen } satisfies ApiResponse);
  } catch (error: any) {
    const message = String(error?.message || '');
    const duplicate = /unique|duplicate/i.test(message) || String(error?.meta?.code || '') === '23505';
    return res.status(duplicate ? 409 : 400).json({ ok: false, error: duplicate ? 'Такой barcode уже зарегистрирован' : (message || 'Не удалось зарегистрировать образец'), code: duplicate ? 'MEDICAL_LAB_BARCODE_DUPLICATE' : undefined } satisfies ApiResponse);
  }
});

/** Barcode scan at receiving: update custody, audit and order state together. */
medicalLabLifecycleRouter.post('/orders/:id/specimens/scan', async (req: AuthRequest, res) => {
  try {
    const order = await getOrder(req.params.id as string);
    if (!order) return res.status(404).json({ ok: false, error: 'Направление не найдено' });
    if (!(await canAccessOrder(req.user!, order, true))) return res.status(403).json({ ok: false, error: 'Нет доступа' });
    const isLabWorkspace = String(req.user?.organizationType || '').toUpperCase() === 'LABORATORY';
    if (!isLabWorkspace || !order.labId || !(await requireMedicalLabCapability(req.user, 'specimen.receive'))) {
      return res.status(403).json({ ok: false, error: 'Сканирование доступно только уполномоченной роли принимающей лаборатории' });
    }
    const barcode = normalizeMedicalLabBarcode(req.body?.barcode);
    if (!barcode) return res.status(400).json({ ok: false, error: 'Отсканируйте или введите корректный barcode' });
    const action = String(req.body?.action || 'received').trim().toLowerCase();
    if (action !== 'received' && action !== 'rejected') return res.status(400).json({ ok: false, error: 'Допустимые действия: received или rejected' });
    const note = String(req.body?.note || '').trim().slice(0, 500);
    if (action === 'rejected' && !note) return res.status(400).json({ ok: false, error: 'Для отклонения образца укажите причину' });
    let specimen: any;
    let orderAdvanced = false;
    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRawUnsafe<Array<{ status: string; labId: string | null }>>(
        'SELECT "status","labId" FROM "medical_lab_orders" WHERE "id"=$1 FOR UPDATE', order.id,
      );
      if (!locked[0] || locked[0].labId !== order.labId) throw new Error('Направление не относится к активной лаборатории');
      const found = await tx.$queryRawUnsafe<any[]>(
        'SELECT * FROM "medical_lab_specimens" WHERE "orderId"=$1 AND "labId"=$2 AND "accessionNumber"=$3 FOR UPDATE',
        order.id, order.labId, barcode,
      );
      if (!found[0]) throw new Error('Образец с таким barcode не найден в этом направлении');
      if (!isMedicalLabSpecimenTransitionAllowed(String(found[0].status), action as any)) {
        throw new Error('Для образца уже выполнено это или несовместимое действие');
      }
      const rows = await tx.$queryRawUnsafe<any[]>(
        'UPDATE "medical_lab_specimens" SET "status"=$1,"receivedAt"=CASE WHEN $1=\'received\' THEN CURRENT_TIMESTAMP ELSE "receivedAt" END,"receivedByUserId"=CASE WHEN $1=\'received\' THEN $2 ELSE "receivedByUserId" END,"location"=COALESCE($3,"location"),"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$4 AND "status"=$5 RETURNING *',
        action, req.user!.id, String(req.body?.location || '').trim().slice(0, 120) || null, found[0].id, found[0].status,
      );
      if (!rows[0]) throw new Error('Состояние образца изменилось. Повторите сканирование.');
      specimen = rows[0];
      await tx.$executeRawUnsafe(
        'INSERT INTO "medical_lab_specimen_events" ("id","specimenId","orderId","labId","eventType","fromStatus","toStatus","location","note","actorUserId","createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CURRENT_TIMESTAMP)',
        uid(), specimen.id, order.id, order.labId, action === 'received' ? 'RECEIVED' : 'REJECTED',
        found[0].status, action, specimen.location, note || (action === 'received' ? 'Barcode scanned at laboratory intake.' : null), req.user!.id,
      );
      if (locked[0].status === 'sample_collected') {
        const countRows = await tx.$queryRawUnsafe<Array<{ pending: bigint; accepted: bigint }>>(
          'SELECT COUNT(*) FILTER (WHERE "status"=\'collected\') AS pending, COUNT(*) FILTER (WHERE "status" IN (\'received\',\'processing\',\'consumed\')) AS accepted FROM "medical_lab_specimens" WHERE "orderId"=$1 AND "labId"=$2',
          order.id, order.labId,
        );
        if (Number(countRows[0]?.pending || 0) === 0 && Number(countRows[0]?.accepted || 0) > 0) {
          const changed = await tx.$executeRawUnsafe(
            'UPDATE "medical_lab_orders" SET "status"=\'received\',"receivedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "status"=\'sample_collected\'',
            order.id,
          );
          if (changed === 1) {
            orderAdvanced = true;
            await tx.$executeRawUnsafe(
              'INSERT INTO "medical_lab_events" ("id","orderId","clinicId","fromStatus","toStatus","note","actorUserId","createdAt") VALUES ($1,$2,$3,\'sample_collected\',\'received\',$4,$5,CURRENT_TIMESTAMP)',
              uid(), order.id, order.clinicId, 'Все зарегистрированные образцы прошли barcode-приёмку.', req.user!.id,
            );
          }
        }
      }
    });
    publish('medicalLabSpecimen.scanned', { orderId: order.id, specimenId: specimen.id, labId: order.labId, action, orderAdvanced, userId: req.user!.id });
    return res.json({ ok: true, data: { specimen, order: await getOrder(order.id), orderAdvanced } } satisfies ApiResponse);
  } catch (error: any) {
    const message = String(error?.message || 'Не удалось обработать barcode');
    return res.status(message.includes('не найден') ? 404 : 409).json({ ok: false, error: message } satisfies ApiResponse);
  }
});

/** Create a child aliquot without losing the parent specimen identity. */
medicalLabLifecycleRouter.post('/orders/:id/specimens/:specimenId/aliquots', async (req: AuthRequest, res) => {
  try {
    const order = await getOrder(req.params.id as string);
    if (!order) return res.status(404).json({ ok: false, error: 'Направление не найдено' });
    if (!(await canAccessOrder(req.user!, order, true))) return res.status(403).json({ ok: false, error: 'Нет доступа' });
    const isLabWorkspace = String(req.user?.organizationType || '').toUpperCase() === 'LABORATORY';
    if (!isLabWorkspace || !order.labId || !(await requireMedicalLabCapability(req.user, 'specimen.collect'))) {
      return res.status(403).json({ ok: false, error: 'Создание аликвот доступно только уполномоченной роли лаборатории' });
    }
    const id = uid();
    const supplied = req.body?.barcode === undefined ? null : normalizeMedicalLabBarcode(req.body.barcode);
    if (req.body?.barcode !== undefined && !supplied) return res.status(400).json({ ok: false, error: 'Barcode аликвоты имеет недопустимый формат' });
    const barcode = supplied || buildMedicalLabBarcode(id);
    const volume = req.body?.volume === undefined || req.body?.volume === null || req.body?.volume === '' ? null : Number(req.body.volume);
    const volumeUnit = String(req.body?.volumeUnit || '').trim().slice(0, 16) || null;
    if (volume !== null && (!Number.isFinite(volume) || volume <= 0 || volume > 100000)) return res.status(400).json({ ok: false, error: 'Некорректный объём аликвоты' });
    if (volume !== null && !volumeUnit) return res.status(400).json({ ok: false, error: 'Укажите единицу объёма аликвоты' });
    let aliquot: any;
    await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<any[]>(
        'SELECT * FROM "medical_lab_specimens" WHERE "id"=$1 AND "orderId"=$2 AND "labId"=$3 FOR UPDATE',
        req.params.specimenId, order.id, order.labId,
      );
      const parent = rows[0];
      if (!parent) throw new Error('Исходный образец не найден');
      if (String(parent.status) !== 'received') throw new Error('Аликвоту можно создать только до передачи образца в обработку');
      if (parent.volume !== null && volume === null) throw new Error('Укажите объём аликвоты для образца с известным объёмом');
      if (volume !== null && parent.volume !== null) {
        if (volumeUnit !== String(parent.volumeUnit || '')) throw new Error('Единица объёма аликвоты должна совпадать с исходным образцом');
        const allocated = await tx.$queryRawUnsafe<Array<{ total: string | number | null }>>(
          'SELECT COALESCE(SUM("volume"),0) AS total FROM "medical_lab_specimens" WHERE "parentSpecimenId"=$1 AND "status"<>\'rejected\'',
          parent.id,
        );
        if (Number(allocated[0]?.total || 0) + volume > Number(parent.volume)) throw new Error('Недостаточный остаток объёма исходного образца');
      }
      const childRows = await tx.$queryRawUnsafe<any[]>(
        'INSERT INTO "medical_lab_specimens" ("id","orderId","labId","accessionNumber","parentSpecimenId","specimenType","containerType","volume","volumeUnit","status","location","collectedAt","receivedAt","createdByUserId","receivedByUserId","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,\'received\',$10,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,$11,$11,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING *',
        id, order.id, order.labId, barcode, parent.id, String(req.body?.specimenType || parent.specimenType).trim().slice(0, 120),
        String(req.body?.containerType || 'Aliquot tube').trim().slice(0, 80), volume, volumeUnit || (volume === null ? null : parent.volumeUnit),
        String(req.body?.location || parent.location || '').trim().slice(0, 120) || null, req.user!.id,
      );
      aliquot = childRows[0];
      await tx.$executeRawUnsafe(
        'INSERT INTO "medical_lab_specimen_events" ("id","specimenId","orderId","labId","eventType","fromStatus","toStatus","location","note","actorUserId","metadata","createdAt") VALUES ($1,$2,$3,$4,\'ALIQUOT_CREATED\',NULL,\'received\',$5,$6,$7,$8::jsonb,CURRENT_TIMESTAMP)',
        uid(), id, order.id, order.labId, aliquot.location, 'Аликвота создана из образца ' + parent.accessionNumber + '.', req.user!.id,
        JSON.stringify({ parentSpecimenId: parent.id, parentBarcode: parent.accessionNumber }),
      );
    });
    publish('medicalLabSpecimen.aliquot_created', { orderId: order.id, specimenId: id, parentSpecimenId: req.params.specimenId, labId: order.labId, userId: req.user!.id });
    return res.status(201).json({ ok: true, data: aliquot } satisfies ApiResponse);
  } catch (error: any) {
    const message = String(error?.message || 'Не удалось создать аликвоту');
    const duplicate = /unique|duplicate/i.test(message);
    return res.status(duplicate ? 409 : 400).json({ ok: false, error: duplicate ? 'Такой barcode уже зарегистрирован' : message } satisfies ApiResponse);
  }
});

medicalLabLifecycleRouter.post('/orders/:id/status', async (req: AuthRequest, res) => {
  try {
    const order = await getOrder(req.params.id as string);
    if (!order) return res.status(404).json({ ok: false, error: 'Направление не найдено' });
    if (!(await canAccessOrder(req.user!, order, true))) return res.status(403).json({ ok: false, error: 'Нет доступа' });
    if (!(await ensureClinicSubscriptionWritableIfClinicActor(req, res, order.clinicId))) return;
    const next = String(req.body?.status || '');
    if (!STATUSES.includes(next as any) || !isMedicalLabTransitionAllowed(order.status, next)) {
      return res.status(400).json({ ok: false, error: `Недопустимый переход ${order.status} → ${next}` });
    }
    const isLabWorkspace = String(req.user?.organizationType || '').toUpperCase() === 'LABORATORY';
    if (order.accessionRequired && next === 'sample_collected') {
      return res.status(409).json({ ok: false, error: 'Сначала зарегистрируйте физический образец и получите barcode', code: 'MEDICAL_LAB_ACCESSION_REQUIRED' });
    }
    if (order.accessionRequired && next === 'received') {
      return res.status(409).json({ ok: false, error: 'Приёмка выполняется сканированием barcode образца', code: 'MEDICAL_LAB_SPECIMEN_SCAN_REQUIRED' });
    }
    if (isLabWorkspace && order.accessionRequired && next === 'processing') {
      const custody = await prisma.$queryRawUnsafe<Array<{ pending: bigint; accepted: bigint }>>(
        'SELECT COUNT(*) FILTER (WHERE "status"=\'collected\') AS pending, COUNT(*) FILTER (WHERE "status" IN (\'received\',\'processing\',\'consumed\')) AS accepted FROM "medical_lab_specimens" WHERE "orderId"=$1 AND "labId"=$2',
        order.id, order.labId,
      );
      if (Number(custody[0]?.pending || 0) > 0 || Number(custody[0]?.accepted || 0) === 0) {
        return res.status(409).json({ ok: false, error: 'Все пробирки должны пройти barcode-приёмку; требуется минимум один принятый образец', code: 'MEDICAL_LAB_CUSTODY_INCOMPLETE' });
      }
    }
    // Final result and verification are dedicated, evidence-backed endpoints.
    // A generic status PATCH must never bypass result completeness, QC or sign-off.
    if (next === 'result_ready' || next === 'verified') {
      return res.status(409).json({ ok: false, error: 'Результат и его выпуск проходят через отдельные защищённые этапы', code: 'LAB_RESULT_RELEASE_WORKFLOW_REQUIRED' });
    }
    if (isLabWorkspace) {
      const requiredCapability: MedicalLabCapability | null =
        next === 'sample_collected' ? 'specimen.collect'
          : next === 'received' ? 'specimen.receive'
            : next === 'processing' ? 'order.process'
              : next === 'cancelled' ? 'order.cancel'
                : null;
      if (!requiredCapability || !(await requireMedicalLabCapability(req.user, requiredCapability))) {
        return res.status(403).json({ ok: false, error: 'Для этого этапа нужна соответствующая роль медицинской лаборатории', code: 'MEDICAL_LAB_CAPABILITY_REQUIRED' });
      }
    } else {
      // The referring clinic can record collection and cancel an order before
      // the laboratory accepts the specimen; all subsequent work belongs to
      // the receiving laboratory.
      if (!((order.status === 'ordered' && (next === 'sample_collected' || next === 'cancelled')))) {
        return res.status(403).json({ ok: false, error: 'После передачи образца дальнейшие действия доступны лаборатории', code: 'MEDICAL_LAB_PARTNER_ACTION_REQUIRED' });
      }
    }
    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRawUnsafe<Array<{ id: string; status: string }>>(
        `SELECT "id","status" FROM "medical_lab_orders" WHERE "id"=$1 FOR UPDATE`,
        order.id,
      );
      if (!locked[0] || locked[0].status !== order.status) {
        throw new Error('Medical laboratory order changed. Refresh and retry.');
      }

      let changed: number;
      if (next === 'sample_collected') {
        changed = await tx.$executeRawUnsafe(
          `UPDATE "medical_lab_orders" SET "status"=$1,"collectedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$2 AND "status"=$3`,
          next, order.id, order.status,
        );
      } else if (next === 'received') {
        changed = await tx.$executeRawUnsafe(
          `UPDATE "medical_lab_orders" SET "status"=$1,"receivedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$2 AND "status"=$3`,
          next, order.id, order.status,
        );
      } else if (next === 'processing' && order.status === 'result_ready') {
        // A failed QC/rework cycle invalidates the previous QC decision and
        // clears the active result values. Preserve the previous signed-off
        // attempt in each test's immutable-in-practice resultHistory snapshot.
        const previousTests = await tx.$queryRawUnsafe<Array<{
          id: string; name: string; result: string | null; resultText: string | null;
          unit: string | null; referenceRange: string | null; flag: string | null; metadata: unknown;
        }>>(
          `SELECT "id","name","result","resultText","unit","referenceRange","flag","metadata"
             FROM "medical_lab_order_tests" WHERE "orderId"=$1 FOR UPDATE`,
          order.id,
        );
        const reworkAt = new Date().toISOString();
        for (const test of previousTests) {
          const reset = resetMedicalLabResultForRework(test, req.user!.id, reworkAt);
          await tx.$executeRawUnsafe(
            `UPDATE "medical_lab_order_tests"
               SET "result"=$1,"resultText"=$2,"unit"=$3,"referenceRange"=$4,"flag"=$5,
                   "metadata"=$6::jsonb,"updatedAt"=CURRENT_TIMESTAMP
             WHERE "id"=$7 AND "orderId"=$8`,
            reset.result, reset.resultText, reset.unit, reset.referenceRange, reset.flag,
            JSON.stringify(reset.metadata), test.id, order.id,
          );
        }
        changed = await tx.$executeRawUnsafe(
          `UPDATE "medical_lab_orders"
             SET "status"=$1,"resultReadyAt"=NULL,
                 "metadata"=COALESCE("metadata",'{}'::jsonb) - 'qualityControl',
                 "updatedAt"=CURRENT_TIMESTAMP
           WHERE "id"=$2 AND "status"=$3`,
          next, order.id, order.status,
        );
      } else {
        changed = await tx.$executeRawUnsafe(
          `UPDATE "medical_lab_orders" SET "status"=$1,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$2 AND "status"=$3`,
          next, order.id, order.status,
        );
      }
      if (changed !== 1) throw new Error('Medical laboratory order changed. Refresh and retry.');
      if (order.accessionRequired && next === 'processing' && order.status === 'received') {
        const acceptedSpecimens = await tx.$queryRawUnsafe<Array<{ id: string; status: string; location: string | null }>>(
          'SELECT "id","status","location" FROM "medical_lab_specimens" WHERE "orderId"=$1 AND "labId"=$2 AND "status"=\'received\' FOR UPDATE',
          order.id, order.labId,
        );
        for (const specimen of acceptedSpecimens) {
          await tx.$executeRawUnsafe(
            'UPDATE "medical_lab_specimens" SET "status"=\'processing\',"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "status"=\'received\'',
            specimen.id,
          );
          await tx.$executeRawUnsafe(
            'INSERT INTO "medical_lab_specimen_events" ("id","specimenId","orderId","labId","eventType","fromStatus","toStatus","location","note","actorUserId","createdAt") VALUES ($1,$2,$3,$4,\'PROCESSING_STARTED\',\'received\',\'processing\',$5,$6,$7,CURRENT_TIMESTAMP)',
            uid(), specimen.id, order.id, order.labId, specimen.location, 'Образец передан на этап лабораторного исследования.', req.user!.id,
          );
        }
      }
      await tx.$executeRawUnsafe(
        `INSERT INTO "medical_lab_events" ("id","orderId","clinicId","fromStatus","toStatus","note","actorUserId","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_TIMESTAMP)`,
        uid(), order.id, order.clinicId, order.status, next,
        next === 'processing' && order.status === 'result_ready'
          ? 'Начат повторный анализ: предыдущие результаты сохранены в истории, активные значения и решение QC сброшены.'
          : (req.body?.note ? String(req.body.note) : null), req.user!.id,
      );
    });
    publish('medicalLabOrder.status_changed', { orderId: order.id, clinicId: order.clinicId, fromStatus: order.status, toStatus: next, userId: req.user!.id });
    return res.json({ ok: true, data: await getOrder(order.id) } satisfies ApiResponse);
  } catch (e: any) { return res.status(400).json({ ok: false, error: e.message || 'Не удалось изменить статус' } satisfies ApiResponse); }
});

medicalLabLifecycleRouter.post('/orders/:id/results', async (req: AuthRequest, res) => {
  try {
    const order = await getOrder(req.params.id as string);
    if (!order) return res.status(404).json({ ok: false, error: 'Направление не найдено' });
    if (!(await canAccessOrder(req.user!, order, true))) return res.status(403).json({ ok: false, error: 'Нет доступа' });
    if (!(await ensureClinicSubscriptionWritableIfClinicActor(req, res, order.clinicId))) return;
    if (String(req.user?.organizationType || '').toUpperCase() !== 'LABORATORY'
      || !(await requireMedicalLabCapability(req.user, 'result.write'))) {
      return res.status(403).json({ ok: false, error: 'Ввод результатов доступен только уполномоченному сотруднику лаборатории', code: 'MEDICAL_LAB_RESULT_ENTRY_FORBIDDEN' });
    }
    if (order.status !== 'processing') {
      return res.status(409).json({ ok: false, error: 'Сначала переведите образец в этап исследования', code: 'MEDICAL_LAB_NOT_PROCESSING' });
    }

    const tests = await prisma.$queryRawUnsafe<Array<{ id: string; name: string; result: string | null; resultText: string | null; metadata: unknown }>>(
      `SELECT "id","name","result","resultText","metadata" FROM "medical_lab_order_tests" WHERE "orderId"=$1 ORDER BY "createdAt" ASC`,
      order.id,
    );
    const validation = validateMedicalLabResultSet(tests, req.body?.results);
    if (validation.ok === false) return res.status(400).json({ ok: false, error: validation.message, code: validation.code });

    const submittedAt = new Date().toISOString();
    await prisma.$transaction(async (tx) => {
      for (const result of validation.results) {
        const existing = tests.find((test) => test.id === result.id);
        const metadata = {
          ...jsonObject(existing?.metadata),
          resultEnteredByUserId: req.user!.id,
          resultEnteredAt: submittedAt,
        };
        await tx.$executeRawUnsafe(
          `UPDATE "medical_lab_order_tests"
             SET "result"=$1,"unit"=$2,"referenceRange"=$3,"flag"=$4,"resultText"=$5,"metadata"=$6::jsonb,"updatedAt"=CURRENT_TIMESTAMP
           WHERE "id"=$7 AND "orderId"=$8`,
          result.result, result.unit, result.referenceRange, result.flag, result.resultText,
          JSON.stringify(metadata), result.id, order.id,
        );
      }
      const changed = await tx.$executeRawUnsafe(
        `UPDATE "medical_lab_orders" SET "status"='result_ready',"resultReadyAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "status"='processing'`,
        order.id,
      );
      if (changed !== 1) throw new Error('Medical laboratory order changed while results were being saved');
      await tx.$executeRawUnsafe(
        `INSERT INTO "medical_lab_events" ("id","orderId","clinicId","fromStatus","toStatus","note","actorUserId","createdAt")
         VALUES ($1,$2,$3,'processing','result_ready',$4,$5,CURRENT_TIMESTAMP)`,
        uid(), order.id, order.clinicId, 'Полный набор результатов сохранён; ожидает независимого QC.', req.user!.id,
      );
    });
    publish('medicalLabResult.ready', { orderId: order.id, clinicId: order.clinicId, patientId: order.patientId, treatmentCaseId: order.treatmentCaseId, userId: req.user!.id });
    return res.json({ ok: true, data: await getOrder(order.id) } satisfies ApiResponse);
  } catch (e: any) { return res.status(400).json({ ok: false, error: e.message || 'Не удалось сохранить результаты' } satisfies ApiResponse); }
});

medicalLabLifecycleRouter.post('/orders/:id/quality-control', async (req: AuthRequest, res) => {
  try {
    const order = await getOrder(req.params.id as string);
    if (!order) return res.status(404).json({ ok: false, error: 'Направление не найдено' });
    if (!(await canAccessOrder(req.user!, order, true))) return res.status(403).json({ ok: false, error: 'Нет доступа' });
    if (String(req.user?.organizationType || '').toUpperCase() !== 'LABORATORY'
      || !(await requireMedicalLabCapability(req.user, 'quality.perform'))) {
      return res.status(403).json({ ok: false, error: 'Контроль качества доступен только уполномоченной роли лаборатории', code: 'MEDICAL_LAB_QC_FORBIDDEN' });
    }
    if (order.status !== 'result_ready') return res.status(409).json({ ok: false, error: 'Контроль качества возможен после внесения всех результатов' });
    const previousQualityControl = jsonObject(jsonObject(order.metadata).qualityControl);
    if (previousQualityControl.performedAt) {
      return res.status(409).json({
        ok: false,
        error: 'Решение QC уже зафиксировано. Для повторной проверки верните заказ на доработку и внесите новый полный набор результатов.',
        code: 'MEDICAL_LAB_QC_ALREADY_RECORDED',
      });
    }

    const decisionValue = String(req.body?.decision || '').trim().toLowerCase();
    if (decisionValue !== 'passed' && decisionValue !== 'failed') {
      return res.status(400).json({ ok: false, error: 'decision должен быть passed или failed' });
    }
    const decision: 'passed' | 'failed' = decisionValue;
    const qualityNote = String(req.body?.note || '').trim();
    if (decision === 'failed' && !qualityNote) {
      return res.status(400).json({ ok: false, error: 'При отклонении QC необходимо указать причину', code: 'MEDICAL_LAB_QC_REASON_REQUIRED' });
    }
    const tests = await prisma.$queryRawUnsafe<Array<{ id: string; name: string; result: string | null; resultText: string | null; metadata: unknown }>>(
      `SELECT "id","name","result","resultText","metadata" FROM "medical_lab_order_tests" WHERE "orderId"=$1 ORDER BY "createdAt" ASC`,
      order.id,
    );
    const existingResults = tests.map((test) => ({
      id: test.id,
      result: test.result,
      resultText: test.resultText,
    }));
    const validation = validateMedicalLabResultSet(tests, existingResults);
    if (validation.ok === false) return res.status(409).json({ ok: false, error: validation.message, code: 'MEDICAL_LAB_RESULTS_INCOMPLETE' });
    const resultAuthors = new Set(tests.map((test) => String(jsonObject(test.metadata).resultEnteredByUserId || '')).filter(Boolean));
    if (resultAuthors.has(req.user!.id)) {
      return res.status(409).json({ ok: false, error: 'Контроль качества должен выполнить другой сотрудник, не вводивший результат', code: 'MEDICAL_LAB_SEPARATION_OF_DUTIES' });
    }

    const qualityControl = {
      decision,
      note: qualityNote || null,
      performedByUserId: req.user!.id,
      performedAt: new Date().toISOString(),
    };
    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRawUnsafe<Array<{ id: string; status: string }>>(
        `SELECT "id","status" FROM "medical_lab_orders" WHERE "id"=$1 FOR UPDATE`,
        order.id,
      );
      if (!locked[0] || locked[0].status !== 'result_ready') {
        throw new Error('Medical laboratory order changed before QC was recorded');
      }
      const changed = await tx.$executeRawUnsafe(
        `UPDATE "medical_lab_orders"
           SET "metadata"=jsonb_set(COALESCE("metadata",'{}'::jsonb),'{qualityControl}',$1::jsonb,true),"updatedAt"=CURRENT_TIMESTAMP
         WHERE "id"=$2 AND "status"='result_ready'`,
        JSON.stringify(qualityControl), order.id,
      );
      if (changed !== 1) throw new Error('Medical laboratory order changed before QC was recorded');
      await tx.$executeRawUnsafe(
        `INSERT INTO "medical_lab_events" ("id","orderId","clinicId","fromStatus","toStatus","note","actorUserId","createdAt")
         VALUES ($1,$2,$3,'result_ready',$4,$5,$6,CURRENT_TIMESTAMP)`,
        uid(), order.id, order.clinicId, decision === 'passed' ? 'qc_passed' : 'qc_failed',
        qualityControl.note, req.user!.id,
      );
    });
    publish('medicalLabQuality.completed', { orderId: order.id, clinicId: order.clinicId, patientId: order.patientId, decision, userId: req.user!.id });
    return res.json({ ok: true, data: await getOrder(order.id) } satisfies ApiResponse);
  } catch (e: any) { return res.status(400).json({ ok: false, error: e.message || 'Не удалось выполнить контроль качества' } satisfies ApiResponse); }
});

medicalLabLifecycleRouter.post('/orders/:id/verify', async (req: AuthRequest, res) => {
  try {
    const order = await getOrder(req.params.id as string);
    if (!order) return res.status(404).json({ ok: false, error: 'Направление не найдено' });
    if (!(await canAccessOrder(req.user!, order, true))) return res.status(403).json({ ok: false, error: 'Нет доступа' });
    if (!(await ensureClinicSubscriptionWritableIfClinicActor(req, res, order.clinicId))) return;
    if (String(req.user?.organizationType || '').toUpperCase() !== 'LABORATORY'
      || !(await requireMedicalLabCapability(req.user, 'result.verify'))) {
      return res.status(403).json({ ok: false, error: 'Выпуск результата доступен только лабораторному валидатору', code: 'MEDICAL_LAB_VALIDATOR_REQUIRED' });
    }
    if (order.status !== 'result_ready') return res.status(409).json({ ok: false, error: 'Результат ещё не готов к верификации' });

    const tests = await prisma.$queryRawUnsafe<Array<{ id: string; name: string; result: string | null; resultText: string | null; metadata: unknown }>>(
      `SELECT "id","name","result","resultText","metadata" FROM "medical_lab_order_tests" WHERE "orderId"=$1 ORDER BY "createdAt" ASC`,
      order.id,
    );
    const validation = validateMedicalLabResultSet(tests, tests.map((test) => ({
      id: test.id, result: test.result, resultText: test.resultText,
    })));
    if (validation.ok === false) return res.status(409).json({ ok: false, error: validation.message, code: 'MEDICAL_LAB_RESULTS_INCOMPLETE' });

    const qualityControl = jsonObject(jsonObject(order.metadata).qualityControl);
    if (qualityControl.decision !== 'passed' || !qualityControl.performedByUserId) {
      return res.status(409).json({ ok: false, error: 'До выпуска результата необходимо пройти независимый контроль качества', code: 'MEDICAL_LAB_QC_REQUIRED' });
    }
    if (qualityControl.performedByUserId === req.user!.id) {
      return res.status(409).json({ ok: false, error: 'Валидатор не может выпускать результат, который он сам проверял по QC', code: 'MEDICAL_LAB_SEPARATION_OF_DUTIES' });
    }
    const resultAuthors = new Set(tests.map((test) => String(jsonObject(test.metadata).resultEnteredByUserId || '')).filter(Boolean));
    if (resultAuthors.has(req.user!.id)) {
      return res.status(409).json({ ok: false, error: 'Валидатор не может выпустить собственный результат', code: 'MEDICAL_LAB_SEPARATION_OF_DUTIES' });
    }

    await prisma.$transaction(async (tx) => {
      const changed = await tx.$executeRawUnsafe(
        `UPDATE "medical_lab_orders" SET "status"='verified',"verifiedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "status"='result_ready'`,
        order.id,
      );
      if (changed !== 1) throw new Error('Medical laboratory order changed while being verified');
      await tx.$executeRawUnsafe(
        `UPDATE "medical_lab_order_tests" SET "verifiedAt"=CURRENT_TIMESTAMP,"verifiedByUserId"=$1,"updatedAt"=CURRENT_TIMESTAMP WHERE "orderId"=$2`,
        req.user!.id, order.id,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO "medical_lab_events" ("id","orderId","clinicId","fromStatus","toStatus","note","actorUserId","createdAt")
         VALUES ($1,$2,$3,'result_ready','verified',$4,$5,CURRENT_TIMESTAMP)`,
        uid(), order.id, order.clinicId, 'Результат прошёл QC и независимую клиническую верификацию.', req.user!.id,
      );
    });
    publish('medicalLabResult.verified', { orderId: order.id, clinicId: order.clinicId, patientId: order.patientId, treatmentCaseId: order.treatmentCaseId, userId: req.user!.id });
    return res.json({ ok: true, data: await getOrder(order.id) } satisfies ApiResponse);
  } catch (e: any) { return res.status(400).json({ ok: false, error: e.message || 'Не удалось подтвердить результат' } satisfies ApiResponse); }
});

medicalLabLifecycleRouter.post('/orders/:id/interpretation', async (req: AuthRequest, res) => {
  try {
    const order = await getOrder(req.params.id as string);
    if (!order) return res.status(404).json({ ok: false, error: 'Направление не найдено' });
    if (!(await canAccessOrder(req.user!, order, true))) return res.status(403).json({ ok: false, error: 'Нет доступа' });
    if (!(await ensureClinicSubscriptionWritableIfClinicActor(req, res, order.clinicId))) return;
    if (String(req.user?.organizationType || '').toUpperCase() !== 'LABORATORY'
      || !(await requireMedicalLabCapability(req.user, 'result.interpret'))) {
      return res.status(403).json({ ok: false, error: 'Клиническая интерпретация доступна только уполномоченному врачу лаборатории', code: 'MEDICAL_LAB_DOCTOR_REQUIRED' });
    }
    if (order.status !== 'verified') return res.status(409).json({ ok: false, error: 'Интерпретация выполняется только после верификации лабораторного результата' });
    const interpretation = String(req.body?.interpretation || '').trim();
    if (!interpretation) return res.status(400).json({ ok: false, error: 'Интерпретация не может быть пустой' });
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`UPDATE "medical_lab_orders" SET "interpretation"=$1,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$2 AND "status"='verified'`, interpretation, order.id);
      await tx.$executeRawUnsafe(
        `INSERT INTO "medical_lab_events" ("id","orderId","clinicId","fromStatus","toStatus","note","actorUserId","createdAt")
         VALUES ($1,$2,$3,'verified','interpreted',$4,$5,CURRENT_TIMESTAMP)`,
        uid(), order.id, order.clinicId, interpretation, req.user!.id,
      );
    });
    publish('medicalLabResult.interpreted', { orderId: order.id, clinicId: order.clinicId, patientId: order.patientId, treatmentCaseId: order.treatmentCaseId, userId: req.user!.id, source: 'human' });
    return res.json({ ok: true, data: await getOrder(order.id) } satisfies ApiResponse);
  } catch (e: any) { return res.status(400).json({ ok: false, error: e.message || 'Не удалось сохранить интерпретацию' } satisfies ApiResponse); }
});
