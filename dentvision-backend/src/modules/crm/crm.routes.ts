import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { uid } from '../../lib/helpers.js';
import type { Prisma } from '@prisma/client';
import { loadClinicAccess, blockClinicWrites } from '../../middleware/planGate.js';
import { assertSameClinic, requireClinicScope } from '../../lib/clinicAccess.js';
import {
  collectPlanTeeth,
  enrichStages,
  normalizePlanItems,
  planTotal,
  stageTotal,
  type TreatmentPlanItems,
} from '../../lib/treatmentPlanShape.js';
import * as planRelease from '../patient-presentation/planRelease.service.js';

export const crmRouter = Router();

crmRouter.use(authenticate);
crmRouter.use(loadClinicAccess);
crmRouter.use(blockClinicWrites);

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
    const items = normalizePlanItems(plan.items);
    const stages = enrichStages(items.stages);
    const computedTotal = planTotal(stages);
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
crmRouter.get('/:clinicId/treatment-plans', requirePermission('patient.read'), async (req: AuthRequest, res) => {
  try {
    const { clinicId: paramClinicId } = req.params as { clinicId: string };
    const clinicId = requireClinicScope(req, res, { paramClinicId });
    if (!clinicId) return;

    const { patientId, status } = req.query as { patientId?: string; status?: string };

    const plans = await prisma.treatmentPlan.findMany({
      where: {
        patient: { clinicId } as any,
        ...(patientId && { patientId }),
        ...(status && { status: status as any }),
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

crmRouter.post('/treatment-plans', requirePermission('patient.write'), async (req: AuthRequest, res) => {
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
    const computedTotal = planTotal(normalizedStages);
    const resolvedBudget = totalBudget ?? (computedTotal > 0 ? computedTotal : null);

    const items = {
      diagnosis: diagnosis ?? null,
      totalBudget: resolvedBudget,
      teeth: collectPlanTeeth(normalizedStages).length ? collectPlanTeeth(normalizedStages) : (teeth || []),
      stages: normalizedStages,
      doctorId: doctorId ?? null,
    } as unknown as Prisma.InputJsonValue;

    if (id) {
      // Verify the existing plan belongs to a patient in the caller's clinic.
      const existingPlan = await prisma.treatmentPlan.findUnique({
        where: { id },
        include: { patient: { select: { clinicId: true } } },
      });
      if (!existingPlan) {
        return res.status(404).json({ ok: false, error: 'План лечения не найден' } satisfies ApiResponse);
      }
      if (!assertSameClinic(req, res, existingPlan.patient?.clinicId ?? '')) return;
    }

    const plan = id
      ? await prisma.treatmentPlan.update({
          where: { id },
          data: {
            title: title || undefined,
            status: (status || undefined) as any,
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
            status: (status || 'proposed') as any,
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

crmRouter.delete('/treatment-plans/:id', requirePermission('patient.write'), async (req: AuthRequest, res) => {
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

// ─────────────── Doctor Approval Layer ───────────────
// `medical.manage` rather than `patient.write`: authoring a plan and certifying
// it clinically are different rights. OWNER and DOCTOR hold it; ADMIN does not.

/** Freeze the plan as a named clinician signed it, optionally publishing at once. */
crmRouter.post('/treatment-plans/:id/approve', requirePermission('medical.manage'), async (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id);
    const plan = await prisma.treatmentPlan.findUnique({
      where: { id },
      include: { patient: { select: { clinicId: true } } },
    });
    if (!plan) {
      return res.status(404).json({ ok: false, error: 'План не найден' } satisfies ApiResponse);
    }
    if (!assertSameClinic(req, res, plan.patient?.clinicId)) return;

    const { note, publish, validityDays } = req.body as {
      note?: string;
      publish?: boolean;
      validityDays?: number;
    };

    const release = await planRelease.approveAndRelease({
      planId: id,
      approvedByUserId: req.user!.id,
      approvalNote: note ?? null,
      publish: publish === true,
      validityDays: Number.isFinite(Number(validityDays)) ? Number(validityDays) : undefined,
    });
    return res.json({ ok: true, data: release } satisfies ApiResponse);
  } catch (error) {
    if (error instanceof planRelease.PlanReleaseError) {
      return res
        .status(error.code === 'NOT_FOUND' ? 404 : error.code === 'CONFLICT' ? 409 : 400)
        .json({ ok: false, error: error.message } satisfies ApiResponse);
    }
    console.error('[CRM] Approve treatment plan error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось утвердить план' } satisfies ApiResponse);
  }
});

/** Second gate: the doctor has read the wording and lets the patient see it. */
crmRouter.post('/plan-releases/:releaseId/publish', requirePermission('medical.manage'), async (req: AuthRequest, res) => {
  try {
    const releaseId = String(req.params.releaseId);
    const existing = await prisma.treatmentPlanRelease.findUnique({ where: { id: releaseId } });
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Публикация не найдена' } satisfies ApiResponse);
    }
    if (!assertSameClinic(req, res, existing.clinicId)) return;

    const release = await planRelease.publishRelease(releaseId);
    return res.json({ ok: true, data: release } satisfies ApiResponse);
  } catch (error) {
    if (error instanceof planRelease.PlanReleaseError) {
      return res
        .status(error.code === 'NOT_FOUND' ? 404 : 409)
        .json({ ok: false, error: error.message } satisfies ApiResponse);
    }
    console.error('[CRM] Publish plan release error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось опубликовать план' } satisfies ApiResponse);
  }
});

/** Pull a plan back — the patient loses access on their very next request. */
crmRouter.post('/plan-releases/:releaseId/withdraw', requirePermission('medical.manage'), async (req: AuthRequest, res) => {
  try {
    const releaseId = String(req.params.releaseId);
    const existing = await prisma.treatmentPlanRelease.findUnique({ where: { id: releaseId } });
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Публикация не найдена' } satisfies ApiResponse);
    }
    if (!assertSameClinic(req, res, existing.clinicId)) return;

    const { reason } = req.body as { reason?: string };
    const release = await planRelease.withdrawRelease(releaseId, req.user!.id, reason ?? null);
    return res.json({ ok: true, data: release } satisfies ApiResponse);
  } catch (error) {
    if (error instanceof planRelease.PlanReleaseError) {
      return res.status(404).json({ ok: false, error: error.message } satisfies ApiResponse);
    }
    console.error('[CRM] Withdraw plan release error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось отозвать публикацию' } satisfies ApiResponse);
  }
});

/** Version history for one plan, superseded and withdrawn versions included. */
crmRouter.get('/treatment-plans/:id/releases', requirePermission('patient.read'), async (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id);
    const plan = await prisma.treatmentPlan.findUnique({
      where: { id },
      include: { patient: { select: { clinicId: true } } },
    });
    if (!plan) {
      return res.status(404).json({ ok: false, error: 'План не найден' } satisfies ApiResponse);
    }
    if (!assertSameClinic(req, res, plan.patient?.clinicId)) return;

    const releases = await planRelease.listReleasesForPlan(id);
    return res.json({ ok: true, data: releases } satisfies ApiResponse);
  } catch (error) {
    console.error('[CRM] List plan releases error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить версии плана' } satisfies ApiResponse);
  }
});

/** Update a single stage — drives plan workflow (Spec §5.4.7). */
crmRouter.patch('/treatment-plans/:id/stages/:stageId', requirePermission('patient.write'), async (req: AuthRequest, res) => {
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

    const items = normalizePlanItems(plan.items);
    const stages = enrichStages([...items.stages!]);
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
    const computedTotal = planTotal(stages);

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
