/**
 * AI Orchestrator — DentVision AI OS (Spec §15.3, §15.17).
 *
 * The user talks to one assistant; internally the orchestrator plans with a
 * cheap-first OpenAI model router (mini by default, full only for hard tasks)
 * over the RBAC-filtered tool set from the agent registry, executes tools
 * against the clinic's data, and merges everything into a single answer.
 *
 * Lifecycle per request (§15.17):
 *   UNDERSTAND → PLAN/SELECT TOOLS → EXECUTE → VERIFY → MERGE → RESPOND
 * (PLAN/EXECUTE iterate up to MAX_TOOL_ROUNDS; VERIFY = tool errors are
 * surfaced to the model so it can correct course, mutations are
 * confirmation-gated inside the tool layer.)
 *
 * When OPENAI_API_KEY is not configured the caller falls back to the
 * deterministic intent router (ai.service.ts) — the platform never breaks
 * because the LLM is unavailable.
 */

import { env } from '../../../config.js';
import prisma from '../../../lib/prisma.js';
import { agentsForRole, toolsForRoleAndPersona } from './registry.js';
import { executeTool, toolSchemasFor, localizeNavKeysInMessage, type ToolContext } from './tools.js';
import {
  blockedPersonaRedirectMessage,
  personaLabel,
  resolveActivePersonaDetailed,
  roleAllowsPersona,
  type PersonaId,
} from './persona.js';
import {
  clinicCurrencyPromptRule,
  preferClinicCurrency,
  resolveClinicCurrency,
} from '../lib/currency.js';
import {
  chooseOpenAIModel,
  estimateTokens,
  recordModelUsage,
  type ModelChoice,
} from '../lib/modelRouter.js';
import { isClinicLoadQuery, isDoctorDayQuery } from '../core/clinicLoadPlan.js';
import { personaPromptFor, rolePromptFor } from '../prompts/system.prompts.js';
import { platformMapPromptBlock, stageFromPath, stageAwareSuggestions } from '../lib/platformMap.js';
import {
  tryDeterministicNavigate,
  tryDeterministicStats,
  tryPlatformMapQuery,
} from '../lib/deterministicShortcuts.js';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const MAX_TOOL_ROUNDS = 6;
const REQUEST_TIMEOUT_MS = 45_000;

export interface OrchestratorInput {
  text: string;
  userId: string;
  clinicId: string | null;
  role: string;
  userName?: string;
  sessionId: string;
  history?: Array<{ role: string; content: string }>;
  isGuest?: boolean;
  /** Browser IANA timezone from the client (preferred for greetings / "today"). */
  timeZone?: string | null;
  /** Personalization block from learning.service (prefs + twin). */
  learningInstructions?: string;
  /** Positive few-shot examples for similar past requests. */
  fewShots?: Array<{ user: string; assistant: string }>;
  /** Current UI path — stage-aware guidance without burning tokens guessing. */
  pathname?: string | null;
  /** Context focus from workspace (patient / product / …). */
  focusType?: string | null;
  focusId?: string | null;
}

export interface OrchestratorResult {
  message: string;
  intent: string;
  action?: { type: string; payload: unknown };
  /** Extra clickable nav choices (e.g. after unknown section). */
  actions?: Array<{ type: string; label: string; params?: Record<string, unknown>; confidence?: number }>;
  suggestions: string[];
  needsConfirmation?: boolean;
  confirmData?: Record<string, unknown>;
  /** Which tools ran — provenance for the UI / audit. */
  toolsUsed: string[];
  /** Persisted assistant message id for feedback thumbs. */
  messageId?: string;
  /** Labels of prefs applied this turn (for UI chip). */
  learnedLabels?: string[];
  /** Active operational persona (§16) — UI badge «Сейчас: AI Finance». */
  activePersona?: PersonaId;
  activePersonaLabel?: string;
}

function isCeoBriefTrigger(text: string, persona: PersonaId): boolean {
  if (persona !== 'ceo') return false;
  const t = String(text || '').trim().toLowerCase();
  return (
    /^(привет|здравствуй|добрый|hello|hi)\b/i.test(t)
    || /что\s+важно|приоритет|брифинг|сводка|executive|как\s+ceo|ceo\s+brief|обзор\s+(дня|недели)/i.test(t)
    || t === 'jarvis briefing'
    || t === 'сводка при входе'
  );
}

