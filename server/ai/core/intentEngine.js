import { detectSkill, getSkill } from '../skills.js';
import { getAction, getActionsForRole } from '../actions.js';
import { buildSystemPrompt, buildGreeting } from '../personality.js';
import { gatherContext, gatherProactiveAlerts } from '../context.js';
import { orchestrateKnowledge } from '../knowledge/orchestrator.js';
import { buildDigitalTwin } from '../memory/digitalTwin.js';

export const INTENT_TYPES = {
  QUERY: 'query',
  ACTION: 'action',
  NAVIGATION: 'navigation',
  SEARCH: 'search',
  RECOMMENDATION: 'recommendation',
  CONVERSATION: 'conversation',
  UNKNOWN: 'unknown',
};

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
      /^есть ли/i,
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
    type: INTENT_TYPES.NAVIGATION,
    patterns: [
      /^перейти/i, /^вернуться/i, /^назад/i, /^в главное/i,
      /^открой раздел/i, /^перейди/i,
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

function resolveReferences(message, conversationContext) {
  let resolved = message;
  if (!conversationContext?.entities) return resolved;

  const patientEntity = conversationContext.entities.lastPatient;
  if (patientEntity?.name) {
    resolved = resolved.replace(/\b(он|она|его|её|ему|ей|пациент|пациента|пациенту)\b/gi, patientEntity.name);
    resolved = resolved.replace(/\b(его|её)\s+(медкарт|карт|снимок|зуб|план)/gi, `${patientEntity.name} $2`);
  }

  const entity = conversationContext.entities.lastEntity;
  if (entity?.name) {
    resolved = resolved.replace(/\b(этот|эта|это|эти|тот|та|те)\b/gi, entity.name);
  }

  return resolved;
}

export async function processMessage(userMessage, ctx) {
  const { user, clinic, conversationHistory = [], conversationContext = {}, channel = 'chat' } = ctx;

  const resolvedMessage = resolveReferences(userMessage, conversationContext);
  const intent = classifyIntent(resolvedMessage);
  const skillId = detectSkill(resolvedMessage);

  const [clinicContext, proactiveAlerts, digitalTwin] = await Promise.all([
    gatherContext(clinic?.id),
    gatherProactiveAlerts(clinic?.id),
    buildDigitalTwin(user.id),
  ]);

  const skillActions = getSkill(skillId).actions || [];
  const roleActions = getActionsForRole(user.role || user.platformRole || '*');
  const availableActions = roleActions.filter(a => skillActions.includes(a.name));
  const permittedActions = availableActions.filter(a => {
    if (a.clinicScoped && !clinic?.id) return false;
    return true;
  });

  const knowledge = await orchestrateKnowledge(resolvedMessage, {
    user, clinic, clinicContext, skillId, digitalTwin,
  });

  const systemPrompt = buildSystemPrompt(user, clinic, clinicContext);
  const historySnippet = conversationHistory.slice(-10).map(m =>
    `${m.role === 'user' ? 'Пользователь' : 'AI'}: ${m.content}`
  ).join('\n');

  const response = formulateResponse({
    message: resolvedMessage,
    intent, skillId, knowledge, clinicContext,
    proactiveAlerts, digitalTwin, permittedActions,
    conversationContext, historySnippet, user, clinic,
  });

  const updatedContext = updateConversationContext(conversationContext, {
    message: userMessage, response, intent, skillId,
  });

  return { ...response, conversationContext: updatedContext, channel };
}

function formulateResponse({
  message, intent, skillId, knowledge, clinicContext,
  proactiveAlerts, digitalTwin, permittedActions, conversationContext,
  historySnippet, user, clinic,
}) {
  const baseCtx = {
    entities: conversationContext.entities || {},
    turnCount: (conversationContext.turnCount || 0) + 1,
  };

  // Enrich permittedActions with full action definitions
  const enrichedActions = permittedActions.map(a => {
    const fullAction = getAction(a.name);
    return {
      ...a,
      type: a.name,
      label: a.description || a.name,
      confidence: 0.8,
      params: fullAction?.params || {},
      requiresConfirmation: fullAction?.requiresConfirmation || false,
    };
  });

  if (knowledge?.directAnswer) {
    return {
      reply: knowledge.directAnswer,
      skill: skillId,
      source: knowledge.source || 'knowledge_base',
      data: knowledge.data,
      recommendations: knowledge.recommendations,
      actions: enrichedActions.slice(0, 3),
      suggestions: generateSuggestions(skillId, intent, clinicContext, permittedActions),
      proactive: proactiveAlerts,
      conversationContext: baseCtx,
    };
  }

  if (knowledge?.contextual) {
    const sourceActions = [];
    if (knowledge.recommendations?.length > 0 && knowledge.source === 'shop') {
      sourceActions.push({ type: 'SearchShop', label: 'Посмотреть в Shop', confidence: 0.85, params: {}, requiresConfirmation: false });
    }
    if (knowledge.recommendations?.length > 0 && knowledge.source === 'school') {
      sourceActions.push({ type: 'SearchCourses', label: 'Подробнее в Academy', confidence: 0.85, params: {}, requiresConfirmation: false });
    }

    return {
      reply: knowledge.contextual,
      skill: skillId,
      source: knowledge.source || 'internal',
      data: knowledge.data,
      recommendations: knowledge.recommendations,
      actions: [...sourceActions, ...enrichedActions.slice(0, 2)],
      suggestions: generateSuggestions(skillId, intent, clinicContext, permittedActions),
      proactive: proactiveAlerts,
      conversationContext: baseCtx,
    };
  }

  const reply = generateContextualReply(intent, skillId, message, clinicContext, digitalTwin, knowledge, user, conversationContext);

  return {
    reply,
    skill: skillId,
    source: knowledge?.source || 'internal',
    data: knowledge?.data,
    recommendations: knowledge?.recommendations,
    actions: enrichedActions.slice(0, 3),
    suggestions: generateSuggestions(skillId, intent, clinicContext, permittedActions),
    proactive: proactiveAlerts,
    conversationContext: baseCtx,
  };
}

function generateContextualReply(intent, skillId, message, clinicContext, digitalTwin, knowledge, user, conversationContext) {
  const msg = message.toLowerCase();

  switch (skillId) {
    case 'clinical': {
      if (/пациент/i.test(msg)) {
        const nameMatch = msg.match(/пациент[а-я]*\s+([а-яё]+)/i);
        if (nameMatch) {
          return `Ищу пациента "${nameMatch[1]}". Открываю карточку для просмотра.`;
        }
        if (clinicContext?.totalPatients) {
          return `В базе ${clinicContext.totalPatients} пациентов. Чтобы найти конкретного, укажите имя или телефон.`;
        }
        return 'Открываю список пациентов. Кого ищем?';
      }
      if (/лечен/i.test(msg) || /план/i.test(msg)) {
        return 'Для составления плана лечения нужны: жалобы пациента, диагноз и необходимые процедуры. Опишите клиническую ситуацию.';
      }
      if (/снимок|кт|рентген/i.test(msg)) {
        const patientName = conversationContext.entities?.lastPatient?.name;
        if (patientName) {
          return `Открываю снимки пациента ${patientName}. Для сравнения укажите даты предыдущих исследований.`;
        }
        return 'Укажите пациента, чтобы я открыл его снимки.';
      }
      return 'Помогу с клиническими вопросами. Что именно вас интересует?';
    }

    case 'practice': {
      if (/расписан/i.test(msg) || /сегодня/i.test(msg)) {
        if (clinicContext?.todayAppointments !== undefined) {
          const parts = [`Сегодня ${clinicContext.todayAppointments} записей.`];
          if (clinicContext.pendingAppointments > 0) {
            parts.push(`${clinicContext.pendingAppointments} ожидают подтверждения.`);
          }
          if (clinicContext.firstAppointmentTime) {
            parts.push(`Первая запись через ${clinicContext.firstAppointmentTime}.`);
          }
          return parts.join(' ');
        }
        return 'Открываю расписание на сегодня.';
      }
      if (/запис/i.test(msg) && /создай|нова/i.test(msg)) {
        return 'Для новой записи укажите: имя пациента, услугу, дату и время.';
      }
      if (/подтверд/i.test(msg)) {
        return 'Показываю записи, ожидающие подтверждения.';
      }
      return 'Помогу с расписанием и записями.';
    }

    case 'analytics': {
      const role = user?.role || user?.platformRole;
      if (role === 'owner' || role === 'director' || role === 'superadmin') {
        const parts = [];
        if (clinicContext?.revenue !== undefined) {
          parts.push(`Выручка сегодня: ${clinicContext.revenue.toLocaleString('ru-RU')} ₸.`);
        }
        if (clinicContext?.todayAppointments !== undefined) {
          parts.push(`Записей: ${clinicContext.todayAppointments}.`);
        }
        if (clinicContext?.totalPatients !== undefined) {
          parts.push(`Всего пациентов: ${clinicContext.totalPatients}.`);
        }
        if (clinicContext?.unpaidReceipts !== undefined && clinicContext.unpaidReceipts > 0) {
          parts.push(`Неоплаченных счетов: ${clinicContext.unpaidReceipts}.`);
        }
        return parts.length > 0 ? parts.join(' ') : 'Открываю аналитику клиники.';
      }
      return 'Открываю панель аналитики.';
    }

    case 'shopping': {
      if (knowledge?.recommendations?.length > 0) {
        const items = knowledge.recommendations.slice(0, 3);
        const list = items.map(i =>
          `• ${i.brand ? i.brand + ' ' : ''}${i.name} — ${i.price?.toLocaleString('ru-RU') || 'цена по запросу'} ₸, рейтинг ${i.rating || '—'}`
        ).join('\n');
        return `На основе анализа рынка рекомендую:\n${list}\n\nВыберите для детального сравнения или уточните критерии.`;
      }
      if (/сканер/i.test(msg)) {
        return 'Основные варианты: Primescan (CEREC), TRIOS (3Shape), i700 (Medit), CS 3800 (Carestream). Ключевые отличия: точность, скорость, совместимость с лабораторией, бюджет. Какой аспект интересует подробнее?';
      }
      if (/композит/i.test(msg)) {
        return 'Лидеры рынка: Filtek Supreme XTE (3M) — универсальный, Estelite Sigma Quick (Tokuyama) — отличная полируемость, Filtek One (3M) — малая усадка. Выбор зависит от зоны реставрации.';
      }
      return 'Подберу оборудование или материалы. Опишите, что ищете.';
    }

    case 'learning': {
      if (digitalTwin?.specialty) {
        return `Учитывая вашу специализацию (${digitalTwin.specialty}), рекомендую обратить внимание на профильные курсы в Academy. У вас пройдено ${digitalTwin.completedCourses || 0} курсов. Что именно хотите изучить?`;
      }
      if (knowledge?.recommendations?.length > 0) {
        const items = knowledge.recommendations.slice(0, 3);
        const list = items.map(i => `• ${i.title} (${i.category || i.instructor || ''})`).join('\n');
        return `Рекомендую курсы:\n${list}\n\nДля подбора по специализации уточните направление.`;
      }
      return 'Помогу с обучением. Расскажите о ваших интересах или специализации.';
    }

    case 'research': {
      if (knowledge?.contextual) return knowledge.contextual;
      return 'Проведу анализ по вашему запросу. Уточните, что именно нужно сравнить или изучить.';
    }

    case 'automation': {
      return 'Помогу с настройками. Что нужно автоматизировать?';
    }

    case 'patient': {
      const nameMatch = msg.match(/(?:найти|найди|покажи)\s+(.+?)(?:\s+и|\s*$)/i);
      if (nameMatch) {
        return `Ищу "${nameMatch[1].trim()}" в базе пациентов.`;
      }
      return 'Уточните имя или телефон пациента.';
    }

    default:
      return 'Помогу с любым вопросом — пациенты, расписание, подбор оборудования, обучение. Что вас интересует?';
  }
}

function generateSuggestions(skillId, intent, clinicContext, permittedActions) {
  const suggestions = [];

  switch (skillId) {
    case 'clinical':
      suggestions.push('Найти пациента', 'Показать расписание', 'Открыть медкарту');
      break;
    case 'practice':
      suggestions.push('Показать расписание', 'Неподтверждённые записи', 'Создать запись');
      break;
    case 'analytics':
      suggestions.push('Статистика за сегодня', 'Неоплаченные счета', 'Отчёт за день');
      break;
    case 'shopping':
      suggestions.push('Сравнить сканеры', 'Композиты для реставрации', 'Оборудование');
      break;
    case 'learning':
      suggestions.push('Курсы по терапии', 'Курсы по имплантации', 'Мой профиль');
      break;
    case 'research':
      suggestions.push('Сравнить импланты', 'Протоколы лечения', 'Клинические случаи');
      break;
    default:
      if (clinicContext?.todayAppointments !== undefined) {
        suggestions.push(`Расписание (${clinicContext.todayAppointments} записей)`);
      }
      suggestions.push('Найти пациента', 'Показать расписание');
  }

  return suggestions.slice(0, 4);
}

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

  if (/снимок|кт|рентген|панорам/i.test(message)) {
    entities.lastImaging = true;
  }

  return {
    entities,
    lastSkill: skillId,
    lastIntent: intent,
    turnCount: (prev.turnCount || 0) + 1,
    lastActivity: new Date().toISOString(),
  };
}

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
