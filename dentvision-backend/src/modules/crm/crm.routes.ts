import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { uid } from '../../lib/helpers.js';
import type { Prisma } from '@prisma/client';
import { loadClinicAccess, blockClinicWrites } from '../../middleware/planGate.js';
import { assertSameClinic, requireClinicScope } from '../../lib/clinicAccess.js';

export const crmRouter = Router();

crmRouter.use(authenticate);
crmRouter.use(loadClinicAccess);
crmRouter.use(blockClinicWrites);

interface TreatmentPlanLineItem {
  id?: string;
  serviceId?: string;
  serviceName?: string;
  name?: string;
  price?: number;
  teeth?: number[];
  qty?: number;
}

interface TreatmentPlanStage {
  id?: string;
  title: string;
  status?: string;
  sortOrder?: number;
  cost?: number | null;
  items?: TreatmentPlanLineItem[];
  notes?: string;
}

interface TreatmentPlanItems {
  diagnosis?: string | null;
  totalBudget?: number | null;
  teeth?: number[];
  stages?: TreatmentPlanStage[];
  doctorId?: string | null;
}

function lineItemTotal(item: TreatmentPlanLineItem): number {
  const teeth = Array.isArray(item.teeth) ? item.teeth : [];
  const units = teeth.length > 0 ? teeth.length : (Number(item.qty) || 1);
  return Math.round((Number(item.price) || 0) * units);
}

function stageTotal(stage: TreatmentPlanStage): number {
  if (Array.isArray(stage.items) && stage.items.length > 0) {
    return stage.items.reduce((sum, item) => sum + lineItemTotal(item), 0);
  }
  return Number(stage.cost) || 0;
}

function enrichStages(stages: TreatmentPlanStage[] = []): TreatmentPlanStage[] {
  return stages.map((stage, index) => ({
    ...stage,
    id: stage.id || uid(),
    sortOrder: stage.sortOrder ?? index + 1,
    items: Array.isArray(stage.items)
      ? stage.items.map((item) => ({
          ...item,
          id: item.id || uid(),
          serviceName: item.serviceName || item.name || 'Услуга',
          teeth: Array.isArray(item.teeth) ? item.teeth : [],
          qty: Number(item.qty) || 1,
          price: Number(item.price) || 0,
        }))
      : [],
    cost: stageTotal({
      ...stage,
      items: Array.isArray(stage.items) ? stage.items : [],
    }),
  }));
}

function collectPlanTeeth(stages: TreatmentPlanStage[]): number[] {
  const set = new Set<number>();
  for (const stage of stages) {
    for (const item of stage.items || []) {
      for (const tooth of item.teeth || []) set.add(tooth);
    }
  }
  return [...set].sort((a, b) => a - b);
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
    const stages = enrichStages(items.stages || []);
    const computedTotal = stages.reduce((sum, stage) => sum + stageTotal(stage), 0);
    return {
      id: plan.id,
      patientId: plan.patientId,
      patientName: plan.patient ? `${plan.patient.firstName} ${plan.patient.lastName}`.trim() : undefined,
      title: plan.title,
      status: plan.status,
      diagnosis: items.diagnosis ?? plan.notes ?? null,
      notes: plan.notes,
      totalBudget: computedTotal > 0 ? computedTotal : (plan.price ?? items.totalBudget ?? null),
      teeth: collectPlanTeeth(stages).length ? collectPlanTeeth(stages) : (items.teeth || []),
      stages,
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
    const { clinicId: paramClinicId } = req.params as { clinicId: string };
    const clinicId = requireClinicScope(req, res, { paramClinicId });
    if (!clinicId) return;

    const { patientId, status } = req.query as { patientId?: string; status?: string };

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
    if (!assertSameClinic(req, res, patient.clinicId)) return;

    const normalizedStages = enrichStages(stages || []);
    const computedTotal = normalizedStages.reduce((sum, stage) => sum + stageTotal(stage), 0);
    const resolvedBudget = totalBudget ?? (computedTotal > 0 ? computedTotal : null);

    const items = {
      diagnosis: diagnosis ?? null,
      totalBudget: resolvedBudget,
      teeth: collectPlanTeeth(normalizedStages).length ? collectPlanTeeth(normalizedStages) : (teeth || []),
      stages: normalizedStages,
      doctorId: doctorId ?? null,
    } as unknown as Prisma.InputJsonValue;

    const plan = id
      ? await prisma.treatmentPlan.update({
          where: { id },
          data: {
            title: title || undefined,
            status: status || undefined,
            items,
            price: resolvedBudget ?? undefined,
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
            price: resolvedBudget ?? null,
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
    const plan = await prisma.treatmentPlan.findUnique({
      where: { id },
      include: { patient: { select: { clinicId: true } } },
    });
    if (!plan) {
      return res.status(404).json({ ok: false, error: 'План не найден' } satisfies ApiResponse);
    }
    if (!assertSameClinic(req, res, plan.patient?.clinicId)) return;

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
    if (!assertSameClinic(req, res, plan.patient?.clinicId)) return;

    const items = ((plan.items as TreatmentPlanItems) || {}) as TreatmentPlanItems;
    const stages = enrichStages(Array.isArray(items.stages) ? [...items.stages] : []);
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
    stages[idx].cost = stageTotal(stages[idx]);

    const allDone = stages.length > 0 && stages.every((s) => s.status === 'done' || s.status === 'completed');
    const anyActive = stages.some((s) => s.status === 'in_progress' || s.status === 'active');
    const nextPlanStatus = allDone ? 'completed' : anyActive ? 'in_progress' : plan.status;
    const computedTotal = stages.reduce((sum, stage) => sum + stageTotal(stage), 0);

    const updated = await prisma.treatmentPlan.update({
      where: { id },
      data: {
        items: {
          ...items,
          stages,
          totalBudget: computedTotal || items.totalBudget || null,
          teeth: collectPlanTeeth(stages),
        } as unknown as Prisma.InputJsonValue,
        status: nextPlanStatus,
        price: computedTotal || plan.price,
      },
      include: { patient: { select: { firstName: true, lastName: true } } },
    });

    return res.json({ ok: true, data: serializePlan(updated) } satisfies ApiResponse);
  } catch (error) {
    console.error('[CRM] Patch stage error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось обновить этап' } satisfies ApiResponse);
  }
});
