export interface RequestAppointmentInput {
  patientId: string;
  clinicId: string;
  date: string;
  time: string;
  doctorId?: string | null;
  serviceName?: string | null;
  notes?: string | null;
  releaseId?: string | null;
}

export async function requestAppointment(input: RequestAppointmentInput) {
  const [patient, clinic] = await Promise.all([
    (prisma as any).patient.findUnique({
      where: { id: input.patientId },
      select: { firstName: true, lastName: true, phone: true, email: true, clinicId: true },
    }),
    (prisma as any).clinic.findUnique({ where: { id: input.clinicId }, select: { settings: true } }),
  ]);
  if (!patient) throw new PortalActionError('Карта пациента не найдена', 'NOT_FOUND');
  if (!clinic) throw new PortalActionError('Клиника не найдена', 'NOT_FOUND');
  // Legacy/unassigned patient records may have no clinicId; once a patient is
  // tenant-bound, a caller can never move that record into another clinic.
  if (patient.clinicId && patient.clinicId !== input.clinicId) throw new PortalActionError('Пациент не относится к выбранной клинике', 'NOT_FOUND');
  const settings = mergeClinicSettings(clinic.settings);
  if (settings.onlineBookingEnabled === false) throw new PortalActionError('Онлайн-запись в этой клинике сейчас недоступна', 'BAD_STATUS');
  const day = new Date(`${input.date}T12:00:00.000Z`);
  if (!isWorkingDay(day, settings)) throw new PortalActionError('Клиника не работает в выбранный день', 'BAD_STATUS');
  if (!buildTimeSlots(settings).includes(input.time)) throw new PortalActionError('Такого времени нет в расписании клиники', 'BAD_STATUS');
  const dayStart = new Date(`${input.date}T00:00:00.000Z`);
  const dayEnd = new Date(`${input.date}T23:59:59.999Z`);
  const [conflictAppt, conflictBooking] = await Promise.all([
    (prisma as any).appointment.findFirst({ where: { clinicId: input.clinicId, date: { gte: dayStart, lte: dayEnd }, time: input.time, status: { notIn: ['cancelled', 'no_show'] }, ...(input.doctorId ? { doctorId: input.doctorId } : {}) } }),
    (prisma as any).booking.findFirst({ where: { clinicId: input.clinicId, date: dayStart, time: input.time, status: { in: ['pending', 'confirmed'] }, ...(input.doctorId ? { doctorId: input.doctorId } : {}) } }),
  ]);
  if (conflictAppt || conflictBooking) throw new PortalActionError('Это время уже занято. Выберите другое.', 'BAD_STATUS');
  let doctorName: string | null = null;
  if (input.doctorId) {
    const member = await (prisma as any).clinicMember.findFirst({ where: { clinicId: input.clinicId, userId: input.doctorId }, include: { user: { select: { firstName: true, lastName: true } } } });
    if (!member) throw new PortalActionError('Врач не найден', 'NOT_FOUND');
    doctorName = [member.user.firstName, member.user.lastName].filter(Boolean).join(' ').trim();
  }
  let releaseId: string | null = null;
  if (input.releaseId) {
    const release = await getPublishedRelease(input.patientId, input.releaseId);
    releaseId = release?.id ?? null;
  }
  const patientName = [patient.firstName, patient.lastName].filter(Boolean).join(' ').trim() || 'Пациент';
  const row = await (prisma as any).booking.create({ data: { id: uid(), clinicId: input.clinicId, patientName, phone: patient.phone || '', email: patient.email || null, doctorId: input.doctorId || null, doctorName, serviceName: input.serviceName || null, date: dayStart, time: input.time, notes: input.notes || null, status: 'pending', releaseId, source: 'ai-assistant' } });
  return { id: row.id, date: input.date, time: row.time, doctorName, status: row.status };
}
