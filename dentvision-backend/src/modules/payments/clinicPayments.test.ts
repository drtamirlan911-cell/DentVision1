import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  lookup: vi.fn(),
  request: vi.fn(),
  responseStatus: 200,
  responseBody: '{"ok":true}',
  lastRequestOptions: null as any,
}));

vi.mock('node:dns/promises', async (importOriginal) => ({ ...(await importOriginal()), lookup: mocks.lookup }));
vi.mock('node:https', () => ({ request: mocks.request }));
vi.mock('../../lib/prisma.js', () => ({ default: {} }));
vi.mock('../../config.js', () => ({
  env: { NODE_ENV: 'test', PORT: 3001, CORS_ORIGIN: '', PUBLIC_API_URL: '' },
}));
vi.mock('../../lib/money.js', () => ({ minorToTenge: (value: bigint) => Number(value) / 100 }));

function configureHttpsResponse(status = 200, body = '{"ok":true}') {
  mocks.responseStatus = status;
  mocks.responseBody = body;
  mocks.request.mockImplementation((options: unknown, callback: (response: any) => void) => {
    mocks.lastRequestOptions = options;
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

  it('enforces an optional exact hostname allowlist', async () => {
    process.env.CLINIC_GATEWAY_ALLOWED_HOSTS = 'pay.example.kz,api.bank.kz';
    mocks.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    const { validateClinicGatewayUrl } = await import('./clinicPayments.js');
    await expect(validateClinicGatewayUrl('https://attacker.example/api')).rejects.toThrow();
    await expect(validateClinicGatewayUrl('https://pay.example.kz/api')).resolves.toBeTruthy();
  });
});
