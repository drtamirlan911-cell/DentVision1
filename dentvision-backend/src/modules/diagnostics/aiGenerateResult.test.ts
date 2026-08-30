import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The behaviour under test is a removal as much as an addition.
 *
 * This path used to tell the model "ты врач-рентгенолог, опиши находки", hand
 * it the patient's name and complaints, and save the answer into the medical
 * record with `aiGenerated: true` — without ever sending the radiograph. These
 * tests pin the two halves of the fix: the image is actually sent, and when it
 * cannot be, nothing is written at all.
 */

const {
  referralFindUnique,
  resultFindUnique,
  resultCreate,
  resultUpdate,
  resultUpsert,
  simpleChat,
  checkImageAnalysisConsent,
  resolveImageUrl,
  dispatchNotifications,
} = vi.hoisted(() => ({
  referralFindUnique: vi.fn(),
  resultFindUnique: vi.fn(),
  resultCreate: vi.fn(),
  resultUpdate: vi.fn(),
  resultUpsert: vi.fn(),
  simpleChat: vi.fn(),
  checkImageAnalysisConsent: vi.fn(),
  resolveImageUrl: vi.fn(),
  dispatchNotifications: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  default: {
    referral: { findUnique: referralFindUnique },
    diagnosticResult: {
      findUnique: resultFindUnique,
      create: resultCreate,
      update: resultUpdate,
      upsert: resultUpsert,
    },
  },
}));
vi.mock('../ai/llm/client.js', () => ({ simpleChat }));
vi.mock('../../lib/imageUrl.js', () => ({ resolveImageUrl }));
vi.mock('../ai/os/imageConsent.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  checkImageAnalysisConsent,
}));
vi.mock('../notifications/dispatch.service.js', () => ({ dispatchNotifications }));
vi.mock('../compliance/audit.service.js', () => ({ writeAuditLog: vi.fn() }));
vi.mock('../../lib/events.js', () => ({ publish: vi.fn() }));
vi.mock('../../services/notification.service.js', () => ({
  createNotification: vi.fn(),
  createNotificationForCenter: vi.fn(),
  NOTIFICATION_TYPES: {},
}));

const { aiGenerateResult, DiagnosticAiUnavailable } = await import('./diagnostics.service.js');

const XRAY_FILE = { fileUrl: 's3://referrals/r1/opg.png', fileName: 'opg.png' };

function referral(over: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    clinicId: 'c1',
    patientId: 'p1',
    patientName: 'Иванов И.',
    category: 'OPG',
    studyType: 'ОПТГ',
    complaints: 'боль в 16',
    preliminaryDx: null,
    studyGoal: null,
    clinic: { name: 'Клиника' },
    files: [XRAY_FILE],
    ...over,
  };
}

const GOOD_REPORT = JSON.stringify({
  description: 'Ортопантомограмма удовлетворительного качества.',
  findings: ['Периапикальное разрежение у 16'],
  conclusion: 'Хронический периодонтит 16',
  recommendations: ['Эндодонтическое лечение 16'],
});

beforeEach(() => {
  for (const m of [
    referralFindUnique, resultFindUnique, resultCreate, resultUpdate, resultUpsert,
    simpleChat, checkImageAnalysisConsent, resolveImageUrl, dispatchNotifications,
  ]) m.mockReset();

  referralFindUnique.mockResolvedValue(referral());
  checkImageAnalysisConsent.mockResolvedValue({ allowed: true, patientRegistered: true });
  resolveImageUrl.mockResolvedValue('https://cdn.test/opg.png?sig=x');
  simpleChat.mockResolvedValue(GOOD_REPORT);
  resultFindUnique.mockResolvedValue(null);
  resultCreate.mockImplementation(async ({ data }: any) => data);
});

