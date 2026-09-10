/**
 * S3-compatible object storage for uploaded files (X-rays, CBCT, consent
 * documents, STL/DICOM). Env-gated, same shape as the email/Google/Kaspi
 * providers elsewhere in this codebase: without S3_* configured,
 * `storageConfigured()` is false and callers must refuse the upload outright
 * rather than pretend it succeeded — the previous "mock-storage" URL looked
 * like a real path but nothing ever served it, so every uploaded medical
 * file was silently discarded.
 */
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { env } from '../config.js';

let client: S3Client | null = null;

export function storageConfigured(): boolean {
  return !!(env.S3_BUCKET && env.S3_ACCESS_KEY && env.S3_SECRET_KEY);
}

function getClient(): S3Client {
  if (client) return client;
  client = new S3Client({
    region: env.S3_REGION || 'us-east-1',
    endpoint: env.S3_ENDPOINT || undefined,
    // S3-compatible providers behind a custom endpoint (R2, Spaces, MinIO)
    // need path-style addressing; real AWS S3 works with either.
    forcePathStyle: !!env.S3_ENDPOINT,
    credentials: { accessKeyId: env.S3_ACCESS_KEY!, secretAccessKey: env.S3_SECRET_KEY! },
  });
  return client;
}

export async function uploadObject(key: string, body: Buffer, contentType: string): Promise<void> {
  if (!isSafeStorageKey(key)) throw new Error('UNSAFE_STORAGE_KEY');
  await getClient().send(
    new PutObjectCommand({ Bucket: env.S3_BUCKET!, Key: key, Body: body, ContentType: contentType }),
  );
}

export async function deleteObject(key: string): Promise<void> {
  if (!isSafeStorageKey(key)) throw new Error('UNSAFE_STORAGE_KEY');
  await getClient().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET!, Key: key }));
}

/** Short-TTL signed GET — callers must have already checked clinic access. */
export async function signedDownloadUrl(key: string, expiresInSeconds = 300): Promise<string> {
  if (!isSafeStorageKey(key)) throw new Error('UNSAFE_STORAGE_KEY');
  const cmd = new GetObjectCommand({ Bucket: env.S3_BUCKET!, Key: key });
  return getSignedUrl(getClient(), cmd, { expiresIn: expiresInSeconds });
}

// `Document.url` historically held a literal URL (data:, http(s):, or the
// dead mock-storage path). Real object keys are marked with this prefix so
// existing rows and new ones can be told apart without a migration.
const STORAGE_KEY_PREFIX = 's3://';

/**
 * Storage keys are application-generated and must never contain traversal,
 * absolute-path, control-character, or backslash segments. The clinic prefix
 * is mandatory for DentVision medical objects so a compromised document row
 * cannot be turned into a signed URL for an unrelated bucket object.
 */
export function isSafeStorageKey(key: string): boolean {
  if (!key || key.length > 512) return false;
  if (!key.startsWith('clinics/')) return false;
  if (key.includes('..') || key.includes('\\') || key.includes('\0')) return false;
  if (key.startsWith('/') || key.includes('//')) return false;
  return /^[A-Za-z0-9._/-]+$/.test(key);
}

export function toStorageUrl(key: string): string {
  if (!isSafeStorageKey(key)) throw new Error('UNSAFE_STORAGE_KEY');
  return `${STORAGE_KEY_PREFIX}${key}`;
}

export function isStorageKey(url: string): boolean {
  return url.startsWith(STORAGE_KEY_PREFIX);
}

export function keyFromStorageUrl(url: string): string {
  return url.slice(STORAGE_KEY_PREFIX.length);
}
