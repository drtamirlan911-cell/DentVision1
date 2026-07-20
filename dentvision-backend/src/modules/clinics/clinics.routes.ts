import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { uid, paginate, paginatedResponse } from '../../lib/helpers.js';
import {
  canManageClinicSettings,
  mergeClinicSettings,
  type ClinicSettingsPayload,
} from './clinicSettings.js';

export const clinicsRouter = Router();

const clinicPublicSelect = {
  id: true,
  name: true,
  city: true,
  address: true,
  phone: true,
  logo: true,
  plan: true,
  settings: true,
  createdAt: true,
} as const;

clinicsRouter.get('/', authenticate, async (req, res) => {
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

clinicsRouter.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const clinic = await prisma.clinic.findUnique({
      where: { id },
      select: {
        ...clinicPublicSelect,
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
      data: {
        ...clinic,
        settings: mergeClinicSettings(clinic.settings),
      },
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
    const { name, city, address, phone, logo, settings } = req.body as {
      name?: string;
      city?: string;
      address?: string;
      phone?: string;
      logo?: string;
      settings?: ClinicSettingsPayload;
    };

    const membership = await prisma.clinicMember.findUnique({
      where: { userId_clinicId: { userId: req.user!.id, clinicId: id } },
    });

    if (!membership) {
      return res.status(403).json({ ok: false, error: 'Вы не являетесь участником этой клиники' });
    }

    // Clinic profile + settings: only Руководитель (OWNER) and Администратор (ADMIN)
    if (!canManageClinicSettings(membership.role)) {
      return res.status(403).json({
        ok: false,
        error: 'Настройки клиники доступны только Руководителю и Администратору',
      });
    }

    const existing = await prisma.clinic.findUnique({ where: { id }, select: { settings: true } });
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Клиника не найдена' });
    }

    const nextSettings =
      settings !== undefined
        ? mergeClinicSettings({ ...mergeClinicSettings(existing.settings), ...settings })
        : undefined;

    const clinic = await prisma.clinic.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(city !== undefined && { city: city || null }),
        ...(address !== undefined && { address: address || null }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(logo !== undefined && { logo: logo || null }),
        ...(nextSettings !== undefined && { settings: nextSettings as any }),
      },
    });

    const response: ApiResponse = {
      ok: true,
      data: {
        ...clinic,
        settings: mergeClinicSettings(clinic.settings),
      },
    };

    res.json(response);
  } catch (error) {
    console.error('[Clinics] patch', error);
    res.status(500).json({ ok: false, error: 'Ошибка при обновлении клиники' });
  }
});

/** Dedicated settings endpoint (same ACL). */
clinicsRouter.get('/:id/settings', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const membership = await prisma.clinicMember.findUnique({
      where: { userId_clinicId: { userId: req.user!.id, clinicId: id } },
    });
    if (!membership) {
      return res.status(403).json({ ok: false, error: 'Вы не являетесь участником этой клиники' });
    }
    if (!canManageClinicSettings(membership.role)) {
      return res.status(403).json({
        ok: false,
        error: 'Настройки клиники доступны только Руководителю и Администратору',
      });
    }

    const clinic = await prisma.clinic.findUnique({
      where: { id },
      select: clinicPublicSelect,
    });
    if (!clinic) {
      return res.status(404).json({ ok: false, error: 'Клиника не найдена' });
    }

    return res.json({
      ok: true,
      data: {
        clinic: {
          id: clinic.id,
          name: clinic.name,
          city: clinic.city,
          address: clinic.address,
          phone: clinic.phone,
          logo: clinic.logo,
          plan: clinic.plan,
        },
        settings: mergeClinicSettings(clinic.settings),
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[Clinics] get settings', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить настройки' } satisfies ApiResponse);
  }
});

clinicsRouter.put('/:id/settings', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const membership = await prisma.clinicMember.findUnique({
      where: { userId_clinicId: { userId: req.user!.id, clinicId: id } },
    });
    if (!membership) {
      return res.status(403).json({ ok: false, error: 'Вы не являетесь участником этой клиники' });
    }
    if (!canManageClinicSettings(membership.role)) {
      return res.status(403).json({
        ok: false,
        error: 'Настройки клиники доступны только Руководителю и Администратору',
      });
    }

    const existing = await prisma.clinic.findUnique({ where: { id }, select: { settings: true } });
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Клиника не найдена' });
    }

    const body = (req.body || {}) as ClinicSettingsPayload;
    const nextSettings = mergeClinicSettings({ ...mergeClinicSettings(existing.settings), ...body });

    const clinic = await prisma.clinic.update({
      where: { id },
      data: { settings: nextSettings as any },
      select: clinicPublicSelect,
    });

    return res.json({
      ok: true,
      data: {
        clinic: {
          id: clinic.id,
          name: clinic.name,
          city: clinic.city,
          address: clinic.address,
          phone: clinic.phone,
          logo: clinic.logo,
          plan: clinic.plan,
        },
        settings: mergeClinicSettings(clinic.settings),
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[Clinics] put settings', error);
    return res.status(500).json({ ok: false, error: 'Не удалось сохранить настройки' } satisfies ApiResponse);
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

    if (!['OWNER', 'ADMIN'].includes(membership.role)) {
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
