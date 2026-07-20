import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { wipeApplicationData } from '../../prisma/lib/reset-database.js';
import { seedTestUsersOnly, TEST_USER_PASSWORD, TEST_USERS } from '../../prisma/lib/seed-test-users.js';

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

/** POST /api/admin/reset-demo — wipe DB, leave only canonical test users */
adminRouter.post('/reset-demo', async (req, res) => {
  if (!checkSeedSecret(req, res)) return;

  try {
    await wipeApplicationData(prisma);
    const users = await seedTestUsersOnly(prisma);

    res.json({
      ok: true,
      message: 'Database reset. Test users only — no clinics or patient data.',
      password: TEST_USER_PASSWORD,
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
    note: 'No clinics until a user creates or joins one in the app.',
    accounts: TEST_USERS.map((u) => ({
      email: u.email,
      role: u.role,
      name: `${u.firstName} ${u.lastName}`,
    })),
  });
});
