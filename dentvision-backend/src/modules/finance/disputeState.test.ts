import { describe, expect, it } from 'vitest';
import { canTransitionDispute, isDisputeStatus } from './disputeState.js';

describe('dispute state machine', () => {
  it('accepts the supported forward transitions', () => {
    expect(canTransitionDispute('open', 'review')).toBe(true);
    expect(canTransitionDispute('open', 'resolved')).toBe(true);
    expect(canTransitionDispute('review', 'resolved')).toBe(true);
    expect(canTransitionDispute('review', 'rejected')).toBe(true);
  });

  it('rejects transitions out of terminal states', () => {
    expect(canTransitionDispute('resolved', 'open')).toBe(false);
    expect(canTransitionDispute('resolved', 'review')).toBe(false);
    expect(canTransitionDispute('resolved', 'rejected')).toBe(false);
    expect(canTransitionDispute('rejected', 'open')).toBe(false);
    expect(canTransitionDispute('rejected', 'review')).toBe(false);
    expect(canTransitionDispute('rejected', 'resolved')).toBe(false);
  });

  it('fails closed for invalid states and values', () => {
    expect(isDisputeStatus('open')).toBe(true);
    expect(isDisputeStatus('pending')).toBe(false);
    expect(isDisputeStatus(null)).toBe(false);
    expect(canTransitionDispute('pending', 'resolved')).toBe(false);
    expect(canTransitionDispute('open', 'pending')).toBe(false);
  });
});
