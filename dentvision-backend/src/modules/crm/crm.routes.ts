import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { uid } from '../../lib/helpers.js';
import type { Prisma } from '@prisma/client';

export const crmRouter = Router();

crmRouter.use(authenticate);

interface TreatmentPlanItems {
  diagnosis?: string | null;
  totalBudget?: number | null;
  teeth?: number[];
  stages?: Array<{ id?: string; title: string; status?: string; sortOrder?: number; cost?: number | null }>;
  doctorId?: string | null;
}

function serializePlan(plan: {
  id: string;
  patientId: string;
  title: string;
  status: string;
  items: unknown;
  price: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  patient?: { firstName: string; lastName: string } | null;
}) {
  const items = (plan.items as TreatmentPlanItems) || {};
  return {
    id: plan.id,
    patientId: plan.patientId,
    patientName: plan.patient ? `${plan.patient.firstName} ${plan.patient.lastName}`.trim() : undefined,
    title: plan.title,
    status: plan.status,
    diagnosis: items.diagnosis ?? plan.notes ?? null,
    notes: plan.notes,
    totalBudget: plan.price ?? items.totalBudget ?? null,
    teeth: items.teeth || [],
    stages: items.stages || [],
    doctorId: items.doctorId || null,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}

// Mandatory CRM section: Treatment Plans (Spec §05). Persists to the existing
// TreatmentPlan table; plan metadata beyond the base columns (diagnosis,
// stages, teeth, doctorId) is kept in the `items` JSON column to avoid a
// schema migration against the production database.
crmRouter.get('/:clinicId/treatment-plans', async (req: AuthRequest, res) => {
  try {
    const { clinicId } = req.params as { clinicId: string };
    const { patientId, status } = req.query as { patientId?: string; status?: string };

    if (req.user?.clinicId && req.user.clinicId !== clinicId) {
      return res.status(403).json({ ok: false, error: 'Доступ к другой клинике запрещён' } satisfies ApiResponse);
    }

    const plans = await prisma.treatmentPlan.findMany({
      where: {
        patient: { clinicId },
        ...(patientId && { patientId }),
        ...(status && { status }),
      },
      include: { patient: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ ok: true, data: plans.map(serializePlan) } satisfies ApiResponse);
  } catch (error) {
    console.error('[CRM] List treatment plans error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить планы лечения' } satisfies ApiResponse);
  }
});

crmRouter.post('/treatment-plans', async (req: AuthRequest, res) => {
  try {
    const {
      id, patientId, doctorId, title, diagnosis, status, totalBudget, teeth, stages, notes,
    } = req.body as {
      id?: string;
      patientId: string;
      doctorId?: string | null;
      title?: string;
      diagnosis?: string | null;
      status?: string;
      totalBudget?: number | null;
      teeth?: number[];
      stages?: TreatmentPlanItems['stages'];
      notes?: string | null;
    };

    if (!patientId) {
      return res.status(400).json({ ok: false, error: 'patientId обязателен' } satisfies ApiResponse);
    }

    const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { clinicId: true } });
    if (!patient) {
      return res.status(404).json({ ok: false, error: 'Пациент не найден' } satisfies ApiResponse);
    }
    if (req.user?.clinicId && patient.clinicId !== req.user.clinicId) {
      return res.status(403).json({ ok: false, error: 'Пациент принадлежит другой клинике' } satisfies ApiResponse);
    }

    const items = {
      diagnosis: diagnosis ?? null,
      totalBudget: totalBudget ?? null,
      teeth: teeth || [],
      stages: stages || [],
      doctorId: doctorId ?? null,
    } satisfies Prisma.InputJsonObject as unknown as TreatmentPlanItems & Prisma.InputJsonValue;

    const plan = id
      ? await prisma.treatmentPlan.update({
          where: { id },
          data: {
            title: title || undefined,
            status: status || undefined,
            items,
            price: totalBudget ?? undefined,
            notes: notes ?? diagnosis ?? undefined,
          },
          include: { patient: { select: { firstName: true, lastName: true } } },
        })
      : await prisma.treatmentPlan.create({
          data: {
            id: uid(),
            patientId,
            title: title || 'План лечения',
            status: status || 'proposed',
            items,
            price: totalBudget ?? null,
            notes: notes ?? diagnosis ?? null,
          },
          include: { patient: { select: { firstName: true, lastName: true } } },
        });

    return res.status(201).json({ ok: true, data: serializePlan(plan) } satisfies ApiResponse);
  } catch (error) {
    console.error('[CRM] Upsert treatment plan error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось сохранить план лечения' } satisfies ApiResponse);
  }
});

crmRouter.delete('/treatment-plans/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    await prisma.treatmentPlan.delete({ where: { id } });
    return res.json({ ok: true, data: { deleted: true } } satisfies ApiResponse);
  } catch (error) {
    console.error('[CRM] Delete treatment plan error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось удалить план лечения' } satisfies ApiResponse);
  }
});

/** Update a single stage — drives plan workflow (Spec §5.4.7). */
crmRouter.patch('/treatment-plans/:id/stages/:stageId', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const stageId = req.params.stageId as string;
    const { status, cost, title, appointmentId, invoiceId } = req.body as {
      status?: string;
      cost?: number | null;
      title?: string;
      appointmentId?: string;
      invoiceId?: string;
    };

    const plan = await prisma.treatmentPlan.findUnique({
      where: { id },
      include: { patient: { select: { clinicId: true, firstName: true, lastName: true } } },
    });
    if (!plan) {
      return res.status(404).json({ ok: false, error: 'План не найден' } satisfies ApiResponse);
    }
    if (req.user?.clinicId && plan.patient?.clinicId !== req.user.clinicId) {
      return res.status(403).json({ ok: false, error: 'Доступ запрещён' } satisfies ApiResponse);
    }

    const items = ((plan.items as TreatmentPlanItems) || {}) as TreatmentPlanItems;
    const stages = Array.isArray(items.stages) ? [...items.stages] : [];
    const idx = stages.findIndex((s) => s.id === stageId || String(s.sortOrder) === stageId);
    if (idx < 0) {
      return res.status(404).json({ ok: false, error: 'Этап не найден' } satisfies ApiResponse);
    }

    stages[idx] = {
      ...stages[idx],
      ...(status !== undefined && { status }),
      ...(cost !== undefined && { cost }),
      ...(title !== undefined && { title }),
      ...(appointmentId !== undefined && { appointmentId: appointmentId as any }),
      ...(invoiceId !== undefined && { invoiceId: invoiceId as any }),
    };

    const allDone = stages.length > 0 && stages.every((s) => s.status === 'done' || s.status === 'completed');
    const anyActive = stages.some((s) => s.status === 'in_progress' || s.status === 'active');
    const nextPlanStatus = allDone ? 'completed' : anyActive ? 'in_progress' : plan.status;

    const updated = await prisma.treatmentPlan.update({
      where: { id },
      data: {
        items: { ...items, stages } as unknown as Prisma.InputJsonValue,
        status: nextPlanStatus,
      },
      include: { patient: { select: { firstName: true, lastName: true } } },
    });

    return res.json({ ok: true, data: serializePlan(updated) } satisfies ApiResponse);
  } catch (error) {
    console.error('[CRM] Patch stage error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось обновить этап' } satisfies ApiResponse);
  }
});
