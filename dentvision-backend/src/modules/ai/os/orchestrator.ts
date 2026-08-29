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
import { agentsForRole } from './registry.js';
import { resolveAiToolAccess } from './access.js';
import { executeTool, toolSchemasFor, localizeNavKeysInMessage, type ToolContext } from './tools.js';
import {
  personaLabel,
  resolveActivePersona,
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
import { isClinicLoadQuery } from '../core/clinicLoadPlan.js';
import { personaPromptFor, rolePromptFor } from '../prompts/system.prompts.js';
import { platformMapPromptBlock, stageFromPath, stageAwareSuggestions } from '../lib/platformMap.js';
import {
  tryDeterministicNavigate,
  tryDeterministicStats,
  tryPlatformMapQuery,
} from '../lib/deterministicShortcuts.js';
import { sanitizeUserInput, buildSafeInstructions } from '../lib/promptGuard.js';
import { providerFetch } from '../lib/providerFetch.js';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

/**
 * A provider failure that retrying or falling back cannot fix — exhausted
 * credits, a revoked key, a disabled account.
 *
 * Worth distinguishing: on any orchestrator error the caller drops to the
 * deterministic intent router, which then calls the same dead provider again
 * through improveResponseWithLLM. The user waits through two round-trips to be
 * told nothing. These failures short-circuit instead.
 */
export type { ProviderError } from '../lib/providerFetch.js';
export { isProviderUnavailable, isProviderUnavailableError } from '../lib/providerFetch.js';

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
  /** Verified entity focus (os/context.ts::buildAiContext) — what the kernel substitutes a missing patientId from, never trusted from focusType/focusId directly. */
  entity?: { type: string; id: string } | null;
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
  /**
   * The model id that actually answered, or undefined when a deterministic
   * shortcut did and no model was called. The audit used to record the literal
   * `'orchestrator'`, which could not answer "what generated this?".
   */
  model?: string;
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

  const agents = agentsForRole(input.role);
  const mandates = agents.map((a) => `- ${a.name}${a.persona ? ` [${a.persona}]` : ''}: ${a.mandate}`).join('\n');
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
11. Загрузка клиники / обзвон / пустые слоты — СРАЗУ getClinicLoadPlan с именами и цифрами.
12. Учитывай этап экрана: предлагай действия, уместные ТАМ, где пользователь сейчас.
13. Свобода платформы: можешь вести по CRM + маркет + академия + кабинеты, если роль позволяет.
14. Экономия: не вызывай лишние инструменты; для «открой X» достаточно navigate.
15. Marketing: getPromotions / getRecallList / draftPromoCopy — draft only, без авторассылки.
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
  /** What the provider actually billed, including the cached-prefix breakdown. */
  usage?: {
    total_tokens?: number;
    input_tokens?: number;
    output_tokens?: number;
    input_tokens_details?: { cached_tokens?: number };
  };
}

