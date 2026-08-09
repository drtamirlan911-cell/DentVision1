/**
 * Order status state machine.
 *
 * `orders.status` is stored as TEXT; this module is the single source of truth
 * for which transitions are legal so callers cannot jump between arbitrary
 * states (audit F-2). Every writer of `orders.status` should go through
 * `canTransitionOrder`.
 */
export const ORDER_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  pending: ['awaiting_payment', 'paid', 'cancelled'],
  awaiting_payment: ['paid', 'cancelled'],
  paid: ['packing', 'shipped', 'delivered', 'cancelled'],
  packing: ['shipped', 'delivered', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

/**
 * True when `to` is a legal successor of `from`. A missing/unknown `from`
 * (fresh order or legacy data) only permits nothing until a known base state.
 */
export function canTransitionOrder(from: string | null | undefined, to: string): boolean {
  if (!from) return false;
  const allowed = ORDER_STATUS_TRANSITIONS[from];
  return !!allowed && allowed.includes(to);
}
