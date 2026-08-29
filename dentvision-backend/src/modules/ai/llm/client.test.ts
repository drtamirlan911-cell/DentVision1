import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * These tests read the body that actually goes on the wire.
 *
 * Every defect they cover was invisible from the code: the request was
 * well-typed, the call returned 200, and the model simply behaved as if the
 * tools or the tool results had not been sent — because, in the shape the
 * Responses API reads, they had not been.
 */

const { mockEnv, chooseOpenAIModel } = vi.hoisted(() => ({
  mockEnv: { OPENAI_API_KEY: 'test-key-0123456789012345678901' },
  chooseOpenAIModel: vi.fn(),
}));

vi.mock('../../../config.js', () => ({ env: mockEnv }));
vi.mock('../lib/modelRouter.js', () => ({
  chooseOpenAIModel,
  estimateTokens: () => 1,
  recordModelUsage: () => undefined,
}));

const { chatCompletion, chatWithTools } = await import('./client.js');

/** Captures the JSON body of the single outbound call. */
function captureFetch(): () => Record<string, any> {
  const fetchMock = vi.fn(async () =>
    new Response(JSON.stringify({ output: [], status: 'completed' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return () => JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
}

function modelChoice(over: Record<string, unknown> = {}) {
  return {
    model: 'test-model',
    tier: 'mini' as const,
    reasoningEffort: 'low' as const,
    supportsReasoning: false,
    maxOutputTokens: 900,
    reason: 'test',
    ...over,
  };
}

beforeEach(() => {
  vi.unstubAllGlobals();
  chooseOpenAIModel.mockReset();
  chooseOpenAIModel.mockResolvedValue(modelChoice());
});

describe('chatCompletion — Responses API request shape', () => {
  it('sends tool schemas flat, not wrapped in a `function` object', async () => {
    const body = captureFetch();
    await chatWithTools(
      'system',
      [{ role: 'user', content: 'привет' }],
      [{ type: 'function', name: 'getVisits', description: 'd', parameters: { type: 'object' } }],
    );

    const [tool] = body().tools;
    expect(tool).toEqual({ type: 'function', name: 'getVisits', description: 'd', parameters: { type: 'object' } });
    expect(tool).not.toHaveProperty('function');
  });

  it('passes a tool call and its result through as items, not as messages', async () => {
    const body = captureFetch();
    await chatWithTools(
      'system',
      [
        { role: 'user', content: 'какие визиты?' },
        { type: 'function_call', name: 'getVisits', call_id: 'c1', arguments: '{}' },
        { type: 'function_call_output', call_id: 'c1', output: '{"visits":[]}' },
      ],
      [],
    );

    const input = body().input;
    expect(input).toContainEqual({ type: 'function_call', name: 'getVisits', call_id: 'c1', arguments: '{}' });
    expect(input).toContainEqual({ type: 'function_call_output', call_id: 'c1', output: '{"visits":[]}' });
    // The Chat Completions shape must not reappear.
    expect(input.some((i: any) => i.role === 'tool')).toBe(false);
    expect(input.some((i: any) => i.tool_calls)).toBe(false);
  });

  it('puts the system prompt in `instructions` and keeps it out of `input`', async () => {
    const body = captureFetch();
    await chatCompletion({
      messages: [
        { role: 'system', content: 'ты ассистент' },
        { role: 'user', content: 'привет' },
      ],
      task: 'orchestrate',
      text: 'привет',
    });

    expect(body().instructions).toBe('ты ассистент');
    expect(body().input.some((i: any) => i.role === 'system')).toBe(false);
  });

  it('omits `reasoning` for a model that has no reasoning mode', async () => {
    const body = captureFetch();
    await chatCompletion({ messages: [{ role: 'user', content: 'x' }], task: 'orchestrate', text: 'x' });

    expect(body()).not.toHaveProperty('reasoning');
  });

  it('sends `reasoning` for a model that does', async () => {
    chooseOpenAIModel.mockResolvedValue(modelChoice({ supportsReasoning: true, reasoningEffort: 'medium' }));
    const body = captureFetch();
    await chatCompletion({ messages: [{ role: 'user', content: 'x' }], task: 'orchestrate', text: 'x' });

    expect(body().reasoning).toEqual({ effort: 'medium' });
  });

  it('sends an image as an `input_image` part alongside the text', async () => {
    const body = captureFetch();
    await chatCompletion({
      messages: [{ role: 'user', content: 'опиши снимок', imageUrl: 'https://example.test/x.png' }],
      task: 'orchestrate',
      text: 'опиши снимок',
    });

    expect(body().input[0].content).toEqual([
      { type: 'input_text', text: 'опиши снимок' },
      { type: 'input_image', image_url: 'https://example.test/x.png' },
    ]);
  });

  it('does not call the provider at all without an API key', async () => {
    const key = mockEnv.OPENAI_API_KEY;
    mockEnv.OPENAI_API_KEY = '';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await chatCompletion({ messages: [{ role: 'user', content: 'x' }], task: 'orchestrate', text: 'x' });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.finishReason).toBe('no_key');
    mockEnv.OPENAI_API_KEY = key;
  });
});
