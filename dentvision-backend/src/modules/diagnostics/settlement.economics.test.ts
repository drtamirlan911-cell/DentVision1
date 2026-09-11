import { describe, expect, it } from 'vitest'
import { calculatePartnerEconomics, canonicalPartnerEconomicsRules } from '../finance/partner-economics.service.js'
import { referralPartnerVertical } from './settlement.service.js'

const [diagnostic, analysis] = canonicalPartnerEconomicsRules()

describe('diagnostics settlement economics contract', () => {
  it('uses the 3D diagnostic rule for center-owned referrals', () => {
    const vertical = referralPartnerVertical({ centerId: 'center-1', labId: null })
    expect(vertical).toBe('DIAGNOSTIC_3D')

    const result = calculatePartnerEconomics({
      vertical: 'DIAGNOSTIC_3D',
      partnerId: 'center-1',
      grossMinor: 10_000n * 100n,
    }, diagnostic)

    expect(result.commissionMinor).toBe(70_000n)
    expect(result.partnerRevenueMinor).toBe(930_000n)
  })

  it('uses the medical-analysis rule for lab-owned referrals', () => {
    const vertical = referralPartnerVertical({ centerId: null, labId: 'lab-1' })
    expect(vertical).toBe('MEDICAL_ANALYSIS')

    const result = calculatePartnerEconomics({
      vertical: 'MEDICAL_ANALYSIS',
      partnerId: 'lab-1',
      grossMinor: 10_000n * 100n,
    }, analysis)

    expect(result.commissionMinor).toBe(60_000n)
    expect(result.partnerRevenueMinor).toBe(940_000n)
  })
})
