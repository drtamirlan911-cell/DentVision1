import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { uid } from '../../lib/helpers.js';

export const labRouter = Router();

labRouter.use(authenticate);

interface LabOrderMeta {
  patientName?: string;
  material?: string;
  toothNumber?: string | number;
  shade?: string;
}

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
    dueDate: order.deadline,
    notes: order.notes,
    status: order.status,
    price: order.price,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

labRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user!.clinicId;
    if (!clinicId) return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);

    const orders = await prisma.labOrder.findMany({ where: { clinicId }, orderBy: { createdAt: 'desc' } });
    return res.json({ ok: true, data: orders.map(serializeLabOrder) } satisfies ApiResponse);
  } catch (error) {
    console.error('[Lab] list error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить заказы лаборатории' } satisfies ApiResponse);
  }
});

labRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user!.clinicId;
    if (!clinicId) return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);

    const { id, patientId, patientName, labType, material, toothNumber, shade, dueDate, notes, status, price } = req.body as {
      id?: string; patientId?: string; patientName?: string; labType?: string; material?: string;
      toothNumber?: string | number; shade?: string; dueDate?: string; notes?: string; status?: string; price?: number;
    };

    const files = { meta: { patientName, material, toothNumber, shade } satisfies LabOrderMeta };
    const data = {
      patientId: patientId || null,
      type: labType || null,
      notes: notes || null,
      status: status || 'in_progress',
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

labRouter.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await prisma.labOrder.delete({ where: { id: req.params.id as string } });
    return res.json({ ok: true, data: { deleted: true } } satisfies ApiResponse);
  } catch (error) {
    console.error('[Lab] delete error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось удалить заказ лаборатории' } satisfies ApiResponse);
  }
});
