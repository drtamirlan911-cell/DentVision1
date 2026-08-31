import { Agent } from '../core/agent.router.js';
import { AIContext, AIResponse } from '../types/ai.types.js';
import { prisma } from '../../../lib/prisma.js';
import { uid } from '../../../lib/helpers.js';
import { publish } from '../../../lib/events.js';
import { hmacIin } from '../../../lib/phi.js';
import {
  assertValidIinFormat,
  assertUniquePatientIin,
  buildPatientIinFields,
  IinValidationError,
  type PatientIinFields,
} from '../../../lib/patientIin.js';

const PAIN_LOCATIONS = ['Верхняя челюсть', 'Нижняя челюсть', 'Слева', 'Справа', 'Передние зубы', 'Жевательные', 'Не знает'];
const PAIN_DURATIONS = ['Сегодня', 'Несколько дней', 'Неделю', 'Месяц', 'Больше месяца'];
const PAIN_TYPES = ['Ноющая', 'Острая', 'Пульсирующая', 'При накусывании', 'От холодного', 'От горячего', 'Самопроизвольная', 'Ночная'];
const SOURCES = ['Instagram', 'Google', '2GIS', 'Сайт', 'Рекомендация', 'Повторный пациент', 'Другое'];
const SPECIALTIES = ['Терапевт', 'Ортопед', 'Хирург', 'Ортодонт', 'Пародонтолог', 'Имплантолог', 'Эндодонтист', 'Детский стоматолог', 'Гигиенист'];

interface IntakeSession {
  step: string;
  data: Record<string, any>;
}

const intakeSessions = new Map<string, IntakeSession>();

export class AdminAgent implements Agent {
  name = 'admin';

  canHandle(intent: string): boolean {
    const adminIntents = [
      'NEW_PATIENT',
      'INCOMING_CALL',
      'START_INTAKE',
      'INTAKE_ANSWER',
      'CONFIRM_BOOKING',
      'SEARCH_PATIENT',
      'CREATE_APPOINTMENT',
      'UPDATE_APPOINTMENT',
      'CANCEL_APPOINTMENT',
      'ADMIN_USERS',
      'ADMIN_CLINICS',
      'ADMIN_ROLES',
      'ADMIN_BACKUP',
      'ADMIN_AUDIT',
      'SHOW_SCHEDULE',
    ];
    return adminIntents.includes(intent);
  }

  async handle(context: AIContext, intent: string, params: Record<string, unknown>): Promise<AIResponse> {
    switch (intent) {
      case 'NEW_PATIENT':
      case 'INCOMING_CALL':
      case 'START_INTAKE':
        return this.startIntake(context);
      case 'INTAKE_ANSWER':
        return this.processIntakeAnswer(context, params);
      case 'CONFIRM_BOOKING':
        return this.confirmBooking(context, params);
      case 'SEARCH_PATIENT':
      case 'CREATE_APPOINTMENT':
      case 'UPDATE_APPOINTMENT':
      case 'CANCEL_APPOINTMENT':
        return { message: `Админ: ${intent} выполнен`, intent, suggestions: [] };
      case 'SHOW_SCHEDULE':
        return this.showSchedule(context, params);
      case 'ADMIN_USERS':
        return this.manageUsers(context);
      case 'ADMIN_CLINICS':
        return this.manageClinics(context);
      case 'ADMIN_ROLES':
        return this.manageRoles(context);
      case 'ADMIN_BACKUP':
        return this.backup(context);
      case 'ADMIN_AUDIT':
        return this.audit(context);
      default:
        return { message: `Неподдерживаемое действие: ${intent}`, intent, suggestions: [] };
    }
  }

  // ─── Intake Wizard ───

  private getDefaultSession(): IntakeSession {
    return {
      step: 'name',
      data: {
        complaints: [],
        painDetails: {},
        source: '',
        allergies: null,
        medications: null,
        chronicDiseases: null,
        pregnancy: null,
        trauma: null,
      },
    };
  }

