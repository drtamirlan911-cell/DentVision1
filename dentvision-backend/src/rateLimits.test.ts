import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The rate-limit ceilings are readable from the environment so an end-to-end
 * run — dozens of logins from one address in a couple of minutes — does not
 * trip a limiter sized for a human being.
 *
 * That knob is also the obvious way to turn rate limiting off in production by
 * accident, so this pins the two things that must stay true: the defaults are
 * the production values, and the one limiter a test actually asserts on cannot
 * be reconfigured from outside.
 *
 * Source-reading rather than importing `app.ts`, which would boot the whole
 * application: the claim here is about what the file says, and it has to hold
 * in CI with no database.
 */

const APP = readFileSync(resolve(__dirname, 'app.ts'), 'utf8');

describe('rate-limit ceilings', () => {
  it('defaults to the production values when nothing is set', () => {
    expect(APP).toMatch(/limitFromEnv\('RATE_LIMIT_API_MAX',\s*500\)/);
    expect(APP).toMatch(/limitFromEnv\('RATE_LIMIT_AUTH_MAX',\s*40\)/);
  });

  it('ignores a zero or negative override rather than removing the limit', () => {
    // `max: 0` in express-rate-limit means "block everything", and a negative
    // number is nonsense — but a typo in a deploy variable should not be able to
    // produce either. Anything not a positive finite number falls back.
    expect(APP).toMatch(/Number\.isFinite\(raw\)\s*&&\s*raw\s*>\s*0\s*\?\s*raw\s*:\s*fallback/);
  });

  it('leaves the AI limiter unconfigurable', () => {
    // `ai.spec.ts` asserts that too many AI requests produce 429. If that
    // ceiling could be raised from the environment, the suite's one rate-limit
    // test could be switched off without touching the test.
    const ai = APP.slice(APP.indexOf('const aiLimiter'), APP.indexOf('const guestSessionLimiter'));
    expect(ai).toMatch(/max:\s*100,/);
    expect(ai).not.toMatch(/limitFromEnv/);
  });

  it('still throttles the webhook callback surface', () => {
    // Tight and deliberately fixed: genuine payment callbacks are infrequent,
    // and this is the one limiter facing an unauthenticated third party.
    const hook = APP.slice(APP.indexOf('const webhookLimiter'));
    expect(hook).toMatch(/max:\s*10,/);
    expect(hook).not.toMatch(/limitFromEnv/);
  });
});
