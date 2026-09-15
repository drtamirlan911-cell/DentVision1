import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';

export const authMeRouter = Router();

authMeRouter.get('/me', authenticate, async (req: AuthRequest, res) => {
  const user = req.user!;
  const memberships = await prisma.clinicMember.findMany({
    where: { userId: user.id },
    include: { clinic: { select: { id: true, name: true, city: true, plan: true, logo: true } } },
    orderBy: { joinedAt: 'asc' },
  });
  const activeMembership = memberships[0] || null;

  return res.json({
    ok: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      memberships: memberships.map((membership) => ({
        id: membership.id,
        role: membership.role,
        clinicId: membership.clinicId,
        branchId: membership.branchId,
        joinedAt: membership.joinedAt,
        clinic: membership.clinic,
      })),
      activeMembership: activeMembership
        ? {
            id: activeMembership.id,
            role: activeMembership.role,
            clinicId: activeMembership.clinicId,
            branchId: activeMembership.branchId,
            joinedAt: activeMembership.joinedAt,
            clinic: activeMembership.clinic,
          }
        : null,
    },
  } satisfies ApiResponse);
});

authMeRouter.get('/my-clinics', authenticate, async (req: AuthRequest, res) => {
  const memberships = await prisma.clinicMember.findMany({
    where: { userId: req.user!.id },
    include: { clinic: { select: { id: true, name: true, city: true, plan: true, logo: true } } },
    orderBy: { joinedAt: 'asc' },
  });

  return res.json({
    ok: true,
    data: memberships.map((membership) => ({
      ...membership.clinic,
      membershipId: membership.id,
      role: membership.role,
      clinicId: membership.clinicId,
      branchId: membership.branchId,
      joinedAt: membership.joinedAt,
    })),
  } satisfies ApiResponse);
});
