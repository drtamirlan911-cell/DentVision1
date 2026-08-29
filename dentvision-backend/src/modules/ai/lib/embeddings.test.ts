import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockEnv, findMany, upsert, providerFetch, resolveModels } = vi.hoisted(() => ({
  mockEnv: { OPENAI_API_KEY: 'k'.repeat(24), OPENAI_MODEL: undefined, OPENAI_MODEL_MINI: undefined },
  findMany: vi.fn(),
  upsert: vi.fn(),
  providerFetch: vi.fn(),
  resolveModels: vi.fn(),
}));

vi.mock('../../../config.js', () => ({ env: mockEnv }));
vi.mock('../../../lib/prisma.js', () => ({
  default: { embeddingCache: { findMany, upsert } },
}));
vi.mock('./providerFetch.js', () => ({ providerFetch }));
vi.mock('./modelCatalog.js', () => ({ resolveModels }));

const { cosineSimilarity, embedText, embedTexts, embeddingHash } = await import('./embeddings.js');

beforeEach(() => {
  findMany.mockReset().mockResolvedValue([]);
  upsert.mockReset().mockResolvedValue({});
  providerFetch.mockReset();
  resolveModels.mockReset().mockResolvedValue({ embedding: 'test-embed' });
  mockEnv.OPENAI_API_KEY = 'k'.repeat(24);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('cosineSimilarity', () => {
  it('is 1 for identical direction and 0 for orthogonal', () => {
    expect(cosineSimilarity([1, 0], [2, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('is -1 for opposite direction', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it.each([
    ['a zero vector', [0, 0], [1, 1]],
    ['mismatched lengths', [1, 2, 3], [1, 2]],
    ['an empty vector', [], [1]],
  ])('returns 0 rather than NaN for %s', (_label, a, b) => {
    // NaN would not just be wrong, it would corrupt the whole sort.
    expect(cosineSimilarity(a as number[], b as number[])).toBe(0);
  });
});

describe('embeddingHash', () => {
  it('separates the same text under different models', () => {
    // Vectors from two models live in different spaces; sharing a cache entry
    // would silently compare incomparable things.
    expect(embeddingHash('m1', 'текст')).not.toBe(embeddingHash('m2', 'текст'));
  });

  it('is stable for the same input', () => {
    expect(embeddingHash('m', 'текст')).toBe(embeddingHash('m', 'текст'));
  });
});

describe('embedTexts', () => {
  it('returns null without an API key, and never calls the provider', async () => {
    mockEnv.OPENAI_API_KEY = '';

    await expect(embedTexts(['x'])).resolves.toBeNull();
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it('embeds and caches a miss', async () => {
    providerFetch.mockResolvedValue({ data: [{ index: 0, embedding: [1, 2, 3] }] });

    await expect(embedText('привет')).resolves.toEqual([1, 2, 3]);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ dimension: 3, model: 'test-embed' }) }),
    );
  });

  it('serves a cache hit without calling the provider', async () => {
    findMany.mockResolvedValue([{ hash: embeddingHash('test-embed', 'привет'), vector: [9, 9] }]);

    await expect(embedText('привет')).resolves.toEqual([9, 9]);
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it('pays for a repeated text only once', async () => {
    providerFetch.mockResolvedValue({ data: [{ index: 0, embedding: [1, 1] }] });

    const out = await embedTexts(['одно и то же', 'одно и то же']);

    expect(out).toEqual([[1, 1], [1, 1]]);
    expect(providerFetch).toHaveBeenCalledTimes(1);
    expect((providerFetch.mock.calls[0][1] as any).body.input).toHaveLength(1);
  });

  it('respects the provider’s own ordering, not arrival order', async () => {
    // The API may answer out of order; `index` is what says which is which.
    providerFetch.mockResolvedValue({
      data: [{ index: 1, embedding: [2, 2] }, { index: 0, embedding: [1, 1] }],
    });

    await expect(embedTexts(['первый', 'второй'])).resolves.toEqual([[1, 1], [2, 2]]);
  });

  it('degrades to null when the provider fails', async () => {
    providerFetch.mockRejectedValue(new Error('down'));

    await expect(embedTexts(['x'])).resolves.toBeNull();
  });

  it('still works when the cache table is unreachable', async () => {
    findMany.mockRejectedValue(new Error('no table'));
    providerFetch.mockResolvedValue({ data: [{ index: 0, embedding: [5] }] });

    await expect(embedText('x')).resolves.toEqual([5]);
  });

  it('does not fail the search when caching the result fails', async () => {
    providerFetch.mockResolvedValue({ data: [{ index: 0, embedding: [7] }] });
    upsert.mockRejectedValue(new Error('write failed'));

    await expect(embedText('x')).resolves.toEqual([7]);
  });
});
