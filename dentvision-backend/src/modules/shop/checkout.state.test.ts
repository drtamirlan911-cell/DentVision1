import { describe, expect, it } from 'vitest';
import {
  assertCheckoutTransition,
  canTransitionCheckout,
  checkoutFailureState,
  checkoutProviderOutcomeState,
  isTerminalCheckoutState,
} from './checkout.state.js';

describe('checkout state machine', () => {
  it('allows the normal online-payment path', () => {
    expect(canTransitionCheckout('pending', 'payment_processing')).toBe(true);
    expect(canTransitionCheckout('payment_processing', 'awaiting_payment')).toBe(true);
    expect(canTransitionCheckout('awaiting_payment', 'paid')).toBe(true);
  });

  it('allows payment retry only from recoverable states', () => {
    expect(canTransitionCheckout('payment_failed', 'payment_processing')).toBe(true);
    expect(canTransitionCheckout('payment_unknown', 'payment_processing')).toBe(true);
    expect(canTransitionCheckout('paid', 'payment_processing')).toBe(false);
    expect(canTransitionCheckout('cancelled', 'payment_processing')).toBe(false);
  });

  it('models unknown provider outcomes as non-terminal', () => {
    expect(checkoutProviderOutcomeState('confirmed_failure')).toBe('payment_failed');
    expect(checkoutProviderOutcomeState('unknown')).toBe('payment_unknown');
    expect(isTerminalCheckoutState('payment_unknown')).toBe(false);
    expect(canTransitionCheckout('payment_unknown', 'paid')).toBe(true);
  });

  it('makes paid and cancelled terminal', () => {
    expect(isTerminalCheckoutState('paid')).toBe(true);
    expect(isTerminalCheckoutState('cancelled')).toBe(true);
    expect(canTransitionCheckout('paid', 'cancelled')).toBe(false);
    expect(canTransitionCheckout('cancelled', 'paid')).toBe(false);
  });

  it('rejects backward or otherwise unsafe transitions', () => {
    expect(() => assertCheckoutTransition('awaiting_payment', 'pending')).toThrow(
      'CHECKOUT_INVALID_TRANSITION:awaiting_payment:pending',
    );
    expect(() => assertCheckoutTransition('paid', 'pending')).toThrow(
      'CHECKOUT_INVALID_TRANSITION:paid:pending',
    );
  });

  it('maps external/payment failures to recoverable states', () => {
    expect(checkoutFailureState('payment')).toBe('payment_failed');
    expect(checkoutFailureState('external')).toBe('cancelled');
    expect(checkoutFailureState('internal')).toBe('cancelled');
  });
});
