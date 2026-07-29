export const appointmentFunctions = {
  createAppointment: {
    name: 'createAppointment',
    description: 'Создать запись на прием',
    parameters: {
      type: 'object',
      properties: {
        patientId: { type: 'string' },
        doctorId: { type: 'string' },
        date: { type: 'string', format: 'date-time' },
        duration: { type: 'number', default: 30 },
        service: { type: 'string' },
      },
      required: ['patientId', 'doctorId', 'date'],
    },
  },
  updateAppointment: {
    name: 'updateAppointment',
    description: 'Изменить запись (время, врач, услуга)',
    parameters: {
      type: 'object',
      properties: {
        appointmentId: { type: 'string' },
        date: { type: 'string', format: 'date-time' },
        doctorId: { type: 'string' },
        service: { type: 'string' },
        status: { type: 'string', enum: ['pending', 'confirmed', 'completed', 'cancelled'] },
      },
      required: ['appointmentId'],
    },
  },
  cancelAppointment: {
    name: 'cancelAppointment',
    description: 'Отменить запись',
    parameters: {
      type: 'object',
      properties: {
        appointmentId: { type: 'string' },
        reason: { type: 'string' },
      },
      required: ['appointmentId'],
    },
  },
  getSchedule: {
    name: 'getSchedule',
    description: 'Получить расписание врача или клиники',
    parameters: {
      type: 'object',
      properties: {
        doctorId: { type: 'string' },
        date: { type: 'string', format: 'date' },
        clinicId: { type: 'string' },
      },
    },
  },
  getAvailableSlots: {
    name: 'getAvailableSlots',
    description: 'Свободные слоты для записи',
    parameters: {
      type: 'object',
      properties: {
        doctorId: { type: 'string' },
        date: { type: 'string', format: 'date' },
        duration: { type: 'number', default: 30 },
      },
      required: ['doctorId', 'date'],
    },
  },
};