import * as Sentry from '@sentry/node';
import { execSync } from 'node:child_process';
import type { Breadcrumb, ErrorEvent } from '@sentry/node';

const PHI_KEYS = [
  'iin',
  'medicalhistory',
  'phone',
  'email',
  'patientname',
  'password',
  'token',
  'authorization',
  'cookie',
  'idtoken',
  'credential',
];

const UUID_PATTERN = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi;

export function isSentryEnabled(): boolean {
  return Boolean(process.env.SENTRY_DSN);
}

function getRelease(): string | undefined {
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || undefined;
  } catch {
    return undefined;
  }
}

function isPhiKey(key: string): boolean {
  return PHI_KEYS.includes(key.toLowerCase());
}

function scrubValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(scrubValue);
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (isPhiKey(key)) continue;
      out[key] = scrubValue(val);
    }
    return out;
  }
  return value;
}

export function normalizeUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  return url.replace(UUID_PATTERN, '/:id');
}

export function sanitizeEvent(event: ErrorEvent): ErrorEvent {
  if (event.request?.url) {
    event.request.url = normalizeUrl(event.request.url);
  }
  if (event.request?.data) {
    event.request.data = scrubValue(event.request.data);
  }
  if (event.request?.cookies) {
    event.request.cookies = scrubValue(event.request.cookies) as Record<string, string>;
  }
  if (event.request?.headers) {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(event.request.headers)) {
      // Header names match by substring so `x-api-token`, `x-auth-token`,
      // `x-credential` etc. are caught too, not just the exact key.
      const lower = key.toLowerCase();
      if (PHI_KEYS.some((phi) => lower.includes(phi))) continue;
      headers[key] = value;
    }
    event.request.headers = headers;
  }
  if (event.extra) {
    event.extra = scrubValue(event.extra) as Record<string, unknown>;
  }
  return event;
}

export function sanitizeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
    if (breadcrumb.data) {
      delete breadcrumb.data.request_body;
      delete breadcrumb.data.response_body;
    }
  }
  return breadcrumb;
}

function beforeSend(event: ErrorEvent): ErrorEvent | null {
  return sanitizeEvent(event);
}

function beforeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  return sanitizeBreadcrumb(breadcrumb);
}

export function initSentry(): void {
  if (!isSentryEnabled()) return;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: getRelease(),
    tracesSampleRate: 0,
    sendDefaultPii: false,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: { deny: PHI_KEYS }, response: true },
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
    },
    beforeSend,
    beforeBreadcrumb,
  });
}
