// ═══════════════════════════════════════════════════════════════════
// SECURITY UTILS — клиентская валидация, rate limiting, CSP
// ═══════════════════════════════════════════════════════════════════

const _rateLimitStore: Map<string, { start: number; count: number }> = new Map();

export function rateLimit(key: string, { maxAttempts = 5, windowMs = 60000 }: { maxAttempts?: number; windowMs?: number } = {}): boolean {
  const now = Date.now();
  const entry = _rateLimitStore.get(key);
  if (!entry || now - entry.start > windowMs) {
    _rateLimitStore.set(key, { start: now, count: 1 });
    return true;
  }
  entry.count++;
  return entry.count <= maxAttempts;
}

export function sanitizeInput(str: unknown): string {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '').replace(/javascript:/gi, '').replace(/on\w+=/gi, '').trim().slice(0, 2000);
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
}

/**
 * The server's policy, restated (`lib/password.ts::assertPasswordPolicy`):
 * at least 8 characters, with a letter and a digit.
 *
 * This used to accept 6 characters with no character requirement, so a password
 * could pass the client check and then be rejected by the server — the user saw
 * a failure only after submitting, with no idea which rule they had broken.
 * Returns the reason rather than a bare boolean so the form can say it.
 */
export function passwordPolicyError(pw: unknown): string | null {
  if (typeof pw !== 'string' || !pw) return 'Введите пароль';
  if (pw.length < 8) return 'Пароль должен быть не короче 8 символов';
  if (pw.length > 128) return 'Пароль слишком длинный';
  if (!/[A-Za-zА-Яа-я]/.test(pw) || !/\d/.test(pw)) {
    return 'Пароль должен содержать буквы и цифры';
  }
  return null;
}

export function validatePassword(pw: unknown): boolean {
  return passwordPolicyError(pw) === null;
}

export function generateCSRFToken(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

let _csrfToken: string | null = null;
export function getCSRFToken(): string {
  if (!_csrfToken) _csrfToken = generateCSRFToken();
  return _csrfToken;
}

const CSP_DIRECTIVES: Record<string, string[]> = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'blob:'],
  'connect-src': ["'self'"],
  'font-src': ["'self'"],
  'object-src': ["'none'"],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
};

export function getCSPHeader(): string {
  return Object.entries(CSP_DIRECTIVES)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ');
}

export function escapeHtml(str: unknown): string {
  if (!str) return '';
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(str).replace(/[&<>"']/g, (c) => map[c]);
}
