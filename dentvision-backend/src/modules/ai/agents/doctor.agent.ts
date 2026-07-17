import { Agent } from '../core/agent.router.js';
import { AIContext, AIResponse } from '../types/ai.types.js';
import { prisma } from '../../../lib/prisma.js';

export class DoctorAgent implements Agent {
  name = 'doctor';

  canHandle(intent: string): boolean {
    const doctorIntents = [
      'SEARCH_PATIENT',
      'CREATE_APPOINTMENT',
      'UPDATE_APPOINTMENT',
      'CANCEL_APPOINTMENT',
      'OPEN_MEDICAL_CARD',
      'CREATE_TREATMENT_PLAN',
      'VIEW_CBCT',
      'VIEW_SCHEDULE',
    ];
    return doctorIntents.includes(intent);
  }

  async handle(context: AIContext, intent: string, params: Record<string, unknown>): Promise<AIResponse> {
    switch (intent) {
      case 'SEARCH_PATIENT':
        return this.searchPatient(context, params);
      case 'CREATE_APPOINTMENT':
        return this.createAppointment(context, params);
      case 'OPEN_MEDICAL_CARD':
        return this.openMedicalCard(context, params);
      case 'CREATE_TREATMENT_PLAN':
        return this.createTreatmentPlan(context, params);
      case 'VIEW_CBCT':
        return this.viewCBCT(context, params);
      case 'VIEW_SCHEDULE':
        return this.viewSchedule(context, params);
      default:
        return { message: `Неподдерживаемое действие: ${intent}`, intent, suggestions: [] };
    }
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
        status: 'PENDING',
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

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
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

    const plan = await prisma.treatmentPlan.create({
      data: {
        id: crypto.randomUUID(),
        patientId: patientId as string,
        title: params.title as string || 'План лечения',
        items: items as any,
        price: (items as any[]).reduce((sum, item) => sum + (item.price || 0), 0),
        status: 'DRAFT',
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
      where: { patientId, type: 'CBCT' },
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