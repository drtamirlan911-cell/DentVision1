import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { uid } from '../../lib/helpers.js';
import { tengeToMinor } from '../../lib/money.js';
import { loadClinicAccess, blockClinicWrites } from '../../middleware/planGate.js';
import { isClinicMember } from '../../lib/orgContext.js';
import { publish } from '../../lib/events.js';
import { recordPartnerEconomics } from '../finance/partner-economics.service.js';
import { labPlatformRouter } from './labPlatform.routes.js';
import { medicalLabLifecycleRouter } from './medicalLab.routes.js';

export const labRouter = Router();
labRouter.use('/platform', labPlatformRouter);
labRouter.use('/medical-laboratory', medicalLabLifecycleRouter);

labRouter.use(authenticate);
labRouter.use(requirePermission('patient.read'));
labRouter.use(loadClinicAccess);
labRouter.use(blockClinicWrites);

interface LabOrderMeta {
  patientName?: string;
  material?: string;
  toothNumber?: string | number;
  shade?: string;
  remakeOfId?: string;
  appointmentId?: string;
  tryInDate?: string;
  laboratoryId?: string;
  technicianId?: string;
  doctorId?: string;
  treatmentCaseId?: string;
}

export const VALID_STATUSES = [
  'pending', 'sent', 'in_progress', 'try_in', 'adjustment',
  'ready', 'delivered', 'remake', 'delayed', 'cancelled',
] as const;

let dentalLabOrderEventsReady: Promise<void> | null = null;
function ensureDentalLabOrderEventsTable(): Promise<void> {
  if (dentalLabOrderEventsReady) return dentalLabOrderEventsReady;
  dentalLabOrderEventsReady = prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "dental_lab_order_events" (
      "id" TEXT NOT NULL,
      "labOrderId" TEXT NOT NULL,
      "clinicId" TEXT NOT NULL,
      "fromStatus" TEXT NOT NULL,
      "toStatus" TEXT NOT NULL,
      "actorUserId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "dental_lab_order_events_pkey" PRIMARY KEY ("id")
    )
  `).then(async () => {
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "dental_lab_order_events_labOrderId_createdAt_idx" ON "dental_lab_order_events"("labOrderId", "createdAt")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "dental_lab_order_events_clinicId_createdAt_idx" ON "dental_lab_order_events"("clinicId", "createdAt")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "dental_lab_order_events_actorUserId_createdAt_idx" ON "dental_lab_order_events"("actorUserId", "createdAt")`);
  }).catch((error) => {
    dentalLabOrderEventsReady = null;
    throw error;
  });
  return dentalLabOrderEventsReady;
}

function branchScopedLabOrder(req: AuthRequest): Record<string, unknown> {
  const role = String(req.user?.role || '').toUpperCase();
  if (['SUPERADMIN', 'OWNER', 'ADMIN'].includes(role)) return {};
  const branchIds = (req.user?.branchIds ?? []).filter(Boolean);
  return branchIds.length > 0
    ? { patient: { branchId: { in: branchIds } } }
    : { patient: { branchId: '__NO_BRANCH_ACCESS__' } };
}

function serializeLabOrder(order: {
  id: string; clinicId: string; patientId: string | null; labName: string | null;
  status: string; type: string | null; notes: string | null; files: unknown;
  deadline: Date | null; price: number | null; createdAt: Date; updatedAt: Date;
  doctorId?: string | null;
}) {
  const meta = (order.files as { meta?: LabOrderMeta } | null)?.meta || {};
  return {
    id: order.id, clinicId: order.clinicId, patientId: order.patientId,
    patientName: meta.patientName || order.labName || '', labType: order.type,
    material: meta.material || '', toothNumber: meta.toothNumber || '', shade: meta.shade || '',
    laboratoryId: meta.laboratoryId || null, technicianId: meta.technicianId || null,
    remakeOfId: meta.remakeOfId || null, appointmentId: meta.appointmentId || null,
    tryInDate: meta.tryInDate || null,
    treatmentCaseId: meta.treatmentCaseId || null, doctorId: order.doctorId ?? meta.doctorId ?? null,
    dueDate: order.deadline, notes: order.notes, status: order.status, price: order.price,
    createdAt: order.createdAt, updatedAt: order.updatedAt,
  };
}

