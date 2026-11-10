import {
  decryptMedicalHistory,
  isStructuredMedicalHistoryRoot,
} from '../../lib/phi.js';

const TOP_LEVEL_HISTORY_FIELDS = [
  'category',
  'source',
  'allergies',
  'tags',
  'teeth',
] as const;

/**
 * Build the next structured history for the authenticated Patient upsert.
 *
 * Existing history is decoded only after the caller has established clinic
 * and branch access. Omitted fields are preserved; explicitly supplied
 * top-level aliases replace their corresponding value, including empty
 * strings, null and empty arrays. An explicit medicalHistory:null clears the
 * previous object. Incoming object fields are merged so partial callers do
 * not erase unrelated clinical history.
 *
 * A legacy scalar Patient Portal value cannot be merged safely. It must be
 * explicitly replaced with an object or cleared; a teeth-only/profile update
 * must never silently discard it.
 */
export function mergePatientMedicalHistory(
  storedHistory: unknown,
  body: Record<string, unknown>,
): Record<string, unknown> {
  const decoded = decryptMedicalHistory(storedHistory);
  const incomingProvided = Object.prototype.hasOwnProperty.call(body, 'medicalHistory');
  const incoming = body.medicalHistory;

  if (incoming !== undefined && incoming !== null && !isStructuredMedicalHistoryRoot(incoming)) {
    throw new Error('PATIENT_HISTORY_INVALID_INPUT');
  }

  const existingIsStructured = decoded == null || isStructuredMedicalHistoryRoot(decoded);
  let next: Record<string, unknown>;

  if (!existingIsStructured) {
    if (!incomingProvided) {
      throw new Error('PATIENT_HISTORY_LEGACY_SCALAR');
    }
    // An explicit object is treated as a full replacement for a legacy scalar;
    // null is the explicit clear operation.
    next = incoming === null ? {} : { ...(incoming as Record<string, unknown>) };
  } else {
    const existing = decoded == null ? {} : decoded as Record<string, unknown>;
    next = incoming === null
      ? {}
      : { ...existing, ...(incoming as Record<string, unknown> | undefined) };
  }

  for (const key of TOP_LEVEL_HISTORY_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      next[key] = body[key];
    }
  }

  return next;
}