  private startIntake(context: AIContext): AIResponse {
    intakeSessions.set(context.sessionId, this.getDefaultSession());
    return {
      message: 'Открываю форму записи нового пациента...',
      intent: 'START_INTAKE',
      action: { type: 'OPEN_INTAKE_WIZARD', payload: { step: 'patient_info' } },
      suggestions: [],
    };
  }

  private async processIntakeAnswer(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    const session = intakeSessions.get(context.sessionId) || this.getDefaultSession();
    const { answer, field } = params;

    if (field) session.data[field as string] = answer;
    if (params.complaint) session.data.complaints.push(params.complaint);
    if (params.painDetail) Object.assign(session.data.painDetails, params.painDetail);

    // Checked the moment it is given, not at confirmBooking — a caller who
    // mistypes an IIN should be asked again immediately, not after also
    // picking a doctor, date and time.
    if (field === 'iin' && session.data.iin) {
      try {
        const normalized = assertValidIinFormat(session.data.iin);
        await assertUniquePatientIin(context.clinicId, hmacIin(normalized));
        session.data.iin = normalized;
      } catch (error) {
        session.data.iin = undefined;
        const detail = error instanceof IinValidationError ? error.message : 'Не удалось проверить ИИН';
        return {
          message: `${detail}. Введите ИИН ещё раз.`,
          intent: 'INTAKE_IIN',
          suggestions: [],
          action: { type: 'INTAKE_STEP', payload: { step: 'iin', prompt: 'ИИН?' } },
        };
      }
    }

    // Step progression
    if (!session.data.name) {
      return { message: 'Имя пациента?', intent: 'INTAKE_NAME', suggestions: [], action: { type: 'INTAKE_STEP', payload: { step: 'name', prompt: 'Имя пациента?' } } };
    }
    if (!session.data.phone) {
      return { message: 'Телефон?', intent: 'INTAKE_PHONE', suggestions: [], action: { type: 'INTAKE_STEP', payload: { step: 'phone', prompt: 'Телефон?' } } };
    }
    if (!session.data.iin) {
      return { message: 'ИИН?', intent: 'INTAKE_IIN', suggestions: [], action: { type: 'INTAKE_STEP', payload: { step: 'iin', prompt: 'ИИН?' } } };
    }
    if (!session.data.source) {
      return {
        message: 'Откуда пациент узнал о нас?',
        intent: 'INTAKE_SOURCE',
        suggestions: SOURCES,
        action: { type: 'INTAKE_STEP', payload: { step: 'source', prompt: 'Откуда пациент?', options: SOURCES } },
      };
    }
    if (!session.data.complaints.length) {
      return {
        message: 'Что беспокоит пациента?',
        intent: 'INTAKE_COMPLAINT',
        suggestions: ['Боль', 'Отек', 'Разрушение зуба', 'Кровоточивость', 'Подвижность', 'Имплантация', 'Протезирование', 'Эстетика', 'Брекеты', 'Профосмотр', 'Другое'],
        action: { type: 'INTAKE_STEP', payload: { step: 'complaint', prompt: 'Что беспокоит?', options: ['Боль', 'Отек', 'Разрушение зуба', 'Кровоточивость', 'Подвижность', 'Имплантация', 'Протезирование', 'Эстетика', 'Брекеты', 'Профосмотр', 'Другое'] } },
      };
    }

    // If pain was reported, ask pain details
    if (session.data.complaints.includes('Боль') && !session.data.painDetails.location) {
      return {
        message: 'Где болит?',
        intent: 'INTAKE_PAIN_LOCATION',
        suggestions: PAIN_LOCATIONS,
        action: { type: 'INTAKE_STEP', payload: { step: 'pain_location', prompt: 'Где болит?', options: PAIN_LOCATIONS } },
      };
    }
    if (session.data.complaints.includes('Боль') && session.data.painDetails.location && !session.data.painDetails.duration) {
      return {
        message: 'Как давно болит?',
        intent: 'INTAKE_PAIN_DURATION',
        suggestions: PAIN_DURATIONS,
        action: { type: 'INTAKE_STEP', payload: { step: 'pain_duration', prompt: 'Как давно?', options: PAIN_DURATIONS } },
      };
    }
    if (session.data.complaints.includes('Боль') && session.data.painDetails.duration && !session.data.painDetails.type) {
      return {
        message: 'Какая боль?',
        intent: 'INTAKE_PAIN_TYPE',
        suggestions: PAIN_TYPES,
        action: { type: 'INTAKE_STEP', payload: { step: 'pain_type', prompt: 'Какая боль?', options: PAIN_TYPES } },
      };
    }
    if (session.data.complaints.includes('Боль') && session.data.painDetails.type && session.data.painIntensity === undefined) {
      return {
        message: 'Интенсивность боли от 0 до 10?',
        intent: 'INTAKE_PAIN_INTENSITY',
        suggestions: [],
        action: { type: 'INTAKE_STEP', payload: { step: 'pain_intensity', prompt: 'Интенсивность 0-10?', range: [0, 10] } },
      };
    }

    // Additional screenings
    if (session.data.additionalScreenings === undefined) {
      session.data.additionalScreenings = {};
    }
    const scr = session.data.additionalScreenings;
    if (scr.swelling === undefined) {
      return {
        message: 'Есть ли отёк, температура, свищ, неприятный запах, кровотечение?',
        intent: 'INTAKE_EXTRA',
        suggestions: ['Отек', 'Температура', 'Свищ', 'Неприятный запах', 'Кровотечение', 'Нет'],
        action: { type: 'INTAKE_STEP', payload: { step: 'extra_symptoms', prompt: 'Дополнительные симптомы?', options: ['Отек', 'Температура', 'Свищ', 'Неприятный запах', 'Кровотечение', 'Нет'] } },
      };
    }
    if (scr.toothDestruction === undefined) {
      return {
        message: 'Разрушение зуба?',
        intent: 'INTAKE_TOOTH',
        suggestions: ['Нет', 'Скол', 'Большая кариозная полость', 'Почти полностью разрушен', 'Остался только корень'],
        action: { type: 'INTAKE_STEP', payload: { step: 'tooth_destruction', prompt: 'Разрушение зуба?', options: ['Нет', 'Скол', 'Большая кариозная полость', 'Почти полностью разрушен', 'Остался только корень'] } },
      };
    }
    if (scr.trauma === undefined) {
      return {
        message: 'Была ли травма?',
        intent: 'INTAKE_TRAUMA',
        suggestions: ['Да', 'Нет'],
        action: { type: 'INTAKE_STEP', payload: { step: 'trauma', prompt: 'Травма?', options: ['Да', 'Нет'] } },
      };
    }
    if (scr.pregnancy === undefined) {
      return {
        message: 'Беременность?',
        intent: 'INTAKE_PREGNANCY',
        suggestions: ['Да', 'Нет', 'Не относится'],
        action: { type: 'INTAKE_STEP', payload: { step: 'pregnancy', prompt: 'Беременность?', options: ['Да', 'Нет', 'Не относится'] } },
      };
    }
    if (scr.allergies === undefined) {
      return {
        message: 'Есть аллергия?',
        intent: 'INTAKE_ALLERGY',
        suggestions: ['Да', 'Нет', 'Не знает'],
        action: { type: 'INTAKE_STEP', payload: { step: 'allergies', prompt: 'Аллергия?', options: ['Да', 'Нет', 'Не знает'] } },
      };
    }
    if (scr.antibiotics === undefined) {
      return {
        message: 'Принимает антибиотики?',
        intent: 'INTAKE_MEDICATIONS',
        suggestions: ['Да', 'Нет'],
        action: { type: 'INTAKE_STEP', payload: { step: 'medications', prompt: 'Антибиотики?', options: ['Да', 'Нет'] } },
      };
    }
    if (scr.anticoagulants === undefined) {
      return {
        message: 'Принимает антикоагулянты (кроверазжижающие)?',
        intent: 'INTAKE_ANTICOAG',
        suggestions: ['Да', 'Нет'],
        action: { type: 'INTAKE_STEP', payload: { step: 'anticoagulants', prompt: 'Антикоагулянты?', options: ['Да', 'Нет'] } },
      };
    }
    if (scr.chronic === undefined) {
      return {
        message: 'Есть хронические заболевания?',
        intent: 'INTAKE_CHRONIC',
        suggestions: ['Да', 'Нет'],
        action: { type: 'INTAKE_STEP', payload: { step: 'chronic', prompt: 'Хронические заболевания?', options: ['Да', 'Нет'] } },
      };
    }

    // All questions done → triage
    return this.triageAndRecommend(context, session);
  }

