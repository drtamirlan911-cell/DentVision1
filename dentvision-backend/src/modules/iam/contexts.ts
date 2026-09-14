import { installContentCatalogJsonGuard } from '../../iam/contentCatalogMiddleware.js';

installContentCatalogJsonGuard();

/**
 * One row per workspace the user actually belongs to.
 *
 * `GET /me/contexts` used to concatenate two lists and return both: the legacy
 * membership tables and the unified Person → Organization graph. The merge
 * below keeps one workspace identity while preserving both legacy and unified
 * ids for compatibility.
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
  id: string;
  scopeType: ScopeType;
  scopeId: string;
  organizationId?: string;
  name: string;
  roleKey: string;
  roleLabel: string;
  personType?: string;
  logo?: string | null;
  joinedAt?: Date;
  role?: string;
  clinic?: unknown;
  supplier?: unknown;
  academy?: unknown;
  level?: string;
}

const ORG_TYPE_TO_SCOPE: Record<string, ScopeType> = {
  CLINIC: 'CLINIC',
  DIAGNOSTIC_CENTER: 'DIAGNOSTIC_CENTER',
  LABORATORY: 'LABORATORY',
  SUPPLIER_COMPANY: 'SUPPLIER',
  SUPPLIER: 'SUPPLIER',
  ACADEMY: 'ACADEMY',
  PARTNER: 'PARTNER',
};

const PERSON_TYPE_TO_SCOPE: Record<string, ScopeType> = {
  LECTURER: 'LECTURER',
  SUPPLIER_REP: 'SUPPLIER',
};

const ROLE_LABELS: Record<string, string> = {
  owner: 'Владелец',
  director: 'Руководитель',
  admin: 'Администратор',
  org_admin: 'Администратор',
  manager: 'Управляющий',
  doctor: 'Врач',
  assistant: 'Ассистент',
  radiologist: 'Рентгенолог',
  radiology_technician: 'Рентген-лаборант',
  diagnostic_owner: 'Владелец диагностического центра',
  diagnostic_admin: 'Администратор диагностического центра',
  diagnostic_manager: 'Управляющий диагностического центра',
  diagnostic_operator: 'Оператор диагностического центра',
  diagnostic_reception: 'Регистратура диагностического центра',
  diagnostic_finance: 'Финансы диагностического центра',
  diagnostic_quality: 'Контроль качества диагностики',
  medical_lab_owner: 'Владелец медицинской лаборатории',
  medical_lab_admin: 'Администратор медицинской лаборатории',
  medical_lab_manager: 'Управляющий медицинской лаборатории',
  medical_lab_reception: 'Регистратура медицинской лаборатории',
  medical_lab_technician: 'Лаборант',
  medical_lab_validator: 'Валидатор результатов',
  medical_lab_doctor: 'Врач лаборатории',
  medical_lab_finance: 'Финансы медицинской лаборатории',
  medical_lab_quality: 'Контроль качества лаборатории',
  dental_lab_owner: 'Владелец зуботехнической лаборатории',
  dental_lab_admin: 'Администратор зуботехнической лаборатории',
  dental_lab_manager: 'Управляющий зуботехнической лаборатории',
  lab_coordinator: 'Координатор лаборатории',
  dental_technician: 'Зубной техник',
  cad_designer: 'CAD-дизайнер',
  ceramist: 'Керамист',
  orthodontic_technician: 'Ортодонтический техник',
  qc_specialist: 'Контроль качества лаборатории',
  lab_finance: 'Финансы лаборатории',
  cashier: 'Кассир',
  seller: 'Продавец',
  supplier: 'Поставщик',
  lecturer: 'Лектор',
  student: 'Студент',
  support: 'Поддержка',
  superadmin: 'Платформа',
  member: 'Участник',
};

export function roleLabelFor(roleKey: string | null | undefined): string {
  if (!roleKey) return ROLE_LABELS.member;
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

export function buildWorkspaceContexts(sources: ContextSources): WorkspaceContext[] {
  const byIdentity = new Map<string, WorkspaceContext>();

  const put = (entry: WorkspaceContext) => {
    const existing = byIdentity.get(entry.id);
    if (!existing) {
      byIdentity.set(entry.id, entry);
      return;
    }
    byIdentity.set(entry.id, {
      ...existing,
      ...Object.fromEntries(Object.entries(entry).filter(([, v]) => v !== undefined && v !== null)),
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
