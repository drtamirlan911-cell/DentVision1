import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { sendMock, getSignedUrlMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  getSignedUrlMock: vi.fn(),
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class { send = sendMock },
  PutObjectCommand: class { constructor(public input: unknown) {} },
  GetObjectCommand: class { constructor(public input: unknown) {} },
  DeleteObjectCommand: class { constructor(public input: unknown) {} },
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: getSignedUrlMock,
}));

vi.mock('../config.js', () => ({
  env: {
    S3_ENDPOINT: '',
    S3_REGION: '',
    S3_BUCKET: 'test-bucket',
    S3_ACCESS_KEY: 'key',
    S3_SECRET_KEY: 'secret',
  },
}));

describe('storage', () => {
  beforeEach(() => {
    sendMock.mockReset();
    getSignedUrlMock.mockReset();
    vi.resetModules();
  });
  afterEach(() => vi.restoreAllMocks());

  it('reports configured when all three S3 vars are set', async () => {
    const { storageConfigured } = await import('./storage.js');
    expect(storageConfigured()).toBe(true);
  });

  it('uploads a buffer with the given key and content type', async () => {
    sendMock.mockResolvedValueOnce({});
    const { uploadObject } = await import('./storage.js');
    await uploadObject('clinics/c1/f1.jpg', Buffer.from('data'), 'image/jpeg');
    expect(sendMock).toHaveBeenCalledTimes(1);
    const arg = sendMock.mock.calls[0][0];
    expect(arg.input).toMatchObject({ Bucket: 'test-bucket', Key: 'clinics/c1/f1.jpg', ContentType: 'image/jpeg' });
  });

  it('generates a signed URL for a key', async () => {
    getSignedUrlMock.mockResolvedValueOnce('https://signed.example/clinics/c1/f1.jpg?sig=abc');
    const { signedDownloadUrl } = await import('./storage.js');
    const url = await signedDownloadUrl('clinics/c1/f1.jpg');
    expect(url).toBe('https://signed.example/clinics/c1/f1.jpg?sig=abc');
    expect(getSignedUrlMock).toHaveBeenCalled();
  });

  it('round-trips keys through toStorageUrl/isStorageKey/keyFromStorageUrl', async () => {
    const { toStorageUrl, isStorageKey, keyFromStorageUrl } = await import('./storage.js');
    const url = toStorageUrl('clinics/c1/f1.jpg');
    expect(isStorageKey(url)).toBe(true);
    expect(isStorageKey('https://example.com/x')).toBe(false);
    expect(isStorageKey('/mock-storage/f1/f1.jpg')).toBe(false);
    expect(keyFromStorageUrl(url)).toBe('clinics/c1/f1.jpg');
  });
});
