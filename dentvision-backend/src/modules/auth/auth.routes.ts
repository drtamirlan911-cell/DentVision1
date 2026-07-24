import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { generateTokens, verifyRefreshToken } from '../../lib/jwt.js';
import { hashPassword, comparePassword, assertPasswordPolicy } from '../../lib/password.js';
import { authenticate } from '../../middleware/auth.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { uid } from '../../lib/helpers.js';
import { createSession } from '../compliance/session.service.js';
import { checkLoginAttempts, recordFailedAttempt, resetAttempts } from '../../lib/loginGuard.js';
import crypto from 'node:crypto';
import { setCsrfCookie } from '../../middleware/csrf.js';

function setAuthCookies(res: any, accessToken: string, refreshToken: string) {
  res.cookie('accessToken', accessToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  });
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
  setCsrfCookie(res);
}

function clearAuthCookies(res: any) {
  res.clearCookie('accessToken', { path: '/', secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' });
  res.clearCookie('refreshToken', { path: '/', secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' });
}

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

    const passwordError = assertPasswordPolicy(password);
    if (passwordError) {
      return res.status(400).json({ ok: false, error: passwordError });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!normalizedEmail.includes('@') || normalizedEmail.endsWith('@guest.local')) {
      return res.status(400).json({ ok: false, error: 'Некорректный email' });
    }

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(409).json({ ok: false, error: 'Если указанный email зарегистрирован, вы получите письмо' });
    }

    const hashedPassword = await hashPassword(password);

    // Open registration never grants clinical DOCTOR — join/create clinic upgrades role.
    const user = await prisma.user.create({
      data: {
        id: uid(),
        email: normalizedEmail,
        password: hashedPassword,
        firstName: String(firstName).trim(),
        lastName: String(lastName).trim(),
        phone: phone || null,
        role: 'STUDENT',
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });

    const tokens = generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    createSession(user.id, req.ip, req.headers['user-agent']).catch((e) =>
      console.warn('[auth/register] createSession failed:', e?.message),
    );

    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

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

    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    const { allowed, remainingAttempts, lockoutMinutes } = await checkLoginAttempts(email, ip);
    if (!allowed) {
      return res.status(429).json({
        ok: false,
        error: `Слишком много попыток входа. Повторите через ${lockoutMinutes} мин.`,
        remainingAttempts: 0,
        lockoutMinutes,
      });
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
          select: {
            id: true,
            role: true,
            clinicId: true,
            joinedAt: true,
            clinic: {
              select: { id: true, name: true, city: true, plan: true, logo: true },
            },
          },
        },
      },
    });

    if (!user) {
      await recordFailedAttempt(email, ip);
      return res.status(401).json({ ok: false, error: 'Неверный email или пароль' });
    }

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      await recordFailedAttempt(email, ip);
      const { remainingAttempts: remaining } = await checkLoginAttempts(email, ip);
      return res.status(401).json({ ok: false, error: 'Неверный email или пароль', remainingAttempts: remaining });
    }

    await resetAttempts(email, ip);

    const clinicId = user.memberships[0]?.clinicId;
    const activeMembership = user.memberships[0]
      ? {
          id: user.memberships[0].id,
          role: user.memberships[0].role,
          clinicId: user.memberships[0].clinicId,
          joinedAt: user.memberships[0].joinedAt,
          clinic: user.memberships[0].clinic,
        }
      : null;

    const tokens = generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
      clinicId,
    });

    const { password: _, memberships, ...userWithoutPassword } = user;

    // Record login session
    createSession(user.id, req.ip, req.headers['user-agent']).catch((e) =>
      console.warn('[auth/login] createSession failed:', e?.message),
    );

    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    const response: ApiResponse = {
      ok: true,
      data: {
        user: { ...userWithoutPassword, clinicId, name: `${user.firstName} ${user.lastName}`.trim() },
        memberships: memberships.map((m) => ({
          id: m.id,
          role: m.role,
          clinicId: m.clinicId,
          joinedAt: m.joinedAt,
          clinic: m.clinic,
        })),
        activeMembership,
        ...tokens,
      },
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

    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

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
              select: { id: true, name: true, city: true, plan: true, logo: true },
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
      role: membership.role || req.user!.role,
      clinicId,
    });

    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { id: true, name: true, city: true, plan: true, logo: true },
    });

    const activeMembership = {
      id: membership.id,
      role: membership.role,
      clinicId: membership.clinicId,
      joinedAt: membership.joinedAt,
      clinic,
    };

    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    const response: ApiResponse = {
      ok: true,
      data: {
        ...tokens,
        activeMembership,
      },
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
          plan: 'ENTERPRISE',
          active: true,
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

    const { startClinicTrial, notifyClinicOwners, TRIAL_DAYS } = await import(
      '../billing/clinicSubscription.service.js'
    );
    const subscription = await startClinicTrial(clinicId, TRIAL_DAYS);
    await notifyClinicOwners(
      clinicId,
      'Пробный период активирован',
      `Enterprise бесплатно на ${TRIAL_DAYS} дней (до ${subscription.periodEnd?.toISOString().slice(0, 10)}). Выберите тариф в разделе «Тариф и оплата».`,
    );

    const tokens = generateTokens({
      sub: req.user!.id,
      email: req.user!.email,
      role: req.user!.role,
      clinicId,
    });

    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    const response: ApiResponse = {
      ok: true,
      data: { clinic, tokens, subscription },
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('[auth/clinics]', error);
    res.status(500).json({ ok: false, error: 'Ошибка при создании клиники' });
  }
});

