import { PrismaClient } from '@prisma/client';
import { parseTengeToMinor } from './money.js';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// Referral lifecycle writes historically supplied a flat 10% platformFee.
// Keep the legacy service contract intact, but normalize accepted/in_progress
// and atomic paid writes to the versioned Partner Economics Engine before they
// reach Postgres. The dynamic import avoids a module-initialization cycle.
//
// `claimReferralPaid()` deliberately uses updateMany for its concurrency guard,
// so the canonical fee must cover both update and updateMany. A paid write is a
// financial settlement boundary even when the caller does not send `status`.
const prismaWithReferralEconomics = prisma as PrismaClient & {
  $use?: (middleware: (params: any, next: (params: any) => Promise<any>) => Promise<any>) => void;
};

prismaWithReferralEconomics.$use?.(async (params, next) => {
  if (params.model === 'Referral' && (params.action === 'update' || params.action === 'updateMany') && params.args?.data) {
    const data = params.args.data;
    const nextStatus = data.status;
    const paidWrite = data.paid === true;
    if (nextStatus === 'ACCEPTED' || nextStatus === 'IN_PROGRESS' || paidWrite) {
      const id = params.args?.where?.id;
      if (typeof id === 'string') {
        const existing = await prisma.referral.findUnique({
          where: { id },
          select: { cost: true, centerId: true, labId: true },
        });
        const cost = data.cost ?? existing?.cost;
        const partnerId = existing?.centerId || existing?.labId;
        if (cost != null && partnerId) {
          const { calculatePartnerEconomics, getPartnerEconomicsRule, PARTNER_VERTICALS } =
            await import('../modules/finance/partner-economics.service.js');
          const vertical = existing?.centerId
            ? PARTNER_VERTICALS.DIAGNOSTIC_3D
            : PARTNER_VERTICALS.MEDICAL_ANALYSIS;
          const rule = await getPartnerEconomicsRule(vertical);
          const breakdown = calculatePartnerEconomics(
            {
              vertical,
              partnerId,
              grossMinor: parseTengeToMinor(cost),
            },
            rule,
          );
          data.platformFee = Number(breakdown.commissionMinor) / 100;
        }
      }
    }
  }
  return next(params);
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
