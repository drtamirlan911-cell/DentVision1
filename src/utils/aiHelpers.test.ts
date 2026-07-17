import { describe, it, expect } from 'vitest'
import { buildAiReply } from './aiHelpers'

describe('buildAiReply', () => {
  it('returns practical pricing guidance for price questions', () => {
    const reply = buildAiReply({
      message: 'Какая цена на имплантацию?',
      clinicName: 'DentVision Taldykorgan',
      patients: [],
      appointments: [],
      receipts: [],
      doctors: [],
    })
    expect(reply).toMatch(/имплант/i)
    expect(reply).toMatch(/DentVision Taldykorgan/i)
  })

  it('summarises clinic performance for report questions', () => {
    const reply = buildAiReply({
      message: 'Сделай отчёт за сегодня',
      clinicName: 'DentVision Almaty',
      patients: [{ id: 1 }, { id: 2 }],
      appointments: [{ id: 1 }, { id: 2 }, { id: 3 }],
      receipts: [{ status: 'paid', total: 150000 }, { status: 'paid', total: 300000 }],
      doctors: [{ id: 1 }, { id: 2 }],
    })
    expect(reply).toMatch(/2 пациента/i)
    expect(reply).toMatch(/3 записи/i)
    expect(reply).toMatch(/450000/i)
  })
})
