import { describe, expect, it } from 'vitest'
import {
  buildDoctorPayroll,
  normalizePayType,
  prorateBaseSalary,
} from './payroll.js'

describe('payroll pay types', () => {
  it('normalizes pay types', () => {
    expect(normalizePayType('salary')).toBe('salary')
    expect(normalizePayType('mixed')).toBe('mixed')
    expect(normalizePayType('x')).toBe('commission')
  })

  it('prorates base salary', () => {
    const from = new Date(2026, 6, 1)
    const to = new Date(2026, 6, 15)
    expect(prorateBaseSalary(300000, from, to)).toBe(150000)
  })

  it('mixes salary + commission', () => {
    const from = new Date(2026, 6, 1)
    const to = new Date(2026, 6, 30)
    const row = buildDoctorPayroll({
      userId: 'u1',
      name: 'Doctor',
      role: 'DOCTOR',
      percent: 30,
      baseSalary: 300000,
      payType: 'mixed',
      from,
      to,
      appointments: [
        {
          id: 'a1',
          date: new Date(2026, 6, 10),
          time: '10:00',
          meta: { serviceName: 'Гигиена', servicePrice: 100000, matCost: 10000 },
          patient: { firstName: 'A', lastName: 'B' },
        },
      ],
    })
    expect(row.salaryPart).toBe(300000)
    expect(row.commissionPart).toBe(27000) // (100k-10k)*30%
    expect(row.earned).toBe(327000)
    expect(row.visits).toBe(1)
  })
})
