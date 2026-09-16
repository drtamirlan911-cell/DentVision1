import { useMemo } from 'react';
import { useAuth } from '@/store/auth.store';
import { ecosystemContextFor, ecosystemServicesFor, type EcosystemParticipant } from '@/config/ecosystem';

function participantForRole(role?: string | null): EcosystemParticipant {
  const value = String(role || 'user').toLowerCase();
  if (value === 'doctor' || value === 'owner' || value === 'director' || value === 'admin' || value === 'assistant') return value === 'doctor' ? 'professional' : 'clinic';
  if (value === 'diagnostic_center') return 'diagnostic_center';
  if (value === 'lab_diagnostic' || value === 'medical_laboratory') return 'medical_laboratory';
  if (value === 'laboratory' || value === 'lab' || value === 'dental_laboratory') return 'dental_laboratory';
  if (value === 'supplier') return 'supplier';
  if (value === 'academy') return 'academy';
  if (value === 'lecturer') return 'lecturer';
  if (value === 'student') return 'student';
  if (value === 'employer') return 'employer';
  if (value === 'job_seeker') return 'job_seeker';
  if (value === 'patient') return 'patient';
  return 'professional';
}

export function useEcosystemContext() {
  const { user, clinic } = useAuth();
  return useMemo(() => {
    const role = String((user as any)?.platformRole || (user as any)?.role || 'user').toLowerCase();
    const context = ecosystemContextFor(role, Boolean((user as any)?.clinicId || clinic?.id));
    const participant = participantForRole(role);
    const services = ecosystemServicesFor(participant);
    const organizationName = (user as any)?.organizationName || (user as any)?.clinicName || (user as any)?.organization?.name || clinic?.name || null;
    return { context, participant, services, organizationName, role, hasOrganization: Boolean((user as any)?.organizationId || organizationName), hasClinic: Boolean((user as any)?.clinicId || clinic?.id) };
  }, [user, clinic]);
}

export default useEcosystemContext;