  private async triageAndRecommend(context: AIContext, session: IntakeSession): Promise<AIResponse> {
    const { data } = session;
    const complaints = data.complaints;
    const pd = data.painDetails;
    const scr = data.additionalScreenings || {};

    // Simple rule-based triage
    let specialty = 'Терапевт';
    let reason = 'Общий осмотр и диагностика';
    let urgency: 'Обычная' | 'Сегодня' | 'Срочно' | 'Экстренно' = 'Обычная';
    let likelyDiagnosis = 'Осмотр';

    if (complaints.includes('Боль')) {
      if (pd.type?.includes('Острая') || pd.type?.includes('Пульсирующая') || pd.type?.includes('Ночная') || pd.type?.includes('Самопроизвольная')) {
        specialty = 'Эндодонтист';
        reason = 'Острая боль — вероятный пульпит или периодонтит';
        urgency = 'Срочно';
        likelyDiagnosis = 'Острый пульпит / периодонтит';
      } else if (pd.type?.includes('При накусывании')) {
        specialty = 'Эндодонтист';
        reason = 'Боль при накусывании — возможен периодонтит';
        urgency = 'Сегодня';
        likelyDiagnosis = 'Хронический периодонтит (обострение)';
      } else if (pd.type?.includes('От холодного') || pd.type?.includes('От горячего')) {
        specialty = 'Терапевт';
        reason = 'Реакция на температурные раздражители — возможен кариес или пульпит';
        urgency = 'Обычная';
        likelyDiagnosis = 'Глубокий кариес / начальный пульпит';
      }
    }

    if (complaints.includes('Разрушение зуба') || scr.toothDestruction?.includes('разрушен') || scr.toothDestruction?.includes('корень')) {
      if (specialty === 'Терапевт' && (scr.toothDestruction?.includes('Полностью') || scr.toothDestruction?.includes('корень'))) {
        specialty = 'Хирург';
        reason = 'Значительное разрушение — требуется удаление';
        likelyDiagnosis = 'Разрушение коронковой части зуба';
      } else if (specialty === 'Терапевт') {
        specialty = 'Терапевт';
        reason = 'Кариозное поражение — требуется лечение';
        likelyDiagnosis = 'Кариес дентина';
      }
    }

    if (complaints.includes('Отек') || scr.swelling?.includes('Отек')) {
      urgency = urgency === 'Обычная' ? 'Сегодня' : 'Экстренно';
      if (specialty === 'Терапевт' || specialty === 'Эндодонтист') {
        specialty = 'Хирург';
        reason = 'Отёк — возможен абсцесс или флегмона';
        likelyDiagnosis = 'Одонтогенный абсцесс';
      }
    }

    if (complaints.includes('Имплантация')) {
      specialty = 'Имплантолог';
      reason = 'План имплантации';
      likelyDiagnosis = 'Адентия частичная';
    }

    if (complaints.includes('Протезирование')) {
      specialty = 'Ортопед';
      reason = 'Протезирование зубов';
      likelyDiagnosis = 'Адентия частичная / полная';
    }

    if (complaints.includes('Брекеты')) {
      specialty = 'Ортодонт';
      reason = 'Ортодонтическое лечение';
      likelyDiagnosis = 'Аномалия прикуса';
    }

    if (complaints.includes('Кровоточивость') || complaints.includes('Подвижность')) {
      specialty = 'Пародонтолог';
      reason = 'Кровоточивость и/или подвижность зубов';
      likelyDiagnosis = 'Пародонтит / гингивит';
    }

    if (complaints.includes('Эстетика')) {
      specialty = 'Терапевт';
      reason = 'Эстетическая реставрация';
      likelyDiagnosis = 'Эстетический дефект';
    }

    if (complaints.includes('Профосмотр')) {
      specialty = 'Гигиенист';
      reason = 'Профилактический осмотр и гигиена';
      urgency = 'Обычная';
      likelyDiagnosis = 'Профосмотр';
    }

    // Store triage result in session
    session.data.triage = { specialty, reason, urgency, likelyDiagnosis };

    // Find available doctors
    const doctors = await prisma.clinicMember.findMany({
      where: {
        clinicId: context.clinicId,
        role: 'DOCTOR',
        user: { spec: { contains: specialty, mode: 'insensitive' } },
      },
      include: { user: { select: { id: true, firstName: true, lastName: true, spec: true } } },
      take: 5,
    });

    const suggestions = doctors.length
      ? doctors.map(d => `${d.user.firstName} ${d.user.lastName}`)
      : ['Записать к любому врачу'];

    return {
      message: `Вероятная причина: **${likelyDiagnosis}**\n\nРекомендуемый специалист: **${specialty}**\n\nСрочность: **${urgency}**`,
      intent: 'TRIAGE_RESULT',
      action: {
        type: 'SHOW_TRIAGE',
        payload: {
          diagnosis: likelyDiagnosis,
          specialty,
          reason,
          urgency,
          doctors: doctors.map(d => ({
            id: d.user.id,
            name: `${d.user.firstName} ${d.user.lastName}`,
            spec: d.user.spec,
          })),
        },
      },
      suggestions,
    };
  }

