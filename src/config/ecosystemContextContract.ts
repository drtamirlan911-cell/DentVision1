import type { EcosystemParticipant } from './ecosystem';

export interface EcosystemContextRef {
  participant: EcosystemParticipant;
  userId?: string;
  organizationId?: string;
  organizationName?: string;
  branchId?: string;
  branchName?: string;
  clinicId?: string;
  clinicName?: string;
  caseId?: string;
  patientId?: string;
}

export interface EcosystemActionContext extends EcosystemContextRef {
  actionId: string;
  intent?: string;
  source?: string;
}

export const EMPTY_ECOSYSTEM_CONTEXT: EcosystemContextRef = {
  participant: 'patient',
};

export function withCaseContext(context: EcosystemContextRef, caseId: string, patientId?: string): EcosystemContextRef {
  return { ...context, caseId, patientId: patientId ?? context.patientId };
}

export function withBranchContext(context: EcosystemContextRef, branchId: string, branchName?: string): EcosystemContextRef {
  return { ...context, branchId, branchName };
}
