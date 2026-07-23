import { describe, it, expect } from 'vitest'
import { buildAiReply } from './aiHelpers'
import { INIT_USERS } from '@/lib/seed-data'

describe('auth flow', () => {
  it('demo users exist and have login credentials', () => {
    expect(INIT_USERS.length).toBeGreaterThan(0)
    INIT_USERS.forEach(u => {
      expect(u.login).toBeDefined()
    })
  })

  it('ai reply uses clinic context for pricing questions', () => {
    const reply = buildAiReply({
      message: 'Какая цена на имплантацию?',
      clinicName: 'DentVision Almaty',
      patients: [{ id: 1 }] as any[],
      appointments: [{ id: 1 }] as any[],
      receipts: [{ total: 100000, status: 'paid' }] as any[],
      doctors: INIT_USERS.filter(u => u.role === 'doctor'),
    })
    expect(reply).toMatch(/DentVision Almaty/i)
    expect(reply).toMatch(/имплант/i)
  })
})
