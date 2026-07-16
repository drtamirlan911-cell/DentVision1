// ═══════════════════════════════════════════════════════════════
// CONVERSATION MEMORY — Память диалога AI
//
// Хранит контекст разговора:
// - Текущий пациент/объект внимания
// - Цепочка действий
// - Предыдущие ответы и решения
// - Сущности, о которых шла речь
// ═══════════════════════════════════════════════════════════════

// In-memory store для conversation contexts
// В будущем — Redis или БД
const conversationStore = new Map();

const MAX_HISTORY = 50;
const MAX_CONTEXT_AGE_MS = 30 * 60 * 1000; // 30 минут

export function getConversationContext(userId) {
  const ctx = conversationStore.get(userId);
  if (!ctx) return createEmptyContext();
  if (Date.now() - ctx.lastActivity > MAX_CONTEXT_AGE_MS) {
    conversationStore.delete(userId);
    return createEmptyContext();
  }
  return ctx;
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
    });
  }

  if (ctx.history.length > MAX_HISTORY) {
    ctx.history = ctx.history.slice(-MAX_HISTORY);
  }

  if (update.intent) ctx.lastIntent = update.intent;
  if (update.skillId) ctx.lastSkill = update.skillId;

  extractEntities(ctx, update.message || '');

  conversationStore.set(userId, ctx);
  return ctx;
}

export function clearConversationContext(userId) {
  conversationStore.delete(userId);
}

// ─── ИЗВЛЕЧЕНИЕ СУЩНОСТЕЙ ИЗ СООБЩЕНИЯ ──────────────────────

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

  const serviceM = message.match(/(?:лечение|пломб|имплант|коронк|протез|通道| канал)/i);
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
}

function createEmptyContext() {
  return {
    entities: {},
    history: [],
    turnCount: 0,
    lastActivity: Date.now(),
    lastIntent: null,
    lastSkill: null,
  };
}

export default { getConversationContext, updateConversationContext, clearConversationContext };
