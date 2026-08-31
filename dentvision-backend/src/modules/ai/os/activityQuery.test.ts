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

import { buildActivityFilter, buildApprovalFilter, redactPhiRows } from './activityQuery.js';

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

  // Evidence carries the patient id as `sourceId`. Returning it while nulling
  // `argsRedacted` would hand back through one field exactly what the other
  // just hid, so it goes through the same gate.
  describe('evidence', () => {
    const withEvidence = [
      {
        id: 'a1',
        sensitivity: 'phi',
        argsRedacted: { patientId: 'p1' },
        resultSummary: 'saw patient',
        evidence: [
          { id: 'e1', sourceType: 'tool', sourceId: 'getPatientCard', snapshot: null },
          { id: 'e2', sourceType: 'patient', sourceId: 'p1', snapshot: { name: 'Иванов' } },
        ],
      },
      {
        id: 'a2',
        sensitivity: 'standard',
        argsRedacted: { foo: 'bar' },
        resultSummary: 'ok',
        evidence: [{ id: 'e3', sourceType: 'tool', sourceId: 'getSchedule', snapshot: null }],
      },
    ];

    it('strips identifying source ids on PHI rows for a caller without medical.read', () => {
      const result = redactPhiRows(withEvidence, false);

      expect(result[0].evidence).toEqual([
        { id: 'e1', sourceType: 'tool', sourceId: '', snapshot: null },
        { id: 'e2', sourceType: 'patient', sourceId: '', snapshot: null },
      ]);
    });

    // The entries themselves stay: "an action touched a patient record" is not
    // secret, only which record it was.
    it('keeps the entries so the reader still sees what kind of source was used', () => {
      const result = redactPhiRows(withEvidence, false);

      expect(result[0].evidence?.map((e) => e.sourceType)).toEqual(['tool', 'patient']);
    });

    it('leaves evidence on standard rows untouched', () => {
      const result = redactPhiRows(withEvidence, false);

      expect(result[1].evidence).toEqual(withEvidence[1].evidence);
    });

    it('passes everything through for a caller who can read PHI', () => {
      expect(redactPhiRows(withEvidence, true)).toEqual(withEvidence);
    });
  });
});

/**
 * Stage 12 performance guard. Neither filter function ever queries
 * `AgentActivity`/`AiApproval` itself — it only resolves the *caller's*
 * identity (role, clinic membership, org id, permission set) and returns a
 * WHERE clause for the route to run once against those tables. "No N+1"
 * here means exactly that: the round-trip count is fixed per call and
 * cannot grow with how many activity/approval rows the resulting WHERE
 * clause will later match — a route showing 5 rows or 5,000 costs the same.
 * The mocked `prisma` above only exposes `user`, so a future change that
 * added a per-row lookup (e.g. one query per team the caller belongs to)
 * would throw here immediately rather than silently regressing.
 */
describe('buildActivityFilter / buildApprovalFilter — no N+1 (Stage 12 perf guard)', () => {
  it('resolves the visibility ladder in a fixed, small number of round trips', async () => {
    userFindUnique.mockResolvedValueOnce({ role: 'MANAGER' });
    resolveClinicAccess.mockResolvedValueOnce({ role: 'MANAGER' });
    resolveUserPermissions.mockResolvedValueOnce(['bi.read']);

    await buildActivityFilter(USER_ID, CLINIC_ID);

    expect(userFindUnique).toHaveBeenCalledTimes(1);
    expect(resolveClinicAccess).toHaveBeenCalledTimes(1);
    expect(resolveOrganizationIdForClinic).toHaveBeenCalledTimes(1);
    expect(resolveUserPermissions).toHaveBeenCalledTimes(1);
  });

  it('costs the same fixed round trips per call, whether resolved once or a hundred times', async () => {
    userFindUnique.mockResolvedValue({ role: 'MANAGER' });
    resolveClinicAccess.mockResolvedValue({ role: 'MANAGER' });
    resolveUserPermissions.mockResolvedValue(['bi.read']);

    for (let i = 0; i < 100; i += 1) {
      await buildActivityFilter(USER_ID, CLINIC_ID);
    }

    // 100 calls × the same fixed 3 dependency round trips each (identity
    // resolution is shared with buildApprovalFilter) — a straight line, not
    // a curve that steepens with row count or caller history.
    expect(userFindUnique).toHaveBeenCalledTimes(100);
    expect(resolveClinicAccess).toHaveBeenCalledTimes(100);
    expect(resolveUserPermissions).toHaveBeenCalledTimes(100);
  });

  it('shares the identical resolution cost with buildApprovalFilter — one visibility ladder, two callers', async () => {
    userFindUnique.mockResolvedValueOnce({ role: 'MANAGER' });
    resolveClinicAccess.mockResolvedValueOnce({ role: 'MANAGER' });
    resolveUserPermissions.mockResolvedValueOnce(['bi.read']);

    const { where } = await buildApprovalFilter(USER_ID, CLINIC_ID);

    expect(where).toEqual({
      OR: [{ requestedByUserId: USER_ID }, { clinicId: CLINIC_ID }, { organizationId: ORG_ID }],
    });
    expect(userFindUnique).toHaveBeenCalledTimes(1);
    expect(resolveClinicAccess).toHaveBeenCalledTimes(1);
    expect(resolveUserPermissions).toHaveBeenCalledTimes(1);
  });

  it('never touches AgentActivity/AiApproval itself — the mock only exposes `user`, so a stray query would throw here first', async () => {
    userFindUnique.mockResolvedValueOnce({ role: 'SUPERADMIN' });
    await expect(buildActivityFilter(USER_ID, CLINIC_ID)).resolves.toEqual({ where: {}, canReadPhi: true });
  });
});
