/**
 * One row per workspace the user actually belongs to.
 *
 * `GET /me/contexts` used to concatenate two lists and return both: the legacy
 * membership tables (`ClinicMember`, `SupplierMember`, `Lecturer`) and the
 * unified `Person → Organization` graph. Since the #174/#175 backfill mirrors
 * every legacy membership into a `Person`, that meant **the same clinic came
 * back twice** — once keyed by `clinicId`, once by `Organization.id`, which is
 * a separate uuid (`schema.prisma`: `id @default(uuid())`, with the real
 * entity id in `originalId`). Anything rendering the list showed the user two
 * or three copies of one workspace, and half of them carried an id that no
 * clinic-scoped query could resolve.
 *
 * The two halves also spoke different vocabularies for the same thing — legacy
 * said `SUPPLIER`/`LECTURER`, unified said `SUPPLIER_COMPANY`/`ACADEMY` — so
 * every consumer that filtered by the legacy names silently ignored the
 * unified rows.
 *
 * This merges both halves onto the identity of the real entity, and emits one
 * vocabulary. Each row carries both ids on purpose: `scopeId` is the entity id
 * that legacy callers already use, `organizationId` is the unified handle when
 * one exists, so `switch-context` can take its richer Person path and fall
 * back to the legacy branch when it cannot.
 */

export type ScopeType =
  | 'CLINIC'
  | 'DIAGNOSTIC_CENTER'
  | 'LABORATORY'
  | 'SUPPLIER'
  | 'LECTURER'
  | 'ACADEMY'
  | 'PARTNER';

export interface WorkspaceContext {
  /** Stable key: type plus the real entity id. */
  id: string;
  scopeType: ScopeType;
  /** The entity's own id — clinicId, supplierId, lecturerId. */
  scopeId: string;
  /** Unified handle, when the entity has been mirrored into an Organization. */
  organizationId?: string;
  name: string;
  roleKey: string;
  /** Human-readable — never a raw enum or a dotted key. */
  roleLabel: string;
  personType?: string;
  logo?: string | null;
  joinedAt?: Date;
  /** Legacy passthroughs kept so existing callers keep working unchanged. */
  role?: string;
  clinic?: unknown;
  supplier?: unknown;
  academy?: unknown;
  level?: string;
}

/** `Organization.type` is its own vocabulary; this is the one clients see. */
const ORG_TYPE_TO_SCOPE: Record<string, ScopeType> = {
  CLINIC: 'CLINIC',
  DIAGNOSTIC_CENTER: 'DIAGNOSTIC_CENTER',
  LABORATORY: 'LABORATORY',
  SUPPLIER_COMPANY: 'SUPPLIER',
  SUPPLIER: 'SUPPLIER',
  ACADEMY: 'ACADEMY',
  PARTNER: 'PARTNER',
};

/**
 * A lecturer's Person hangs off the *academy* organisation, so going by
 * organisation type alone would file it as `ACADEMY` and leave it sitting next
 * to the legacy `LECTURER` row as a second copy of the same membership.
 * `personType` is the more specific fact, so it wins.
 */
const PERSON_TYPE_TO_SCOPE: Record<string, ScopeType> = {
  LECTURER: 'LECTURER',
  SUPPLIER_REP: 'SUPPLIER',
};

const ROLE_LABELS: Record<string, string> = {
  owner: 'Владелец',
  director: 'Руководитель',
  admin: 'Администратор',
  org_admin: 'Администратор',
  doctor: 'Врач',
  assistant: 'Ассистент',
  manager: 'Менеджер',
  cashier: 'Кассир',
  seller: 'Продавец',
  supplier: 'Поставщик',
  lecturer: 'Лектор',
  student: 'Студент',
  support: 'Поддержка',
  superadmin: 'Платформа',
  member: 'Участник',
};

/** `clinic.owner`, `supplier.seller`, `OWNER` and `owner` all mean one thing. */
export function roleLabelFor(roleKey: string | null | undefined): string {
  if (!roleKey) return ROLE_LABELS.member;
  // A key may be dotted (`clinic.owner`) or comma-joined when a Person holds
  // several roles; the first segment is the one worth showing.
  const first = String(roleKey).split(',')[0].trim();
  const last = first.includes('.') ? first.slice(first.lastIndexOf('.') + 1) : first;
  return ROLE_LABELS[last.toLowerCase()] || ROLE_LABELS.member;
}

