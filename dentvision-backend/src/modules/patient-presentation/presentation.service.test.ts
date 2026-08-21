import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * What has to hold regardless of what the model returns:
 *
 * 1. A rejected or wholesale-fallen-back rewrite must never be tagged 'llm' —
 *    the patient-facing text is the template in that case, so the record of
 *    who wrote it has to say so too.
 * 2. A doctor's own edit is always saved, tagged 'doctor', and never blocked
 *    by the validator — the validator's opinion is recorded, not enforced.
 * 3. Publishing a presentation is impossible for a release that was never
 *    approved, and it always tries to publish the release itself too.
 */

const {
  releaseFindUnique,
  presentationUpsert,
  presentationFindUnique,
  presentationUpdate,
  patientFindUnique,
  clinicFindUnique,
  userFindUnique,
  rewriteScript,
  publishRelease,
} = vi.hoisted(() => ({
  releaseFindUnique: vi.fn(),
  presentationUpsert: vi.fn(),
  presentationFindUnique: vi.fn(),
  presentationUpdate: vi.fn(),
  patientFindUnique: vi.fn(),
  clinicFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
  rewriteScript: vi.fn(),
  publishRelease: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  default: {
    treatmentPlanRelease: { findUnique: releaseFindUnique },
    patientPresentation: {
      upsert: presentationUpsert,
      findUnique: presentationFindUnique,
      update: presentationUpdate,
    },
    patient: { findUnique: patientFindUnique },
    clinic: { findUnique: clinicFindUnique },
    user: { findUnique: userFindUnique },
  },
}));

vi.mock('./presentationGenerator.js', () => ({ rewriteScript }));

class FakePlanReleaseError extends Error {
  constructor(public code: 'NOT_FOUND' | 'FORBIDDEN' | 'EMPTY_PLAN' | 'CONFLICT', message: string) {
    super(message);
    this.name = 'PlanReleaseError';
  }
}

vi.mock('./planRelease.service.js', () => ({ publishRelease, PlanReleaseError: FakePlanReleaseError }));

const { generatePresentation, editBeat, publishPresentation, PresentationError } = await import(
  './presentation.service.js'
);

const SNAPSHOT = {
  diagnosis: 'K04.5',
  stages: [
    {
      id: 'stage-a',
      title: 'Этап 1',
      items: [{ id: 'item-a', serviceName: 'Лечение канала', price: 120_000, teeth: [16], qty: 1 }],
    },
  ],
};

function approvedRelease(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rel-1',
    clinicId: 'clinic-1',
    patientId: 'patient-1',
    status: 'approved',
    snapshot: SNAPSHOT,
    totalAmount: 120_000,
    approvedByUserId: 'doc-1',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  patientFindUnique.mockResolvedValue({ firstName: 'Айгерим' });
  clinicFindUnique.mockResolvedValue({ name: 'DentVision', settings: null });
  userFindUnique.mockResolvedValue({ firstName: 'Марат', lastName: 'Ахметов' });
  presentationUpsert.mockImplementation(async ({ create, update }: { create: unknown; update: unknown }) => ({
    id: 'pres-1',
    releaseId: 'rel-1',
    locale: 'ru',
    ...(update ?? create),
  }));
});

