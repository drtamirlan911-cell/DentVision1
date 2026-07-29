// ─── Event Types ───
// All CRM events that can be published to the Event Bus

export enum EventType {
  // Patients
  PatientCreated = 'PatientCreated',
  PatientUpdated = 'PatientUpdated',
  PatientDeleted = 'PatientDeleted',

  // Appointments
  AppointmentBooked = 'AppointmentBooked',
  AppointmentCancelled = 'AppointmentCancelled',
  AppointmentCompleted = 'AppointmentCompleted',
  PatientArrived = 'PatientArrived',
  PatientNoShow = 'PatientNoShow',

  // Medical
  ComplaintUpdated = 'ComplaintUpdated',
  XrayUploaded = 'XrayUploaded',
  DiagnosisSaved = 'DiagnosisSaved',
  TreatmentCompleted = 'TreatmentCompleted',

  // Billing
  InvoiceCreated = 'InvoiceCreated',
  PaymentReceived = 'PaymentReceived',
  PaymentOverdue = 'PaymentOverdue',

  // Inventory
  InventoryLow = 'InventoryLow',
  InventoryOrdered = 'InventoryOrdered',

  // Lab
  LabOrderCreated = 'LabOrderCreated',
  LabOrderCompleted = 'LabOrderCompleted',

  // AI
  AIActionCompleted = 'AIActionCompleted',
  AICriticalEvent = 'AICriticalEvent',

  // Cron
  DailySummary = 'DailySummary',
  FollowUpDue = 'FollowUpDue',
  AppointmentReminder = 'AppointmentReminder',
}

// ─── Event Payloads ───

export interface PatientCreatedPayload {
  patientId: string;
  firstName: string;
  lastName: string;
  complaints?: string[];
  appointmentTime?: string;
}

export interface AppointmentBookedPayload {
  appointmentId: string;
  patientId: string;
  doctorId: string;
  date: string;
  time: string;
  type?: string;
}

export interface DiagnosisSavedPayload {
  patientId: string;
  appointmentId?: string;
  diagnosis: string;
  diagnosisCode?: string;
  requiresImplant?: boolean;
  requiresSurgery?: boolean;
}

export interface TreatmentCompletedPayload {
  patientId: string;
  appointmentId: string;
  doctorId: string;
  treatments: string[];
  diagnosis: string;
}

export interface XrayUploadedPayload {
  patientId: string;
  imageUrl: string;
  imageType: 'PHOTO' | 'X_RAY' | 'CBCT' | 'DICOM' | 'SCAN';
}

export interface InventoryLowPayload {
  itemId: string;
  itemName: string;
  currentQuantity: number;
  minimumQuantity: number;
}

export interface PaymentReceivedPayload {
  invoiceId: string;
  patientId: string;
  amount: number;
  currency: string;
}

export interface FollowUpDuePayload {
  patientId: string;
  appointmentId: string;
  doctorId: string;
  treatmentDate: string;
  followUpType: '48h' | '1week' | '1month';
}

// ─── Event Interface ───

export interface CRMEvent {
  id: string;
  type: EventType;
  timestamp: Date;
  source: string;
  clinicId: string;
  userId: string;
  payload: Record<string, unknown>;
  metadata?: {
    ip?: string;
    userAgent?: string;
  };
}

// ─── Subscriber ───

export type EventSubscriber = (event: CRMEvent) => Promise<void>;

// ─── Event Bus Interface ───

export interface IEventBus {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  publish(type: EventType, payload: Record<string, unknown>, context: EventContext): Promise<string>;
  subscribe(type: EventType | '*', handler: EventSubscriber): () => void;
  getStats(): EventStats;
}

export interface EventContext {
  clinicId: string;
  userId: string;
  source: string;
  ip?: string;
  userAgent?: string;
}

export interface EventStats {
  connected: boolean;
  mode: 'redis' | 'memory';
  published: number;
  processed: number;
  failed: number;
  subscribers: number;
}
