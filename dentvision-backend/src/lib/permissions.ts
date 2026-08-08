/**
 * Unified IAM permission model — single source of truth for all access control.
 *
 * Architecture (GitHub/Notion-style RBAC):
 *   Module × Action  →  PermissionKey (e.g. "patients.read")
 *   Role  →  Module:Action[]  →  resolved PermissionKey[]
 *
 * One matrix governs both backend middleware AND frontend page visibility.
 * SUPERADMIN is a wildcard — handled in roleHasPermission().
 */

// ─── Modules ───
type Module =
  | 'patients' | 'appointments' | 'medical' | 'billing' | 'inventory'
  | 'lab' | 'staff' | 'settings' | 'analytics' | 'diagnostics'
  | 'academy' | 'shop' | 'community' | 'audit' | 'admin' | 'bi';

// ─── Actions ───
type Action = 'read' | 'write' | 'delete' | 'manage';
// manage = full admin (settings, billing actions, staff management)

// ─── Role → Module permissions ───
type RoleMatrixRow = Partial<Record<Module, Action[]>> & { '*'?: ['*'] };

const MATRIX: Record<string, RoleMatrixRow> = {
  SUPERADMIN: { '*': ['*'] },

  OWNER: {
    patients:     ['read', 'write', 'delete'],
    appointments: ['read', 'write', 'delete'],
    medical:      ['read', 'write', 'delete'],
    billing:      ['read', 'write', 'delete', 'manage'],
    inventory:    ['read', 'write', 'delete'],
    lab:          ['read', 'write', 'delete'],
    staff:        ['read', 'write', 'delete', 'manage'],
    settings:     ['manage'],
    analytics:    ['read'],
    diagnostics:  ['read', 'write'],
    academy:      ['manage'],
    shop:         ['manage'],
    community:    ['read', 'write'],
    audit:        ['read'],
    bi:           ['read'],
  },

  ADMIN: {
    patients:     ['read', 'write', 'delete'],
    appointments: ['read', 'write', 'delete'],
    medical:      ['read', 'write'],
    billing:      ['read', 'write', 'manage'],
    inventory:    ['read', 'write'],
    lab:          ['read', 'write'],
    staff:        ['read', 'write'],
    settings:     ['manage'],
    analytics:    ['read'],
    diagnostics:  ['read', 'write'],
    academy:      ['manage'],
    shop:         ['manage'],
    community:    ['read', 'write'],
    bi:           ['read'],
  },

  MANAGER: {
    patients:     ['read'],
    appointments: ['read'],
    medical:      ['read'],
    billing:      ['read'],
    inventory:    ['read', 'write'],
    lab:          ['read'],
    staff:        ['read'],
    settings:     ['manage'],
    analytics:    ['read'],
    diagnostics:  ['read'],
    shop:         ['read'],
    academy:      ['read'],
    bi:           ['read'],
  },

  DOCTOR: {
    patients:     ['read', 'write'],
    appointments: ['read', 'write'],
    medical:      ['read', 'write'],
    billing:      ['read'],
    inventory:    ['read'],
    lab:          ['read', 'write'],
    diagnostics:  ['read'],
    shop:         ['read'],
    academy:      ['read'],
    community:    ['read'],
  },

  ASSISTANT: {
    patients:     ['read'],
    appointments: ['read', 'write'],
    medical:      ['read'],
    inventory:    ['read'],
    lab:          ['read'],
    shop:         ['read'],
    academy:      ['read'],
    community:    ['read'],
  },

  CASHIER: {
    patients:     ['read'],
    appointments: ['read'],
    billing:      ['read', 'write'],
    inventory:    ['read'],
    shop:         ['read'],
  },

  LAB: {
    patients:     ['read'],
    appointments: ['read'],
    lab:          ['read', 'write'],
    inventory:    ['read'],
    shop:         ['read'],
  },

  STUDENT: {
    patients:     ['read'],
    appointments: ['read'],
    medical:      ['read'],
    shop:         ['read'],
    academy:      ['read'],
  },

  SUPPORT: {
    patients:     ['read'],
    appointments: ['read'],
    billing:      ['read'],
    bi:           ['read'],
    admin:        ['read'],
    shop:         ['read'],
  },
};

// ─── Generate PermissionKey[] from the matrix ───

export type PermissionKey = `${Module}.${Action}` | '*';

