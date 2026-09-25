import { useMemo } from 'react';
import { useAuth } from '@/store/auth.store';
import { ecosystemContextFor, ecosystemServicesFor, type EcosystemParticipant } from '@/config/ecosystem';

function participantForOrganizationType(type?: string | null): EcosystemParticipant | null {
  const value = String(type || '').trim().toLowerCase();
  if (value === 'dental_clinic' || value === 'clinic') return 'clinic';
  if (value === 'diagnostic_center' || value === 'diagnostics') return 'diagnostic_center';
  if (value === 'medical_laboratory' || value === 'medical_lab' || value === 'lab_diagnostic') return 'medical_laboratory';
  if (value === 'dental_laboratory' || value === 'dental_lab' || value === 'laboratory') return 'dental_laboratory';
  if (value === 'supplier' || value === 'distributor') return 'supplier';
  if (value === 'manufacturer') return 'supplier';
  if (value === 'academy' || value === 'education_center') return 'academy';
  if (value === 'lecturer') return 'lecturer';
  if (value === 'employer') return 'employer';
  if (value === 'professional_group') return 'community';
  return null;
}

function participantForRole(role?: string | null): EcosystemParticipant {
  const value = String(role || 'user').toLowerCase();
  if (value === 'doctor' || value === 'dentist' || value === 'professional') return 'professional';
  if (value === 'lecturer') return 'lecturer';
  if (value === 'student') return 'student';
  if (value === 'job_seeker') return 'job_seeker';
  if (value === 'employer') return 'employer';
  if (value === 'patient' || value === 'buyer') return 'patient';
  if (value === 'supplier' || value === 'seller' || value === 'manufacturer') return 'supplier';
  if (value === 'academy') return 'academy';
  if (value === 'diagnostic_center') return 'diagnostic_center';
  if (value === 'lab_diagnostic' || value === 'medical_laboratory') return 'medical_laboratory';
  if (value === 'laboratory' || value === 'lab' || value === 'dental_laboratory') return 'dental_laboratory';
  return 'professional';
}

export function useEcosystemContext() {
  const { user, clinic, activeMembership, activeWorkspace } = useAuth();
  return useMemo(() => {
    const rawUser = user as any;
    const membership = activeMembership as any;
    const role = String(activeWorkspace?.roleLabel || membership?.role || rawUser?.effectiveRole || rawUser?.platformRole || rawUser?.role || 'user').toLowerCase();

    // Organization type is authoritative for the cabinet/participant. A global
    // OWNER/ADMIN role is deliberately not interpreted as "clinic": the same
    // person may own a diagnostic center, laboratory, academy, supplier, etc.
    const organizationType =
      activeWorkspace?.scopeType ||
      membership?.organization?.type ||
      membership?.clinic?.organizationType ||
      membership?.clinic?.type ||
      rawUser?.activeOrganization?.type ||
      rawUser?.organization?.type ||
      rawUser?.organizationType ||
      null;

    const participant = participantForOrganizationType(organizationType) || participantForRole(role);
    const hasClinic = Boolean(rawUser?.clinicId || clinic?.id || membership?.clinicId);
    const context = ecosystemContextFor(
      organizationType || role,
      hasClinic && participant === 'clinic',
    );
    const services = ecosystemServicesFor(participant);
    const organizationName =
      activeWorkspace?.name ||
      membership?.organization?.name ||
      rawUser?.activeOrganization?.name ||
      rawUser?.organization?.name ||
      rawUser?.organizationName ||
      rawUser?.clinicName ||
      clinic?.name ||
      membership?.clinic?.name ||
      null;

    return {
      context,
      participant,
      services,
      organizationName,
      organizationType,
      role,
      hasOrganization: Boolean(rawUser?.organizationId || rawUser?.activeOrganization?.id || organizationName),
      hasClinic,
    };
  }, [user, clinic, activeMembership]);
}

export default useEcosystemContext;
