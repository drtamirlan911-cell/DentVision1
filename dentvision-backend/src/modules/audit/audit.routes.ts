import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requireMinRole } from '../../middleware/rbac.js';
import type { AuthRequest } from '../../types/index.js';
import type { ApiResponse } from '../../types/index.js';

const auditRouter = Router();

auditRouter.use(authenticate);
auditRouter.use(requireMinRole('ADMIN'));

auditRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    const actionFilter = req.query.action as string | undefined;
    const entityFilter = req.query.entity as string | undefined;

    const where: Record<string, unknown> = {};
    if (req.user!.clinicId) {
      where.clinicId = req.user!.clinicId;
    }
    if (actionFilter) {
      where.action = { contains: actionFilter, mode: 'insensitive' };
    }
    if (entityFilter) {
      where.entity = { contains: entityFilter, mode: 'insensitive' };
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return res.json({
      ok: true,
      data: logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка сервера';
    return res.status(500).json({ ok: false, error: message });
  }
});

auditRouter.post('/backup', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user!.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не определена' });
    }

    const [
      clinic,
      members,
      patients,
      appointments,
      visits,
      teeth,
      treatmentPlans,
      patientImages,
      documents,
      invoices,
      inventory,
      labOrders,
      orders,
      auditLogs,
    ] = await Promise.all([
      prisma.clinic.findUnique({ where: { id: clinicId } }),
      prisma.clinicMember.findMany({ where: { clinicId }, include: { user: true } }),
      prisma.patient.findMany({ where: { clinicId } }),
      prisma.appointment.findMany({ where: { clinicId } }),
      prisma.visit.findMany({ where: { patient: { clinicId } } }),
      prisma.tooth.findMany({ where: { patient: { clinicId } } }),
      prisma.treatmentPlan.findMany({ where: { patient: { clinicId } } }),
      prisma.patientImage.findMany({ where: { patient: { clinicId } } }),
      prisma.document.findMany({ where: { clinicId } }),
      prisma.invoice.findMany({ where: { clinicId } }),
      prisma.inventoryItem.findMany({ where: { clinicId } }),
      prisma.labOrder.findMany({ where: { clinicId } }),
      prisma.order.findMany({ where: { clinicId } }),
      prisma.auditLog.findMany({ where: { clinicId } }),
    ]);

    const backup = {
      exportedAt: new Date().toISOString(),
      clinicId,
      clinic,
      members: members.map((m) => ({
        id: m.id,
        role: m.role,
        joinedAt: m.joinedAt,
        user: {
          id: m.user.id,
          email: m.user.email,
          firstName: m.user.firstName,
          lastName: m.user.lastName,
          role: m.user.role,
          phone: m.user.phone,
          spec: m.user.spec,
        },
      })),
      patients,
      appointments,
      visits,
      teeth,
      treatmentPlans,
      patientImages,
      documents,
      invoices,
      inventory,
      labOrders,
      orders,
      auditLogs,
    };

    await prisma.auditLog.create({
      data: {
        id: (await import('../../lib/helpers.js')).uid(),
        userId: req.user!.id,
        clinicId,
        action: 'BACKUP_CREATED',
        entity: 'clinic',
        entityId: clinicId,
        details: { recordCounts: Object.fromEntries(
          Object.entries(backup).filter(([k]) => k !== 'exportedAt' && k !== 'clinicId' && k !== 'clinic').map(([k, v]) => [k, Array.isArray(v) ? v.length : 1])
        )},
      },
    });

    return res.json({
      ok: true,
      data: backup,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка сервера';
    return res.status(500).json({ ok: false, error: message });
  }
});

export { auditRouter };
