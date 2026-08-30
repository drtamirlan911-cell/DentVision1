import { beforeEach, describe, expect, it, vi } from 'vitest';

const { patientFindFirst, patientUpdate, toothUpsert } = vi.hoisted(() => ({
  patientFindFirst: vi.fn(),
  patientUpdate: vi.fn(),
  toothUpsert: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  default: {
    patient: { findFirst: patientFindFirst, update: patientUpdate },
    tooth: { upsert: toothUpsert },
  },
}));

const { applyToothFindings, isValidFdi, syncTeeth } = await import('./teethStore.js');

/** What `patient.update` was asked to write. */
function writtenTeeth(): Record<string, any> {
  return (patientUpdate.mock.calls[0][0].data.medicalHistory as any).teeth;
}

beforeEach(() => {
  patientFindFirst.mockReset().mockResolvedValue({ id: 'p1', medicalHistory: {} });
  patientUpdate.mockReset().mockResolvedValue({});
  toothUpsert.mockReset().mockResolvedValue({});
});

describe('isValidFdi', () => {
  it.each([11, 18, 48, 55, 85])('accepts %i', (n) => expect(isValidFdi(n)).toBe(true));
  it.each([10, 19, 56, 90, 0, 5])('rejects %i', (n) => expect(isValidFdi(n)).toBe(false));
});

describe('applyToothFindings', () => {
  it('reports before → after for every tooth it touched', async () => {
    patientFindFirst.mockResolvedValue({ id: 'p1', medicalHistory: { teeth: { 16: { status: 'healthy' } } } });

    const changes = await applyToothFindings('p1', 'c1', [{ tooth: 16, status: 'caries', surfaces: ['O'] }]);

    expect(changes).toEqual([{ tooth: 16, before: 'healthy', after: 'caries' }]);
  });

  it('leaves teeth it was not told about exactly as they were', async () => {
    patientFindFirst.mockResolvedValue({
      id: 'p1',
      medicalHistory: { teeth: { 16: { status: 'healthy' }, 26: { status: 'crown', surfaces: {} } } },
    });

    await applyToothFindings('p1', 'c1', [{ tooth: 16, status: 'caries' }]);

    expect(writtenTeeth()['26']).toEqual({ status: 'crown', surfaces: {} });
  });

  it('keeps unrelated fields of a tooth it does update', async () => {
    patientFindFirst.mockResolvedValue({
      id: 'p1',
      medicalHistory: { teeth: { 16: { status: 'healthy', diagnosis: 'K02.1' } } },
    });

    await applyToothFindings('p1', 'c1', [{ tooth: 16, status: 'filled' }]);

    expect(writtenTeeth()['16']).toMatchObject({ status: 'filled', diagnosis: 'K02.1' });
  });

  it('merges new surfaces onto existing ones', async () => {
    patientFindFirst.mockResolvedValue({
      id: 'p1',
      medicalHistory: { teeth: { 16: { status: 'caries', surfaces: { M: 'caries' } } } },
    });

    await applyToothFindings('p1', 'c1', [{ tooth: 16, status: 'filled', surfaces: ['O'] }]);

    expect(writtenTeeth()['16'].surfaces).toEqual({ M: 'caries', O: 'filled' });
  });

  it.each(['missing', 'extracted', 'implant'])(
    'clears surface paint when the tooth becomes %s',
    async (status) => {
      // A tooth that is gone cannot keep caries on a surface it no longer has.
      patientFindFirst.mockResolvedValue({
        id: 'p1',
        medicalHistory: { teeth: { 16: { status: 'caries', surfaces: { O: 'caries' } } } },
      });

      await applyToothFindings('p1', 'c1', [{ tooth: 16, status }]);

      expect(writtenTeeth()['16'].surfaces).toEqual({});
    },
  );

  it('ignores an invalid FDI number instead of writing it', async () => {
    const changes = await applyToothFindings('p1', 'c1', [
      { tooth: 99, status: 'caries' },
      { tooth: 16, status: 'caries' },
    ]);

    expect(changes.map((c) => c.tooth)).toEqual([16]);
    expect(writtenTeeth()['99']).toBeUndefined();
  });

  it('drops a surface letter that is not a real surface', async () => {
    await applyToothFindings('p1', 'c1', [{ tooth: 16, status: 'caries', surfaces: ['O', 'Z'] }]);

    expect(writtenTeeth()['16'].surfaces).toEqual({ O: 'caries' });
  });

  it('writes nothing at all when no finding survives validation', async () => {
    const changes = await applyToothFindings('p1', 'c1', [{ tooth: 99, status: 'caries' }]);

    expect(changes).toEqual([]);
    expect(patientUpdate).not.toHaveBeenCalled();
    expect(toothUpsert).not.toHaveBeenCalled();
  });

  it('mirrors the map into Tooth rows, so the two shapes cannot diverge', async () => {
    await applyToothFindings('p1', 'c1', [{ tooth: 16, status: 'caries', surfaces: ['O'] }]);

    expect(toothUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { patientId_number: { patientId: 'p1', number: 16 } } }),
    );
  });

  it('refuses a patient from another clinic', async () => {
    patientFindFirst.mockResolvedValue(null);

    await expect(applyToothFindings('p1', 'other', [{ tooth: 16, status: 'caries' }])).rejects.toThrow(
      'PATIENT_NOT_FOUND',
    );
    expect(patientFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p1', clinicId: 'other' } }),
    );
  });

  it('survives a patient whose medicalHistory has never been set', async () => {
    patientFindFirst.mockResolvedValue({ id: 'p1', medicalHistory: null });

    await expect(applyToothFindings('p1', 'c1', [{ tooth: 16, status: 'caries' }])).resolves.toEqual([
      { tooth: 16, before: 'healthy', after: 'caries' },
    ]);
  });
});

describe('syncTeeth', () => {
  it('encodes surfaces into notes, the shape the rest of the backend reads', async () => {
    await syncTeeth('p1', { 16: { status: 'caries', surfaces: { O: 'caries' } } });

    const call = toothUpsert.mock.calls[0][0];
    expect(call.create.condition).toBe('caries');
    expect(JSON.parse(call.create.notes)).toEqual({ surfaces: { O: 'caries' }, note: null });
  });

  it('accepts the legacy plain-string form of a tooth', async () => {
    await syncTeeth('p1', { 16: 'crown' });

    expect(toothUpsert.mock.calls[0][0].create.condition).toBe('crown');
  });

  it('skips a key that is not a tooth number', async () => {
    await syncTeeth('p1', { notATooth: { status: 'caries' } });

    expect(toothUpsert).not.toHaveBeenCalled();
  });
});
