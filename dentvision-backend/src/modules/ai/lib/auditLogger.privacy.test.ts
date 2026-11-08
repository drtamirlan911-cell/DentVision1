import { beforeEach, describe, expect, it, vi } from 'vitest';

const { create } = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock('../../../lib/prisma.js', () => ({
  default: { aIActionLog: { create } },
}));

import { logAIInteraction } from './auditLogger.js';

beforeEach(() => {
  vi.clearAllMocks();
  create.mockResolvedValue({});
});

describe('AI interaction audit privacy', () => {
  it('keeps an error-presence signal without persisting PHI in exception text', async () => {
    const errorMessage = 'Patient Ivan Petrov: private diagnosis alpha';

    await logAIInteraction({
      userId: 'user-1',
      clinicId: 'clinic-1',
      sessionId: 'session-1',
      model: 'gpt-model',
      toolsCalled: [],
      status: 'error',
      errorMessage,
    });

    const response = create.mock.calls[0][0].data.response;
    expect(response.errorPresent).toBe(true);
    expect(JSON.stringify(response)).not.toContain('Ivan Petrov');
    expect(JSON.stringify(response)).not.toContain('private diagnosis alpha');
  });

  it('marks success rows without an error indicator', async () => {
    await logAIInteraction({
      userId: 'user-1',
      model: 'deterministic',
      toolsCalled: [],
      status: 'success',
    });

    expect(create.mock.calls[0][0].data.response.errorPresent).toBe(false);
  });
});