export function orchestratorEnabled(): boolean {
  return Boolean(env.OPENAI_API_KEY);
}

function isJarvisBriefingTrigger(text: string): boolean {
  const t = String(text || '').trim().toLowerCase();
  return (
    /^(привет|здравствуй|добрый|hello|hi|приветствие|сводка|брифинг)\b/i.test(t)
    || t === 'приветствие'
    || t === 'сводка при входе'
    || t === 'jarvis briefing'
    || /что\s+важно|сводка\s+(на\s+)?сегодня|брифинг|обзор\s+дня|резюме\s+дня/.test(t)
  );
}

function systemPrompt(
  input: OrchestratorInput,
  currencyCode: string,
  activePersona: PersonaId,
): string {
  if (input.isGuest || String(input.role).toUpperCase() === 'GUEST') {
    const mapBlock = platformMapPromptBlock('GUEST', true);
    return `Ты — DentVision Intelligence, дружелюбный ассистент стоматологической SuperApp.
Пользователь — гость (ещё не вошёл в клинику). Общайся живо, по делу.

${mapBlock}

ПРАВИЛА:
1. Отвечай по-русски.
2. НЕ выдумывай расписание, выручку, долги, пациентов — у гостя нет клиники.
3. Если просят данные клиники — мягко предложи демо или регистрацию.
4. Подсвечивай преимущества DentVision.
5. Открывай разделы через navigate; в тексте — русские названия.
6. Экономия: коротко, один next step.`;
  }

  const agents = agentsForRole(input.role).filter(
    (a) => !a.persona || a.persona === activePersona || a.persona === 'guest',
  );
  const mandates = (agents.length
    ? agents
    : agentsForRole(input.role)
  )
    .map((a) => `- ${a.name}${a.persona ? ` [${a.persona}]` : ''}: ${a.mandate}`)
    .join('\n');
  const stage = stageFromPath(input.pathname) || input.focusType || 'workspace';
  const roleBlock = rolePromptFor(input.role);
  const personaBlock = personaPromptFor(activePersona);
  const mapBlock = platformMapPromptBlock(input.role, false);
  const stageHints = stageAwareSuggestions({
    role: input.role,
    isGuest: false,
    stage,
    focusType: input.focusType,
  }).join(' · ');

  const clinical = ['DOCTOR', 'ASSISTANT', 'LAB'].includes(String(input.role || '').toUpperCase());

  return `Ты — DentVision Intelligence (Jarvis), операционный ИИ клиники:
проактивный, спокойный, точный. Экономичный: коротко, факты из инструментов, один next step.
Активная персона сейчас: ${personaLabel(activePersona)} (${activePersona}).

Пользователь: ${input.userName || 'сотрудник клиники'}, роль: ${input.role}.
Сейчас на экране: этап «${stage}»${input.pathname ? ` (${input.pathname})` : ''}${input.focusType ? `, фокус: ${input.focusType}${input.focusId ? `/${input.focusId}` : ''}` : ''}.
Подсказки по этапу: ${stageHints || '—'}.

${roleBlock ? `РОЛЬ:\n${roleBlock}\n` : ''}
${personaBlock ? `${personaBlock}\n` : ''}
Ты оркестрируешь агентов:
${mandates}

${mapBlock}

ПРАВИЛА:
1. Отвечай по-русски, коротко. Сначала суть, потом деталь.
2. Все факты о клинике — ТОЛЬКО из инструментов. Не выдумывай.
3. Мутации (запись, счёт, план) — confirmed=false, пока пользователь явно не подтвердил.
4. Клинические выводы — черновик для врача, не диагноз.
5. Ошибки инструментов признавай прямо и предлагай следующий шаг.
6. Раздел открывай через navigate. В тексте — только русские названия. Когда советуешь куда перейти — вызови navigate И напиши «Откройте …».
7. Не свети внутренние имена инструментов/агентов. Персону можно назвать по-человечески («сейчас как Finance»).
8. Если пользователь только вошёл или просит «что важно» — для CEO вызывай composeCeoBrief; иначе приоритет по роли.
9. ${clinicCurrencyPromptRule(currencyCode)}
10. Если «запомни…» — подтверди кратко.
11. ${clinical
    ? 'Для врача: getDoctorDayPlan / своё расписание — без mass-recall и чужих телефонов. Не предлагай выручку, долги, акции.'
    : 'Загрузка клиники / обзвон / пустые слоты — СРАЗУ getClinicLoadPlan с именами и цифрами.'}
12. Учитывай этап экрана: предлагай действия, уместные ТАМ, где пользователь сейчас.
13. Свобода платформы: можешь вести по CRM + маркет + академия + кабинеты, если роль позволяет.
14. Экономия: не вызывай лишние инструменты; для «открой X» достаточно navigate.
15. Marketing: getPromotions / getRecallList / draftPromoCopy — draft only, без авторассылки.${clinical ? ' Врачу эти tools недоступны.' : ''}
${input.learningInstructions ? `\n${input.learningInstructions}` : ''}`;
}