function buildMeta(body: Partial<LabOrderMeta>, existing: LabOrderMeta = {}): LabOrderMeta {
  return {
    ...existing,
    ...(body.patientName !== undefined ? { patientName: body.patientName } : {}),
    ...(body.material !== undefined ? { material: body.material } : {}),
    ...(body.toothNumber !== undefined ? { toothNumber: body.toothNumber } : {}),
    ...(body.shade !== undefined ? { shade: body.shade } : {}),
    ...(body.remakeOfId !== undefined ? { remakeOfId: body.remakeOfId } : {}),
    ...(body.appointmentId !== undefined ? { appointmentId: body.appointmentId } : {}),
    ...(body.tryInDate !== undefined ? { tryInDate: body.tryInDate } : {}),
    ...(body.laboratoryId !== undefined ? { laboratoryId: body.laboratoryId } : {}),
    ...(body.technicianId !== undefined ? { technicianId: body.technicianId } : {}),
    ...(body.treatmentCaseId !== undefined ? { treatmentCaseId: body.treatmentCaseId } : {}),
  };
}

labRouter.get('/', requirePermission('appointment.read'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user!.clinicId;
    if (!clinicId) return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '200'), 10) || 200, 1), 1000);
    const orders = await prisma.labOrder.findMany({ where: { clinicId, ...branchScopedLabOrder(req) }, orderBy: { createdAt: 'desc' }, take: limit });
    return res.json({ ok: true, data: orders.map(serializeLabOrder) } satisfies ApiResponse);
  } catch (error: any) {
    console.error('[Lab] list error:', error);
    const code = error?.code || error?.meta?.code;
    if (code === 'P2021' || code === 'P2022' || /does not exist|column|relation/i.test(String(error?.message || ''))) return res.json({ ok: true, data: [], warning: 'Таблица lab_orders не готова — примените миграцию 20260720_community_lab_fix' } as any);
    return res.status(500).json({ ok: false, error: 'Не удалось получить заказы лаборатории' } satisfies ApiResponse);
  }
});

export interface LabOrderBody {
  patientId?: string; patientName?: string; labType?: string; material?: string;
  toothNumber?: string | number; shade?: string; dueDate?: string; notes?: string; status?: string;
  price?: number; remakeOfId?: string; appointmentId?: string; tryInDate?: string; doctorId?: string;
  laboratoryId?: string; technicianId?: string; treatmentCaseId?: string;
}
export interface PreparedLabOrder { error?: string; data?: Record<string, unknown>; }

export async function prepareLabOrderWrite(clinicId: string, body: LabOrderBody, existingMeta: LabOrderMeta = {}, branchIds: string[] | null = null): Promise<PreparedLabOrder> {
  const { patientId, patientName, labType, material, toothNumber, shade, dueDate, notes, status, price, remakeOfId, appointmentId, tryInDate, doctorId, laboratoryId, technicianId, treatmentCaseId } = body;
  if (doctorId && !(await isClinicMember(doctorId, clinicId))) return { error: 'Указанный врач не найден в этой клинике' };
  if (patientId && branchIds !== null) {
    const patient = await prisma.patient.findFirst({ where: { id: patientId, clinicId, branchId: branchIds.length > 0 ? { in: branchIds } : '__NO_BRANCH_ACCESS__' }, select: { id: true } });
    if (!patient) return { error: 'Пациент недоступен в текущем филиале' };
  }
  if (laboratoryId) {
    const lab = await prisma.laboratory.findUnique({ where: { id: laboratoryId }, select: { id: true, name: true } });
    if (!lab) return { error: 'Указанная лаборатория не найдена' };
  }
  if (technicianId && laboratoryId) {
    const member = await prisma.laboratoryMember.findFirst({ where: { labId: laboratoryId, userId: technicianId } });
    if (!member) return { error: 'Указанный техник не состоит в выбранной лаборатории' };
  }
  if (treatmentCaseId) {
    const rows = await prisma.$queryRawUnsafe<{ id: string; clinicId: string; patientId: string }[]>(`SELECT "id","clinicId","patientId" FROM "treatment_cases" WHERE "id"=$1 LIMIT 1`, treatmentCaseId);
    if (!rows[0] || rows[0].clinicId !== clinicId || (patientId && rows[0].patientId !== patientId)) return { error: 'Клинический кейс не принадлежит пациенту или клинике' };
  }
  const meta = buildMeta({ patientName, material, toothNumber, shade, remakeOfId, appointmentId, tryInDate, laboratoryId, technicianId, treatmentCaseId }, existingMeta);
  return { data: { patientId: patientId || null, ...(doctorId ? { doctorId } : {}), type: labType || null, notes: notes || null, status: status || 'pending', deadline: dueDate ? new Date(dueDate) : null, price: price ?? null, files: { meta } } };
}

