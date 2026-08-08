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

describe('payroll commission base (net vs gross)', () => {
  const baseInput = {
    userId: 'u1',
    name: 'Doctor',
    role: 'DOCTOR',
    percent: 30,
    payType: 'commission',
    from: new Date(2026, 6, 1),
    to: new Date(2026, 6, 30),
    appointments: [
      {
        id: 'a1',
        date: new Date(2026, 6, 10),
        time: '10:00',
        meta: { serviceName: 'Гигиена', servicePrice: 100000, matCost: 10000 },
        patient: { firstName: 'A', lastName: 'B' },
      },
    ],
  }

  it('defaults to net base (revenue − materials) for backward compatibility', () => {
    const row = buildDoctorPayroll(baseInput)
    // net = 100k − 10k = 90k; 30% of 90k = 27k
    expect(row.commissionPart).toBe(27000)
    expect(row.earned).toBe(27000)
    expect(row.visitDetails[0].earned).toBe(27000)
  })

  it('uses net base when commissionBase is explicitly net', () => {
    const row = buildDoctorPayroll({ ...baseInput, commissionBase: 'net' })
    expect(row.commissionPart).toBe(27000)
    expect(row.visitDetails[0].earned).toBe(27000)
  })

  it('uses gross base when commissionBase is gross', () => {
    const row = buildDoctorPayroll({ ...baseInput, commissionBase: 'gross' })
    // gross = 100k; 30% of 100k = 30k (materials not deducted)
    expect(row.commissionPart).toBe(30000)
    expect(row.earned).toBe(30000)
    expect(row.visitDetails[0].earned).toBe(30000)
  })

  it('aggregates gross base across multiple visits', () => {
    const row = buildDoctorPayroll({
      ...baseInput,
      commissionBase: 'gross',
      appointments: [
        ...baseInput.appointments,
        {
          id: 'a2',
          date: new Date(2026, 6, 12),
          time: '11:00',
          meta: { serviceName: 'Пломба', servicePrice: 50000, matCost: 5000 },
          patient: { firstName: 'C', lastName: 'D' },
        },
      ],
    })
    // gross total = 150k; 30% = 45k
    expect(row.gross).toBe(150000)
    expect(row.commissionPart).toBe(45000)
    expect(row.visits).toBe(2)
  })
})
