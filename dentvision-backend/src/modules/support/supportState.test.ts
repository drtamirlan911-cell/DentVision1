import { describe, expect, it } from 'vitest';
import { canTransitionSupportTicket, isSupportTicketStatus, SUPPORT_TICKET_CATEGORIES, SUPPORT_TICKET_PRIORITIES, SUPPORT_TICKET_STATUSES } from './supportState.js';

describe('ecosystem support state machine', () => {
  it('uses a finite, stable status/category/priority vocabulary', () => {
    expect(SUPPORT_TICKET_STATUSES).toEqual(['OPEN','IN_PROGRESS','WAITING_FOR_USER','RESOLVED','CLOSED']);
    expect(SUPPORT_TICKET_CATEGORIES).toContain('SECURITY');
    expect(SUPPORT_TICKET_CATEGORIES).toContain('BILLING');
    expect(SUPPORT_TICKET_PRIORITIES).toEqual(['LOW','NORMAL','HIGH','URGENT']);
  });
  it('allows supported forward transitions and requester replies that reopen resolved work', () => {
    expect(canTransitionSupportTicket('OPEN','IN_PROGRESS','SUPPORT')).toBe(true);
    expect(canTransitionSupportTicket('OPEN','WAITING_FOR_USER','SUPPORT')).toBe(true);
    expect(canTransitionSupportTicket('IN_PROGRESS','RESOLVED','SUPPORT')).toBe(true);
    expect(canTransitionSupportTicket('WAITING_FOR_USER','IN_PROGRESS','REQUESTER')).toBe(true);
    expect(canTransitionSupportTicket('RESOLVED','IN_PROGRESS','REQUESTER')).toBe(true);
    expect(canTransitionSupportTicket('RESOLVED','CLOSED','SUPPORT')).toBe(true);
  });
  it('only permits support staff to reopen a closed ticket', () => {
    expect(canTransitionSupportTicket('CLOSED','IN_PROGRESS','REQUESTER')).toBe(false);
    expect(canTransitionSupportTicket('CLOSED','IN_PROGRESS','SUPPORT')).toBe(true);
  });
  it('fails closed for unknown values, no-op and invalid transitions', () => {
    expect(isSupportTicketStatus('OPEN')).toBe(true);
    expect(isSupportTicketStatus('pending')).toBe(false);
    expect(isSupportTicketStatus(null)).toBe(false);
    expect(canTransitionSupportTicket('OPEN','OPEN','SUPPORT')).toBe(false);
    expect(canTransitionSupportTicket('RESOLVED','WAITING_FOR_USER','SUPPORT')).toBe(false);
    expect(canTransitionSupportTicket('CLOSED','RESOLVED','SUPPORT')).toBe(false);
    expect(canTransitionSupportTicket('bad','OPEN','SUPPORT')).toBe(false);
  });
});
