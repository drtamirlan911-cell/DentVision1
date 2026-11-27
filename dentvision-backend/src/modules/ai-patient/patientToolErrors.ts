/**
 * Patient-facing tool failures must not expose raw exceptions to the model.
 *
 * Database/provider errors can contain patient identifiers, clinical text,
 * SQL parameters or infrastructure details. The patient agent receives only
 * this fixed, non-diagnostic message and must not infer that the record is
 * empty when a lookup failed.
 */
export const PATIENT_TOOL_FAILURE_MESSAGE =
  'Не удалось безопасно получить сведения из медицинской карты. Это не означает, что данных нет. Попробуйте повторить запрос или обратитесь в клинику.';

export function toPatientSafeToolFailure(_error: unknown): { error: string } {
  // Intentionally discard the exception; never serialize message, stack or cause.
  return { error: PATIENT_TOOL_FAILURE_MESSAGE };
}
