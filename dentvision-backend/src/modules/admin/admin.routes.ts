import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { wipeApplicationData } from '../../../prisma/lib/reset-database.js';
import {
  seedDemoEnvironment,
  TEST_USER_PASSWORD,
  TEST_USERS,
  DEMO_CLINIC,
  DEMO_PATIENTS,
} from '../../../prisma/lib/seed-test-users.js';
import { authenticate } from '../../middleware/auth.js';
import { requireSuperadmin } from '../../middleware/rbac.js';
import { hashPassword } from '../../lib/password.js';
import { uid } from '../../lib/helpers.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import type { ClinicPlan } from '@prisma/client';

export const adminRouter = Router();

function randomTempPassword(): string {
  return uid().replace(/-/g, '').slice(0, 10);
}

function serializeUser(u: {
  id: string; email: string; firstName: string; lastName: string; role: string; createdAt: Date;
  memberships?: Array<{ clinicId: string }>;
}) {
  return {
    id: u.id,
    name: `${u.firstName} ${u.lastName}`.trim(),
    login: u.email,
    email: u.email,
    role: u.role,
    platformRole: u.role,
    clinicId: u.memberships?.[0]?.clinicId || null,
    createdAt: u.createdAt,
  };
}

function checkSeedSecret(req: { headers: Record<string, string | string[] | undefined> }, res: { status: (n: number) => { json: (b: unknown) => void } }) {
  const secret = process.env.SEED_SECRET;
  if (!secret || secret.length < 16) {
    res.status(503).json({
      ok: false,
      error: 'SEED_SECRET not configured on server (min 16 chars in Render env)',
    });
    return false;
  }
  const provided = String(req.headers['x-seed-secret'] || req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (provided !== secret) {
    res.status(403).json({ ok: false, error: 'Invalid seed secret' });
    return false;
  }
  return true;
}

/** POST /api/admin/reset-demo — wipe DB, seed test users + one demo clinic + patients */
adminRouter.post('/reset-demo', async (req, res) => {
  if (!checkSeedSecret(req, res)) return;

  try {
    await wipeApplicationData(prisma);
    const { users, clinic, patients } = await seedDemoEnvironment(prisma);

    res.json({
      ok: true,
      message: 'Database reset. Test users, one demo clinic, and sample patients.',
      password: TEST_USER_PASSWORD,
      clinic: { id: clinic.id, name: clinic.name, city: clinic.city },
      patientCount: patients.length,
      patients: patients.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}`, phone: p.phone })),
      users: users.map((u) => ({ email: u.email, role: u.role })),
      accounts: TEST_USERS.map((u) => ({ email: u.email, role: u.role })),
    });
  } catch (e) {
    console.error('[admin/reset-demo]', e);
    res.status(500).json({ ok: false, error: 'Reset failed' });
  }
});

adminRouter.get('/test-accounts', (_req, res) => {
  res.json({
    ok: true,
    password: TEST_USER_PASSWORD,
    clinic: DEMO_CLINIC,
    patients: DEMO_PATIENTS.map((p) => `${p.firstName} ${p.lastName}`),
    note: 'Login as owner@dentvision.kz — demo clinic is already attached.',
    accounts: TEST_USERS.map((u) => ({
      email: u.email,
      role: u.role,
      name: `${u.firstName} ${u.lastName}`,
    })),
  });
});

// ─── Platform administration (SuperAdmin panel) ─────────────────────────
// Requires SUPERADMIN. Note: the schema has no clinic "active"/subscription
// model yet, so block/unblock and subscription extension intentionally
// return 501 instead of silently no-op'ing or requiring a risky migration.

adminRouter.get('/stats', authenticate, requireSuperadmin, async (_req: AuthRequest, res) => {
  try {
    const [totalClinics, totalUsers] = await Promise.all([
      prisma.clinic.count(),
      prisma.user.count(),
    ]);

    res.json({
      ok: true,
      data: {
        totalClinics,
        activeClinics: totalClinics,
        blockedClinics: 0,
        expiringSoon: 0,
        totalUsers,
        mrr: 0,
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[admin/stats]', error);
    res.status(500).json({ ok: false, error: 'Failed to load platform stats' });
  }
});

adminRouter.get('/clinics', authenticate, requireSuperadmin, async (_req: AuthRequest, res) => {
  try {
    const clinics = await prisma.clinic.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { members: true, patients: true } } },
    });

    res.json({
      ok: true,
      data: clinics.map((c) => ({
        id: c.id,
        name: c.name,
        city: c.city,
        address: c.address,
        phone: c.phone,
        email: null,
        plan: c.plan.toLowerCase(),
        active: true,
        subscription: null,
        _count: { memberships: c._count.members, patients: c._count.patients },
        createdAt: c.createdAt,
      })),
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[admin/clinics]', error);
    res.status(500).json({ ok: false, error: 'Failed to load clinics' });
  }
});

adminRouter.post('/clinics', authenticate, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { name, city, phone, address, plan } = req.body as {
      name: string; city?: string; phone?: string; address?: string; plan?: string;
    };
    if (!name?.trim()) {
      return res.status(400).json({ ok: false, error: 'Название клиники обязательно' } satisfies ApiResponse);
    }

    const clinicId = uid();
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 12) || 'clinic';
    const directorEmail = `admin_${slug}_${clinicId.slice(0, 6)}@dentvision.local`;
    const tempPassword = randomTempPassword();

    const [clinic, director] = await prisma.$transaction([
      prisma.clinic.create({
        data: {
          id: clinicId,
          name: name.trim(),
          city: city || null,
          address: address || null,
          phone: phone || null,
          plan: ((plan || 'starter').toUpperCase() === 'STARTER' ? 'STANDARD' : (plan || 'STANDARD').toUpperCase()) as ClinicPlan,
        },
      }),
      prisma.user.create({
        data: {
          id: uid(),
          email: directorEmail,
          password: await hashPassword(tempPassword),
          firstName: 'Директор',
          lastName: name.trim(),
          role: 'OWNER',
        },
      }),
    ]);

    await prisma.clinicMember.create({
      data: { id: uid(), userId: director.id, clinicId: clinic.id, role: 'OWNER' },
    });

    res.status(201).json({
      ok: true,
      data: { ...clinic, directorLogin: directorEmail, tempPassword },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[admin/clinics create]', error);
    res.status(500).json({ ok: false, error: 'Failed to create clinic' });
  }
});

adminRouter.put('/clinics/:id', authenticate, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const { name, city, phone, address } = req.body as {
      name?: string; city?: string; phone?: string; address?: string;
    };

    const clinic = await prisma.clinic.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(city !== undefined && { city: city || null }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(address !== undefined && { address: address || null }),
      },
    });

    res.json({ ok: true, data: clinic } satisfies ApiResponse);
  } catch (error) {
    console.error('[admin/clinics update]', error);
    res.status(500).json({ ok: false, error: 'Failed to update clinic' });
  }
});

adminRouter.delete('/clinics/:id', authenticate, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    await prisma.clinic.delete({ where: { id } });
    res.json({ ok: true, data: { deleted: true } } satisfies ApiResponse);
  } catch (error) {
    console.error('[admin/clinics delete]', error);
    res.status(500).json({ ok: false, error: 'Failed to delete clinic' });
  }
});

adminRouter.patch('/clinics/:id/toggle', authenticate, requireSuperadmin, async (_req: AuthRequest, res) => {
  res.status(501).json({
    ok: false,
    error: 'Блокировка клиник появится после расширения схемы БД (нужна колонка active)',
  } satisfies ApiResponse);
});

adminRouter.patch('/clinics/:id/plan', authenticate, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const { plan } = req.body as { plan: string };
    const normalized = (plan === 'starter' ? 'STANDARD' : plan).toUpperCase() as ClinicPlan;

    const clinic = await prisma.clinic.update({ where: { id }, data: { plan: normalized } });
    res.json({ ok: true, data: clinic } satisfies ApiResponse);
  } catch (error) {
    console.error('[admin/clinics plan]', error);
    res.status(500).json({ ok: false, error: 'Failed to change plan' });
  }
});

adminRouter.patch('/clinics/:id/extend', authenticate, requireSuperadmin, async (_req: AuthRequest, res) => {
  res.status(501).json({
    ok: false,
    error: 'Продление подписки появится после расширения схемы БД (нужна модель Subscription)',
  } satisfies ApiResponse);
});

adminRouter.get('/users', authenticate, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { clinicId } = req.query as { clinicId?: string };
    const users = await prisma.user.findMany({
      where: {
        role: { not: 'SUPERADMIN' },
        ...(clinicId && { memberships: { some: { clinicId } } }),
      },
      include: { memberships: { select: { clinicId: true }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ ok: true, data: users.map(serializeUser) } satisfies ApiResponse);
  } catch (error) {
    console.error('[admin/users]', error);
    res.status(500).json({ ok: false, error: 'Failed to load users' });
  }
});

adminRouter.post('/users', authenticate, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { login, email, name, role, clinicId, password } = req.body as {
      login: string; email?: string; name: string; role?: string; clinicId?: string; password?: string;
    };
    if (!login?.trim() || !name?.trim()) {
      return res.status(400).json({ ok: false, error: 'Логин и имя обязательны' } satisfies ApiResponse);
    }

    const [firstName, ...rest] = name.trim().split(' ');
    const tempPassword = password || randomTempPassword();
    const resolvedEmail = email?.trim() || (login.includes('@') ? login.trim() : `${login.trim()}@dentvision.local`);

    const user = await prisma.user.create({
      data: {
        id: uid(),
        email: resolvedEmail,
        password: await hashPassword(tempPassword),
        firstName: firstName || name.trim(),
        lastName: rest.join(' ') || '',
        role: (role || 'DOCTOR').toUpperCase() as never,
      },
    });

    if (clinicId) {
      await prisma.clinicMember.create({
        data: { id: uid(), userId: user.id, clinicId, role: (role || 'DOCTOR').toUpperCase() as never },
      }).catch((e) => console.warn('[admin/users create] membership skipped:', e?.message));
    }

    res.status(201).json({ ok: true, data: { ...serializeUser(user), tempPassword } } satisfies ApiResponse);
  } catch (error) {
    console.error('[admin/users create]', error);
    res.status(500).json({ ok: false, error: 'Failed to create user' });
  }
});

adminRouter.patch('/users/:id/password', authenticate, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const { password } = req.body as { password: string };
    if (!password || password.length < 6) {
      return res.status(400).json({ ok: false, error: 'Пароль должен быть не короче 6 символов' } satisfies ApiResponse);
    }

    await prisma.user.update({ where: { id }, data: { password: await hashPassword(password) } });
    res.json({ ok: true, data: { reset: true } } satisfies ApiResponse);
  } catch (error) {
    console.error('[admin/users password]', error);
    res.status(500).json({ ok: false, error: 'Failed to reset password' });
  }
});

adminRouter.delete('/users/:id', authenticate, requireSuperadmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    await prisma.user.delete({ where: { id } });
    res.json({ ok: true, data: { deleted: true } } satisfies ApiResponse);
  } catch (error) {
    console.error('[admin/users delete]', error);
    res.status(500).json({ ok: false, error: 'Failed to delete user' });
  }
});

// Support/assistant accounts: no dedicated platform role exists yet in the
// UserRole enum, so this is a read-only placeholder rather than a route that
// silently fails to persist a role the schema cannot represent.
adminRouter.get('/support', authenticate, requireSuperadmin, async (_req: AuthRequest, res) => {
  res.json({ ok: true, data: [] } satisfies ApiResponse);
});

adminRouter.post('/support', authenticate, requireSuperadmin, async (_req: AuthRequest, res) => {
  res.status(501).json({
    ok: false,
    error: 'Роль ассистента поддержки появится после расширения enum UserRole',
  } satisfies ApiResponse);
});

adminRouter.delete('/support/:id', authenticate, requireSuperadmin, async (_req: AuthRequest, res) => {
  res.status(501).json({ ok: false, error: 'Недоступно' } satisfies ApiResponse);
});
