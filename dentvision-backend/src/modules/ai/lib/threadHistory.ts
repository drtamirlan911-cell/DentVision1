import { decryptAiTranscriptText } from './transcriptEncryption.js';

export function decryptStoredThreadMessages(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  return value.map((message) => {
    if (!message || typeof message !== 'object' || Array.isArray(message)) return message;
    const record = message as Record<string, unknown>;
    if (typeof record.content !== 'string') return record;
    return { ...record, content: decryptAiTranscriptText(record.content) };
  });
}

function parseBoundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) return fallback;
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed < min) return fallback;
  return Math.min(parsed, max);
}

export function parseAiHistoryPagination(limit: unknown, offset: unknown): { limit: number; offset: number } {
  return {
    limit: parseBoundedInteger(limit, 20, 1, 100),
    offset: parseBoundedInteger(offset, 0, 0, 100_000),
  };
}
