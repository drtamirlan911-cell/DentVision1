import { beforeEach, describe, expect, it, vi } from 'vitest';

const { storageConfigured, uploadObject, signedDownloadUrl } = vi.hoisted(() => ({
  storageConfigured: vi.fn(),
  uploadObject: vi.fn(),
  signedDownloadUrl: vi.fn(),
}));

vi.mock('./storage.js', () => ({
  storageConfigured,
  uploadObject,
  signedDownloadUrl,
  toStorageUrl: (key: string) => `s3://${key}`,
  isStorageKey: (url: string) => url.startsWith('s3://'),
  keyFromStorageUrl: (url: string) => url.replace(/^s3:\/\//, ''),
}));

const { parseDataUri, persistImagePayload, resolveImageUrl, resolveImageUrls } = await import('./imageUrl.js');

// 1×1 transparent PNG.
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const PNG_DATA_URI = `data:image/png;base64,${PNG_BASE64}`;

beforeEach(() => {
  storageConfigured.mockReset().mockReturnValue(true);
  uploadObject.mockReset().mockResolvedValue(undefined);
  signedDownloadUrl.mockReset().mockImplementation(async (key: string) => `https://cdn.test/${key}?sig=x`);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('parseDataUri', () => {
  it('decodes payload, content type and extension', () => {
    const parsed = parseDataUri(PNG_DATA_URI);
    expect(parsed?.contentType).toBe('image/png');
    expect(parsed?.extension).toBe('png');
    expect(parsed?.buffer.length).toBeGreaterThan(0);
  });

  it.each([
    ['an https url', 'https://example.test/x.png'],
    ['a storage key', 's3://patients/p1/x.png'],
    ['an empty payload', 'data:image/png;base64,'],
    ['nonsense', 'not-a-url'],
    ['an empty string', ''],
  ])('returns null for %s', (_label, url) => {
    expect(parseDataUri(url)).toBeNull();
  });
});

describe('persistImagePayload', () => {
  it('uploads a data URI and returns the storage key', async () => {
    const result = await persistImagePayload(PNG_DATA_URI, 'patients/p1/images');

    expect(uploadObject).toHaveBeenCalledTimes(1);
    const [key, body, contentType] = uploadObject.mock.calls[0];
    expect(key).toMatch(/^patients\/p1\/images\/\d+-[a-z0-9]+\.png$/);
    expect(Buffer.isBuffer(body)).toBe(true);
    expect(contentType).toBe('image/png');
    expect(result).toBe(`s3://${key}`);
  });

  it.each([
    ['an https url', 'https://example.test/x.png'],
    ['an existing storage key', 's3://patients/p1/x.png'],
  ])('leaves %s untouched', async (_label, url) => {
    await expect(persistImagePayload(url, 'p')).resolves.toBe(url);
    expect(uploadObject).not.toHaveBeenCalled();
  });

  it('keeps the inline payload when storage is not configured', async () => {
    storageConfigured.mockReturnValue(false);

    await expect(persistImagePayload(PNG_DATA_URI, 'p')).resolves.toBe(PNG_DATA_URI);
    expect(uploadObject).not.toHaveBeenCalled();
  });

  it('keeps the inline payload rather than losing the image when upload fails', async () => {
    uploadObject.mockRejectedValue(new Error('s3 down'));

    await expect(persistImagePayload(PNG_DATA_URI, 'p')).resolves.toBe(PNG_DATA_URI);
  });
});

describe('resolveImageUrl', () => {
  it('signs a storage key so a browser can fetch it', async () => {
    await expect(resolveImageUrl('s3://patients/p1/x.png')).resolves.toBe(
      'https://cdn.test/patients/p1/x.png?sig=x',
    );
  });

  it('passes a legacy data URI through untouched', async () => {
    // Historical rows were never migrated: they must keep rendering, and are
    // directly usable by a vision model as well.
    await expect(resolveImageUrl(PNG_DATA_URI)).resolves.toBe(PNG_DATA_URI);
    expect(signedDownloadUrl).not.toHaveBeenCalled();
  });

  it('passes an external url through untouched', async () => {
    await expect(resolveImageUrl('https://example.test/x.png')).resolves.toBe('https://example.test/x.png');
  });

  it('returns the raw key rather than throwing when signing fails', async () => {
    signedDownloadUrl.mockRejectedValue(new Error('sign failed'));

    await expect(resolveImageUrl('s3://k.png')).resolves.toBe('s3://k.png');
  });

  it('preserves row order and other fields when signing a list', async () => {
    const rows = [
      { id: 'a', url: 's3://one.png', type: 'X_RAY' },
      { id: 'b', url: PNG_DATA_URI, type: 'PHOTO' },
    ];

    const out = await resolveImageUrls(rows);

    expect(out.map((r) => r.id)).toEqual(['a', 'b']);
    expect(out[0]).toMatchObject({ type: 'X_RAY', url: 'https://cdn.test/one.png?sig=x' });
    expect(out[1]).toMatchObject({ type: 'PHOTO', url: PNG_DATA_URI });
  });
});
