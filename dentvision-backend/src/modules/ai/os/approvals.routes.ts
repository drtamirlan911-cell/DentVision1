/**
 * Approval Center API — human-in-the-loop for high-risk kernel actions
 * (`ai/os/dataScope.ts::HIGH_RISK_TOOLS`).
 *
 * A row here is created by the kernel itself (`kernel.ts` step 6) the moment
 * a high-risk tool call is actually confirmed, not proposed. This router only
 * ever reads/decides existing rows — it never creates one.
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
    const { where } = await buildApprovalFilter(req.user.id, clinicId);
    const finalWhere = status ? { ...where, status } : where;

    const approvals = await prisma.aiApproval.findMany({
      where: finalWhere,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return res.json({ ok: true, data: approvals });
  } catch (error) {
    console.error('[AI Approvals] list failed:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить список подтверждений' });
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

    const decisionNote = typeof req.body?.note === 'string' ? req.body.note : null;
    await prisma.aiApproval.update({
      where: { id: approval.id },
      data: { status: 'approved', decidedByUserId: req.user.id, decidedAt: new Date(), decisionNote },
    });

    // Execute as the original requester — the approval authorizes *their*
    // proposed action, it does not hand the approver's own identity to it.
    const result = await runAiAction(
      {
        surface: approval.surface as AiSurface,
        userId: approval.requestedByUserId,
        requestedClinicId: approval.clinicId,
        agentId: approval.agentId || undefined,
      },
      { tool: approval.tool, args: approval.params as Record<string, unknown>, approvalId: approval.id },
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
    console.error('[AI Approvals] approve failed:', error);
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

    const decisionNote = typeof req.body?.note === 'string' ? req.body.note : null;
    await prisma.aiApproval.update({
      where: { id: approval.id },
      data: { status: 'rejected', decidedByUserId: req.user.id, decidedAt: new Date(), decisionNote },
    });

    await auditFromReq(req, { action: 'ai.approval.rejected', entity: 'ai_approval', entityId: approval.id });
    return res.json({ ok: true, data: { id: approval.id, status: 'rejected' } });
  } catch (error) {
    console.error('[AI Approvals] reject failed:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось отклонить' });
  }
});

export default router;
