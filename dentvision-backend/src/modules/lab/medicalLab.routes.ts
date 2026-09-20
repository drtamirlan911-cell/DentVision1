import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { uid } from '../../lib/helpers.js';
import { assertOrgAccess } from '../../lib/orgContext.js';
import { publish } from '../../lib/events.js';

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

type OrderRow = {
  id: string; clinicId: string; patientId: string | null; treatmentCaseId: string | null;
  labId: string | null; orderedByUserId: string; status: string; priority: string;
  notes: string | null; specimenType: string | null; collectedAt: Date | null;
  receivedAt: Date | null; resultReadyAt: Date | null; verifiedAt: Date | null;
  interpretation: string | null; metadata: unknown; createdAt: Date; updatedAt: Date | null;
};

async function getOrder(id: string): Promise<OrderRow | null> {
  const rows = await prisma.$queryRawUnsafe<OrderRow[]>(`
    SELECT "id","clinicId","patientId","treatmentCaseId","labId","orderedByUserId","status","priority","notes","specimenType","collectedAt","receivedAt","resultReadyAt","verifiedAt","interpretation","metadata","createdAt","updatedAt"
    FROM "medical_lab_orders" WHERE "id" = $1 LIMIT 1`, id);
  return rows[0] ?? null;
}

async function canAccessOrder(user: AuthRequest['user'], order: OrderRow, write = false): Promise<boolean> {
  if (user?.role === 'SUPERADMIN') return true;
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
  if (order.labId && user?.organizationId === order.labId && (user as any).organizationType === 'LABORATORY') return true;
  if (!write && order.clinicId) return assertOrgAccess(user!, order.clinicId);
  return false;
}

async function recordEvent(orderId: string, clinicId: string, fromStatus: string | null, toStatus: string, userId: string, note?: string) {
  await prisma.$executeRawUnsafe(`INSERT INTO "medical_lab_events" ("id","orderId","clinicId","fromStatus","toStatus","note","actorUserId","createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_TIMESTAMP)`, uid(), orderId, clinicId, fromStatus, toStatus, note ?? null, userId);
}

medicalLabLifecycleRouter.get('/orders', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    const patientId = typeof req.query.patientId === 'string' ? req.query.patientId : null;
    const caseId = typeof req.query.caseId === 'string' ? req.query.caseId : null;
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    const where: string[] = [];
    const args: unknown[] = [];
    if (clinicId) {
      args.push(clinicId); where.push(`o."clinicId" = ${args.length}`);
      const role = String(req.user?.role || '').toUpperCase();
      const branchIds = (req.user?.branchIds ?? []).filter(Boolean);
      if (!['SUPERADMIN', 'OWNER', 'ADMIN'].includes(role)) {
        if (branchIds.length === 0) return res.json({ ok: true, data: [] } satisfies ApiResponse);
        args.push(branchIds); where.push(`EXISTS (SELECT 1 FROM "patients" p WHERE p."id" = o."patientId" AND p."branchId" = ANY(${args.length}::text[]))`);
      }
    } else if (req.user?.organizationId && (req.user as any).organizationType === 'LABORATORY') { args.push(req.user.organizationId); where.push(`o."labId" = ${args.length}`); }
    else return res.status(403).json({ ok: false, error: 'Нет рабочего контекста' } satisfies ApiResponse);
    if (patientId) { args.push(patientId); where.push(`o."patientId" = $${args.length}`); }
    if (caseId) { args.push(caseId); where.push(`o."treatmentCaseId" = $${args.length}`); }
    if (status && STATUSES.includes(status as any)) { args.push(status); where.push(`o."status" = $${args.length}`); }
    const rows = await prisma.$queryRawUnsafe<OrderRow[]>(`SELECT o.* FROM "medical_lab_orders" o WHERE ${where.join(' AND ')} ORDER BY o."createdAt" DESC LIMIT 200`, ...args);
    return res.json({ ok: true, data: rows } satisfies ApiResponse);
  } catch (e: any) { return res.status(500).json({ ok: false, error: e.message || 'Не удалось получить медицинские анализы' } satisfies ApiResponse); }
});

