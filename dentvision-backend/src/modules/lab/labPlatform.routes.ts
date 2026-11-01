import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { publish } from '../../lib/events.js';
import { assertClinicOrgAccess } from '../../lib/orgContext.js';
import { resolveClinicAccess as resolveClinicSubscriptionAccess } from '../billing/planEntitlements.js';
import { uid } from '../../lib/helpers.js';
import { ensureDentalLabOrderEventsTable } from './dentalLabOrderEvents.js';
import { canLabMemberChangeStatus, isLabManagerRole, validateLabQualityControl } from './labPlatform.authorization.js';

export const labPlatformRouter = Router();
labPlatformRouter.use(authenticate);

type LabMeta = {
  laboratoryId?: string;
  technicianId?: string;
  patientName?: string;
  material?: string;
  toothNumber?: string | number;
  shade?: string;
  remakeOfId?: string;
  appointmentId?: string;
  tryInDate?: string;
  qualityControl?: { checks: Record<string, boolean>; passed: boolean; note: string | null; checkedByUserId: string; checkedAt: string };
};

const STATUS_FLOW: Record<string, string[]> = {
  pending: ['sent', 'cancelled'],
  sent: ['in_progress', 'delayed', 'cancelled'],
  in_progress: ['try_in', 'adjustment', 'qc', 'remake', 'delayed', 'cancelled'],
  try_in: ['adjustment', 'qc', 'remake'],
  adjustment: ['try_in', 'qc', 'remake'],
  // QC outcome must be recorded only through the manager-only /qc endpoint.
  qc: [],
  ready: ['delivered', 'remake'],
  delivered: [],
  remake: ['in_progress', 'delayed', 'cancelled'],
  delayed: ['in_progress', 'cancelled'],
  cancelled: [],
};

async function requireClinicAssignmentWritable(req: AuthRequest, res: any, clinicId: string): Promise<boolean> {
  if (!req.user?.id || !(await assertClinicOrgAccess(req.user, clinicId))) {
    res.status(403).json({ ok: false, error: 'Нет доступа к этой клинике' });
    return false;
  }
  try {
    const access = await resolveClinicSubscriptionAccess(clinicId);
    if (!access) {
      res.status(404).json({ ok: false, error: 'Клиника не найдена', code: 'CLINIC_ACCESS_UNVERIFIED' });
      return false;
    }
    if (access.writeBlocked) {
      res.status(402).json({
        ok: false,
        error: 'Срок подписки клиники завершён. Передача новых заказов в лабораторию доступна после продления.',
        code: 'SUBSCRIPTION_EXPIRED',
        data: { upgradePath: '/crm/billing' },
      });
      return false;
    }
    return true;
  } catch (error) {
    console.error('[LabPlatform] clinic assignment subscription guard failed:', error);
    res.status(503).json({
      ok: false,
      error: 'Не удалось проверить подписку клиники',
      code: 'CLINIC_ACCESS_UNVERIFIED',
    });
    return false;
  }
}

function branchScopedClinicLabOrder(req: AuthRequest): Record<string, unknown> {
  const role = String(req.user?.role || '').toUpperCase();
  if (['SUPERADMIN', 'OWNER', 'ADMIN'].includes(role)) return {};
  const branchIds = (req.user?.branchIds ?? []).filter(Boolean);
  return branchIds.length > 0
    ? { patient: { branchId: { in: branchIds } } }
    : { patient: { branchId: '__NO_BRANCH_ACCESS__' } };
}

async function resolveLab(req: AuthRequest) {
  const user = req.user;
  const labId = user?.organizationOriginalId || user?.organizationId;
  if (!user?.id || user.organizationType !== 'LABORATORY' || !labId) return null;
  const membership = await prisma.laboratoryMember.findFirst({ where: { labId, userId: user.id }, include: { lab: true } });
  return membership || null;
}

function metaOf(files: unknown): LabMeta {
  const raw = files as { meta?: LabMeta } | null;
  return raw?.meta && typeof raw.meta === 'object' ? raw.meta : {};
}

