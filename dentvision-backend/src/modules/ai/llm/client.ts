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

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: MessageRole;
  content: string;
  tool_call_id?: string;
  name?: string;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
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
  messages: ChatMessage[];
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
}

export interface LLMResponse {
  content: string;
  toolCalls: ToolCall[];
  model: string;
  tier: 'mini' | 'full';
  tokensUsed: number;
  finishReason: string;
}

// ─── Client ───

export async function chatCompletion(request: LLMRequest): Promise<LLMResponse> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
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

  const body: Record<string, unknown> = {
    model: choice.model,
    instructions: request.messages.find((m) => m.role === 'system')?.content || '',
    input: request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
        ...(m.name ? { name: m.name } : {}),
      })),
    reasoning: { effort: choice.reasoningEffort },
    max_output_tokens: request.maxTokens || choice.maxOutputTokens,
  };

  if (request.tools && request.tools.length > 0) {
    body.tools = request.tools;
  }

  if (request.temperature !== undefined) {
    body.temperature = request.temperature;
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
    request.messages.map((m) => m.content).join(''),
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
  opts?: { isGuest?: boolean; maxTokens?: number }
): Promise<string> {
  const response = await chatCompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    task: 'orchestrate',
    text: userMessage,
    isGuest: opts?.isGuest,
    maxTokens: opts?.maxTokens,
  });

  return response.content;
}

export async function chatWithTools(
  systemPrompt: string,
  messages: ChatMessage[],
  tools: ToolDefinition[],
  opts?: { isGuest?: boolean; round?: number; toolsUsed?: number }
): Promise<LLMResponse> {
  return chatCompletion({
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    tools,
    task: 'orchestrate',
    text: messages.map((m) => m.content).join(' '),
    isGuest: opts?.isGuest,
    round: opts?.round,
    toolsUsed: opts?.toolsUsed,
  });
}
