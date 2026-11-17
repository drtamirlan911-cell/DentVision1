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

  it('does not emit raw ORM error details into operational logs', async () => {
    const sensitiveDetail = 'patient=Test Person diagnosis=private marker';
    create.mockRejectedValueOnce(new Error(sensitiveDetail));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await logAudit({
        sessionId: 'session-1',
        clinicId: 'clinic-1',
        userMessage: 'message',
        assistantMessage: 'response',
        toolsCalled: [],
        tokensUsed: 0,
        latencyMs: 10,
        escalated: false,
      });
      expect(log).toHaveBeenCalledWith('[audit] Failed to log AI admin event');
      expect(JSON.stringify(log.mock.calls)).not.toContain(sensitiveDetail);
    } finally {
      log.mockRestore();
    }
  });
});
