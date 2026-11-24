import prisma from '../../lib/prisma.js';
import { canAccessReferralBranch } from '../../lib/diagnosticReferralBranchPolicy.js';

export class ClinicalSignoffAuthorizationError extends Error {
  constructor(message = 'Подтверждать и подписывать клинический результат может только уполномоченный врач') {
    super(message);
    this.name = 'ClinicalSignoffAuthorizationError';
  }
}

type VerifiedClinicDoctorContext = {
  organizationId: string;
  organizationOriginalId: string;
  organizationType: 'CLINIC';
  branchIds: string[];
};

/**
 * Resolve the complete clinical identity and its active branch allow-list.
 * Do not call the referral policy with an incomplete synthetic user: that
 * policy correctly requires a verified clinic Organization context and either
 * canonical BranchMember or exact active legacy ClinicMember evidence.
 */
async function resolveScopedClinicDoctorContext(
  userId: string,
  clinicId: string,
): Promise<VerifiedClinicDoctorContext | null> {
  const organization = await prisma.organization.findFirst({
    where: { originalType: 'Clinic', originalId: clinicId },
    select: { id: true, originalId: true, type: true, archivedAt: true },
  });

  if (organization?.archivedAt) return null;

  if (organization) {
    if (organization.type !== 'CLINIC' || organization.originalId !== clinicId) return null;
    const person = await prisma.person.findFirst({
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
      select: {
        id: true,
        branchMemberships: {
          where: { active: true, branch: { is: { active: true } } },
          select: { branchId: true },
        },
      },
    });
    if (!person) return null;
    return {
      organizationId: organization.id,
      organizationOriginalId: clinicId,
      organizationType: 'CLINIC',
      branchIds: Array.from(new Set(person.branchMemberships.map((membership) => membership.branchId))),
    };
  }

  // Legacy fallback is valid only before a clinic has a canonical Organization.
  // The selected Branch relation is checked as active before the ID is trusted.
  const member = await prisma.clinicMember.findUnique({
    where: { userId_clinicId: { userId, clinicId } },
    select: { role: true, branchId: true, branch: { select: { active: true } } },
  });
  if (String(member?.role || '').toUpperCase() !== 'DOCTOR') return null;
  const branchIds = member?.branchId && member.branch?.active === true ? [member.branchId] : [];
  return {
    organizationId: clinicId,
    organizationOriginalId: clinicId,
    organizationType: 'CLINIC',
    branchIds,
  };
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

  const context = await resolveScopedClinicDoctorContext(userId, clinicId);
  if (!context) throw new ClinicalSignoffAuthorizationError();

  // Revalidate exact active clinic/branch ownership at the service boundary.
  // Canonical-only BranchMember users and legacy ClinicMember users are both
  // supported, but an archived/foreign branch never enters this allow-list.
  const branchAllowed = await canAccessReferralBranch(
    {
      id: userId,
      role: 'DOCTOR',
      organizationId: context.organizationId,
      organizationOriginalId: context.organizationOriginalId,
      organizationType: context.organizationType,
      assignedBranchId: null,
      branchIds: context.branchIds,
      clinicId,
    },
    { clinicId, branchId },
  );
  if (!branchAllowed) {
    throw new ClinicalSignoffAuthorizationError('У врача нет доступа к филиалу направления');
  }
}
