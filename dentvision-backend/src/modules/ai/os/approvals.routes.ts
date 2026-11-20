import { safeErrorKind } from '../../../lib/safeError.js';
/**
 * Approval Center API — human-in-the-loop for high-risk kernel actions
 * (`ai/os/dataScope.ts::HIGH_RISK_TOOLS`) and for durable agents that
 * propose rather than act (`jobs/recallAgent.ts`). Either way this router
 * only ever reads/decides existing rows — it never creates one.
 *
 * Most rows come from the kernel itself (`kernel.ts` step 6) the moment a
 * high-risk tool call is actually confirmed, not proposed.
 */

import { Router } from 'express';
import prisma from '../../../lib/prisma.js';
import { authenticate } from '../../../middleware/auth.js';
import type { AuthRequest } from '../../../types/index.js';
import { assertSameClinic } from '../../../lib/clinicAccess.js';
import { auditFromReq } from '../../compliance/audit.service.js';
import { resolveAiToolAccess } from './access.js';
import { runAiAction } from './kernel.js';
import { buildApprovalFilter } from './activityQuery.js';
import {
  decryptAiApprovalDecisionNote,
  decryptAiApprovalParams,
  encryptAiApprovalDecisionNote,
  getAiApprovalSummary,
  redactAiApprovalParams,
} from './approvalPrivacy.js';
import { listAiEmployeeTasks, transitionAiEmployeeTask } from './aiEmployeeTasks.js';
import type { AiSurface } from './kernel.types.js';

const router = Router();

/** GET /api/ai/approvals — visible to the caller via the same tiered ladder as the Activity Center. */
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ ok: false, error: 'Требуется авторизация' });
    }
    const status = req.query.status as string | undefined;
    const clinicId = req.user.clinicId || (req.query.clinicId as string) || null;
    const { where, canReadPhi } = await buildApprovalFilter(req.user.id, clinicId);
    const finalWhere = status ? { ...where, status } : where;

    const approvals = await prisma.aiApproval.findMany({
      where: finalWhere,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const safeApprovals = approvals.map((approval) => ({
      ...approval,
      params: redactAiApprovalParams(
        approval.tool,
        decryptAiApprovalParams(approval.params),
        canReadPhi,
      ),
      // Legacy summaries may already contain identifiers or clinical free text.
      summary: getAiApprovalSummary(approval.tool),
      decisionNote: canReadPhi ? decryptAiApprovalDecisionNote(approval.decisionNote) : null,
    }));
    return res.json({ ok: true, data: safeApprovals });
  } catch (error) {
    console.error('[AI Approvals] list failed:', safeErrorKind(error));
    return res.status(500).json({ ok: false, error: 'Не удалось получить список подтверждений' });
  }
});

/** GET /api/ai/approvals/tasks — durable AI Employee work queue for the workspace. */
router.get('/tasks', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ ok: false, error: 'Требуется авторизация' });
    }
    // Resolve the current membership/role from the database. JWT role and
    // clinic claims alone are not an authorization source for the task queue.
    const access = await resolveAiToolAccess({
      userId: req.user.id,
      clinicId: req.user.clinicId,
      organizationId: req.user.organizationId,
      organizationType: req.user.organizationType,
      supplierId: req.user.supplierId,
      lecturerId: req.user.lecturerId,
      isGuest: req.user.isGuest,
    });
    if (!access.clinicId) {
      return res.status(403).json({ ok: false, error: 'Рабочая очередь доступна только в подтверждённом контексте клиники' });
    }
    const rawLimit = Number(req.query.limit || 30);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100) : 30;
    const workspaceRoles = new Set(['OWNER', 'SUPERADMIN', 'MANAGER', 'ADMIN']);
    const canReadWorkspaceQueue = workspaceRoles.has(String(access.role).toUpperCase());
    const tasks = await listAiEmployeeTasks({
      clinicId: access.clinicId,
      ...(canReadWorkspaceQueue ? {} : {
        userId: req.user.id,
        includeUnassigned: true,
        role: access.role,
      }),
      status: typeof req.query.taskStatus === 'string' ? req.query.taskStatus as any : null,
      limit,
    });
    return res.json({ ok: true, data: tasks });
  } catch (error) {
    console.error('[AI Employee Tasks] list failed:', safeErrorKind(error));
    return res.status(500).json({ ok: false, error: 'Не удалось получить рабочие задачи AI' });
  }
});