  private async confirmBooking(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    const session = intakeSessions.get(context.sessionId);
    if (!session) return { message: 'Сессия не найдена, начните заново', intent: 'ERROR', suggestions: ['Записать пациента'] };

    const { doctorId, date, time } = params;

    // Routed through the shared builder like every other patient write site:
    // it validates, hashes and encrypts in one place. Before this, the agent
    // wrote the IIN in plaintext with a hash computed inline — the same column
    // held ciphertext from the CRM and plaintext from here.
    let iinFields: PatientIinFields;
    try {
      iinFields = await buildPatientIinFields({
        iin: session.data.iin,
        // No IIN in the intake session means the caller never gave one; the
        // waiver is explicit so the record is flagged rather than silently blank.
        noIinReason: session.data.iin ? undefined : 'created_without_iin',
        clinicId: context.clinicId,
        birthDate: session.data.birthDate ?? null,
        gender: session.data.gender ?? null,
      });
    } catch (error) {
      if (error instanceof IinValidationError) {
        // A data problem, not a crash: say what is wrong so the operator can fix it.
        return {
          message: error.message,
          intent: 'ERROR',
          suggestions: ['Проверить ИИН', 'Найти пациента'],
        };
      }
      throw error;
    }

    // Create patient
    const patient = await prisma.patient.create({
      data: {
        id: uid(),
        clinicId: context.clinicId,
        firstName: session.data.name?.split(' ')[0] || '',
        lastName: session.data.name?.split(' ').slice(1).join(' ') || '',
        phone: session.data.phone,
        iin: iinFields.iin,
        iinHash: iinFields.iinHash,
        noIinReason: iinFields.noIinReason,
        // No dedicated column for referral source — folded into notes, same
        // as everywhere else free-text intake context is kept on Patient.
        notes: session.data.source ? `Источник: ${session.data.source}` : undefined,
      },
    });

    // Create appointment
    const appointmentDate = new Date(`${date as string}T${time as string}`);
    const appointment = await prisma.appointment.create({
      data: {
        id: uid(),
        clinicId: context.clinicId,
        patientId: patient.id,
        doctorId: doctorId as string,
        date: appointmentDate,
        duration: 30,
        status: 'confirmed',
        type: 'consultation',
        notes: `Жалобы: ${session.data.complaints.join(', ')}. ${session.data.painDetails?.type ? `Боль: ${session.data.painDetails.type}. ` : ''}Рекомендация AI: ${session.data.triage?.specialty} — ${session.data.triage?.likelyDiagnosis}`,
      },
    });

    publish('appointment.created', {
      clinicId: context.clinicId,
      appointmentId: appointment.id,
      patientId: patient.id,
      doctorId: doctorId as string,
    });

    // Create notification for doctor
    try {
      await prisma.notification.create({
        data: {
          id: uid(),
          userId: doctorId as string,
          type: 'appointment',
          title: 'Новый пациент записан',
          message: `Пациент ${patient.firstName} ${patient.lastName} записан на ${new Date(appointmentDate).toLocaleString('ru-RU')}.\nЖалобы: ${session.data.complaints.join(', ')}\n${session.data.triage?.likelyDiagnosis ? `Предварительный диагноз: ${session.data.triage.likelyDiagnosis}` : ''}`,
          link: '/crm/schedule',
        },
      });
    } catch { /* non-critical */ }

    intakeSessions.delete(context.sessionId);

    return {
      message: `✅ Пациент **${patient.firstName} ${patient.lastName}** записан к **${(params.doctorName as string) || 'врачу'}** на **${new Date(appointmentDate).toLocaleString('ru-RU')}**`,
      intent: 'BOOKING_CONFIRMED',
      action: {
        type: 'BOOKING_CONFIRMED',
        payload: { appointmentId: appointment.id, patientId: patient.id },
      },
      suggestions: ['Открыть расписание', 'Открыть карту пациента', 'Записать ещё'],
    };
  }

