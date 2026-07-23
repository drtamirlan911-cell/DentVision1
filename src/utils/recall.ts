/**
 * Smart Recall — Spec §5.5 #5
 * Find patients who went quiet and need reactivation.
 */

import type { Appointment, Patient, Receipt } from '../types'
import { buildWaLink } from './reminders'

export interface RecallCandidate {
  patient: Patient
  lastVisitDate: string | null
  daysSince: number
  reason: 'inactive' | 'open_plan_inactive' | 'debtor_inactive'
  openPlansHint?: boolean
  balanceHint?: number
  message: string
  waLink: string
}

export interface DuplicateHint {
  key: string
  patients: Patient[]
  match: 'phone' | 'name'
}

function daysSince(dateStr: string | null | undefined): number {
  if (!dateStr) return Infinity
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return Infinity
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

function lastActivityDate(patientId: string, appointments: Appointment[], receipts: Receipt[]): string | null {
  const dates = [
    ...appointments.filter((a) => a.patientId === patientId && !['cancelled', 'noShow'].includes(a.status)).map((a) => a.date),
    ...receipts.filter((r) => r.patientId === patientId).map((r) => r.date),
  ].filter(Boolean) as string[]
  if (!dates.length) return null
  dates.sort()
  return dates[dates.length - 1] || null
}

/** Patients with no visit/appointment activity for `inactiveDays` (default 180). */
export function getRecallCandidates(
  patients: Patient[],
  appointments: Appointment[],
  receipts: Receipt[],
  options: { inactiveDays?: number; openPlanPatientIds?: Set<string> } = {},
): RecallCandidate[] {
  const inactiveDays = options.inactiveDays ?? 180
  const openPlans = options.openPlanPatientIds || new Set<string>()

  const candidates = patients
    .map((patient) => {
      const last = lastActivityDate(patient.id, appointments, receipts)
      const days = daysSince(last)
      if (days < inactiveDays) return null

      const hasOpenPlan = openPlans.has(patient.id)
      const debtReceipts = receipts.filter(
        (r) => r.patientId === patient.id && (r.status === 'debt' || r.paymentType === 'credit'),
      )
      const balance = debtReceipts.reduce((s, r) => s + (r.total || Number(r.amount) || 0), 0)

      let reason: RecallCandidate['reason'] = 'inactive'
      if (hasOpenPlan) reason = 'open_plan_inactive'
      else if (balance > 0) reason = 'debtor_inactive'

      const months = days === Infinity ? null : Math.floor(days / 30)
      const message = hasOpenPlan
        ? `Здравствуйте, ${patient.name}!\n\nУ вас есть незавершённый план лечения. Давайте продолжим — запишитесь на удобное время 🦷`
        : balance > 0
          ? `Здравствуйте, ${patient.name}!\n\nНапоминаем о балансе ${Math.round(balance).toLocaleString('ru-RU')} ₸ и приглашаем на приём. Ответьте на сообщение, чтобы записаться.`
          : last
            ? `Здравствуйте, ${patient.name}!\n\nМы давно не виделись (${months} мес.). Рекомендуем профилактический осмотр и профгигиену ✨ Запишитесь удобным способом!`
            : `Здравствуйте, ${patient.name}!\n\nПриглашаем на стоматологический осмотр в нашу клинику. Запишитесь — ответьте на это сообщение!`

      return {
        patient,
        lastVisitDate: last,
        daysSince: days,
        reason,
        openPlansHint: hasOpenPlan,
        balanceHint: balance,
        message,
        waLink: buildWaLink(patient.phone, message),
      } as RecallCandidate | null
    })
    .filter((c) => c !== null)
    .sort((a, b) => b.daysSince - a.daysSince) as RecallCandidate[]
  return candidates
}

/** Likely duplicate patients by normalized phone or exact name. */
export function findDuplicatePatients(patients: Patient[]): DuplicateHint[] {
  const byPhone = new Map<string, Patient[]>()
  const byName = new Map<string, Patient[]>()

  for (const p of patients) {
    const phone = String(p.phone || '').replace(/\D/g, '')
    if (phone.length >= 10) {
      const key = phone.slice(-10)
      byPhone.set(key, [...(byPhone.get(key) || []), p])
    }
    const name = String(p.name || '').trim().toLowerCase()
    if (name.length >= 5) {
      byName.set(name, [...(byName.get(name) || []), p])
    }
  }

  const hints: DuplicateHint[] = []
  for (const [key, list] of byPhone) {
    if (list.length > 1) hints.push({ key: `phone:${key}`, patients: list, match: 'phone' })
  }
  for (const [key, list] of byName) {
    if (list.length > 1) hints.push({ key: `name:${key}`, patients: list, match: 'name' })
  }
  return hints
}
