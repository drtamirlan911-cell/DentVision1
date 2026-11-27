import { resolveClinicBranchAccess } from '../../../lib/clinicBranchAccess.js';
import { resolveClinicAccess } from '../../../lib/orgContext.js';

const APPOINTMENT_DOCTOR_ROLES = new Set(['DOCTOR', 'OWNER', 'DIRECTOR']);
const BRANCH_VERIFIED_ROLES = ['DOCTOR', 'OWNER', 'DIRECTOR'] as const;

/** Confirm that the appointment assignee is authorized in the target branch. */
export async function resolveAppointmentDoctor(doctorId: string, clinicId: string, branchId?: string | null): Promise<boolean> {
  if (!doctorId || !clinicId) return false;
  if (branchId) {
    for (const role of BRANCH_VERIFIED_ROLES) {
      const access = await resolveClinicBranchAccess({ userId: doctorId, clinicId, role, requestedBranchId: branchId });
      if (access && access.branchId === branchId && access.allowedBranchIds.includes(branchId)) return true;
    }
    return false;
  }
  const access = await resolveClinicAccess(doctorId, clinicId);
  return Boolean(access && APPOINTMENT_DOCTOR_ROLES.has(String(access.role).toUpperCase()));
}