  private async showSchedule(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    const date = (params.date as string) || new Date().toISOString().split('T')[0];
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const appointments = await prisma.appointment.findMany({
      where: { clinicId: context.clinicId, date: { gte: start, lte: end } },
      include: { patient: { select: { firstName: true, lastName: true } } },
      orderBy: { date: 'asc' },
    });

    return {
      message: `Расписание на ${new Date(date).toLocaleDateString('ru-RU')}: ${appointments.length} записей`,
      intent: 'SHOW_SCHEDULE',
      action: { type: 'OPEN_SCHEDULE', payload: { appointments, date } },
      suggestions: [],
    };
  }

  private async manageUsers(context: AIContext) {
    const users = await prisma.user.findMany({
      include: { memberships: { include: { clinic: true } } },
      take: 20,
    });
    return {
      message: `Пользователей: ${users.length}`,
      intent: 'ADMIN_USERS',
      action: { type: 'SHOW_USERS', payload: users.map(u => ({ id: u.id, email: u.email, name: `${u.firstName} ${u.lastName}`, role: u.role, clinics: u.memberships.map(m => m.clinic.name) })) },
      suggestions: ['Добавить пользователя', 'Изменить роль', 'Деактивировать'],
    };
  }

  private async manageClinics(context: AIContext) {
    const clinics = await prisma.clinic.findMany();
    const counts = await Promise.all(clinics.map(async (c) => {
      const [patients, users] = await Promise.all([
        prisma.patient.count({ where: { clinicId: c.id } }),
        prisma.clinicMember.count({ where: { clinicId: c.id } }),
      ]);
      return { id: c.id, patients, users };
    }));
    const countMap = Object.fromEntries(counts.map(c => [c.id, { patients: c.patients, users: c.users }]));
    return {
      message: `Клиник: ${clinics.length}`,
      intent: 'ADMIN_CLINICS',
      action: { type: 'SHOW_CLINICS', payload: clinics.map(c => ({ id: c.id, name: c.name, plan: c.plan, patients: countMap[c.id].patients, users: countMap[c.id].users })) },
      suggestions: ['Создать клинику', 'Изменить план', 'Удалить'],
    };
  }

  private async manageRoles(context: AIContext) {
    return { message: 'Управление ролями в разработке', intent: 'ADMIN_ROLES', suggestions: ['Назначить роль', 'Создать роль'] };
  }

  private async backup(context: AIContext) {
    return { message: 'Бэкап запущен', intent: 'ADMIN_BACKUP', action: { type: 'TRIGGER_BACKUP', payload: {} }, suggestions: [] };
  }

  private async audit(context: AIContext) {
    const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
    return { message: 'Аудит загружен', intent: 'ADMIN_AUDIT', action: { type: 'SHOW_AUDIT', payload: logs }, suggestions: [] };
  }
}
