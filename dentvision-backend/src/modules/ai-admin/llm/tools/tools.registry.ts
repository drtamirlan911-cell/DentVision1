import type { AiAdminSession } from '@prisma/client'
import { getAvailableSlots } from './get_slots.tool.js'
import { bookAppointment } from './book_appointment.tool.js'
import { escalateToHuman } from './escalate.tool.js'

interface ToolDef {
  type: 'function'
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description: string }>
    required: string[]
  }
}

export const toolsRegistry: ToolDef[] = [
  {
    type: 'function',
    name: 'get_available_slots',
    description: 'Возвращает свободные окна в расписании клиники на указанную дату и услугу.',
    parameters: {
      type: 'object',
      properties: {
        clinic_id: { type: 'string', description: 'ID клиники' },
        service_name: { type: 'string', description: 'Название услуги или специальность врача' },
        date: { type: 'string', description: 'Дата YYYY-MM-DD, если не указана — ближайшие дни' },
      },
      required: ['service_name'],
    },
  },
  {
    type: 'function',
    name: 'book_appointment',
    description: 'Записывает пациента на приём и возвращает подтверждение.',
    parameters: {
      type: 'object',
      properties: {
        clinic_id: { type: 'string', description: 'ID клиники (подставляется автоматически)' },
        patient_name: { type: 'string', description: 'Имя пациента' },
        patient_phone: { type: 'string', description: 'Номер телефона' },
        slot_datetime: { type: 'string', description: 'Дата и время ISO 8601' },
        service_name: { type: 'string', description: 'Название услуги' },
        doctor_id: { type: 'string', description: 'ID врача (если выбран)' },
      },
      required: ['patient_name', 'patient_phone', 'slot_datetime', 'service_name'],
    },
  },
  {
    type: 'function',
    name: 'escalate_to_human',
    description: 'Передаёт диалог живому администратору. Использовать когда: медицинский вопрос, срочно, пациент недоволен.',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Причина передачи' },
      },
      required: ['reason'],
    },
  },
]

export async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
  session: AiAdminSession,
): Promise<unknown> {
  switch (name) {
    case 'get_available_slots':
      return getAvailableSlots(args as any)
    case 'book_appointment':
      return bookAppointment(args as any, session)
    case 'escalate_to_human':
      return escalateToHuman(args as any, session)
    default:
      return { error: `Unknown tool: ${name}` }
  }
}
