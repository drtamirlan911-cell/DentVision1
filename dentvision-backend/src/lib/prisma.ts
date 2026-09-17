import { PrismaClient } from '@prisma/client';
import { ZodError } from 'zod';
import { parseTengeToMinor } from './money.js';
import { installContentCatalogJsonGuard } from '../iam/contentCatalogMiddleware.js';
import { assertDiagnosticSignerIsDoctor } from './diagnosticClinicalAuth.js';

// Zod 4 renamed the public issue collection from `errors` to `issues`.
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

const CASE_MODELS = new Set(['Appointment', 'Visit', 'TreatmentPlan', 'Referral', 'LabOrder', 'Invoice']);

/**
 * Resolve a case from explicit context or from the patient's sole active case.
 * Ambiguous patients stay unlinked: clinical and financial records must never
 * be attached to an arbitrary case merely because it was edited most recently.
 */
async function resolveCaseForWrite(patientId?: string | null, clinicId?: string | null, explicitId?: string | null) {
  if (explicitId) {
    const row = await prisma.treatmentCase.findFirst({
      where: {
        id: explicitId,
        ...(patientId ? { patientId } : {}),
        ...(clinicId ? { clinicId } : {}),
      },
      select: { id: true },
    });
    if (!row) throw new Error('TREATMENT_CASE_NOT_FOUND');
    return row.id;
  }
  if (!patientId) return null;

  let resolvedClinicId = clinicId;
  if (!resolvedClinicId) {
    const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { clinicId: true } });
    resolvedClinicId = patient?.clinicId ?? null;
  }
  if (!resolvedClinicId) return null;

  const active = await prisma.treatmentCase.findMany({
    where: {
      patientId,
      clinicId: resolvedClinicId,
      status: { notIn: ['completed', 'archived'] },
    },
    select: { id: true },
    orderBy: { updatedAt: 'desc' },
    take: 2,
  });
  return active.length === 1 ? active[0].id : null;
}

/**
 * Case inheritance is deliberately implemented as a post-write bridge while
 * the generated Prisma client is still on the legacy schema. It removes an
 * optional treatmentCaseId from query data before Prisma validation, resolves
 * the canonical case, then writes the nullable physical FK in the same DB.
 * Once the Prisma client is regenerated with the relation fields, this bridge
 * can be reduced to ordinary typed `treatmentCase: { connect: ... }` writes.
 */
prismaWithReferralEconomics.$use?.(async (params, next) => {
  if (params.model === 'DiagnosticResult' && ['create', 'update', 'upsert', 'updateMany'].includes(params.action) && params.args?.data) {
    const data = params.args.data;
    const signedBy = data.signedBy;
    if (typeof signedBy === 'string' && signedBy.trim()) {
      const referralId = data.referralId || params.args?.where?.referralId || params.args?.where?.id;
      if (typeof referralId === 'string') {
        await assertDiagnosticSignerIsDoctor(prisma, referralId, signedBy);
      }
    }
  }

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

  // Canonical TreatmentCase inheritance across CRM + diagnostics + labs +
  // clinical finance. Explicit IDs win; otherwise inherit only from a unique
  // active patient case. This applies to all create paths using Prisma, so a
  // new route cannot silently forget the case link.
  if (CASE_MODELS.has(params.model ?? '') && params.action === 'create' && params.args?.data) {
    const data = params.args.data;
    const explicitId = typeof data.treatmentCaseId === 'string' ? data.treatmentCaseId : null;
    if ('treatmentCaseId' in data) delete data.treatmentCaseId;

    const patientId = typeof data.patientId === 'string' ? data.patientId : null;
    const clinicId = typeof data.clinicId === 'string' ? data.clinicId : null;
    const caseId = await resolveCaseForWrite(patientId, clinicId, explicitId);
    const result = await next(params);

    if (caseId && result?.id) {
      const table = {
        Appointment: 'appointments',
        Visit: 'visits',
        TreatmentPlan: 'treatment_plans',
        Referral: 'referrals',
        LabOrder: 'lab_orders',
        Invoice: 'invoices',
      }[params.model!];
      if (table) {
        await prisma.$executeRawUnsafe(
          `UPDATE "${table}" SET "treatmentCaseId" = $1 WHERE "id" = $2`,
          caseId,
          result.id,
        );
      }
    }
    return result;
  }

  return next(params);
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
export default prisma;