export interface LegacyClinicRow {
  id: string;
  role: string;
  clinicId: string;
  joinedAt?: Date;
  clinic?: { id: string; name: string; logo?: string | null } | null;
}

export interface LegacySupplierRow {
  id: string;
  role: string;
  supplierId: string;
  createdAt?: Date;
  supplier?: { id: string; name: string } | null;
}

export interface LegacyLecturerRow {
  id: string;
  level?: string | null;
  academy?: { id: string; name: string } | null;
}

export interface UnifiedPersonRow {
  id: string;
  personType: string;
  originalId?: string | null;
  organization?: {
    id: string;
    name: string;
    type: string;
    logo?: string | null;
    originalId?: string | null;
  } | null;
  personRoles?: Array<{ role: { key: string } }>;
}

export interface ContextSources {
  memberships: LegacyClinicRow[];
  supplierMemberships: LegacySupplierRow[];
  lecturer: LegacyLecturerRow | null;
  persons: UnifiedPersonRow[];
}

/**
 * Merges the legacy and unified halves. Pure — the route does the querying, so
 * the collapsing rules are testable without a database.
 */
export function buildWorkspaceContexts(sources: ContextSources): WorkspaceContext[] {
  const byIdentity = new Map<string, WorkspaceContext>();

  const put = (entry: WorkspaceContext) => {
    const existing = byIdentity.get(entry.id);
    if (!existing) {
      byIdentity.set(entry.id, entry);
      return;
    }
    // Same workspace reached from both halves. Keep every field either half
    // knows: the legacy row has the display name and joinedAt, the unified row
    // has the organizationId that unlocks the Person path in switch-context.
    byIdentity.set(entry.id, {
      ...existing,
      ...Object.fromEntries(Object.entries(entry).filter(([, v]) => v !== undefined && v !== null)),
      // A real name beats the "Workspace" placeholder either side may carry.
      name: existing.name || entry.name,
      roleLabel: existing.roleLabel !== ROLE_LABELS.member ? existing.roleLabel : entry.roleLabel,
    });
  };

  for (const m of sources.memberships) {
    put({
      id: `CLINIC:${m.clinicId}`,
      scopeType: 'CLINIC',
      scopeId: m.clinicId,
      name: m.clinic?.name || 'Клиника',
      roleKey: `clinic.${String(m.role).toLowerCase()}`,
      roleLabel: roleLabelFor(m.role),
      logo: m.clinic?.logo ?? null,
      joinedAt: m.joinedAt,
      role: m.role,
      clinic: m.clinic ?? undefined,
    });
  }

  for (const m of sources.supplierMemberships) {
    put({
      id: `SUPPLIER:${m.supplierId}`,
      scopeType: 'SUPPLIER',
      scopeId: m.supplierId,
      name: m.supplier?.name || 'Поставщик',
      roleKey: `supplier.${m.role}`,
      roleLabel: roleLabelFor(m.role),
      joinedAt: m.createdAt,
      role: m.role,
      supplier: m.supplier ?? undefined,
    });
  }

  if (sources.lecturer) {
    const l = sources.lecturer;
    put({
      id: `LECTURER:${l.id}`,
      scopeType: 'LECTURER',
      scopeId: l.id,
      name: l.academy?.name || 'Академия',
      roleKey: 'lecturer',
      roleLabel: roleLabelFor('lecturer'),
      role: l.level ?? undefined,
      level: l.level ?? undefined,
      academy: l.academy ?? undefined,
    });
  }

  for (const p of sources.persons) {
    const org = p.organization;
    if (!org) continue;

    const scopeType = PERSON_TYPE_TO_SCOPE[p.personType] || ORG_TYPE_TO_SCOPE[org.type];
    if (!scopeType) continue;

    // The entity id, not `Organization.id` — the latter is a fresh uuid that
    // matches no row in the mirrored table.
    const entityId =
      scopeType === 'LECTURER'
        ? p.originalId || org.originalId || org.id
        : org.originalId || org.id;

    const roleKey = (p.personRoles || []).map((pr) => pr.role.key).join(',') || p.personType.toLowerCase();

    put({
      id: `${scopeType}:${entityId}`,
      scopeType,
      scopeId: entityId,
      organizationId: org.id,
      name: org.name,
      roleKey,
      roleLabel: roleLabelFor(roleKey),
      personType: p.personType,
      logo: org.logo ?? null,
    });
  }

  return Array.from(byIdentity.values());
}