// Demo clinic endpoint — creates a temporary demo clinic with rich sample data
authRouter.post('/demo-clinic', authenticate, async (req: AuthRequest, res) => {
  try {
    const clinicId = uid();
    const userId = req.user!.id;

    const [clinic] = await prisma.$transaction([
      prisma.clinic.create({
        data: {
          id: clinicId,
          name: 'Демо-клиника «Дентал Плюс»',
          city: 'Алматы',
          address: 'ул. Абая 150, офис 301',
          phone: '+7 727 123 45 67',
          plan: 'ENTERPRISE',
          active: true,
        },
      }),
      prisma.clinicMember.create({
        data: { id: uid(), userId, clinicId, role: 'OWNER' },
      }),
    ]);

    const { startClinicTrial, TRIAL_DAYS } = await import('../billing/clinicSubscription.service.js');
    await startClinicTrial(clinicId, TRIAL_DAYS);

    const [p1, p2, p3, p4, p5] = await prisma.$transaction([
      prisma.patient.create({
        data: { id: uid(), clinicId, firstName: 'Иван', lastName: 'Иванов', phone: '+7 777 111 22 33', email: 'ivan@example.com', birthDate: new Date('1985-03-15'), gender: 'М', notes: 'Гипертония, осторожно с анестетиками' },
      }),
      prisma.patient.create({
        data: { id: uid(), clinicId, firstName: 'Мария', lastName: 'Петрова', phone: '+7 777 222 33 44', email: 'maria@example.com', birthDate: new Date('1990-07-22'), gender: 'Ж' },
      }),
      prisma.patient.create({
        data: { id: uid(), clinicId, firstName: 'Алексей', lastName: 'Сидоров', phone: '+7 777 333 44 55', email: 'alex@example.com', birthDate: new Date('1978-11-05'), gender: 'М', notes: 'Аллергия на латекс' },
      }),
      prisma.patient.create({
        data: { id: uid(), clinicId, firstName: 'Айнура', lastName: 'Касымова', phone: '+7 701 444 55 66', email: 'ainura@example.com', birthDate: new Date('1995-01-30'), gender: 'Ж' },
      }),
      prisma.patient.create({
        data: { id: uid(), clinicId, firstName: 'Дмитрий', lastName: 'Волков', phone: '+7 702 555 66 77', birthDate: new Date('1972-09-12'), gender: 'М', notes: 'Пациент с сахарным диабетом II типа' },
      }),
    ]);

    const now = Date.now();
    const day = 86400000;

    await prisma.$transaction([
      prisma.appointment.create({
        data: { id: uid(), clinicId, patientId: p1.id, doctorId: userId, date: new Date(now + day), time: '10:00', duration: 30, status: 'confirmed', type: 'Консультация', notes: 'Первичный осмотр, рентген' },
      }),
      prisma.appointment.create({
        data: { id: uid(), clinicId, patientId: p2.id, doctorId: userId, date: new Date(now + day), time: '11:00', duration: 45, status: 'confirmed', type: 'Лечение', notes: 'Лечение кариеса 46 зуба' },
      }),
      prisma.appointment.create({
        data: { id: uid(), clinicId, patientId: p3.id, doctorId: userId, date: new Date(now + 2 * day), time: '14:00', duration: 60, status: 'pending', type: 'Протезирование', notes: 'Снятие слепков' },
      }),
      prisma.appointment.create({
        data: { id: uid(), clinicId, patientId: p4.id, doctorId: userId, date: new Date(now + 3 * day), time: '09:30', duration: 30, status: 'confirmed', type: 'Гигиена', notes: 'Профессиональная чистка' },
      }),
      prisma.appointment.create({
        data: { id: uid(), clinicId, patientId: p5.id, doctorId: userId, date: new Date(now - day), time: '15:00', duration: 45, status: 'completed', type: 'Эндодонтия', notes: 'Пульпит 11 зуба — лечение завершено' },
      }),
      prisma.appointment.create({
        data: { id: uid(), clinicId, patientId: p1.id, doctorId: userId, date: new Date(now - 2 * day), time: '10:30', duration: 30, status: 'completed', type: 'Консультация', notes: 'Первичный осмотр выполнен' },
      }),
    ]);

    await prisma.$transaction([
      prisma.tooth.create({ data: { id: uid(), patientId: p1.id, number: 16, condition: 'healthy', notes: '' } }),
      prisma.tooth.create({ data: { id: uid(), patientId: p1.id, number: 26, condition: 'treated', diagnosis: 'Кариес (лечен)', notes: 'Пломба composite, 2024' } }),
      prisma.tooth.create({ data: { id: uid(), patientId: p1.id, number: 36, condition: 'crown', diagnosis: 'Коронка metallokeramika', notes: 'Установлена 2023' } }),
      prisma.tooth.create({ data: { id: uid(), patientId: p1.id, number: 46, condition: 'caries', diagnosis: 'Кариес средний', notes: 'Требует лечения' } }),
      prisma.tooth.create({ data: { id: uid(), patientId: p1.id, number: 47, condition: 'missing', diagnosis: 'Отсутствует', notes: 'Рекомендован имплантат' } }),

      prisma.tooth.create({ data: { id: uid(), patientId: p2.id, number: 46, condition: 'caries', diagnosis: 'Кариес глубокий', notes: 'Пульпит исключён' } }),
      prisma.tooth.create({ data: { id: uid(), patientId: p2.id, number: 11, condition: 'healthy' } }),
      prisma.tooth.create({ data: { id: uid(), patientId: p2.id, number: 21, condition: 'healthy' } }),
      prisma.tooth.create({ data: { id: uid(), patientId: p2.id, number: 31, condition: 'treated', diagnosis: 'Лечение каналов', notes: '3 канала, 2025' } }),

      prisma.tooth.create({ data: { id: uid(), patientId: p3.id, number: 16, condition: 'crown', diagnosis: 'Коронка', notes: 'Металлокерамика, 2022' } }),
      prisma.tooth.create({ data: { id: uid(), patientId: p3.id, number: 26, condition: 'implant', diagnosis: 'Имплантат', notes: 'Nobel Biocare, 2024' } }),
      prisma.tooth.create({ data: { id: uid(), patientId: p3.id, number: 36, condition: 'bridge', diagnosis: 'Мостовидный протез', notes: '36-37-38' } }),
      prisma.tooth.create({ data: { id: uid(), patientId: p3.id, number: 46, condition: 'caries', diagnosis: 'Кариес', notes: '' } }),
    ]);

    await prisma.$transaction([
      prisma.treatmentPlan.create({
        data: {
          id: uid(), patientId: p1.id, title: 'План лечения — Иванов И.И.', status: 'active', price: 185000,
          items: [
            { tooth: 46, treatment: 'Лечение кариеса', price: 25000, status: 'pending' },
            { tooth: 47, treatment: 'Имплантация + коронка', price: 150000, status: 'planned' },
            { tooth: 26, treatment: 'Наблюдение', price: 10000, status: 'completed' },
          ],
          notes: 'Приоритет: лечение 46, затем имплантация 47',
        },
      }),
      prisma.treatmentPlan.create({
        data: {
          id: uid(), patientId: p2.id, title: 'План лечения — Петрова М.А.', status: 'active', price: 45000,
          items: [
            { tooth: 46, treatment: 'Лечение кариеса + пломба', price: 25000, status: 'in_progress' },
            { tooth: 31, treatment: 'Наблюдение после лечения каналов', price: 5000, status: 'completed' },
            { tooth: null, treatment: 'Процедура отбеливания', price: 35000, status: 'planned' },
          ],
          notes: 'Отбеливание — после лечения 46',
        },
      }),
      prisma.treatmentPlan.create({
        data: {
          id: uid(), patientId: p3.id, title: 'План лечения — Сидоров А.В.', status: 'completed', price: 320000,
          items: [
            { tooth: 26, treatment: 'Имплантация Nobel Biocare', price: 180000, status: 'completed' },
            { tooth: 36, treatment: 'Мостовидный протез', price: 120000, status: 'completed' },
            { tooth: 46, treatment: 'Лечение кариеса', price: 20000, status: 'completed' },
          ],
          notes: 'Все работы выполнены',
        },
      }),
    ]);

    await prisma.$transaction([
      prisma.visit.create({
        data: {
          id: uid(), patientId: p1.id, doctorId: userId, date: new Date(now - 2 * day),
          diagnosis: 'Кариес 46 зуба средний. Отсутствие 47 зуба.',
          complaints: 'Боли от холодного на 46 зуб',
          anamnesis: 'Гипертония, прием лизиноприла. Аллергоанамнез — отрицательный.',
          treatment: [{ tooth: 46, action: 'Осмотр, рентген', notes: 'SOP: постановка диагноза' }],
          notes: 'Рентген 46 — кариес до пульпы. Рекомендовано лечение.',
        },
      }),
      prisma.visit.create({
        data: {
          id: uid(), patientId: p5.id, doctorId: userId, date: new Date(now - day),
          diagnosis: 'Пульпит 11 зуба острый. Диабетическая ангиопатия.',
          complaints: 'Сильная самопроизвольная боль, ночная',
          anamnesis: 'Сахарный диабет II типа, компенсированный. HbA1c — 6.8%.',
          treatment: [{ tooth: 11, action: 'Эндодонтическое лечение', files: 3, notes: 'Orapermc, guttapercha, sealer' }],
          notes: 'Лечение завершено за 1 визит. Контроль через 2 недели.',
        },
      }),
    ]);

    await prisma.$transaction([
      prisma.invoice.create({
        data: {
          id: uid(), clinicId, patientId: p1.id, amount: 26000, status: 'paid',
          items: [{ description: 'Консультация + рентген', amount: 6000 }, { description: 'Приём контрольный', amount: 5000 }, { description: 'Лечение кариеса (предоплата)', amount: 15000 }],
          notes: 'Предоплата за лечение 46', paidAt: new Date(now - 2 * day),
        },
      }),
      prisma.invoice.create({
        data: {
          id: uid(), clinicId, patientId: p2.id, amount: 25000, status: 'unpaid',
          items: [{ description: 'Лечение кариеса 46', amount: 25000 }],
          notes: 'Выставлен после осмотра',
        },
      }),
      prisma.invoice.create({
        data: {
          id: uid(), clinicId, patientId: p3.id, amount: 120000, status: 'paid',
          items: [{ description: 'Мостовидный протез 36-38', amount: 120000 }],
          paidAt: new Date(now - 5 * day),
        },
      }),
      prisma.invoice.create({
        data: {
          id: uid(), clinicId, patientId: p5.id, amount: 45000, status: 'partial',
          items: [{ description: 'Эндодонтическое лечение 11', amount: 45000 }, { description: 'Оплата частями', amount: 25000 }],
          notes: 'Оплачено 25 000 из 45 000', paidAt: new Date(now - day),
        },
      }),
    ]);

    await prisma.$transaction([
      prisma.inventoryItem.create({
        data: { id: uid(), clinicId, name: 'Композит Filtek Z350', category: 'materials', quantity: 20, unit: 'шт', minimum: 5, price: 8500 },
      }),
      prisma.inventoryItem.create({
        data: { id: uid(), clinicId, name: 'Анестетик Убестезин', category: 'medicines', quantity: 50, unit: 'карп', minimum: 10, price: 1200 },
      }),
      prisma.inventoryItem.create({
        data: { id: uid(), clinicId, name: 'Перчатки нитриловые (M)', category: 'consumables', quantity: 200, unit: 'шт', minimum: 50, price: 350 },
      }),
      prisma.inventoryItem.create({
        data: { id: uid(), clinicId, name: 'Ватные шарики 5×5', category: 'consumables', quantity: 150, unit: 'шт', minimum: 100, price: 80 },
      }),
      prisma.inventoryItem.create({
        data: { id: uid(), clinicId, name: 'Наир паста', category: 'medicines', quantity: 3, unit: 'шт', minimum: 2, price: 3200 },
      }),
      prisma.inventoryItem.create({
        data: { id: uid(), clinicId, name: 'Шприцы инъекционные 27G', category: 'consumables', quantity: 80, unit: 'шт', minimum: 30, price: 45 },
      }),
      prisma.inventoryItem.create({
        data: { id: uid(), clinicId, name: 'Гуттаперча ProTaper', category: 'materials', quantity: 15, unit: 'шт', minimum: 5, price: 900 },
      }),
    ]);

    await prisma.$transaction([
      prisma.labOrder.create({
        data: {
          id: uid(), clinicId, patientId: p3.id, labName: 'DentalLab Pro', status: 'completed', type: 'Коронка металлокерамическая',
          notes: 'Зуб 16, оттенок A2', price: 45000, deadline: new Date(now - 3 * day),
        },
      }),
      prisma.labOrder.create({
        data: {
          id: uid(), clinicId, patientId: p1.id, labName: 'Волгоградская лаборатория', status: 'in_progress', type: 'Виниры',
          notes: 'Зубы 11, 21 — композитные виниры', price: 80000, deadline: new Date(now + 7 * day),
        },
      }),
    ]);

    const tokens = generateTokens({
      sub: userId,
      email: req.user!.email,
      role: req.user!.role,
      clinicId,
    });

    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    res.status(201).json({ ok: true, data: { clinic, tokens } });
  } catch (error) {
    console.error('[Demo Clinic Error]', error);
    res.status(500).json({ ok: false, error: 'Ошибка при создании демо-клиники' });
  }
});

