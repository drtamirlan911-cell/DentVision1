import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FULL_LADDER,
  MINI_LADDER,
  __resetModelCatalogForTests,
  getResolvedModels,
  resolveModels,
} from './modelCatalog.js';

const FULL_FLOOR = FULL_LADDER[FULL_LADDER.length - 1].id;
const MINI_FLOOR = MINI_LADDER[MINI_LADDER.length - 1].id;
const FULL_TOP = FULL_LADDER[0].id;
const MINI_TOP = MINI_LADDER[0].id;

/** Stub `/v1/models` with exactly the ids this account may call. */
function stubModels(ids: string[]) {
  const fetchMock = vi.fn(async () =>
    new Response(JSON.stringify({ data: ids.map((id) => ({ id })) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  __resetModelCatalogForTests();
  vi.unstubAllGlobals();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('resolveModels — discovery', () => {
  it('takes the highest ladder entry the account actually has', async () => {
    stubModels([FULL_TOP, MINI_TOP, FULL_FLOOR, MINI_FLOOR]);

    const models = await resolveModels({ apiKey: 'k' });

    expect(models.full).toBe(FULL_TOP);
    expect(models.mini).toBe(MINI_TOP);
    expect(models.source).toBe('probe');
    expect(models.degraded).toBe(false);
  });

  it('skips ladder entries this account cannot call', async () => {
    // The whole point of a superset ladder: an id nobody has is inert.
    stubModels([FULL_FLOOR, MINI_FLOOR]);

    const models = await resolveModels({ apiKey: 'k' });

    expect(models.full).toBe(FULL_FLOOR);
    expect(models.mini).toBe(MINI_FLOOR);
  });

  it('picks a vision-capable model for the image tier', async () => {
    const visionless = FULL_LADDER.find((c) => !c.vision);
    expect(visionless, 'ladder should contain at least one non-vision entry').toBeTruthy();
    stubModels([visionless!.id]);

    const models = await resolveModels({ apiKey: 'k' });

    expect(models.full).toBe(visionless!.id);
    // Nothing available accepts images, and the catalog says so instead of
    // handing a text-only model to the radiograph path.
    expect(models.vision).toBeNull();
  });

  it('reports degraded and falls back to the floor when the probe fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));

    const models = await resolveModels({ apiKey: 'k' });

    expect(models.full).toBe(FULL_FLOOR);
    expect(models.degraded).toBe(true);
    expect(console.error).toHaveBeenCalled();
  });

  it('does not probe without an API key', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const models = await resolveModels({});

    expect(fetchMock).not.toHaveBeenCalled();
    expect(models.full).toBe(FULL_FLOOR);
  });
});

describe('resolveModels — operator pin', () => {
  it('uses pinned ids and skips the probe entirely', async () => {
    const fetchMock = stubModels([FULL_TOP, MINI_TOP]);

    const models = await resolveModels({ apiKey: 'k', envFull: 'pinned-full', envMini: 'pinned-mini' });

    expect(models).toMatchObject({ full: 'pinned-full', mini: 'pinned-mini', source: 'env' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still discovers the other tier when only one id is pinned', async () => {
    stubModels([FULL_TOP, MINI_TOP]);

    const models = await resolveModels({ apiKey: 'k', envFull: 'pinned-full' });

    expect(models.full).toBe('pinned-full');
    expect(models.mini).toBe(MINI_TOP);
    expect(models.source).toBe('probe');
  });
});

describe('resolveModels — caching', () => {
  it('probes once and serves the cache afterwards', async () => {
    const fetchMock = stubModels([FULL_TOP, MINI_TOP]);

    await resolveModels({ apiKey: 'k' });
    await resolveModels({ apiKey: 'k' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getResolvedModels()?.full).toBe(FULL_TOP);
  });

  it('re-probes when forced', async () => {
    const fetchMock = stubModels([FULL_TOP, MINI_TOP]);

    await resolveModels({ apiKey: 'k' });
    await resolveModels({ apiKey: 'k', force: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('the ladder itself', () => {
  it('has no duplicate ids across tiers', async () => {
    const ids = [...FULL_LADDER, ...MINI_LADDER].map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ends each tier with a vision-capable floor', async () => {
    // The floor is what a failed probe falls back to; a text-only floor would
    // silently disable radiograph analysis on exactly the worst day for it.
    expect(FULL_LADDER[FULL_LADDER.length - 1].vision).toBe(true);
    expect(MINI_LADDER[MINI_LADDER.length - 1].vision).toBe(true);
  });
});
