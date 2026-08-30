/**
 * Where a patient image lives, and how to hand it to a browser or a model.
 *
 * Three shapes are in circulation, and all three have to keep working:
 *
 *  - `data:image/png;base64,…` — what the CRM has always sent. Whole
 *    radiographs sat in a Postgres column this way. Existing rows are left
 *    exactly as they are: rewriting historical medical records to save disk is
 *    not a trade worth making, and a data URI is directly usable by both a
 *    browser and a vision model.
 *  - `s3://key` — what `/api/files/upload` already wrote, and what new uploads
 *    write from now on. Unusable as-is: it has to be signed before anyone can
 *    fetch it.
 *  - `https://…` — an external URL, passed through untouched.
 */

import {
  isStorageKey,
  keyFromStorageUrl,
  signedDownloadUrl,
  storageConfigured,
  toStorageUrl,
  uploadObject,
} from './storage.js';

const DATA_URI_RE = /^data:([\w.+-]+\/[\w.+-]+);base64,(.+)$/is;

export interface ParsedDataUri {
  buffer: Buffer;
  contentType: string;
  extension: string;
}

const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/dicom': 'dcm',
  'application/pdf': 'pdf',
};

export function parseDataUri(url: string): ParsedDataUri | null {
  const match = DATA_URI_RE.exec(String(url || ''));
  if (!match) return null;
  const contentType = match[1].toLowerCase();
  try {
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length === 0) return null;
    return {
      buffer,
      contentType,
      extension: EXTENSION_BY_TYPE[contentType] || 'bin',
    };
  } catch {
    return null;
  }
}

/**
 * Move an inbound data URI into object storage; anything else passes through.
 *
 * Returns the original string when storage is unconfigured or the upload
 * fails, so a clinic without S3 keeps working exactly as before rather than
 * losing the image. Callers therefore must not assume the result is a key.
 */
export async function persistImagePayload(url: string, keyPrefix: string): Promise<string> {
  const parsed = parseDataUri(url);
  if (!parsed || !storageConfigured()) return url;

  const key = `${keyPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${parsed.extension}`;
  try {
    await uploadObject(key, parsed.buffer, parsed.contentType);
    return toStorageUrl(key);
  } catch (error) {
    console.error('[imageUrl] upload failed, keeping inline payload:', error);
    return url;
  }
}

/**
 * A URL a browser or a model can actually fetch.
 *
 * `GET /api/medical/images/:patientId` used to return `s3://…` verbatim for
 * anything uploaded through `/api/files/upload`, which no `<img>` could render.
 */
export async function resolveImageUrl(url: string, expiresInSeconds = 300): Promise<string> {
  const raw = String(url || '');
  if (!raw) return raw;
  if (!isStorageKey(raw)) return raw;
  if (!storageConfigured()) return raw;
  try {
    return await signedDownloadUrl(keyFromStorageUrl(raw), expiresInSeconds);
  } catch (error) {
    console.error('[imageUrl] signing failed:', error);
    return raw;
  }
}

/** Sign every row's `url` in place-free fashion, preserving order. */
export async function resolveImageUrls<T extends { url: string }>(
  rows: T[],
  expiresInSeconds = 300,
): Promise<T[]> {
  return Promise.all(
    rows.map(async (row) => ({ ...row, url: await resolveImageUrl(row.url, expiresInSeconds) })),
  );
}
