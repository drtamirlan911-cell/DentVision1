export type SocketEvent =
  | 'appointment.created'
  | 'appointment.updated'
  | 'appointment.deleted'
  | 'patient.updated'
  | 'lab.updated'
  | 'invoice.paid'
  | 'inventory.low'
  | 'notification.new'
  | 'ai.alert'

export interface SocketMessage {
  event: SocketEvent
  data: any
  timestamp: string
}

export const SOCKET_EVENTS = {
  APPOINTMENT_CREATED: 'appointment.created',
  APPOINTMENT_UPDATED: 'appointment.updated',
  APPOINTMENT_DELETED: 'appointment.deleted',
  PATIENT_UPDATED: 'patient.updated',
  LAB_UPDATED: 'lab.updated',
  INVOICE_PAID: 'invoice.paid',
  INVENTORY_LOW: 'inventory.low',
  NOTIFICATION_NEW: 'notification.new',
  AI_ALERT: 'ai.alert',
} as const
