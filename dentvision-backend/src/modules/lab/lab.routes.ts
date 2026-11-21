import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { uid } from '../../lib/helpers.js';
import { loadClinicAccess, blockClinicWrites } from '../../middleware/planGate.js';
import { isClinicMember, resolveClinicAccess } from '../../lib/orgContext.js';
import { publish } from '../../lib/events.js';
import { labPlatformRouter } from './labPlatform.routes.js';
import { medicalLabLifecycleRouter } from './medicalLab.routes.js';
import { writeAuditLog } from '../compliance/audit.service.js';
import { ensureDentalLabOrderEventsTable } from './dentalLabOrderEvents.js';
import { validateLabRemakeRequestReason } from './labPlatform.authorization.js';
import { createNotificationForMany } from '../../services/notification.service.js';

export const labRouter = Router();
labRouter.use('/platform', labPlatformRouter);
labRouter.use('/medical-laboratory', medicalLabLifecycleRouter);

labRouter.use(authenticate);
labRouter.use(requirePermission('lab.read'));
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
  remakeRequest?: { id: string; status: 'requested' | 'accepted' | 'rejected'; reason: string; requestedByUserId: string; requestedAt: string; laboratoryId: string; decidedByUserId?: string; decidedAt?: string; responseNote?: string | null };
}

export const VALID_STATUSES = [
  'pending', 'sent', 'in_progress', 'try_in', 'adjustment',
  'ready', 'delivered', 'remake', 'delayed', 'cancelled',
] as const;

