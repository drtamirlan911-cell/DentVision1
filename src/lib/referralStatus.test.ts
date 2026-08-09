import { describe, expect, it } from 'vitest'

import {
  PHASES, REFERRAL_STATUS, TONE_CLASSES, countAwaitingAction, countByPhase, statusInfo,
} from './referralStatus'

/** Every value of the Prisma `ReferralStatus` enum (schema.prisma). */
const ENUM_VALUES = [
  'DRAFT', 'SENT', 'ACCEPTED', 'SCHEDULED', 'PATIENT_ARRIVED', 'IN_PROGRESS',
  'COMPLETED', 'REVIEWED', 'DELIVERED', 'CLOSED', 'CANCELLED',
]

describe('referral status vocabulary', () => {
  it('covers every status the backend can produce', () => {
    // The old per-file maps covered seven of eleven, so five real statuses were
    // shown to users as their raw enum name.
    expect(ENUM_VALUES.filter((s) => !(s in REFERRAL_STATUS))).toEqual([])
  })

  it('defines nothing the backend cannot produce', () => {
    // `RECEIVED` was in every copy of the old map and in no enum.
    expect(Object.keys(REFERRAL_STATUS).filter((s) => !ENUM_VALUES.includes(s))).toEqual([])
  })

  it('never prints a raw enum name for an unknown status', () => {
    expect(statusInfo('SOMETHING_NEW').label).toBe('Неизвестно')
    expect(statusInfo(undefined).label).toBe('Неизвестно')
    expect(statusInfo(null).label).toBe('Неизвестно')
  })

  it('gives every status a human label, never a bare code', () => {
    for (const [status, info] of Object.entries(REFERRAL_STATUS)) {
      expect(info.label.length, status).toBeGreaterThan(0)
      expect(info.label, status).not.toMatch(/^[A-Z_]+$/)
    }
  })

  it('reserves the success and error tones for terminal states only', () => {
    for (const [status, info] of Object.entries(REFERRAL_STATUS)) {
      if (info.tone === 'success') expect(info.phase, status).toBe('done')
      if (info.tone === 'error') expect(info.phase, status).toBe('cancelled')
    }
  })

  it('uses tokens for every tone, never a raw hex', () => {
    for (const classes of Object.values(TONE_CLASSES)) {
      for (const value of Object.values(classes)) {
        expect(value).not.toMatch(/#[0-9a-f]{3,8}/i)
      }
    }
  })
})

describe('pipeline grouping', () => {
  const referrals = [
    { status: 'SENT' }, { status: 'DRAFT' },
    { status: 'ACCEPTED' }, { status: 'SCHEDULED' }, { status: 'PATIENT_ARRIVED' },
    { status: 'IN_PROGRESS' },
    { status: 'COMPLETED' }, { status: 'CLOSED' },
    { status: 'CANCELLED' },
  ]

  it('groups eleven statuses into four phases plus cancelled', () => {
    expect(countByPhase(referrals)).toEqual({
      awaiting: 2, accepted: 3, inProgress: 1, done: 2, cancelled: 1,
    })
    expect(PHASES.map((p) => p.id)).toEqual(['awaiting', 'accepted', 'inProgress', 'done'])
  })

  it('leads with what the organisation must act on', () => {
    // Awaiting a reply plus accepted-but-not-started — not the total, which is
    // dominated by finished work and says nothing about today.
    expect(countAwaitingAction(referrals)).toBe(5)
  })

  it('counts an unknown status without throwing', () => {
    expect(countByPhase([{ status: 'WAT' }, { status: null }]).awaiting).toBe(2)
  })
})
