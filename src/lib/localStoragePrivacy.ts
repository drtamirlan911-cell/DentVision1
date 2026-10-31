const SENSITIVE_PATIENT_KEYS = new Set([
  'iin', 'patientiin', 'medicalhistory', 'medicalrecord', 'medicalcard',
  'patientphone', 'phone', 'phonenumber', 'mobile', 'telephone',
  'patientname', 'patientemail', 'email', 'address', 'dob', 'dateofbirth',
  'diagnosis', 'clinicalnotes', 'medicalnotes', 'notes', 'reason',
  // Procedure labels and tooth numbers reveal clinical details even after names and notes are removed.
  // `service` can be a human-readable treatment label; `serviceId` is the opaque sync key.
  'service', 'servicename', 'toothnumber',
]);

function normalizedKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function containsSensitiveIdentifierText(value: string): boolean {
  if (/\b\d{12}\b/.test(value)) return true;
  // Phone numbers embedded in labels/notes are PHI too; redact them even with surrounding text.
  if (/(?:\+?7|8)[\s()-]?\d{3}[\s()-]?\d{3}[\s()-]?\d{2}[\s()-]?\d{2}/.test(value)) return true;
  const compact = value.replace(/[\s()+-]/g, '');
  return /^(?:7|8)?\d{10,11}$/.test(compact);
}

/** Detect fields or obvious identifier text that should not enter browser storage. */
export function containsSensitivePatientData(value: unknown): boolean {
  if (typeof value === 'string') return containsSensitiveIdentifierText(value);
  if (Array.isArray(value)) return value.some(containsSensitivePatientData);
  if (!value || typeof value !== 'object') return false;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_PATIENT_KEYS.has(normalizedKey(key))) return true;
    if (containsSensitivePatientData(child)) return true;
  }
  return false;
}

/** Redact patient identifiers and clinical text from offline schedule payloads. */
export function sanitizeForLocalStorage<T>(value: T): T {
  if (Array.isArray(value)) {
    // Array primitives are not reached by the object-field checks below.
    // Redact identifier-like text there too, while preserving opaque IDs in named fields.
    const safeItems = value.filter((item) => {
      if (typeof item === 'string') return !containsSensitiveIdentifierText(item);
      if (typeof item === 'number') return !containsSensitiveIdentifierText(String(item));
      return true;
    });
    return safeItems.map((item) => sanitizeForLocalStorage(item)) as T;
  }
  if (!value || typeof value !== 'object') return value;
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_PATIENT_KEYS.has(normalizedKey(key))) continue;
    // A generic field (e.g. label/description) can still contain an IIN or
    // phone number. Do not preserve such values just because the property name
    // is not obviously patient-related.
    if (typeof child === 'string' && containsSensitiveIdentifierText(child)) continue;
    if (typeof child === 'number' && containsSensitiveIdentifierText(String(child))) continue;
    result[key] = sanitizeForLocalStorage(child);
  }
  return result as T;
}

/** Some drafts are inherently patient/clinical scoped even without obvious field names. */
export function isPatientScopedDraftKey(key: string): boolean {
  return /patient|medical|medcard|clinical|odontogram|diagnosis|treatment[-_ ]?plan/i.test(key);
}
