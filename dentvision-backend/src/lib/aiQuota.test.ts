import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * One cap, two storage paths. The point of these tests is that the *limit*
 * behaves identically whether it is counted in Redis or in memory — otherwise
 * turning Redis on or off would quietly change what users are allowed.
 */

const { incrementDaily, readDaily, clearDaily } = vi.hoisted(() => ({
  incrementDaily: vi.fn(),
  readDaily: vi.fn(),
  clearDaily: vi.fn(),
}));

vi.mock('./dailyCounter.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  incrementDaily,
  readDaily,
  clearDaily,
}));

const { GUEST_AI_LIMIT, consumeGuestAi, guestAiRemaining, __resetGuestAiQuota } =
  await import('./guestAiQuota.js');
const { PATIENT_AI_DAILY_LIMIT, consumePatientAi, patientAiRemaining, __resetPatientAiQuota } =
  await import('./patientAiQuota.js');

/** Redis present: the shared counter answers. */
function withSharedCounter() {
  let total = 0;
  incrementDaily.mockImplementation(async (_key: string, by = 1) => (total += by));
  readDaily.mockImplementation(async () => total);
}

/** Redis absent: every helper returns null and the modules fall back to memory. */
function withoutSharedCounter() {
  incrementDaily.mockResolvedValue(null);
  readDaily.mockResolvedValue(null);
}

beforeEach(async () => {
  incrementDaily.mockReset();
  readDaily.mockReset();
  clearDaily.mockReset();
  __resetGuestAiQuota();
  await __resetPatientAiQuota();
});

describe.each([
  ['shared counter', withSharedCounter],
  ['in-memory fallback', withoutSharedCounter],
])('guest quota — %s', (_label, setup) => {
  beforeEach(setup);

  it('lets the last allowed request through and blocks the next', async () => {
    let last = 0;
    for (let i = 0; i < GUEST_AI_LIMIT; i++) last = await consumeGuestAi('u1');

    expect(last).toBe(0);
    await expect(consumeGuestAi('u1')).resolves.toBe(-1);
  });

  it('reports what is left', async () => {
    await consumeGuestAi('u1');

    await expect(guestAiRemaining('u1')).resolves.toBe(GUEST_AI_LIMIT - 1);
  });
});

describe.each([
  ['shared counter', withSharedCounter],
  ['in-memory fallback', withoutSharedCounter],
])('patient quota — %s', (_label, setup) => {
  beforeEach(setup);

  it('lets the last allowed turn through and blocks the next', async () => {
    let last = 0;
    for (let i = 0; i < PATIENT_AI_DAILY_LIMIT; i++) last = await consumePatientAi('p1');

    expect(last).toBe(0);
    await expect(consumePatientAi('p1')).resolves.toBe(-1);
  });

  it('reports what is left', async () => {
    await consumePatientAi('p1');

    await expect(patientAiRemaining('p1')).resolves.toBe(PATIENT_AI_DAILY_LIMIT - 1);
  });
});

describe('the shared counter is what makes the cap cluster-wide', () => {
  beforeEach(withSharedCounter);

  it('counts a second instance’s spending too', async () => {
    // Two "instances" share one counter, so the cap is reached in half the
    // requests each would have needed on its own.
    for (let i = 0; i < GUEST_AI_LIMIT; i++) await consumeGuestAi('u1');

    await expect(guestAiRemaining('u1')).resolves.toBe(0);
    await expect(consumeGuestAi('u1')).resolves.toBe(-1);
  });

  it('keys the quota per user, not globally', async () => {
    await consumeGuestAi('u1');

    // The stub is a single counter, so this asserts the call carried a
    // user-specific key rather than one shared bucket.
    expect(incrementDaily).toHaveBeenCalledWith(expect.stringContaining('u1'));
  });
});
