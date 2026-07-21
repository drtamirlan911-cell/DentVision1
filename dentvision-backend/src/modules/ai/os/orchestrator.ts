/**
 * AI Orchestrator — DentVision AI OS (Spec §15.3, §15.17).
 *
 * The user talks to one assistant; internally the orchestrator plans with
 * GPT-5.6 (OpenAI Responses API) over the RBAC-filtered tool set from the
 * agent registry, executes tools against the clinic's data, and merges
 * everything into a single answer.
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
import { executeTool, toolSchemasFor, type ToolContext } from './tools.js';
import { preferTengeCurrency } from '../lib/currency.js';

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

function systemPrompt(input: OrchestratorInput): string {
  const agents = agentsForRole(input.role);
  const mandates = agents.map((a) => `- ${a.name}: ${a.mandate}`).join('\n');

  return `Ты — DentVision Intelligence, операционная система стоматологической клиники.
Пользователь: ${input.userName || 'сотрудник клиники'}, роль: ${input.role}.

Ты работаешь как оркестратор сети специализированных агентов. Их мандаты:
${mandates}

ПРАВИЛА:
1. Отвечай по-русски, кратко и по делу, как опытный коллега.
2. Все факты о клинике бери ТОЛЬКО из инструментов. Не выдумывай пациентов, суммы, записи.
3. Изменяющие действия (запись, счёт, план лечения) вызывай с confirmed=false — инструмент вернёт черновик для подтверждения пользователем. confirmed=true передавай только если пользователь уже явно подтвердил в этом сообщении.
4. Клинические выводы — всегда черновик для врача, не диагноз.
5. Если инструмент вернул ошибку — скажи об этом честно и предложи следующий шаг.
6. Если просят открыть раздел — используй navigate.
7. Не упоминай внутренние названия инструментов и агентов в ответе.
8. Валюта — тенге (KZT, символ ₸). Никогда не пиши суммы в рублях / ₽ / RUB.`;
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

async function callModel(body: Record<string, unknown>): Promise<ResponsesAPIResult> {
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
  return (await res.json()) as ResponsesAPIResult;
}

async function saveMessage(sessionId: string, role: string, content: string): Promise<void> {
  try {
    await prisma.aIMessage.create({ data: { id: crypto.randomUUID(), sessionId, role, content } });
  } catch {
    /* history persistence must never break the answer */
  }
}

export async function orchestrate(input: OrchestratorInput): Promise<OrchestratorResult> {
  // UNDERSTAND — resolve permissions into the concrete tool surface.
  const allowedTools = toolsForRole(input.role);
  const toolSchemas = toolSchemasFor(allowedTools);
  const toolCtx: ToolContext = { userId: input.userId, clinicId: input.clinicId, role: input.role };

  await saveMessage(input.sessionId, 'user', input.text);

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
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await callModel({
      model: env.OPENAI_MODEL,
      instructions: systemPrompt(input),
      input: conversation,
      tools: toolSchemas,
      reasoning: { effort: env.OPENAI_REASONING_EFFORT },
      max_output_tokens: 1200,
    });

    const outputItems = response.output || [];
    const functionCalls = outputItems.filter((item) => item.type === 'function_call');

    if (functionCalls.length === 0) {
      // MERGE RESULTS → RESPOND
      const message =
        (typeof response.output_text === 'string' && response.output_text.trim()) ||
        outputItems
          .filter((i) => i.type === 'message')
          .flatMap((i) => i.content || [])
          .map((c) => c.text || '')
          .join('')
          .trim() ||
        'Готово.';

      const safeMessage = preferTengeCurrency(message);
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
  if (normalized === 'OWNER' || normalized === 'ADMIN' || normalized === 'MANAGER') {
    return ['Покажи выручку за месяц', 'Кто должен клинике?', 'Загрузка врачей'];
  }
  if (normalized === 'DOCTOR') {
    return ['Моё расписание на сегодня', 'Найди пациента', 'Создай план лечения'];
  }
  return ['Расписание на сегодня', 'Найди курс', 'Что на складе?'];
}
