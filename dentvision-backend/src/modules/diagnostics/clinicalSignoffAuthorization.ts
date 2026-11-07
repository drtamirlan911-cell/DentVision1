import prisma from '../../lib/prisma.js';
import { canAccessReferralBranch } from '../../lib/diagnosticReferralBranchPolicy.js';

export class ClinicalSignoffAuthorizationError extends Error {
  constructor(message = 'Подтверждать и подписывать клинический результат может только уполномоченный врач') {
    super(message);
    this.name = 'ClinicalSignoffAuthorizationError';
  }
}

/**
 * Check the complete scoped role set, not resolveClinicAccess()'s single
 * primary role. Master Spec 5.0 permits OWNER + DOCTOR in one organization;
 * the owner capability must not erase a separate doctor capability.
 */
async function hasScopedClinicDoctorRole(userId: string, clinicId: string): Promise<boolean> {
  const organization = await prisma.organization.findFirst({
    where: { originalType: 'Clinic', originalId: clinicId },
    select: { id: true, archivedAt: true },
  });

  if (organization?.archivedAt) return false;

  if (organization) {
    const doctorPerson = await prisma.person.findFirst({
      where: {
        userId,
        organizationId: organization.id,
        personRoles: {
          some: {
            scopeType: 'organization',
            scopeId: organization.id,
            role: { key: 'doctor' },
          },
        },
      },
      select: { id: true },
    });
    return Boolean(doctorPerson);
  }

  // Legacy fallback is valid only before a clinic has a canonical Organization.
  const member = await prisma.clinicMember.findUnique({
    where: { userId_clinicId: { userId, clinicId } },
    select: { role: true },
  });
  return String(member?.role || '').toUpperCase() === 'DOCTOR';
}

export async function assertClinicDoctorSignoff(input: {
  userId: string;
  clinicId: string | null | undefined;
  branchId: string | null | undefined;
  assignedDoctorId?: string | null;
}): Promise<void> {
  const userId = String(input.userId || '').trim();
  const clinicId = String(input.clinicId || '').trim();
  const branchId = String(input.branchId || '').trim();
  if (!userId || !clinicId || !branchId) {
    throw new ClinicalSignoffAuthorizationError('Для клинической подписи обязательны врач, клиника и филиал направления');
  }
  if (input.assignedDoctorId && input.assignedDoctorId !== userId) {
    throw new ClinicalSignoffAuthorizationError('Подписать результат может только назначенный врач');
  }

  if (!(await hasScopedClinicDoctorRole(userId, clinicId))) {
    throw new ClinicalSignoffAuthorizationError();
  }

  // Independently re-check the persisted clinic membership's branch assignment
  // at the service boundary; a route guard alone is not enough.
  const branchAllowed = await canAccessReferralBranch(
    {
      id: userId,
      role: 'DOCTOR',
      organizationId: null,
      assignedBranchId: null,
      branchIds: [],
      clinicId,
    },
    { clinicId, branchId },
  );
  if (!branchAllowed) {
    throw new ClinicalSignoffAuthorizationError('У врача нет доступа к филиалу направления');
  }
}