export const DENTAL_LAB_TRANSITIONS: Record<string, readonly string[]> = {
  pending: ['sent', 'cancelled', 'delayed'],
  sent: ['in_progress', 'cancelled', 'delayed'],
  // Clinic-owned/internal lab orders may complete locally. Once assigned to an
  // external laboratory, status ownership moves to labPlatformRouter.
  in_progress: ['try_in', 'adjustment', 'ready', 'remake', 'delayed', 'cancelled'],
  try_in: ['adjustment', 'ready', 'remake', 'delayed', 'cancelled'],
  adjustment: ['ready', 'remake', 'delayed', 'cancelled'],
  ready: ['delivered', 'remake', 'delayed', 'cancelled'],
  delivered: ['remake'],
  remake: ['in_progress', 'ready', 'delayed', 'cancelled'],
  delayed: ['in_progress', 'cancelled'],
  cancelled: [],
};
export function isDentalLabTransitionAllowed(from: string, to: string): boolean {
  return from === to || (DENTAL_LAB_TRANSITIONS[from] || []).includes(to);
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
  deadline: Date | null; price: number | null; serviceId?: string | null; serviceNameSnapshot?: string | null; servicePriceSnapshot?: number | null; createdAt: Date; updatedAt: Date;
  doctorId?: string | null;
  dentalLabInvoice?: { id: string; invoiceNumber: string; amountMinor: bigint; refundedMinor: bigint; currency: string; status: string; issuedAt: Date; paidAt: Date | null; paymentId: string | null } | null;
}) {
  const meta = (order.files as { meta?: LabOrderMeta } | null)?.meta || {};
  return {
    id: order.id, clinicId: order.clinicId, patientId: order.patientId,
    patientName: meta.patientName || order.labName || '', labType: order.type,
    material: meta.material || '', toothNumber: meta.toothNumber || '', shade: meta.shade || '',
    laboratoryId: meta.laboratoryId || null, technicianId: meta.technicianId || null,
    remakeOfId: meta.remakeOfId || null, appointmentId: meta.appointmentId || null,
    tryInDate: meta.tryInDate || null,
    remakeRequest: meta.remakeRequest || null,
    payment: meta.payment || null,
    invoice: order.dentalLabInvoice ? {
      id: order.dentalLabInvoice.id,
      invoiceNumber: order.dentalLabInvoice.invoiceNumber,
      amountMinor: order.dentalLabInvoice.amountMinor.toString(),
      refundedMinor: order.dentalLabInvoice.refundedMinor.toString(),
      currency: order.dentalLabInvoice.currency,
      status: order.dentalLabInvoice.status,
      issuedAt: order.dentalLabInvoice.issuedAt,
      paidAt: order.dentalLabInvoice.paidAt,
      paymentId: order.dentalLabInvoice.paymentId,
    } : null,
    treatmentCaseId: meta.treatmentCaseId || null, doctorId: order.doctorId ?? meta.doctorId ?? null,
    serviceId: order.serviceId ?? null, serviceName: order.serviceNameSnapshot ?? null, servicePriceSnapshot: order.servicePriceSnapshot ?? null,
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

labRouter.get('/', requirePermission('lab.read'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user!.clinicId;
    if (!clinicId) return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '200'), 10) || 200, 1), 1000);
    const orders = await prisma.labOrder.findMany({ where: { clinicId, ...branchScopedLabOrder(req) }, include: { dentalLabInvoice: true }, orderBy: { createdAt: 'desc' }, take: limit });
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
  if (doctorId) {
    // Canonical Organization → Person → PersonRole is authoritative for clinic
    // membership once the clinic has been migrated. Legacy ClinicMember is only
    // a compatibility fallback for pre-canonical tenants.
    const access = await resolveClinicAccess(doctorId, clinicId);
    const allowedDoctorRoles = new Set(['DOCTOR', 'OWNER', 'DIRECTOR', 'ADMIN', 'MANAGER']);
    if (!access || !allowedDoctorRoles.has(String(access.role || '').toUpperCase())) {
      return { error: 'Указанный врач не найден в этой клинике' };
    }
  }
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
    if (body.laboratoryId || body.technicianId) {
      return res.status(400).json({ ok: false, error: 'Назначение внешней лаборатории и техника выполняется только через защищённый workflow передачи заказа.', code: 'LAB_ASSIGNMENT_REQUIRED' } satisfies ApiResponse);
    }
    if (!id && body.status && body.status !== 'pending') {
      return res.status(409).json({ ok: false, error: 'Новый заказ должен начинаться со статуса «Ожидает». Используйте endpoint перехода статуса для дальнейшего workflow.', code: 'LAB_STATUS_ENDPOINT_REQUIRED' } satisfies ApiResponse);
    }

    const role = String(req.user?.role || '').toUpperCase();
    const branchIds = ['SUPERADMIN', 'OWNER', 'ADMIN'].includes(role) ? null : (req.user?.branchIds ?? []).filter(Boolean);
    const writeBody = { ...body, status: id ? body.status : 'pending', laboratoryId: undefined, technicianId: undefined };
    let order: any;

    if (id) {
      const outcome = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "lab_orders" WHERE "id"=${id} AND "clinicId"=${clinicId} FOR UPDATE`;
        const existing = await tx.labOrder.findFirst({ where: { id, clinicId, ...branchScopedLabOrder(req) } });
        if (!existing) return { kind: 'not_found' as const };
        const existingMeta = (existing.files as { meta?: LabOrderMeta } | null)?.meta || {};
        if (existingMeta.laboratoryId) return { kind: 'partner_owned' as const };
        if (body.status && body.status !== existing.status) return { kind: 'status_endpoint_required' as const };

        const prepared = await prepareLabOrderWrite(clinicId, { ...writeBody, status: existing.status }, existingMeta, branchIds);
        if (prepared.error) return { kind: 'invalid' as const, error: prepared.error };
        const data = prepared.data as any;
        // POST is a specification/details editor, not a lifecycle transition endpoint.
        delete data.status;
        const updated = await tx.labOrder.update({ where: { id }, data });
        if (body.treatmentCaseId) {
          await tx.$executeRawUnsafe(`UPDATE "lab_orders" SET "treatmentCaseId"=$1 WHERE "id"=$2`, body.treatmentCaseId, updated.id);
        }
        return { kind: 'updated' as const, order: updated };
      });

      if (outcome.kind === 'not_found') return res.status(404).json({ ok: false, error: 'Заказ лаборатории не найден' } satisfies ApiResponse);
      if (outcome.kind === 'partner_owned') return res.status(409).json({ ok: false, error: 'Заказ передан внешней лаборатории. Изменения выполняются назначенной лабораторией.', code: 'LAB_PARTNER_WORKFLOW_OWNED' } satisfies ApiResponse);
      if (outcome.kind === 'status_endpoint_required') return res.status(409).json({ ok: false, error: 'Статус меняется только через endpoint перехода лабораторного workflow.', code: 'LAB_STATUS_ENDPOINT_REQUIRED' } satisfies ApiResponse);
      if (outcome.kind === 'invalid') return res.status(400).json({ ok: false, error: outcome.error } satisfies ApiResponse);
      order = outcome.order;
      await writeAuditLog({ action: 'LAB_ORDER_UPDATED', entity: 'lab_order', entityId: order.id, details: { fields: Object.keys(body).filter((field) => field !== 'status') }, userId: req.user!.id, clinicId });
    } else {
      const prepared = await prepareLabOrderWrite(clinicId, writeBody, {}, branchIds);
      if (prepared.error) return res.status(400).json({ ok: false, error: prepared.error } satisfies ApiResponse);
      const data = prepared.data as any;
      data.status = 'pending';
      order = await prisma.$transaction(async (tx) => {
        const created = await tx.labOrder.create({ data: { id: uid(), clinicId, ...data } });
        if (body.treatmentCaseId) {
          await tx.$executeRawUnsafe(`UPDATE "lab_orders" SET "treatmentCaseId"=$1 WHERE "id"=$2`, body.treatmentCaseId, created.id);
        }
        return created;
      });
      await writeAuditLog({ action: 'LAB_ORDER_CREATED', entity: 'lab_order', entityId: order.id, details: { status: order.status, treatmentCaseId: body.treatmentCaseId || null }, userId: req.user!.id, clinicId });
      publish('labOrder.created', { clinicId, labOrderId: order.id, patientId: order.patientId || undefined, doctorId: order.doctorId || undefined, treatmentCaseId: body.treatmentCaseId || undefined, userId: req.user?.id });
    }
    return res.status(id ? 200 : 201).json({ ok: true, data: serializeLabOrder(order) } satisfies ApiResponse);
  } catch (error) { console.error('[Lab] upsert error:', error); return res.status(500).json({ ok: false, error: 'Не удалось сохранить заказ лаборатории' } satisfies ApiResponse); }
});

labRouter.patch('/:id/status', requirePermission('lab.write'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user!.clinicId;
    if (!clinicId) return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    const { status } = req.body as { status?: string };
    if (!status || !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) return res.status(400).json({ ok: false, error: `Недопустимый статус. Допустимые: ${VALID_STATUSES.join(', ')}` } satisfies ApiResponse);
    await ensureDentalLabOrderEventsTable();
    const outcome = await prisma.$transaction(async (tx) => {
      const orderId = String(req.params.id);
      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "lab_orders" WHERE "id"=${orderId} AND "clinicId"=${clinicId} FOR UPDATE`;
      const existing = await tx.labOrder.findFirst({ where: { id: orderId, clinicId, ...branchScopedLabOrder(req) } });
      if (!existing) return { kind: 'not_found' as const };
      const existingMeta = (existing.files as { meta?: LabOrderMeta } | null)?.meta || {};
      if (existingMeta.laboratoryId) return { kind: 'partner_owned' as const };
      if (existing.status !== status && !isDentalLabTransitionAllowed(existing.status, status)) {
        return { kind: 'invalid_transition' as const, fromStatus: existing.status };
      }

      const order = await tx.labOrder.update({ where: { id: orderId }, data: { status: status as any } });
      await tx.$executeRawUnsafe(
        `INSERT INTO "dental_lab_order_events" ("id","labOrderId","clinicId","fromStatus","toStatus","actorUserId","createdAt") VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP)`,
        uid(), order.id, clinicId, existing.status, order.status, req.user!.id,
      );
      return { kind: 'updated' as const, order, previousStatus: existing.status };
    });
    if (outcome.kind === 'not_found') return res.status(404).json({ ok: false, error: 'Заказ лаборатории не найден' } satisfies ApiResponse);
    if (outcome.kind === 'partner_owned') return res.status(409).json({ ok: false, error: 'Заказ передан внешней лаборатории. Статусом управляет кабинет лаборатории.', code: 'LAB_PARTNER_WORKFLOW_OWNED' } satisfies ApiResponse);
    if (outcome.kind === 'invalid_transition') return res.status(400).json({ ok: false, error: `Недопустимый переход ${outcome.fromStatus} → ${status}` } satisfies ApiResponse);
    const order = outcome.order;
    await writeAuditLog({ action: 'LAB_ORDER_STATUS_CHANGED', entity: 'lab_order', entityId: order.id, details: { workflow: 'dental-laboratory', queueKey: 'lab-orders', fromStatus: outcome.previousStatus, toStatus: order.status, patientId: order.patientId || null }, userId: req.user!.id, clinicId });
    publish('labOrder.status_changed', { clinicId, labOrderId: order.id, patientId: order.patientId || undefined, doctorId: order.doctorId || undefined, status: order.status, previousStatus: outcome.previousStatus, userId: req.user?.id });
    return res.json({ ok: true, data: serializeLabOrder(order) } satisfies ApiResponse);
  } catch (error) { console.error('[Lab] status update error:', error); return res.status(500).json({ ok: false, error: 'Не удалось обновить статус заказа' } satisfies ApiResponse); }
});