function isVerifiedDentalLabSettings(value: unknown): boolean {
  const settings = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const legal = settings.legal && typeof settings.legal === 'object' && !Array.isArray(settings.legal)
    ? settings.legal as Record<string, unknown>
    : {};
  return settings.laboratoryType === 'DENTAL_LAB'
    && settings.selfServiceType === 'dental_lab'
    && settings.lifecycle === 'ACTIVE'
    && settings.verification === 'VERIFIED'
    && settings.ecosystemVisible === true
    && legal.status === 'READY';
}

async function appendEventInTransaction(
  tx: Prisma.TransactionClient,
  order: { id: string; clinicId: string },
  fromStatus: string | null,
  toStatus: string,
  actorUserId: string,
  note?: string,
) {
  await tx.$executeRawUnsafe(
    `INSERT INTO "dental_lab_order_events" ("id","labOrderId","clinicId","fromStatus","toStatus","note","actorUserId","createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_TIMESTAMP)`,
    uid(), order.id, order.clinicId, fromStatus, toStatus, note ?? null, actorUserId,
  );
}

function serialize(order: any) {
  const meta = metaOf(order.files);
  return {
    id: order.id, clinicId: order.clinicId, clinicName: order.clinic?.name || '', patientId: order.patientId,
    patientName: order.patient?.firstName ? `${order.patient.firstName} ${order.patient.lastName}`.trim() : (meta.patientName || ''),
    doctorId: order.doctorId || null, type: order.type || '', material: meta.material || '', toothNumber: meta.toothNumber || '',
    shade: meta.shade || '', notes: order.notes || '', deadline: order.deadline, price: order.price, status: order.status,
    technicianId: meta.technicianId || null, remakeOfId: meta.remakeOfId || null, appointmentId: meta.appointmentId || null,
    qualityControl: meta.qualityControl || null,
    treatmentCaseId: (order as any).treatmentCaseId ?? null,
    createdAt: order.createdAt, updatedAt: order.updatedAt,
  };
}

async function caseIdOf(orderId: string): Promise<string | null> {
  const rows = await prisma.$queryRawUnsafe<{ treatmentCaseId: string | null }[]>(`SELECT "treatmentCaseId" FROM "lab_orders" WHERE "id"=$1 LIMIT 1`, orderId);
  return rows[0]?.treatmentCaseId ?? null;
}

async function ordersForLab(labId: string, status?: string) {
  const rows = await prisma.labOrder.findMany({
    where: { ...(status ? { status: status as any } : {}), files: { path: ['meta', 'laboratoryId'], equals: labId } },
    include: { patient: { select: { firstName: true, lastName: true } }, clinic: { select: { id: true, name: true } } },
    orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }], take: 500,
  });
  return Promise.all(rows.map(async (order) => serialize({ ...order, treatmentCaseId: await caseIdOf(order.id) })));
}

labPlatformRouter.get('/available-laboratories', requirePermission('appointment.write'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId || !(await assertClinicOrgAccess(req.user!, clinicId))) {
      return res.status(403).json({ ok: false, error: 'Нет доступа к выбранной клинике' } satisfies ApiResponse);
    }
    const organizations = await prisma.organization.findMany({
      where: { type: 'LABORATORY', originalType: 'Laboratory', archivedAt: null },
      select: { originalId: true, settings: true },
    });
    const eligibleIds = organizations
      .filter((organization) => organization.originalId && isVerifiedDentalLabSettings(organization.settings))
      .map((organization) => organization.originalId as string);
    if (eligibleIds.length === 0) return res.json({ ok: true, data: [] } satisfies ApiResponse);
    const laboratories = await prisma.laboratory.findMany({
      where: { id: { in: eligibleIds }, active: true },
      select: { id: true, name: true, city: true, address: true, phone: true, rating: true },
      orderBy: [{ rating: 'desc' }, { name: 'asc' }],
    });
    return res.json({ ok: true, data: laboratories } satisfies ApiResponse);
  } catch (error) {
    console.error('[LabPlatform] available laboratories error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить список зуботехнических лабораторий' } satisfies ApiResponse);
  }
});

