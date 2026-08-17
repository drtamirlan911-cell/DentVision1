import prisma from '../../../../lib/prisma.js'
import { mergeClinicSettings } from '../../../clinics/clinicSettings.js'
import { buildTimeSlots, isWorkingDay } from '../../../public/bookingSlots.js'

interface GetSlotsArgs {
  clinic_id: string
  service_name: string
  date?: string
}

interface SlotResult {
  datetime: string
  doctor: string
  doctorId: string
  durationMinutes: number
}

/**
 * Actually free slots — this used to query *booked* appointments
 * (`status: pending|confirmed`) and hand them back labelled as available,
 * which is the question inverted: a WhatsApp/Instagram patient could be told
 * an occupied chair was open. Rebuilt on the same clinic-hours math the public
 * booking widget and the patient portal already use
 * (`public/bookingSlots.ts`), so "is this slot free" has one answer in the
 * product instead of three.
 *
 * `service_name` stays decorative here (used only in the empty-result
 * message) — the original never matched it against anything either, and
 * there is no reliable service→doctor mapping to match it against without
 * guessing.
 */
export async function getAvailableSlots(args: GetSlotsArgs): Promise<{
  slots: SlotResult[]
  message: string
}> {
  const clinic = await prisma.clinic.findUnique({ where: { id: args.clinic_id }, select: { settings: true } }).catch(() => null)
  if (!clinic) {
    return { slots: [], message: 'Клиника не найдена.' }
  }
  const settings = mergeClinicSettings(clinic.settings)

  const members = await prisma.clinicMember
    .findMany({
      where: { clinicId: args.clinic_id, role: { in: ['DOCTOR', 'OWNER'] } },
      include: { user: { select: { firstName: true, lastName: true } } },
    })
    .catch(() => [])
  if (!members.length) {
    return { slots: [], message: 'В клинике сейчас нет врачей для записи. Позвоните нам для подбора времени.' }
  }

  const allTimes = buildTimeSlots(settings)
  const baseDate = args.date ? new Date(`${args.date}T12:00:00.000Z`) : new Date()
  const daysToScan = args.date ? 1 : 3
  const slots: SlotResult[] = []
  const MAX_SLOTS = 10

  for (let i = 0; i < daysToScan && slots.length < MAX_SLOTS; i += 1) {
    const day = new Date(baseDate)
    day.setUTCDate(day.getUTCDate() + i)
    if (!isWorkingDay(day, settings)) continue

    const dateStr = day.toISOString().slice(0, 10)
    const dayStart = new Date(`${dateStr}T00:00:00.000Z`)
    const dayEnd = new Date(`${dateStr}T23:59:59.999Z`)

    const [appointments, bookings] = await Promise.all([
      prisma.appointment.findMany({
        where: { clinicId: args.clinic_id, date: { gte: dayStart, lte: dayEnd }, status: { notIn: ['cancelled', 'no_show'] } },
        select: { time: true, doctorId: true },
      }),
      prisma.booking.findMany({
        where: { clinicId: args.clinic_id, date: dayStart, status: { in: ['pending', 'confirmed'] } },
        select: { time: true, doctorId: true },
      }),
    ]).catch(() => [[], []])

    const occupiedByDoctor = new Map<string, Set<string>>()
    for (const row of [...appointments, ...bookings]) {
      if (!row.time || !row.doctorId) continue
      if (!occupiedByDoctor.has(row.doctorId)) occupiedByDoctor.set(row.doctorId, new Set())
      occupiedByDoctor.get(row.doctorId)!.add(row.time)
    }

    for (const time of allTimes) {
      if (slots.length >= MAX_SLOTS) break
      const free = members.find((m) => !occupiedByDoctor.get(m.userId)?.has(time))
      if (!free) continue
      slots.push({
        datetime: `${dateStr}T${time}:00.000Z`,
        doctor: `${free.user.firstName} ${free.user.lastName}`.trim() || 'Врач',
        doctorId: free.userId,
        durationMinutes: settings.bookingSlotMinutes || 30,
      })
    }
  }

  if (!slots.length) {
    return {
      slots: [],
      message: `Свободных окон на "${args.service_name}" ${args.date ? `на ${args.date}` : 'в ближайшие дни'} не найдено. Позвоните нам для подбора времени.`,
    }
  }

  return {
    slots,
    message: `Найдено ${slots.length} свободных окон.`,
  }
}
