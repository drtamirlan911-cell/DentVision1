import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { wipeApplicationData } from '../../prisma/lib/reset-database.js';
import {
  seedDemoEnvironment,
  TEST_USER_PASSWORD,
  TEST_USERS,
  DEMO_CLINIC,
  DEMO_PATIENTS,
} from '../../prisma/lib/seed-test-users.js';

export const adminRouter = Router();

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
