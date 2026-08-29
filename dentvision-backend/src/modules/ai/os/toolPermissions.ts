/**
 * Tool → permission mapping for the AI OS.
 *
 * Until now the AI tool surface was gated *only* by the agent registry
 * (`toolsForRole`), which reads a raw role string and knows nothing about the
 * unified IAM model — a sixth, independent authorization system that could
 * grant through the assistant what the REST routes deny. This map binds every
 * clinic-data tool to the same permission key its REST counterpart requires
 * (`middleware/rbac.ts` → `lib/permissions.ts`), so the assistant can never be
 * a wider door than the UI.
 *
 * Tools that read platform catalogs rather than tenant data (marketplace,
 * academy, navigation, pure LLM drafting) carry no permission requirement —
 * they expose nothing that belongs to a clinic. They remain gated by the agent
 * registry.
 */

/** Permission required to call each tool. Absent = no tenant data involved. */
export const TOOL_PERMISSIONS: Record<string, string> = {
  // Patients — contact/registry data.
  searchPatients: 'patients.read',
  getClinicLoadPlan: 'patients.read',
  getRecallList: 'patients.read',

  // Medical — PHI (anamnesis, diagnoses, odontogram, treatment plans).
  getPatientCard: 'medical.read',
  analyzeRadiograph: 'medical.read',
  applyToothFindings: 'medical.write',
  getVisits: 'medical.read',
  getTreatmentPlans: 'medical.read',
  createTreatmentPlan: 'medical.write',

  // Schedule.
  getSchedule: 'appointments.read',
  createAppointment: 'appointments.write',
  updateAppointmentStatus: 'appointments.write',
  cancelAppointment: 'appointments.write',
  rescheduleAppointment: 'appointments.write',

  // Money.
  getRevenue: 'billing.read',
  getDebtors: 'billing.read',
  createInvoice: 'billing.write',

  // Reporting.
  getDashboardStats: 'analytics.read',
  getDoctorUtilization: 'analytics.read',
  composeCeoBrief: 'analytics.read',

  // Operations.
  getInventory: 'inventory.read',
  getLabOrders: 'lab.read',
  getPromotions: 'shop.read',

  // Lab orders — mirrors `lab.routes.ts`, whose write routes are gated by
  // `appointment.write` (not a lab-specific key; the REST route was never
  // given one, and this map cannot grant wider than that route does).
  createLabOrder: 'appointment.write',
  updateLabOrderStatus: 'appointment.write',
};

/**
 * Tools deliberately exempt from the permission gate. Listed explicitly (rather
 * than "anything missing from the map") so a newly added tool that touches
 * clinic data cannot slip through the gate by omission — `toolPermissions.test.ts`
 * asserts that every registered tool appears in one of the two lists.
 */
export const UNGATED_TOOLS: readonly string[] = [
  'navigate', // UI navigation only
  'searchProducts', // marketplace catalog (platform-wide)
  'searchCourses', // academy catalog (platform-wide)
  'draftPromoCopy', // pure LLM text drafting, reads nothing
  // `diagnostics.routes.ts`'s POST /referrals checks clinic membership
  // (`assertOrgAccess`) and nothing more specific — no permission key to
  // mirror here without granting narrower than the REST route itself does.
  'createDiagnosticReferral',
];

// The action ladder lives in lib/permissions.ts — the AI intent router needs
// the same semantics, and one copy is the point of this whole phase.
export { permissionsSatisfy } from '../../../lib/permissions.js';