labRouter.post('/:id/remake-request', requirePermission('lab.write'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user!.clinicId;
    if (!clinicId) return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    const reason = validateLabRemakeRequestReason(req.body?.reason);
    if (!reason) return res.status(400).json({ ok: false, error: 'Укажите причину переделки (от 5 до 2000 символов)' } satisfies ApiResponse);
    const orderId = String(req.params.id);
    await ensureDentalLabOrderEventsTable();

    const outcome = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "lab_orders" WHERE "id"=${orderId} AND "clinicId"=${clinicId} FOR UPDATE`;
      const existing = await tx.labOrder.findFirst({ where: { id: orderId, clinicId, ...branchScopedLabOrder(req) } });
      if (!existing) return { kind: 'not_found' as const };
      const existingMeta = (existing.files as { meta?: LabOrderMeta } | null)?.meta || {};
      if (!existingMeta.laboratoryId) return { kind: 'not_partner' as const };
      if (existing.status !== 'delivered') return { kind: 'invalid_status' as const };
      const pendingPayment = await tx.payment.findFirst({
        where: { refType: 'dental_lab_order', refId: existing.id, status: 'pending' },
        select: { id: true },
      });
      if (pendingPayment) return { kind: 'payment_pending' as const };
      if (existingMeta.remakeRequest?.status === 'requested') return { kind: 'already_requested' as const };
      const request = {
        id: uid(),
        status: 'requested' as const,
        reason,
        requestedByUserId: req.user!.id,
        requestedAt: new Date().toISOString(),
        laboratoryId: existingMeta.laboratoryId,
      };
      const currentFiles = existing.files && typeof existing.files === 'object' && !Array.isArray(existing.files)
        ? existing.files as Record<string, unknown>
        : {};
      const order = await tx.labOrder.update({
        where: { id: existing.id },
        data: { files: { ...currentFiles, meta: { ...existingMeta, remakeRequest: request } } },
      });
      await tx.$executeRawUnsafe(
        `INSERT INTO "dental_lab_order_events" ("id","labOrderId","clinicId","fromStatus","toStatus","note","actorUserId","createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_TIMESTAMP)`,
        uid(), order.id, clinicId, existing.status, existing.status, 'Клиника запросила переделку: ' + reason, req.user!.id,
      );
      return { kind: 'updated' as const, order, request };
    });

    if (outcome.kind === 'not_found') return res.status(404).json({ ok: false, error: 'Заказ не найден в текущем филиале' } satisfies ApiResponse);
    if (outcome.kind === 'not_partner') return res.status(409).json({ ok: false, error: 'Запрос переделки доступен только для заказа, переданного зуботехническому партнёру' } satisfies ApiResponse);
    if (outcome.kind === 'invalid_status') return res.status(409).json({ ok: false, error: 'Запрос переделки доступен после подтверждённой доставки' } satisfies ApiResponse);
    if (outcome.kind === 'payment_pending') return res.status(409).json({ ok: false, error: 'Сначала завершите ожидающий платёж по заказу или дождитесь его отмены провайдером', code: 'DENTAL_LAB_PAYMENT_PENDING' } satisfies ApiResponse);
    if (outcome.kind === 'already_requested') return res.status(409).json({ ok: false, error: 'Запрос переделки уже ожидает ответа лаборатории' } satisfies ApiResponse);

    await writeAuditLog({ action: 'LAB_ORDER_REMAKE_REQUESTED', entity: 'lab_order', entityId: orderId, details: { laboratoryId: outcome.request.laboratoryId, requestId: outcome.request.id, reasonLength: reason.length }, userId: req.user!.id, clinicId });
    const labMembers = await prisma.laboratoryMember.findMany({ where: { labId: outcome.request.laboratoryId }, select: { userId: true } });
    await createNotificationForMany(labMembers.map((member) => member.userId), {
      type: 'lab.remake.requested',
      title: 'Клиника запросила переделку',
      message: `По заказу ${orderId.slice(-8)} поступил запрос. Откройте кабинет, чтобы изучить причину и принять решение.`,
      link: '/diagnostics/dental-lab',
    });

    publish('labOrder.remake_requested', { clinicId, labOrderId: orderId, laboratoryId: outcome.request.laboratoryId, requestId: outcome.request.id, userId: req.user!.id });
    return res.status(201).json({ ok: true, data: serializeLabOrder(outcome.order) } satisfies ApiResponse);
  } catch (error) {
    console.error('[Lab] remake request error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось отправить запрос на переделку' } satisfies ApiResponse);
  }
});

