import { beforeEach, describe, expect, it, vi } from 'vitest';

const { workflowRunFindMany, retryWorkflowRun } = vi.hoisted(() => ({
  workflowRunFindMany: vi.fn(),
  retryWorkflowRun: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({
  default: { workflowRun: { findMany: workflowRunFindMany } },
}));

vi.mock('../modules/workflow/workflow.engine.js', () => ({
  retryWorkflowRun,
}));

import { sweepFailedWorkflowRuns } from './workflowRetry.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sweepFailedWorkflowRuns', () => {
  it('retries every failed run under the attempt cap', async () => {
    workflowRunFindMany.mockResolvedValueOnce([{ id: 'run-1' }, { id: 'run-2' }]);

    const result = await sweepFailedWorkflowRuns();

    expect(result).toEqual({ retried: 2 });
    expect(workflowRunFindMany).toHaveBeenCalledWith({
      where: { status: 'failed', attempts: { lt: 3 } },
      select: { id: true },
      take: 100,
    });
    expect(retryWorkflowRun).toHaveBeenCalledWith('run-1');
    expect(retryWorkflowRun).toHaveBeenCalledWith('run-2');
  });

  it('does not throw when the column does not exist yet on a fresh boot (P2021)', async () => {
    workflowRunFindMany.mockRejectedValueOnce({ code: 'P2021' });

    const result = await sweepFailedWorkflowRuns();

    expect(result).toEqual({ retried: 0 });
    expect(retryWorkflowRun).not.toHaveBeenCalled();
  });

  it('re-throws unexpected errors rather than silently swallowing them', async () => {
    workflowRunFindMany.mockRejectedValueOnce(new Error('connection reset'));

    await expect(sweepFailedWorkflowRuns()).rejects.toThrow('connection reset');
  });
});
