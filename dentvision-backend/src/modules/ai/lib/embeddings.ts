/**
 * Real text embeddings, replacing a hand-rolled hash.
 *
 * The module this supersedes generated a "100-dimension bag-of-words
 * embedding" by hashing each word into one of a hundred buckets. Its own
 * comment admitted what it should have been. Two texts about entirely
 * different things collide in such a space as easily as two about the same
 * thing, so its similarity scores meant nothing.
 *
 * Vectors are cached by content hash, the same trick `voice.service.ts` uses
 * for speech: the same text through the same model always yields the same
 * vector, so paying twice is waste. The hash covers the model id too — vectors
 * from two different models live in different spaces, and comparing them would
 * produce confident nonsense rather than an obvious error.
 */

import { createHash } from 'node:crypto';

import prisma from '../../../lib/prisma.js';
import { env } from '../../../config.js';
import { providerFetch } from './providerFetch.js';
import { resolveModels } from './modelCatalog.js';

const EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';
const REQUEST_TIMEOUT_MS = 20_000;
/** Provider limit is far higher; this keeps one request from being enormous. */
const MAX_BATCH = 64;
/** Roughly 8k tokens — beyond this the tail adds noise, not meaning. */
const MAX_CHARS = 24_000;

export function embeddingHash(model: string, text: string): string {
  return createHash('sha256').update(`${model}|${text}`).digest('hex');
}

/**
 * Cosine similarity of two vectors, in [-1, 1].
 *
 * Returns 0 for a zero vector rather than NaN: an empty note should rank last,
 * not poison the sort.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function normalize(text: string): string {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS);
}

interface EmbeddingResponse {
  data?: Array<{ embedding?: number[]; index?: number }>;
}

async function callProvider(model: string, inputs: string[]): Promise<number[][]> {
  const payload = await providerFetch<EmbeddingResponse>(EMBEDDINGS_URL, {
    apiKey: env.OPENAI_API_KEY as string,
    body: { model, input: inputs },
    timeoutMs: REQUEST_TIMEOUT_MS,
  });
  const rows = payload.data ?? [];
  // The API may return results out of order; `index` is authoritative.
  const out: number[][] = new Array(inputs.length).fill(null);
  rows.forEach((row, i) => {
    const at = typeof row.index === 'number' ? row.index : i;
    if (Array.isArray(row.embedding)) out[at] = row.embedding;
  });
  return out;
}

/**
 * Embed a batch of texts, reusing anything already cached.
 *
 * `null` means embeddings are unavailable (no API key, or the provider
 * failed) — callers fall back to lexical search rather than returning nothing,
 * because a search box that silently returns zero results is worse than one
 * that returns rough matches.
 */
export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  if (!env.OPENAI_API_KEY) return null;
  const prepared = texts.map(normalize);

  const { embedding: model } = await resolveModels({
    apiKey: env.OPENAI_API_KEY,
    envFull: env.OPENAI_MODEL,
    envMini: env.OPENAI_MODEL_MINI,
  });

  const hashes = prepared.map((t) => embeddingHash(model, t));
  const result: Array<number[] | null> = new Array(prepared.length).fill(null);

  try {
    const cached = await prisma.embeddingCache.findMany({
      where: { hash: { in: [...new Set(hashes)] } },
      select: { hash: true, vector: true },
    });
    const byHash = new Map(cached.map((row) => [row.hash, row.vector]));
    hashes.forEach((h, i) => {
      const hit = byHash.get(h);
      if (hit) result[i] = hit;
    });
  } catch {
    // A missing or unreachable cache table must not disable search.
  }

  // Only the misses are paid for, and each distinct text only once even when
  // it appears several times in the batch.
  const missing = [...new Set(prepared.filter((_, i) => result[i] === null))];
  if (missing.length > 0) {
    try {
      for (let start = 0; start < missing.length; start += MAX_BATCH) {
        const batch = missing.slice(start, start + MAX_BATCH);
        const vectors = await callProvider(model, batch);
        for (let i = 0; i < batch.length; i++) {
          const vector = vectors[i];
          if (!vector?.length) continue;
          const hash = embeddingHash(model, batch[i]);
          prepared.forEach((text, at) => {
            if (text === batch[i]) result[at] = vector;
          });
          try {
            await prisma.embeddingCache.upsert({
              where: { hash },
              update: {},
              create: { hash, model, vector, dimension: vector.length },
            });
          } catch {
            // Caching is an optimisation; failing to store must not fail the search.
          }
        }
      }
    } catch (error) {
      console.error('[embeddings] provider call failed:', error);
      return null;
    }
  }

  if (result.some((v) => v === null)) return null;
  return result as number[][];
}

/** Convenience for the single-text case. */
export async function embedText(text: string): Promise<number[] | null> {
  const out = await embedTexts([text]);
  return out?.[0] ?? null;
}
