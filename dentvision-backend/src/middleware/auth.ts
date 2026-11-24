import type { Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt.js';
import prisma from '../lib/prisma.js';
import { isGuestEmail } from '../lib/guestAiQuota.js';
import { setCsrfCookie } from './csrf.js';
import type { AuthRequest, AuthUser } from '../types/index.js';
import type { UserRole } from '@prisma/client';

const ROLE_KEY_MAP: Record<string, UserRole> = {
  SUPERADMIN: 'SUPERADMIN', superadmin: 'SUPERADMIN',
  OWNER: 'OWNER', owner: 'OWNER', org_owner: 'OWNER', DIRECTOR: 'OWNER', director: 'OWNER',
  ADMIN: 'ADMIN', admin: 'ADMIN', org_admin: 'ADMIN',
  MANAGER: 'MANAGER', manager: 'MANAGER',
  DOCTOR: 'DOCTOR', doctor: 'DOCTOR',
  ASSISTANT: 'ASSISTANT', assistant: 'ASSISTANT',
  CASHIER: 'CASHIER', cashier: 'CASHIER',
  LAB: 'LAB', lab: 'LAB',
  STUDENT: 'STUDENT', student: 'STUDENT',
  SUPPORT: 'SUPPORT', support: 'SUPPORT',
  PATIENT: 'PATIENT', patient: 'PATIENT',
  // Partner-only roles live in the unified Role table but have no UserRole enum
  // equivalent. STUDENT is the least-privileged compatibility identity; the
  // actual seller/lecturer permissions remain authoritative in PersonRole.
  SELLER: 'STUDENT', seller: 'STUDENT',
  LECTURER: 'STUDENT', lecturer: 'STUDENT',
  EMPLOYER_OWNER: 'OWNER', employer_owner: 'OWNER',
  EMPLOYER_RECRUITER: 'MANAGER', employer_recruiter: 'MANAGER',
  EMPLOYER_VIEWER: 'ASSISTANT', employer_viewer: 'ASSISTANT',
  DIAGNOSTIC_OWNER: 'STUDENT', diagnostic_owner: 'STUDENT',
  DIAGNOSTIC_ADMIN: 'STUDENT', diagnostic_admin: 'STUDENT',
  DIAGNOSTIC_MANAGER: 'STUDENT', diagnostic_manager: 'STUDENT',
  DIAGNOSTIC_OPERATOR: 'STUDENT', diagnostic_operator: 'STUDENT',
  RADIOLOGIST: 'STUDENT', radiologist: 'STUDENT',
  RADIOLOGY_TECHNICIAN: 'STUDENT', radiology_technician: 'STUDENT',
  DIAGNOSTIC_RECEPTION: 'STUDENT', diagnostic_reception: 'STUDENT',
  DIAGNOSTIC_FINANCE: 'STUDENT', diagnostic_finance: 'STUDENT',
  DIAGNOSTIC_QUALITY: 'STUDENT', diagnostic_quality: 'STUDENT',
  MEDICAL_LAB_OWNER: 'STUDENT', medical_lab_owner: 'STUDENT',
  MEDICAL_LAB_ADMIN: 'STUDENT', medical_lab_admin: 'STUDENT',
  MEDICAL_LAB_MANAGER: 'STUDENT', medical_lab_manager: 'STUDENT',
  MEDICAL_LAB_RECEPTION: 'STUDENT', medical_lab_reception: 'STUDENT',
  MEDICAL_LAB_TECHNICIAN: 'STUDENT', medical_lab_technician: 'STUDENT',
  MEDICAL_LAB_VALIDATOR: 'STUDENT', medical_lab_validator: 'STUDENT',
  MEDICAL_LAB_DOCTOR: 'STUDENT', medical_lab_doctor: 'STUDENT',
  MEDICAL_LAB_FINANCE: 'STUDENT', medical_lab_finance: 'STUDENT',
  MEDICAL_LAB_QUALITY: 'STUDENT', medical_lab_quality: 'STUDENT',
  DENTAL_LAB_OWNER: 'STUDENT', dental_lab_owner: 'STUDENT',
  DENTAL_LAB_ADMIN: 'STUDENT', dental_lab_admin: 'STUDENT',
  DENTAL_LAB_MANAGER: 'STUDENT', dental_lab_manager: 'STUDENT',
  LAB_COORDINATOR: 'STUDENT', lab_coordinator: 'STUDENT',
  DENTAL_TECHNICIAN: 'STUDENT', dental_technician: 'STUDENT',
  CAD_DESIGNER: 'STUDENT', cad_designer: 'STUDENT',
  CERAMIST: 'STUDENT', ceramist: 'STUDENT',
  ORTHODONTIC_TECHNICIAN: 'STUDENT', orthodontic_technician: 'STUDENT',
  QC_SPECIALIST: 'STUDENT', qc_specialist: 'STUDENT',
  LAB_FINANCE: 'STUDENT', lab_finance: 'STUDENT',
};

const ROLE_PRIORITY: Record<UserRole, number> = {
  SUPERADMIN: 100, OWNER: 90, ADMIN: 80, MANAGER: 70, DOCTOR: 60,
  LAB: 50, ASSISTANT: 40, CASHIER: 30, STUDENT: 20, PATIENT: 15, SUPPORT: 10,
};

function normalizeScopedRole(roleKey: string): UserRole | undefined {
  return ROLE_KEY_MAP[roleKey] || ROLE_KEY_MAP[roleKey.toUpperCase()];
}

/** Merge canonical BranchMember assignments with legacy clinic memberships. */
export function shouldUseLegacyClinicFallback(
  effectiveOrganizationId?: string | null,
  effectiveClinicId?: string | null,
  hasOrganizationClaim = false,
): boolean {
  // A supplied organization claim is authoritative. If that organization or
  // PersonRole cannot be revalidated, never fall back to a retained clinicId.
  // This prevents a stale/revoked partner token from re-entering a clinic via
  // an unrelated legacy ClinicMember row.
  return !hasOrganizationClaim && !effectiveOrganizationId && !effectiveClinicId;
}

export function mergeBranchIds(unifiedBranchIds: readonly string[], legacyBranchIds: readonly string[]): string[] {
  return Array.from(new Set([...unifiedBranchIds, ...legacyBranchIds].filter(Boolean)));
}

/** Do not silently choose the first canonical branch when a member has several. */
export function resolveAssignedBranchId(
  unifiedBranchIds: readonly string[],
  legacyBranchId?: string | null,
): string | undefined {
  if (unifiedBranchIds.length === 1) return unifiedBranchIds[0];
  if (unifiedBranchIds.length > 1) return undefined;
  return legacyBranchId || undefined;
}

const BRANCH_CONTEXT_RECOVERY_PATHS = new Set([
  '/api/auth/me', '/api/auth/refresh', '/api/auth/logout',
  '/api/iam/me/contexts', '/api/iam/switch-context',
]);

export function isBranchContextRecoveryPath(pathname: string): boolean {
  return BRANCH_CONTEXT_RECOVERY_PATHS.has(String(pathname || '').split('?')[0]);
}

export function isOrganizationBranchManagerRoleKey(roleKey: string): boolean {
  const key = String(roleKey || '').trim().toLowerCase();
  return ['owner', 'org_owner', 'admin', 'org_admin'].includes(key) || /_(owner|admin)$/.test(key);
}

/** A legacy clinic branch may have no organization_id; only then may clinic_id map it to the canonical clinic Organization. */
export function branchMatchesOrganization(
  branch: { organizationId: string | null; clinicId: string | null },
  organization: { id: string; type: string; originalId: string | null },
): boolean {
  if (branch.organizationId) return branch.organizationId === organization.id;
  return organization.type === 'CLINIC' && Boolean(organization.originalId) && branch.clinicId === organization.originalId;
}

export function resolveActivePersonRole(
  personRoles: Array<{ scopeType: string | null; scopeId: string | null; role: { key: string } }>,
  organizationId: string,
): UserRole | undefined {
  // Organization context is authoritative: only an explicit organization-scoped
  // PersonRole for this exact organization may activate tenant permissions.
  // Null/legacy scope rows are never treated as active here.
  const activeRoles = personRoles
    .filter((pr) => pr.scopeType === 'organization' && pr.scopeId === organizationId)
    .map((pr) => normalizeScopedRole(pr.role.key))
    .filter((role): role is UserRole => Boolean(role));

  return activeRoles.sort((a, b) => ROLE_PRIORITY[b] - ROLE_PRIORITY[a])[0];
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    let token = '';
    if (header?.startsWith('Bearer ')) token = header.slice(7);
    else if (req.cookies?.accessToken) token = req.cookies.accessToken;
    if (!token) return res.status(401).json({ ok: false, error: 'Требуется авторизация' });
    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true, email: true, firstName: true, lastName: true, role: true,
        memberships: { select: { id: true, clinicId: true, role: true, branchId: true, branch: { select: { active: true } } } },
      },
    });
    if (!user) return res.status(401).json({ ok: false, error: 'Пользователь не найден' });

    setCsrfCookie(res);
    const guestByEmail = isGuestEmail(user.email);
    if (!guestByEmail) {
      if (!payload.sessionId) return res.status(401).json({ ok: false, error: 'Сессия отсутствует или недействительна' });
      try {
        const activeSession = await prisma.userSession.findFirst({
          where: { id: payload.sessionId, userId: user.id, expiredAt: { gt: new Date() } },
        });
        if (!activeSession) return res.status(401).json({ ok: false, error: 'Сессия истекла или отозвана' });
      } catch {
        return res.status(401).json({ ok: false, error: 'Unable to verify session' });
      }
    }

    const hasMembership = (user.memberships?.length || 0) > 0;
    const isGuest = guestByEmail && !hasMembership;
    let effectiveOrgId: string | undefined;
    let effectiveOrgOriginalId: string | undefined;
    let effectiveOrgType: string | undefined;
    let effectivePersonType: string | undefined;
    let effectiveClinicId: string | undefined;
    let effectiveSupplierId: string | undefined;
    let unifiedBranchIds: string[] = [];
    let organizationWideBranchIds: string[] = [];
    let effectiveRole = user.role;
    let effectiveBranchId: string | undefined;

    if (!isGuest) {
      if (payload.organizationId) {
        const person = await prisma.person.findFirst({
          where: { userId: user.id, organizationId: payload.organizationId },
          include: {
            organization: { select: { type: true, originalId: true, archivedAt: true } },
            personRoles: { select: { scopeType: true, scopeId: true, role: { select: { key: true } } } },
            branchMemberships: { where: { active: true, branch: { is: { active: true } } }, select: { branchId: true } },
          },
        });
        if (person?.organization) {
          const requestPath = String(req.originalUrl || req.url || '').split('?')[0];
          const canRecoverArchivedContext = [
            '/api/iam/switch-context',
            '/api/iam/me/contexts',
            '/api/auth/refresh',
            '/api/auth/logout',
          ].includes(requestPath);
          if (person.organization.archivedAt && user.role !== 'SUPERADMIN' && !canRecoverArchivedContext) {
            return res.status(403).json({ ok: false, error: 'Контекст организации архивирован. Выберите другую организацию.', code: 'ORGANIZATION_ARCHIVED' });
          }
          const scopedRole = resolveActivePersonRole(person.personRoles, payload.organizationId);
          if (!scopedRole) {
            return res.status(403).json({ ok: false, error: 'У вас нет активной роли в этой организации' });
          }
          effectiveOrgId = payload.organizationId;
          effectiveOrgOriginalId = person.organization.originalId || undefined;
          effectiveOrgType = person.organization.type;
          effectivePersonType = person.personType;
          effectiveRole = scopedRole;
          unifiedBranchIds = person.branchMemberships.map((membership) => membership.branchId);
          if (payload.branchId) {
            const requestedBranch = await prisma.$queryRaw<Array<{ id: string; organization_id: string | null; clinic_id: string | null; active: boolean }>>`SELECT "id", "organization_id", "clinic_id", "active" FROM "branches" WHERE "id" = ${payload.branchId} LIMIT 1`;
            if (!requestedBranch[0] || !branchMatchesOrganization(
              { organizationId: requestedBranch[0].organization_id, clinicId: requestedBranch[0].clinic_id },
              { id: payload.organizationId, type: person.organization.type, originalId: person.organization.originalId },
            )) return res.status(403).json({ ok: false, error: 'Филиал не относится к активной организации' });
            const roleKeys = person.personRoles
              .filter((pr) => pr.scopeType === 'organization' && pr.scopeId === payload.organizationId)
              .map((pr) => pr.role.key.toLowerCase());
            const orgManager = roleKeys.some(isOrganizationBranchManagerRoleKey);
            if (!requestedBranch[0].active) {
              if (!orgManager && !isBranchContextRecoveryPath(requestPath)) return res.status(403).json({ ok: false, error: 'Филиал архивирован. Выберите активный филиал или обратитесь к руководителю.', code: 'BRANCH_ARCHIVED' });
            } else {
              const legacyAssignedBranch = person.organization.type === 'CLINIC' && person.organization.originalId
                ? user.memberships?.some((membership) =>
                    membership.clinicId === person.organization.originalId &&
                    membership.branchId === payload.branchId &&
                    membership.branch?.active === true,
                  )
                : false;
              if (!orgManager && !unifiedBranchIds.includes(payload.branchId) && !legacyAssignedBranch) {
                return res.status(403).json({ ok: false, error: 'У вас нет доступа к выбранному филиалу' });
              }
              effectiveBranchId = payload.branchId;
            }
          }
          if (person.organization.type === 'CLINIC') effectiveClinicId = person.organization.originalId || undefined;
        }
      }

      if (shouldUseLegacyClinicFallback(effectiveOrgId, effectiveClinicId, Boolean(payload.organizationId)) && payload.clinicId) {
        const activeMember = user.memberships?.find((m) => m.clinicId === payload.clinicId);
        if (activeMember) {
          const requestPath = String(req.originalUrl || req.url || '').split('?')[0];
          if (activeMember.branchId && activeMember.branch?.active !== true && !['OWNER', 'ADMIN'].includes(activeMember.role) && !isBranchContextRecoveryPath(requestPath)) {
            return res.status(403).json({ ok: false, error: 'Филиал архивирован. Рабочий доступ к нему отключён.', code: 'BRANCH_ARCHIVED' });
          }
          const canRecoverArchivedContext = isBranchContextRecoveryPath(requestPath);
          const archivedClinicOrganization = await prisma.organization.findFirst({
            where: { originalType: 'Clinic', originalId: payload.clinicId, archivedAt: { not: null } },
            select: { id: true },
          });
          if (archivedClinicOrganization && user.role !== 'SUPERADMIN' && !canRecoverArchivedContext) {
            return res.status(403).json({ ok: false, error: 'Контекст организации архивирован. Выберите другую организацию.', code: 'ORGANIZATION_ARCHIVED' });
          }
          if (!archivedClinicOrganization || canRecoverArchivedContext || user.role === 'SUPERADMIN') {
            effectiveClinicId = payload.clinicId;
            effectiveOrgId = payload.clinicId;
            effectiveOrgType = 'CLINIC';
            effectiveRole = activeMember.role;
          }
        }
      }
      if (!effectiveOrgId && payload.supplierId) effectiveSupplierId = payload.supplierId;
    }

    // Organization owners/admins are scoped to every ACTIVE branch in their
    // current organization. This is a positive branch list, not a wildcard:
    // archived branches remain excluded from normal operational routes.
    if (['OWNER', 'ADMIN'].includes(String(effectiveRole).toUpperCase())) {
      const activeBranches = effectiveOrgType === 'CLINIC' && effectiveOrgOriginalId && effectiveOrgId
        ? await prisma.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "branches"
              WHERE "active" = true
                AND (
                  "organization_id" = ${effectiveOrgId}
                  OR ("organization_id" IS NULL AND "clinic_id" = ${effectiveOrgOriginalId})
                )`
        : effectiveClinicId
          ? await prisma.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "branches" WHERE "clinic_id" = ${effectiveClinicId} AND "active" = true`
          : effectiveOrgId
            ? await prisma.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "branches" WHERE "organization_id" = ${effectiveOrgId} AND "active" = true`
            : [];
      organizationWideBranchIds = activeBranches.map((branch) => branch.id);
    }

    const activeMembership = effectiveClinicId
      ? user.memberships?.find((m) => m.clinicId === effectiveClinicId)
      : undefined;
    const legacyBranchIds = user.memberships
      ?.filter((membership) => membership.clinicId === effectiveClinicId && membership.branchId && membership.branch?.active === true)
      .map((membership) => membership.branchId as string) || [];
    const branchIds = mergeBranchIds(mergeBranchIds(unifiedBranchIds, legacyBranchIds), organizationWideBranchIds);
    const legacyAssignedBranchId = activeMembership?.branchId && activeMembership.branch?.active === true ? activeMembership.branchId : undefined;
    const assignedBranchId = resolveAssignedBranchId(unifiedBranchIds, legacyAssignedBranchId);

    req.user = {
      id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName,
      role: effectiveRole, clinicId: effectiveClinicId,
      supplierId: isGuest ? undefined : (payload.supplierId || effectiveSupplierId),
      supplierRole: isGuest ? undefined : payload.supplierRole,
      lecturerId: isGuest ? undefined : payload.lecturerId,
      organizationId: effectiveOrgId, organizationOriginalId: effectiveOrgOriginalId, organizationType: effectiveOrgType, personType: effectivePersonType,
      branchIds, assignedBranchId, branchId: effectiveBranchId, sessionId: payload.sessionId, isGuest,
    } satisfies AuthUser;
    next();
  } catch (err: any) {
    const code = err?.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : undefined;
    return res.status(401).json({ ok: false, error: 'Невалидный токен', code });
  }
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies?.accessToken || '';
    if (token) {
      const payload = verifyAccessToken(token);
      const email = String(payload.email || '');
      const guestByEmail = isGuestEmail(email);
      const roleUpper = String(payload.role || '').toUpperCase();
      const isGuest = guestByEmail || roleUpper === 'GUEST' || (payload.isGuest === true && (!email || guestByEmail));
      req.user = {
        id: payload.sub, email, role: payload.role, firstName: '', lastName: '',
        clinicId: isGuest ? undefined : payload.clinicId,
        supplierId: isGuest ? undefined : payload.supplierId,
        supplierRole: isGuest ? undefined : payload.supplierRole,
        lecturerId: isGuest ? undefined : payload.lecturerId,
        organizationId: isGuest ? undefined : payload.organizationId,
        organizationOriginalId: isGuest ? undefined : payload.organizationOriginalId,
        organizationType: isGuest ? undefined : payload.organizationType,
        personType: isGuest ? undefined : payload.personType,
        branchId: isGuest ? undefined : payload.branchId,
        isGuest,
      };
    }
  } catch { /* anonymous */ }
  next();
}
