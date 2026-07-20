// ═══════════════════════════════════════════════════════════════
// CONVERSATION MEMORY — Память диалога AI
// Hot cache in-memory + durable AiThread / AiMessage (Prisma)
// ═══════════════════════════════════════════════════════════════

import crypto from 'crypto';
import prisma from '../../lib/prisma.js';

const conversationStore = new Map();

const MAX_HISTORY = 50;
const MAX_CONTEXT_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days hot cache

function canPersist(userId) {
  return Boolean(userId) && userId !== 'guest';
}

async function prismaReady() {
  try {
    return Boolean(prisma.aiThread);
  } catch {
    return false;
  }
}

export function getConversationContext(userId) {
  const ctx = conversationStore.get(userId);
  if (!ctx) return createEmptyContext();
  if (Date.now() - ctx.lastActivity > MAX_CONTEXT_AGE_MS) {
    conversationStore.delete(userId);
    return createEmptyContext();
  }
  return ctx;
}

/** Load durable thread into hot cache (no-op for guests / missing table). */
export async function ensureConversationLoaded(userId) {
  if (!canPersist(userId)) return getConversationContext(userId);
  const cached = conversationStore.get(userId);
  if (cached && cached.history?.length) return cached;

  if (!(await prismaReady())) return getConversationContext(userId);

  try {
    const thread = await prisma.aiThread.findFirst({
      where: { userId, active: true },
      orderBy: { updatedAt: 'desc' },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: MAX_HISTORY } },
    });
    if (!thread) return getConversationContext(userId);

    const ctx = createEmptyContext();
    ctx.threadId = thread.id;
    ctx.entities = (thread.entities && typeof thread.entities === 'object') ? thread.entities : {};
    ctx.turnCount = thread.turnCount || 0;
    ctx.lastSkill = thread.lastSkill || null;
    ctx.lastIntent = thread.lastIntent || null;
    ctx.lastActivity = new Date(thread.updatedAt).getTime();
    ctx.history = (thread.messages || []).map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: new Date(m.createdAt).getTime(),
      skill: m.skill || undefined,
    }));
    conversationStore.set(userId, ctx);
    return ctx;
  } catch (e) {
    console.warn('AI thread load skipped:', e.message);
    return getConversationContext(userId);
  }
}

export function updateConversationContext(userId, update) {
  let ctx = conversationStore.get(userId);
  if (!ctx) ctx = createEmptyContext();

  ctx.lastActivity = Date.now();
  ctx.turnCount++;

  if (update.entities) {
    Object.assign(ctx.entities, update.entities);
  }

  if (update.message) {
    ctx.history.push({
      role: 'user',
      content: update.message,
      timestamp: Date.now(),
    });
  }

  if (update.response) {
    ctx.history.push({
      role: 'assistant',
      content: update.response,
      timestamp: Date.now(),
      skill: update.skillId || undefined,
    });
  }

  if (ctx.history.length > MAX_HISTORY) {
    ctx.history = ctx.history.slice(-MAX_HISTORY);
  }

  if (update.intent) ctx.lastIntent = update.intent;
  if (update.skillId) ctx.lastSkill = update.skillId;

  extractEntities(ctx, update.message || '');

  conversationStore.set(userId, ctx);

  // Fire-and-forget durable write
  persistConversation(userId, ctx, update).catch((e) => {
    console.warn('AI thread persist skipped:', e.message);
  });

  return ctx;
}

async function persistConversation(userId, ctx, update) {
  if (!canPersist(userId) || !(await prismaReady())) return;

  const titleFrom = (update.message || ctx.history.find((h) => h.role === 'user')?.content || 'Диалог')
    .slice(0, 80);

  let threadId = ctx.threadId;
  if (!threadId) {
    const existing = await prisma.aiThread.findFirst({
      where: { userId, active: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (existing) {
      threadId = existing.id;
    } else {
      threadId = crypto.randomUUID();
      await prisma.aiThread.create({
        data: {
          id: threadId,
          userId,
          clinicId: update.clinicId || null,
          title: titleFrom,
          entities: ctx.entities || {},
          turnCount: ctx.turnCount,
          lastSkill: ctx.lastSkill,
          lastIntent: ctx.lastIntent,
          active: true,
        },
      });
    }
    ctx.threadId = threadId;
    conversationStore.set(userId, ctx);
  }

  await prisma.aiThread.update({
    where: { id: threadId },
    data: {
      entities: ctx.entities || {},
      turnCount: ctx.turnCount,
      lastSkill: ctx.lastSkill,
      lastIntent: ctx.lastIntent,
      title: titleFrom,
      updatedAt: new Date(),
      clinicId: update.clinicId || undefined,
    },
  });

  const toWrite = [];
  if (update.message) {
    toWrite.push({
      id: crypto.randomUUID(),
      threadId,
      role: 'user',
      content: update.message,
    });
  }
  if (update.response) {
    toWrite.push({
      id: crypto.randomUUID(),
      threadId,
      role: 'assistant',
      content: update.response,
      skill: update.skillId || null,
    });
  }
  if (toWrite.length) {
    await prisma.aiMessage.createMany({ data: toWrite });
  }
}

export async function clearConversationContext(userId) {
  conversationStore.delete(userId);
  if (!canPersist(userId) || !(await prismaReady())) return;
  try {
    await prisma.aiThread.updateMany({
      where: { userId, active: true },
      data: { active: false, updatedAt: new Date() },
    });
  } catch (e) {
    console.warn('AI thread clear skipped:', e.message);
  }
}

export async function listThreads(userId, limit = 20) {
  if (!canPersist(userId) || !(await prismaReady())) return [];
  try {
    return await prisma.aiThread.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        turnCount: true,
        lastSkill: true,
        active: true,
        updatedAt: true,
        createdAt: true,
      },
    });
  } catch {
    return [];
  }
}

