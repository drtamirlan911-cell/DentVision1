import prisma from '../../../../lib/prisma.js'
import { uid } from '../../../../lib/helpers.js'
import { publish } from '../../../../lib/events.js'
import type { AiAdminSession } from '@prisma/client'

interface BookArgs {
  clinic_id: string
  patient_name: string
  patient_phone: string
  slot_datetime: string
  service_name: string
  doctor_id?: string
}

/**
 * Confirms an appointment straight onto the calendar — this channel (WhatsApp
 * / Instagram) has no human review step the way a portal `Booking` request
 * does, so this function is the entire safety boundary for a slot the model
 * chose.
 *
 * Two real bugs lived here before this pass, both able to put two patients in
 * the same chair:
 *
 * 1. No conflict check at all. `slot_datetime` came from `get_available_slots`,
 *    which itself used to list *taken* slots as free (see `get_slots.tool.ts`).
 *    Even fixed, a slot can be taken between the two tool calls — a model
 *    conversation spans real time — so the write has to re-check, not just the
 *    read.
 * 2. `doctorId: args.doctor_id || 'unassigned'`. `Appointment.doctorId` is a
 *    required foreign key onto `User` with `onDelete: Restrict` — the literal
 *    string `'unassigned'` is not a user id, so any booking where the model
 *    omitted `doctor_id` threw inside the try/catch and was reported to the
 *    patient as a generic failure. Now a real, available doctor is resolved
 *    server-side instead of trusting the model to have supplied one.
 */
export async function bookAppointment(
  args: BookArgs,
  session: AiAdminSession,
): Promise<{ success: boolean; confirmationText: string }> {
  try {
    const slotTime = new Date(args.slot_datetime)
    if (Number.isNaN(slotTime.getTime())) {
      return { success: false, confirmationText: 'Не удалось разобрать дату и время. Позвоните нам и мы запишем вас вручную.' }
    }
    const time = slotTime.toISOString().slice(11, 16)
    const dayStart = new Date(slotTime)
    dayStart.setUTCHours(0, 0, 0, 0)
    const dayEnd = new Date(slotTime)
    dayEnd.setUTCHours(23, 59, 59, 999)

    const doctorId = await resolveDoctorId(args.clinic_id, args.doctor_id, dayStart, dayEnd, time)
    if (!doctorId) {
      return {
        success: false,
        confirmationText: 'Это время только что заняли. Позвоните нам или напишите ещё раз, чтобы подобрать другое.',
      }
    }

    // Re-check at write time: the read that produced `slot_datetime` may be
    // several messages old by now.
    const conflict = await prisma.appointment.findFirst({
      where: {
        clinicId: args.clinic_id,
        doctorId,
        date: { gte: dayStart, lte: dayEnd },
        time,
        status: { notIn: ['cancelled', 'no_show'] },
      },
    })
    if (conflict) {
      return {
        success: false,
        confirmationText: 'Это время только что заняли. Позвоните нам или напишите ещё раз, чтобы подобрать другое.',
      }
    }

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

    const appointment = await prisma.appointment.create({
      data: {
        id: uid(),
        clinicId: args.clinic_id,
        patientId: patient.id,
        doctorId,
        date: slotTime,
        time,
        duration: 30,
        status: 'confirmed',
        type: args.service_name,
        notes: `Записан через AI-администратор (${session.channel})`,
        meta: { source: 'ai_admin', sessionId: session.id },
      },
    })

    // No `userId`: this path runs off a webhook session, with no human actor.
    // The event still has to fire — audit, workflows and webhooks all listen
    // for it, and the patient still gets a treating doctor out of it.
    publish('appointment.created', {
      clinicId: args.clinic_id,
      appointmentId: appointment.id,
      patientId: patient.id,
      doctorId,
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

/**
 * The doctor named by the model, if they are real and actually free at this
 * time; otherwise any DOCTOR/OWNER at the clinic who is free at this time.
 * Returns null when nobody is — the caller must not fall back to a placeholder
 * id, because there is no such thing as an unassigned doctor in this schema.
 */
async function resolveDoctorId(
  clinicId: string,
  requestedDoctorId: string | undefined,
  dayStart: Date,
  dayEnd: Date,
  time: string,
): Promise<string | null> {
  const members = await prisma.clinicMember.findMany({
    where: {
      clinicId,
      role: { in: ['DOCTOR', 'OWNER'] },
      ...(requestedDoctorId ? { userId: requestedDoctorId } : {}),
    },
    select: { userId: true },
  })
  if (!members.length) return null

  const busy = await prisma.appointment.findMany({
    where: {
      clinicId,
      date: { gte: dayStart, lte: dayEnd },
      time,
      status: { notIn: ['cancelled', 'no_show'] },
      doctorId: { in: members.map((m) => m.userId) },
    },
    select: { doctorId: true },
  })
  const busyIds = new Set(busy.map((b) => b.doctorId))
  return members.find((m) => !busyIds.has(m.userId))?.userId ?? null
}
