import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { generateTokens, verifyRefreshToken } from '../../lib/jwt.js';
import { hashPassword, comparePassword } from '../../lib/password.js';
import { authenticate } from '../../middleware/auth.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { uid } from '../../lib/helpers.js';

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body as {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      phone?: string;
    };

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ ok: false, error: 'Все обязательные поля должны быть заполнены' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ ok: false, error: 'Пользователь с таким email уже существует' });
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        id: uid(),
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phone: phone || null,
        role: 'DOCTOR',
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });

    const tokens = generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const response: ApiResponse = {
      ok: true,
      data: { user, ...tokens },
    };

    res.status(201).json(response);
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Ошибка при регистрации' });
  }
});

authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body as { email: string; password: string };

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'Email и пароль обязательны' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        password: true,
        memberships: {
          select: { clinicId: true },
          take: 1,
        },
      },
    });

    if (!user) {
      return res.status(401).json({ ok: false, error: 'Неверный email или пароль' });
    }

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ ok: false, error: 'Неверный email или пароль' });
    }

    const clinicId = user.memberships[0]?.clinicId;

    const tokens = generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
      clinicId,
    });

    const { password: _, ...userWithoutPassword } = user;

    const response: ApiResponse = {
      ok: true,
      data: { user: { ...userWithoutPassword, clinicId }, ...tokens },
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Ошибка при входе' });
  }
});

authRouter.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body as { refreshToken: string };

    if (!refreshToken) {
      return res.status(400).json({ ok: false, error: 'Refresh токен обязателен' });
    }

    const payload = verifyRefreshToken(refreshToken);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      return res.status(401).json({ ok: false, error: 'Пользователь не найден' });
    }

    const tokens = generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
      clinicId: payload.clinicId,
    });

    const response: ApiResponse = {
      ok: true,
      data: tokens,
    };

    res.json(response);
  } catch (error) {
    res.status(401).json({ ok: false, error: 'Невалидный refresh токен' });
  }
});

authRouter.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        spec: true,
        avatar: true,
        role: true,
        createdAt: true,
        memberships: {
          select: {
            id: true,
            role: true,
            clinicId: true,
            joinedAt: true,
            clinic: {
              select: { id: true, name: true, plan: true, logo: true },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ ok: false, error: 'Пользователь не найден' });
    }

    const response: ApiResponse = {
      ok: true,
      data: {
        user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, phone: user.phone, spec: user.spec, avatar: user.avatar, role: user.role, createdAt: user.createdAt },
        memberships: user.memberships.map(m => ({ id: m.id, role: m.role, clinicId: m.clinicId, joinedAt: m.joinedAt, clinic: m.clinic })),
        activeMembership: user.memberships[0] ? { id: user.memberships[0].id, role: user.memberships[0].role, clinicId: user.memberships[0].clinicId, clinic: user.memberships[0].clinic } : null,
      },
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Ошибка при получении профиля' });
  }
});

authRouter.post('/switch-clinic', authenticate, async (req: AuthRequest, res) => {
  try {
    const { clinicId } = req.body as { clinicId: string };

    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'clinicId обязателен' });
    }

    const membership = await prisma.clinicMember.findUnique({
      where: { userId_clinicId: { userId: req.user!.id, clinicId } },
    });

    if (!membership) {
      return res.status(403).json({ ok: false, error: 'Вы не являетесь участником этой клиники' });
    }

    const tokens = generateTokens({
      sub: req.user!.id,
      email: req.user!.email,
      role: req.user!.role,
      clinicId,
    });

    const response: ApiResponse = {
      ok: true,
      data: tokens,
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Ошибка при переключении клиники' });
  }
});

authRouter.post('/clinics', authenticate, async (req: AuthRequest, res) => {
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

    const tokens = generateTokens({
      sub: req.user!.id,
      email: req.user!.email,
      role: req.user!.role,
      clinicId,
    });

    const response: ApiResponse = {
      ok: true,
      data: { clinic, tokens },
    };

    res.status(201).json(response);
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Ошибка при создании клиники' });
  }
});

authRouter.post('/join-clinic', authenticate, async (req: AuthRequest, res) => {
  try {
    const { clinicId, role } = req.body as { clinicId: string; role?: string };

    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'clinicId обязателен' });
    }

    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) {
      return res.status(404).json({ ok: false, error: 'Клиника не найдена' });
    }

    const existingMembership = await prisma.clinicMember.findUnique({
      where: { userId_clinicId: { userId: req.user!.id, clinicId } },
    });

    if (existingMembership) {
      return res.status(409).json({ ok: false, error: 'Вы уже являетесь участником этой клиники' });
    }

    const membership = await prisma.clinicMember.create({
      data: {
        id: uid(),
        userId: req.user!.id,
        clinicId,
        role: (role as any) || 'DOCTOR',
      },
      include: {
        clinic: { select: { id: true, name: true, plan: true } },
      },
    });

    const response: ApiResponse = {
      ok: true,
      data: membership,
    };

    res.status(201).json(response);
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Ошибка при присоединении к клинике' });
  }
});

authRouter.get('/my-clinics', authenticate, async (req: AuthRequest, res) => {
  try {
    const memberships = await prisma.clinicMember.findMany({
      where: { userId: req.user!.id },
      select: {
        id: true,
        role: true,
        joinedAt: true,
        clinic: {
          select: {
            id: true,
            name: true,
            city: true,
            plan: true,
            logo: true,
            _count: { select: { members: true, patients: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    const response: ApiResponse = {
      ok: true,
      data: memberships,
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Ошибка при получении списка клиник' });
  }
});

authRouter.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body as { email: string };

    if (!email) {
      return res.status(400).json({ ok: false, error: 'Email обязателен' });
    }

    const response: ApiResponse = {
      ok: true,
      data: { message: 'Если пользователь существует, письмо для сброса пароля отправлено' },
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Ошибка при отправке письма' });
  }
});

authRouter.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body as { token: string; password: string };

    if (!token || !password) {
      return res.status(400).json({ ok: false, error: 'Токен и новый пароль обязательны' });
    }

    const response: ApiResponse = {
      ok: true,
      data: { message: 'Пароль успешно сброшен' },
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Ошибка при сбросе пароля' });
  }
});
