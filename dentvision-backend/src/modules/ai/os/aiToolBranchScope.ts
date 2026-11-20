import type { Prisma } from '@prisma/client';
import {
  resolveClinicBranchAccess,
  type ClinicBranchAccess,
} from '../../../lib/clinicBranchAccess.js';

export type AiToolBranchScope = ClinicBranchAccess;

export interface AiToolBranchScopeInput {
  userId: string;
  clinicId: string;
  organizationId?: string | null;
  role: string;
  /** Untrusted selected-branch hint, always checked against current DB membership. */
  requestedBranchId?: string | null;
}

export async function resolveAiToolBranchScope(
  input: AiToolBranchScopeInput,
): Promise<AiToolBranchScope | null> {
  return resolveClinicBranchAccess(input);
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
