// ═══════════════════════════════════════════════════════════════
// Guest Routes — anonymous sessions (Public-First / Guest Mode)
// POST /api/guest/session → creates a guest user + returns JWT
// ═══════════════════════════════════════════════════════════════
import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { UserRole } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { generateTokens } from '../../lib/jwt.js';

const GUEST_AI_LIMIT = 20;
const GUEST_ROLE = 'STUDENT' as UserRole;

export const guestRouter = Router();

guestRouter.post('/session', async (req, res) => {
  try {
    const guestId = (req.body?.guestId as string) || crypto.randomUUID();

    const existing = await prisma.user.findUnique({ where: { id: guestId } });
    if (existing) {
      const { accessToken } = generateTokens({
        sub: existing.id,
        email: existing.email,
        role: GUEST_ROLE,
        clinicId: undefined,
      });
      return res.json({ guestId: existing.id, token: accessToken, aiRequestsLeft: GUEST_AI_LIMIT });
    }

    const email = `guest_${guestId.slice(0, 8)}@guest.local`;
    const hashed = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    const user = await prisma.user.create({
      data: {
        id: guestId,
        email,
        password: hashed,
        firstName: 'Гость',
        lastName: '',
        role: GUEST_ROLE,
      },
    });

    const { accessToken } = generateTokens({
      sub: user.id,
      email: user.email,
      role: GUEST_ROLE,
      clinicId: undefined,
    });

    res.json({ guestId: user.id, token: accessToken, aiRequestsLeft: GUEST_AI_LIMIT });
  } catch (err: any) {
    console.error('[Guest Session] error:', err?.message);
    res.status(500).json({ ok: false, error: 'Не удалось создать гостевую сессию' });
  }
});
