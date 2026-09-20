import { describe, expect, it } from 'vitest';
import { isDentalLabTransitionAllowed, DENTAL_LAB_TRANSITIONS } from './lab.routes.js';

describe('dental laboratory lifecycle', () => {
  it('permits the canonical production path to delivered', () => {
    expect(isDentalLabTransitionAllowed('pending', 'sent')).toBe(true);
    expect(isDentalLabTransitionAllowed('sent', 'in_progress')).toBe(true);
    expect(isDentalLabTransitionAllowed('in_progress', 'try_in')).toBe(true);
    expect(isDentalLabTransitionAllowed('try_in', 'adjustment')).toBe(true);
    expect(isDentalLabTransitionAllowed('adjustment', 'ready')).toBe(true);
    expect(isDentalLabTransitionAllowed('ready', 'delivered')).toBe(true);
  });

  it('allows remake without treating remake as delivery', () => {
    expect(isDentalLabTransitionAllowed('ready', 'remake')).toBe(true);
    expect(isDentalLabTransitionAllowed('delivered', 'remake')).toBe(true);
    expect(isDentalLabTransitionAllowed('remake', 'in_progress')).toBe(true);
    expect(isDentalLabTransitionAllowed('pending', 'delivered')).toBe(false);
  });

  it('does not allow terminal cancellation to resume', () => {
    expect(DENTAL_LAB_TRANSITIONS.cancelled).toEqual([]);
    expect(isDentalLabTransitionAllowed('cancelled', 'in_progress')).toBe(false);
  });

  it('keeps delayed orders resumable but not delivered directly', () => {
    expect(isDentalLabTransitionAllowed('delayed', 'in_progress')).toBe(true);
    expect(isDentalLabTransitionAllowed('delayed', 'delivered')).toBe(false);
  });

  it('keeps status updates idempotent', () => {
    expect(isDentalLabTransitionAllowed('delivered', 'delivered')).toBe(true);
  });
});
