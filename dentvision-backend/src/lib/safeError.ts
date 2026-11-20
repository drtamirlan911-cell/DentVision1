/**
 * Return only a safe error classification for operational logs.
 *
 * Error messages, stacks, SQL parameters and provider payloads may contain
 * patient or other personal/clinical data. Callers should never log the
 * original exception object or its message.
 */
export type SafeErrorKind = 'Error' | 'NonError';

export function safeErrorKind(error: unknown): SafeErrorKind {
  return error instanceof Error ? 'Error' : 'NonError';
}