labRouter.delete('/:id', requirePermission('appointment.write'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user!.clinicId;
    if (!clinicId) return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    const orderId = String(req.params.id);
    const outcome = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "lab_orders" WHERE "id"=${orderId} AND "clinicId"=${clinicId} FOR UPDATE`;
      const existing = await tx.labOrder.findFirst({ where: { id: orderId, clinicId, ...branchScopedLabOrder(req) } });
      if (!existing) return 'not_found' as const;
      const meta = (existing.files as { meta?: LabOrderMeta } | null)?.meta || {};
      if (meta.laboratoryId) return 'partner_owned' as const;
      const deleted = await tx.labOrder.deleteMany({ where: { id: orderId, clinicId, ...branchScopedLabOrder(req) } });
      return deleted.count === 1 ? 'deleted' as const : 'not_found' as const;
    });
    if (outcome === 'not_found') return res.status(404).json({ ok: false, error: 'Заказ лаборатории не найден' } satisfies ApiResponse);
    if (outcome === 'partner_owned') return res.status(409).json({ ok: false, error: 'Переданный партнёру заказ нельзя удалить из клиники: его производственная история должна быть сохранена.', code: 'LAB_PARTNER_WORKFLOW_OWNED' } satisfies ApiResponse);
    await writeAuditLog({ action: 'LAB_ORDER_DELETED', entity: 'lab_order', entityId: orderId, userId: req.user!.id, clinicId });
    return res.json({ ok: true, data: { deleted: true } } satisfies ApiResponse);
  } catch (error) { console.error('[Lab] delete error:', error); return res.status(500).json({ ok: false, error: 'Не удалось удалить заказ лаборатории' } satisfies ApiResponse); }
});