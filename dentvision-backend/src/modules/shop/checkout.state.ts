/** Durable checkout state machine. */
export const CHECKOUT_STATES = ['pending','payment_processing','awaiting_payment','paid','payment_failed','payment_unknown','cancelled'] as const;
export type CheckoutState = (typeof CHECKOUT_STATES)[number];
const TRANSITIONS: Record<CheckoutState, readonly CheckoutState[]> = {
  pending: ['payment_processing','awaiting_payment','paid','cancelled'],
  payment_processing: ['awaiting_payment','paid','payment_failed','payment_unknown','cancelled'],
  awaiting_payment: ['paid','payment_failed','payment_unknown','cancelled'],
  paid: [],
  payment_failed: ['payment_processing','cancelled'],
  payment_unknown: ['payment_processing','paid','cancelled'],
  cancelled: [],
};
export function canTransitionCheckout(from: CheckoutState, to: CheckoutState): boolean { return TRANSITIONS[from].includes(to); }
export function assertCheckoutTransition(from: CheckoutState, to: CheckoutState): void { if (!canTransitionCheckout(from,to)) throw new Error(`CHECKOUT_INVALID_TRANSITION:${from}:${to}`); }
export function checkoutFailureState(reason: 'payment'|'external'|'internal'): CheckoutState { return reason === 'payment' ? 'payment_failed' : 'cancelled'; }
export function checkoutProviderOutcomeState(outcome: 'confirmed_failure'|'unknown'): CheckoutState { return outcome === 'confirmed_failure' ? 'payment_failed' : 'payment_unknown'; }
export function isTerminalCheckoutState(state: CheckoutState): boolean { return state === 'paid' || state === 'cancelled'; }
