// ═══════════════════════════════════════════════════════════════
// AI CHAT ENDPOINT — Точка входа DentVision Intelligence
//
// POST /api/ai/chat         — отправить сообщение
// GET  /api/ai/greeting     — получить приветствие
// GET  /api/ai/proactive    — получить проактивные уведомления
// POST /api/ai/action       — выполнить действие напрямую
// ═══════════════════════════════════════════════════════════════

import { Router } from 'express';
import { processMessage, generateInitialGreeting } from './core/intentEngine.js';
import { dispatch } from './core/commandBus.js';
import { getConversationContext, updateConversationContext, clearConversationContext } from './memory/conversation.js';
import { buildDigitalTwin } from './memory/digitalTwin.js';
import { generateProactiveAlerts } from './proactive.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';

export default function aiRoutes() {
  const router = Router();

  // ─── POST /api/ai/chat — отправить сообщение ───────────────
  router.post('/chat', optionalAuth, async (req, res) => {
    try {
      const { message, history = [] } = req.body;
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({ error: 'Сообщение обязательно' });
      }

      const user = req.user || { id: 'guest', name: 'Гость', role: 'guest', platformRole: 'guest' };
      const clinicId = (req.user?.activeClinicId || req.user?.clinicId) || null;

      let clinic = null;
      if (clinicId) {
        clinic = await prisma.clinic.findUnique({
          where: { id: clinicId },
          select: { id: true, name: true, type: true, plan: true },
        });
      }

      const conversationCtx = getConversationContext(user.id);

      const response = await processMessage(message.trim(), {
        user,
        clinic,
        conversationHistory: history.length > 0 ? history : conversationCtx.history,
        conversationContext: conversationCtx,
        channel: 'chat',
      });

      updateConversationContext(user.id, {
        message: message.trim(),
        response: response.reply,
        intent: response.skill,
        skillId: response.skill,
        entities: response.conversationContext?.entities || {},
      });

      res.json({
        reply: response.reply,
        skill: response.skill,
        source: response.source || 'internal',
        actions: response.actions || [],
        suggestions: response.suggestions || [],
        proactive: response.proactive || [],
        data: response.data || undefined,
        recommendations: response.recommendations || undefined,
        conversationContext: {
          turnCount: response.conversationContext?.turnCount || 0,
          entities: response.conversationContext?.entities || {},
        },
      });
    } catch (e) {
      console.error('AI Chat error:', e);
      res.status(500).json({ error: 'Ошибка обработки', detail: e && e.message || 'unknown' });
    }
  });

  // ─── GET /api/ai/greeting — приветствие ─────────────────────
  router.get('/greeting', optionalAuth, async (req, res) => {
    try {
      const user = req.user || { id: 'guest', name: 'Гость', role: 'guest' };
      const clinicId = (req.user?.activeClinicId || req.user?.clinicId) || null;

      let clinic = null;
      if (clinicId) {
        clinic = await prisma.clinic.findUnique({
          where: { id: clinicId },
          select: { id: true, name: true, type: true, plan: true },
        });
      }

      const greeting = await generateInitialGreeting(user, clinic);
      res.json(greeting);
    } catch (e) {
      console.error('AI Greeting error:', e);
      res.status(500).json({ error: 'Ошибка генерации приветствия' });
    }
  });

  // ─── GET /api/ai/proactive — проактивные уведомления ───────
  router.get('/proactive', optionalAuth, async (req, res) => {
    try {
      const clinicId = (req.user?.activeClinicId || req.user?.clinicId) || null;
      const userRole = req.user?.role || req.user?.platformRole || 'guest';
      const userId = req.user?.id || 'guest';
      const alerts = await generateProactiveAlerts(userId, clinicId, userRole);
      res.json({ alerts });
    } catch (e) {
      console.error('AI Proactive error:', e);
      res.json({ alerts: [] });
    }
  });

  // ─── POST /api/ai/action — выполнить действие напрямую ─────
  router.post('/action', authenticate, async (req, res) => {
    try {
      const { action, params = {}, confirmationRequired = false } = req.body;
      if (!action) return res.status(400).json({ error: 'Action name required' });

      const clinicId = req.user.activeClinicId || req.user.clinicId || null;
      let clinic = null;
      if (clinicId) {
        clinic = await prisma.clinic.findUnique({
          where: { id: clinicId },
          select: { id: true, name: true, type: true },
        });
      }

      const result = await dispatch({ action, params, confirmationRequired }, {
        user: req.user,
        clinic,
      });

      res.json(result);
    } catch (e) {
      console.error('AI Action error:', e);
      res.status(500).json({ error: 'Ошибка выполнения действия' });
    }
  });

  // ─── GET /api/ai/digital-twin — цифровой двойник ───────────
  router.get('/digital-twin', authenticate, async (req, res) => {
    try {
      const twin = await buildDigitalTwin(req.user.id);
      res.json({ twin });
    } catch (e) {
      console.error('Digital Twin error:', e);
      res.json({ twin: null });
    }
  });

  // ─── POST /api/ai/context — обновить контекст ──────────────
  router.post('/context', authenticate, async (req, res) => {
    try {
      const { patientId, appointmentId } = req.body;
      const contextUpdate = {};
      if (patientId) contextUpdate.activePatientId = patientId;
      if (appointmentId) contextUpdate.activeAppointmentId = appointmentId;

      updateConversationContext(req.user.id, { entities: contextUpdate });

      res.json({ ok: true, context: getConversationContext(req.user.id).entities });
    } catch (e) {
      res.json({ ok: true });
    }
  });

  // ─── DELETE /api/ai/context — сбросить контекст ────────────
  router.delete('/context', authenticate, (req, res) => {
    clearConversationContext(req.user.id);
    res.json({ ok: true });
  });

  return router;
}
