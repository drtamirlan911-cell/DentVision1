import { describe, expect, it } from 'vitest';

import { stripModelConfirmation } from './orchestrator.js';

describe('stripModelConfirmation', () => {
  it('removes a confirmation the model set itself', () => {
    const args = stripModelConfirmation({ patientId: 'p1', date: '2026-08-10', confirmed: true });

    expect(args).not.toHaveProperty('confirmed');
    expect(args).toEqual({ patientId: 'p1', date: '2026-08-10' });
  });

  it('removes it whatever the value, so no truthiness trick gets through', () => {
    for (const value of [true, 'true', 1, {}, []]) {
      expect(stripModelConfirmation({ confirmed: value })).toEqual({});
    }
  });

  it('leaves calls without the flag untouched', () => {
    const args = { patientId: 'p1' };
    expect(stripModelConfirmation(args)).toBe(args);
  });

  it('does not mutate the caller’s object', () => {
    const args = { patientId: 'p1', confirmed: true };
    stripModelConfirmation(args);
    expect(args.confirmed).toBe(true);
  });
});
