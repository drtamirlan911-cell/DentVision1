// @ts-nocheck
import { Agent } from '../core/agent.router.js';
import { AIContext, AIResponse } from '../types/ai.types.js';
import { prisma } from '../../../lib/prisma.js';
import { uid } from '../../../lib/helpers.js';

const SPECIALTY_INSTRUMENTS: Record<string, string[]> = {
  'Терапевт': ['Стоматологическая установка', 'Набор кариес-маркеров', 'Бормашина', 'Эндодонтический мотор', 'Апекс-локатор', 'Рентген-визиограф'],
  'Эндодонтист': ['Эндодонтический мотор', 'Апекс-локатор', 'К-файлы', 'Рут-каналы', 'Ультразвуковой скейлер', 'Операционный микроскоп', 'Стоматологическая установка'],
  'Хирург': ['Скальпель', 'Распатор', 'Кюретажная ложка', 'Хирургический мотор', 'Пьезотом', 'Шовный материал', 'Лупа/микроскоп'],
  'Ортопед': ['Стоматологическая установка', 'Слепочные ложки', 'Окклюзионная бумага', 'Артикулятор', 'Лицевая дуга', 'Набор для временных коронок'],
  'Имплантолог': ['Хирургический мотор', 'Набор имплантов', 'Пьезотом', 'Костный материал', 'Направитель', 'Хирургический шаблон', 'Шовный материал'],
  'Ортодонт': ['Брекет-система', 'Элайнеры', 'Лигатуры', 'Эластики', 'Щипцы для брекетов', 'Стоматологическая установка'],
  'Пародонтолог': ['Пародонтальный зонд', 'Кюреты Грейси', 'Ультразвуковой скейлер', 'Air Flow', 'Лазер диодный', 'Шина'],
  'Детский стоматолог': ['Стоматологическая установка', 'Бормашина', 'Пломбировочный материал', 'Герметик', 'Фтор-лак', 'Цветные пломбы'],
  'Гигиенист': ['Air Flow', 'Ультразвуковой скейлер', 'Кюреты', 'Полировочные щётки', 'Фтор-гель', 'Индикатор налёта'],
};

const DIAGNOSIS_RECOMMENDATIONS: Record<string, { exams: string[], treatment: string[], estimate: string }> = {
  'Острый пульпит': {
    exams: ['Прицельный рентген', 'Электроодонтодиагностика (ЭОД)', 'Холодовая проба'],
    treatment: ['Эндодонтическое лечение', 'Временная пломба', 'Рекомендация коронки'],
    estimate: 'Эндодонтическое лечение + реставрация',
  },
  'Хронический периодонтит': {
    exams: ['Панорамный снимок (ОПТГ)', 'Рентгенография', 'КТ по необходимости'],
    treatment: ['Перелечивание каналов', 'Медикаментозная обработка', 'Наблюдение'],
    estimate: 'Эндодонтическое лечение',
  },
  'Кариес дентина': {
    exams: ['Осмотр', 'Зондирование', 'Рентген-диагностика'],
    treatment: ['Препарирование кариозной полости', 'Пломбирование светоотверждаемым материалом'],
    estimate: 'Лечение кариеса + реставрация',
  },
  'Пародонтит': {
    exams: ['Пародонтальное зондирование', 'Прицельный рентген', 'Микробиологический анализ'],
    treatment: ['Профессиональная гигиена', 'Кюретаж пародонтальных карманов', 'Лазерная терапия', 'Шинирование'],
    estimate: 'Пародонтологическое лечение (курс)',
  },
  'Абсцесс': {
    exams: ['КТ челюсти', 'Прицельный рентген', 'Анализ крови'],
    treatment: ['Вскрытие абсцесса', 'Дренирование', 'Антибактериальная терапия', 'Наблюдение'],
    estimate: 'Хирургическое вмешательство',
  },
};

export class DoctorAgent implements Agent {
  name = 'doctor';