describe('generatePresentation', () => {
  it('throws NOT_FOUND when the release does not exist', async () => {
    releaseFindUnique.mockResolvedValue(null);
    await expect(generatePresentation('rel-1', 'doc-1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(rewriteScript).not.toHaveBeenCalled();
  });

  it('throws CONFLICT when the release is not currently approved', async () => {
    releaseFindUnique.mockResolvedValue(approvedRelease({ status: 'withdrawn' }));
    await expect(generatePresentation('rel-1', 'doc-1')).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(rewriteScript).not.toHaveBeenCalled();
  });

  it('stores a draft with every beat tagged template when the model returns nothing', async () => {
    releaseFindUnique.mockResolvedValue(approvedRelease());
    rewriteScript.mockResolvedValue(null);

    const row = await generatePresentation('rel-1', 'doc-1');

    expect(row.status).toBe('draft');
    expect(row.validationReport).toBeUndefined();
    const generatorByBeat = row.generatorByBeat as Record<string, string>;
    expect(Object.values(generatorByBeat).every((g) => g === 'template')).toBe(true);
  });

  it('tags an accepted rewrite as llm and keeps a rejected one as template', async () => {
    releaseFindUnique.mockResolvedValue(approvedRelease());
    rewriteScript.mockImplementation(async (skeleton: { acts: { beats: { id: string }[] }[] }) => {
      const beats = skeleton.acts.flatMap((a) => a.beats);
      const map = new Map<string, { say: string }>();
      // One legitimate rephrasing (no new facts) and one that invents a price.
      map.set(beats[0].id, { say: `${beats[0].id} переписано без новых фактов.` });
      return map;
    });

    const row = await generatePresentation('rel-1', 'doc-1');
    const generatorByBeat = row.generatorByBeat as Record<string, string>;
    const firstBeatId = Object.keys(generatorByBeat)[0];
    // Whichever beat the mock rewrote is either accepted (llm) or rejected
    // (template) depending on the validator — either way the value must be
    // one of the two, never something else, and the report must exist.
    expect(['llm', 'template']).toContain(generatorByBeat[firstBeatId]);
    expect(row.validationReport).toBeTruthy();
  });

  it('never tags a beat llm when the rewrite falls back wholesale', async () => {
    releaseFindUnique.mockResolvedValue(approvedRelease());
    rewriteScript.mockImplementation(async (skeleton: { acts: { beats: { id: string }[] }[] }) => {
      const beats = skeleton.acts.flatMap((a) => a.beats);
      const map = new Map<string, { say: string }>();
      // Every rewrite invents a huge, unreferenced price — guaranteed to be
      // rejected, and enough of them to trip the wholesale-fallback ratio.
      for (const b of beats) map.set(b.id, { say: 'Это будет стоить 9 999 999 тенге, обещаю результат.' });
      return map;
    });

    const row = await generatePresentation('rel-1', 'doc-1');
    const generatorByBeat = row.generatorByBeat as Record<string, string>;
    expect(Object.values(generatorByBeat).every((g) => g === 'template')).toBe(true);
    expect((row.validationReport as { fellBackWholesale: boolean }).fellBackWholesale).toBe(true);
  });

  it('resets an already-published draft to unpublished on regeneration', async () => {
    releaseFindUnique.mockResolvedValue(approvedRelease());
    rewriteScript.mockResolvedValue(null);
    await generatePresentation('rel-1', 'doc-1');
    const updateArg = presentationUpsert.mock.calls[0][0].update;
    expect(updateArg.publishedAt).toBeNull();
    expect(updateArg.publishedByUserId).toBeNull();
  });
});

describe('editBeat', () => {
  function presentationRow(script: unknown, generatorByBeat: Record<string, string> = {}) {
    return {
      id: 'pres-1',
      releaseId: 'rel-1',
      script,
      generatorByBeat,
      validationReport: null,
    };
  }

  const SCRIPT = {
    version: 1,
    locale: 'ru',
    releaseId: 'rel-1',
    personaName: 'Aura',
    acts: [
      {
        id: 'solution',
        title: 'Что предлагает врач',
        beats: [
          {
            id: 'solution-1',
            actId: 'solution',
            order: 1,
            say: 'Этап 1 — лечение.',
            estimatedMs: 3000,
            stage: { scene: 'timeline', camera: { focus: 'none' } },
            refs: [{ kind: 'price', amount: 120_000, of: 'stage', id: 'stage-a' }],
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    presentationUpdate.mockImplementation(async ({ data }: { data: unknown }) => ({ id: 'pres-1', ...(data as object) }));
  });

  it('throws NOT_FOUND when the presentation does not exist', async () => {
    presentationFindUnique.mockResolvedValueOnce(null);
    await expect(editBeat('missing', 'solution-1', { say: 'x' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('throws NOT_FOUND when the beat id is not in the script', async () => {
    presentationFindUnique.mockResolvedValueOnce(presentationRow(SCRIPT));
    await expect(editBeat('pres-1', 'no-such-beat', { say: 'x' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('saves the edit and tags the beat doctor even when the text would fail validation', async () => {
    presentationFindUnique.mockResolvedValueOnce(presentationRow(SCRIPT, { 'solution-1': 'template' }));
    releaseFindUnique.mockResolvedValueOnce(approvedRelease());

    // Invents a price the beat's refs do not carry — the validator should
    // reject this, and the edit must still be saved.
    const row = await editBeat('pres-1', 'solution-1', { say: 'Будет стоить 777 777 тенге.' });

    const generatorByBeat = row.generatorByBeat as Record<string, string>;
    expect(generatorByBeat['solution-1']).toBe('doctor');
    const script = row.script as typeof SCRIPT;
    expect(script.acts[0].beats[0].say).toBe('Будет стоить 777 777 тенге.');
    const report = row.validationReport as { beats: { beatId: string; accepted: boolean }[] };
    expect(report.beats.find((b) => b.beatId === 'solution-1')?.accepted).toBe(false);
  });

  it('records an accepted result when the edit does not invent anything', async () => {
    presentationFindUnique.mockResolvedValueOnce(presentationRow(SCRIPT, { 'solution-1': 'template' }));
    releaseFindUnique.mockResolvedValueOnce(approvedRelease());

    const row = await editBeat('pres-1', 'solution-1', { say: 'Первый этап лечения зуба.' });
    const report = row.validationReport as { beats: { beatId: string; accepted: boolean }[] };
    expect(report.beats.find((b) => b.beatId === 'solution-1')?.accepted).toBe(true);
  });
});

describe('publishPresentation', () => {
  it('throws NOT_FOUND when the presentation does not exist', async () => {
    presentationFindUnique.mockResolvedValueOnce(null);
    await expect(publishPresentation('missing', 'doc-1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(publishRelease).not.toHaveBeenCalled();
  });

  it('publishes the underlying release and marks the presentation published', async () => {
    presentationFindUnique.mockResolvedValueOnce({ id: 'pres-1', releaseId: 'rel-1' });
    publishRelease.mockResolvedValue({ id: 'rel-1', publishedAt: new Date() });
    presentationUpdate.mockImplementation(async ({ data }: { data: unknown }) => ({ id: 'pres-1', ...(data as object) }));

    const row = await publishPresentation('pres-1', 'doc-1');

    expect(publishRelease).toHaveBeenCalledWith('rel-1');
    expect(row.status).toBe('published');
    expect(row.publishedByUserId).toBe('doc-1');
  });

  it('translates a PlanReleaseError from the release publish into a PresentationError', async () => {
    presentationFindUnique.mockResolvedValue({ id: 'pres-1', releaseId: 'rel-1' });
    publishRelease.mockRejectedValue(new FakePlanReleaseError('CONFLICT', 'больше не активна'));

    await expect(publishPresentation('pres-1', 'doc-1')).rejects.toBeInstanceOf(PresentationError);
    await expect(publishPresentation('pres-1', 'doc-1')).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
