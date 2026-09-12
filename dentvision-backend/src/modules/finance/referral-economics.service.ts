import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { tengeToMinor } from '../../lib/money.js';
import {
  calculatePartnerEconomics,
  getPartnerEconomicsRule,
  PARTNER_VERTICALS,
  type PartnerEconomicsRule,
  type PartnerVertical,
} from './partner-economics.service.js';

export function referralVertical(input: { centerId?: string | null; labId?: string | null }): PartnerVertical | null {
  if (input.centerId) return PARTNER_VERTICALS.DIAGNOSTIC_3D;
  if (input.labId) return PARTNER_VERTICALS.MEDICAL_ANALYSIS;
  return null;
}

export function calculateReferralCommissionMinor(
  vertical: PartnerVertical,
  grossMinor: bigint,
  rule: PartnerEconomicsRule,
): bigint {
  return calculatePartnerEconomics({ vertical, partnerId: 'referral', grossMinor }, rule).commissionMinor;
}

/**
 * Replaces the historical 10% referral fee with the canonical economics rule.
 * This intentionally updates only the derived fee field; the durable economics
 * transaction snapshot is created at settlement time, when the referral is
 * actually paid. Thus a later rule change cannot rewrite historical economics.
 */
export async function applyCanonicalReferralEconomics(referralId: string): Promise<Prisma.Decimal | null> {
  const referral = await prisma.referral.findUnique({
    where: { id: referralId },
    select: { id: true, centerId: true, labId: true, cost: true },
  });
  if (!referral || referral.cost == null) return null;

  const vertical = referralVertical(referral);
  if (!vertical) return null;

  const grossMinor = tengeToMinor(Number(referral.cost) || 0);
  if (grossMinor <= 0n) return null;

  const rule = await getPartnerEconomicsRule(vertical);
  const commissionMinor = calculateReferralCommissionMinor(vertical, grossMinor, rule);
  const platformFee = new Prisma.Decimal(commissionMinor.toString()).div(100);

  await prisma.referral.update({
    where: { id: referral.id },
    data: { platformFee },
  });
  return platformFee;
}
