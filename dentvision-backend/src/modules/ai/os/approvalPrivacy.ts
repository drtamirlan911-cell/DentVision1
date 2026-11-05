/**
 * PHI protection for the durable AI Approval Center.
 * AiApproval.params is a JSON column; encrypted values are stored as ENC: strings.
 * New writes are encrypted, while legacy JSON objects remain readable during migration.
 */
import { decryptField, encryptField } from '../../../lib/phi.js';

const MARKER = 'ENC:';

export function encryptAiApprovalParams(params: Record<string, unknown>): string {
  const serialized = JSON.stringify(params);
  if (serialized === undefined) throw new Error('[ai approvals] Params must be JSON serializable');
  const encrypted = encryptField(serialized);
  if (!encrypted || !encrypted.startsWith(MARKER)) throw new Error('[ai approvals] Approval params encryption unavailable');
  return encrypted;
}

export function decryptAiApprovalParams(value: unknown): Record<string, unknown> {
  let decoded: unknown = value;
  if (typeof value === 'string') {
    if (!value.startsWith(MARKER)) throw new Error('[ai approvals] Unsupported legacy params representation');
    const plaintext = decryptField(value);
    if (!plaintext || plaintext === value) throw new Error('[ai approvals] Approval params decryption unavailable');
    try { decoded = JSON.parse(plaintext) as unknown; }
    catch { throw new Error('[ai approvals] Decrypted params are not valid JSON'); }
  }
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
    throw new Error('[ai approvals] Approval params must be a JSON object');
  }
  return decoded as Record<string, unknown>;
}

export function encryptAiApprovalDecisionNote(note: string | null): string | null {
  if (note == null) return null;
  const encrypted = encryptField(note);
  if (!encrypted?.startsWith(MARKER)) {
    throw new Error('[ai approvals] Decision note encryption unavailable');
  }
  return encrypted;
}

/** Legacy plaintext decision notes remain compatible; encrypted notes fail closed. */
export function decryptAiApprovalDecisionNote(note: string | null): string | null {
  if (note == null) return null;
  const decrypted = decryptField(note);
  if (note.startsWith(MARKER) && (decrypted === note || decrypted?.startsWith(MARKER))) {
    throw new Error('[ai approvals] Decision note decryption unavailable');
  }
  return decrypted;
}

/** Static summaries never interpolate patient identifiers, titles or free text. */
export function getAiApprovalSummary(tool: string): string {
  switch (tool) {
    case 'createInvoice': return 'Требуется подтверждение: выставление счёта';
    case 'createTreatmentPlan': return 'Требуется подтверждение: создание плана лечения';
    case 'cancelAppointment': return 'Требуется подтверждение: отмена записи';
    case 'getRecallList': return 'Требуется подтверждение: список пациентов для повторного контакта';
    default: return 'Требуется подтверждение действия ИИ';
  }
}

/** Return only fields appropriate for a caller without medical.read. */
export function redactAiApprovalParams(
  tool: string, params: Record<string, unknown>, canReadPhi: boolean,
): Record<string, unknown> {
  if (canReadPhi) return params;
  if (tool === 'createInvoice') {
    return params.amount === undefined || params.amount === null ? {} : { amount: params.amount };
  }
  if (tool === 'getRecallList') {
    return {
      ...(typeof params.inactiveDays === 'number' ? { inactiveDays: params.inactiveDays } : {}),
      ...(typeof params.limit === 'number' ? { limit: params.limit } : {}),
    };
  }
  // Default-deny unknown and patient-linked approval payloads.
  return {};
}
