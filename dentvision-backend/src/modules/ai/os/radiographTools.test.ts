import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The two halves of the radiograph flow, tested where they can go wrong:
 * reading must be gated by consent and must never write, and writing must not
 * happen without a human confirmation.
 */

const {
  patientFindFirst,
  patientImageFindMany,
  simpleChat,
  checkImageAnalysisConsent,
  resolveImageUrl,
  applyToothFindingsToChart,
} = vi.hoisted(() => ({
  patientFindFirst: vi.fn(),
  patientImageFindMany: vi.fn(),
  simpleChat: vi.fn(),
  checkImageAnalysisConsent: vi.fn(),
  resolveImageUrl: vi.fn(),
  applyToothFindingsToChart: vi.fn(),
}));

vi.mock('../../../lib/prisma.js', () => ({
  default: {
    patient: { findFirst: patientFindFirst },
    patientImage: { findMany: patientImageFindMany },
  },
}));
vi.mock('../llm/client.js', () => ({ simpleChat }));
vi.mock('../../../lib/imageUrl.js', () => ({ resolveImageUrl }));
vi.mock('./imageConsent.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  checkImageAnalysisConsent,
}));
vi.mock('../../patients/teethStore.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  applyToothFindings: applyToothFindingsToChart,
}));

const { TOOLS } = await import('./tools.js');

const CTX = { userId: 'u1', clinicId: 'c1', role: 'DOCTOR' };
const IMAGE = { id: 'img1', url: 's3://p1/opg.png', name: 'opg.png', type: 'X_RAY', createdAt: new Date() };

const MODEL_FINDINGS = JSON.stringify({
  findings: [
    { tooth: 16, status: 'caries', surfaces: ['O'], note: null },
    { tooth: 26, status: 'crown', surfaces: [], note: null },
  ],
});

beforeEach(() => {
  for (const m of [
    patientFindFirst, patientImageFindMany, simpleChat,
    checkImageAnalysisConsent, resolveImageUrl, applyToothFindingsToChart,
  ]) m.mockReset();

  checkImageAnalysisConsent.mockResolvedValue({ allowed: true, patientRegistered: true });
  patientImageFindMany.mockResolvedValue([IMAGE]);
  resolveImageUrl.mockResolvedValue('https://cdn.test/opg.png?sig=x');
  simpleChat.mockResolvedValue(MODEL_FINDINGS);
  patientFindFirst.mockResolvedValue({ id: 'p1', firstName: 'Иван', lastName: 'Иванов' });
  applyToothFindingsToChart.mockResolvedValue([{ tooth: 16, before: 'healthy', after: 'caries' }]);
});

describe('analyzeRadiograph', () => {
  it('sends the image and returns findings without writing anything', async () => {
    const result = await TOOLS.analyzeRadiograph.execute({ patientId: 'p1' }, CTX as any);

    expect(simpleChat.mock.calls[0][2].imageUrl).toBe('https://cdn.test/opg.png?sig=x');
    expect(result.ok).toBe(true);
    expect((result.data as any).findings).toHaveLength(2);
    expect(applyToothFindingsToChart).not.toHaveBeenCalled();
  });

  it.each([
    ['CLINIC_DISABLED'],
    ['PATIENT_DECLINED'],
    ['PATIENT_NOT_ASKED'],
  ])('refuses on %s without calling the model', async (reason) => {
    checkImageAnalysisConsent.mockResolvedValue({ allowed: false, reason });

    const result = await TOOLS.analyzeRadiograph.execute({ patientId: 'p1' }, CTX as any);

    expect(result.ok).toBe(false);
    expect(simpleChat).not.toHaveBeenCalled();
  });

  it('refuses when the only image is a format no model can read', async () => {
    patientImageFindMany.mockResolvedValue([{ ...IMAGE, url: 's3://p1/study.dcm', name: 'study.dcm' }]);

    const result = await TOOLS.analyzeRadiograph.execute({ patientId: 'p1' }, CTX as any);

    expect(result.ok).toBe(false);
    expect(simpleChat).not.toHaveBeenCalled();
  });

  it('drops a finding with an impossible tooth number or unknown status', async () => {
    simpleChat.mockResolvedValue(JSON.stringify({
      findings: [
        { tooth: 99, status: 'caries', surfaces: [], note: null },
        { tooth: 16, status: 'сгнил', surfaces: [], note: null },
        { tooth: 26, status: 'crown', surfaces: [], note: null },
      ],
    }));

    const result = await TOOLS.analyzeRadiograph.execute({ patientId: 'p1' }, CTX as any);

    expect((result.data as any).findings).toEqual([
      { tooth: 26, status: 'crown', surfaces: [], note: null },
    ]);
  });

  it('reports an unparsable answer instead of returning empty findings', async () => {
    simpleChat.mockResolvedValue('не JSON');

    const result = await TOOLS.analyzeRadiograph.execute({ patientId: 'p1' }, CTX as any);

    expect(result.ok).toBe(false);
  });
});

