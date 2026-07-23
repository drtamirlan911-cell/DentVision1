import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import prisma from '../../lib/prisma.js';

const compatRouter = Router();

async function writeAuditLog(
  clinicId: string | undefined,
  userId: string,
  userName: string,
  action: string,
  entityType: string,
  entityId: string | null | undefined,
  details: Record<string, unknown> | undefined,
) {
  try {
    await prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        clinicId: clinicId ?? null,
        userId,
        userName,
        action,
        entityType,
        entityId: entityId ?? null,
        details: details ? JSON.stringify(details) : null,
      },
    });
  } catch (e) {
    console.error('[Compat] Audit log write failed:', (e as Error).message);
  }
}

// Legacy medical routes: /api/icd10, /api/visits, /api/medical-cards, /api/documents
// @ts-expect-error - no types for legacy JS module
const { default: createMedicalRoutes } = await import('../../../server/routes/medical.js');
compatRouter.use('/', createMedicalRoutes(writeAuditLog));

// Legacy service access CRUD: /api/service-access/*
// @ts-expect-error - no types for legacy JS module
const { default: createServiceAccessRoutes } = await import('../../../server/routes/serviceAccess.js');
compatRouter.use('/service-access', createServiceAccessRoutes());

// Legacy treatment plans: /api/crm/:clinicId/treatment-plans, /api/crm/treatment-plans
// @ts-expect-error - no types for legacy JS module
const { default: createTreatmentPlanRoutes } = await import('../../../server/routes/treatmentPlans.js');
compatRouter.use('/crm', createTreatmentPlanRoutes());

// Legacy clinic data routes: /api/clinic/*
// @ts-expect-error - no types for legacy JS module
const { default: createClinicRoutes } = await import('../../../server/routes/clinic.js');
compatRouter.use('/clinic', createClinicRoutes(writeAuditLog));

// Bridge: service-access public endpoint (no auth)
compatRouter.get('/service-access/public/:clinicId', async (req: Request, res: Response) => {
  try {
    const clinicId = String(req.params.clinicId);
    const access = await prisma.serviceAccess.findMany({ where: { clinicId } });
    const ALL_SERVICES = ['crm', 'shop', 'school', 'ai', 'analytics', 'settings'];
    const map: Record<string, boolean> = {};
    for (const svc of ALL_SERVICES) {
      const found = access.find((a: { service: string; enabled: boolean }) => a.service === svc);
      map[svc] = found ? found.enabled : true;
    }
    res.json(map);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default compatRouter;
