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
  | 'academy' | 'shop' | 'community' | 'audit' | 'admin' | 'bi'
  | 'profile' | 'backup' | 'security' | 'dashboard' | 'platform';

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
    // `medical.manage` is the clinical sign-off right: approving a treatment
    // plan and publishing it to the patient. Held by OWNER and DOCTOR only —
    // deliberately NOT by ADMIN, who can author and edit a plan but must not
    // be the one who certifies it clinically. That separation is the whole
    // point of the approval layer (modules/patient-presentation).
    medical:      ['read', 'write', 'delete', 'manage'],
    billing:      ['read', 'write', 'delete', 'manage'],
    inventory:    ['read', 'write', 'delete'],
    lab:          ['read', 'write', 'delete'],
    staff:        ['read', 'write', 'delete', 'manage'],
    settings:     ['manage'],
    analytics:    ['read'],
    diagnostics:  ['read', 'write'],
    // `academy.manage` is platform-wide governance over the Academy/Lecturer
    // registry (academy.routes.ts creates/edits/deletes Academy records and
    // runs the lecturer expert-verification pipeline with no clinic scoping
    // anywhere in that router — its own file comment says this permission is
    // meant to mean "platform / SUPERADMIN today"). A clinic OWNER has no
    // legitimate reason to touch another academy's registry; the DB-seeded
    // Person/Role graph already scopes `academy.manage` to a dedicated
    // `lecturer` role only (prisma/seed-permissions.ts), never to OWNER/ADMIN
    // — this hardcoded fallback matrix was the one place still over-granting
    // it. `academy.read` (browsing/buying in the marketplace) is unaffected.
    academy:      ['read'],
    shop:         ['manage'],
    community:    ['read', 'write'],
    audit:        ['read'],
    bi:           ['read'],
    backup:       ['read'],
    dashboard:    ['read'],
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
    // See OWNER above — same platform-scope reasoning applies to ADMIN.
    academy:      ['read'],
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
    dashboard:    ['read'],
  },

  DOCTOR: {
    patients:     ['read', 'write'],
    appointments: ['read', 'write'],
    medical:      ['read', 'write', 'manage'],
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
    diagnostics:  ['read'],
  },

  LAB: {
    patients:     ['read'],
    appointments: ['read'],
    lab:          ['read', 'write'],
    inventory:    ['read'],
    shop:         ['read'],
    diagnostics:  ['read'],
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
    analytics:    ['read'],
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

/**
 * CASHIER alias.
 *
 * The product has no separate cashier: `normalizeStaffRole` in
 * clinics.routes.ts maps a requested `cashier` to ADMIN, the staff UI offers
 * only Врач / Ассистент / Администратор / Руководитель, and the role
 * description says the administrator runs the till. So a cashier IS an admin.
 *
 * The enum value still exists and the superadmin console can still write it,
 * which made this a live inconsistency: the same person resolved to a narrow
 * five-module set through the legacy matrix and to full ADMIN through the
 * unified Person path (`PERSON_ROLE_MAP.cashier`). Aliasing settles it on the
 * answer the product actually intends, and — unlike deleting the row — leaves
 * any existing CASHIER account working instead of locking it out with an empty
 * permission set.
 */
ROLE_PERMISSIONS['CASHIER'] = ROLE_PERMISSIONS['ADMIN'];

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
  BACKUP_READ: 'backup.read',
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
export const LEGACY_KEY_MAP: Record<string, string> = {
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

/**
 * Pages every authenticated caller gets, whatever their role.
 *
 * Not a role at all — this is what being logged in means: the marketplace and
 * academy catalogues, the public diagnostics directory, and one's own profile
 * and settings. Suppliers, lecturers and buyers hold no clinic role and so
 * received an empty page list, which the frontend read as "deny everything";
 * `PLATFORM_ROLES.user` in the legacy config is exactly this set.
 */
export const BASE_PAGES: readonly string[] = [
  'shop', 'school', 'profile', 'settings',
  'diagnostics', 'diagnostics-centers', 'diagnostics-labs', 'diagnostics-laboratories',
];

export const MODULE_PAGES: Record<string, string[]> = {
  patients:     ['patients', 'medical-card', 'visits', 'dental-chart', 'documents', 'treatment-plans', 'icd10'],
  appointments: ['schedule', 'reminders'],
  billing:      ['finance', 'cashier', 'billing', 'pricelist'],
  inventory:    ['inventory'],
  lab:          ['lab'],
  staff:        ['staff'],
  settings:     ['clinic-settings'],
  analytics:    ['analytics'],
  // `diagnostics-labs` and `diagnostics-laboratories` are the same page under
  // two ids — both appear in the frontend route table, so both must resolve.
  diagnostics:  ['diagnostics', 'diagnostics-referrals', 'diagnostics-centers', 'diagnostics-laboratories', 'diagnostics-labs', 'diagnostics-results', 'diagnostics-calendar', 'diagnostics-statistics', 'diagnostics-settings'],
  academy:      ['school'],
  shop:         ['shop', 'promotions'],
  community:    [],
  audit:        ['audit'],
  admin:        ['admin'],
  bi:           ['bi'],
  profile:      ['profile'],
  backup:       ['backup'],
  security:     ['security'],
  dashboard:    ['dashboard'],
  // Platform console screens. Nothing grants `platform.*` except the SUPERADMIN
  // wildcard, which is the whole point.
  platform:     ['quality', 'platform-finance', 'ai-governance', 'support', 'supplier'],
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
  // The profile page is open to every authenticated user (it was in every
  // legacy role's pages list) even though no profile.* permission exists.
  if (permissions.length > 0) pages.add('profile');
  return Array.from(pages);
}

/**
 * Pages for a caller, from their effective permissions UNION their role.
 *
 * Never narrower than the role matrix alone. The DB permission graph is
 * additive to the matrix everywhere else (`requirePermission` allows when
 * either grants), and page visibility has to match: a Person seeded with a
 * couple of narrow keys must not silently revoke the pages their role has
 * always had.
 */
export function pagesForCaller(permissions: readonly string[], role: string | null | undefined): string[] {
  return Array.from(new Set([
    ...BASE_PAGES,
    ...pagesForPermissions(permissions),
    ...(role ? pagesForRole(role) : []),
  ]));
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
