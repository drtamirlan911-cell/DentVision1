import prisma from '../../../../lib/prisma.js'

interface GetSlotsArgs {
  clinic_id: string
  service_name: string
  date?: string
}

interface SlotResult {
  datetime: string
  doctor: string
  durationMinutes: number
}

export async function getAvailableSlots(args: GetSlotsArgs): Promise<{
  slots: SlotResult[]
  message: string
}> {
  const targetDate = args.date ? new Date(args.date) : new Date()
  const searchStart = new Date(targetDate)
  searchStart.setHours(0, 0, 0, 0)
  const searchEnd = new Date(targetDate)
  searchEnd.setDate(searchEnd.getDate() + (args.date ? 1 : 3))
  searchEnd.setHours(23, 59, 59, 999)

  const appointments = await prisma.appointment.findMany({
    where: {
      clinicId: args.clinic_id,
      date: {
        gte: searchStart,
        lte: searchEnd,
      },
      status: { in: ['pending', 'confirmed'] },
    },
    include: {
      doctor: { select: { firstName: true, lastName: true, spec: true } },
    },
    orderBy: { date: 'asc' },
    take: 10,
  }).catch(() => [])

  if (!appointments.length) {
    return {
      slots: [],
      message: `Свободных окон на "${args.service_name}" ${args.date ? `на ${args.date}` : 'в ближайшие дни'} не найдено. Позвоните нам для подбора времени.`,
    }
  }

  const slots: SlotResult[] = appointments.map((apt: any) => ({
    datetime: apt.date instanceof Date ? apt.date.toISOString() : String(apt.date),
    doctor: `${apt.doctor?.firstName ?? ''} ${apt.doctor?.lastName ?? ''}`.trim() || 'Врач',
    durationMinutes: apt.duration ?? 30,
  }))

  return {
    slots,
    message: `Найдено ${slots.length} свободных окон.`,
  }
}
