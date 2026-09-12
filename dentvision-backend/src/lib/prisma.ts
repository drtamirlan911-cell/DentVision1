import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// Referral lifecycle writes historically supplied a flat 10% platformFee.
// Keep the legacy service contract intact, but normalize accepted/in_progress
// writes to the versioned Partner Economics Engine before they reach Postgres.
// The dynamic import avoids a module-initialization cycle because the economics
// engine itself uses this Prisma client. The engine's own updateMany path does
// not carry `status`, so it cannot recursively enter this guard.
const prismaWithReferralEconomics = prisma as PrismaClient & {
  $use?: (middleware: (params: any, next: (params: any) => Promise<any>) => Promise<any>) => void;
};

prismaWithReferralEconomics.$use?.(async (params, next) => {
  if (params.model === 'Referral' && params.action === 'update' && params.args?.data) {
    const nextStatus = params.args.data.status;
    if (nextStatus === 'ACCEPTED' || nextStatus === 'IN_PROGRESS') {
      const id = params.args?.where?.id;
      if (typeof id === 'string') {
        const existing = await prisma.referral.findUnique({
          where: { id },
          select: { cost: true, centerId: true, labId: true },
        });
        if (existing?.cost != null && (existing.centerId || existing.labId)) {
          const { calculatePartnerEconomics, getPartnerEconomicsRule, PARTNER_VERTICALS } =
            await import('../modules/finance/partner-economics.service.js');
          const vertical = existing.centerId
            ? PARTNER_VERTICALS.DIAGNOSTIC_3D
            : PARTNER_VERTICALS.MEDICAL_ANALYSIS;
          const rule = await getPartnerEconomicsRule(vertical);
          const breakdown = calculatePartnerEconomics(
            {
              vertical,
              partnerId: (existing.centerId || existing.labId) as string,
              grossMinor: BigInt(Math.round(Number(existing.cost) * 100)),
            },
            rule,
          );
          params.args.data.platformFee = Number(breakdown.commissionMinor) / 100;
        }
      }
    }
  }
  return next(params);
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
