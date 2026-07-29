// Guest Routes — anonymous sessions (Public-First / Guest Mode)
// POST /api/guest/session → creates a guest user + returns JWT
import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { UserRole } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { generateTokens } from '../../lib/jwt.js';
import { hashPassword, assertPasswordPolicy } from '../../lib/password.js';
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

/** Convert anonymous guest user into a permanent account (same user id). */
guestRouter.post('/convert', async (req, res) => {
  try {
    const guestId = typeof req.body?.guestId === 'string' ? req.body.guestId.trim() : '';
    const loginRaw = String(req.body?.login || req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const nameRaw = String(req.body?.name || '').trim();
    const firstNameIn = String(req.body?.firstName || '').trim();
    const lastNameIn = String(req.body?.lastName || '').trim();

    if (!guestId || !/^[0-9a-f-]{36}$/i.test(guestId)) {
      return res.status(400).json({ ok: false, error: 'Некорректная гостевая сессия' });
    }
    if (!loginRaw.includes('@') || loginRaw.endsWith('@guest.local')) {
      return res.status(400).json({ ok: false, error: 'Укажите корректный email' });
    }
    const passwordError = assertPasswordPolicy(password);
    if (passwordError) {
      return res.status(400).json({ ok: false, error: passwordError });
    }

    const guest = await prisma.user.findUnique({
      where: { id: guestId },
      select: {
        id: true,
        email: true,
        role: true,
        memberships: { select: { id: true }, take: 1 },
      },
    });
    if (!guest || !isGuestUser(guest)) {
      return res.status(404).json({ ok: false, error: 'Гостевая сессия не найдена' });
    }
    if ((guest.memberships?.length || 0) > 0) {
      return res.status(409).json({ ok: false, error: 'Этот аккаунт уже привязан к клинике — войдите' });
    }

    const emailTaken = await prisma.user.findUnique({
      where: { email: loginRaw },
      select: { id: true },
    });
    if (emailTaken && emailTaken.id !== guest.id) {
      return res.status(409).json({ ok: false, error: 'Пользователь с таким email уже существует' });
    }

    const nameParts = nameRaw.split(/\s+/).filter(Boolean);
    const firstName = firstNameIn || nameParts[0] || GUEST_FIRST_NAME;
    const lastName = lastNameIn || nameParts.slice(1).join(' ') || '';
    const hashed = await hashPassword(password);

    const user = await prisma.user.update({
      where: { id: guest.id },
      data: {
        email: loginRaw,
        password: hashed,
        firstName,
        lastName,
        role: 'STUDENT',
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });

    const tokens = generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    res.json({
      ok: true,
      data: {
        user,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });
  } catch (err: any) {
    console.error('[Guest Convert] error:', err?.message);
    res.status(500).json({ ok: false, error: 'Не удалось создать аккаунт' });
  }
});
