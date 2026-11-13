import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, notifyClinicOwners } = vi.hoisted(() => ({
  prismaMock: {
    aiAdminMessage: { create: vi.fn(), findMany: vi.fn() },
    aiAdminSession: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    aiAdminEscalation: { create: vi.fn() },
  },
  notifyClinicOwners: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({ default: prismaMock }));
vi.mock('../../billing/clinicSubscription.service.js', () => ({ notifyClinicOwners }));

import { getOrCreateSession, getRecentMessages, markEscalated, saveMessage } from './conversation.manager.js';
import { encryptAiAdminJson, encryptAiAdminText } from './phi.js';

const originalNodeEnv = process.env.NODE_ENV;
const originalEncryptionKey = process.env.ENCRYPTION_KEY;

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.ENCRYPTION_KEY = 'ai-admin-conversation-test-key-at-least-32-chars';
  vi.clearAllMocks();
  prismaMock.aiAdminMessage.create.mockResolvedValue({});
  prismaMock.aiAdminMessage.findMany.mockResolvedValue([]);
  prismaMock.aiAdminSession.findFirst.mockResolvedValue(null);
  prismaMock.aiAdminSession.findUnique.mockResolvedValue(null);
  prismaMock.aiAdminSession.create.mockResolvedValue({ id: 'session-1', clinicId: 'clinic-1', channel: 'WHATSAPP' });
  prismaMock.aiAdminSession.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.aiAdminSession.update.mockResolvedValue({
    id: 'session-1',
    clinicId: 'clinic-1',
    channel: 'WHATSAPP',
  });
  prismaMock.aiAdminEscalation.create.mockResolvedValue({});
  notifyClinicOwners.mockResolvedValue(undefined);
});

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalEncryptionKey === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = originalEncryptionKey;
});

describe('AI Admin message persistence', () => {
  it('encrypts message content and tool results before Prisma create', async () => {
    await saveMessage({
      sessionId: 'session-1',
      role: 'TOOL',
      content: '{"patientName":"Ivan Petrov","diagnosis":"private diagnosis beta"}',
      toolName: 'get_patient',
      toolResult: { patientName: 'Ivan Petrov', diagnosis: 'private diagnosis beta' },
    });

    const data = prismaMock.aiAdminMessage.create.mock.calls[0][0].data;
    expect(data.content).toMatch(/^ENC:/);
    expect(data.toolResult).toMatch(/^ENC:/);
    expect(JSON.stringify(data)).not.toContain('Ivan Petrov');
    expect(JSON.stringify(data)).not.toContain('private diagnosis beta');
  });

  it('decrypts new encrypted rows and remains compatible with legacy plaintext rows', async () => {
    prismaMock.aiAdminMessage.findMany.mockResolvedValueOnce([
      {
        id: 'new',
        role: 'ASSISTANT',
        content: encryptAiAdminText('encrypted assistant response'),
        toolResult: encryptAiAdminJson({ patientName: 'Ivan Petrov' }),
      },
      {
        id: 'legacy',
        role: 'USER',
        content: 'legacy patient question',
        toolResult: { legacy: true },
      },
    ]);

    const rows = await getRecentMessages('session-1');
    expect(rows.map((row) => row.id)).toEqual(['legacy', 'new']);
    expect(rows[0].content).toBe('legacy patient question');
    expect(rows[1].content).toBe('encrypted assistant response');
    expect(rows[1].toolResult).toEqual({ patientName: 'Ivan Petrov' });
  });

  it('encrypts escalation fields and sends only a generic owner notification', async () => {
    const reason = 'Patient asks about private diagnosis alpha';
    const lastUserMessage = 'My name is Ivan Petrov and my diagnosis is private';

    await markEscalated('session-1', reason, lastUserMessage);

    const data = prismaMock.aiAdminEscalation.create.mock.calls[0][0].data;
    expect(data.reason).toMatch(/^ENC:/);
    expect(data.lastUserMessage).toMatch(/^ENC:/);
    expect(JSON.stringify(data)).not.toContain('Ivan Petrov');
    expect(JSON.stringify(data)).not.toContain('private diagnosis alpha');
    expect(notifyClinicOwners.mock.calls[0][2]).not.toContain('Ivan Petrov');
    expect(notifyClinicOwners.mock.calls[0][2]).not.toContain('private diagnosis alpha');
  });
});


describe('AI Admin external contact identity persistence', () => {
  const identity = { clinicId: 'clinic-1', configId: 'config-1', channel: 'WHATSAPP' as const, externalUserId: '77010000000' };
  it('stores only ciphertext and a scoped blind index', async () => {
    await getOrCreateSession(identity);
    const data = prismaMock.aiAdminSession.create.mock.calls[0][0].data;
    expect(data.externalUserId).toBeNull();
    expect(data.externalUserIdCiphertext).toMatch(/^ENC:/);
    expect(data.externalUserIdHash).toMatch(/^v1:[a-f0-9]{64}$/);
    expect(data.externalUserIdCiphertext).not.toContain(identity.externalUserId);
  });
  it('reuses an encrypted session by the clinic-scoped blind index', async () => {
    prismaMock.aiAdminSession.findFirst.mockResolvedValueOnce({ id: 'existing', externalUserId: null, externalUserIdCiphertext: 'ENC:value' });
    prismaMock.aiAdminSession.update.mockResolvedValueOnce({ id: 'existing' });
    await getOrCreateSession(identity);
    expect(prismaMock.aiAdminSession.findFirst.mock.calls[0][0].where.externalUserIdHash).toMatch(/^v1:/);
    expect(prismaMock.aiAdminSession.create).not.toHaveBeenCalled();
  });
  it('fails closed on an incomplete blind-index row', async () => {
    prismaMock.aiAdminSession.findFirst.mockResolvedValueOnce({ id: 'bad', externalUserId: identity.externalUserId, externalUserIdCiphertext: null });
    await expect(getOrCreateSession(identity)).rejects.toThrow(/guarded backfill is required/);
  });
  it('migrates a legacy plaintext row with compare-and-set', async () => {
    prismaMock.aiAdminSession.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'legacy' });
    prismaMock.aiAdminSession.findUnique.mockResolvedValueOnce({ id: 'legacy', externalUserId: null });
    await getOrCreateSession(identity);
    expect(prismaMock.aiAdminSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'legacy', externalUserId: identity.externalUserId, externalUserIdHash: null },
      data: expect.objectContaining({ externalUserId: null, externalUserIdCiphertext: expect.stringMatching(/^ENC:/), externalUserIdHash: expect.stringMatching(/^v1:/) }),
    });
  });
  it('recovers a concurrent create collision by reading the blind-index winner', async () => {
    prismaMock.aiAdminSession.create.mockRejectedValueOnce({ code: 'P2002' });
    prismaMock.aiAdminSession.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'winner' });
    prismaMock.aiAdminSession.update.mockResolvedValueOnce({ id: 'winner' });
    await getOrCreateSession(identity);
    expect(prismaMock.aiAdminSession.update).toHaveBeenCalledWith({ where: { id: 'winner' }, data: expect.objectContaining({ status: 'ACTIVE' }) });
  });
});