authRouter.post('/join-clinic', authenticate, async (req: AuthRequest, res) => {
  try {
    const { clinicId, code } = req.body as { clinicId?: string; role?: string; code?: string };
    let { role } = req.body as { role?: string };

    let targetClinicId = clinicId;

    // If invitation code provided, look up the clinic
    if (code && !targetClinicId) {
      const invitation = await prisma.clinicInvitation.findUnique({
        where: { code },
        select: { clinicId: true, role: true, email: true, expiresAt: true, usedAt: true },
      });
      if (!invitation) {
        return res.status(404).json({ ok: false, error: 'Приглашение не найдено' });
      }
      if (invitation.usedAt) {
        return res.status(409).json({ ok: false, error: 'Приглашение уже использовано' });
      }
      if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
        return res.status(410).json({ ok: false, error: 'Приглашение истекло' });
      }
      if (invitation.email && invitation.email !== req.user!.email) {
        return res.status(403).json({ ok: false, error: 'Приглашение предназначено для другого email' });
      }
      targetClinicId = invitation.clinicId;
      // Use role from invitation if not provided
      if (!role) role = invitation.role;
    }

    // When joining directly by clinicId (no code), never allow elevated roles
    if (!code) {
      const SAFE_ROLES: string[] = ['DOCTOR', 'STAFF', 'ASSISTANT'];
      role = SAFE_ROLES.includes(role || '') ? role : 'DOCTOR';
    }

    if (!targetClinicId) {
      return res.status(400).json({ ok: false, error: 'clinicId или code обязательны' });
    }

    const clinic = await prisma.clinic.findUnique({ where: { id: targetClinicId } });
    if (!clinic) {
      return res.status(404).json({ ok: false, error: 'Клиника не найдена' });
    }

    const existingMembership = await prisma.clinicMember.findUnique({
      where: { userId_clinicId: { userId: req.user!.id, clinicId: targetClinicId } },
    });

    if (existingMembership) {
      return res.status(409).json({ ok: false, error: 'Вы уже являетесь участником этой клиники' });
    }

    const membership = await prisma.clinicMember.create({
      data: {
        id: uid(),
        userId: req.user!.id,
        clinicId: targetClinicId,
        role: (role as any) || 'DOCTOR',
      },
      include: {
        clinic: { select: { id: true, name: true, plan: true } },
      },
    });

    // Mark invitation as used if code was provided
    if (code) {
      await prisma.clinicInvitation.update({
        where: { code },
        data: { usedAt: new Date(), usedBy: req.user!.id },
      });
    }

    const response: ApiResponse = {
      ok: true,
      data: membership,
    };

    res.status(201).json(response);
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Ошибка при присоединении к клинике' });
  }
});

