import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { getOrCreateWallet } from '../finance/finance.service.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';

// Ecosystem analytics (Phase 7, §7.3). Platform-wide aggregates across all
// domains for the SUPERADMIN/analytics dashboard.
export const ecosystemRouter = Router();

ecosystemRouter.use(authenticate);

ecosystemRouter.get('/ecosystem', requirePermission('platform.analytics'), async (_req: AuthRequest, res) => {
  try {
    const [
      clinics, users, patients, suppliers, verifiedSuppliers, academies, lecturers, courses, products,
      saleAgg,
    ] = await Promise.all([
      prisma.clinic.count(),
      prisma.user.count(),
      prisma.patient.count(),
      prisma.supplier.count(),
      prisma.supplier.count({ where: { status: { in: ['VERIFIED', 'OFFICIAL_PARTNER'] } } }),
      prisma.academy.count(),
      prisma.lecturer.count(),
      prisma.course.count(),
      prisma.product.count(),
      prisma.transaction.aggregate({ where: { type: 'sale' }, _sum: { amount: true }, _count: true }),
    ]);

    const platformWallet = await getOrCreateWallet('PLATFORM', 'system');

    return res.json({
      ok: true,
      data: {
        clinics,
        users,
        patients,
        suppliers,
        verifiedSuppliers,
        academies,
        lecturers,
        courses,
        products,
        salesCount: saleAgg._count,
        gmvMinor: (saleAgg._sum.amount ?? 0n).toString(),
        platformRevenueMinor: platformWallet.balance.toString(),
        currency: 'KZT',
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('Ecosystem analytics error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при получении аналитики' } satisfies ApiResponse);
  }
});

export default ecosystemRouter;