  canHandle(intent: string): boolean {
    const doctorIntents = [
      'SEARCH_PATIENT',
      'CREATE_APPOINTMENT',
      'UPDATE_APPOINTMENT',
      'CANCEL_APPOINTMENT',
      'OPEN_MEDICAL_CARD',
      'GET_MEDICAL_CARD',
      'CREATE_TREATMENT_PLAN',
      'VIEW_CBCT',
      'SHOW_CBCT',
      'VIEW_SCHEDULE',
      'PATIENT_BRIEFING',
      'AFTER_APPOINTMENT',
      'CREATE_ESTIMATE',
      'REFER_DIAGNOSTICS',
      'SCHEDULE_NEXT_VISIT',
      'SUGGEST_INSTRUMENTS',
    ];
    return doctorIntents.includes(intent);
  }

  async handle(context: AIContext, intent: string, params: Record<string, unknown>): Promise<AIResponse> {
    switch (intent) {
      case 'PATIENT_BRIEFING':
        return this.patientBriefing(context, params);
      case 'AFTER_APPOINTMENT':
        return this.afterAppointment(context, params);
      case 'CREATE_ESTIMATE':
        return this.createEstimate(context, params);
      case 'REFER_DIAGNOSTICS':
        return this.referDiagnostics(context, params);
      case 'SCHEDULE_NEXT_VISIT':
        return this.scheduleNextVisit(context, params);
      case 'SUGGEST_INSTRUMENTS':
        return this.suggestInstruments(context, params);
      case 'SEARCH_PATIENT':
        return this.searchPatient(context, params);
      case 'CREATE_APPOINTMENT':
        return this.createAppointment(context, params);
      case 'OPEN_MEDICAL_CARD':
      case 'GET_MEDICAL_CARD':
        return this.openMedicalCard(context, params);
      case 'CREATE_TREATMENT_PLAN':
        return this.createTreatmentPlan(context, params);
      case 'VIEW_CBCT':
      case 'SHOW_CBCT':
        return this.viewCBCT(context, params);
      case 'VIEW_SCHEDULE':
        return this.viewSchedule(context, params);
      default:
        return { message: `Неподдерживаемое действие: ${intent}`, intent, suggestions: [] };
    }
  }

