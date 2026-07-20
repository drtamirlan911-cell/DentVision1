import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { uid, paginate, paginatedResponse } from '../../lib/helpers.js';
import { hashPassword } from '../../lib/password.js';
import {
  canManageClinicSettings,
  mergeClinicSettings,
  type ClinicSettingsPayload,
} from './clinicSettings.js';

export const clinicsRouter = Router();

function normalizeStaffRole(role?: string): 'OWNER' | 'ADMIN' | 'DOCTOR' | 'ASSISTANT' | 'MANAGER' | 'LAB' | 'STUDENT' {
  const raw = String(role || 'DOCTOR').toLowerCase();
  if (raw === 'owner' || raw === 'director') return 'OWNER';
  if (raw === 'admin' || raw === 'cashier') return 'ADMIN';
  if (raw === 'assistant') return 'ASSISTANT';
  if (raw === 'manager') return 'MANAGER';
  if (raw === 'lab' || raw === 'laboratory') return 'LAB';
  if (raw === 'student' || raw === 'intern') return 'STUDENT';
  return 'DOCTOR';
}

async function assertCanManageStaff(userId: string, clinicId: string) {
  const membership = await prisma.clinicMember.findUnique({
    where: { userId_clinicId: { userId, clinicId } },
  });
  if (!membership) return { ok: false as const, status: 403, error: 'Вы не являетесь участником этой клиники' };
  if (!['OWNER', 'ADMIN'].includes(membership.role)) {
    return { ok: false as const, status: 403, error: 'Недостаточно прав для управления сотрудниками' };
  }
  return { ok: true as const, membership };
}

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

/** Create or attach a staff member to the clinic (manual add). */
clinicsRouter.post('/:id/staff', authenticate, async (req: AuthRequest, res) => {
  try {
    const clinicId = req.params.id as string;
    const gate = await assertCanManageStaff(req.user!.id, clinicId);
    if (!gate.ok) return res.status(gate.status).json({ ok: false, error: gate.error });

    const body = req.body || {};
    const email = String(body.email || body.login || '').trim().toLowerCase();
    const password = String(body.password || '');
    const role = normalizeStaffRole(body.role);
    const rawName = String(body.name || '').trim();
    const parts = rawName.split(/\s+/).filter(Boolean);
    const firstName = String(body.firstName || parts[0] || 'Сотрудник').trim();
    const lastName = String(body.lastName || parts.slice(1).join(' ') || '').trim();
    const phone = body.phone ? String(body.phone) : null;
    const spec = body.spec ? String(body.spec) : null;

    if (!email) {
      return res.status(400).json({ ok: false, error: 'Email или логин обязателен' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ ok: false, error: 'Пароль не менее 6 символов' });
    }

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: uid(),
          email,
          password: await hashPassword(password),
          firstName,
          lastName,
          phone,
          spec,
          role,
        },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          firstName: firstName || user.firstName,
          lastName: lastName || user.lastName,
          phone: phone ?? user.phone,
          spec: spec ?? user.spec,
        },
      });
    }

    const existing = await prisma.clinicMember.findUnique({
      where: { userId_clinicId: { userId: user.id, clinicId } },
    });
    if (existing) {
      return res.status(409).json({ ok: false, error: 'Сотрудник уже в этой клинике' });
    }

    const member = await prisma.clinicMember.create({
      data: {
        id: uid(),
        userId: user.id,
        clinicId,
        role,
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, spec: true, avatar: true } },
      },
    });

    return res.status(201).json({ ok: true, data: member });
  } catch (error) {
    console.error('[Clinics] create staff', error);
    return res.status(500).json({ ok: false, error: 'Не удалось добавить сотрудника' });
  }
});

/** Update staff profile / role within clinic. */
clinicsRouter.patch('/:id/staff/:userId', authenticate, async (req: AuthRequest, res) => {
  try {
    const clinicId = req.params.id as string;
    const userId = req.params.userId as string;
    const gate = await assertCanManageStaff(req.user!.id, clinicId);
    if (!gate.ok) return res.status(gate.status).json({ ok: false, error: gate.error });

    const member = await prisma.clinicMember.findUnique({
      where: { userId_clinicId: { userId, clinicId } },
    });
    if (!member) {
      return res.status(404).json({ ok: false, error: 'Сотрудник не найден в клинике' });
    }

    const body = req.body || {};
    const rawName = body.name != null ? String(body.name).trim() : '';
    const parts = rawName.split(/\s+/).filter(Boolean);
    const firstName = body.firstName != null ? String(body.firstName) : parts[0];
    const lastName = body.lastName != null ? String(body.lastName) : (parts.length ? parts.slice(1).join(' ') : undefined);

    const userData: Record<string, unknown> = {};
    if (firstName !== undefined) userData.firstName = firstName;
    if (lastName !== undefined) userData.lastName = lastName;
    if (body.phone !== undefined) userData.phone = body.phone || null;
    if (body.spec !== undefined) userData.spec = body.spec || null;
    if (body.password && String(body.password).length >= 6) {
      userData.password = await hashPassword(String(body.password));
    }

    if (Object.keys(userData).length) {
      await prisma.user.update({ where: { id: userId }, data: userData as any });
    }

    let role = member.role;
    if (body.role != null) {
      role = normalizeStaffRole(body.role);
      await prisma.clinicMember.update({
        where: { userId_clinicId: { userId, clinicId } },
        data: { role },
      });
    }

    const updated = await prisma.clinicMember.findUnique({
      where: { userId_clinicId: { userId, clinicId } },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, spec: true, avatar: true } },
      },
    });

    return res.json({ ok: true, data: updated });
  } catch (error) {
    console.error('[Clinics] update staff', error);
    return res.status(500).json({ ok: false, error: 'Не удалось обновить сотрудника' });
  }
});