function normalizeInviteRole(role?: string): 'OWNER' | 'ADMIN' | 'DOCTOR' | 'ASSISTANT' | 'MANAGER' | 'LAB' | 'STUDENT' {
  const raw = String(role || 'DOCTOR').toLowerCase();
  if (raw === 'owner' || raw === 'director') return 'OWNER';
  if (raw === 'admin' || raw === 'cashier') return 'ADMIN';
  if (raw === 'assistant') return 'ASSISTANT';
  if (raw === 'manager') return 'MANAGER';
  if (raw === 'lab' || raw === 'laboratory') return 'LAB';
  if (raw === 'student' || raw === 'intern') return 'STUDENT';
  return 'DOCTOR';
}

authRouter.post('/invitations', authenticate, async (req: AuthRequest, res) => {
  try {
    const { clinicId, email, role, expiresInDays } = req.body as { clinicId: string; email?: string; role?: string; expiresInDays?: number };

    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'clinicId обязателен' });
    }

    // Verify user is member of this clinic and can invite (OWNER/ADMIN)
    const membership = await prisma.clinicMember.findUnique({
      where: { userId_clinicId: { userId: req.user!.id, clinicId } },
    });
    if (!membership) {
      return res.status(403).json({ ok: false, error: 'Вы не состоите в этой клинике' });
    }
    if (!['OWNER', 'ADMIN'].includes(membership.role)) {
      return res.status(403).json({ ok: false, error: 'Только руководитель или администратор может приглашать' });
    }

    // Generate unique code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();

    const expiresAt = expiresInDays
      ? new Date(Date.now() + Number(expiresInDays) * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await prisma.clinicInvitation.create({
      data: {
        id: uid(),
        clinicId,
        email: email?.trim() || null,
        role: normalizeInviteRole(role),
        code,
        expiresAt,
      },
      include: { clinic: { select: { id: true, name: true } } },
    });

    const response: ApiResponse = { ok: true, data: invitation };
    res.status(201).json(response);
  } catch (error) {
    console.error('[auth] create invitation', error);
    res.status(500).json({ ok: false, error: 'Ошибка при создании приглашения' });
  }
});

