import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { publish } from '../../lib/events.js';
import { uid } from '../../lib/helpers.js';

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
};

const STATUS_FLOW: Record<string, string[]> = {
  pending: ['sent', 'cancelled'], sent: ['in_progress', 'delayed', 'cancelled'],
  in_progress: ['try_in', 'adjustment', 'ready', 'remake', 'delayed', 'cancelled'],
  try_in: ['adjustment', 'ready', 'remake'], adjustment: ['ready', 'remake'],
  ready: ['delivered', 'remake'], delivered: [], remake: ['in_progress', 'delayed', 'cancelled'],
  delayed: ['in_progress', 'cancelled'], cancelled: [],
};

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

function serialize(order: any) {
  const meta = metaOf(order.files);
  return {
    id: order.id, clinicId: order.clinicId, clinicName: order.clinic?.name || '', patientId: order.patientId,
    patientName: order.patient?.firstName ? `${order.patient.firstName} ${order.patient.lastName}`.trim() : (meta.patientName || ''),
    doctorId: order.doctorId || null, type: order.type || '', material: meta.material || '', toothNumber: meta.toothNumber || '',
    shade: meta.shade || '', notes: order.notes || '', deadline: order.deadline, price: order.price, status: order.status,
    technicianId: meta.technicianId || null, remakeOfId: meta.remakeOfId || null, appointmentId: meta.appointmentId || null,
    treatmentCaseId: (order as any).treatmentCaseId ?? null,
    createdAt: order.createdAt, updatedAt: order.updatedAt,
  };
}

async function caseIdOf(orderId: string): Promise<string | null> {
  const rows = await prisma.$queryRawUnsafe<{ treatmentCaseId: string | null }[]>(`SELECT "treatmentCaseId" FROM "lab_orders" WHERE "id"=$1 LIMIT 1`, orderId);
  return rows[0]?.treatmentCaseId ?? null;
}

async function appendEvent(order: { id: string; clinicId: string }, fromStatus: string | null, toStatus: string, actorUserId: string, note?: string) {
  await prisma.$executeRawUnsafe(`INSERT INTO "dental_lab_order_events" ("id","labOrderId","clinicId","fromStatus","toStatus","note","actorUserId","createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_TIMESTAMP)`, uid(), order.id, order.clinicId, fromStatus, toStatus, note ?? null, actorUserId);
}

async function ordersForLab(labId: string, status?: string) {
  const rows = await prisma.labOrder.findMany({
    where: { ...(status ? { status: status as any } : {}), files: { path: ['meta', 'laboratoryId'], equals: labId } },
    include: { patient: { select: { firstName: true, lastName: true } }, clinic: { select: { id: true, name: true } } },
    orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }], take: 500,
  });
  return Promise.all(rows.map(async (order) => serialize({ ...order, treatmentCaseId: await caseIdOf(order.id) })));
}

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
    return res.json({ ok: true, data: { lab: membership.lab, totals: { all: orders.length, active: active.length, dueSoon: dueSoon.length, overdue: overdue.length }, byStatus, priority: [...overdue, ...dueSoon.filter((o) => !overdue.includes(o))].slice(0, 8) } } satisfies ApiResponse);
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
    const existing = await prisma.labOrder.findFirst({ where: { id: req.params.id, files: { path: ['meta', 'laboratoryId'], equals: membership.labId } } });
    if (!existing) return res.status(404).json({ ok: false, error: 'Заказ не найден в этой лаборатории' } satisfies ApiResponse);
    if (!STATUS_FLOW[existing.status]?.includes(next)) return res.status(409).json({ ok: false, error: `Переход ${existing.status} → ${next} недоступен` } satisfies ApiResponse);
    const order = await prisma.labOrder.update({ where: { id: existing.id }, data: { status: next as any } });
    await appendEvent(order, existing.status, order.status, req.user!.id, req.body?.note ? String(req.body.note) : undefined);
    publish('labOrder.status_changed', { clinicId: order.clinicId, labOrderId: order.id, patientId: order.patientId || undefined, doctorId: order.doctorId || undefined, treatmentCaseId: await caseIdOf(order.id) || undefined, status: order.status, previousStatus: existing.status, userId: req.user?.id });
    return res.json({ ok: true, data: serialize({ ...order, treatmentCaseId: await caseIdOf(order.id) }) } satisfies ApiResponse);
  } catch (error) { console.error('[LabPlatform] status error:', error); return res.status(500).json({ ok: false, error: 'Не удалось изменить статус заказа' } satisfies ApiResponse); }
});

