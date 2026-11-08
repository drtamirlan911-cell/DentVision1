import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('../../../lib/prisma.js', () => ({
  default: { auditLog: { create } },
}));

import { logAudit } from './audit.logger.js';

beforeEach(() => {
  vi.clearAllMocks();
  create.mockResolvedValue({});
});

describe('AI Admin audit minimization', () => {
  it('stores operational metadata without duplicating patient conversation text', async () => {
    const userMessage = 'Ivan Petrov reports private diagnosis alpha';
    const assistantMessage = 'Your private treatment result is ready';

    await logAudit({
      sessionId: 'session-1',
      clinicId: 'clinic-1',
      userMessage,
      assistantMessage,
      toolsCalled: ['get_patient'],
      tokensUsed: 42,
      latencyMs: 120,
      escalated: false,
    });

    const details = create.mock.calls[0][0].data.details;
    expect(details.userMessagePresent).toBe(true);
    expect(details.assistantResponsePresent).toBe(true);
    expect(details.toolsCalled).toEqual(['get_patient']);
    expect(JSON.stringify(details)).not.toContain('Ivan Petrov');
    expect(JSON.stringify(details)).not.toContain('private diagnosis alpha');
    expect(JSON.stringify(details)).not.toContain('treatment result');
  });
});
