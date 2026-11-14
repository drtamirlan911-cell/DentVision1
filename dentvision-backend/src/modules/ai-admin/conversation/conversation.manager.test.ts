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
import { encryptAiAdminJson, encryptAiAdminText, getAiAdminExternalUserIdHashes, hashAiAdminExternalUserId } from './phi.js';

const envNames = ['NODE_ENV', 'ENCRYPTION_KEY', 'AI_ADMIN_PHI_KEYRING_JSON', 'AI_ADMIN_PHI_ACTIVE_KEY_ID', 'AI_ADMIN_EXTERNAL_ID_INDEX_KEYRING_JSON', 'AI_ADMIN_EXTERNAL_ID_ACTIVE_INDEX_KEY_ID', 'AI_ADMIN_EXTERNAL_ID_STRICT_WRITE', 'AI_ADMIN_EXTERNAL_ID_LEGACY_WORKERS_DRAINED'];
const originalEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.ENCRYPTION_KEY = 'ai-admin-conversation-test-key-at-least-32-chars';
  for (const name of envNames.slice(2)) delete process.env[name];
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
  for (const name of envNames) {
    const value = originalEnv[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
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
    expect(data.content).toMatch(/^ENC:v2:/);
    expect(data.toolResult).toMatch(/^ENC:v2:/);
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
    expect(data.reason).toMatch(/^ENC:v2:/);
    expect(data.lastUserMessage).toMatch(/^ENC:v2:/);
    expect(JSON.stringify(data)).not.toContain('Ivan Petrov');
    expect(JSON.stringify(data)).not.toContain('private diagnosis alpha');
    expect(notifyClinicOwners.mock.calls[0][2]).not.toContain('Ivan Petrov');
    expect(notifyClinicOwners.mock.calls[0][2]).not.toContain('private diagnosis alpha');
  });
});


