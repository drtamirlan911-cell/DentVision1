import { describe, expect, it, vi, beforeEach } from 'vitest';

const { simpleChat } = vi.hoisted(() => ({ simpleChat: vi.fn() }));
vi.mock('../ai/llm/client.js', () => ({ simpleChat }));

const { reviewHomeworkWithAI, getTutorReply, reviewHomework } = await import('./academyContent.js');

describe('reviewHomeworkWithAI', () => {
  beforeEach(() => { simpleChat.mockReset(); });

  const input = { title: 'Case', category: 'Эндодонтия', imageCount: 2, notes: 'краткая заметка' };

  it('uses the model reply when it parses as the expected JSON shape', async () => {
    simpleChat.mockResolvedValue('{"score": 88, "verdict": "Хорошо", "feedback": ["ок"], "suggestions": ["добавьте фото"]}');
    const result = await reviewHomeworkWithAI(input);
    expect(result).toEqual({ score: 88, verdict: 'Хорошо', feedback: ['ок'], suggestions: ['добавьте фото'], source: 'ai' });
  });

  it('strips a ```json fence the model adds despite instructions not to', async () => {
    simpleChat.mockResolvedValue('```json\n{"score": 70, "verdict": "Принято", "feedback": [], "suggestions": []}\n```');
    const result = await reviewHomeworkWithAI(input);
    expect(result.source).toBe('ai');
    expect(result.score).toBe(70);
  });

  it('falls back to the deterministic heuristic when the model reply is not valid JSON', async () => {
    simpleChat.mockResolvedValue('Это не JSON, а обычный текст.');
    const result = await reviewHomeworkWithAI(input);
    expect(result.source).toBe('heuristic');
    expect(result).toMatchObject(reviewHomework(input));
  });

  it('falls back when the model reports a score outside 0-100', async () => {
    simpleChat.mockResolvedValue('{"score": 150, "verdict": "x", "feedback": [], "suggestions": []}');
    const result = await reviewHomeworkWithAI(input);
    expect(result.source).toBe('heuristic');
  });

  it('falls back when no API key is configured (empty string from simpleChat)', async () => {
    simpleChat.mockResolvedValue('');
    const result = await reviewHomeworkWithAI(input);
    expect(result.source).toBe('heuristic');
  });

  it('falls back when the model call throws — a review must never 500', async () => {
    simpleChat.mockRejectedValue(new Error('network down'));
    const result = await reviewHomeworkWithAI(input);
    expect(result.source).toBe('heuristic');
    expect(result.score).toBeGreaterThan(0);
  });
});

describe('getTutorReply', () => {
  beforeEach(() => { simpleChat.mockReset(); });

  it('uses the model reply when it responds with text', async () => {
    simpleChat.mockResolvedValue('Проверьте рабочую длину перед обтурацией.');
    const result = await getTutorReply('вопрос про эндо');
    expect(result.reply).toBe('Проверьте рабочую длину перед обтурацией.');
  });

  it('falls back to a canned keyword reply when the model returns nothing', async () => {
    simpleChat.mockResolvedValue('');
    const result = await getTutorReply('вопрос про эндодонтию канала');
    expect(result.reply).toMatch(/эндодонтии/i);
  });

  it('falls back to a canned keyword reply when the model call throws', async () => {
    simpleChat.mockRejectedValue(new Error('timeout'));
    const result = await getTutorReply('расскажи про имплант');
    expect(result.reply).toMatch(/эстетической зоне/i);
  });
});