medicalLabLifecycleRouter.post('/orders', requirePermission('patient.read'), async (req: AuthRequest, res) => {
  try {
    const clinicId = String(req.user?.clinicId || req.body?.clinicId || '');
    if (!clinicId || !(await assertOrgAccess(req.user!, clinicId))) return res.status(403).json({ ok: false, error: 'Нет доступа к клинике' });
    const { patientId = null, treatmentCaseId = null, labId = null, priority = 'routine', notes = null, specimenType = null, tests = [], metadata = null } = req.body || {};
    if (patientId) {
      const patient = await prisma.patient.findFirst({ where: { id: String(patientId), clinicId }, select: { id: true } });
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
    await prisma.$executeRawUnsafe(`INSERT INTO "medical_lab_orders" ("id","clinicId","patientId","treatmentCaseId","labId","orderedByUserId","status","priority","notes","specimenType","metadata","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,'ordered',$7,$8,$9,$10,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`, id, clinicId, patientId ? String(patientId) : null, treatmentCaseId ? String(treatmentCaseId) : null, labId ? String(labId) : null, req.user!.id, String(priority), notes ? String(notes) : null, specimenType ? String(specimenType) : null, metadata ?? null);
    for (const test of Array.isArray(tests) ? tests : []) {
      await prisma.$executeRawUnsafe(`INSERT INTO "medical_lab_order_tests" ("id","orderId","testId","name","analyteCode","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`, uid(), id, test.testId ? String(test.testId) : null, String(test.name || 'Анализ'), test.analyteCode ? String(test.analyteCode) : null);
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
    const [tests, events] = await Promise.all([
      prisma.$queryRawUnsafe(`SELECT * FROM "medical_lab_order_tests" WHERE "orderId"=$1 ORDER BY "createdAt" ASC`, order.id),
      prisma.$queryRawUnsafe(`SELECT * FROM "medical_lab_events" WHERE "orderId"=$1 ORDER BY "createdAt" ASC`, order.id),
    ]);
    return res.json({ ok: true, data: { order, tests, events } } satisfies ApiResponse);
  } catch (e: any) { return res.status(500).json({ ok: false, error: e.message || 'Ошибка направления' } satisfies ApiResponse); }
});

medicalLabLifecycleRouter.post('/orders/:id/status', async (req: AuthRequest, res) => {
  try {
    const order = await getOrder(req.params.id as string);
    if (!order) return res.status(404).json({ ok: false, error: 'Направление не найдено' });
    if (!(await canAccessOrder(req.user!, order, true))) return res.status(403).json({ ok: false, error: 'Нет доступа' });
    const next = String(req.body?.status || '');
    if (!STATUSES.includes(next as any) || !(TRANSITIONS[order.status] || []).includes(next)) return res.status(400).json({ ok: false, error: `Недопустимый переход ${order.status} → ${next}` });
    if (next === 'sample_collected') await prisma.$executeRawUnsafe(`UPDATE "medical_lab_orders" SET "status"=$1,"collectedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$2`, next, order.id);
    else if (next === 'received') await prisma.$executeRawUnsafe(`UPDATE "medical_lab_orders" SET "status"=$1,"receivedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$2`, next, order.id);
    else if (next === 'result_ready') await prisma.$executeRawUnsafe(`UPDATE "medical_lab_orders" SET "status"=$1,"resultReadyAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$2`, next, order.id);
    else if (next === 'verified') await prisma.$executeRawUnsafe(`UPDATE "medical_lab_orders" SET "status"=$1,"verifiedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$2`, next, order.id);
    else await prisma.$executeRawUnsafe(`UPDATE "medical_lab_orders" SET "status"=$1,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$2`, next, order.id);
    await recordEvent(order.id, order.clinicId, order.status, next, req.user!.id, req.body?.note ? String(req.body.note) : undefined);
    publish('medicalLabOrder.status_changed', { orderId: order.id, clinicId: order.clinicId, fromStatus: order.status, toStatus: next, userId: req.user!.id });
    return res.json({ ok: true, data: await getOrder(order.id) } satisfies ApiResponse);
  } catch (e: any) { return res.status(400).json({ ok: false, error: e.message || 'Не удалось изменить статус' } satisfies ApiResponse); }
});

medicalLabLifecycleRouter.post('/orders/:id/results', async (req: AuthRequest, res) => {
  try {
    const order = await getOrder(req.params.id as string);
    if (!order) return res.status(404).json({ ok: false, error: 'Направление не найдено' });
    if (!(await canAccessOrder(req.user!, order, true))) return res.status(403).json({ ok: false, error: 'Нет доступа' });
    const rows = Array.isArray(req.body?.results) ? req.body.results : [];
    if (!rows.length) return res.status(400).json({ ok: false, error: 'Результаты не переданы' });
    for (const result of rows) {
      if (!result.id) continue;
      await prisma.$executeRawUnsafe(`UPDATE "medical_lab_order_tests" SET "result"=$1,"unit"=$2,"referenceRange"=$3,"flag"=$4,"resultText"=$5,"metadata"=$6,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$7 AND "orderId"=$8`, result.result ?? null, result.unit ?? null, result.referenceRange ?? null, result.flag ?? null, result.resultText ?? null, result.metadata ?? null, String(result.id), order.id);
    }
    if (order.status === 'processing' || order.status === 'received') {
      await prisma.$executeRawUnsafe(`UPDATE "medical_lab_orders" SET "status"='result_ready',"resultReadyAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`, order.id);
      await recordEvent(order.id, order.clinicId, order.status, 'result_ready', req.user!.id);
    }
    publish('medicalLabResult.ready', { orderId: order.id, clinicId: order.clinicId, patientId: order.patientId, treatmentCaseId: order.treatmentCaseId, userId: req.user!.id });
    return res.json({ ok: true, data: await getOrder(order.id) } satisfies ApiResponse);
  } catch (e: any) { return res.status(400).json({ ok: false, error: e.message || 'Не удалось сохранить результаты' } satisfies ApiResponse); }
});

medicalLabLifecycleRouter.post('/orders/:id/verify', async (req: AuthRequest, res) => {
  try {
    const order = await getOrder(req.params.id as string);
    if (!order) return res.status(404).json({ ok: false, error: 'Направление не найдено' });
    if (!(await canAccessOrder(req.user!, order, true))) return res.status(403).json({ ok: false, error: 'Нет доступа' });
    if (order.status !== 'result_ready') return res.status(400).json({ ok: false, error: 'Результат ещё не готов к верификации' });
    await prisma.$executeRawUnsafe(`UPDATE "medical_lab_order_tests" SET "verifiedAt"=CURRENT_TIMESTAMP,"verifiedByUserId"=$1,"updatedAt"=CURRENT_TIMESTAMP WHERE "orderId"=$2`, req.user!.id, order.id);
    await prisma.$executeRawUnsafe(`UPDATE "medical_lab_orders" SET "status"='verified',"verifiedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`, order.id);
    await recordEvent(order.id, order.clinicId, 'result_ready', 'verified', req.user!.id);
    publish('medicalLabResult.verified', { orderId: order.id, clinicId: order.clinicId, patientId: order.patientId, treatmentCaseId: order.treatmentCaseId, userId: req.user!.id });
    return res.json({ ok: true, data: await getOrder(order.id) } satisfies ApiResponse);
  } catch (e: any) { return res.status(400).json({ ok: false, error: e.message || 'Не удалось подтвердить результат' } satisfies ApiResponse); }
});

medicalLabLifecycleRouter.post('/orders/:id/interpretation', async (req: AuthRequest, res) => {
  try {
    const order = await getOrder(req.params.id as string);
    if (!order) return res.status(404).json({ ok: false, error: 'Направление не найдено' });
    if (!(await canAccessOrder(req.user!, order, true))) return res.status(403).json({ ok: false, error: 'Нет доступа' });
    const interpretation = String(req.body?.interpretation || '').trim();
    if (!interpretation) return res.status(400).json({ ok: false, error: 'Интерпретация не может быть пустой' });
    await prisma.$executeRawUnsafe(`UPDATE "medical_lab_orders" SET "interpretation"=$1,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$2`, interpretation, order.id);
    publish('medicalLabResult.interpreted', { orderId: order.id, clinicId: order.clinicId, patientId: order.patientId, treatmentCaseId: order.treatmentCaseId, userId: req.user!.id, source: req.body?.source || 'human' });
    return res.json({ ok: true, data: await getOrder(order.id) } satisfies ApiResponse);
  } catch (e: any) { return res.status(400).json({ ok: false, error: e.message || 'Не удалось сохранить интерпретацию' } satisfies ApiResponse); }
});