describe('aiGenerateResult — the image actually reaches the model', () => {
  it('sends the resolved image url alongside the prompt', async () => {
    await aiGenerateResult('r1', 'u1');

    expect(resolveImageUrl).toHaveBeenCalledWith('s3://referrals/r1/opg.png');
    const [, , opts] = simpleChat.mock.calls[0];
    expect(opts.imageUrl).toBe('https://cdn.test/opg.png?sig=x');
    expect(opts.jsonSchema?.name).toBe('diagnostic_report');
  });

  it('records that the analysis saw the study, and stores the conclusion', async () => {
    await aiGenerateResult('r1', 'u1');

    const { data } = resultCreate.mock.calls[0][0];
    expect(data.aiSawSource).toBe(true);
    expect(data.aiGenerated).toBe(true);
    expect(data.conclusion).toBe('Хронический периодонтит 16');
    expect(data.reportText).toContain('Периапикальное разрежение у 16');
  });
});

describe('aiGenerateResult — refuses rather than composing findings', () => {
  async function expectRefusal(reason: string) {
    await expect(aiGenerateResult('r1', 'u1')).rejects.toBeInstanceOf(DiagnosticAiUnavailable);
    // The decisive assertion: nothing was written to the medical record.
    expect(resultCreate).not.toHaveBeenCalled();
    expect(resultUpdate).not.toHaveBeenCalled();
    expect(resultUpsert).not.toHaveBeenCalled();
    await expect(aiGenerateResult('r1', 'u1')).rejects.toMatchObject({ reason });
  }

  it('refuses when the clinic has not enabled image analysis', async () => {
    checkImageAnalysisConsent.mockResolvedValue({ allowed: false, reason: 'CLINIC_DISABLED' });
    await expectRefusal('CLINIC_DISABLED');
    expect(simpleChat).not.toHaveBeenCalled();
  });

  it('refuses when a registered patient has not consented', async () => {
    checkImageAnalysisConsent.mockResolvedValue({ allowed: false, reason: 'PATIENT_DECLINED' });
    await expectRefusal('PATIENT_DECLINED');
    expect(simpleChat).not.toHaveBeenCalled();
  });

  it('refuses when the referral has no patient to check consent for', async () => {
    referralFindUnique.mockResolvedValue(referral({ patientId: null }));
    await expectRefusal('NO_PATIENT');
    expect(checkImageAnalysisConsent).not.toHaveBeenCalled();
  });

  it('refuses when nothing is attached', async () => {
    referralFindUnique.mockResolvedValue(referral({ files: [] }));
    await expectRefusal('NO_VIEWABLE_FILE');
  });

  it.each([
    ['a DICOM study', { fileUrl: 's3://r/x.dcm', fileName: 'study.dcm' }],
    ['an STL model', { fileUrl: 's3://r/x.stl', fileName: 'model.stl' }],
    ['a PDF report', { fileUrl: 's3://r/x.pdf', fileName: 'report.pdf' }],
  ])('refuses on %s, which no vision model can read', async (_label, file) => {
    referralFindUnique.mockResolvedValue(referral({ files: [file] }));
    await expectRefusal('NO_VIEWABLE_FILE');
  });

  it('refuses when the model answers in an unexpected shape', async () => {
    simpleChat.mockResolvedValue('не JSON');
    await expectRefusal('UNPARSABLE');
  });
});

describe('aiGenerateResult — a viewable file among unviewable ones', () => {
  it('picks the image and ignores the DICOM next to it', async () => {
    referralFindUnique.mockResolvedValue(
      referral({ files: [{ fileUrl: 's3://r/x.dcm', fileName: 'study.dcm' }, XRAY_FILE] }),
    );

    await aiGenerateResult('r1', 'u1');

    expect(resolveImageUrl).toHaveBeenCalledWith('s3://referrals/r1/opg.png');
  });

  it('accepts a legacy inline data URI, which was never migrated', async () => {
    const dataUri = 'data:image/png;base64,iVBORw0KGgo=';
    referralFindUnique.mockResolvedValue(referral({ files: [{ fileUrl: dataUri, fileName: null }] }));

    await aiGenerateResult('r1', 'u1');

    expect(resolveImageUrl).toHaveBeenCalledWith(dataUri);
  });
});