interface ResponsesAPIOutputItem {
  type: string;
  // function_call
  name?: string;
  call_id?: string;
  arguments?: string;
  // message
  content?: Array<{ type: string; text?: string }>;
}

interface ResponsesAPIResult {
  output?: ResponsesAPIOutputItem[];
  output_text?: string;
}

async function callModel(
  body: Record<string, unknown>,
  choice: ModelChoice,
  usageHint: string,
): Promise<ResponsesAPIResult> {
  const res = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`OpenAI ${res.status}: ${detail.slice(0, 300)}`);
  }
  const payload = (await res.json()) as ResponsesAPIResult;
  const outText =
    (typeof payload.output_text === 'string' ? payload.output_text : '') ||
    JSON.stringify(payload.output || []).slice(0, 4000);
  recordModelUsage(
    choice.tier,
    estimateTokens(usageHint, outText) + Math.ceil(choice.maxOutputTokens * 0.15),
  );
  return payload;
}

function extractAssistantText(response: ResponsesAPIResult): string {
  return (
    (typeof response.output_text === 'string' && response.output_text.trim()) ||
    (response.output || [])
      .filter((i) => i.type === 'message')
      .flatMap((i) => i.content || [])
      .map((c) => c.text || '')
      .join('')
      .trim()
  );
}

async function saveMessage(
  sessionId: string,
  role: string,
  content: string,
  meta?: { userId?: string; clinicId?: string | null; prevUserText?: string | null },
): Promise<string | undefined> {
  try {
    const id = crypto.randomUUID();
    await prisma.aIMessage.create({
      data: {
        id,
        sessionId,
        role,
        content,
        userId: meta?.userId || null,
        clinicId: meta?.clinicId || null,
        prevUserText: meta?.prevUserText || null,
      },
    });
    return id;
  } catch {
    /* history persistence must never break the answer */
    return undefined;
  }
}

