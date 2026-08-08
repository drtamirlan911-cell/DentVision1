import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import {
  listActiveSessions,
  expireSession,
  expireAllSessions,
} from './session.service.js';
import {
  getConsents,
  getRequiredConsents,
  upsertConsent,
  getMedicalFileAccess,
  logMedicalFileAccess,
  getAIActions,
  confirmAIAction,
  getSecurityDashboard,
  runComplianceCheck,
} from './compliance.service.js';
import {
  requiredVersionFor,
  audienceForRole,
  type ConsentAudience,
} from './consent.catalog.js';
import { auditFromReq } from './audit.service.js';

export const complianceRouter = Router();
complianceRouter.use(authenticate);

// ═══════════════════════════════════════════════════════════════
// SESSION MANAGEMENT
// ═══════════════════════════════════════════════════════════════

complianceRouter.get('/sessions', async (req: AuthRequest, res) => {
  try {
    const sessions = await listActiveSessions(req.user!.id);
    return res.json({ ok: true, data: sessions } satisfies ApiResponse);
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Ошибка загрузки сессий' } satisfies ApiResponse);
  }
});

complianceRouter.post('/sessions/:id/expire', async (req: AuthRequest, res) => {
  try {
    await expireSession(String(req.params.id));
    await auditFromReq(req, { action: 'SESSION_EXPIRED', entity: 'session', entityId: String(req.params.id) });
    return res.json({ ok: true } satisfies ApiResponse);
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Ошибка завершения сессии' } satisfies ApiResponse);
  }
});

complianceRouter.post('/sessions/expire-all', async (req: AuthRequest, res) => {
  try {
    await expireAllSessions(req.user!.id);
    await auditFromReq(req, { action: 'ALL_SESSIONS_EXPIRED', entity: 'session' });
    return res.json({ ok: true } satisfies ApiResponse);
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Ошибка' } satisfies ApiResponse);
  }
});

// ═══════════════════════════════════════════════════════════════
// CONSENT MANAGEMENT
// ═══════════════════════════════════════════════════════════════

complianceRouter.get('/consents', async (req: AuthRequest, res) => {
  try {
    const consents = await getConsents(req.user!.id);
    return res.json({ ok: true, data: consents } satisfies ApiResponse);
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Ошибка загрузки согласий' } satisfies ApiResponse);
  }
});

// Click-wrap: what this party must still accept (missing / stale by version).
complianceRouter.get('/consents/required', async (req: AuthRequest, res) => {
  try {
    const explicit = req.query.audience as ConsentAudience | undefined;
    const audience: ConsentAudience = explicit || audienceForRole({
      role: req.user!.role,
      organizationType: (req.user as any)?.organizationType,
      personType: (req.user as any)?.personType,
    });
    const status = await getRequiredConsents(req.user!.id, audience);
    return res.json({ ok: true, data: { audience, ...status } } satisfies ApiResponse);
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Ошибка загрузки требуемых согласий' } satisfies ApiResponse);
  }
});

complianceRouter.post('/consents', async (req: AuthRequest, res) => {
  try {
    const { type, accepted, version } = req.body as { type: string; accepted: boolean; version?: string };
    if (!type || typeof accepted !== 'boolean') {
      return res.status(400).json({ ok: false, error: 'type и accepted обязательны' } satisfies ApiResponse);
    }
    // Record against the current catalog version (so acceptance clears "stale").
    const resolvedVersion = version || requiredVersionFor(type) || '1.0';
    const consent = await upsertConsent(req.user!.id, type, accepted, req.ip, resolvedVersion);
    await auditFromReq(req, {
      action: `CONSENT_${accepted ? 'ACCEPTED' : 'REVOKED'}`,
      entity: 'consent',
      entityId: `${type}@${resolvedVersion}`,
    });
    return res.json({ ok: true, data: consent } satisfies ApiResponse);
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Ошибка сохранения согласия' } satisfies ApiResponse);
  }
});

// ═══════════════════════════════════════════════════════════════
// MEDICAL FILE ACCESS
// ═══════════════════════════════════════════════════════════════

