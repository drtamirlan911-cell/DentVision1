import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { uid } from '../../lib/helpers.js';
import { loadClinicAccess, blockClinicWrites } from '../../middleware/planGate.js';

export const labRouter = Router();

labRouter.use(authenticate);
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
  doctorId?: string;
}

const VALID_STATUSES = [
  'pending', 'sent', 'in_progress', 'try_in', 'adjustment',
  'ready', 'delivered', 'remake', 'delayed', 'cancelled',
] as const;

// The LabOrder table predates the CRM's richer work-order form (patient
// name as free text, material, tooth, shade). Rather than migrate the
// schema again, the extra fields are kept in the existing `files` JSON
// column alongside any real file attachments.
function serializeLabOrder(order: {
  id: string; clinicId: string; patientId: string | null; labName: string | null;
  status: string; type: string | null; notes: string | null; files: unknown;
  deadline: Date | null; price: number | null; createdAt: Date; updatedAt: Date;
}) {
  const meta = (order.files as { meta?: LabOrderMeta } | null)?.meta || {};
  return {
    id: order.id,
    clinicId: order.clinicId,
    patientId: order.patientId,
    patientName: meta.patientName || order.labName || '',
    labType: order.type,
    material: meta.material || '',
    toothNumber: meta.toothNumber || '',
    shade: meta.shade || '',
    remakeOfId: meta.remakeOfId || null,
    appointmentId: meta.appointmentId || null,
    tryInDate: meta.tryInDate || null,
    doctorId: meta.doctorId || null,
    dueDate: order.deadline,
    notes: order.notes,
    status: order.status,
    price: order.price,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

function buildMeta(
  body: Partial<LabOrderMeta>,
  existing: LabOrderMeta = {},
): LabOrderMeta {
  return {
    ...existing,
    ...(body.patientName !== undefined ? { patientName: body.patientName } : {}),
    ...(body.material !== undefined ? { material: body.material } : {}),
    ...(body.toothNumber !== undefined ? { toothNumber: body.toothNumber } : {}),
    ...(body.shade !== undefined ? { shade: body.shade } : {}),
    ...(body.remakeOfId !== undefined ? { remakeOfId: body.remakeOfId } : {}),
    ...(body.appointmentId !== undefined ? { appointmentId: body.appointmentId } : {}),
    ...(body.tryInDate !== undefined ? { tryInDate: body.tryInDate } : {}),
    ...(body.doctorId !== undefined ? { doctorId: body.doctorId } : {}),
  };
}

labRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user!.clinicId;
    if (!clinicId) return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);

    const orders = await prisma.labOrder.findMany({ where: { clinicId }, orderBy: { createdAt: 'desc' } });
    return res.json({ ok: true, data: orders.map(serializeLabOrder) } satisfies ApiResponse);
  } catch (error: any) {
    console.error('[Lab] list error:', error);
    // Missing/mismatched table should not break CRM shell — return empty until migration applied.
    const code = error?.code || error?.meta?.code;
    if (code === 'P2021' || code === 'P2022' || /does not exist|column|relation/i.test(String(error?.message || ''))) {
      return res.json({
        ok: true,
        data: [],
        warning: 'Таблица lab_orders не готова — примените миграцию 20260720_community_lab_fix',
      } as any);
    }
    return res.status(500).json({ ok: false, error: 'Не удалось получить заказы лаборатории' } satisfies ApiResponse);
  }
});

labRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user!.clinicId;
    if (!clinicId) return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);

    const {
      id, patientId, patientName, labType, material, toothNumber, shade,
      dueDate, notes, status, price, remakeOfId, appointmentId, tryInDate, doctorId,
    } = req.body as {
      id?: string; patientId?: string; patientName?: string; labType?: string; material?: string;
      toothNumber?: string | number; shade?: string; dueDate?: string; notes?: string; status?: string;
      price?: number; remakeOfId?: string; appointmentId?: string; tryInDate?: string; doctorId?: string;
    };

    let existingMeta: LabOrderMeta = {};
    if (id) {
      const existing = await prisma.labOrder.findUnique({ where: { id } });
      existingMeta = (existing?.files as { meta?: LabOrderMeta } | null)?.meta || {};
    }

    const meta = buildMeta(
      { patientName, material, toothNumber, shade, remakeOfId, appointmentId, tryInDate, doctorId },
      existingMeta,
    );
    const files = { meta } as any;

    const data = {
      patientId: patientId || null,
      type: labType || null,
      notes: notes || null,
      status: status || 'pending',
      deadline: dueDate ? new Date(dueDate) : null,
      price: price ?? null,
      files,
    };

    const order = id
      ? await prisma.labOrder.update({ where: { id }, data })
      : await prisma.labOrder.create({ data: { id: uid(), clinicId, ...data } });

    return res.status(201).json({ ok: true, data: serializeLabOrder(order) } satisfies ApiResponse);
  } catch (error) {
    console.error('[Lab] upsert error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось сохранить заказ лаборатории' } satisfies ApiResponse);
  }
});

labRouter.patch('/:id/status', async (req: AuthRequest, res) => {
  try {
    const { status } = req.body as { status?: string };
    if (!status || !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      return res.status(400).json({
        ok: false,
        error: `Недопустимый статус. Допустимые: ${VALID_STATUSES.join(', ')}`,
      } satisfies ApiResponse);
    }

    const order = await prisma.labOrder.update({
      where: { id: req.params.id as string },
      data: { status },
    });

    return res.json({ ok: true, data: serializeLabOrder(order) } satisfies ApiResponse);
  } catch (error) {
    console.error('[Lab] status update error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось обновить статус заказа' } satisfies ApiResponse);
  }
});

labRouter.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await prisma.labOrder.delete({ where: { id: req.params.id as string } });
    return res.json({ ok: true, data: { deleted: true } } satisfies ApiResponse);
  } catch (error) {
    console.error('[Lab] delete error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось удалить заказ лаборатории' } satisfies ApiResponse);
  }
});
