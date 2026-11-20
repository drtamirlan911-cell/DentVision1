import type { Prisma } from '@prisma/client';
import prisma from '../../../lib/prisma.js';
import { PERSON_ROLE_MAP } from '../../../lib/orgContext.js';
import type { RoleScope } from '../../../lib/roleAccessRegistry.js';
import {
  resolveLegacyClinicBranches,
  resolveOrganizationBranches,
  type ActivePerson,
} from './aiEmployeeTaskScope.js';

export interface AiToolBranchScope {
  roleScope: RoleScope;
  /** Verified selected branch. Null means a verified organization-wide view. */
  branchId: string | null;
  /** Active branches proven by canonical BranchMember or legacy ClinicMember. */
  allowedBranchIds: string[];
}

export interface AiToolBranchScopeInput {
  userId: string;
  clinicId: string;
  organizationId?: string | null;
  role: string;
  /** Untrusted selected-branch hint, always checked against current DB membership. */
  requestedBranchId?: string | null;
}

/**
 * Tool scope is intentionally separate from AI Employee queue scope: it
 * follows the clinic IAM role matrix but does not enable any new task roles.
 * Existing queue membership readers are reused as the single branch source.
 */
function clinicToolRoleScope(role: string): RoleScope | null {
  switch (String(role || '').trim().toUpperCase()) {
    case 'OWNER':
    case 'ADMIN':
    case 'DIRECTOR':
    case 'ACCOUNTANT':
      return 'ORGANIZATION';
    case 'MANAGER':
    case 'LAB':
    case 'INVENTORY_MANAGER':
    case 'MARKETING_MANAGER':
    case 'HR_MANAGER':
    case 'READ_ONLY':
      return 'BRANCH';
    case 'DOCTOR':
    case 'ASSISTANT':
    case 'CASHIER':
    case 'RECEPTIONIST':
    case 'RECEPTION':
      return 'ASSIGNED';
    default:
      return null;
  }
}

export async function resolveAiToolBranchScope(
  input: AiToolBranchScopeInput,
): Promise<AiToolBranchScope | null> {
  const roleKey = String(input.role || '').trim().toUpperCase();
  const roleScope = clinicToolRoleScope(roleKey);
  if (!roleScope || !input.userId || !input.clinicId) return null;

  const organizationId = input.organizationId || null;
  let allowedBranchIds: string[];

  if (organizationId) {
    const organization = await prisma.organization.findFirst({
      where: { id: organizationId, archivedAt: null },
      select: { id: true, type: true, originalId: true },
    });
    if (!organization || String(organization.type).toUpperCase() !== 'CLINIC') return null;
    if (organization.originalId && organization.originalId !== input.clinicId) return null;

    const person = await prisma.person.findFirst({
      where: { userId: input.userId, organizationId: organization.id },
      select: {
        id: true,
        personType: true,
        originalId: true,
        personRoles: {
          where: { scopeType: 'organization', scopeId: organization.id },
          select: { role: { select: { key: true } } },
        },
      },
    }) as ActivePerson | null;
    if (!person) return null;

    const canonicalRoleKeys = person.personRoles.map((entry) => String(entry.role.key || '').trim().toLowerCase());
    const hasCurrentRole = canonicalRoleKeys.some((canonicalKey) =>
      (PERSON_ROLE_MAP[canonicalKey] || canonicalKey.toUpperCase()) === roleKey,
    );
    if (!hasCurrentRole) return null;
    // PERSON_ROLE_MAP currently aliases `cashier` to ADMIN for legacy UI
    // compatibility. That alias must never grant organization-wide AI access.
    if (roleKey === 'ADMIN' && !canonicalRoleKeys.some((key) => key === 'admin' || key === 'org_admin')) return null;

    allowedBranchIds = await resolveOrganizationBranches(organization.id, roleScope, person);
  } else {
    // Pre-canonical clinics use the active ClinicMember.branchId compatibility source.
    allowedBranchIds = await resolveLegacyClinicBranches(input.userId, input.clinicId, roleScope);
  }

  const requestedBranchId = input.requestedBranchId || null;
  if (requestedBranchId && !allowedBranchIds.includes(requestedBranchId)) return null;

  const selectedBranchId = requestedBranchId
    || (roleScope !== 'ORGANIZATION' && allowedBranchIds.length === 1 ? allowedBranchIds[0] : null);

  // Branch-limited/assigned roles must resolve to exactly one active branch.
  // Org-wide roles may omit selection and retain their organization scope.
  if (roleScope !== 'ORGANIZATION' && !selectedBranchId) return null;

  return {
    roleScope,
    branchId: selectedBranchId,
    allowedBranchIds: [...new Set(allowedBranchIds)],
  };
}

export function isNarrowAiToolBranchScope(scope: AiToolBranchScope): boolean {
  return scope.roleScope !== 'ORGANIZATION' || scope.branchId !== null;
}

/** Public catalog/navigation tools do not query clinic data. */
export const CLINIC_BRANCH_INDEPENDENT_AI_TOOLS = new Set([
  'navigate',
  'searchProducts',
  'searchCourses',
]);

/**
 * Narrow contexts may use only these clinic tools until every query has an
 * explicit branch predicate. The kernel fails closed on all other clinic tools.
 */
export const BRANCH_FILTERED_CLINIC_AI_TOOLS = new Set([
  'searchPatients',
  'getPatientCard',
  'getVisits',
  'getSchedule',
  'createAppointment',
  'updateAppointmentStatus',
  'cancelAppointment',
  'rescheduleAppointment',
  'getTreatmentPlans',
  'createTreatmentPlan',
  'getRevenue',
  'getDebtors',
  'createInvoice',
  'getInventory',
  'getLabOrders',
  'updateLabOrderStatus',
]);

export function patientBranchWhere(scope: AiToolBranchScope): Prisma.PatientWhereInput {
  return scope.branchId ? { branchId: scope.branchId } : {};
}

export function appointmentBranchWhere(scope: AiToolBranchScope): Prisma.AppointmentWhereInput {
  if (!scope.branchId) return {};
  return {
    patient: { branchId: scope.branchId },
    OR: [{ branchId: scope.branchId }, { branchId: null }],
  };
}

export function invoiceBranchWhere(scope: AiToolBranchScope): Prisma.InvoiceWhereInput {
  if (!scope.branchId) return {};
  return {
    patient: { branchId: scope.branchId },
    OR: [{ branchId: scope.branchId }, { branchId: null }],
  };
}

export function inventoryBranchWhere(scope: AiToolBranchScope): Prisma.InventoryItemWhereInput {
  return scope.branchId ? { branchId: scope.branchId } : {};
}

/** LabOrder has no branchId; only patient-linked orders belong to a branch. */
export function labOrderBranchWhere(scope: AiToolBranchScope): Prisma.LabOrderWhereInput {
  return scope.branchId ? { patient: { branchId: scope.branchId } } : {};
}
