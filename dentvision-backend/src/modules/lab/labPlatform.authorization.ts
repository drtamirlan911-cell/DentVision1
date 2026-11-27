const LAB_MANAGER_ROLES = new Set(['owner', 'admin', 'manager', 'director', 'lab_manager']);
const LAB_TECHNICIAN_ROLES = new Set(['technician', 'dental_technician', 'lab_technician', 'cad_designer', 'ceramist', 'orthodontic_technician']);
const LAB_LOGISTICS_ROLES = new Set(['courier', 'logistics', 'delivery_operator', 'dispatcher']);
const LAB_FINANCE_ROLES = new Set(['lab_finance', 'finance', 'accountant']);
const LAB_COORDINATOR_ROLES = new Set(['lab_coordinator']);
const LAB_QUALITY_ROLES = new Set(['qc_specialist']);
const COORDINATOR_STATUS_SET = new Set(['in_progress', 'delayed']);
const TECHNICIAN_PROGRESS_STATUSES = new Set(['in_progress', 'try_in', 'adjustment', 'qc', 'delayed']);
export const LAB_QC_CHECK_KEYS = ['fit', 'margins', 'shade', 'occlusion', 'surface', 'documentation'] as const;

export function isLabManagerRole(role: unknown): boolean {
  return LAB_MANAGER_ROLES.has(String(role || '').trim().toLowerCase());
}

export function isLabTechnicianRole(role: unknown): boolean {
  return LAB_TECHNICIAN_ROLES.has(String(role || '').trim().toLowerCase());
}

export function isLabLogisticsRole(role: unknown): boolean {
  return LAB_LOGISTICS_ROLES.has(String(role || '').trim().toLowerCase());
}

export function isLabCoordinatorRole(role: unknown): boolean {
  return LAB_COORDINATOR_ROLES.has(String(role || '').trim().toLowerCase());
}

export function isLabQualityRole(role: unknown): boolean {
  return LAB_QUALITY_ROLES.has(String(role || '').trim().toLowerCase());
}

/** Delivery staff may record dispatch and proof-of-delivery, but cannot manage QC or pricing. */
export function canLabManageShipment(role: unknown): boolean {
  const normalized = String(role || '').trim().toLowerCase();
  return LAB_MANAGER_ROLES.has(normalized) || LAB_LOGISTICS_ROLES.has(normalized);
}

/** Finance is isolated from production; only managers and assigned finance roles can view/request payouts. */
export function canLabManageFinance(role: unknown): boolean {
  const normalized = String(role || '').trim().toLowerCase();
  return LAB_MANAGER_ROLES.has(normalized) || LAB_FINANCE_ROLES.has(normalized);
}

/** Managers read the organization queue; production roles read assigned work only. */
export function canLabMemberReadOrders(role: unknown): boolean {
  return isLabManagerRole(role)
    || isLabCoordinatorRole(role)
    || isLabQualityRole(role)
    || isLabTechnicianRole(role)
    || isLabLogisticsRole(role);
}

/** A technician's order queries include both the lab and assigned-user scope. */
export function labMemberOrderReadScope(input: { role: unknown; userId: string; labId: string; branchIds?: readonly string[] }): Record<string, unknown> | null {
  const labOrder = { path: ['meta', 'laboratoryId'], equals: input.labId };
  if (isLabManagerRole(input.role) || isLabQualityRole(input.role)) return { files: labOrder };
  if (isLabCoordinatorRole(input.role)) {
    const branchIds = (input.branchIds || []).filter(Boolean);
    if (branchIds.length === 0) return null;
    return {
      AND: [
        { files: labOrder },
        { patient: { branchId: { in: [...branchIds] } } },
      ],
    };
  }
  if (isLabTechnicianRole(input.role) && input.userId) {
    return {
      AND: [
        { files: labOrder },
        { files: { path: ['meta', 'technicianId'], equals: input.userId } },
      ],
    };
  }
  return null;
}

export function canLabMemberChangeStatus(input: { role: unknown; userId: string; assignedTechnicianId?: string | null; nextStatus: string }): boolean {
  if (isLabManagerRole(input.role)) return true;
  const role = String(input.role || '').trim().toLowerCase();
  if (LAB_COORDINATOR_ROLES.has(role)) return COORDINATOR_STATUS_SET.has(input.nextStatus);
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


export function validateLabRemakeRequestReason(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const reason = value.trim();
  return reason.length >= 5 && reason.length <= 2000 ? reason : null;
}

export function validateLabRemakeDecision(
  decisionValue: unknown,
  noteValue: unknown,
): { decision: 'accept' | 'reject'; note: string | null } | null {
  const decision = String(decisionValue || '').trim().toLowerCase();
  if (decision !== 'accept' && decision !== 'reject') return null;
  const note = typeof noteValue === 'string' ? noteValue.trim() : '';
  if (note.length > 2000 || (decision === 'reject' && note.length < 5)) return null;
  return { decision, note: note || null };
}