/** POST /api/ai/approvals/tasks/:id/transition — lifecycle control for the durable task ledger. */
router.post('/tasks/:id/transition', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ ok: false, error: 'Требуется авторизация' });
    }
    const access = await resolveAiToolAccess({
      userId: req.user.id,
      clinicId: req.user.clinicId,
      organizationId: req.user.organizationId,
      organizationType: req.user.organizationType,
      supplierId: req.user.supplierId,
      lecturerId: req.user.lecturerId,
      isGuest: req.user.isGuest,
    });
    if (!access.clinicId) {
      return res.status(403).json({ ok: false, error: 'Рабочая очередь доступна только в подтверждённом контексте клиники' });
    }
    const status = String(req.body?.status || '');
    const allowedStatuses = new Set(['observing', 'proposed', 'awaiting_approval', 'executing', 'verified', 'completed', 'failed', 'cancelled']);
    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ ok: false, error: 'Недопустимый статус задачи' });
    }

    // Only verified workspace owners/managers/superadmins may transition any
    // task in the clinic. Other roles may resolve only their own or unassigned
    // tasks in their verified role queue.
    const privileged = new Set(['OWNER', 'SUPERADMIN', 'MANAGER', 'ADMIN']);
    if (!privileged.has(String(access.role || '').toUpperCase())) {
      const ownRoleQueue = await listAiEmployeeTasks({
        clinicId: access.clinicId,
        userId: req.user.id,
        includeUnassigned: true,
        role: access.role,
        limit: 100,
      });
      if (!ownRoleQueue.some((task) => task.id === String(req.params.id))) {
        return res.status(403).json({ ok: false, error: 'Недостаточно прав для изменения этой задачи' });
      }
    }

    const task = await transitionAiEmployeeTask({
      id: String(req.params.id),
      clinicId: access.clinicId,
      status: status as any,
      result: req.body?.result,
      error: typeof req.body?.error === 'string' ? req.body.error : undefined,
    });
    if (!task) return res.status(404).json({ ok: false, error: 'Задача не найдена' });

    await auditFromReq(req, {
      action: `ai.employee_task.${status}`,
      entity: 'ai_employee_task',
      entityId: task.id,
    });
    return res.json({ ok: true, data: task });
  } catch (error) {
    console.error('[AI Employee Tasks] transition failed:', safeErrorKind(error));
    return res.status(500).json({ ok: false, error: 'Не удалось изменить состояние задачи' });
  }
});

/** POST /api/ai/approvals/:id/approve — re-enters the kernel to actually execute the action. */
router.post('/:id/approve', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ ok: false, error: 'Требуется авторизация' });
    }
    const approval = await prisma.aiApproval.findUnique({ where: { id: String(req.params.id) } });
    if (!approval) {
      return res.status(404).json({ ok: false, error: 'Подтверждение не найдено' });
    }
    if (approval.status !== 'pending') {
      return res.status(409).json({ ok: false, error: 'Уже обработано' });
    }
    if (approval.expiresAt && approval.expiresAt.getTime() < Date.now()) {
      return res.status(409).json({ ok: false, error: 'Срок действия истёк' });
    }
    if (!assertSameClinic(req, res, approval.clinicId)) return;

    const access = await resolveAiToolAccess({
      userId: req.user.id,
      clinicId: req.user.clinicId,
      isGuest: req.user.isGuest,
    });
    if (!access.allowed.has(approval.tool)) {
      return res.status(403).json({ ok: false, error: 'Недостаточно прав для подтверждения этого действия' });
    }
    if (approval.riskLevel === 'high' && approval.requestedByUserId === req.user.id) {
      return res.status(403).json({ ok: false, error: 'Нельзя самому подтвердить собственный запрос такого уровня риска' });
    }

    // Decrypt after clinic scope and the current tool permission are verified.
    const approvalParams = decryptAiApprovalParams(approval.params);
    const rawDecisionNote = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 1000) : '';
    const decisionNote = encryptAiApprovalDecisionNote(rawDecisionNote || null);
    await prisma.aiApproval.update({
      where: { id: approval.id },
      data: { status: 'approved', decidedByUserId: req.user.id, decidedAt: new Date(), decisionNote },
    });

    const result = await runAiAction(
      {
        surface: approval.surface as AiSurface,
        userId: approval.requestedByUserId,
        requestedClinicId: approval.clinicId,
        agentId: approval.agentId || undefined,
      },
      { tool: approval.tool, args: approvalParams, approvalId: approval.id },
    );

    await prisma.aiApproval.update({
      where: { id: approval.id },
      data: { resultActivityId: result.activityId, status: result.status === 'ok' ? 'approved' : 'failed' },
    });

    await auditFromReq(req, { action: 'ai.approval.approved', entity: 'ai_approval', entityId: approval.id });

    if (result.status !== 'ok') {
      return res.status(500).json({ ok: false, error: result.status === 'denied' ? result.error : 'Не удалось выполнить действие' });
    }
    return res.json({ ok: true, data: result });
  } catch (error) {
    console.error('[AI Approvals] approve failed:', safeErrorKind(error));
    return res.status(500).json({ ok: false, error: 'Не удалось подтвердить действие' });
  }
});

/** POST /api/ai/approvals/:id/reject */
router.post('/:id/reject', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ ok: false, error: 'Требуется авторизация' });
    }
    const approval = await prisma.aiApproval.findUnique({ where: { id: String(req.params.id) } });
    if (!approval) {
      return res.status(404).json({ ok: false, error: 'Подтверждение не найдено' });
    }
    if (approval.status !== 'pending') {
      return res.status(409).json({ ok: false, error: 'Уже обработано' });
    }
    if (!assertSameClinic(req, res, approval.clinicId)) return;

    const access = await resolveAiToolAccess({
      userId: req.user.id,
      clinicId: req.user.clinicId,
      isGuest: req.user.isGuest,
    });
    if (!access.allowed.has(approval.tool)) {
      return res.status(403).json({ ok: false, error: 'Недостаточно прав' });
    }

    const rawDecisionNote = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 1000) : '';
    const decisionNote = encryptAiApprovalDecisionNote(rawDecisionNote || null);
    await prisma.aiApproval.update({
      where: { id: approval.id },
      data: { status: 'rejected', decidedByUserId: req.user.id, decidedAt: new Date(), decisionNote },
    });

    await auditFromReq(req, { action: 'ai.approval.rejected', entity: 'ai_approval', entityId: approval.id });
    return res.json({ ok: true, data: { id: approval.id, status: 'rejected' } });
  } catch (error) {
    console.error('[AI Approvals] reject failed:', safeErrorKind(error));
    return res.status(500).json({ ok: false, error: 'Не удалось отклонить' });
  }
});

export default router;