function buildPermissionKeys(row: RoleMatrixRow): PermissionKey[] {
  if (row['*']) return ['*'];
  const keys: PermissionKey[] = [];
  for (const [mod, actions] of Object.entries(row)) {
    for (const action of actions as Action[]) {
      keys.push(`${mod}.${action}` as PermissionKey);
    }
  }
  return keys;
}

export const ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {};
for (const [role, row] of Object.entries(MATRIX)) {
  if (role === 'SUPERADMIN') continue; // handled by roleHasPermission
  ROLE_PERMISSIONS[role] = buildPermissionKeys(row);
}

// DIRECTOR alias (not a UserRole enum value, used by frontend / jarvisBriefing etc.)
ROLE_PERMISSIONS['DIRECTOR'] = ROLE_PERMISSIONS['OWNER'];

/** Legacy compatibility — string keys for direct lookups (used in requirePermission middleware). */
export const PERMISSIONS = {
  PATIENT_READ: 'patients.read',
  PATIENT_WRITE: 'patients.write',
  PATIENT_DELETE: 'patients.delete',
  APPOINTMENT_READ: 'appointments.read',
  APPOINTMENT_WRITE: 'appointments.write',
  APPOINTMENT_DELETE: 'appointments.delete',
  INVENTORY_READ: 'inventory.read',
  INVENTORY_WRITE: 'inventory.write',
  INVENTORY_DELETE: 'inventory.delete',
  ACADEMY_MANAGE: 'academy.manage',
  SUPPLIER_MANAGE: 'shop.manage',
  COMPLIANCE_MANAGE: 'audit.read',
  PLATFORM_ANALYTICS: 'admin.read',
  FINANCE_MANAGE: 'billing.manage',
  PARTNER_MANAGE: 'shop.manage',
  WORKFLOW_MANAGE: 'settings.manage',
  BI_CLINIC: 'bi.read',
  BI_NETWORK: 'admin.read',
  BI_PLATFORM: 'admin.read',
  BI_FINANCE: 'billing.manage',
} as const;

/**
 * Action ladder used when matching a required permission against a granted set.
 *
 * The matrix does not imply lower actions from higher ones — OWNER holds
 * `shop.manage` but not `shop.read` — so an exact-key check denies owners their
 * own data. `requirePermission` keeps exact matching; callers that gate a whole
 * capability (the AI tool surface, the AI intent router) use this instead.
 */
const ACTION_SATISFIED_BY: Record<string, string[]> = {
  read: ['read', 'write', 'delete', 'manage'],
  write: ['write', 'delete', 'manage'],
  delete: ['delete', 'manage'],
  manage: ['manage'],
};

/** Does a resolved permission set satisfy a required key? */
export function permissionsSatisfy(granted: Set<string>, required: string): boolean {
  if (granted.has('*')) return true;
  if (granted.has(required)) return true;

  const [mod, action] = required.split('.');
  if (!mod || !action) return false;

  return (ACTION_SATISFIED_BY[action] || [action]).some((a) => granted.has(`${mod}.${a}`));
}

export function roleHasPermission(role: string | undefined | null, key: PermissionKey | string): boolean {
  if (!role) return false;
  if (role === 'SUPERADMIN') return true;
  // Map legacy singular keys (patient.read → patients.read) to new plural form.
  const resolved = (LEGACY_KEY_MAP as Record<string, string>)[key] || key;
  if (resolved.startsWith('admin.') && role !== 'SUPERADMIN') return false;
  return (ROLE_PERMISSIONS[role] || []).includes(resolved as PermissionKey);
}

/** Legacy key → new key (backward compat for routes still using old names). */
const LEGACY_KEY_MAP: Record<string, string> = {
  'patient.read': 'patients.read',
  'patient.write': 'patients.write',
  'patient.delete': 'patients.delete',
  'appointment.read': 'appointments.read',
  'appointment.write': 'appointments.write',
  'appointment.delete': 'appointments.delete',
  'finance.manage': 'billing.manage',
  'finance.read': 'billing.read',
  'bi.clinic': 'bi.read',
  'bi.network': 'admin.read',
  'bi.platform': 'admin.read',
  'bi.finance': 'billing.manage',
  'platform.analytics': 'admin.read',
  'compliance.manage': 'audit.read',
  'partner.manage': 'shop.manage',
  'supplier.manage': 'shop.manage',
  'workflow.manage': 'settings.manage',
};