  private async patientBriefing(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    const appointmentId = params.appointmentId as string;
    const patientId = params.patientId as string;

    let appointment: any = null;
    let patient: any = null;
    let triageData: any = null;
    let diagnosis = '';
    let complaints: string[] = [];

    if (appointmentId) {
      appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          patient: {
            include: {
              images: { orderBy: { createdAt: 'desc' }, take: 5 },
              treatmentPlans: { orderBy: { createdAt: 'desc' }, take: 3 },
              teeth: true,
            },
          },
          doctor: { select: { firstName: true, lastName: true } },
        },
      });
      if (appointment) {
        patient = appointment.patient;
        if (appointment.notes) {
          const notes = appointment.notes;
          const complaintsMatch = notes.match(/Жалобы:\s*(.+?)(?:\.|$)/);
          if (complaintsMatch) complaints = complaintsMatch[1].split(', ').map((s: string) => s.trim());
          const diagnosisMatch = notes.match(/Рекомендация AI:\s*(.+?)(?:\.|$)/);
          if (diagnosisMatch) {
            const aiRec = diagnosisMatch[1];
            const specialtyMatch = aiRec.match(/(.+?)\s*[—–-]\s*(.+)/);
            if (specialtyMatch) {
              triageData = { specialty: specialtyMatch[1].trim(), diagnosis: specialtyMatch[2].trim() };
              diagnosis = specialtyMatch[2].trim();
            } else {
              diagnosis = aiRec;
            }
          }
        }
      }
    }

    if (!patient && patientId) {
      patient = await prisma.patient.findUnique({
        where: { id: patientId },
        include: {
          images: { orderBy: { createdAt: 'desc' }, take: 5 },
          treatmentPlans: { orderBy: { createdAt: 'desc' }, take: 3 },
          teeth: true,
        },
      });
    }

    if (!patient) {
      return { message: 'Пациент не найден', intent: 'PATIENT_BRIEFING', suggestions: ['Поиск пациента', 'Расписание'] };
    }

    const instruments = this.getInstrumentsForDiagnosis(diagnosis, triageData?.specialty);
    const hasCBCT = patient.images?.some((img: any) => img.type === 'CBCT');

    const name = `${patient.firstName} ${patient.lastName}`;
    const message = [
      `**Подготовка к приёму: ${name}**`,
      '',
      appointment ? `⏰ Запись: **${new Date(appointment.date).toLocaleString('ru-RU')}**` : '',
      `📋 Жалобы: **${complaints.length ? complaints.join(', ') : 'Не указаны'}**`,
      triageData ? `🏥 Диагноз AI: **${triageData.diagnosis}** (${triageData.specialty})` : '',
      hasCBCT ? '📸 Есть КТ-снимки' : '',
      patient.treatmentPlans?.length ? `📑 Планов лечения: ${patient.treatmentPlans.length}` : '',
      instruments.length ? `\n**Рекомендуемые инструменты:**\n${instruments.map(i => `• ${i}`).join('\n')}` : '',
    ].filter(Boolean).join('\n');

    return {
      message,
      intent: 'PATIENT_BRIEFING',
      action: {
        type: 'OPEN_DOCTOR_PREP',
        payload: {
          patient: {
            id: patient.id,
            name,
            phone: patient.phone,
            iin: patient.iin,
            birthDate: patient.birthDate,
          },
          appointment: appointment ? {
            id: appointment.id,
            date: appointment.date,
            status: appointment.status,
            doctorName: appointment.doctor ? `${appointment.doctor.firstName} ${appointment.doctor.lastName}` : '',
          } : null,
          complaints,
          triage: triageData,
          diagnosis,
          instruments,
          hasCBCT,
          imagesCount: patient.images?.length || 0,
          treatmentPlansCount: patient.treatmentPlans?.length || 0,
        },
      },
      contextUpdate: { type: 'patient', id: patient.id },
      suggestions: [
        'Начать приём',
        'Показать КТ',
        'План лечения',
        ...(appointment ? ['Завершить приём'] : []),
      ],
    };
  }

  private async afterAppointment(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    const patientId = params.patientId as string;
    const appointmentId = params.appointmentId as string;

    if (!patientId) {
      const appointments = await prisma.appointment.findMany({
        where: { clinicId: context.clinicId, doctorId: context.userId, status: 'confirmed', date: { lte: new Date() } },
        include: { patient: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { date: 'desc' },
        take: 5,
      });

      if (appointments.length === 0) {
        return { message: 'Нет завершённых приёмов для follow-up', intent: 'AFTER_APPOINTMENT', suggestions: ['Расписание', 'Пациенты'] };
      }

      return {
        message: `Выберите пациента для follow-up:\n${appointments.map((a, i) => `${i + 1}. ${a.patient?.firstName} ${a.patient?.lastName}`).join('\n')}`,
        intent: 'AFTER_APPOINTMENT',
        suggestions: appointments.map(a => `${a.patient?.firstName} ${a.patient?.lastName}`),
      };
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!patient) return { message: 'Пациент не найден', intent: 'AFTER_APPOINTMENT', suggestions: [] };

    if (appointmentId) {
      await prisma.appointment.update({
        where: { id: appointmentId },
        data: { status: 'completed' },
      });
    }

    return {
      message: `Приём **${patient.firstName} ${patient.lastName}** завершён.\n\nЧто делаем дальше?`,
      intent: 'AFTER_APPOINTMENT',
      action: {
        type: 'OPEN_FOLLOWUP',
        payload: { patientId: patient.id, patientName: `${patient.firstName} ${patient.lastName}`, appointmentId },
      },
      suggestions: [
        'Создать план лечения',
        'Создать смету',
        'Направить на диагностику',
        'Записать на следующий приём',
        'Ничего, спасибо',
      ],
    };
  }

  private async createEstimate(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    const patientId = params.patientId as string;
    const diagnosis = (params.diagnosis as string) || '';
    if (!patientId) return { message: 'Укажите пациента', intent: 'CREATE_ESTIMATE', suggestions: [] };

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { firstName: true, lastName: true },
    });
    if (!patient) return { message: 'Пациент не найден', intent: 'CREATE_ESTIMATE', suggestions: [] };

    const recommendation = DIAGNOSIS_RECOMMENDATIONS[diagnosis] || {
      exams: ['Осмотр', 'Диагностика'],
      treatment: ['Лечение по результатам диагностики'],
      estimate: 'Диагностика + лечение',
    };

    return {
      message: `**Смета для ${patient.firstName} ${patient.lastName}**\n\n📋 **Диагноз:** ${diagnosis || 'Уточняется'}\n\n🔬 **Обследования:**\n${recommendation.exams.map(e => `• ${e}`).join('\n')}\n\n💊 **Лечение:**\n${recommendation.treatment.map(t => `• ${t}`).join('\n')}\n\n💰 **Ориентир:** ${recommendation.estimate}`,
      intent: 'CREATE_ESTIMATE',
      action: {
        type: 'OPEN_ESTIMATE',
        payload: {
          patientId,
          patientName: `${patient.firstName} ${patient.lastName}`,
          diagnosis,
          exams: recommendation.exams,
          treatment: recommendation.treatment,
          estimateLabel: recommendation.estimate,
        },
      },
      suggestions: ['Сохранить смету', 'Отправить пациенту', 'Создать план лечения'],
    };
  }

  private async referDiagnostics(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    const patientId = params.patientId as string;
    if (!patientId) return { message: 'Укажите пациента', intent: 'REFER_DIAGNOSTICS', suggestions: [] };

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { firstName: true, lastName: true, clinicId: true },
    });
    if (!patient) return { message: 'Пациент не найден', intent: 'REFER_DIAGNOSTICS', suggestions: [] };

    const diagnosticCenters = await prisma.clinic.findMany({
      where: { type: 'diagnostic_center' },
      select: { id: true, name: true, city: true },
      take: 10,
    });

    return {
      message: `**Направление на диагностику для ${patient.firstName} ${patient.lastName}**\n\n${diagnosticCenters.length ? `Доступные центры:\n${diagnosticCenters.map((c, i) => `${i + 1}. ${c.name} (${c.city || 'город не указан'})`).join('\n')}` : 'Нет доступных диагностических центров. Добавьте центр в настройках.'}`,
      intent: 'REFER_DIAGNOSTICS',
      action: {
        type: 'OPEN_DIAGNOSTICS_REFERRAL',
        payload: {
          patientId,
          patientName: `${patient.firstName} ${patient.lastName}`,
          centers: diagnosticCenters,
        },
      },
      suggestions: diagnosticCenters.length
        ? diagnosticCenters.slice(0, 3).map(c => `Направить в ${c.name}`)
        : ['Добавить диагностический центр'],
    };
  }

  private async scheduleNextVisit(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    const patientId = params.patientId as string;
    if (!patientId) return { message: 'Укажите пациента', intent: 'SCHEDULE_NEXT_VISIT', suggestions: [] };

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { firstName: true, lastName: true },
    });
    if (!patient) return { message: 'Пациент не найден', intent: 'SCHEDULE_NEXT_VISIT', suggestions: [] };

    return {
      message: `Запланировать следующий визит для **${patient.firstName} ${patient.lastName}**?\n\nРекомендуется:\n• Контрольный осмотр через 2-3 недели\n• Завершение лечения\n• Профессиональная гигиена`,
      intent: 'SCHEDULE_NEXT_VISIT',
      action: {
        type: 'SCHEDULE_NEXT',
        payload: { patientId, patientName: `${patient.firstName} ${patient.lastName}` },
      },
      suggestions: ['На завтра', 'На следующую неделю', 'Через 2 недели', 'Выбрать дату'],
    };
  }

  private async suggestInstruments(context: AIContext, params: Record<string, unknown>): Promise<AIResponse> {
    const specialty = (params.specialty as string) || '';
    const diagnosis = (params.diagnosis as string) || '';

    let instruments: string[] = [];
    if (specialty && SPECIALTY_INSTRUMENTS[specialty]) {
      instruments = SPECIALTY_INSTRUMENTS[specialty];
    } else if (diagnosis) {
      const rec = DIAGNOSIS_RECOMMENDATIONS[diagnosis];
      if (rec) {
        instruments = rec.treatment;
      }
    }

    if (!instruments.length) {
      return { message: 'По указанным данным не удалось подобрать инструменты. Уточните специализацию или диагноз.', intent: 'SUGGEST_INSTRUMENTS', suggestions: [] };
    }

    return {
      message: `**Рекомендуемые инструменты${specialty ? ` для ${specialty}` : ''}:**\n${instruments.map(i => `• ${i}`).join('\n')}`,
      intent: 'SUGGEST_INSTRUMENTS',
      action: {
        type: 'SHOW_INSTRUMENTS',
        payload: { specialty, diagnosis, instruments },
      },
      suggestions: ['Подготовить кабинет', 'Показать пациента'],
    };
  }

  private getInstrumentsForDiagnosis(diagnosis: string, specialty?: string): string[] {
    const rec = DIAGNOSIS_RECOMMENDATIONS[diagnosis];
    if (rec) {
      const instruments = [...rec.exams, ...rec.treatment];
      return instruments;
    }
    if (specialty && SPECIALTY_INSTRUMENTS[specialty]) {
      return SPECIALTY_INSTRUMENTS[specialty].slice(0, 6);
    }
    return SPECIALTY_INSTRUMENTS['Терапевт']?.slice(0, 4) || ['Стоматологическая установка', 'Бормашина', 'Рентген'];
  }

  private async searchPatient(context: AIContext, params: Record<string, unknown>) {
    const name = params.name as string;
    if (!name) {
      return { message: 'Укажите имя пациента для поиска', intent: 'SEARCH_PATIENT', suggestions: ['Иванов Иван', 'Петров Петр'] };
    }

    const patients = await prisma.patient.findMany({
      where: {
        clinicId: context.clinicId,
        OR: [
          { firstName: { contains: name, mode: 'insensitive' } },
          { lastName: { contains: name, mode: 'insensitive' } },
        ],
      },
      take: 5,
    });

    if (patients.length === 0) {
      return { message: `Пациент "${name}" не найден`, intent: 'SEARCH_PATIENT', suggestions: [] };
    }

    return {
      message: `Найдено пациентов: ${patients.length}`,
      intent: 'SEARCH_PATIENT',
      action: { type: 'OPEN_PATIENT_LIST', payload: { patients } },
      suggestions: patients.map(p => `${p.firstName} ${p.lastName}`).slice(0, 3),
    };
  }

  private async createAppointment(context: AIContext, params: Record<string, unknown>) {
    const { patientId, doctorId, date, service, duration } = params;
    if (!patientId || !date || !service) {
      return {
        message: 'Укажите пациента, дату и услугу',
        intent: 'CREATE_APPOINTMENT',
        needsConfirmation: true,
        confirmData: { patientId, doctorId: context.userId, date, service, duration: 30 },
        suggestions: [],
      };
    }

    const appointment = await prisma.appointment.create({
      data: {
        id: crypto.randomUUID(),
        clinicId: context.clinicId,
        patientId: patientId as string,
        doctorId: (doctorId as string) || context.userId,
        date: new Date(date as string),
        duration: (duration as number) || 30,
        status: 'pending',
        type: service as string,
      },
    });

    return {
      message: `Запись создана на ${new Date(date as string).toLocaleString('ru-RU')}`,
      intent: 'CREATE_APPOINTMENT',
      action: { type: 'OPEN_APPOINTMENT', payload: { appointmentId: appointment.id } },
      suggestions: ['Открыть карту пациента', 'Посмотреть расписание'],
    };
  }

  private async openMedicalCard(context: AIContext, params: Record<string, unknown>) {
    const patientId = params.patientId as string;
    if (!patientId) {
      return { message: 'Укажите ID пациента', intent: 'OPEN_MEDICAL_CARD', suggestions: [] };
    }

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, clinicId: context.clinicId },
      include: {
        visits: { orderBy: { date: 'desc' }, take: 10 },
        treatmentPlans: { orderBy: { createdAt: 'desc' }, take: 5 },
        images: { orderBy: { createdAt: 'desc' }, take: 10 },
        teeth: true,
      },
    });

    if (!patient) {
      return { message: 'Пациент не найден', intent: 'OPEN_MEDICAL_CARD', suggestions: [] };
    }

    return {
      message: `Медицинская карта: ${patient.firstName} ${patient.lastName}`,
      intent: 'OPEN_MEDICAL_CARD',
      action: { type: 'OPEN_MEDICAL_CARD', payload: { patient } },
      contextUpdate: { type: 'patient', id: patient.id },
      suggestions: ['Посмотреть визиты', 'План лечения', 'Открыть КТ'],
    };
  }

  private async createTreatmentPlan(context: AIContext, params: Record<string, unknown>) {
    const { patientId, items } = params;
    if (!patientId || !items) {
      return { message: 'Укажите пациента и элементы плана', intent: 'CREATE_TREATMENT_PLAN', needsConfirmation: true, suggestions: [] };
    }

    const owner = await prisma.patient.findFirst({ where: { id: patientId as string, clinicId: context.clinicId }, select: { id: true } });
    if (!owner) {
      return { message: 'Пациент не найден', intent: 'CREATE_TREATMENT_PLAN', suggestions: [] };
    }

    const plan = await prisma.treatmentPlan.create({
      data: {
        id: crypto.randomUUID(),
        patientId: patientId as string,
        title: params.title as string || 'План лечения',
        items: items as any,
        price: (items as any[]).reduce((sum, item) => sum + (item.price || 0), 0),
        status: 'draft',
      },
    });

    return {
      message: 'План лечения создан',
      intent: 'CREATE_TREATMENT_PLAN',
      action: { type: 'OPEN_TREATMENT_PLAN', payload: { planId: plan.id } },
      suggestions: ['Открыть план', 'Добавить элементы'],
    };
  }

  private async viewCBCT(context: AIContext, params: Record<string, unknown>) {
    const patientId = params.patientId as string;
    if (!patientId) {
      return { message: 'Укажите пациента', intent: 'VIEW_CBCT', suggestions: [] };
    }

    const images = await prisma.patientImage.findMany({
      where: { patientId, type: 'CBCT', patient: { clinicId: context.clinicId } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    if (images.length === 0) {
      return { message: 'КТ-снимков не найдено', intent: 'VIEW_CBCT', suggestions: [] };
    }

    return {
      message: `Найдено КТ-снимков: ${images.length}`,
      intent: 'VIEW_CBCT',
      action: { type: 'OPEN_CBCT_VIEWER', payload: { images } },
      suggestions: [],
    };
  }

  private async viewSchedule(context: AIContext, params: Record<string, unknown>) {
    const date = params.date as string || new Date().toISOString().split('T')[0];
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
      intent: 'VIEW_SCHEDULE',
      action: { type: 'OPEN_SCHEDULE', payload: { appointments, date } },
      suggestions: [],
    };
  }
}