async function callModel(
  body: Record<string, unknown>,
  choice: ModelChoice,
  usageHint: string,
): Promise<ResponsesAPIResult> {
  const payload = await providerFetch<ResponsesAPIResult>(OPENAI_RESPONSES_URL, {
    apiKey: env.OPENAI_API_KEY as string,
    body,
    timeoutMs: REQUEST_TIMEOUT_MS,
  });

  // What the provider says it billed, not a character count plus a 15% guess.
  const reported = payload.usage?.total_tokens;
  if (Number.isFinite(reported) && (reported as number) > 0) {
    recordModelUsage(choice.tier, reported as number);
  } else {
    const outText =
      (typeof payload.output_text === 'string' ? payload.output_text : '') ||
      JSON.stringify(payload.output || []).slice(0, 4000);
    recordModelUsage(choice.tier, estimateTokens(usageHint, outText));
  }
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

/**
 * Mutating tools treat `confirmed: true` as "the user approved this" and write
 * immediately. The flag must therefore never be settable by the model: nothing
 * stopped the planning step from passing it on the first call — including when
 * the text it is planning over came from a patient message or an uploaded
 * document. Confirmation belongs to the explicit `/confirm` round-trip, which
 * runs under full `authenticate`.
 */
export function stripModelConfirmation(args: Record<string, unknown>): Record<string, unknown> {
  if (!('confirmed' in args)) return args;
  const { confirmed: _ignored, ...rest } = args;
  return rest;
}

export async function orchestrate(rawInput: OrchestratorInput): Promise<OrchestratorResult> {
  // Authorization is resolved from the database up front, and everything below
  // works off the resolved values: the caller-supplied role and clinicId arrive
  // from a JWT claim (`/query` runs under optionalAuth) and are never trusted.
  const access = await resolveAiToolAccess({
    userId: rawInput.userId,
    clinicId: rawInput.clinicId,
    isGuest: rawInput.isGuest,
  });
  const input: OrchestratorInput = { ...rawInput, role: access.role, clinicId: access.clinicId };

  await saveMessage(input.sessionId, 'user', input.text, {
    userId: input.userId,
    clinicId: input.clinicId,
  });

  const isGuest = Boolean(input.isGuest || String(input.role).toUpperCase() === 'GUEST');
  const stage = stageFromPath(input.pathname);
  const activePersona = resolveActivePersona({
    role: input.role,
    stage,
    pathname: input.pathname,
    text: input.text,
    isGuest,
  });
  const personaMeta = {
    activePersona,
    activePersonaLabel: personaLabel(activePersona),
  };

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

  // CEO executive brief — synthesize Analyst+Finance+Marketing without LLM.
  if (!isGuest && isCeoBriefTrigger(input.text, activePersona)) {
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

  // Clinic load / recall / empty slots — answer from live data, never a generic playbook.
  if (
    !isGuest
    && input.clinicId
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

  // UNDERSTAND — the concrete tool surface, resolved from the DB above.
  const allowedTools = access.allowed;
  const toolSchemas = toolSchemasFor(allowedTools);
  const toolCtx: ToolContext = { userId: input.userId, clinicId: input.clinicId, role: input.role, entity: input.entity };
  const currencyCode = await resolveClinicCurrency(input.clinicId);
  const instructions = buildSafeInstructions(systemPrompt(input, currencyCode, activePersona), input.text);

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
    { role: 'user', content: sanitizeUserInput(input.text) },
  ];

  const toolsUsed: string[] = [];
  let pendingConfirmation: OrchestratorResult['confirmData'] | undefined;
  let navigateAction: { type: string; payload: unknown } | undefined;
  let sectionChoiceActions: OrchestratorResult['actions'] = [];

  // PLAN → SELECT TOOLS → EXECUTE → VERIFY loop.
  // Cheap-first: mini by default; escalate once if the first mini pass is empty.
  let escalated = false;
  /** Survives the loop so the exhausted-budget return can still name the model. */
  let lastModel: string | undefined;
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

    // After any escalation, so this is the model that actually served the round.
    lastModel = choice.model;

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
        model: choice.model,
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

      const result = await executeTool(call.name || '', stripModelConfirmation(args), toolCtx, allowedTools);
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
    model: lastModel,
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
  if (normalized === 'LAB') {
    return ['Показать заказы', 'Новый заказ', 'Статус заказа'];
  }
  if (normalized === 'STUDENT') {
    return ['Мои курсы', 'Показать расписание', 'Открыть Academy'];
  }
  if (normalized === 'SUPERADMIN') {
    return ['Показать клиники', 'Проверить платежи', 'Пульт суперадмина'];
  }
  if (normalized === 'SUPPORT') {
    return ['Найти клинику', 'Проверить статус', 'Пульт суперадмина'];
  }
  return ['Что важно сегодня?', 'Показать расписание', 'Проверить долги'];
}
