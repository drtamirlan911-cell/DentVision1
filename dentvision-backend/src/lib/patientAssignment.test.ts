import { describe, expect, it, vi, beforeEach } from 'vitest';

const { upsertMock, updateManyMock } = vi.hoisted(() => ({
  upsertMock: vi.fn(),
  updateManyMock: vi.fn(),
}));

vi.mock('./prisma.js', () => ({
  default: {
    patientAssignment: { upsert: upsertMock, updateMany: updateManyMock },
  },
}));

import { ensurePatientAssignment, revokePatientAssignment, isAssignmentRole } from './patientAssignment.js';

beforeEach(() => {
  upsertMock.mockReset().mockResolvedValue({ id: 'pa1' });
  updateManyMock.mockReset().mockResolvedValue({ count: 1 });
});

describe('ensurePatientAssignment', () => {
  it('upserts on the compound unique so a repeat booking cannot create a second row', async () => {
    await ensurePatientAssignment({ clinicId: 'c1', patientId: 'p1', userId: 'u1' });

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const call = upsertMock.mock.calls[0][0];
    expect(call.where).toEqual({
      patientId_userId_role: { patientId: 'p1', userId: 'u1', role: 'treating_doctor' },
    });
    expect(call.create).toMatchObject({ clinicId: 'c1', patientId: 'p1', userId: 'u1', active: true });
  });

  it('reactivates a revoked link instead of leaving it off', async () => {
    await ensurePatientAssignment({ clinicId: 'c1', patientId: 'p1', userId: 'u1' });

    expect(upsertMock.mock.calls[0][0].update).toMatchObject({ active: true });
  });

  it('honours a non-default role', async () => {
    await ensurePatientAssignment({ clinicId: 'c1', patientId: 'p1', userId: 'u1', role: 'assistant' });

    expect(upsertMock.mock.calls[0][0].where.patientId_userId_role.role).toBe('assistant');
  });

  // An appointment with no doctor is legal in this schema — there is simply
  // nobody to assign, and that must not look like an error.
  it.each([
    ['no clinic', { clinicId: null, patientId: 'p1', userId: 'u1' }],
    ['no patient', { clinicId: 'c1', patientId: null, userId: 'u1' }],
    ['no doctor', { clinicId: 'c1', patientId: 'p1', userId: null }],
  ])('writes nothing and reports false when there is %s', async (_label, input) => {
    const written = await ensurePatientAssignment(input as never);

    expect(written).toBe(false);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  // Booking an appointment must not fail because a scope hint could not be
  // recorded — the subscriber that calls this is on the booking path.
  it('swallows a database failure rather than failing the caller', async () => {
    upsertMock.mockRejectedValue(new Error('deadlock'));

    await expect(ensurePatientAssignment({ clinicId: 'c1', patientId: 'p1', userId: 'u1' }))
      .resolves.toBe(false);
  });
});

describe('revokePatientAssignment', () => {
  it('scopes the revoke by clinic so an id from another tenant matches nothing', async () => {
    await revokePatientAssignment('c1', 'pa1');

    expect(updateManyMock.mock.calls[0][0].where).toEqual({ id: 'pa1', clinicId: 'c1', active: true });
  });

  it('reports false when nothing matched', async () => {
    updateManyMock.mockResolvedValue({ count: 0 });

    await expect(revokePatientAssignment('c1', 'missing')).resolves.toBe(false);
  });
});

describe('isAssignmentRole', () => {
  it.each(['treating_doctor', 'assistant', 'coordinator'])('accepts %s', (role) => {
    expect(isAssignmentRole(role)).toBe(true);
  });

  it.each([['OWNER'], ['doctor'], [''], [null], [42]])('rejects %s', (value) => {
    expect(isAssignmentRole(value)).toBe(false);
  });
});
