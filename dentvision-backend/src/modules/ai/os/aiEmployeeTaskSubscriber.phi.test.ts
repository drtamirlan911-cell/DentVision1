import { describe, expect, it, vi } from 'vitest';

const { subscribe, createAiEmployeeTask } = vi.hoisted(() => ({
  subscribe: vi.fn(),
  createAiEmployeeTask: vi.fn(),
}));

vi.mock('../../events/index.js', () => ({ eventBus: { subscribe } }));
vi.mock('./aiEmployeeTasks.js', () => ({ createAiEmployeeTask }));

import { EventType, type CRMEvent } from '../../events/EventTypes.js';
import { registerAiEmployeeTaskSubscriber } from './aiEmployeeTaskSubscriber.js';

describe('AI Employee task payload minimization', () => {
  it('keeps event provenance but does not duplicate raw clinical payloads into task JSONB', async () => {
    let handler: ((event: CRMEvent) => Promise<void>) | undefined;
    subscribe.mockImplementation((_type: string, callback: (event: CRMEvent) => Promise<void>) => {
      handler = callback;
      return () => undefined;
    });
    createAiEmployeeTask.mockResolvedValue(null);
    registerAiEmployeeTaskSubscriber();
    expect(handler).toBeTypeOf('function');

    await handler!({
      id: 'event-a',
      type: EventType.PatientCreated,
      timestamp: new Date('2026-11-04T00:00:00.000Z'),
      source: 'test',
      clinicId: 'clinic-a',
      userId: 'user-a',
      payload: {
        patientId: 'patient-a',
        hasComplaints: true,
        patientName: 'PHI_PATIENT_NAME',
        complaints: ['PHI_COMPLAINT'],
      },
    });
    expect(createAiEmployeeTask).toHaveBeenCalled();
    for (const [input] of createAiEmployeeTask.mock.calls) {
      expect(input.actionPayload).toBeNull();
      expect(input.sourceEventId).toBe('event-a');
      expect(input.sourceEventType).toBe(EventType.PatientCreated);
    }
  });
});
