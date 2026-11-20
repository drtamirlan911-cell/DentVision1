import { describe, expect, it, vi } from 'vitest';

vi.mock('./EventStore.js', () => ({
  eventStore: {
    save: vi.fn(),
    markCompleted: vi.fn(),
    markFailed: vi.fn(),
    recoverStaleProcessing: vi.fn(),
    claimPending: vi.fn(),
  },
}));

import { EventBus } from './EventBus.js';
import { EventType, type CRMEvent } from './EventTypes.js';

describe('EventBus subscriber error privacy', () => {
  it('records a failed subscriber without logging exception content', async () => {
    const bus = new EventBus();
    const sentinel = 'SENSITIVE_CLINICAL_SENTINEL_7f93a1b2';
    const handler = vi.fn().mockRejectedValue(new Error(sentinel));
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const event: CRMEvent = {
      id: 'event-test',
      type: EventType.PatientCreated,
      timestamp: new Date('2026-11-20T00:00:00.000Z'),
      source: 'test',
      clinicId: 'clinic-test',
      userId: 'user-test',
      payload: { patientId: 'patient-test' },
    };

    try {
      const ok = await (bus as any).callHandler(handler, event);

      expect(ok).toBe(false);
      expect(error).toHaveBeenCalledWith(
        '[EventBus] Handler error for PatientCreated (Error)',
      );
      expect(JSON.stringify(error.mock.calls)).not.toContain(sentinel);
    } finally {
      error.mockRestore();
    }
  });
});