labPlatformRouter.patch('/orders/:id/technician', async (req: AuthRequest, res) => {
  try {
    const membership = await resolveLab(req);
    if (!membership) return res.status(403).json({ ok: false, error: 'Нет доступа к кабинету лаборатории' } satisfies ApiResponse);
    const technicianId = req.body?.technicianId ? String(req.body.technicianId) : null;
    if (technicianId) {
      const technician = await prisma.laboratoryMember.findFirst({ where: { labId: membership.labId, userId: technicianId } });
      if (!technician) return res.status(400).json({ ok: false, error: 'Сотрудник не состоит в этой лаборатории' } satisfies ApiResponse);
    }
    const existing = await prisma.labOrder.findFirst({ where: { id: req.params.id, files: { path: ['meta', 'laboratoryId'], equals: membership.labId } } });
    if (!existing) return res.status(404).json({ ok: false, error: 'Заказ не найден в этой лаборатории' } satisfies ApiResponse);
    const meta = metaOf(existing.files);
    const order = await prisma.labOrder.update({ where: { id: existing.id }, data: { files: { ...(existing.files as object || {}), meta: { ...meta, technicianId: technicianId || undefined } } } });
    return res.json({ ok: true, data: serialize({ ...order, treatmentCaseId: await caseIdOf(order.id) }) } satisfies ApiResponse);
  } catch (error) { console.error('[LabPlatform] technician error:', error); return res.status(500).json({ ok: false, error: 'Не удалось назначить техника' } satisfies ApiResponse); }
});

labPlatformRouter.get('/team', async (req: AuthRequest, res) => {
  try {
    const membership = await resolveLab(req);
    if (!membership) return res.status(403).json({ ok: false, error: 'Нет доступа к кабинету лаборатории' } satisfies ApiResponse);
    const members = await prisma.laboratoryMember.findMany({ where: { labId: membership.labId }, include: { user: true } });
    return res.json({ ok: true, data: members.map((m: any) => ({ id: m.userId, role: m.role, firstName: m.user.firstName, lastName: m.user.lastName, email: m.user.email, avatar: m.user.avatar })) } satisfies ApiResponse);
  } catch (error) { console.error('[LabPlatform] team error:', error); return res.status(500).json({ ok: false, error: 'Не удалось загрузить команду' } satisfies ApiResponse); }
});

labPlatformRouter.post('/assign', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(403).json({ ok: false, error: 'Действие доступно из клиники' } satisfies ApiResponse);
    const orderId = String(req.body?.orderId || ''), laboratoryId = String(req.body?.laboratoryId || '');
    if (!orderId || !laboratoryId) return res.status(400).json({ ok: false, error: 'orderId и laboratoryId обязательны' } satisfies ApiResponse);
    const lab = await prisma.laboratory.findUnique({ where: { id: laboratoryId }, select: { id: true, name: true } });
    if (!lab) return res.status(404).json({ ok: false, error: 'Лаборатория не найдена' } satisfies ApiResponse);
    const existing = await prisma.labOrder.findFirst({ where: { id: orderId, clinicId } });
    if (!existing) return res.status(404).json({ ok: false, error: 'Заказ не найден в вашей клинике' } satisfies ApiResponse);
    const meta = metaOf(existing.files);
    const order = await prisma.labOrder.update({ where: { id: existing.id }, data: { labName: lab.name, files: { ...(existing.files as object || {}), meta: { ...meta, laboratoryId: lab.id } } } });
    await appendEvent(order, null, order.status, req.user!.id, `Передан в лабораторию: ${lab.name}`);
    publish('labOrder.assigned', { clinicId, labOrderId: order.id, laboratoryId: lab.id, laboratoryName: lab.name, patientId: order.patientId || undefined, doctorId: order.doctorId || undefined, treatmentCaseId: await caseIdOf(order.id) || undefined, userId: req.user?.id });
    return res.json({ ok: true, data: serialize({ ...order, treatmentCaseId: await caseIdOf(order.id) }) } satisfies ApiResponse);
  } catch (error) { console.error('[LabPlatform] assign error:', error); return res.status(500).json({ ok: false, error: 'Не удалось передать заказ лаборатории' } satisfies ApiResponse); }
});
