import { describe, expect, it } from 'vitest'
import { findScheduleConflicts, timesOverlap } from './appointmentMeta.js'

type Candidate = {
  id: string
  doctorId: string
  patientId: string
  time: string | null
  duration: number | null
  meta?: unknown
}

const doc1 = 'doc-1'
const doc2 = 'doc-2'
const pat1 = 'pat-1'
const pat2 = 'pat-2'

function appt(over: Partial<Candidate> & { id: string }): Candidate {
  return {
    doctorId: doc1,
    patientId: pat1,
    time: '10:00',
    duration: 30,
    meta: {},
    ...over,
  }
}

describe('timesOverlap', () => {
  it('detects overlapping windows', () => {
    expect(timesOverlap('10:00', 30, '10:15', 30)).toBe(true)
    expect(timesOverlap('10:15', 30, '10:00', 30)).toBe(true)
  })

  it('treats adjacent (touching) windows as non-overlapping', () => {
    // 10:00–10:30 then 10:30–11:00 share only the boundary → no overlap
    expect(timesOverlap('10:00', 30, '10:30', 30)).toBe(false)
    expect(timesOverlap('10:30', 30, '10:00', 30)).toBe(false)
  })

  it('returns false for clearly separate windows', () => {
    expect(timesOverlap('09:00', 30, '11:00', 30)).toBe(false)
  })
})

describe('findScheduleConflicts', () => {
  it('flags a doctor double-booking on overlapping time', () => {
    const conflicts = findScheduleConflicts<Candidate>({
      candidates: [appt({ id: 'c1', patientId: pat2, time: '10:15', duration: 30 })],
      doctorId: doc1,
      time: '10:00',
      duration: 30,
    })
    expect(conflicts.map((c) => c.id)).toEqual(['c1'])
  })

  it('flags a patient double-booking even with a different doctor', () => {
    const conflicts = findScheduleConflicts<Candidate>({
      candidates: [appt({ id: 'c1', doctorId: doc2, patientId: pat1, time: '10:10' })],
      doctorId: doc2, // new appt is with doc2 too; conflict is via the patient
      patientId: pat1,
      time: '10:00',
      duration: 30,
    })
    expect(conflicts.map((c) => c.id)).toEqual(['c1'])
  })

  it('flags a chair double-booking via meta.chairId', () => {
    const conflicts = findScheduleConflicts<Candidate>({
      candidates: [
        appt({ id: 'c1', doctorId: doc2, patientId: pat2, time: '10:10', meta: { chairId: 'chair-A' } }),
      ],
      doctorId: doc1,
      patientId: pat1,
      chairId: 'chair-A',
      time: '10:00',
      duration: 30,
    })
    expect(conflicts.map((c) => c.id)).toEqual(['c1'])
  })

  it('returns empty when times do not overlap', () => {
    const conflicts = findScheduleConflicts<Candidate>({
      candidates: [appt({ id: 'c1', time: '11:00', duration: 30 })],
      doctorId: doc1,
      patientId: pat1,
      time: '10:00',
      duration: 30,
    })
    expect(conflicts).toEqual([])
  })

  it('returns empty when neither doctor, patient, nor chair matches', () => {
    const conflicts = findScheduleConflicts<Candidate>({
      candidates: [
        appt({ id: 'c1', doctorId: doc2, patientId: pat2, time: '10:15', meta: { chairId: 'chair-B' } }),
      ],
      doctorId: doc1,
      patientId: pat1,
      chairId: 'chair-A',
      time: '10:00',
      duration: 30,
    })
    expect(conflicts).toEqual([])
  })

  it('excludes the appointment being edited via excludeId', () => {
    const conflicts = findScheduleConflicts<Candidate>({
      candidates: [appt({ id: 'self', time: '10:00', duration: 30 })],
      doctorId: doc1,
      patientId: pat1,
      time: '10:00',
      duration: 30,
      excludeId: 'self',
    })
    expect(conflicts).toEqual([])
  })

  it('does not flag adjacent (back-to-back) appointments for the same doctor', () => {
    const conflicts = findScheduleConflicts<Candidate>({
      candidates: [appt({ id: 'c1', time: '10:30', duration: 30 })],
      doctorId: doc1,
      time: '10:00',
      duration: 30,
    })
    expect(conflicts).toEqual([])
  })
})
