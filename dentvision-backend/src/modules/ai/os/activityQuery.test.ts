import { beforeEach, describe, expect, it, vi } from 'vitest';

const { userFindUnique, resolveClinicAccess, resolveOrganizationIdForClinic, resolveUserPermissions } = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  resolveClinicAccess: vi.fn(),
  resolveOrganizationIdForClinic: vi.fn(),
  resolveUserPermissions: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({
  default: { user: { findUnique: userFindUnique } },
}));
vi.mock('../../../lib/orgContext.js', () => ({ resolveClinicAccess, resolveOrganizationIdForClinic }));
vi.mock('../../../lib/resolvePermissions.js', () => ({ resolveUserPermissions }));

import { buildActivityFilter, redactPhiRows } from './activityQuery.js';

const USER_ID = 'user-1';
const CLINIC_ID = 'clinic-1';
const ORG_ID = 'org-1';

beforeEach(() => {
  vi.clearAllMocks();
  resolveOrganizationIdForClinic.mockResolvedValue(ORG_ID);
});

describe('buildActivityFilter', () => {
  it('denies everything for an unresolvable caller', async () => {
    userFindUnique.mockResolvedValueOnce(null);
    const { where, canReadPhi } = await buildActivityFilter('ghost', CLINIC_ID);
    expect(where).toEqual({ id: { equals: '__no_such_activity__' } });
    expect(canReadPhi).toBe(false);
  });

  it('gives SUPERADMIN the unrestricted platform tier, including PHI', async () => {
    userFindUnique.mockResolvedValueOnce({ role: 'SUPERADMIN' });
    const { where, canReadPhi } = await buildActivityFilter(USER_ID, null);
    expect(where).toEqual({});
    expect(canReadPhi).toBe(true);
    expect(resolveClinicAccess).not.toHaveBeenCalled();
  });

  it('narrows a caller with no bi.read to their own actions only', async () => {
    userFindUnique.mockResolvedValueOnce({ role: 'DOCTOR' });
    resolveClinicAccess.mockResolvedValueOnce({ role: 'DOCTOR' });
    resolveUserPermissions.mockResolvedValueOnce(['medical.read', 'appointments.read']);

    const { where, canReadPhi } = await buildActivityFilter(USER_ID, CLINIC_ID);

    expect(where).toEqual({ OR: [{ actorUserId: USER_ID }] });
    expect(canReadPhi).toBe(true);
  });

  it('widens to clinic and organization for a caller with bi.read', async () => {
    userFindUnique.mockResolvedValueOnce({ role: 'MANAGER' });
    resolveClinicAccess.mockResolvedValueOnce({ role: 'MANAGER' });
    resolveUserPermissions.mockResolvedValueOnce(['bi.read']);

    const { where, canReadPhi } = await buildActivityFilter(USER_ID, CLINIC_ID);

    expect(where).toEqual({
      OR: [{ actorUserId: USER_ID }, { clinicId: CLINIC_ID }, { organizationId: ORG_ID }],
    });
    expect(canReadPhi).toBe(false);
  });

  it('drops the clinic/org branches when clinic membership does not verify', async () => {
    userFindUnique.mockResolvedValueOnce({ role: 'MANAGER' });
    resolveClinicAccess.mockResolvedValueOnce(null);
    resolveUserPermissions.mockResolvedValueOnce(['bi.read']);

    const { where } = await buildActivityFilter(USER_ID, 'someone-elses-clinic');

    expect(where).toEqual({ OR: [{ actorUserId: USER_ID }] });
  });
});

describe('redactPhiRows', () => {
  const rows = [
    { id: 'a1', sensitivity: 'phi', argsRedacted: { patientId: 'p1' }, resultSummary: 'saw patient' },
    { id: 'a2', sensitivity: 'standard', argsRedacted: { foo: 'bar' }, resultSummary: 'ok' },
  ];

  it('passes rows through untouched when the caller can read PHI', () => {
    expect(redactPhiRows(rows, true)).toEqual(rows);
  });

  it('nulls payload/result on PHI rows only, leaving standard rows intact', () => {
    const result = redactPhiRows(rows, false);
    expect(result[0]).toMatchObject({ id: 'a1', argsRedacted: null, resultSummary: null });
    expect(result[1]).toEqual(rows[1]);
  });
});
