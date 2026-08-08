/**
 * Click-wrap consent catalog — the single source of truth for which agreements
 * each kind of party must accept, and the CURRENT version of each. Acceptance
 * is recorded per (user, type) in the `Consent` model; bumping a version here
 * makes previously-accepted consents "stale" so the party is re-prompted
 * (re-acceptance) without any data migration.
 */

export type ConsentAudience =
  | 'all'
  | 'patient'
  | 'clinic'
  | 'supplier'
  | 'center'
  | 'lab'
  | 'lecturer';

export interface RequiredConsent {
  type: string;
  version: string;
  audience: ConsentAudience[];
  title: string;
  /** Blocks "all satisfied" until accepted; non-mandatory are informational. */
  mandatory: boolean;
  /** Where the full text lives (for the UI to link/render). */
  link?: string;
}

/** Bump a `version` to force re-acceptance of that agreement across all parties. */
export const REQUIRED_CONSENTS: RequiredConsent[] = [
  { type: 'terms_of_service', version: '1.0', audience: ['all'], title: 'Пользовательское соглашение', mandatory: true, link: '/legal/terms' },
  { type: 'privacy_policy', version: '1.0', audience: ['all'], title: 'Политика конфиденциальности', mandatory: true, link: '/legal/privacy' },
  { type: 'data_processing', version: '1.0', audience: ['patient'], title: 'Согласие на обработку персональных и медицинских данных', mandatory: true, link: '/legal/data-processing' },
  { type: 'platform_offer', version: '1.0', audience: ['clinic', 'supplier', 'center', 'lab', 'lecturer'], title: 'Публичная оферта платформы DentVision', mandatory: true, link: '/legal/offer' },
];

export type ConsentState = 'accepted' | 'stale' | 'missing';

export interface ConsentStatusItem {
  type: string;
  title: string;
  requiredVersion: string;
  acceptedVersion: string | null;
  status: ConsentState;
  mandatory: boolean;
  link?: string;
}

export interface ConsentStatus {
  items: ConsentStatusItem[];
  /** Mandatory consents still missing or stale (empty ⇒ click-wrap satisfied). */
  pending: string[];
  allSatisfied: boolean;
}

export function audienceMatches(consent: RequiredConsent, audience: ConsentAudience): boolean {
  return consent.audience.includes('all') || consent.audience.includes(audience);
}

/** Current required version for a type (used when recording an acceptance). */
export function requiredVersionFor(type: string): string | null {
  return REQUIRED_CONSENTS.find((c) => c.type === type)?.version ?? null;
}

/**
 * Pure: given the catalog, a user's recorded consents, and the party's audience,
 * classify each applicable agreement as accepted / stale (version changed) /
 * missing, and report which mandatory ones are still pending.
 */
export function computeConsentStatus(
  required: RequiredConsent[],
  existing: Array<{ type: string; version: string; accepted: boolean }>,
  audience: ConsentAudience,
): ConsentStatus {
  const byType = new Map(existing.map((c) => [c.type, c]));
  const items: ConsentStatusItem[] = [];

  for (const r of required) {
    if (!audienceMatches(r, audience)) continue;
    const cur = byType.get(r.type);
    let status: ConsentState;
    if (!cur || !cur.accepted) status = 'missing';
    else if (cur.version !== r.version) status = 'stale';
    else status = 'accepted';
    items.push({
      type: r.type,
      title: r.title,
      requiredVersion: r.version,
      acceptedVersion: cur?.accepted ? cur.version : null,
      status,
      mandatory: r.mandatory,
      link: r.link,
    });
  }

  const pending = items.filter((i) => i.mandatory && i.status !== 'accepted').map((i) => i.type);
  return { items, pending, allSatisfied: pending.length === 0 };
}

/** Map a user role / org type to the consent audience it must satisfy. */
export function audienceForRole(input: {
  role?: string | null;
  organizationType?: string | null;
  personType?: string | null;
}): ConsentAudience {
  const org = String(input.organizationType || '').toLowerCase();
  const person = String(input.personType || '').toLowerCase();
  const role = String(input.role || '').toLowerCase();
  if (org.includes('supplier') || role.includes('supplier')) return 'supplier';
  if (org.includes('diagnostic') || org.includes('center')) return 'center';
  if (org.includes('lab')) return 'lab';
  if (person.includes('lecturer') || role.includes('lecturer')) return 'lecturer';
  if (role === 'patient' || person.includes('patient')) return 'patient';
  if (org.includes('clinic') || role === 'owner' || role === 'admin' || role === 'doctor') return 'clinic';
  return 'all';
}
