/**
 * The tools the patient-facing assistant may call — a registry of its own,
 * deliberately not an extension of `os/registry.ts`.
 *
 * The staff registry hands tools out by role, and a portal account carries the
 * `STUDENT` role, which the clinic-side matrix grants `patients.read` and
 * `medical.read`. Adding a patient persona there would put `searchPatients`
 * one inference away from someone who should only ever see their own card.
 * A separate registry means a staff tool cannot reach this surface by
 * accident, however the role matrix changes later.
 *
 * The invariant this file exists to hold:
 *
 *   **No tool takes a patient id.** Identity is resolved from the session by
 *   the caller and arrives in `ctx.patientId`. Nothing the model emits is ever
 *   used to choose *whose* record is read — the model can only choose *what*
 *   is read about the patient already established. `patientTools.test.ts`
 *   enforces this against the declared parameter schemas.
 */

import * as portalSvc from '../patient-portal/patientPortal.service.js';
import { logAIAction } from '../compliance/compliance.service.js';
import { assessTriage, nextTriageQuestion, type TriageAnswers } from '../../lib/triage.js';
import * as crossClinicSvc from '../cross-clinic/cross-clinic.service.js';

export interface PatientToolContext {
  /** The authenticated portal user. */
  userId: string;
  /** Resolved server-side via `resolvePatientForUser`, never from the model. */
  patientId: string;
  /** The clinic holding the active card, when there is one. */
  clinicId: string | null;
}

export interface PatientTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute(args: Record<string, unknown>, ctx: PatientToolContext): Promise<unknown>;
}

/**
 * Parameter names that would let the model point a tool at someone else.
 * Rejected by test rather than by convention, because the cost of one slipping
 * in is another patient's medical record.
 */
export const FORBIDDEN_PARAM_NAMES = [
  'patientid',
  'patient_id',
  'patient',
  'userid',
  'user_id',
  'clinicid',
  'clinic_id',
  'iin',
  'phone',
  'email',
];

const NO_ARGS = { type: 'object' as const, properties: {} };

export const PATIENT_TOOLS: Record<string, PatientTool> = {
  getMyAppointments: {
    name: 'getMyAppointments',
    description:
      'Приёмы пациента: прошедшие и предстоящие, с датой, временем, врачом, клиникой и статусом. ' +
      'Используй, когда спрашивают «когда я записан», «когда мой приём», «к кому я иду».',
    parameters: NO_ARGS,
    execute: (_args, ctx) => portalSvc.getAppointments(ctx.patientId),
  },

  getMyTreatments: {
    name: 'getMyTreatments',
    description:
      'Выполненные и запланированные процедуры по зубам, со стоимостью. ' +
      'Используй для вопросов «что мне делали», «сколько стоило лечение», «какой зуб лечили».',
    parameters: NO_ARGS,
    execute: (_args, ctx) => portalSvc.getTreatments(ctx.patientId),
  },

  getMyTreatmentPlans: {
    name: 'getMyTreatmentPlans',
    description:
      'Планы лечения: этапы, зубы, диагноз и ориентир бюджета. ' +
      'Используй для «что мне предстоит», «какой план лечения», «сколько это будет стоить».',
    parameters: NO_ARGS,
    execute: (_args, ctx) => portalSvc.getTreatmentPlans(ctx.patientId),
  },

  getMyVisits: {
    name: 'getMyVisits',
    description:
      'История визитов: дата, диагноз, жалобы, анамнез, врач. ' +
      'Используй для «что было на приёме», «какой у меня диагноз», «когда я был последний раз».',
    parameters: NO_ARGS,
    execute: (_args, ctx) => portalSvc.getVisits(ctx.patientId),
  },

  getMyInvoices: {
    name: 'getMyInvoices',
    description:
      'Счета пациента и сводка: всего, оплачено, к оплате. ' +
      'Используй для «сколько я должен», «есть ли задолженность», «за что счёт».',
    parameters: NO_ARGS,
    execute: (_args, ctx) => portalSvc.getInvoices(ctx.patientId),
  },

  getMyDocuments: {
    name: 'getMyDocuments',
    description:
      'Документы пациента и их статус подписи. ' +
      'Используй для «что мне подписать», «есть ли неподписанные документы», «где моё согласие». ' +
      'Подписать документ ты не можешь — подпись ставит только сам пациент.',
    parameters: NO_ARGS,
    execute: (_args, ctx) => portalSvc.getDocuments(ctx.patientId),
  },

  getMyDiagnostics: {
    name: 'getMyDiagnostics',
    description:
      'Направления на диагностику и результаты исследований (снимки, заключения). ' +
      'Используй для «готов ли снимок», «что показало исследование», «какое заключение».',
    parameters: NO_ARGS,
    execute: (_args, ctx) => portalSvc.getDiagnostics(ctx.patientId),
  },

  getMyClinicAccess: {
    name: 'getMyClinicAccess',
    description:
      'Кто из клиник запросил доступ к медкарте пациента, у кого доступ сейчас есть и кто её смотрел. ' +
      'Используй для «кто видит мою карту», «какая клиника запрашивала доступ», «кто смотрел мои данные». ' +
      'Только чтение: разрешение и отзыв доступа пациент делает сам.',
    parameters: NO_ARGS,
    execute: async (_args, ctx) => {
      const [requests, grants, log] = await Promise.all([
        crossClinicSvc.listAccessRequests(ctx.userId),
        crossClinicSvc.listAccessGrants(ctx.userId),
        crossClinicSvc.getAccessLog(ctx.userId),
      ]);
      return { requests, grants, log };
    },
  },
};

