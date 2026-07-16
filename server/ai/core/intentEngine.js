// ═══════════════════════════════════════════════════════════════
// INTENT ENGINE — Central pipeline for all user interactions
//
// User Message → Intent → Context → Role → Skill → Sources →
// → Permissions → Command Bus → API → Response → Suggestions
//
// This is the OS of DentVision Intelligence.
// All channels (chat, voice, Telegram, WhatsApp, mobile, watch)
// feed into this engine. Business logic never changes.
// ═══════════════════════════════════════════════════════════════

import { detectSkill, getSkill } from '../skills.js';
import { getAction, getActionsForRole } from '../actions.js';
import { resolveConversationContext } from '../memory/conversation.js';
import { buildSystemPrompt, buildGreeting } from '../personality.js';
import { gatherContext, gatherProactiveAlerts } from '../context.js';
import { orchestrateKnowledge } from '../knowledge/orchestrator.js';
import { buildDigitalTwin } from '../memory/digitalTwin.js';

// ─── INTENT TYPES ────────────────────────────────────────────

export const INTENT_TYPES = {
  QUERY: 'query',
  ACTION: 'action',
  NAVIGATION: 'navigation',
  SEARCH: 'search',
  RECOMMENDATION: 'recommendation',
  CONVERSATION: 'conversation',
  UNKNOWN: 'unknown',
};

// ─── INTENT CLASSIFICATION ───────────────────────────────────

const INTENT_PATTERNS = [
  {
    type: INTENT_TYPES.ACTION,
    patterns: [
      /^создай/i, /^открой/i, /^покажи/i, /^запиши/i, /^назначь/i,
      /^отмен/i, /^подтверди/i, /^обнови/i, /^измени/i, /^удали/i,
      /^отправь/i, /^сформируй/i, /^заполни/i, /^закрой/i,
    ],
  },
  {
    type: INTENT_TYPES.SEARCH,
    patterns: [
      /^найди/i, /^ищи/i, /^поиск/i, /^где/i, /^какой/i, /^какие/i,
      /^какая/i, /^какое/i, /^есть ли/i,
    ],
  },
  {
    type: INTENT_TYPES.RECOMMENDATION,
    patterns: [
      /^рекоменд/i, /^совет/i, /^что выбрать/i, /^что лучше/i,
      /^какой.*выбрать/i, /^помоги с выбором/i, /^подбер/i,
      /^подходящ/i, /^оптималь/i,
    ],
  },
  {
    type: INTENT_TYPES.QUERY,
    patterns: [
      /^сколько/i, /^какой/i, /^какая/i, /^какие/i, /^какое/i,
      /^когда/i, /^что/i, /^почему/i, /^зачем/i, /^чем/i,
      /^расскажи/i, /^объясни/i, /^опис/i, /^что такое/i,
    ],
  },
  {
    type: INTENT_TYPES.NAVIGATION,
    patterns: [
      /^перейти/i, /^вернуться/i, /^назад/i, /^в главное/i,
    ],
  },
];

function classifyIntent(message) {
  const msg = message.trim();
  for (const { type, patterns } of INTENT_PATTERNS) {
    for (const p of patterns) {
      if (p.test(msg)) return type;
    }
  }
  if (msg.length < 5) return INTENT_TYPES.CONVERSATION;
  return INTENT_TYPES.QUERY;
}

// ─── REFERENCE RESOLUTION ────────────────────────────────────

function resolveReferences(message, conversationContext) {
  let resolved = message;

  if (!conversationContext?.entities) return resolved;

  const refs = [
    { pattern: /он|она|его|её|ему|ей|его|ими|ими/gi, entity: 'lastPatient' },
    { pattern: /то же|так же|аналогично/gi, entity: 'lastAction' },
    { pattern: /этот|эта|это|эти/gi, entity: 'lastEntity' },
  ];

  for (const ref of refs) {
    if (ref.pattern.test(resolved) && conversationContext.entities[ref.entity]) {
      resolved = resolved.replace(ref.pattern, conversationContext.entities[ref.entity].name || '');
    }
  }

  return resolved;
}

// ─── MAIN PIPELINE ───────────────────────────────────────────

