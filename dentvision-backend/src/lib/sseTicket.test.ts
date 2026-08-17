import { describe, expect, it, vi, beforeEach } from 'vitest';
import { issueSseTicket, consumeSseTicket } from './sseTicket.js';

describe('sseTicket', () => {
  it('round-trips a freshly issued ticket', () => {
    const ticket = issueSseTicket('user-1', 'patient-conversation');
    expect(consumeSseTicket(ticket, 'patient-conversation')).toBe('user-1');
  });

  it('cannot be redeemed twice — the whole point of a one-time ticket', () => {
    const ticket = issueSseTicket('user-1', 'patient-conversation');
    expect(consumeSseTicket(ticket, 'patient-conversation')).toBe('user-1');
    expect(consumeSseTicket(ticket, 'patient-conversation')).toBeNull();
  });

  it('rejects a ticket redeemed against the wrong scope', () => {
    const ticket = issueSseTicket('user-1', 'patient-conversation');
    expect(consumeSseTicket(ticket, 'clinic-inbox')).toBeNull();
    // the mismatch attempt does not consume it — the *right* scope still works
    expect(consumeSseTicket(ticket, 'patient-conversation')).toBe('user-1');
  });

  it('rejects garbage input', () => {
    expect(consumeSseTicket('not-a-jwt', 'patient-conversation')).toBeNull();
    expect(consumeSseTicket('', 'patient-conversation')).toBeNull();
  });

  it('tickets for different users are independent', () => {
    const a = issueSseTicket('user-a', 'clinic-inbox');
    const b = issueSseTicket('user-b', 'clinic-inbox');
    expect(consumeSseTicket(a, 'clinic-inbox')).toBe('user-a');
    expect(consumeSseTicket(b, 'clinic-inbox')).toBe('user-b');
  });

  it('expires after its TTL', () => {
    vi.useFakeTimers();
    try {
      const ticket = issueSseTicket('user-1', 'ai-notifications');
      vi.advanceTimersByTime(46_000); // > 45s TTL
      expect(consumeSseTicket(ticket, 'ai-notifications')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
