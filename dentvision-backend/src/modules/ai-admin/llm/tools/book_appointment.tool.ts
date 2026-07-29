import prisma from '../../../../lib/prisma.js'
import { uid } from '../../../../lib/helpers.js'
import type { AiAdminSession } from '@prisma/client'

interface BookArgs {
  clinic_id: string
  patient_name: string
  patient_phone: string
  slot_datetime: string
  service_name: string
  doctor_id?: string
}

export async function bookAppointment(
  args: BookArgs,
  session: AiAdminSession,
): Promise<{ success: boolean; confirmationText: string }> {
  try {
    let patient = await prisma.patient.findFirst({
      where: { phone: args.patient_phone, clinicId: args.clinic_id },
    })

    if (!patient) {
      const nameParts = args.patient_name.trim().split(' ')
      patient = await prisma.patient.create({
        data: {
          id: uid(),
          clinicId: args.clinic_id,
          firstName: nameParts[0] ?? args.patient_name,
          lastName: nameParts.slice(1).join(' ') || '',
          phone: args.patient_phone,
        },
      })
    }

    const slotTime = new Date(args.slot_datetime)

    const appointment = await prisma.appointment.create({
      data: {
        id: uid(),
        clinicId: args.clinic_id,
        patientId: patient.id,
        doctorId: args.doctor_id || 'unassigned',
        date: slotTime,
        time: slotTime.toISOString().slice(11, 16),
        duration: 30,
        status: 'confirmed',
        type: args.service_name,
        notes: `Записан через AI-администратор (${session.channel})`,
        meta: { source: 'ai_admin', sessionId: session.id },
      },
    })

    await prisma.aiAdminSession.update({
      where: { id: session.id },
      data: { patientName: args.patient_name, patientPhone: args.patient_phone },
    })

    const dateStr = slotTime.toLocaleString('ru-RU', {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    })

    return {
      success: true,
      confirmationText: `Готово! Вы записаны на ${args.service_name}, ${dateStr}. Если нужно перенести — напишите нам.`,
    }
  } catch (err) {
    console.error('[book_appointment] Error:', err)
    return {
      success: false,
      confirmationText: 'Не удалось создать запись. Позвоните нам и мы запишем вас вручную.',
    }
  }
}