describe('applyToothFindings', () => {
  const findings = [{ tooth: 16, status: 'caries', surfaces: ['O'] }];

  it('returns a draft with a readable diff and writes nothing without confirmation', async () => {
    const result = await TOOLS.applyToothFindings.execute({ patientId: 'p1', findings }, CTX as any);

    expect(result.needsConfirmation?.action).toBe('applyToothFindings');
    expect(result.needsConfirmation?.summary).toContain('16 → caries');
    expect(applyToothFindingsToChart).not.toHaveBeenCalled();
  });

  it('writes once confirmed', async () => {
    const result = await TOOLS.applyToothFindings.execute(
      { patientId: 'p1', findings, confirmed: true },
      CTX as any,
    );

    expect(applyToothFindingsToChart).toHaveBeenCalledWith('p1', 'c1', expect.any(Array));
    expect((result.data as any).changes).toEqual([{ tooth: 16, before: 'healthy', after: 'caries' }]);
  });

  it('refuses when nothing survives validation, rather than confirming an empty write', async () => {
    const result = await TOOLS.applyToothFindings.execute(
      { patientId: 'p1', findings: [{ tooth: 99, status: 'caries' }] },
      CTX as any,
    );

    expect(result.ok).toBe(false);
    expect(result.needsConfirmation).toBeUndefined();
  });

  it('refuses a patient outside the caller’s clinic', async () => {
    patientFindFirst.mockResolvedValue(null);

    const result = await TOOLS.applyToothFindings.execute({ patientId: 'p-other', findings }, CTX as any);

    expect(result.ok).toBe(false);
    expect(applyToothFindingsToChart).not.toHaveBeenCalled();
  });
});

describe('registration', () => {
  it('routes the write through the approval queue, not a single click', async () => {
    const { HIGH_RISK_TOOLS, TOOL_PATIENT_ARG } = await import('./dataScope.js');
    const { TOOL_PERMISSIONS } = await import('./toolPermissions.js');

    expect(HIGH_RISK_TOOLS.has('applyToothFindings')).toBe(true);
    expect(HIGH_RISK_TOOLS.has('analyzeRadiograph')).toBe(false);
    expect(TOOL_PERMISSIONS.analyzeRadiograph).toBe('medical.read');
    expect(TOOL_PERMISSIONS.applyToothFindings).toBe('medical.write');
    expect(TOOL_PATIENT_ARG.analyzeRadiograph).toBe('patientId');
    expect(TOOL_PATIENT_ARG.applyToothFindings).toBe('patientId');
  });

  it('marks only the writing tool as mutating', async () => {
    expect(TOOLS.applyToothFindings.mutating).toBe(true);
    expect(TOOLS.analyzeRadiograph.mutating).toBeUndefined();
  });
});
