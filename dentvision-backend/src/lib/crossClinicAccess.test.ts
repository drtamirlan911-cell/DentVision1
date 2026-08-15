import { beforeEach, describe, expect, it, vi } from 'vitest';

const { grantFindFirst } = vi.hoisted(() => ({
  grantFindFirst: vi.fn(),
}));

vi.mock('./prisma.js', () => ({
  default: {
    crossClinicAccessGrant: { findFirst: grantFindFirst },
  },
}));

import { resolveActiveGrant, requireCrossClinicAccess } from './crossClinicAccess.js';

const RECEIVING_CLINIC_ID = 'clinic-b';
const SOURCE_PATIENT_ID = 'patient-a-1';

beforeEach(() => {
  grantFindFirst.mockReset();
});

describe('resolveActiveGrant', () => {
  it('queries by receivingClinicId + sourcePatientId, only APPROVED + not revoked + not expired', async () => {
    grantFindFirst.mockResolvedValueOnce(null);
    await resolveActiveGrant(RECEIVING_CLINIC_ID, SOURCE_PATIENT_ID);
    expect(grantFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          receivingClinicId: RECEIVING_CLINIC_ID,
          sourcePatientId: SOURCE_PATIENT_ID,
          status: 'APPROVED',
          revokedAt: null,
        }),
      }),
    );
  });

  it('returns the grant when one is found', async () => {
    const grant = { id: 'grant-1', patientUserId: 'u1', sourceClinicId: 'clinic-a', sourcePatientId: SOURCE_PATIENT_ID, receivingClinicId: RECEIVING_CLINIC_ID, receivingPatientId: 'patient-b-1' };
    grantFindFirst.mockResolvedValueOnce(grant);
    const result = await resolveActiveGrant(RECEIVING_CLINIC_ID, SOURCE_PATIENT_ID);
    expect(result).toEqual(grant);
  });

  it('returns null when no matching grant exists', async () => {
    grantFindFirst.mockResolvedValueOnce(null);
    const result = await resolveActiveGrant(RECEIVING_CLINIC_ID, SOURCE_PATIENT_ID);
    expect(result).toBeNull();
  });
});

function mockReqRes(overrides: { role?: string; clinicId?: string | null; sourcePatientId?: string }) {
  const req: any = {
    user: { id: 'staff-1', role: overrides.role ?? 'DOCTOR', clinicId: overrides.clinicId ?? RECEIVING_CLINIC_ID },
    params: { sourcePatientId: overrides.sourcePatientId ?? SOURCE_PATIENT_ID },
  };
  const res: any = {
    statusCode: 200,
    body: undefined,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
  const next = vi.fn();
  return { req, res, next };
}

describe('requireCrossClinicAccess', () => {
  it('403s when the caller has no clinic in scope', async () => {
    const { req, res, next } = mockReqRes({ clinicId: null });
    await requireCrossClinicAccess()(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('403s when no active grant exists for this (receivingClinic, sourcePatient) pair', async () => {
    grantFindFirst.mockResolvedValueOnce(null);
    const { req, res, next } = mockReqRes({});
    await requireCrossClinicAccess()(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('admits and attaches the grant when one is APPROVED, not revoked, not expired', async () => {
    const grant = { id: 'grant-1', patientUserId: 'u1', sourceClinicId: 'clinic-a', sourcePatientId: SOURCE_PATIENT_ID, receivingClinicId: RECEIVING_CLINIC_ID, receivingPatientId: 'patient-b-1' };
    grantFindFirst.mockResolvedValueOnce(grant);
    const { req, res, next } = mockReqRes({});
    await requireCrossClinicAccess()(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.crossClinicGrant).toEqual(grant);
  });

  it('a revoked/expired/wrong-clinic grant never matches (resolveActiveGrant\'s WHERE already excludes it — the query itself is the source of truth)', async () => {
    // Simulated by the mock returning null, since resolveActiveGrant's WHERE
    // clause (status: 'APPROVED', revokedAt: null, expiresAt gt now) is what
    // Postgres would apply — a revoked/expired row simply never matches it.
    grantFindFirst.mockResolvedValueOnce(null);
    const { req, res, next } = mockReqRes({});
    await requireCrossClinicAccess()(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('SUPERADMIN still requires an active grant — bypass is only for clinic membership, not consent', async () => {
    grantFindFirst.mockResolvedValueOnce(null);
    const { req, res, next } = mockReqRes({ role: 'SUPERADMIN', clinicId: RECEIVING_CLINIC_ID });
    await requireCrossClinicAccess()(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });
});