describe('AI Admin external contact identity persistence', () => {
  const identity = { clinicId: 'clinic-1', configId: 'config-1', channel: 'WHATSAPP' as const, externalUserId: '77010000000' };
  it('dual-writes the legacy identifier with ciphertext/index during rolling compatibility', async () => {
    await getOrCreateSession(identity);
    const data = prismaMock.aiAdminSession.create.mock.calls[0][0].data;
    expect(data.externalUserId).toBe(identity.externalUserId);
    expect(data.externalUserIdCiphertext).toMatch(/^ENC:v2:/
    expect(data.externalUserIdHash).toBe(hashAiAdminExternalUserId(identity));
    expect(data.externalUserIdCiphertext).not.toContain(identity.externalUserId);
  });
  it('stores only ciphertext after explicit strict cutover', async () => {
    process.env.AI_ADMIN_EXTERNAL_ID_STRICT_WRITE = 'true';
    process.env.AI_ADMIN_EXTERNAL_ID_LEGACY_WORKERS_DRAINED = 'I_HAVE_DRAINED_ALL_LEGACY_WORKERS';
    await getOrCreateSession(identity);
    const data = prismaMock.aiAdminSession.create.mock.calls[0][0].data;
    expect(data.externalUserId).toBeNull();
    expect(data.externalUserIdCiphertext).toMatch(/^ENC:/);
    expect(data.externalUserIdHash).toBe(hashAiAdminExternalUserId(identity));
    expect(data.externalUserIdCiphertext).not.toContain(identity.externalUserId);
  });
  it('refuses strict mode unless legacy workers are explicitly drained', async () => {
    process.env.AI_ADMIN_EXTERNAL_ID_STRICT_WRITE = 'true';
    await expect(getOrCreateSession(identity)).rejects.toThrow(/legacy workers are drained/);
    expect(prismaMock.aiAdminSession.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.aiAdminSession.create).not.toHaveBeenCalled();
  });
  it('reuses an encrypted session by the clinic-scoped blind index', async () => {
    prismaMock.aiAdminSession.findFirst.mockResolvedValueOnce({ id: 'existing', externalUserId: identity.externalUserId, externalUserIdCiphertext: 'ENC:value', externalUserIdHash: hashAiAdminExternalUserId(identity) });
    prismaMock.aiAdminSession.update.mockResolvedValueOnce({ id: 'existing' });
    await getOrCreateSession(identity);
    expect(prismaMock.aiAdminSession.findFirst.mock.calls[0][0].where.externalUserIdHash.in).toContain(hashAiAdminExternalUserId(identity));
    expect(prismaMock.aiAdminSession.create).not.toHaveBeenCalled();
  });
  it('finds an existing v1 session index and upgrades it without creating a duplicate', async () => {
    const oldHash = getAiAdminExternalUserIdHashes(identity).find((value) => value.startsWith('v1:'))!;
    prismaMock.aiAdminSession.findFirst.mockResolvedValueOnce({
      id: 'old-index',
      externalUserId: identity.externalUserId,
      externalUserIdCiphertext: 'ENC:legacy-payload',
      externalUserIdHash: oldHash,
      channel: identity.channel,
      clinicId: identity.clinicId,
    });
    await getOrCreateSession(identity);
    expect(prismaMock.aiAdminSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'old-index', externalUserIdHash: oldHash },
      data: { externalUserIdHash: hashAiAdminExternalUserId(identity) },
    });
    expect(prismaMock.aiAdminSession.create).not.toHaveBeenCalled();
  });

  it('fails closed on an incomplete blind-index row', async () => {
    prismaMock.aiAdminSession.findFirst.mockResolvedValueOnce({ id: 'bad', externalUserId: identity.externalUserId, externalUserIdCiphertext: null, externalUserIdHash: hashAiAdminExternalUserId(identity), channel: identity.channel, clinicId: identity.clinicId });
    await expect(getOrCreateSession(identity)).rejects.toThrow(/guarded backfill is required/);
  });
  it('migrates a legacy plaintext row with compare-and-set', async () => {
    const hash = hashAiAdminExternalUserId(identity);
    prismaMock.aiAdminSession.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'legacy', externalUserId: identity.externalUserId, channel: identity.channel, clinicId: identity.clinicId });
    prismaMock.aiAdminSession.findUnique.mockResolvedValueOnce({ id: 'legacy', externalUserId: identity.externalUserId, externalUserIdCiphertext: 'ENC:legacy', externalUserIdHash: hash });
    await getOrCreateSession(identity);
    expect(prismaMock.aiAdminSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'legacy', externalUserId: identity.externalUserId, externalUserIdHash: null },
      data: expect.objectContaining({ externalUserId: identity.externalUserId, externalUserIdCiphertext: expect.stringMatching(/^ENC:/), externalUserIdHash: hash }),
    });
  });
  it('clears a legacy plaintext identifier only after strict cutover is acknowledged', async () => {
    process.env.AI_ADMIN_EXTERNAL_ID_STRICT_WRITE = 'true';
    process.env.AI_ADMIN_EXTERNAL_ID_LEGACY_WORKERS_DRAINED = 'I_HAVE_DRAINED_ALL_LEGACY_WORKERS';
    const hash = hashAiAdminExternalUserId(identity);
    prismaMock.aiAdminSession.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'legacy', externalUserId: identity.externalUserId, channel: identity.channel, clinicId: identity.clinicId });
    prismaMock.aiAdminSession.findUnique.mockResolvedValueOnce({ id: 'legacy', externalUserId: null, externalUserIdCiphertext: 'ENC:legacy', externalUserIdHash: hash });
    await getOrCreateSession(identity);
    expect(prismaMock.aiAdminSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'legacy', externalUserId: identity.externalUserId, externalUserIdHash: null },
      data: expect.objectContaining({ externalUserId: null, externalUserIdCiphertext: expect.stringMatching(/^ENC:/), externalUserIdHash: hash }),
    });
  });
  it('adopts a legacy worker row when its plaintext unique key wins a concurrent create', async () => {
    const hash = hashAiAdminExternalUserId(identity);
    prismaMock.aiAdminSession.create.mockRejectedValueOnce({ code: 'P2002' });
    prismaMock.aiAdminSession.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'legacy-winner', externalUserId: identity.externalUserId, channel: identity.channel, clinicId: identity.clinicId });
    prismaMock.aiAdminSession.findUnique.mockResolvedValueOnce({
      id: 'legacy-winner',
      externalUserId: identity.externalUserId,
      externalUserIdCiphertext: 'ENC:legacy',
      externalUserIdHash: hash,
    });

    await getOrCreateSession(identity);

    expect(prismaMock.aiAdminSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'legacy-winner', externalUserId: identity.externalUserId, externalUserIdHash: null },
      data: expect.objectContaining({
        externalUserId: identity.externalUserId,
        externalUserIdCiphertext: expect.stringMatching(/^ENC:/),
        externalUserIdHash: hash,
      }),
    });
  });
  it('recovers a concurrent create collision by reading the blind-index winner', async () => {
    prismaMock.aiAdminSession.create.mockRejectedValueOnce({ code: 'P2002' });
    const hash = hashAiAdminExternalUserId(identity);
    prismaMock.aiAdminSession.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'winner', externalUserId: identity.externalUserId, externalUserIdCiphertext: 'ENC:value', externalUserIdHash: hash });
    prismaMock.aiAdminSession.update.mockResolvedValueOnce({ id: 'winner' });
    await getOrCreateSession(identity);
    expect(prismaMock.aiAdminSession.update).toHaveBeenCalledWith({ where: { id: 'winner' }, data: expect.objectContaining({ status: 'ACTIVE' }) });
  });
});
