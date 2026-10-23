export const SUPPORT_TICKET_STATUSES = ['OPEN','IN_PROGRESS','WAITING_FOR_USER','RESOLVED','CLOSED'] as const;
export const SUPPORT_TICKET_CATEGORIES = ['ACCOUNT','ACCESS','WORKFLOW','BILLING','BUG','SECURITY','OTHER'] as const;
export const SUPPORT_TICKET_PRIORITIES = ['LOW','NORMAL','HIGH','URGENT'] as const;
export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number];
export type SupportActor = 'REQUESTER' | 'SUPPORT';

const ALLOWED: Record<SupportTicketStatus, readonly SupportTicketStatus[]> = {
  OPEN: ['IN_PROGRESS','WAITING_FOR_USER','RESOLVED','CLOSED'],
  IN_PROGRESS: ['WAITING_FOR_USER','RESOLVED','CLOSED'],
  WAITING_FOR_USER: ['IN_PROGRESS','RESOLVED','CLOSED'],
  RESOLVED: ['IN_PROGRESS','CLOSED'],
  CLOSED: ['IN_PROGRESS'],
};
export function isSupportTicketStatus(value: unknown): value is SupportTicketStatus {
  return typeof value === 'string' && (SUPPORT_TICKET_STATUSES as readonly string[]).includes(value);
}
export function canTransitionSupportTicket(from: unknown, to: unknown, actor: SupportActor): from is SupportTicketStatus {
  if (!isSupportTicketStatus(from) || !isSupportTicketStatus(to)) return false;
  if (from === 'CLOSED' && actor !== 'SUPPORT') return false;
  return ALLOWED[from].includes(to);
}