/**
 * Cancelling is the one action the assistant performs on its own.
 *
 * It qualifies as routine because it is reversible in the only way that
 * matters — the patient can book again — and because the alternative is worse:
 * a patient who cannot make it and cannot reach anyone simply does not show
 * up, which costs the clinic the slot anyway and costs the patient a mark on
 * their record. Booking and rescheduling are *not* here: those place a
 * commitment on a specific doctor at a specific hour, and doing that from an
 * inference needs the clinic's real availability, which is the next step.
 *
 * The safety here is not a confirmation prompt, it is the query shape: the
 * service filters by `patientId` as well as appointment id, so an id belonging
 * to somebody else matches nothing. Every call is written to `AIActionLog`
 * whether or not it succeeds, so a cancellation the patient disputes has a
 * record naming the assistant as the actor.
 */
PATIENT_TOOLS.cancelMyAppointment = {
  name: 'cancelMyAppointment',
  description:
    'Отменить приём пациента по его id (id берётся из getMyAppointments — сначала вызови её). ' +
    'Отменяй только когда пациент прямо об этом попросил. Уже прошедший, завершённый или ранее отменённый приём отменить нельзя. ' +
    'После отмены скажи пациенту, какой именно приём отменён — дату и время.',
  parameters: {
    type: 'object',
    properties: {
      appointmentId: { type: 'string', description: 'id приёма из getMyAppointments' },
    },
    required: ['appointmentId'],
  },
  async execute(args, ctx) {
    const appointmentId = String(args.appointmentId || '').trim();
    if (!appointmentId) throw new Error('APPOINTMENT_ID_REQUIRED');

    // Audited before the attempt, so a failed or disputed cancellation still
    // leaves a trace of what was asked for.
    await logAIAction(
      ctx.userId,
      'ai-patient.cancelMyAppointment',
      { appointmentId },
      undefined,
      ctx.patientId,
    ).catch(() => undefined);

    return portalSvc.cancelAppointment(ctx.patientId, appointmentId);
  },
};

/**
 * Urgency, decided by `lib/triage.ts` rather than by the model.
 *
 * The model's job is to turn what the patient said into slots; the level comes
 * back from a rule table. That split is the point: a verdict a clinician can
 * review as a list of rules, that returns the same answer to the same answers,
 * and that has a test for every red flag. A model asked to judge urgency
 * directly gives none of those three.
 *
 * Every verdict is written to `AIActionLog`. If a patient is ever told to wait
 * and should not have been, the answers and the rule that fired are on record.
 */
PATIENT_TOOLS.assessUrgency = {
  name: 'assessUrgency',
  description:
    'Оценить срочность по симптомам пациента. Передавай только то, что пациент действительно сказал — не додумывай. ' +
    'Вернёт уровень срочности, готовый текст для пациента и следующий вопрос, если чего-то не хватает. ' +
    'Уровень срочности определяешь НЕ ты: бери его из ответа инструмента и передай пациенту как есть. ' +
    'Диагноз не ставь ни при каких ответах.',
  parameters: {
    type: 'object',
    properties: {
      painLevel: { type: 'number', description: 'Боль по шкале 0-10, как её оценил пациент' },
      swelling: { type: 'string', enum: ['none', 'local', 'spreading'], description: 'Отёк: нет / только у зуба / расходится по лицу или шее' },
      breathingOrSwallowing: { type: 'boolean', description: 'Трудно дышать или глотать' },
      fever: { type: 'boolean', description: 'Есть температура' },
      uncontrolledBleeding: { type: 'boolean', description: 'Кровотечение не останавливается' },
      trauma: { type: 'boolean', description: 'Был удар по лицу или зубам' },
      toothKnockedOut: { type: 'boolean', description: 'Постоянный зуб выбит полностью' },
      wakesAtNight: { type: 'boolean', description: 'Боль будит ночью' },
      durationDays: { type: 'number', description: 'Сколько дней продолжается' },
    },
  },
  async execute(args, ctx) {
    const answers = args as TriageAnswers;
    const verdict = assessTriage(answers);

    await logAIAction(
      ctx.userId,
      'ai-patient.assessUrgency',
      { answers, verdict },
      undefined,
      ctx.patientId,
    ).catch(() => undefined);

    return { ...verdict, nextQuestion: nextTriageQuestion(answers) };
  },
};

export function listPatientToolNames(): string[] {
  return Object.keys(PATIENT_TOOLS);
}

/**
 * Run a tool by name. Unknown names throw rather than no-op: a model asking
 * for a tool that does not exist is a bug worth surfacing, not something to
 * paper over with an empty result the model will then narrate as fact.
 */
export async function executePatientTool(
  name: string,
  args: Record<string, unknown>,
  ctx: PatientToolContext,
): Promise<unknown> {
  const tool = PATIENT_TOOLS[name];
  if (!tool) throw new Error(`UNKNOWN_PATIENT_TOOL:${name}`);
  return tool.execute(args || {}, ctx);
}
