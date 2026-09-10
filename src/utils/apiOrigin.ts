/**
 * Single browser API origin for all direct fetches.
 * VITE_API_URL is authoritative in every environment; the Render fallback is
 * intentionally independent of the frontend hostname so custom domains work.
 */
export const API_URL: string =
  String(import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '') ||
  'https://dentvision-api.onrender.com';
