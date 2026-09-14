import { PrismaClient } from '@prisma/client';
import { ZodError } from 'zod';
import { parseTengeToMinor } from './money.js';
import { installContentCatalogJsonGuard } from '../iam/contentCatalogMiddleware.js';

// Zod 4 renamed the public issue collection from `errors` to `issues`.
// Several legacy route handlers still consume `.errors`; keep that contract
// alive centrally because Prisma is imported by those route modules at startup.
if (!Object.getOwnPropertyDescriptor(ZodError.prototype, 'errors')) {
  Object.defineProperty(ZodError.prototype, 'errors', {
    configurable: true,
    get() { return this.issues; },
  });
}

installContentCatalogJsonGuard();

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

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
        const existing = await prisma.referral.findUnique({ where: { id }, select: { cost: true, centerId: true, labId: true } });
        const cost = data.cost ?? existing?.cost;
        const partnerId = existing?.centerId || existing?.labId;
        if (cost != null && partnerId) {
          const { calculatePartnerEconomics, getPartnerEconomicsRule, PARTNER_VERTICALS } = await import('../modules/finance/partner-economics.service.js');
          const vertical = existing?.centerId ? PARTNER_VERTICALS.DIAGNOSTIC_3D : PARTNER_VERTICALS.MEDICAL_ANALYSIS;
          const rule = await getPartnerEconomicsRule(vertical);
          const breakdown = calculatePartnerEconomics({ vertical, partnerId, grossMinor: parseTengeToMinor(cost) }, rule);
          data.platformFee = Number(breakdown.commissionMinor) / 100;
        }
      }
    }
  }
  return next(params);
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
export default prisma;
