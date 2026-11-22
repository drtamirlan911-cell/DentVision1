export type MedicalLabCapability =
  | 'specimen.collect'
  | 'specimen.receive'
  | 'order.process'
  | 'order.cancel'
  | 'result.write'
  | 'result.verify'
  | 'result.interpret'
  | 'quality.perform'
  | 'finance.read'
  | 'finance.manage';

const ROLE_CAPABILITIES: Record<string, readonly MedicalLabCapability[]> = {
  medical_lab_owner: ['specimen.collect', 'specimen.receive', 'order.process', 'order.cancel', 'quality.perform', 'finance.read', 'finance.manage'],
  medical_lab_admin: ['specimen.collect', 'specimen.receive', 'order.process', 'order.cancel', 'quality.perform', 'finance.read'],
  medical_lab_manager: ['specimen.collect', 'specimen.receive', 'order.process', 'order.cancel', 'quality.perform', 'finance.read'],
  medical_lab_reception: ['specimen.collect', 'specimen.receive', 'order.cancel', 'finance.read'],
  medical_lab_technician: ['specimen.collect', 'specimen.receive', 'order.process', 'result.write'],
  medical_lab_validator: ['result.verify'],
  medical_lab_doctor: ['result.interpret'],
  medical_lab_quality: ['quality.perform'],
  medical_lab_finance: ['finance.read', 'finance.manage'],
};

/**
 * Capabilities are derived from canonical, organization-scoped PersonRole keys.
 * The generic JWT role (OWNER/ADMIN/LAB) is not enough to authorize laboratory
 * result entry, quality sign-off or clinical validation.
 */
export function medicalLabRoleAllows(
  roleKeys: readonly string[],
  capability: MedicalLabCapability,
): boolean {
  return roleKeys.some((key) => (ROLE_CAPABILITIES[String(key || '').trim().toLowerCase()] || []).includes(capability));
}

export function medicalLabRolesForWorkspace(roleKeys: readonly string[]): string[] {
  return Array.from(new Set(roleKeys.map((key) => String(key || '').trim().toLowerCase())
    .filter((key) => Object.prototype.hasOwnProperty.call(ROLE_CAPABILITIES, key)))).sort();
}

export const MEDICAL_LAB_CAPABILITIES: readonly MedicalLabCapability[] = [
  'specimen.collect',
  'specimen.receive',
  'order.process',
  'order.cancel',
  'result.write',
  'result.verify',
  'result.interpret',
  'quality.perform',
  'finance.read',
  'finance.manage',
];

export function medicalLabCapabilitiesForRoles(roleKeys: readonly string[]): MedicalLabCapability[] {
  return MEDICAL_LAB_CAPABILITIES.filter((capability) => medicalLabRoleAllows(roleKeys, capability));
}

/** Legacy fallback may be used only when exactly one laboratory membership exists. */
export function selectUniqueMedicalLabMembershipId(
  memberships: readonly { labId?: string | null }[],
): string | null {
  if (memberships.length !== 1) return null;
  const labId = String(memberships[0]?.labId || '').trim();
  return labId || null;
}
