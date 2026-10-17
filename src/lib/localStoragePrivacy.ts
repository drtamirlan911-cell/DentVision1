const SENSITIVE_PATIENT_KEYS = new Set([
  'iin', 'patientiin', 'medicalhistory', 'medicalrecord', 'medicalcard',
  'patientphone', 'phone', 'phonenumber', 'mobile', 'telephone',
  'patientname', 'patientemail', 'email', 'address', 'dob', 'dateofbirth',
  'diagnosis', 'clinicalnotes', 'medicalnotes', 'notes',
]);

function normalizedKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function containsSensitiveIdentifierText(value: string): boolean {
  if (/\b\d{12}\b/.test(value)) return true;
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
  if (Array.isArray(value)) return value.map((item) => sanitizeForLocalStorage(item)) as T;
  if (!value || typeof value !== 'object') return value;
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_PATIENT_KEYS.has(normalizedKey(key))) continue;
    result[key] = sanitizeForLocalStorage(child);
  }
  return result as T;
}

/** Some drafts are inherently patient/clinical scoped even without obvious field names. */
export function isPatientScopedDraftKey(key: string): boolean {
  return /patient|medical|medcard|clinical|odontogram|diagnosis|treatment[-_ ]?plan/i.test(key);
}
