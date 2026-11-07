import { resolveClinicAccess } from '../../lib/orgContext.js';

export class ClinicalSignoffAuthorizationError extends Error {
  constructor(message = 'Подтверждать и подписывать клинический результат может только уполномоченный врач') {
    super(message);
    this.name = 'ClinicalSignoffAuthorizationError';
  }
}

export async function assertClinicDoctorSignoff(input: {
  userId: string;
  clinicId: string | null | undefined;
  assignedDoctorId?: string | null;
}): Promise<void> {
  const userId = String(input.userId || '').trim();
  const clinicId = String(input.clinicId || '').trim();
  if (!userId || !clinicId) throw new ClinicalSignoffAuthorizationError();
  if (input.assignedDoctorId && input.assignedDoctorId !== userId) {
    throw new ClinicalSignoffAuthorizationError('Подписать результат может только назначенный врач');
  }

  // Resolve the live persisted clinic role. The JWT role and platform
  // SUPERADMIN privilege are not sufficient to establish clinical authority.
  const access = await resolveClinicAccess(userId, clinicId);
  if (!access || String(access.role).toUpperCase() !== 'DOCTOR') {
    throw new ClinicalSignoffAuthorizationError();
  }
}