authRouter.get('/invitations/lookup', authenticate, async (req: AuthRequest, res) => {
  try {
    const code = req.query.code as string;
    if (!code) {
      return res.status(400).json({ ok: false, error: 'code обязателен' });
    }

    const invitation = await prisma.clinicInvitation.findUnique({
      where: { code },
      include: { clinic: { select: { id: true, name: true, city: true, address: true } } },
    });

    if (!invitation) {
      return res.status(404).json({ ok: false, error: 'Приглашение не найдено' });
    }

    if (invitation.usedAt) {
      return res.status(409).json({ ok: false, error: 'Приглашение уже использовано' });
    }
    if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
      return res.status(410).json({ ok: false, error: 'Приглашение истекло' });
    }

    const response: ApiResponse = { ok: true, data: invitation };
    res.json(response);
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Ошибка при поиске приглашения' });
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

const resetTokens = new Map<string, { email: string; expiresAt: Date }>();

authRouter.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body as { email: string };

    if (!email) {
      return res.status(400).json({ ok: false, error: 'Email обязателен' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      resetTokens.set(token, { email: normalizedEmail, expiresAt: new Date(Date.now() + 60 * 60 * 1000) });

      // Token logged only in development
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[Password Reset] Token for ${normalizedEmail}: ${token}`);
      }
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

    const entry = resetTokens.get(token);
    if (!entry) {
      return res.status(400).json({ ok: false, error: 'Невалидный или истекший токен' });
    }

    if (entry.expiresAt < new Date()) {
      resetTokens.delete(token);
      return res.status(400).json({ ok: false, error: 'Токен истек' });
    }

    const passwordError = assertPasswordPolicy(password);
    if (passwordError) {
      return res.status(400).json({ ok: false, error: passwordError });
    }

    const hashedPassword = await hashPassword(password);
    await prisma.user.update({
      where: { email: entry.email },
      data: { password: hashedPassword },
    });

    resetTokens.delete(token);

    const response: ApiResponse = {
      ok: true,
      data: { message: 'Пароль успешно сброшен' },
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Ошибка при сбросе пароля' });
  }
});
