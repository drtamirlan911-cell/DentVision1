export const DISPUTE_STATUSES = ['open', 'review', 'resolved', 'rejected'] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export const ALLOWED_DISPUTE_TRANSITIONS: Record<DisputeStatus, readonly DisputeStatus[]> = {
  open: ['review', 'resolved', 'rejected'],
  review: ['resolved', 'rejected'],
  resolved: [],
  rejected: [],
};

export function isDisputeStatus(value: unknown): value is DisputeStatus {
  return typeof value === 'string' && (DISPUTE_STATUSES as readonly string[]).includes(value);
}

export function canTransitionDispute(from: unknown, to: unknown): from is DisputeStatus {
  return isDisputeStatus(from) && isDisputeStatus(to) && ALLOWED_DISPUTE_TRANSITIONS[from].includes(to);
}
