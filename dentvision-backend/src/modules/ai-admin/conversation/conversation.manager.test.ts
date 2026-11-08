import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, notifyClinicOwners } = vi.hoisted(() => ({
  prismaMock: {
    aiAdminMessage: { create: vi.fn(), findMany: vi.fn() },
    aiAdminSession: { update: vi.fn() },
    aiAdminEscalation: { create: vi.fn() },
  },
  notifyClinicOwners: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({ default: prismaMock }));
vi.mock('../../billing/clinicSubscription.service.js', () => ({ notifyClinicOwners }));

import { getRecentMessages, markEscalated, saveMessage } from './conversation.manager.js';
import { encryptAiAdminJson, encryptAiAdminText } from './phi.js';

const originalNodeEnv = process.env.NODE_ENV;
const originalEncryptionKey = process.env.ENCRYPTION_KEY;

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.ENCRYPTION_KEY = 'ai-admin-conversation-test-key-at-least-32-chars';
  vi.clearAllMocks();
  prismaMock.aiAdminMessage.create.mockResolvedValue({});
  prismaMock.aiAdminMessage.findMany.mockResolvedValue([]);
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
