// @vitest-environment node
import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  lookup: vi.fn(),
  request: vi.fn(),
  requestOptions: [] as any[],
  clinicFindUnique: vi.fn(),
  responseStatus: 200,
  responseBody: '{"ok":true}',
  lastRequestOptions: null as any,
}));

vi.mock('node:dns/promises', async (importOriginal) => ({ ...(await importOriginal()), lookup: mocks.lookup }));
vi.mock('node:https', async (importOriginal) => ({ ...(await importOriginal()), request: mocks.request }));
vi.mock('../../lib/prisma.js', () => ({ default: { clinic: { findUnique: mocks.clinicFindUnique } } }));
vi.mock('../../config.js', () => ({
  env: { NODE_ENV: 'test', PORT: 3001, CORS_ORIGIN: '', PUBLIC_API_URL: '' },
}));
vi.mock('../../lib/money.js', () => ({ minorToTenge: (value: bigint) => Number(value) / 100 }));

function configureHttpsResponse(status = 200, body = '{"ok":true}') {
  mocks.responseStatus = status;
  mocks.responseBody = body;
  mocks.request.mockImplementation((options: unknown, callback: (response: any) => void) => {
    mocks.lastRequestOptions = options;
    mocks.requestOptions.push(options);
    const request = new EventEmitter() as any;
    request.setTimeout = () => request;
    request.write = () => true;
    request.end = () => {
      const response = new EventEmitter() as any;
      response.statusCode = mocks.responseStatus;
      response.headers = {};
      response.resume = () => response;
      response.destroy = () => response;
      callback(response);
      queueMicrotask(() => {
        response.emit('data', Buffer.from(mocks.responseBody));
        response.emit('end');
      });
    };
    request.destroy = (error: Error) => request.emit('error', error);
    return request;
  });
}

describe('clinic gateway SSRF policy', () => {
  afterEach(() => {
    vi.clearAllMocks();
    mocks.requestOptions.length = 0;
    delete process.env.CLINIC_GATEWAY_ALLOWED_HOSTS;
  });

  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '192.168.1.4',
    '192.0.2.1',
    '169.254.169.254',
    '0.0.0.0',
    '::1',
    'fc00::1',
    'fe80::1',
    '2001:db8::1',
    '2001:0000::1',
    '2001:0002::1',
    '2001:0010::1',
    '2001:0020::1',
    '2002:0808:0808::1',
    '3fff::1', // RFC 9637 documentation prefix must not be accepted as a public gateway
  ])('rejects private, link-local, or reserved address %s', async (address) => {
    const { isPublicGatewayAddress } = await import('./clinicPayments.js');
    expect(isPublicGatewayAddress(address)).toBe(false);
  });

  it('rejects non-HTTPS, localhost, credentials, and IP-literal gateway URLs before DNS', async () => {
    const { validateClinicGatewayUrl } = await import('./clinicPayments.js');
    await expect(validateClinicGatewayUrl('http://gateway.example/api')).rejects.toThrow();
    await expect(validateClinicGatewayUrl('https://localhost/api')).rejects.toThrow();
    await expect(validateClinicGatewayUrl('https://user:pass@gateway.example/api')).rejects.toThrow();
    await expect(validateClinicGatewayUrl('https://169.254.169.254/latest/meta-data')).rejects.toThrow();
    await expect(validateClinicGatewayUrl('https://[2001:4860:4860::8888]/api')).rejects.toThrow();
    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  it('rejects DNS answers that resolve to metadata/private IP ranges', async () => {
    mocks.lookup.mockResolvedValueOnce([{ address: '169.254.169.254', family: 4 }]);
    const { validateClinicGatewayUrl } = await import('./clinicPayments.js');
    await expect(validateClinicGatewayUrl('https://gateway.example/api')).rejects.toThrow();
  });

  it('pins outbound HTTPS requests to validated DNS and rejects redirects without following them', async () => {
    mocks.lookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
    ]);
    configureHttpsResponse(302, '');
    const { requestClinicGateway } = await import('./clinicPayments.js');
    await expect(requestClinicGateway({
      url: 'https://gateway.example/api/v1/invoices/123',
      method: 'GET',
      headers: { Authorization: 'Bearer test-key' },
    })).rejects.toMatchObject({ code: 'CLINIC_GATEWAY_REDIRECT' });
    expect(mocks.request).toHaveBeenCalledTimes(1);
    expect(mocks.lastRequestOptions.lookup).toBeTypeOf('function');
    expect(mocks.lastRequestOptions.servername).toBe('gateway.example');
  });

  it('reuses one idempotency key across gateway endpoint fallback attempts', async () => {
    mocks.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    mocks.clinicFindUnique.mockResolvedValue({
      id: 'clinic-1',
      name: 'Test Clinic',
      settings: { payments: { mode: 'api', apiBaseUrl: 'https://gateway.example/api/v1', apiKey: 'test-api-key' } },
    });
    configureHttpsResponse(302, '');

    const { createClinicKaspiPayment } = await import('./clinicPayments.js');
    await expect(createClinicKaspiPayment({
      clinicId: 'clinic-1',
      amountMinor: 10_000n,
      refId: 'invoice-1',
    })).rejects.toThrow();

    expect(mocks.requestOptions).toHaveLength(3);
    const idempotencyKeys = mocks.requestOptions.map((options) => options.headers['Idempotency-Key']);
    expect(new Set(idempotencyKeys).size).toBe(1);
  });

  it('enforces an optional exact hostname allowlist', async () => {
    process.env.CLINIC_GATEWAY_ALLOWED_HOSTS = 'pay.example.kz,api.bank.kz';
    mocks.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    const { validateClinicGatewayUrl } = await import('./clinicPayments.js');
    await expect(validateClinicGatewayUrl('https://attacker.example/api')).rejects.toThrow();
    await expect(validateClinicGatewayUrl('https://pay.example.kz/api')).resolves.toBeTruthy();
  });
});