export async function processMessage(userMessage, ctx) {
  const {
    user,
    clinic,
    conversationHistory = [],
    conversationContext = {},
    channel = 'chat',
  } = ctx;

  // 1. CONVERSATION MEMORY — resolve references
  const resolvedMessage = resolveReferences(userMessage, conversationContext);

  // 2. INTENT CLASSIFICATION
  const intent = classifyIntent(resolvedMessage);

  // 3. SKILL DETECTION
  const skillId = detectSkill(resolvedMessage);
  const skill = getSkill(skillId);

  // 4. CONTEXT GATHERING
  const [clinicContext, proactiveAlerts, digitalTwin] = await Promise.all([
    gatherContext(clinic?.id),
    gatherProactiveAlerts(clinic?.id),
    buildDigitalTwin(user.id),
  ]);

  // 5. COMMAND RESOLUTION — find actionable commands
  const resolvedSkill = detectSkill(resolvedMessage);
  const skillActions = getSkill(resolvedSkill).actions || [];
  const roleActions = getActionsForRole(user.role || user.platformRole || '*');
  const availableActions = roleActions.filter(a => skillActions.includes(a.name));

  // 6. PERMISSION CHECK — filter by clinic scope
  const permittedActions = availableActions.filter(a => {
    if (a.clinicScoped && !clinic?.id) return false;
    return true;
  });

  // 7. KNOWLEDGE ORCHESTRATION — gather knowledge from all sources
  const knowledge = await orchestrateKnowledge(resolvedMessage, {
    user,
    clinic,
    clinicContext,
    skillId,
    digitalTwin,
  });

  // 8. BUILD SYSTEM PROMPT
  const systemPrompt = buildSystemPrompt(user, clinic, clinicContext);

  // 9. GATHER CONVERSATION HISTORY for context
  const historySnippet = conversationHistory.slice(-10).map(m =>
    `${m.role === 'user' ? 'Пользователь' : 'AI'}: ${m.content}`
  ).join('\n');

  // 10. FORMULATE RESPONSE
  const response = formulateResponse({
    message: resolvedMessage,
    intent,
    skill,
    skillId,
    knowledge,
    clinicContext,
    proactiveAlerts,
    digitalTwin,
    permittedActions,
    conversationContext,
    historySnippet,
    user,
    clinic,
  });

  // 11. UPDATE CONVERSATION CONTEXT
  const updatedContext = updateConversationContext(conversationContext, {
    message: userMessage,
    response,
    intent,
    skillId,
  });

  return {
    ...response,
    conversationContext: updatedContext,
    channel,
  };
}

// ─── RESPONSE FORMULATION ────────────────────────────────────

function formulateResponse({ message, intent, skill, skillId, knowledge, clinicContext, proactiveAlerts, digitalTwin, permittedActions, conversationContext, historySnippet, user, clinic }) {
  const greeting = buildGreeting(user, clinic, clinicContext);

  // Try to match a direct knowledge answer first
  if (knowledge?.directAnswer) {
    return {
      reply: knowledge.directAnswer,
      skill: skillId,
      actions: permittedActions.slice(0, 3).map(a => ({ type: a.name, description: a.description })),
      suggestions: generateSuggestions(skillId, intent, clinicContext, permittedActions),
      proactive: proactiveAlerts,
    };
  }

  // Try contextual knowledge
  if (knowledge?.contextual) {
    return {
      reply: knowledge.contextual,
      skill: skillId,
      data: knowledge.data,
      actions: permittedActions.slice(0, 3).map(a => ({ type: a.name, description: a.description })),
      suggestions: generateSuggestions(skillId, intent, clinicContext, permittedActions),
      proactive: proactiveAlerts,
    };
  }

  // Generate contextual response based on intent and skill
  const reply = generateContextualReply(intent, skillId, message, clinicContext, digitalTwin, knowledge);

  return {
    reply,
    skill: skillId,
    actions: permittedActions.slice(0, 3).map(a => ({ type: a.name, description: a.description })),
    suggestions: generateSuggestions(skillId, intent, clinicContext, permittedActions),
    proactive: proactiveAlerts,
  };
}

// ─── CONTEXTUAL REPLY GENERATOR ──────────────────────────────

function generateContextualReply(intent, skillId, message, clinicContext, digitalTwin, knowledge) {
  const msg = message.toLowerCase();

  switch (skillId) {
    case 'clinical': {
      if (/пациент/i.test(msg)) {
        if (clinicContext?.totalPatients) {
          return `В базе ${clinicContext.totalPatients} ${clinicContext.totalPatients === 1 ? 'пациент' : 'пациентов'}. Уточните имя или телефон для поиска.`;
        }
        return 'Открываю список пациентов.';
      }
      if (/лечен/i.test(msg)) return 'Для формирования плана лечения укажите пациента и жалобы.';
      return 'Помогу с клиническими вопросами. Уточните, что именно вас интересует.';
    }

    case 'practice': {
      if (/расписан/i.test(msg) || /сегодня/i.test(msg)) {
        if (clinicContext?.todayAppointments !== undefined) {
          return `Сегодня ${clinicContext.todayAppointments} ${clinicContext.todayAppointments === 1 ? 'запись' : 'записей'}.${clinicContext.pendingAppointments ? ` Ожидают подтверждения: ${clinicContext.pendingAppointments}.` : ''}`;
        }
        return 'Открываю расписание на сегодня.';
      }
      if (/запис/i.test(msg)) return 'Для создания записи укажите пациента, услугу и дату.';
      return 'Помогу с управлением практикой.';
    }

    case 'analytics': {
      if (clinicContext?.revenue !== undefined) {
        return `Выручка сегодня: ${clinicContext.revenue.toLocaleString('ru-RU')} ₸.\nПациентов в базе: ${clinicContext.totalPatients || 0}.`;
      }
      return 'Открываю аналитику клиники.';
    }

    case 'shopping': {
      if (/цен/i.test(msg) || /стоим/i.test(msg)) {
        return 'Для получения информации о ценах укажите интересующий товар или категорию.';
      }
      if (knowledge?.recommendations?.length > 0) {
        const items = knowledge.recommendations.slice(0, 3);
        const list = items.map(i => `- ${i.name} (${i.brand || ''}) — ${i.price?.toLocaleString('ru-RU')} ₸, рейтинг ${i.rating || '—'}`).join('\n');
        return `Вот подходящие варианты:\n${list}\n\nНапомню: я рекомендую, а не продаю. Выбор за вами.`;
      }
      return 'Помогу подобрать оборудование или материалы. Уточните, что именно вам нужно.';
    }

    case 'learning': {
      if (knowledge?.recommendations?.length > 0) {
        const items = knowledge.recommendations.slice(0, 3);
        const list = items.map(i => `- ${i.title} (${i.category}) — ${i.durationHours}ч, рейтинг ${i.rating || '—'}`).join('\n');
        return `Рекомендую обратить внимание:\n${list}`;
      }
      if (digitalTwin?.completedCourses > 0) {
        return `У вас ${digitalTwin.completedCourses} пройденных курсов. Рекомендую продолжить обучение по вашей специализации.`;
      }
      return 'Помогу подобрать обучение. Расскажите о ваших интересах или специализации.';
    }

    case 'research': {
      return knowledge?.contextual || 'Подготовлю информацию по вашему запросу. Уточните аспект для более точной рекомендации.';
    }

    case 'automation': {
      return 'Помогу с настройками и автоматизацией. Что именно нужно настроить?';
    }

    case 'patient': {
      if (/найти/i.test(msg)) return 'Уточните имя или телефон пациента для поиска.';
      return 'Помогу найти информацию о пациенте.';
    }

    default:
      return 'Помогу с вопросами по стоматологии, управлению клиникой, обучением и подбором оборудования. Уточните, что именно вас интересует.';
  }
}

