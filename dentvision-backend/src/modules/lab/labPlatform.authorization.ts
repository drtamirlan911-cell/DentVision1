const LAB_MANAGER_ROLES = new Set(['owner', 'admin', 'manager', 'director', 'lab_manager']);
const LAB_TECHNICIAN_ROLES = new Set(['technician', 'dental_technician', 'lab_technician']);
const TECHNICIAN_PROGRESS_STATUSES = new Set(['in_progress', 'try_in', 'adjustment', 'qc', 'delayed']);
export const LAB_QC_CHECK_KEYS = ['fit', 'margins', 'shade', 'occlusion', 'surface', 'documentation'] as const;

export function isLabManagerRole(role: unknown): boolean {
  return LAB_MANAGER_ROLES.has(String(role || '').trim().toLowerCase());
}

export function canLabMemberChangeStatus(input: { role: unknown; userId: string; assignedTechnicianId?: string | null; nextStatus: string }): boolean {
  if (isLabManagerRole(input.role)) return true;
  const role = String(input.role || '').trim().toLowerCase();
  return LAB_TECHNICIAN_ROLES.has(role) && Boolean(input.userId) && input.assignedTechnicianId === input.userId && TECHNICIAN_PROGRESS_STATUSES.has(input.nextStatus);
}

export function validateLabQualityControl(checksValue: unknown, noteValue: unknown): { checks: Record<string, boolean>; passed: boolean; note: string | null } | null {
  if (!checksValue || typeof checksValue !== 'object' || Array.isArray(checksValue)) return null;
  const raw = checksValue as Record<string, unknown>;
  if (Object.keys(raw).length !== LAB_QC_CHECK_KEYS.length) return null;
  if (!LAB_QC_CHECK_KEYS.every((key) => typeof raw[key] === 'boolean')) return null;
  const checks = Object.fromEntries(LAB_QC_CHECK_KEYS.map((key) => [key, raw[key] as boolean]));
  const passed = LAB_QC_CHECK_KEYS.every((key) => checks[key]);
  const note = typeof noteValue === 'string' ? noteValue.trim().slice(0, 2000) : '';
  if (!passed && !note) return null;
  return { checks, passed, note: note || null };
}