labRouter.post('/', requirePermission('appointment.write'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user!.clinicId;
    if (!clinicId) return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    const { id, ...body } = req.body as LabOrderBody & { id?: string };
    let existingMeta: LabOrderMeta = {};
    if (id) {
      const existing = await prisma.labOrder.findFirst({ where: { id, clinicId, ...branchScopedLabOrder(req) } });
      if (!existing) return res.status(404).json({ ok: false, error: 'Заказ лаборатории не найден' } satisfies ApiResponse);
      existingMeta = (existing.files as { meta?: LabOrderMeta } | null)?.meta || {};
    }
    const role = String(req.user?.role || '').toUpperCase();
    const branchIds = ['SUPERADMIN', 'OWNER', 'ADMIN'].includes(role) ? null : (req.user?.branchIds ?? []).filter(Boolean);
    const prepared = await prepareLabOrderWrite(clinicId, body, existingMeta, branchIds);
    if (prepared.error) return res.status(400).json({ ok: false, error: prepared.error } satisfies ApiResponse);
    const data = prepared.data as any;
    const order = id ? await prisma.labOrder.update({ where: { id }, data }) : await prisma.labOrder.create({ data: { id: uid(), clinicId, ...data } });
    if (body.treatmentCaseId) await prisma.$executeRawUnsafe(`UPDATE "lab_orders" SET "treatmentCaseId"=$1 WHERE "id"=$2`, body.treatmentCaseId, order.id);
    if (!id) publish('labOrder.created', { clinicId, labOrderId: order.id, patientId: order.patientId || undefined, doctorId: order.doctorId || undefined, treatmentCaseId: body.treatmentCaseId || undefined, userId: req.user?.id });
    return res.status(201).json({ ok: true, data: serializeLabOrder(order) } satisfies ApiResponse);
  } catch (error) { console.error('[Lab] upsert error:', error); return res.status(500).json({ ok: false, error: 'Не удалось сохранить заказ лаборатории' } satisfies ApiResponse); }
});

labRouter.patch('/:id/status', requirePermission('appointment.write'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user!.clinicId;
    if (!clinicId) return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    const { status } = req.body as { status?: string };
    if (!status || !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) return res.status(400).json({ ok: false, error: `Недопустимый статус. Допустимые: ${VALID_STATUSES.join(', ')}` } satisfies ApiResponse);
    const owned = await prisma.labOrder.findFirst({ where: { id: req.params.id as string, clinicId, ...branchScopedLabOrder(req) }, select: { id: true, status: true, patientId: true, doctorId: true } });
    if (!owned) return res.status(404).json({ ok: false, error: 'Заказ лаборатории не найден' } satisfies ApiResponse);
    await ensureDentalLabOrderEventsTable();
    const { order, partnerEconomicsRecorded } = await prisma.$transaction(async (tx) => {
      const order = await tx.labOrder.update({ where: { id: req.params.id as string }, data: { status: status as any } });
      await tx.$executeRawUnsafe(`INSERT INTO "dental_lab_order_events" ("id","labOrderId","clinicId","fromStatus","toStatus","actorUserId","createdAt") VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP)`, uid(), order.id, clinicId, owned.status, order.status, req.user!.id);
      let partnerEconomicsRecorded = false;
      if (order.status === 'delivered' && owned.status !== 'delivered') {
        const meta = (order.files as { meta?: LabOrderMeta } | null)?.meta || {};
        const partnerId = meta.laboratoryId || null;
        const grossMinor = order.price != null ? tengeToMinor(Number(order.price) || 0) : 0n;
        if (partnerId && grossMinor > 0n) {
          await recordPartnerEconomics({ vertical: 'DENTAL_LAB', partnerId, grossMinor, operationId: order.id }, tx);
          partnerEconomicsRecorded = true;
        }
      }
      return { order, partnerEconomicsRecorded };
    });
    publish('labOrder.status_changed', { clinicId, labOrderId: order.id, patientId: owned.patientId || undefined, doctorId: owned.doctorId || undefined, status: order.status, previousStatus: owned.status, userId: req.user?.id });
    return res.json({ ok: true, data: serializeLabOrder(order) } satisfies ApiResponse);
  } catch (error) { console.error('[Lab] status update error:', error); return res.status(500).json({ ok: false, error: 'Не удалось обновить статус заказа' } satisfies ApiResponse); }
});

labRouter.delete('/:id', requirePermission('appointment.write'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user!.clinicId;
    if (!clinicId) return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    const result = await prisma.labOrder.deleteMany({ where: { id: req.params.id as string, clinicId, ...branchScopedLabOrder(req) } });
    if (result.count === 0) return res.status(404).json({ ok: false, error: 'Заказ лаборатории не найден' } satisfies ApiResponse);
    return res.json({ ok: true, data: { deleted: true } } satisfies ApiResponse);
  } catch (error) { console.error('[Lab] delete error:', error); return res.status(500).json({ ok: false, error: 'Не удалось удалить заказ лаборатории' } satisfies ApiResponse); }
});