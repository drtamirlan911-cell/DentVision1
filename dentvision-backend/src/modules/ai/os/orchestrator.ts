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
import { agentsForRole, toolsForRole } from './registry.js';
import { executeTool, toolSchemasFor, localizeNavKeysInMessage, type ToolContext } from './tools.js';
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
}

export interface OrchestratorResult {
  message: string;
  intent: string;
  action?: { type: string; payload: unknown };
  suggestions: string[];
  needsConfirmation?: boolean;
  confirmData?: Record<string, unknown>;
  /** Which tools ran — provenance for the UI / audit. */
  toolsUsed: string[];
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

function systemPrompt(input: OrchestratorInput, currencyCode: string): string {
  if (input.isGuest || String(input.role).toUpperCase() === 'GUEST') {
    return `Ты — DentVision Intelligence, дружелюбный ассистент стоматологической SuperApp.
Пользователь — гость (ещё не вошёл в клинику). Общайся как чистый ChatGPT: живо, по делу, без канцелярита.

О платформе (кратко, когда уместно):
• CRM клиники — расписание, пациенты, касса, медкарты
• Маркетплейс — закупки у поставщиков
• Academy OS — курсы и вебинары
• ИИ-помощник — после входа работает с живыми данными клиники

ПРАВИЛА:
1. Отвечай по-русски.
2. НЕ выдумывай расписание, выручку, долги, пациентов — у гостя нет клиники.
3. Если просят «что важно сегодня / выручку / долги / расписание» — мягко объясни, что это появится после входа или демо, и предложи зарегистрироваться / открыть демо.
4. Подсвечивай преимущества DentVision, когда гость знакомится с продуктом.
5. Можно подсказать маркетплейс, академию, демо-клинику, тарифы через navigate.
6. Не упоминай внутренние инструменты и не перечисляй английские ключи разделов (schedule, patients…). Только русские названия: «Расписание», «Маркетплейс», «Academy OS», «Демо-клиника» и т.п.
7. Если неясно куда открыть — спроси коротко и предложи 3–5 пунктов по-русски, без сырого списка ключей.`;
  }

  const agents = agentsForRole(input.role);
  const mandates = agents.map((a) => `- ${a.name}: ${a.mandate}`).join('\n');

  return `Ты — DentVision Intelligence, операционный ИИ клиники в духе Jarvis:
проактивный, спокойный, точный, с лёгкой уверенностью. Без пафоса и без воды.

Пользователь: ${input.userName || 'сотрудник клиники'}, роль: ${input.role}.

Ты оркестрируешь специализированных агентов:
${mandates}

ПРАВИЛА:
1. Отвечай по-русски, коротко. Сначала суть, потом деталь.
2. Все факты о клинике — ТОЛЬКО из инструментов. Не выдумывай.
3. Мутации (запись, счёт, план) — confirmed=false, пока пользователь явно не подтвердил.
4. Клинические выводы — черновик для врача, не диагноз.
5. Ошибки инструментов признавай прямо и предлагай следующий шаг.
6. Раздел открывай через navigate. В тексте пользователю — только русские названия разделов, никогда английские ключи (schedule, patients, finance…).
7. Не свети внутренние имена инструментов/агентов.
8. Если пользователь только вошёл или просит «что важно» — приоритет: расписание сегодня, подтверждения, долги, склад, ближайшие 2 часа — по роли.
9. ${clinicCurrencyPromptRule(currencyCode)}`;
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

async function saveMessage(sessionId: string, role: string, content: string): Promise<void> {
  try {
    await prisma.aIMessage.create({ data: { id: crypto.randomUUID(), sessionId, role, content } });
  } catch {
    /* history persistence must never break the answer */
  }
}

export async function orchestrate(input: OrchestratorInput): Promise<OrchestratorResult> {
  await saveMessage(input.sessionId, 'user', input.text);

  // Jarvis entry briefing — deterministic live KPIs, not a chatty LLM opener.
  if (!input.isGuest && String(input.role).toUpperCase() !== 'GUEST' && isJarvisBriefingTrigger(input.text)) {
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
      await saveMessage(input.sessionId, 'assistant', briefing.message);
      return {
        message: briefing.message,
        intent: 'MORNING_BRIEFING',
        action: { type: 'SHOW_BRIEFING', payload: briefing.payload },
        suggestions: briefing.suggestions,
        toolsUsed: ['jarvis_briefing'],
      };
    } catch (e) {
      console.warn('[AI OS] jarvis briefing failed, continuing to LLM', e);
    }
  }

  // UNDERSTAND — resolve permissions into the concrete tool surface.
  const allowedTools = toolsForRole(input.role);
  const toolSchemas = toolSchemasFor(allowedTools);
  const toolCtx: ToolContext = { userId: input.userId, clinicId: input.clinicId, role: input.role };
  const currencyCode = await resolveClinicCurrency(input.clinicId);
  const instructions = systemPrompt(input, currencyCode);

  const conversation: Array<Record<string, unknown>> = [
    ...(input.history || []).slice(-12).map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
    { role: 'user', content: input.text },
  ];

  const toolsUsed: string[] = [];
  let pendingConfirmation: OrchestratorResult['confirmData'] | undefined;
  let navigateAction: { type: string; payload: unknown } | undefined;

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
      await saveMessage(input.sessionId, 'assistant', safeMessage);

      return {
        message: safeMessage,
        intent: toolsUsed[0] ? `TOOL_${toolsUsed[0].toUpperCase()}` : 'CHAT',
        action: navigateAction,
        suggestions: defaultSuggestions(input.role),
        needsConfirmation: Boolean(pendingConfirmation),
        confirmData: pendingConfirmation,
        toolsUsed,
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

      conversation.push({
        type: 'function_call_output',
        call_id: call.call_id,
        output: JSON.stringify(result).slice(0, 12_000),
      });
    }
  }

  // Loop budget exhausted — respond with what we have rather than hang.
  const message = 'Я собрал данные, но задача оказалась слишком многошаговой. Уточните, что именно показать или сделать первым.';
  await saveMessage(input.sessionId, 'assistant', message);
  return {
    message,
    intent: 'CHAT',
    suggestions: defaultSuggestions(input.role),
    toolsUsed,
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
