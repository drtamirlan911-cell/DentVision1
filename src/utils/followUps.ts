/** Surgery / complex treatment follow-up keywords */
export const FOLLOW_UP_KEYWORDS = [
  'удален', 'удалён', 'имплант', 'хирург', 'пульпит', 'синус', 'костн', 'разрез', 'швы', 'экстрак',
]

export function isFollowUpNotes(notes?: string | null): boolean {
  const n = String(notes || '').toLowerCase()
  if (!n) return false
  return FOLLOW_UP_KEYWORDS.some((k) => n.includes(k))
}

export function buildFollowUps(appointments: Array<{
  id: string
  date?: string
  notes?: string
  doctorId?: string
  patientId?: string
  patientName?: string
  patientPhone?: string
  status?: string
}>, patients?: Array<{ id: string; name?: string; phone?: string }>) {
  const recent = [...appointments]
    .filter((a) => ['done', 'completed', 'COMPLETED'].includes(String(a.status || '')) || isFollowUpNotes(a.notes))
    .filter((a) => isFollowUpNotes(a.notes))
    .slice(0, 40)

  return recent.map((a) => {
    const p = patients?.find((x) => x.id === a.patientId)
    return {
      id: a.id,
      date: a.date || '',
      patientId: a.patientId,
      patientName: a.patientName || p?.name || 'Пациент',
      phone: a.patientPhone || p?.phone || '',
      reason: 'Хирургия / сложное лечение',
      notes: a.notes || '',
    }
  })
}