// ─── SUGGESTION GENERATOR ────────────────────────────────────

function generateSuggestions(skillId, intent, clinicContext, permittedActions) {
  const suggestions = [];

  switch (skillId) {
    case 'clinical':
      suggestions.push('Найти пациента', 'Показать расписание', 'Открыть медицинскую карту');
      break;
    case 'practice':
      suggestions.push('Показать расписание', 'Неподтверждённые записи', 'Создать запись');
      break;
    case 'analytics':
      suggestions.push('Статистика за сегодня', 'Неоплаченные счета', 'Отчёт за день');
      break;
    case 'shopping':
      suggestions.push('Обзор сканеров', 'Композиты для реставрации', 'Оборудование для кабинета');
      break;
    case 'learning':
      suggestions.push('Курсы по терапии', 'Курсы по имплантации', 'Мой профиль');
      break;
    case 'research':
      suggestions.push('Сравнить импланты', 'Протоколы лечения', 'Обзор литературы');
      break;
    default:
      if (clinicContext?.todayAppointments !== undefined) {
        suggestions.push(`Расписание (${clinicContext.todayAppointments} записей)`);
      }
      suggestions.push('Найти пациента', 'Показать расписание');
  }

  return suggestions.slice(0, 4);
}

// ─── CONVERSATION CONTEXT UPDATE ─────────────────────────────

function updateConversationContext(prev, { message, response, intent, skillId }) {
  const entities = { ...prev.entities };

  const patientMatch = message.match(/пациент[а-я]*\s+([А-Яа-яёЁ]+)/i);
  if (patientMatch) {
    entities.lastPatient = { name: patientMatch[1], type: 'patient' };
  }

  const entityMatch = message.match(/(?:покажи|открой|найди)\s+(.+?)(?:\s+и|\s*$)/i);
  if (entityMatch) {
    entities.lastEntity = { name: entityMatch[1].trim(), type: 'reference' };
  }

  return {
    entities,
    lastSkill: skillId,
    lastIntent: intent,
    turnCount: (prev.turnCount || 0) + 1,
    lastActivity: new Date().toISOString(),
  };
}

// ─── GREETING GENERATOR ──────────────────────────────────────

export async function generateInitialGreeting(user, clinic) {
  const [clinicContext, proactiveAlerts, digitalTwin] = await Promise.all([
    gatherContext(clinic?.id),
    gatherProactiveAlerts(clinic?.id),
    buildDigitalTwin(user.id),
  ]);

  const greeting = buildGreeting(user, clinic, clinicContext);

  const suggestions = [];
  if (clinic) {
    if (clinicContext.todayAppointments > 0) {
      suggestions.push(`Расписание (${clinicContext.todayAppointments} записей)`);
    }
    if (clinicContext.pendingAppointments > 0) {
      suggestions.push(`${clinicContext.pendingAppointments} ожидают подтверждения`);
    }
    if (clinicContext.unpaidReceipts > 0) {
      suggestions.push(`${clinicContext.unpaidReceipts} неоплаченных счетов`);
    }
  }
  suggestions.push('Найти пациента', 'Показать расписание');

  return {
    reply: greeting,
    skill: 'practice',
    actions: [],
    suggestions: suggestions.slice(0, 4),
    proactive: proactiveAlerts,
    digitalTwin,
  };
}

export default { processMessage, generateInitialGreeting, INTENT_TYPES };
