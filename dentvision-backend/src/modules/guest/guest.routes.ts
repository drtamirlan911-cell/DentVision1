// Guest Routes — anonymous sessions (Public-First / Guest Mode)
// POST /api/guest/session → creates a guest user + returns JWT
import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { UserRole } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { generateTokens } from '../../lib/jwt.js';
import { GUEST_AI_LIMIT, guestAiRemaining, isGuestEmail } from '../../lib/guestAiQuota.js';

const GUEST_ROLE = 'STUDENT' as UserRole;
const GUEST_FIRST_NAME = 'Гость';

function looksMojibake(value?: string | null): boolean {
  if (!value) return true;
  return /Р.|Рѕ|С.|Ð.|Ñ./.test(value) || !/[А-Яа-яЁё]/.test(value);
}

function isGuestUser(user: { email: string; role: string }): boolean {
  return isGuestEmail(user.email);
}

export const guestRouter = Router();

guestRouter.post('/session', async (req, res) => {
  try {
    const requestedId = typeof req.body?.guestId === 'string' ? req.body.guestId.trim() : '';
    let guestId = requestedId && /^[0-9a-f-]{36}$/i.test(requestedId)
      ? requestedId
      : crypto.randomUUID();

    const existing = await prisma.user.findUnique({
      where: { id: guestId },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        memberships: { select: { id: true }, take: 1 },
      },
    });

    if (existing) {
      // IDOR guard: never mint a "guest" JWT for a real staff/patient account.
      const hasMembership = (existing.memberships?.length || 0) > 0;
      if (!isGuestUser(existing) || hasMembership) {
        guestId = crypto.randomUUID();
      } else {
        if (looksMojibake(existing.firstName)) {
          await prisma.user.update({
            where: { id: existing.id },
            data: { firstName: GUEST_FIRST_NAME, lastName: '' },
          }).catch(() => null);
        }
        const { accessToken } = generateTokens({
          sub: existing.id,
          email: existing.email,
          role: GUEST_ROLE,
          clinicId: undefined,
          isGuest: true,
        });
        return res.json({
          guestId: existing.id,
          token: accessToken,
          aiRequestsLeft: guestAiRemaining(existing.id),
        });
      }
    }

    const email = `guest_${guestId.replace(/-/g, '').slice(0, 12)}@guest.local`;
    const hashed = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    const user = await prisma.user.create({
      data: {
        id: guestId,
        email,
        password: hashed,
        firstName: GUEST_FIRST_NAME,
        lastName: '',
        role: GUEST_ROLE,
      },
    });

    const { accessToken } = generateTokens({
      sub: user.id,
      email: user.email,
      role: GUEST_ROLE,
      clinicId: undefined,
      isGuest: true,
    });

    res.json({
      guestId: user.id,
      token: accessToken,
      aiRequestsLeft: GUEST_AI_LIMIT,
    });
  } catch (err: any) {
    console.error('[Guest Session] error:', err?.message);
    res.status(500).json({ ok: false, error: 'Не удалось создать гостевую сессию' });
  }
});
