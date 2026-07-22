// ═══════════════════════════════════════════════════════════════════
// SHARED TYPE DEFINITIONS — DentVision SuperApp
// ═══════════════════════════════════════════════════════════════════

// ─── Auth & Users ───────────────────────────────────────────────

export type UserRole = 'superadmin' | 'director' | 'admin' | 'doctor' | 'assistant'

export interface User {
  id: string
  clinicId?: string
  login: string
  role: UserRole
  name: string
  phone?: string
  email?: string
  spec?: string
  photoUrl?: string
  avatar?: string
  visibility?: 'public' | 'private'
  experienceYears?: number
  salary?: number
  paid?: number
  password?: string
  createdAt?: string
}

export interface RoleInfo {
  canSeeSuperAdmin?: boolean
  canSeeSettings?: boolean
  canSeeAI?: boolean
  canSeeAnalytics?: boolean
  canSeeAdmin?: boolean
  canSeeAudit?: boolean
  canSeeBackup?: boolean
  canSeeShop?: boolean
  canSeeSchool?: boolean
  canManageStaff?: boolean
  canManageFinance?: boolean
  canManageClinicSettings?: boolean
  canAddStaff?: boolean
  ownDataOnly?: boolean
  readOnly?: boolean
  pages?: string[]
}

// ─── Clinic ─────────────────────────────────────────────────────

export interface Clinic {
  id: string
  name: string
  city?: string
  address?: string
  phone?: string
  logo?: string
  plan?: string
  active?: boolean
  createdAt?: string
  color?: string
  country?: string
  currency?: string
  locale?: string
  settings?: ClinicSettings
}

export interface ClinicSettings {
  timezone?: string
  currency?: string
  locale?: string
  workStart?: string
  workEnd?: string
  workDays?: number[]
  lunchStart?: string
  lunchEnd?: string
  reminderHours?: number
  reminderUrgentHours?: number
  hygieneMonths?: number
  bookingSlotMinutes?: number
  overbookingAllowed?: boolean
  whatsappEnabled?: boolean
  smsEnabled?: boolean
  defaultAppointmentDuration?: number
  invoicePrefix?: string
  taxPercent?: number
  notifyNoShow?: boolean
  requireChair?: boolean
  autoDeductItems?: string
  bookingLink?: string
  onlineBookingEnabled?: boolean
  /** Per-clinic Kaspi for CRM cashier (not platform). */
  payments?: {
    mode?: 'unconfigured' | 'static' | 'api'
    merchantName?: string
    kaspiPhone?: string
    staticQrUrl?: string
    apiBaseUrl?: string
    apiKey?: string
    webhookSecret?: string
    configured?: boolean
    apiKeySet?: boolean
    webhookSecretSet?: boolean
    webhookUrl?: string
  }
}

// ─── Patients ───────────────────────────────────────────────────

export interface Patient {
  id: string
  clinicId?: string
  name: string
  dob?: string
  phone?: string
  email?: string
  address?: string
  gender?: string
  notes?: string
  prepaidBalance?: number
  category?: 'new' | 'regular' | 'vip' | 'debt'
  teeth?: Record<number, string>
  createdAt?: string
}

// ─── Appointments ───────────────────────────────────────────────

export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'arrived'
  | 'in_chair'
  | 'reminderSent'
  | 'done'
  | 'cancelled'
  | 'noShow'

export interface Appointment {
  id: string
  clinicId?: string
  patientId: string
  doctorId: string
  date: string
  time: string
  duration?: number
  reason?: string
  service?: string
  serviceId?: string
  serviceName?: string
  servicePrice?: number
  status: AppointmentStatus
  notes?: string
  diagnosis?: string
  toothNumber?: string | number
  paymentStatus?: 'unpaid' | 'paid' | 'partial'
  receiptId?: string
  chairId?: string
  chairName?: string
  createdAt?: string
}

export interface Chair {
  id: string
  clinicId: string
  name: string
  sortOrder?: number
  active?: boolean
}

// ─── Receipts / Payments ────────────────────────────────────────

export type ReceiptStatus = 'paid' | 'partial' | 'debt' | 'completed'

export interface ReceiptItem {
  serviceId?: string
  name: string
  price: number
  qty: number
}

export interface Receipt {
  id: string
  clinicId?: string
  patientId?: string
  patientName?: string
  doctorId?: string
  date: string
  status: ReceiptStatus
  total: number
  amount?: number
  payMethod?: string
  paymentType?: string
  notes?: string
  service?: string
  appointmentId?: string
  diagnosis?: string
  toothNumber?: string | number
  items?: ReceiptItem[]
  discount?: number
  createdAt?: string
}

// ─── Expenses ───────────────────────────────────────────────────

export interface Expense {
  id: string
  clinicId?: string
  category: string
  amount: number
  notes?: string
  date?: string
  categoryId?: string
  createdAt?: string
}

// ─── Inventory ──────────────────────────────────────────────────

export interface InventoryItem {
  id: string
  clinicId?: string
  name: string
  quantity: number
  unit: string
  min: number
  lastOrder?: string
  minQuantity?: number
  expiryDate?: string
  category?: string
  supplier?: string
  cost?: number
}