complianceRouter.get('/medical/:patientId', requirePermission('patient.read'), async (req: AuthRequest, res) => {
  try {
    const logs = await getMedicalFileAccess(String(req.params.patientId));
    return res.json({ ok: true, data: logs } satisfies ApiResponse);
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Ошибка' } satisfies ApiResponse);
  }
});

complianceRouter.post('/medical/log', requirePermission('patient.read'), async (req: AuthRequest, res) => {
  try {
    const { patientId, fileType, storagePath, action, viewerId } = req.body as {
      patientId: string; fileType: string; storagePath: string; action: 'UPLOAD' | 'VIEW' | 'DOWNLOAD'; viewerId?: string;
    };
    const log = await logMedicalFileAccess(patientId, fileType, storagePath, req.user!.id, action, viewerId || req.user!.id);
    return res.json({ ok: true, data: log } satisfies ApiResponse);
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Ошибка' } satisfies ApiResponse);
  }
});

// ═══════════════════════════════════════════════════════════════
// AI GOVERNANCE
// ═══════════════════════════════════════════════════════════════

complianceRouter.get('/ai', async (req: AuthRequest, res) => {
  try {
    const actions = await getAIActions({ userId: req.user!.id, limit: 50 });
    return res.json({ ok: true, data: actions } satisfies ApiResponse);
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Ошибка' } satisfies ApiResponse);
  }
});

complianceRouter.post('/ai/:id/confirm', async (req: AuthRequest, res) => {
  try {
    const log = await confirmAIAction(String(req.params.id), req.user!.id);
    await auditFromReq(req, { action: 'AI_ACTION_CONFIRMED', entity: 'ai_action', entityId: String(req.params.id) });
    return res.json({ ok: true, data: log } satisfies ApiResponse);
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Ошибка подтверждения' } satisfies ApiResponse);
  }
});

complianceRouter.get('/ai/stats', async (req: AuthRequest, res) => {
  try {
    const [total, todayCount, pendingConfirm] = await Promise.all([
      prisma.aIActionLog.count(),
      prisma.aIActionLog.count({ where: { createdAt: { gte: new Date(new Date().setHours(0,0,0,0)) } } }),
      prisma.aIActionLog.count({ where: { doctorConfirmed: false } }),
    ]);
    return res.json({ ok: true, data: { total, todayCount, pendingConfirm } } satisfies ApiResponse);
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Ошибка загрузки статистики' } satisfies ApiResponse);
  }
});

// ═══════════════════════════════════════════════════════════════
// COMPLIANCE CHECKS (product/course/supplier rules)
// ═══════════════════════════════════════════════════════════════

const ENTITY_TYPES = ['product', 'course', 'supplier'];

complianceRouter.post('/checks', requirePermission('compliance.manage'), async (req: AuthRequest, res) => {
  try {
    const { entityType, entityId } = req.body || {};
    if (!ENTITY_TYPES.includes(entityType) || !entityId) {
      return res.status(400).json({ ok: false, error: 'entityType (product|course|supplier) и entityId обязательны' } satisfies ApiResponse);
    }
    const check = await runComplianceCheck(entityType, entityId);
    return res.status(201).json({ ok: true, data: check } satisfies ApiResponse);
  } catch (error) {
    console.error('Compliance check error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при проверке' } satisfies ApiResponse);
  }
});

complianceRouter.get('/checks', requirePermission('compliance.manage'), async (req: AuthRequest, res) => {
  const { entityType, entityId } = req.query as Record<string, string | undefined>;
  const where: Record<string, unknown> = {};
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;
  const checks = await prisma.complianceCheck.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
  return res.json({ ok: true, data: checks } satisfies ApiResponse);
});

// ═══════════════════════════════════════════════════════════════
// SECURITY DASHBOARD (aggregated)
// ═══════════════════════════════════════════════════════════════

complianceRouter.get('/dashboard', async (req: AuthRequest, res) => {
  try {
    const dashboard = await getSecurityDashboard(req.user!.id, req.user?.clinicId);
    return res.json({ ok: true, data: dashboard } satisfies ApiResponse);
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Ошибка' } satisfies ApiResponse);
  }
});

export default complianceRouter;
