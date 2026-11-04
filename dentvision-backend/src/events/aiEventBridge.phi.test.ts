import { describe, expect, it, vi } from 'vitest';

const {
  subscribe,
  publish,
  clinicMemberFindFirst,
  notificationUpsert,
  patientFindFirst,
  appointmentFindFirst,
  labOrderFindFirst,
} = vi.hoisted(() => ({
  subscribe: vi.fn(),
  publish: vi.fn(),
  clinicMemberFindFirst: vi.fn(),
  notificationUpsert: vi.fn(),
  patientFindFirst: vi.fn(),
  appointmentFindFirst: vi.fn(),
  labOrderFindFirst: vi.fn(),
}));

vi.mock('../lib/events.js', () => ({ subscribe }));
vi.mock('../lib/prisma.js', () => ({
  default: {
    clinicMember: { findFirst: clinicMemberFindFirst },
    notification: { upsert: notificationUpsert },
    patient: { findFirst: patientFindFirst },
    appointment: { findFirst: appointmentFindFirst },
    labOrder: { findFirst: labOrderFindFirst },
  },
}));
vi.mock('../modules/events/index.js', () => ({ eventBus: { publish } }));

import { EventType } from '../modules/events/EventTypes.js';
import { registerAIEventBridge } from './aiEventBridge.js';

describe('diagnostic AI Event OS bridge PHI minimization', () => {
  it('persists identifiers and status only, not patient names or study details', async () => {
    const handlers = new Map<string, (payload: any) => Promise<void>>();
    subscribe.mockImplementation((event: string, handler: (payload: any) => Promise<void>) => {
      handlers.set(event, handler);
    });
    clinicMemberFindFirst.mockResolvedValue({ userId: 'doctor-a' });
    notificationUpsert.mockResolvedValue({});
    publish.mockResolvedValue('ai-event-a');
    registerAIEventBridge();

    const resultReady = handlers.get('diagnostics.result_ready');
    expect(resultReady).toBeTypeOf('function');
    await resultReady!({
      referralId: 'referral-a',
      resultId: 'result-a',
      clinicId: 'clinic-a',
      centerId: 'center-a',
      doctorId: 'doctor-a',
      patientName: 'PHI_PATIENT_NAME',
      studyType: 'PHI_STUDY_TYPE',
      userId: 'doctor-a',
    });
    expect(publish).toHaveBeenCalledWith(
      EventType.DiagnosticResultReady,
      { referralId: 'referral-a', resultId: 'result-a' },
      { clinicId: 'clinic-a', userId: 'doctor-a', source: 'diagnostics.result_ready' },
    );
    const notification = notificationUpsert.mock.calls[0][0];
    expect(notification.create.message).toBe('Результат диагностики готов к просмотру. Откройте направление для подробностей.');
    expect(JSON.stringify(notification)).not.toContain('PHI_PATIENT_NAME');
    expect(JSON.stringify(notification)).not.toContain('PHI_STUDY_TYPE');

    const bookingCreated = handlers.get('diagnostics.booking.created');
    expect(bookingCreated).toBeTypeOf('function');
    await bookingCreated!({
      centerId: 'center-a', bookingId: 'booking-a', studyId: 'PHI_STUDY_ID',
      patientName: 'PHI_PATIENT_NAME', date: '2026-11-04', time: '10:00', status: 'BOOKED', userId: 'operator-a',
    });
    expect(publish).toHaveBeenCalledWith(
      EventType.DiagnosticBookingCreated,
      { bookingId: 'booking-a', status: 'BOOKED' },
      { clinicId: 'center-a', userId: 'operator-a', source: 'diagnostics.booking.created' },
    );

    const bookingChanged = handlers.get('diagnostics.booking.status_changed');
    expect(bookingChanged).toBeTypeOf('function');
    await bookingChanged!({
      centerId: 'center-a', bookingId: 'booking-a', studyId: 'PHI_STUDY_ID',
      patientName: 'PHI_PATIENT_NAME', date: '2026-11-04', time: '10:00',
      status: 'COMPLETED', previousStatus: 'BOOKED', userId: 'operator-a',
    });
    expect(publish).toHaveBeenCalledWith(
      EventType.DiagnosticBookingStatusChanged,
      { bookingId: 'booking-a', status: 'COMPLETED', previousStatus: 'BOOKED' },
      { clinicId: 'center-a', userId: 'operator-a', source: 'diagnostics.booking.status_changed' },
    );
  });
});
