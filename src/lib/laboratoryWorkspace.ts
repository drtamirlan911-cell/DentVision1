export type LaboratoryWorkspaceKind = 'medical' | 'dental' | 'generic';

export interface LaboratoryWorkspaceIdentity {
  workspaceParam?: string | null;
  roleKey?: string | null;
  effectiveRole?: string | null;
  organizationType?: string | null;
}

/**
 * Resolve the laboratory UI from the scoped membership first.
 *
 * Both dental and medical laboratories currently share the LABORATORY
 * organization type and map to legacy JWT roles such as OWNER. The
 * organization-scoped PersonRole key is therefore the authoritative UI
 * discriminator; route hints and legacy claims are compatibility fallbacks.
 */
export function resolveLaboratoryWorkspaceKind(identity: LaboratoryWorkspaceIdentity): LaboratoryWorkspaceKind {
  const roles = [identity.roleKey, identity.effectiveRole]
    .flatMap((value) => String(value || '').split(','))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  // Legacy dental-lab memberships may carry a mixed fallback role list
  // containing medical_lab_technician as well as dental_technician. The
  // dental scope must win for that compatibility payload; canonical
  // medical-lab roles remain unambiguous and resolve to medical below.
  if (roles.some((role) => role.startsWith('dental_lab_')
    || ['dental_technician', 'cad_designer', 'ceramist', 'orthodontic_technician', 'qc_specialist', 'lab_coordinator'].includes(role))) return 'dental';
  if (roles.some((role) => role.startsWith('medical_lab_'))) return 'medical';
  if (identity.workspaceParam === 'medical-lab') return 'medical';

  const organizationType = String(identity.organizationType || '').trim().toUpperCase();
  if (organizationType === 'LABORATORY' || organizationType === 'MEDICAL_LABORATORY' || organizationType === 'DENTAL_LABORATORY') {
    return 'dental';
  }

  return 'generic';
}
