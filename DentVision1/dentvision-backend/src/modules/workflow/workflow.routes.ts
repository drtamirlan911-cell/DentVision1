import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { runWorkflow } from './workflow.engine.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';

// Workflow Studio API (Phase 9). Clinic-scoped automations.
export const workflowRouter = Router();

workflowRouter.use(authenticate);

workflowRouter.get('/', async (req: AuthRequest, res) => {
  const scopeId = (req.query.scopeId as string) || req.user?.clinicId;
  if (!scopeId) {
    return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
  }
  const workflows = await prisma.workflow.findMany({
    where: { scopeType: 'CLINIC', scopeId },
    orderBy: { createdAt: 'desc' },
  });
  return res.json({ ok: true, data: workflows } satisfies ApiResponse);
});

workflowRouter.post('/', requirePermission('workflow.manage'), async (req: AuthRequest, res) => {
  try {
    const { name, trigger, graph, status, scopeId } = req.body || {};
    const clinicId = scopeId || req.user?.clinicId;
    if (!name || !trigger || !graph) {
      return res.status(400).json({ ok: false, error: 'name, trigger и graph обязательны' } satisfies ApiResponse);
    }
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }
    const workflow = await prisma.workflow.create({
      data: {
        scopeType: 'CLINIC',
        scopeId: clinicId,
        name,
        trigger,
        graph,
        status: status === 'draft' ? 'draft' : 'active',
        createdBy: req.user?.id || null,
      },
    });
    return res.status(201).json({ ok: true, data: workflow } satisfies ApiResponse);
  } catch (error) {
    console.error('Create workflow error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при создании автоматизации' } satisfies ApiResponse);
  }
});

workflowRouter.patch('/:id', requirePermission('workflow.manage'), async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.workflow.findUnique({ where: { id: req.params.id as string } });
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Автоматизация не найдена' } satisfies ApiResponse);
    }
    const b = req.body || {};
    const workflow = await prisma.workflow.update({
      where: { id: existing.id },
      data: {
        ...(b.name !== undefined && { name: b.name }),
        ...(b.trigger !== undefined && { trigger: b.trigger }),
        ...(b.graph !== undefined && { graph: b.graph }),
        ...(b.status !== undefined && { status: b.status }),
      },
    });
    return res.json({ ok: true, data: workflow } satisfies ApiResponse);
  } catch (error) {
    console.error('Update workflow error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при обновлении автоматизации' } satisfies ApiResponse);
  }
});

// Manual run (test).
workflowRouter.post('/:id/run', requirePermission('workflow.manage'), async (req: AuthRequest, res) => {
  const workflow = await prisma.workflow.findUnique({ where: { id: req.params.id as string } });
  if (!workflow) {
    return res.status(404).json({ ok: false, error: 'Автоматизация не найдена' } satisfies ApiResponse);
  }
  const run = await runWorkflow(workflow, { event: 'manual', ...(req.body?.data || {}) });
  return res.status(201).json({ ok: true, data: run } satisfies ApiResponse);
});

workflowRouter.get('/:id/runs', async (req: AuthRequest, res) => {
  const runs = await prisma.workflowRun.findMany({
    where: { workflowId: req.params.id as string },
    orderBy: { startedAt: 'desc' },
    take: 50,
  });
  return res.json({ ok: true, data: runs } satisfies ApiResponse);
});

export default workflowRouter;