/** Return ALL permissions granted to a role (wildcard for SUPERADMIN). */
export function permissionsForRole(role: string | null | undefined): PermissionKey[] {
  if (!role) return [];
  if (role === 'SUPERADMIN') return ['*'];
  return ROLE_PERMISSIONS[role] || [];
}

// ─── Module → canonical CRM page IDs (used by frontend sidebar/navigation) ───

export const MODULE_PAGES: Record<string, string[]> = {
  patients:     ['patients', 'medical-card', 'visits', 'dental-chart', 'documents', 'treatment-plans', 'icd10'],
  appointments: ['schedule', 'reminders'],
  billing:      ['finance', 'cashier', 'billing', 'pricelist'],
  inventory:    ['inventory'],
  lab:          ['lab'],
  staff:        ['staff'],
  settings:     ['clinic-settings'],
  analytics:    ['analytics'],
  diagnostics:  ['diagnostics', 'diagnostics-referrals', 'diagnostics-centers', 'diagnostics-laboratories', 'diagnostics-results', 'diagnostics-calendar', 'diagnostics-statistics', 'diagnostics-settings'],
  academy:      ['school'],
  shop:         ['shop', 'promotions'],
  community:    [],
  audit:        [],
  admin:        ['admin'],
  bi:           ['bi'],
};

/**
 * Derive visible CRM pages from an effective permission set.
 *
 * Takes the resolved permissions rather than a role name so the DB permission
 * graph drives page visibility too — a role whose PersonRole grants more (or
 * less) than the matrix gets pages that match what it can actually do.
 */
export function pagesForPermissions(permissions: readonly string[]): string[] {
  const pages = new Set<string>();
  for (const perm of permissions) {
    if (perm === '*') {
      for (const p of Object.values(MODULE_PAGES)) p.forEach((id) => pages.add(id));
      return Array.from(pages);
    }
    const mod = perm.split('.')[0];
    const modPages = MODULE_PAGES[mod];
    if (modPages) modPages.forEach((p) => pages.add(p));
  }
  return Array.from(pages);
}

/** Derive visible CRM pages from a role's permission set. */
export function pagesForRole(role: string): string[] {
  return pagesForPermissions(
    role === 'SUPERADMIN' ? buildPermissionKeys(MATRIX['SUPERADMIN']) : ROLE_PERMISSIONS[role] || [],
  );
}

// ─── Capability flags derived from permissions ───

export interface RoleCapabilities {
  canSeeSalary: boolean;
  canAddStaff: boolean;
  canSeeAudit: boolean;
  canBackup: boolean;
  canSeeReports: boolean;
  canSeeExpenses: boolean;
  canManageClinicSettings: boolean;
  canManageFinance: boolean;
  ownDataOnly: boolean;
  readOnly: boolean;
}

/**
 * Capability flags for an effective permission set.
 *
 * Most flags fall out of the permissions; `canBackup`, `ownDataOnly` and
 * `readOnly` have no permission key behind them and stay keyed on the role.
 */
export function capabilitiesForPermissions(
  permissions: readonly string[],
  role: string,
): RoleCapabilities {
  const perms = new Set(permissions);
  const has = (key: string) => perms.has('*') || perms.has(key);
  const r = String(role || '').toUpperCase();
  return {
    canSeeSalary:            has('staff.read'),
    canAddStaff:             has('staff.write'),
    canSeeAudit:             has('audit.read'),
    canBackup:               r === 'SUPERADMIN' || r === 'OWNER' || r === 'DIRECTOR',
    canSeeReports:           has('analytics.read'),
    canSeeExpenses:          has('billing.manage'),
    canManageClinicSettings: has('settings.manage'),
    canManageFinance:        has('billing.manage'),
    ownDataOnly:             r === 'DOCTOR' || r === 'ASSISTANT',
    readOnly:                r === 'ASSISTANT' || r === 'STUDENT',
  };
}

export function capabilitiesForRole(role: string): RoleCapabilities {
  return capabilitiesForPermissions(permissionsForRole(role), role);
}

// ─── Role-to-module quick check ───

export function roleCanAccessModule(role: string, mod: Module): boolean {
  if (role === 'SUPERADMIN') return true;
  const perms = ROLE_PERMISSIONS[role] || [];
  return perms.some((p) => p.startsWith(`${mod}.`));
}