// ─── Lab Orders ─────────────────────────────────────────────────

export type LabOrderStatus = 'pending' | 'inProgress' | 'ready' | 'delivered'

export interface LabOrder {
  id: string
  clinicId?: string
  patientId?: string
  doctorId?: string
  type?: string
  description?: string
  dueDate?: string
  status: LabOrderStatus
  notes?: string
  createdAt?: string
}

// ─── Medical Cards ──────────────────────────────────────────────

export interface MedicalCard {
  id: string
  clinicId?: string
  patientId: string
  bloodType?: string
  chronicDiseases?: string
  pastSurgeries?: string
  familyHistory?: string
  allergies?: string
  emergencyContact?: string
  emergencyPhone?: string
  insuranceProvider?: string
  insuranceNumber?: string
  notes?: string
  createdAt?: string
  updatedAt?: string
}

// ─── Visits ─────────────────────────────────────────────────────

export interface Visit {
  id: string
  clinicId?: string
  patientId: string
  doctorId?: string
  appointmentId?: string
  visitDate?: string
  chiefComplaint?: string
  icd10Codes?: string
  treatmentPlan?: string
  proceduresDone?: string
  nextVisitDate?: string
  notes?: string
  createdAt?: string
}

// ─── Documents ──────────────────────────────────────────────────

export type DocumentStatus = 'draft' | 'active' | 'archived'

export interface Document {
  id: string
  clinicId?: string
  patientId?: string
  doctorId?: string
  docType?: string
  title?: string
  content?: string
  fileUrl?: string
  status?: DocumentStatus
  signed?: boolean
  signedAt?: string
  createdAt?: string
  updatedAt?: string
}

// ─── Promotions ─────────────────────────────────────────────────

export type PromotionStatus = 'active' | 'inactive' | 'expired'

export interface Promotion {
  id: string
  clinicId?: string
  title: string
  description?: string
  discountPercent?: number
  serviceIds?: string[]
  startDate?: string
  endDate?: string
  imageUrl?: string
  status?: PromotionStatus
  createdAt?: string
}

// ─── Bookings ───────────────────────────────────────────────────

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'

export interface Booking {
  id: string
  clinicId?: string
  patientName?: string
  patientPhone?: string
  phone?: string
  patientEmail?: string
  email?: string
  doctorId?: string
  doctorName?: string
  serviceName?: string
  date?: string
  time?: string
  notes?: string
  status?: BookingStatus
  source?: string
  createdAt?: string
}

// ─── Photos ─────────────────────────────────────────────────────

export interface Photo {
  id: string
  clinicId?: string
  patientId?: string
  url?: string
  category?: string
  caption?: string
  uploadDate?: string
}

// ─── Subscriptions ──────────────────────────────────────────────

export interface Subscription {
  id: string
  clinicId?: string
  plan?: string
  startDate?: string
  endDate?: string
  nextBilling?: string
  active?: boolean
}

// ─── Waiting List ───────────────────────────────────────────────

export interface WaitingListItem {
  id: string
  clinicId?: string
  patientId?: string
  patientName?: string
  patientPhone?: string
  doctorId?: string
  doctorName?: string
  preferredDate?: string
  preferredTime?: string
  preferredService?: string
  notes?: string
  status?: 'waiting' | 'done' | 'cancelled'
}

// ─── Audit Log ──────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string
  clinicId?: string
  userId?: string
  userName?: string
  action?: string
  entityType?: string
  entityId?: string
  details?: string
  ipAddress?: string
  createdAt?: string
}

// ─── ICD-10 ─────────────────────────────────────────────────────

export interface ICD10Code {
  code: string
  name: string
  category?: string
  description?: string
}

// ─── Notifications (unified Notification Center) ────────────────

export type NotificationType = 'shop' | 'school' | 'clinic' | 'system'
export type NotificationCategory =
  | 'order' | 'promo' | 'course' | 'enrollment'
  | 'appointment' | 'payment' | 'system' | string

export interface AppNotification {
  id: string
  type: NotificationType
  category?: NotificationCategory | null
  clinicId?: string | null
  userId?: string | null
  title: string
  message?: string | null
  actionUrl?: string | null
  read: boolean
  createdAt: string
}

// ─── Services (Price List) ──────────────────────────────────────

export interface Service {
  id: string
  cat: string
  name: string
  price: number
}

// ─── Toast ──────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  msg: string
  type: ToastType
}

// ─── Data Store Shape ───────────────────────────────────────────

export interface DataStore {
  patients: Patient[]
  appointments: Appointment[]
  receipts: Receipt[]
  labOrders: LabOrder[]
  expenses: Expense[]
  inventory: InventoryItem[]
  treatments: any[]
  users: User[]
  subscriptions: Subscription[]
  photos: Photo[]
  promotions: Promotion[]
  bookings: Booking[]
  medicalCards: MedicalCard[]
  visits: Visit[]
  documents: Document[]
  waitingList: WaitingListItem[]
  loadedClinics: Set<string>
  listeners: Set<() => void>
}

// ─── API Response Types ─────────────────────────────────────────

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface LoginResponse {
  user: User
  clinic?: Clinic
  tokens: AuthTokens
  roleInfo?: RoleInfo
}
