export const FIELD_MAP = {
  clinics:      { camelToSnake: { createdAt: "created_at" } },
  users:        { camelToSnake: { clinicId: "clinic_id", spec: "spec", photoUrl: "photo_url", visibility: "visibility", experienceYears: "experience_years" } },
  patients:     { camelToSnake: { clinicId: "clinic_id" } },
  appointments: { camelToSnake: { clinicId: "clinic_id", patientId: "patient_id", doctorId: "doctor_id" } },
  treatments:   { camelToSnake: { clinicId: "clinic_id", patientId: "patient_id", doctorId: "doctor_id" } },
  receipts:     { camelToSnake: { clinicId: "clinic_id", patientId: "patient_id", doctorId: "doctor_id", payMethod: "pay_method" } },
  subscriptions:{ camelToSnake: { clinicId: "clinic_id", startDate: "start_date", endDate: "end_date", nextBilling: "next_billing" } },
  labOrders:    { camelToSnake: { clinicId: "clinic_id", patientId: "patient_id", doctorId: "doctor_id", dueDate: "due_date" } },
  photos:       { camelToSnake: { clinicId: "clinic_id", patientId: "patient_id", uploadDate: "upload_date" } },
  expenses:     { camelToSnake: { clinicId: "clinic_id", categoryId: "category_id", createdAt: "created_at" } },
  inventory:    { camelToSnake: { clinicId: "clinic_id", lastOrder: "last_order", minQuantity: "min_quantity", expiryDate: "expiry_date" } },
  promotions:   { camelToSnake: { clinicId: "clinic_id", discountPercent: "discount_percent", serviceIds: "service_ids", startDate: "start_date", endDate: "end_date", imageUrl: "image_url", createdAt: "created_at" } },
  bookings:     { camelToSnake: { clinicId: "clinic_id", patientName: "patient_name", doctorId: "doctor_id", serviceName: "service_name", createdAt: "created_at" } },
  medical_cards:{ camelToSnake: { clinicId: "clinic_id", patientId: "patient_id", bloodType: "blood_type", chronicDiseases: "chronic_diseases", pastSurgeries: "past_surgeries", familyHistory: "family_history", emergencyContact: "emergency_contact", emergencyPhone: "emergency_phone", insuranceProvider: "insurance_provider", insuranceNumber: "insurance_number", createdAt: "created_at", updatedAt: "updated_at" } },
  visits:       { camelToSnake: { clinicId: "clinic_id", patientId: "patient_id", doctorId: "doctor_id", appointmentId: "appointment_id", visitDate: "visit_date", chiefComplaint: "chief_complaint", icd10Codes: "icd10_codes", treatmentPlan: "treatment_plan", proceduresDone: "procedures_done", nextVisitDate: "next_visit_date", createdAt: "created_at" } },
  documents:    { camelToSnake: { clinicId: "clinic_id", patientId: "patient_id", doctorId: "doctor_id", docType: "doc_type", fileUrl: "file_url", createdAt: "created_at", updatedAt: "updated_at" } },
  audit_log:    { camelToSnake: { clinicId: "clinic_id", userId: "user_id", userName: "user_name", entityType: "entity_type", entityId: "entity_id", ipAddress: "ip_address", createdAt: "created_at" } },
} as const;

export function toSnakeRow(table: string, obj: Record<string, any>): Record<string, any> {
  const map = FIELD_MAP[table as keyof typeof FIELD_MAP]?.camelToSnake || {};
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) out[map[k as keyof typeof map] || k] = v;
  return out;
}

export function toCamelRow(table: string, obj: Record<string, any>): Record<string, any> {
  const map = FIELD_MAP[table as keyof typeof FIELD_MAP]?.camelToSnake || {};
  const reverse = Object.fromEntries(Object.entries(map).map(([a,b])=>[b,a]));
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj || {})) out[reverse[k] || k] = v;
  return out;
}

export const MEM_CACHE: Record<string, any> = {};
