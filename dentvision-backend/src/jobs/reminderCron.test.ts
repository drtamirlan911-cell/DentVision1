import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  appointmentFindMany,
  userFindMany,
  reminderLogFindMany,
  reminderLogCreate,
  sendReminderMessage,
  createNotificationForClinic,
} = vi.hoisted(() => ({
  appointmentFindMany: vi.fn(),
  userFindMany: vi.fn(),
  reminderLogFindMany: vi.fn(),
  reminderLogCreate: vi.fn(),
  sendReminderMessage: vi.fn(),
  createNotificationForClinic: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({
  default: {
    appointment: { findMany: appointmentFindMany },
    user: { findMany: userFindMany },
    reminderLog: { findMany: reminderLogFindMany, create: reminderLogCreate },
  },
}));

vi.mock('../services/messaging.js', () => ({
  sendReminderMessage,
}));

vi.mock('../services/notification.service.js', () => ({
  NOTIFICATION_TYPES: { APPOINTMENT_REMINDER: 'APPOINTMENT_REMINDER' },
  createNotificationForClinic,
}));

import { runReminderCron } from './reminderCron.js';

const NOW = new Date('2026-08-17T08:00:00Z');

function makeAppointment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'appt-1',
    clinicId: 'clinic-1',
    doctorId: 'doc-1',
    date: new Date('2026-08-17T00:00:00Z'),
    time: '10:00',
    status: 'confirmed',
    type: 'Осмотр',
    meta: {},
    patient: { id: 'pat-1', firstName: 'Аян', lastName: 'Ким', phone: '+77001234567' },
    clinic: { id: 'clinic-1', name: 'DentVision Almaty' },
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  appointmentFindMany.mockReset();
  userFindMany.mockReset().mockResolvedValue([{ id: 'doc-1', firstName: 'Ерлан', lastName: 'Доктор' }]);
  reminderLogFindMany.mockReset().mockResolvedValue([]);
  reminderLogCreate.mockReset().mockResolvedValue({});
  sendReminderMessage.mockReset().mockResolvedValue({ ok: true, channel: 'whatsapp', sid: 'sid-1' });
  createNotificationForClinic.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('runReminderCron', () => {
  it('sends a reminder for an eligible appointment and logs it', async () => {
    appointmentFindMany.mockResolvedValueOnce([makeAppointment()]);

    const result = await runReminderCron({ hoursWindow: 24 });

    expect(sendReminderMessage).toHaveBeenCalledTimes(1);
    expect(sendReminderMessage).toHaveBeenCalledWith('+77001234567', expect.stringContaining('Аян Ким'));
    expect(reminderLogCreate).toHaveBeenCalledTimes(1);
    expect(createNotificationForClinic).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ scanned: 1, sent: 1, skipped: 0, errors: 0 });
  });

  it('skips appointments that already have a reminder logged', async () => {
    appointmentFindMany.mockResolvedValueOnce([makeAppointment()]);
    reminderLogFindMany.mockResolvedValueOnce([{ reminderKey: 'appt_appt-1' }]);

    const result = await runReminderCron({ hoursWindow: 24 });

    expect(sendReminderMessage).not.toHaveBeenCalled();
    expect(result).toMatchObject({ scanned: 1, sent: 0, skipped: 1 });
  });

  it('skips appointments with no patient phone on file', async () => {
    appointmentFindMany.mockResolvedValueOnce([
      makeAppointment({ patient: { id: 'pat-1', firstName: 'Аян', lastName: 'Ким', phone: null } }),
    ]);

    const result = await runReminderCron({ hoursWindow: 24 });

    expect(sendReminderMessage).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
    expect(result.details[0]).toMatchObject({ error: 'no_phone' });
  });

  it('skips appointments already checked in (flowStatus arrived/in_chair)', async () => {
    appointmentFindMany.mockResolvedValueOnce([makeAppointment({ meta: { flowStatus: 'arrived' } })]);

    const result = await runReminderCron({ hoursWindow: 24 });

    expect(sendReminderMessage).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });

  it('records a delivery error without throwing when the messaging provider fails', async () => {
    appointmentFindMany.mockResolvedValueOnce([makeAppointment()]);
    sendReminderMessage.mockResolvedValueOnce({ ok: false, error: 'provider_down' });

    const result = await runReminderCron({ hoursWindow: 24 });

    expect(reminderLogCreate).not.toHaveBeenCalled();
    expect(result.errors).toBe(1);
    expect(result.details[0]).toMatchObject({ error: 'provider_down' });
  });

  it('returns an empty result instead of throwing when the appointments table is missing (P2021)', async () => {
    appointmentFindMany.mockRejectedValueOnce({ code: 'P2021' });

    const result = await runReminderCron({});

    expect(result).toEqual({ scanned: 0, sent: 0, skipped: 0, errors: 0, details: [] });
  });
});