export async function orchestrate(input: OrchestratorInput): Promise<OrchestratorResult> {
  await saveMessage(input.sessionId, 'user', input.text, {
    userId: input.userId,
    clinicId: input.clinicId,
  });

  const isGuest = Boolean(input.isGuest || String(input.role).toUpperCase() === 'GUEST');
  const stage = stageFromPath(input.pathname);
  const resolved = resolveActivePersonaDetailed({
    role: input.role,
    stage,
    pathname: input.pathname,
    text: input.text,
    isGuest,
  });
  const activePersona = resolved.persona;
  const personaMeta = {
    activePersona,
    activePersonaLabel: personaLabel(activePersona),
  };
  const clinicalRole = ['DOCTOR', 'ASSISTANT', 'LAB'].includes(String(input.role || '').toUpperCase());

  // Soft redirect when doctor asks for Finance/Marketing/CEO — no KPI dump.
  if (resolved.shouldRedirect && resolved.blockedRequest) {
    const redirect = blockedPersonaRedirectMessage(input.role, resolved.blockedRequest);
    if (redirect) {
      const messageId = await saveMessage(input.sessionId, 'assistant', redirect, {
        userId: input.userId,
        clinicId: input.clinicId,
        prevUserText: input.text,
      });
      return {
        message: redirect,
        intent: 'PERSONA_BLOCKED',
        suggestions: ['Показать расписание', 'Открыть зубную карту', 'Создать план лечения'],
        toolsUsed: [],
        messageId,
        ...personaMeta,
      };
    }
  }

  // Cheap deterministic paths — skip OpenAI entirely when we can.
  const mapHit = tryPlatformMapQuery(input.text, { role: input.role, isGuest });
  if (mapHit) {
    const messageId = await saveMessage(input.sessionId, 'assistant', mapHit.message, {
      userId: input.userId,
      clinicId: input.clinicId,
      prevUserText: input.text,
    });
    return { ...mapHit, messageId, ...personaMeta };
  }

  const navHit = tryDeterministicNavigate(input.text, { role: input.role, isGuest });
  if (navHit) {
    const messageId = await saveMessage(input.sessionId, 'assistant', navHit.message, {
      userId: input.userId,
      clinicId: input.clinicId,
      prevUserText: input.text,
    });
    return { ...navHit, messageId, ...personaMeta };
  }

  try {
    const statsHit = await tryDeterministicStats(input.text, {
      userId: input.userId,
      clinicId: input.clinicId,
      role: input.role,
      isGuest,
    });
    if (statsHit) {
      const messageId = await saveMessage(input.sessionId, 'assistant', statsHit.message, {
        userId: input.userId,
        clinicId: input.clinicId,
        prevUserText: input.text,
      });
      return { ...statsHit, messageId, ...personaMeta };
    }
  } catch (e) {
    console.warn('[AI OS] deterministic stats failed', e);
  }

  // CEO executive brief — only when persona ceo is allowed for this role.
  if (!isGuest && isCeoBriefTrigger(input.text, activePersona) && roleAllowsPersona(input.role, 'ceo')) {
    try {
      const { composeCeoBrief } = await import('../core/ceoBrief.js');
      const clinic = input.clinicId
        ? await prisma.clinic.findUnique({ where: { id: input.clinicId }, select: { name: true } }).catch(() => null)
        : null;
      const brief = await composeCeoBrief({
        userId: input.userId,
        clinicId: input.clinicId,
        role: input.role,
        firstName: input.userName,
        clinicName: clinic?.name,
        timeZone: input.timeZone,
      });
      const messageId = await saveMessage(input.sessionId, 'assistant', brief.message, {
        userId: input.userId,
        clinicId: input.clinicId,
        prevUserText: input.text,
      });
      return {
        message: brief.message,
        intent: 'CEO_BRIEF',
        action: { type: 'SHOW_BRIEFING', payload: brief.payload },
        suggestions: brief.suggestions,
        toolsUsed: ['composeCeoBrief'],
        messageId,
        ...personaMeta,
      };
    } catch (e) {
      console.warn('[AI OS] CEO brief failed, continuing', e);
    }
  }

  // Jarvis entry briefing — deterministic live KPIs, not a chatty LLM opener.
  if (!isGuest && isJarvisBriefingTrigger(input.text)) {
    try {
      const { buildJarvisBriefing } = await import('../core/jarvisBriefing.js');
      const clinic = input.clinicId
        ? await prisma.clinic.findUnique({ where: { id: input.clinicId }, select: { name: true } }).catch(() => null)
        : null;
      const briefing = await buildJarvisBriefing({
        userId: input.userId,
        clinicId: input.clinicId,
        role: input.role,
        firstName: input.userName,
        clinicName: clinic?.name,
        isGuest: false,
        timeZone: input.timeZone,
      });
      const messageId = await saveMessage(input.sessionId, 'assistant', briefing.message, {
        userId: input.userId,
        clinicId: input.clinicId,
        prevUserText: input.text,
      });
      return {
        message: briefing.message,
        intent: 'MORNING_BRIEFING',
        action: { type: 'SHOW_BRIEFING', payload: briefing.payload },
        suggestions: briefing.suggestions,
        toolsUsed: ['jarvis_briefing'],
        messageId,
        ...personaMeta,
      };
    } catch (e) {
      console.warn('[AI OS] jarvis briefing failed, continuing to LLM', e);
    }
  }

  // Doctor day plan — clinical roles never get clinic-wide recall dump.
  if (!isGuest && input.clinicId && clinicalRole && isDoctorDayQuery(input.text)) {
    try {
      const { buildDoctorDayPlan } = await import('../core/clinicLoadPlan.js');
      const plan = await buildDoctorDayPlan(input.clinicId, input.userId);
      const messageId = await saveMessage(input.sessionId, 'assistant', plan.message, {
        userId: input.userId,
        clinicId: input.clinicId,
        prevUserText: input.text,
      });
      return {
        message: plan.message,
        intent: 'DOCTOR_DAY_PLAN',
        action: { type: 'NAVIGATE', payload: { path: '/crm/schedule' } },
        suggestions: plan.suggestions,
        toolsUsed: ['getDoctorDayPlan'],
        messageId,
        ...personaMeta,
      };
    } catch (e) {
      console.warn('[AI OS] doctor day plan failed, continuing to LLM', e);
    }
  }

  // Clinic load / recall — owners/admins only.
  if (
    !isGuest
    && input.clinicId
    && !clinicalRole
    && isClinicLoadQuery(input.text)
  ) {
    try {
      const { buildClinicLoadPlan } = await import('../core/clinicLoadPlan.js');
      const plan = await buildClinicLoadPlan(input.clinicId);
      const messageId = await saveMessage(input.sessionId, 'assistant', plan.message, {
        userId: input.userId,
        clinicId: input.clinicId,
        prevUserText: input.text,
      });
      return {
        message: plan.message,
        intent: 'CLINIC_LOAD_PLAN',
        action: { type: 'NAVIGATE', payload: { path: '/crm/schedule' } },
        suggestions: plan.suggestions,
        toolsUsed: ['getClinicLoadPlan'],
        messageId,
        ...personaMeta,
      };
    } catch (e) {
      console.warn('[AI OS] clinic load plan failed, continuing to LLM', e);
    }
  }

  // UNDERSTAND — resolve permissions into the concrete tool surface (role ∩ persona).
  const allowedTools = toolsForRoleAndPersona(input.role, activePersona);
  const toolSchemas = toolSchemasFor(allowedTools);
  const toolCtx: ToolContext = { userId: input.userId, clinicId: input.clinicId, role: input.role };
  const currencyCode = await resolveClinicCurrency(input.clinicId);
  const instructions = systemPrompt(input, currencyCode, activePersona);

  const fewShotTurns = (input.fewShots || []).flatMap((ex) => [
    { role: 'user', content: `[Пример прошлого успешного запроса]\n${ex.user}` },
    { role: 'assistant', content: ex.assistant },
  ]);

  const conversation: Array<Record<string, unknown>> = [
    ...fewShotTurns,
    ...(input.history || []).slice(-12).map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
    { role: 'user', content: input.text },
  ];

  const toolsUsed: string[] = [];
  let pendingConfirmation: OrchestratorResult['confirmData'] | undefined;
  let navigateAction: { type: string; payload: unknown } | undefined;
  let sectionChoiceActions: OrchestratorResult['actions'] = [];

  // PLAN → SELECT TOOLS → EXECUTE → VERIFY loop.
  // Cheap-first: mini by default; escalate once if the first mini pass is empty.
  let escalated = false;
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let choice = await chooseOpenAIModel({
      task: 'orchestrate',
      text: input.text,
      isGuest: input.isGuest || String(input.role).toUpperCase() === 'GUEST',
      historyTurns: input.history?.length || 0,
      round,
      toolsUsed: toolsUsed.length,
      escalate: escalated,
    });

    let response = await callModel(
      {
        model: choice.model,
        instructions,
        input: conversation,
        tools: toolSchemas,
        reasoning: { effort: choice.reasoningEffort },
        max_output_tokens: choice.maxOutputTokens,
      },
      choice,
      `${instructions}\n${input.text}`,
    );

    let outputItems = response.output || [];
    let functionCalls = outputItems.filter((item) => item.type === 'function_call');
    let messageText = extractAssistantText(response);

    // One-shot escalate: empty mini answer on first round → retry with full.
    if (
      !escalated &&
      choice.tier === 'mini' &&
      functionCalls.length === 0 &&
      !messageText &&
      !(input.isGuest || String(input.role).toUpperCase() === 'GUEST')
    ) {
      escalated = true;
      choice = await chooseOpenAIModel({
        task: 'orchestrate',
        text: input.text,
        isGuest: false,
        historyTurns: input.history?.length || 0,
        round,
        toolsUsed: toolsUsed.length,
        escalate: true,
      });
      if (choice.tier === 'full') {
        console.info('[AI OS] escalate empty mini → full', choice.reason);
        response = await callModel(
          {
            model: choice.model,
            instructions,
            input: conversation,
            tools: toolSchemas,
            reasoning: { effort: choice.reasoningEffort },
            max_output_tokens: choice.maxOutputTokens,
          },
          choice,
          `${instructions}\n${input.text}`,
        );
        outputItems = response.output || [];
        functionCalls = outputItems.filter((item) => item.type === 'function_call');
        messageText = extractAssistantText(response);
      }
    }

    if (round === 0) {
      console.info(`[AI OS] model=${choice.model} tier=${choice.tier} reason=${choice.reason}`);
    }

    if (functionCalls.length === 0) {
      // MERGE RESULTS → RESPOND
      const message = messageText || 'Готово.';

      const safeMessage = localizeNavKeysInMessage(preferClinicCurrency(message, currencyCode));
      const messageId = await saveMessage(input.sessionId, 'assistant', safeMessage, {
        userId: input.userId,
        clinicId: input.clinicId,
        prevUserText: input.text,
      });

      return {
        message: safeMessage,
        intent: toolsUsed[0] ? `TOOL_${toolsUsed[0].toUpperCase()}` : 'CHAT',
        action: navigateAction,
        actions: sectionChoiceActions?.length ? sectionChoiceActions : undefined,
        suggestions: defaultSuggestions(input.role),
        needsConfirmation: Boolean(pendingConfirmation),
        confirmData: pendingConfirmation,
        toolsUsed,
        messageId,
        ...personaMeta,
      };
    }

    // EXECUTE all planned calls; feed results (or errors — VERIFY) back.
    conversation.push(...functionCalls.map((call) => ({
      type: 'function_call',
      name: call.name,
      call_id: call.call_id,
      arguments: call.arguments,
    })));

    for (const call of functionCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = call.arguments ? JSON.parse(call.arguments) : {};
      } catch {
        /* pass empty args; the tool will report what's missing */
      }

      const result = await executeTool(call.name || '', args, toolCtx, allowedTools);
      toolsUsed.push(call.name || 'unknown');

      if (result.needsConfirmation) {
        pendingConfirmation = result.needsConfirmation as unknown as Record<string, unknown>;
      }
      if (result.navigate) {
        navigateAction = { type: 'NAVIGATE', payload: { path: result.navigate } };
      }
      const available = (result.data as { availableSections?: Array<{ key: string; label: string; path: string }> } | undefined)
        ?.availableSections;
      if (call.name === 'navigate' && !result.ok && Array.isArray(available) && available.length) {
        sectionChoiceActions = available.slice(0, 12).map((s) => ({
          type: 'NAVIGATE',
          label: s.label,
          params: { path: s.path, section: s.key },
          confidence: 1,
        }));
      }

      conversation.push({
        type: 'function_call_output',
        call_id: call.call_id,
        output: JSON.stringify(result).slice(0, 12_000),
      });
    }
  }

  // Loop budget exhausted — respond with what we have rather than hang.
  const message = 'Я собрал данные, но задача оказалась слишком многошаговой. Уточните, что именно показать или сделать первым.';
  const messageId = await saveMessage(input.sessionId, 'assistant', message, {
    userId: input.userId,
    clinicId: input.clinicId,
    prevUserText: input.text,
  });
  return {
    message,
    intent: 'CHAT',
    suggestions: defaultSuggestions(input.role),
    toolsUsed,
    messageId,
    ...personaMeta,
  };
}

function defaultSuggestions(role: string): string[] {
  const normalized = role.toUpperCase();
  if (normalized === 'GUEST') {
    return ['Чем полезен DentVision?', 'Открыть демо-клинику', 'Что в Academy OS?'];
  }
  if (normalized === 'OWNER' || normalized === 'DIRECTOR' || normalized === 'MANAGER') {
    return ['Что важно сегодня?', 'Показать выручку', 'Проверить долги'];
  }
  if (normalized === 'ADMIN' || normalized === 'RECEPTION' || normalized === 'CASHIER') {
    return ['Показать расписание', 'Записать пациента', 'Открыть кассу'];
  }
  if (normalized === 'DOCTOR' || normalized === 'ASSISTANT') {
    return ['Показать расписание', 'Открыть зубную карту', 'Создать план лечения'];
  }
  return ['Что важно сегодня?', 'Показать расписание', 'Проверить долги'];
}