export async function getThreadWithMessages(userId, threadId) {
  if (!canPersist(userId) || !(await prismaReady())) return null;
  try {
    const thread = await prisma.aiThread.findFirst({
      where: { id: threadId, userId },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: MAX_HISTORY } },
    });
    return thread;
  } catch {
    return null;
  }
}

export async function activateThread(userId, threadId) {
  if (!canPersist(userId) || !(await prismaReady())) return null;
  const owned = await prisma.aiThread.findFirst({ where: { id: threadId, userId } });
  if (!owned) return null;
  await prisma.aiThread.updateMany({
    where: { userId, active: true },
    data: { active: false },
  });
  const thread = await prisma.aiThread.update({
    where: { id: threadId },
    data: { active: true, updatedAt: new Date() },
    include: { messages: { orderBy: { createdAt: 'asc' }, take: MAX_HISTORY } },
  });

  const ctx = createEmptyContext();
  ctx.threadId = thread.id;
  ctx.entities = (thread.entities && typeof thread.entities === 'object') ? thread.entities : {};
  ctx.turnCount = thread.turnCount || 0;
  ctx.lastSkill = thread.lastSkill || null;
  ctx.lastIntent = thread.lastIntent || null;
  ctx.lastActivity = Date.now();
  ctx.history = (thread.messages || []).map((m) => ({
    role: m.role,
    content: m.content,
    timestamp: new Date(m.createdAt).getTime(),
    skill: m.skill || undefined,
  }));
  conversationStore.set(userId, ctx);
  return thread;
}

function extractEntities(ctx, message) {
  const patientM = message.match(/(?:пациент[а-я]*|карточк[а-я]*|карт[а-я]*)\s+([А-Яа-яёЁ][а-яёЁ]+)/i);
  if (patientM) {
    ctx.entities.lastPatient = {
      name: patientM[1],
      type: 'patient',
      detectedAt: Date.now(),
    };
  }

  const doctorM = message.match(/(?:доктор|врач|д-р)\s+([А-Яа-яёЁ][а-яёЁ]+)/i);
  if (doctorM) {
    ctx.entities.lastDoctor = {
      name: doctorM[1],
      type: 'doctor',
      detectedAt: Date.now(),
    };
  }

  const serviceM = message.match(/(?:лечение|пломб|имплант|коронк|протез|канал)/i);
  if (serviceM) {
    ctx.entities.lastService = {
      name: serviceM[0],
      type: 'service',
      detectedAt: Date.now(),
    };
  }

  if (/кт|снимок|рентген|панорам/i.test(message)) {
    ctx.entities.lastImaging = {
      type: 'imaging',
      detectedAt: Date.now(),
    };
  }

  const equipM = message.match(/(?:сканер|микроскоп|компрессор|автоклав|кресло|лазер|рентген|визиограф|аппарат)\s+([А-Яа-яёЁ][а-яёЁ]+)?/i);
  if (equipM) {
    ctx.entities.lastEquipment = { name: equipM[0], type: 'equipment', detectedAt: Date.now() };
  }

  const courseM = message.match(/(?:курс|вебинар|тренинг|обучение)\s+([А-Яа-яёЁ][а-яёЁ]+)/i);
  if (courseM) {
    ctx.entities.lastCourse = { name: courseM[0], type: 'course', detectedAt: Date.now() };
  }

  const productM = message.match(/(?:композит|имплант|материал|пломба)\s+([А-Яа-яёЁa-zA-Z][а-яёЁa-zA-Z]+)/i);
  if (productM) {
    ctx.entities.lastProduct = { name: productM[0], type: 'product', detectedAt: Date.now() };
  }
}

function createEmptyContext() {
  return {
    threadId: null,
    entities: {},
    history: [],
    turnCount: 0,
    lastActivity: Date.now(),
    lastIntent: null,
    lastSkill: null,
  };
}

export default {
  getConversationContext,
  ensureConversationLoaded,
  updateConversationContext,
  clearConversationContext,
  listThreads,
  getThreadWithMessages,
  activateThread,
};
