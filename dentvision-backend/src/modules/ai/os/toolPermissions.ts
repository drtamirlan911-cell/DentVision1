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
];

/**
 * Action ladder used when matching a required permission against a granted set.
 *
 * The role matrix does not imply lower actions from higher ones — OWNER holds
 * `shop.manage` but not `shop.read` — so an exact-key check would deny owners
 * their own data. Widening is one-directional and stays inside this module:
 * `rbac.requirePermission` keeps its exact-match semantics.
 */
const ACTION_SATISFIED_BY: Record<string, string[]> = {
  read: ['read', 'write', 'delete', 'manage'],
  write: ['write', 'delete', 'manage'],
  delete: ['delete', 'manage'],
  manage: ['manage'],
};

/** Does a resolved permission set satisfy the key a tool requires? */
export function permissionsSatisfy(granted: Set<string>, required: string): boolean {
  if (granted.has('*')) return true;
  if (granted.has(required)) return true;

  const [mod, action] = required.split('.');
  if (!mod || !action) return false;

  return (ACTION_SATISFIED_BY[action] || [action]).some((a) => granted.has(`${mod}.${a}`));
}
