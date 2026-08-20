import { describe, expect, it, vi, beforeEach } from 'vitest';
import { linkStageReferences } from './planStageLinks.js';

const client = {
  appointment: { updateMany: vi.fn() },
  invoice: { updateMany: vi.fn() },
};

beforeEach(() => {
  vi.clearAllMocks();
  client.appointment.updateMany.mockResolvedValue({ count: 1 });
  client.invoice.updateMany.mockResolvedValue({ count: 1 });
});

describe('linkStageReferences', () => {
  it('links the appointment when one is given', async () => {
    await linkStageReferences(client, { planId: 'plan-1', clinicId: 'clinic-1', appointmentId: 'appt-1' });
    expect(client.appointment.updateMany).toHaveBeenCalledWith({
      where: { id: 'appt-1', clinicId: 'clinic-1' },
      data: { treatmentPlanId: 'plan-1' },
    });
    expect(client.invoice.updateMany).not.toHaveBeenCalled();
  });

  it('links the invoice when one is given', async () => {
    await linkStageReferences(client, { planId: 'plan-1', clinicId: 'clinic-1', invoiceId: 'inv-1' });
    expect(client.invoice.updateMany).toHaveBeenCalledWith({
      where: { id: 'inv-1', clinicId: 'clinic-1' },
      data: { treatmentPlanId: 'plan-1' },
    });
    expect(client.appointment.updateMany).not.toHaveBeenCalled();
  });

  it('links both when both are given', async () => {
    await linkStageReferences(client, { planId: 'plan-1', clinicId: 'clinic-1', appointmentId: 'appt-1', invoiceId: 'inv-1' });
    expect(client.appointment.updateMany).toHaveBeenCalledTimes(1);
    expect(client.invoice.updateMany).toHaveBeenCalledTimes(1);
  });

  it('does nothing when neither is given', async () => {
    await linkStageReferences(client, { planId: 'plan-1', clinicId: 'clinic-1' });
    expect(client.appointment.updateMany).not.toHaveBeenCalled();
    expect(client.invoice.updateMany).not.toHaveBeenCalled();
  });

  it('scopes the write by clinicId, so a guessed id from another tenant matches nothing', async () => {
    // The scoping is in the `where`, not a separate check: a mismatched
    // clinicId means updateMany matches zero rows, same as resolveEscalation.
    await linkStageReferences(client, { planId: 'plan-1', clinicId: 'clinic-1', appointmentId: 'appt-from-another-clinic' });
    const where = client.appointment.updateMany.mock.calls[0][0].where;
    expect(where.clinicId).toBe('clinic-1');
  });

  it('swallows a failed write instead of throwing, so it never fails the stage update itself', async () => {
    client.appointment.updateMany.mockRejectedValueOnce(new Error('db down'));
    await expect(
      linkStageReferences(client, { planId: 'plan-1', clinicId: 'clinic-1', appointmentId: 'appt-1' }),
    ).resolves.toBeUndefined();
  });
});
