import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { uid } from '../../lib/helpers.js';
import { tengeToMinor } from '../../lib/money.js';
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
