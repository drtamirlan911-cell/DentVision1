import { describe, expect, it } from 'vitest';
import { isAllowedDisputeTransition } from './disputes.routes.js';

describe('dispute state machine', () => {
  it('allows the supported forward transitions', () => {
    expect(isAllowedDisputeTransition('open', 'review')).toBe(true);
    expect(isAllowedDisputeTransition('open', 'resolved')).toBe(true);
    expect(isAllowedDisputeTransition('open', 'rejected')).toBe(true);
    expect(isAllowedDisputeTransition('review', 'resolved')).toBe(true);
    expect(isAllowedDisputeTransition('review', 'rejected')).toBe(true);
  });

  it('rejects backward transitions and terminal-state changes', () => {
    expect(isAllowedDisputeTransition('review', 'open')).toBe(false);
    expect(isAllowedDisputeTransition('resolved', 'open')).toBe(false);
    expect(isAllowedDisputeTransition('resolved', 'rejected')).toBe(false);
    expect(isAllowedDisputeTransition('rejected', 'review')).toBe(false);
  });

  it('rejects unknown states', () => {
    expect(isAllowedDisputeTransition('open', 'paid')).toBe(false);
    expect(isAllowedDisputeTransition('unknown', 'resolved')).toBe(false);
  });
});
