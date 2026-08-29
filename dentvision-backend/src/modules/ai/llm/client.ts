/**
 * LLM Client — general-purpose OpenAI client for Event OS agents.
 *
 * Provides chat completion, tool calling, and model selection.
 * All agent LLM calls go through this client.
 */

import { env } from '../../../config.js';
import {
  chooseOpenAIModel,
  estimateTokens,
  recordModelUsage,
  type ModelChoice,
} from '../lib/modelRouter.js';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

// ─── Types ───

/**
 * No `'tool'` role: the Responses API has no such role. A tool result is an
 * item (`function_call_output`), not a message — see `ConversationItem`.
 * Dropping it from the union is deliberate, so a caller that still speaks
 * Chat Completions fails to compile instead of failing silently at runtime.
 */
export type MessageRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: MessageRole;
  content: string;
  imageUrl?: string;
  name?: string;
}

/** The model asking for a tool, echoed back into the conversation. */
export interface FunctionCallItem {
  type: 'function_call';
  name: string;
  call_id: string;
  arguments: string;
}

/** What the tool returned, addressed to the call that asked for it. */
export interface FunctionCallOutputItem {
  type: 'function_call_output';
  call_id: string;
  output: string;
}

export type ConversationItem = ChatMessage | FunctionCallItem | FunctionCallOutputItem;

export function isChatMessage(item: ConversationItem): item is ChatMessage {
  return 'role' in item;
}

/**
 * Flat, as `/v1/responses` requires — the same shape `os/tools.ts::toolSchemasFor`
 * already emits. This used to be the nested Chat Completions form
 * (`{ type:'function', function:{ name, ... } }`), which the endpoint does not
 * accept, so every `chatWithTools` caller was shipping unusable schemas.
 */
export interface ToolDefinition {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface LLMRequest {
  messages: ConversationItem[];
  tools?: ToolDefinition[];
  task: 'orchestrate' | 'polish';
  text: string;
  isGuest?: boolean;
  historyTurns?: number;
  round?: number;
  toolsUsed?: number;
  escalate?: boolean;
  temperature?: number;
  maxTokens?: number;
  /**
   * Make the provider guarantee the shape instead of asking for it in prose.
   *
   * Structured outputs are strict: the root must be an object, every property
   * must be listed in `required`, and `additionalProperties` must be false. An
   * array answer therefore has to be wrapped in a named field.
   */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
}

export interface LLMResponse {
  content: string;
  toolCalls: ToolCall[];
  model: string;
  tier: 'mini' | 'full' | 'free';
  tokensUsed: number;
  finishReason: string;
}

// ─── Client ───

export async function chatCompletion(request: LLMRequest): Promise<LLMResponse> {
  if (!env.OPENAI_API_KEY) {
    return { content: '', toolCalls: [], model: '', tier: 'free', tokensUsed: 0, finishReason: 'no_key' };
  }

  const choice = await chooseOpenAIModel({
    task: request.task,
    text: request.text,
    isGuest: request.isGuest,
    historyTurns: request.historyTurns,
    round: request.round,
    toolsUsed: request.toolsUsed,
    escalate: request.escalate,
  });

  const systemMessage = request.messages.find(
    (m): m is ChatMessage => isChatMessage(m) && m.role === 'system',
  );

  const body: Record<string, unknown> = {
    model: choice.model,
    instructions: systemMessage?.content || '',
    input: request.messages
      .filter((m) => !isChatMessage(m) || m.role !== 'system')
      .map((m) => {
        // Tool call and tool result are items, not messages: they pass through
        // untouched rather than being squeezed into a role.
        if (!isChatMessage(m)) return m;
        const hasImage = !!m.imageUrl;
        const content = hasImage
          ? [
              ...(m.content ? [{ type: 'input_text', text: m.content }] : []),
              { type: 'input_image', image_url: m.imageUrl },
            ]
          : m.content;
        return {
          role: m.role,
          content,
          ...(m.name ? { name: m.name } : {}),
        };
      }),
    max_output_tokens: request.maxTokens || choice.maxOutputTokens,
  };

  // `reasoning` is a reasoning-model parameter. It used to be sent on every
  // request, including to models that have no such mode.
  if (choice.supportsReasoning) {
    body.reasoning = { effort: choice.reasoningEffort };
  }

  if (request.tools && request.tools.length > 0) {
    body.tools = request.tools;
  }

  if (request.temperature !== undefined) {
    body.temperature = request.temperature;
  }

  if (request.jsonSchema) {
    body.text = {
      format: {
        type: 'json_schema',
        name: request.jsonSchema.name,
        strict: true,
        schema: request.jsonSchema.schema,
      },
    };
  }

  const result = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!result.ok) {
    const detail = await result.text().catch(() => 'unknown error');
    throw new Error(`OpenAI ${result.status}: ${detail.slice(0, 300)}`);
  }

  const payload = await result.json() as Record<string, unknown>;
  const output = (payload.output || []) as Array<Record<string, unknown>>;

  let content = '';
  const toolCalls: ToolCall[] = [];

  for (const item of output) {
    if (item.type === 'message') {
      const messageContent = item.content;
      if (Array.isArray(messageContent)) {
        for (const part of messageContent) {
          if (part.type === 'output_text') {
            content = part.text || '';
          }
        }
      }
    }
    if (item.type === 'function_call') {
      toolCalls.push({
        id: item.call_id as string,
        type: 'function',
        function: {
          name: item.name as string,
          arguments: item.arguments as string,
        },
      });
    }
  }

  const tokens = estimateTokens(
    request.messages
      .map((m) => (isChatMessage(m) ? m.content : m.type === 'function_call' ? m.arguments : m.output))
      .join(''),
    content
  );
  recordModelUsage(choice.tier, tokens);

  return {
    content,
    toolCalls,
    model: choice.model,
    tier: choice.tier,
    tokensUsed: tokens,
    finishReason: (payload.status as string) || 'unknown',
  };
}

// ─── Convenience ───

export async function simpleChat(
  systemPrompt: string,
  userMessage: string,
  opts?: {
    isGuest?: boolean;
    maxTokens?: number;
    imageUrl?: string;
    jsonSchema?: { name: string; schema: Record<string, unknown> };
  }
): Promise<string> {
  const response = await chatCompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage, ...(opts?.imageUrl ? { imageUrl: opts.imageUrl } : {}) },
    ],
    task: 'orchestrate',
    text: userMessage,
    isGuest: opts?.isGuest,
    maxTokens: opts?.maxTokens,
    jsonSchema: opts?.jsonSchema,
  });

  return response.content;
}

export async function chatWithTools(
  systemPrompt: string,
  messages: ConversationItem[],
  tools: ToolDefinition[],
  opts?: { isGuest?: boolean; round?: number; toolsUsed?: number }
): Promise<LLMResponse> {
  return chatCompletion({
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    tools,
    task: 'orchestrate',
    // Routing looks at what the user said, not at tool plumbing.
    text: messages.filter(isChatMessage).map((m) => m.content).join(' '),
    isGuest: opts?.isGuest,
    round: opts?.round,
    toolsUsed: opts?.toolsUsed,
  });
}