labPlatformRouter.get('/dashboard', async (req: AuthRequest, res) => {
  try {
    const membership = await resolveLab(req);
    if (!membership) return res.status(403).json({ ok: false, error: 'Нет доступа к кабинету лаборатории' } satisfies ApiResponse);
    const orders = await ordersForLab(membership.labId);
    const now = Date.now();
    const active = orders.filter((o) => !['delivered', 'cancelled'].includes(o.status));
    const dueSoon = active.filter((o) => o.deadline && new Date(o.deadline).getTime() <= now + 48 * 60 * 60 * 1000);
    const overdue = active.filter((o) => o.deadline && new Date(o.deadline).getTime() < now);
    const byStatus = orders.reduce<Record<string, number>>((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {});
    return res.json({ ok: true, data: { lab: membership.lab, membershipRole: membership.role, totals: { all: orders.length, active: active.length, dueSoon: dueSoon.length, overdue: overdue.length }, byStatus, priority: [...overdue, ...dueSoon.filter((o) => !overdue.includes(o))].slice(0, 8) } } satisfies ApiResponse);
  } catch (error) { console.error('[LabPlatform] dashboard error:', error); return res.status(500).json({ ok: false, error: 'Не удалось загрузить кабинет лаборатории' } satisfies ApiResponse); }
});

labPlatformRouter.get('/orders', async (req: AuthRequest, res) => {
  try {
    const membership = await resolveLab(req);
    if (!membership) return res.status(403).json({ ok: false, error: 'Нет доступа к кабинету лаборатории' } satisfies ApiResponse);
    const status = req.query.status ? String(req.query.status) : undefined;
    return res.json({ ok: true, data: await ordersForLab(membership.labId, status) } satisfies ApiResponse);
  } catch (error) { console.error('[LabPlatform] orders error:', error); return res.status(500).json({ ok: false, error: 'Не удалось загрузить заказы лаборатории' } satisfies ApiResponse); }
});

labPlatformRouter.get('/orders/:id/lifecycle', async (req: AuthRequest, res) => {
  try {
    const membership = await resolveLab(req);
    if (!membership) return res.status(403).json({ ok: false, error: 'Нет доступа к кабинету лаборатории' } satisfies ApiResponse);
    const existing = await prisma.labOrder.findFirst({ where: { id: req.params.id, files: { path: ['meta', 'laboratoryId'], equals: membership.labId } } });
    if (!existing) return res.status(404).json({ ok: false, error: 'Заказ не найден в этой лаборатории' } satisfies ApiResponse);
    const events = await prisma.$queryRawUnsafe(`SELECT * FROM "dental_lab_order_events" WHERE "labOrderId"=$1 ORDER BY "createdAt" ASC`, existing.id);
    return res.json({ ok: true, data: { order: serialize({ ...existing, treatmentCaseId: await caseIdOf(existing.id) }), events } } satisfies ApiResponse);
  } catch (error) { console.error('[LabPlatform] lifecycle error:', error); return res.status(500).json({ ok: false, error: 'Не удалось загрузить историю заказа' } satisfies ApiResponse); }
});

labPlatformRouter.patch('/orders/:id/status', async (req: AuthRequest, res) => {
  try {
    const membership = await resolveLab(req);
    if (!membership) return res.status(403).json({ ok: false, error: 'Нет доступа к кабинету лаборатории' } satisfies ApiResponse);
    const next = String(req.body?.status || '');
    await ensureDentalLabOrderEventsTable();
    const outcome = await prisma.$transaction(async (tx) => {
      const orderId = String(req.params.id);
      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "lab_orders" WHERE "id"=${orderId} FOR UPDATE`;
      const existing = await tx.labOrder.findFirst({ where: { id: orderId, files: { path: ['meta', 'laboratoryId'], equals: membership.labId } } });
      if (!existing) return { kind: 'not_found' as const };
      const existingMeta = metaOf(existing.files);
      if (!canLabMemberChangeStatus({ role: membership.role, userId: req.user!.id, assignedTechnicianId: existingMeta.technicianId, nextStatus: next })) {
        return { kind: 'forbidden' as const };
      }
      if (!STATUS_FLOW[existing.status]?.includes(next)) return { kind: 'invalid_transition' as const, fromStatus: existing.status };
      const order = await tx.labOrder.update({ where: { id: existing.id }, data: { status: next as any } });
      await appendEventInTransaction(tx, order, existing.status, order.status, req.user!.id, req.body?.note ? String(req.body.note) : undefined);
      return { kind: 'updated' as const, order, previousStatus: existing.status };
    });
    if (outcome.kind === 'not_found') return res.status(404).json({ ok: false, error: 'Заказ не найден в этой лаборатории' } satisfies ApiResponse);
    if (outcome.kind === 'forbidden') return res.status(403).json({ ok: false, error: 'Это действие недоступно вашей роли лаборатории' } satisfies ApiResponse);
    if (outcome.kind === 'invalid_transition') return res.status(409).json({ ok: false, error: `Переход ${outcome.fromStatus} → ${next} недоступен` } satisfies ApiResponse);
    const order = outcome.order;
    const treatmentCaseId = await caseIdOf(order.id) || undefined;
    publish('labOrder.status_changed', { clinicId: order.clinicId, labOrderId: order.id, patientId: order.patientId || undefined, doctorId: order.doctorId || undefined, treatmentCaseId, status: order.status, previousStatus: outcome.previousStatus, userId: req.user?.id });
    return res.json({ ok: true, data: serialize({ ...order, treatmentCaseId }) } satisfies ApiResponse);
  } catch (error) { console.error('[LabPlatform] status error:', error); return res.status(500).json({ ok: false, error: 'Не удалось изменить статус заказа' } satisfies ApiResponse); }
});

labPlatformRouter.patch('/orders/:id/technician', async (req: AuthRequest, res) => {
  try {
    const membership = await resolveLab(req);
    if (!membership) return res.status(403).json({ ok: false, error: 'Нет доступа к кабинету лаборатории' } satisfies ApiResponse);
    if (!isLabManagerRole(membership.role)) return res.status(403).json({ ok: false, error: 'Назначать техников может только владелец или менеджер лаборатории' } satisfies ApiResponse);
    const technicianId = req.body?.technicianId ? String(req.body.technicianId) : null;
    await ensureDentalLabOrderEventsTable();
    const outcome = await prisma.$transaction(async (tx) => {
      const orderId = String(req.params.id);
      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "lab_orders" WHERE "id"=${orderId} FOR UPDATE`;
      const existing = await tx.labOrder.findFirst({ where: { id: orderId, files: { path: ['meta', 'laboratoryId'], equals: membership.labId } } });
      if (!existing) return { kind: 'not_found' as const };
      if (technicianId) {
        const technician = await tx.laboratoryMember.findFirst({ where: { labId: membership.labId, userId: technicianId } });
        if (!technician) return { kind: 'invalid_technician' as const };
      }
      const meta = metaOf(existing.files);
      if ((meta.technicianId || null) === technicianId) return { kind: 'unchanged' as const, order: existing };
      const currentFiles = existing.files && typeof existing.files === 'object' && !Array.isArray(existing.files)
        ? existing.files as Record<string, unknown>
        : {};
      const order = await tx.labOrder.update({
        where: { id: existing.id },
        data: { files: { ...currentFiles, meta: { ...meta, technicianId: technicianId || undefined } } },
      });
      const eventNote = technicianId ? 'Назначен ответственный зубной техник' : 'Ответственный зубной техник снят с заказа';
      await appendEventInTransaction(tx, order, existing.status, existing.status, req.user!.id, eventNote);
      return { kind: 'updated' as const, order };
    });
    if (outcome.kind === 'not_found') return res.status(404).json({ ok: false, error: 'Заказ не найден в этой лаборатории' } satisfies ApiResponse);
    if (outcome.kind === 'invalid_technician') return res.status(400).json({ ok: false, error: 'Сотрудник не состоит в этой лаборатории' } satisfies ApiResponse);
    const order = outcome.order;
    return res.json({ ok: true, data: serialize({ ...order, treatmentCaseId: await caseIdOf(order.id) }) } satisfies ApiResponse);
  } catch (error) { console.error('[LabPlatform] technician error:', error); return res.status(500).json({ ok: false, error: 'Не удалось назначить техника' } satisfies ApiResponse); }
});

labPlatformRouter.patch('/orders/:id/qc', async (req: AuthRequest, res) => {
  try {
    const membership = await resolveLab(req);
    if (!membership) return res.status(403).json({ ok: false, error: 'Нет доступа к кабинету лаборатории' } satisfies ApiResponse);
    if (!isLabManagerRole(membership.role)) return res.status(403).json({ ok: false, error: 'Подтверждать QC может только владелец или менеджер лаборатории' } satisfies ApiResponse);
    const submission = validateLabQualityControl(req.body?.checks, req.body?.note);
    if (!submission) return res.status(400).json({ ok: false, error: 'Заполните все пункты QC; при несоответствии укажите замечание' } satisfies ApiResponse);
    const nextStatus = submission.passed ? 'ready' : 'remake';
    const qualityControl = { ...submission, checkedByUserId: req.user!.id, checkedAt: new Date().toISOString() };
    const eventNote = submission.passed ? 'QC подтверждён владельцем лаборатории' : `QC не пройден: ${submission.note}`;

    await ensureDentalLabOrderEventsTable();
    const outcome = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "lab_orders" WHERE "id"=${req.params.id} FOR UPDATE`;
      const existing = await tx.labOrder.findFirst({ where: { id: req.params.id, files: { path: ['meta', 'laboratoryId'], equals: membership.labId } } });
      if (!existing) return { kind: 'not_found' as const };
      if (existing.status !== 'qc') return { kind: 'invalid_status' as const };
      const meta = metaOf(existing.files);
      const currentFiles = existing.files && typeof existing.files === 'object' && !Array.isArray(existing.files)
        ? existing.files as Record<string, unknown>
        : {};
      const order = await tx.labOrder.update({
        where: { id: existing.id },
        data: { status: nextStatus as any, files: { ...currentFiles, meta: { ...meta, qualityControl } } },
      });
      await appendEventInTransaction(tx, order, existing.status, nextStatus, req.user!.id, eventNote);
      return { kind: 'updated' as const, order, previousStatus: existing.status };
    });
    if (outcome.kind === 'not_found') return res.status(404).json({ ok: false, error: 'Заказ не найден в этой лаборатории' } satisfies ApiResponse);
    if (outcome.kind === 'invalid_status') return res.status(409).json({ ok: false, error: 'Заказ должен находиться на этапе контроля качества' } satisfies ApiResponse);

    const order = outcome.order;
    const treatmentCaseId = await caseIdOf(order.id) || undefined;
    // Publish the canonical transition as well as the QC-specific event. The
    // shared bridge persists the clinic's notification and AI workflow signal.
    publish('labOrder.status_changed', {
      clinicId: order.clinicId,
      labOrderId: order.id,
      patientId: order.patientId || undefined,
      doctorId: order.doctorId || undefined,
      treatmentCaseId,
      status: nextStatus,
      previousStatus: outcome.previousStatus,
      userId: req.user?.id,
    });
    publish(submission.passed ? 'labOrder.qc_passed' : 'labOrder.qc_failed', {
      clinicId: order.clinicId, labOrderId: order.id, status: nextStatus,
      previousStatus: outcome.previousStatus, userId: req.user?.id, laboratoryId: membership.labId,
    });
    return res.json({ ok: true, data: serialize({ ...order, treatmentCaseId }) } satisfies ApiResponse);
  } catch (error) { console.error('[LabPlatform] QC error:', error); return res.status(500).json({ ok: false, error: 'Не удалось сохранить результат контроля качества' } satisfies ApiResponse); }
});

labPlatformRouter.get('/team', async (req: AuthRequest, res) => {
  try {
    const membership = await resolveLab(req);
    if (!membership) return res.status(403).json({ ok: false, error: 'Нет доступа к кабинету лаборатории' } satisfies ApiResponse);
    const members = await prisma.laboratoryMember.findMany({ where: { labId: membership.labId }, include: { user: true } });
    return res.json({ ok: true, data: members.map((m: any) => ({ id: m.userId, role: m.role, firstName: m.user.firstName, lastName: m.user.lastName, email: m.user.email, avatar: m.user.avatar })) } satisfies ApiResponse);
  } catch (error) { console.error('[LabPlatform] team error:', error); return res.status(500).json({ ok: false, error: 'Не удалось загрузить команду' } satisfies ApiResponse); }
});

labPlatformRouter.post('/assign', requirePermission('appointment.write'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(403).json({ ok: false, error: 'Действие доступно из клиники' } satisfies ApiResponse);
    if (!(await requireClinicAssignmentWritable(req, res, clinicId))) return;
    const orderId = String(req.body?.orderId || ''), laboratoryId = String(req.body?.laboratoryId || '');
    if (!orderId || !laboratoryId) return res.status(400).json({ ok: false, error: 'orderId и laboratoryId обязательны' } satisfies ApiResponse);
    const lab = await prisma.laboratory.findUnique({ where: { id: laboratoryId }, select: { id: true, name: true, active: true } });
    if (!lab || !lab.active) return res.status(404).json({ ok: false, error: 'Активная зуботехническая лаборатория не найдена', code: 'LAB_PARTNER_NOT_AVAILABLE' } satisfies ApiResponse);
    const organization = await prisma.organization.findFirst({
      where: { type: 'LABORATORY', originalType: 'Laboratory', originalId: lab.id, archivedAt: null },
      select: { settings: true },
    });
    if (!organization || !isVerifiedDentalLabSettings(organization.settings)) {
      return res.status(404).json({ ok: false, error: 'Лаборатория не прошла проверку или не опубликована как зуботехнический партнёр.', code: 'LAB_PARTNER_NOT_AVAILABLE' } satisfies ApiResponse);
    }

    await ensureDentalLabOrderEventsTable();
    const outcome = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "lab_orders" WHERE "id"=${orderId} AND "clinicId"=${clinicId} FOR UPDATE`;
      const existing = await tx.labOrder.findFirst({ where: { id: orderId, clinicId, ...branchScopedClinicLabOrder(req) } });
      if (!existing) return { kind: 'not_found' as const };
      const meta = metaOf(existing.files);
      if (meta.laboratoryId === lab.id) return { kind: 'idempotent' as const, order: existing };
      if (meta.laboratoryId) return { kind: 'already_assigned' as const };
      if (existing.status !== 'pending') return { kind: 'invalid_status' as const };

      const currentFiles = existing.files && typeof existing.files === 'object' && !Array.isArray(existing.files)
        ? existing.files as Record<string, unknown>
        : {};
      const order = await tx.labOrder.update({
        where: { id: existing.id },
        data: { labName: lab.name, files: { ...currentFiles, meta: { ...meta, laboratoryId: lab.id } } },
      });
      await appendEventInTransaction(tx, order, null, order.status, req.user!.id, `Передан в лабораторию: ${lab.name}`);
      return { kind: 'assigned' as const, order };
    });

    if (outcome.kind === 'not_found') return res.status(404).json({ ok: false, error: 'Заказ не найден в вашей клинике' } satisfies ApiResponse);
    if (outcome.kind === 'already_assigned') return res.status(409).json({ ok: false, error: 'Заказ уже передан другой лаборатории. Переназначение без закрытия текущего цикла запрещено.', code: 'LAB_ORDER_ALREADY_ASSIGNED' } satisfies ApiResponse);
    if (outcome.kind === 'invalid_status') return res.status(409).json({ ok: false, error: 'Передать можно только новый заказ со статусом «Ожидает».', code: 'LAB_ORDER_NOT_ASSIGNABLE' } satisfies ApiResponse);

    const order = outcome.order;
    if (outcome.kind === 'assigned') {
      publish('labOrder.assigned', { clinicId, labOrderId: order.id, laboratoryId: lab.id, laboratoryName: lab.name, patientId: order.patientId || undefined, doctorId: order.doctorId || undefined, treatmentCaseId: await caseIdOf(order.id) || undefined, userId: req.user?.id });
    }
    return res.json({ ok: true, data: { ...serialize({ ...order, treatmentCaseId: await caseIdOf(order.id) }), assignmentIdempotent: outcome.kind === 'idempotent' } } satisfies ApiResponse);
  } catch (error) { console.error('[LabPlatform] assign error:', error); return res.status(500).json({ ok: false, error: 'Не удалось передать заказ лаборатории' } satisfies ApiResponse); }
});
