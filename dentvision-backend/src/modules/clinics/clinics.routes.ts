import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { uid, paginate, paginatedResponse } from '../../lib/helpers.js';

export const clinicsRouter = Router();

clinicsRouter.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = (req.query.search as string) || '';

    const where = search
      ? { name: { contains: search, mode: 'insensitive' as const } }
      : {};

    const { skip, take } = paginate(page, limit);

    const [data, total] = await Promise.all([
      prisma.clinic.findMany({
        where,
        skip,
        take,
        select: {
          id: true,
          name: true,
          city: true,
          address: true,
          phone: true,
          logo: true,
          plan: true,
          createdAt: true,
          _count: { select: { members: true, patients: true } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.clinic.count({ where }),
    ]);

    const response: ApiResponse = {
      ok: true,
      data: paginatedResponse(data, total, page, limit),
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Ошибка при получении списка клиник' });
  }
});

clinicsRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const clinic = await prisma.clinic.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        city: true,
        address: true,
        phone: true,
        logo: true,
        plan: true,
        createdAt: true,
        members: {
          select: {
            id: true,
            role: true,
            joinedAt: true,
            user: {
              select: { id: true, firstName: true, lastName: true, avatar: true, spec: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
        _count: { select: { patients: true, appointments: true } },
      },
    });

    if (!clinic) {
      return res.status(404).json({ ok: false, error: 'Клиника не найдена' });
    }

    const response: ApiResponse = {
      ok: true,
      data: clinic,
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Ошибка при получении клиники' });
  }
});

clinicsRouter.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { name, city, address, phone } = req.body as {
      name: string;
      city?: string;
      address?: string;
      phone?: string;
    };

    if (!name) {
      return res.status(400).json({ ok: false, error: 'Название клиники обязательно' });
    }

    const clinicId = uid();

    const [clinic] = await prisma.$transaction([
      prisma.clinic.create({
        data: {
          id: clinicId,
          name,
          city: city || null,
          address: address || null,
          phone: phone || null,
        },
      }),
      prisma.clinicMember.create({
        data: {
          id: uid(),
          userId: req.user!.id,
          clinicId,
          role: 'OWNER',
        },
      }),
    ]);

    const response: ApiResponse = {
      ok: true,
      data: clinic,
    };

    res.status(201).json(response);
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Ошибка при создании клиники' });
  }
});

clinicsRouter.patch('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const { name, city, address, phone, logo } = req.body as {
      name?: string;
      city?: string;
      address?: string;
      phone?: string;
      logo?: string;
    };

    const membership = await prisma.clinicMember.findUnique({
      where: { userId_clinicId: { userId: req.user!.id, clinicId: id } },
    });

    if (!membership) {
      return res.status(403).json({ ok: false, error: 'Вы не являетесь участником этой клиники' });
    }

    if (!['OWNER', 'ADMIN', 'MANAGER'].includes(membership.role)) {
      return res.status(403).json({ ok: false, error: 'Недостаточно прав для редактирования клиники' });
    }

    const clinic = await prisma.clinic.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(city !== undefined && { city: city || null }),
        ...(address !== undefined && { address: address || null }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(logo !== undefined && { logo: logo || null }),
      },
    });

    const response: ApiResponse = {
      ok: true,
      data: clinic,
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Ошибка при обновлении клиники' });
  }
});

clinicsRouter.post('/:id/invite', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;

    const membership = await prisma.clinicMember.findUnique({
      where: { userId_clinicId: { userId: req.user!.id, clinicId: id } },
    });

    if (!membership) {
      return res.status(403).json({ ok: false, error: 'Вы не являетесь участником этой клиники' });
    }

    if (!['OWNER', 'ADMIN', 'MANAGER'].includes(membership.role)) {
      return res.status(403).json({ ok: false, error: 'Недостаточно прав для создания приглашений' });
    }

    const code = uid().slice(0, 8).toUpperCase();

    const response: ApiResponse = {
      ok: true,
      data: { code, clinicId: id },
    };

    res.status(201).json(response);
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Ошибка при создании приглашения' });
  }
});
