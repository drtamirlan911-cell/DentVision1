import { beforeEach, describe, expect, it, vi } from 'vitest';

const { create } = vi.hoisted(() => ({
  create: vi.fn().mockResolvedValue({ id: 'ai-action-log-1' }),
}));

vi.mock('../../../lib/prisma.js', () => ({
  default: {
    aIActionLog: { create },
  },
}));

import { logAIInteraction } from './auditLogger.js';

describe('AI interaction audit error privacy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    create.mockResolvedValue({ id: 'ai-action-log-1' });
  });

  it('records a failure without persisting exception details', async () => {
    const privateError = 'SENSITIVE_CLINICAL_SENTINEL_7f93a1b2';

    await logAIInteraction({
      userId: 'user-test',
      clinicId: 'clinic-test',
      sessionId: 'session-test',
      model: 'gpt-test',
      toolsCalled: ['getPatientCard'],
      status: 'error',
      errorMessage: privateError,
    });

    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0][0].data as Record<string, unknown>;
    const response = data.response as Record<string, unknown>;

    expect(response).toEqual({
      tokenCount: null,
      latencyMs: null,
      status: 'error',
      errorPresent: true,
    });
    expect(JSON.stringify(data)).not.toContain(privateError);
    expect(JSON.stringify(data)).not.toContain('errorMessage');
  });
});
