export type SocketEvent =
  | 'appointment.created'
  | 'appointment.updated'
  | 'appointment.deleted'
  | 'patient.updated'
  | 'patient.deleted'
  | 'visit.updated'
  | 'medical_card.updated'
  | 'document.updated'
  | 'document.deleted'
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
  PATIENT_DELETED: 'patient.deleted',
  VISIT_UPDATED: 'visit.updated',
  MEDICAL_CARD_UPDATED: 'medical_card.updated',
  DOCUMENT_UPDATED: 'document.updated',
  DOCUMENT_DELETED: 'document.deleted',
  LAB_UPDATED: 'lab.updated',
  INVOICE_PAID: 'invoice.paid',
  INVENTORY_LOW: 'inventory.low',
  NOTIFICATION_NEW: 'notification.new',
  AI_ALERT: 'ai.alert',
} as const
