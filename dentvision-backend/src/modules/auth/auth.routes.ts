import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { generateTokens, verifyRefreshToken } from '../../lib/jwt.js';
import { hashPassword, comparePassword, assertPasswordPolicy } from '../../lib/password.js';
import { authenticate } from '../../middleware/auth.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import type { UserRole } from '@prisma/client';
import { uid } from '../../lib/helpers.js';
import { onboardPartner } from '../legal/legal.service.js';
import { syncPersonFromClinicMember } from '../../lib/syncMembership.js';
import { resolveUserPermissions } from '../../lib/resolvePermissions.js';
import { resolveAuthContext } from '../../lib/authContext.js';
import { pagesForCaller, capabilitiesForPermissions } from '../../lib/permissions.js';
import { resolveClinicAccess } from '../../lib/orgContext.js';
import { sendEmail } from '../../services/email.js';
import { buildPasswordResetEmail } from './passwordResetEmail.js';
import {
  GoogleAuthError,
  googleSignInEnabled,
  namesFromProfile,
  verifyGoogleIdToken,
} from './googleAuth.js';

async function ensureOrgAndPerson(clinicId: string, userId: string, role: string) {
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { name: true, city: true } });
  if (!clinic) return;
  await prisma.organization.upsert({
    where: { originalType_originalId: { originalType: 'Clinic', originalId: clinicId } },
    update: { name: clinic.name },
    create: { id: uid(), name: clinic.name, type: 'CLINIC', originalType: 'Clinic', originalId: clinicId, contacts: clinic.city ? { city: clinic.city } : undefined },
  });
  await syncPersonFromClinicMember(clinicId, userId, role);
}
import { createSession } from '../compliance/session.service.js';
import { expireAllSessions } from '../compliance/session.service.js';
import { checkLoginAttempts, recordFailedAttempt, resetAttempts } from '../../lib/loginGuard.js';
import crypto from 'node:crypto';
import { setCsrfCookie } from '../../middleware/csrf.js';

function setAuthCookies(res: any, accessToken: string, refreshToken: string) {
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
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


// Detects a missing-column drift error (e.g. googleId absent in prod after a
// skipped migration). Prisma surfaces these as P2025-style query errors whose
// message names the offending column; we match by column name rather than the
// fragile raw Postgres/SQLite text.
function isMissingColumnError(err: unknown, column: string): boolean {
  const msg = (err as any)?.message ?? '';
  const code = (err as any)?.code;
  return typeof msg === 'string' && msg.toLowerCase().includes(String(column).toLowerCase()) &&
    (/(column|does not exist|missing|undefined)/i.test(msg) || code === 'P2025' || code === 'P2000');
}


/** What a successful sign-in returns, whatever proved the identity. */
interface SignInUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  password?: string | null;
  memberships: Array<{
    id: string;
    role: string;
    clinicId: string;
    joinedAt: Date;
    clinic: unknown;
  }>;
}

/**
 * The body of a successful sign-in: session, tokens, cookies and the whole
 * permission picture the frontend boots from.
 *
 * Shared rather than duplicated because Google sign-in has to land the caller
 * in *exactly* the same state as a password login — `permissions`, `pages`,
 * `capabilities` and `effectiveRole` all feed the frontend's access model, and
 * a second copy of this that drifted by one field would put a Google user in a
 * subtly different app.
 */
async function buildSignInPayload(user: SignInUser, req: any, res: any) {
  const authContext = await resolveAuthContext(user.id, { clinicId: user.memberships[0]?.clinicId });
  const clinicId = authContext.clinicId;
  const activeMembership = user.memberships[0]
    ? {
        id: user.memberships[0].id,
        role: user.memberships[0].role,
        clinicId: user.memberships[0].clinicId,
        joinedAt: user.memberships[0].joinedAt,
        clinic: user.memberships[0].clinic,
      }
    : null;

  const session = await createSession(user.id, req.ip, req.headers['user-agent']).catch((e: any) => {
    console.warn('[auth] createSession failed:', e?.message);
    return null;
  });

  const tokens = generateTokens({
    sub: user.id,
    email: user.email,
    role: user.role,
    ...authContext,
    sessionId: session?.id,
  });

  const { password: _password, memberships, ...userWithoutPassword } = user;

  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

  // Scope is an Organization id — passing a clinic id here matched no Person,
  // so the DB permission graph never contributed and every caller silently
  // got the hardcoded role matrix.
  const effectivePermissions = await resolveUserPermissions(user.id, authContext.organizationId);
  const scopedRole = clinicId
    ? (await resolveClinicAccess(user.id, clinicId))?.role || user.role
    : user.role;

  return {
    user: { ...userWithoutPassword, clinicId, name: `${user.firstName} ${user.lastName}`.trim() },
    memberships: memberships.map((m) => ({
      id: m.id,
      role: m.role,
      clinicId: m.clinicId,
      joinedAt: m.joinedAt,
      clinic: m.clinic,
    })),
    activeMembership,
    permissions: effectivePermissions,
    pages: pagesForCaller(effectivePermissions, scopedRole),
    capabilities: capabilitiesForPermissions(effectivePermissions, scopedRole),
    effectiveRole: scopedRole,
    ...tokens,
  };
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

    const session = await createSession(user.id, req.ip, req.headers['user-agent']).catch((e) => {
      console.warn('[auth/register] createSession failed:', e?.message);
      return null;
    });

    const tokens = generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionId: session?.id,
    });

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

    if (!user.password) {
      // A Google-only account. Saying so is better than "wrong password": the
      // person is typing a password that has never existed, and password reset
      // is the supported way to add one.
      await recordFailedAttempt(email, ip);
      return res.status(401).json({
        ok: false,
        error: 'Этот аккаунт создан через Google. Войдите через Google или задайте пароль через «Забыли пароль?»',
      });
    }

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      await recordFailedAttempt(email, ip);
      const { remainingAttempts: remaining } = await checkLoginAttempts(email, ip);
      return res.status(401).json({ ok: false, error: 'Неверный email или пароль', remainingAttempts: remaining });
    }

    await resetAttempts(email, ip);

    const response: ApiResponse = { ok: true, data: await buildSignInPayload(user, req, res) };
    res.json(response);
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Ошибка при входе' });
  }
});

/**
 * Google sign-in.
 *
 * The browser proves the identity with an ID token; we verify it and then issue
 * exactly the session a password login would have issued. Creating an account
 * when none exists mirrors `/register` — same role, same absence of a clinic —
 * because the alternative makes a patient arriving from a booking fill in a
 * form anyway, which is the whole thing this is meant to avoid.
 */
authRouter.post('/google', async (req, res) => {
  try {
    if (!googleSignInEnabled()) {
      return res.status(503).json({ ok: false, error: 'Вход через Google не настроен' });
    }

    const idToken = String((req.body || {}).idToken || (req.body || {}).credential || '');
    const profile = await verifyGoogleIdToken(idToken);

    // Google asserts the address is verified, or it does not. Accepting an
    // unverified one would let anyone who can mint a Google identity with
    // someone else's address take over that account by email.
    if (!profile.emailVerified) {
      return res.status(403).json({
        ok: false,
        error: 'Google не подтвердил этот адрес электронной почты',
      });
    }

    // Guest accounts live in their own namespace; registration already refuses
    // it, and a Google identity must not be able to land inside it either.
    if (profile.email.endsWith('@guest.local')) {
      return res.status(400).json({ ok: false, error: 'Некорректный email' });
    }

    const membershipSelect = {
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
          clinic: { select: { id: true, name: true, city: true, plan: true, logo: true } },
        },
      },
    } as const;

    let user = await prisma.user.findUnique({ where: { email: profile.email }, select: membershipSelect });

    if (user) {
      // Link on first Google sign-in. Safe because Google verified the address,
      // and the role is deliberately left alone — an existing OWNER signing in
      // with Google is still an OWNER.
      await prisma.user.update({ where: { id: user.id }, data: { googleId: profile.googleId } })
        .catch((e) => console.warn('[auth/google] could not record googleId:', isMissingColumnError(e, 'googleId') ? 'column missing in live DB (run `prisma migrate deploy`)' : e?.message));
    } else {
      const { firstName, lastName } = namesFromProfile(profile);
      // Same shape as open registration: no password, no clinic, STUDENT — the
      // role that grants nothing clinical until a clinic is joined or created.
      try {
        await prisma.user.create({
          data: {
            id: uid(),
            email: profile.email,
            firstName,
            lastName,
            avatar: profile.picture || null,
            googleId: profile.googleId,
            role: 'STUDENT',
          },
        });
      } catch (createErr: any) {
        // Defensive: if the googleId column is missing in the live DB (migration
        // drift), fall back to creating the user without the googleId binding
        // instead of failing the whole Google sign-in. The account still works
        // and can be linked later via `prisma db push` / `migrate deploy`.
        if (isMissingColumnError(createErr, 'googleId')) {
          console.warn('[auth/google] googleId column missing; creating user without it');
          await prisma.user.create({
            data: {
              id: uid(),
              email: profile.email,
              firstName,
              lastName,
              avatar: profile.picture || null,
              role: 'STUDENT',
            },
          });
        } else {
          throw createErr;
        }
      }
      user = await prisma.user.findUnique({ where: { email: profile.email }, select: membershipSelect });
    }

    if (!user) {
      return res.status(500).json({ ok: false, error: 'Не удалось создать аккаунт' });
    }

    return res.json({ ok: true, data: await buildSignInPayload(user, req, res) });
  } catch (error) {
    const status = (error as GoogleAuthError)?.status;
    if (status) {
      return res.status(status).json({ ok: false, error: (error as Error).message });
    }
    console.error('[auth/google]', error);
    return res.status(500).json({ ok: false, error: 'Ошибка входа через Google' });
  }
});

authRouter.post('/logout', authenticate, async (req: AuthRequest, res) => {
  try {
    // Expire all user sessions
    await prisma.userSession.updateMany({
      where: { userId: req.user!.id, expiredAt: { gt: new Date() } },
      data: { expiredAt: new Date() },
    }).catch(() => { /* table may not exist */ });
    clearAuthCookies(res);
    res.json({ ok: true, data: { message: 'Logged out' } });
  } catch {
    clearAuthCookies(res);
    res.json({ ok: true, data: { message: 'Logged out' } });
  }
});

// H2: Refresh token rotation — expire old session, create new one
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

    // Rotate session: expire old, create new
    if (payload.sessionId) {
      await prisma.userSession.update({
        where: { id: payload.sessionId },
        data: { expiredAt: new Date() },
      }).catch(() => null);
    }
    const session = await prisma.userSession.create({
      data: {
        userId: user.id,
        device: 'Session Refresh',
        browser: 'Session Refresh',
        ipAddress: req.ip || null,
        lastActivity: new Date(),
        expiredAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    }).catch(() => null);

    // Re-resolve rather than copying the old claims forward: the scope the
    // token carried is re-verified against current memberships, and a context
    // established by switch-context survives the rotation instead of being
    // dropped back to a bare legacy clinicId.
    const authContext = await resolveAuthContext(user.id, {
      organizationId: payload.organizationId,
      clinicId: payload.clinicId,
    });

    const tokens = generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
      ...authContext,
      sessionId: session?.id,
    });

    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    res.json({ ok: true, data: tokens } satisfies ApiResponse);
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

    const effectivePermissions = await resolveUserPermissions(user.id, req.user!.organizationId);
    // Page visibility and capability flags come from the same effective
    // permission set, so the client stops deriving them from a legacy role
    // table that the backend has no say in.
    const scopedRole = req.user!.clinicId
      ? (await resolveClinicAccess(user.id, req.user!.clinicId))?.role || user.role
      : user.role;

    const response: ApiResponse = {
      ok: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          spec: user.spec,
          avatar: user.avatar,
          role: user.role,
          createdAt: user.createdAt,
          organizationType: (req.user as any)?.organizationType,
          organizationId: (req.user as any)?.organizationId,
          personType: (req.user as any)?.personType,
        },
        memberships: user.memberships.map(m => ({ id: m.id, role: m.role, clinicId: m.clinicId, joinedAt: m.joinedAt, clinic: m.clinic })),
        activeMembership: user.memberships[0] ? { id: user.memberships[0].id, role: user.memberships[0].role, clinicId: user.memberships[0].clinicId, clinic: user.memberships[0].clinic } : null,
        permissions: effectivePermissions,
        pages: pagesForCaller(effectivePermissions, scopedRole),
        capabilities: capabilitiesForPermissions(effectivePermissions, scopedRole),
        effectiveRole: scopedRole,
      },
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Ошибка при получении профиля' });
  }
});

authRouter.post('/switch-clinic', authenticate, async (req: AuthRequest, res) => {
  try {
    let { clinicId } = req.body as { clinicId: string };

    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'clinicId обязателен' });
    }

    let membership = await prisma.clinicMember.findUnique({
      where: { userId_clinicId: { userId: req.user!.id, clinicId } },
    });

    // Older frontend/context records sometimes send the unified Organization
    // id instead of the legacy Clinic id. Normalize it before membership lookup.
    if (!membership) {
      const org = await prisma.organization.findFirst({
        where: { id: clinicId, type: 'CLINIC' },
        select: { originalId: true },
      });
      if (org?.originalId) {
        clinicId = org.originalId;
        membership = await prisma.clinicMember.findUnique({
          where: { userId_clinicId: { userId: req.user!.id, clinicId } },
        });
      }
    }

    // Fallback: check if user has a Person linked to this clinic's org
    if (!membership) {
      const org = await prisma.organization.findFirst({
        where: { originalType: 'Clinic', originalId: clinicId },
      });
      if (org) {
        const person = await prisma.person.findFirst({
          where: { userId: req.user!.id, organizationId: org.id },
        });
        if (person) {
          const synced = await prisma.clinicMember.create({
            data: { id: uid(), userId: req.user!.id, clinicId, role: 'DOCTOR' },
          });
          membership = synced;
        }
      }
    }

    if (!membership) {
      return res.status(403).json({ ok: false, error: 'Вы не являетесь участником этой клиники' });
    }

    await ensureOrgAndPerson(clinicId, req.user!.id, membership.role);

    const tokens = generateTokens({
      sub: req.user!.id,
      email: req.user!.email,
      role: membership.role || req.user!.role,
      ...(await resolveAuthContext(req.user!.id, { clinicId })),
      // Re-issued tokens kept no sessionId, which made `authenticate` skip the
      // revocation check for them entirely — logging out could not kill them.
      sessionId: req.user!.sessionId,
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
      prisma.organization.upsert({
        where: { originalType_originalId: { originalType: 'Clinic', originalId: clinicId } },
        update: { name },
        create: { id: uid(), name, type: 'CLINIC', originalType: 'Clinic', originalId: clinicId, contacts: city ? { city } : undefined },
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

    await syncPersonFromClinicMember(clinicId, req.user!.id, 'OWNER');

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
      ...(await resolveAuthContext(req.user!.id, { clinicId })),
      sessionId: req.user!.sessionId,
    });

    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    // Auto-create LegalPartner + generate clinic agreement
    try {
      await onboardPartner({
        type: 'CLINIC',
        legalName: name,
        bin: '',
        director: '',
        address: address || '',
        iban: '',
        phone: phone || '',
        email: req.user!.email,
        userId: req.user!.id,
      }, req.user!.id);
    } catch (e) {
      console.warn('[auth/register-clinic] Legal onboarding failed (non-fatal):', (e as Error).message);
    }

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
    const { name, city, address, phone } = req.body as {
      name?: string;
      city?: string;
      address?: string;
      phone?: string;
    };
    // Real clinic data when provided (so the user can continue using it after demo).
    const clinicName = name?.trim() || 'Демо-клиника «Дентал Плюс»';
    const clinicCity = city?.trim() || 'Алматы';
    const clinicAddress = address?.trim() || 'ул. Абая 150, офис 301';
    const clinicPhone = phone?.trim() || '+7 727 123 45 67';

    const clinicId = uid();
    const userId = req.user!.id;

    const [clinic] = await prisma.$transaction([
      prisma.clinic.create({
        data: {
          id: clinicId,
          name: clinicName,
          city: clinicCity,
          address: clinicAddress,
          phone: clinicPhone,
          plan: 'ENTERPRISE',
          active: true,
        },
      }),
      prisma.organization.upsert({
        where: { originalType_originalId: { originalType: 'Clinic', originalId: clinicId } },
        update: { name: clinicName },
        create: { id: uid(), name: clinicName, type: 'CLINIC', originalType: 'Clinic', originalId: clinicId, contacts: { city: clinicCity } },
      }),
      prisma.clinicMember.create({
        data: { id: uid(), userId, clinicId, role: 'OWNER' },
      }),
    ]);

    await syncPersonFromClinicMember(clinicId, userId, 'OWNER');

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
          id: uid(), patientId: p1.id, clinicId, title: 'План лечения — Иванов И.И.', status: 'active', price: 185000,
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
          id: uid(), patientId: p2.id, clinicId, title: 'План лечения — Петрова М.А.', status: 'active', price: 45000,
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
          id: uid(), patientId: p3.id, clinicId, title: 'План лечения — Сидоров А.В.', status: 'completed', price: 320000,
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
          id: uid(), clinicId, patientId: p3.id, doctorId: userId, labName: 'DentalLab Pro', status: 'completed', type: 'Коронка металлокерамическая',
          notes: 'Зуб 16, оттенок A2', price: 45000, deadline: new Date(now - 3 * day),
        },
      }),
      prisma.labOrder.create({
        data: {
          id: uid(), clinicId, patientId: p1.id, doctorId: userId, labName: 'Волгоградская лаборатория', status: 'in_progress', type: 'Виниры',
          notes: 'Зубы 11, 21 — композитные виниры', price: 80000, deadline: new Date(now + 7 * day),
        },
      }),
    ]);

    const tokens = generateTokens({
      sub: userId,
      email: req.user!.email,
      role: req.user!.role,
      ...(await resolveAuthContext(userId, { clinicId })),
      sessionId: req.user!.sessionId,
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

    await syncPersonFromClinicMember(targetClinicId, req.user!.id, membership.role);

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

authRouter.post('/forgot-password', async (req, res) => {
  try {
    const { email, login } = req.body as { email?: string; login?: string };
    const identifier = email || login;

    if (!identifier) {
      return res.status(400).json({ ok: false, error: 'Email или логин обязателен' });
    }

    const normalizedEmail = String(identifier).trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    let devToken: string | null = null;
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      await prisma.passwordReset.deleteMany({ where: { userId: user.id } });
      await prisma.passwordReset.create({
        data: {
          userId: user.id,
          token,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      // The letter this endpoint has always claimed to send. Best-effort by
      // design: with no mail account configured `sendEmail` reports `sent:
      // false` and nothing changes, and a transport failure must not turn into
      // a 500 that tells an attacker the address exists.
      try {
        const letter = buildPasswordResetEmail({ token, firstName: user.firstName });
        const { sent, transport } = await sendEmail({ to: normalizedEmail, ...letter });
        if (!sent) {
          console.warn('[Password Reset] No email transport configured — letter not sent');
        }
        // Nothing to log on success: the fact a reset was requested is already
        // in the audit trail, and the address does not belong in stdout.
        void transport;
      } catch (mailError) {
        console.error('[Password Reset] Failed to send letter:', (mailError as Error).message);
      }

      if (process.env.NODE_ENV === 'development' && !process.env.CI) {
        console.warn(`[Password Reset] Token for ${normalizedEmail}: ${token}`);
        devToken = token;
      }
    }

    res.json({
      ok: true,
      data: {
        message: 'Если пользователь существует, письмо для сброса пароля отправлено',
        ...(devToken ? { _devToken: devToken } : {}),
      },
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Ошибка при отправке письма' });
  }
});

authRouter.post('/reset-password', async (req, res) => {
  try {
    const { token, password, newPassword } = req.body as { token: string; password?: string; newPassword?: string };
    const finalPassword = password || newPassword;

    if (!token || !finalPassword) {
      return res.status(400).json({ ok: false, error: 'Токен и новый пароль обязательны' });
    }

    const passwordError = assertPasswordPolicy(finalPassword);
    if (passwordError) {
      return res.status(400).json({ ok: false, error: passwordError });
    }

    const entry = await prisma.passwordReset.findFirst({
      where: { token },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!entry) {
      return res.status(400).json({ ok: false, error: 'Невалидный или истекший токен' });
    }

    if (entry.expiresAt < new Date()) {
      // Only discard the spent token. Expiring sessions here let anyone holding
      // an expired token log the owner out of every device, and — worse — the
      // invalidation was *only* here, so a successful reset left the old
      // sessions alive, which is the case the protection is actually for.
      await prisma.passwordReset.delete({ where: { id: entry.id } });
      return res.status(400).json({ ok: false, error: 'Токен истек' });
    }

    const hashedPassword = await hashPassword(finalPassword);
    await prisma.user.update({
      where: { email: entry.user.email },
      data: { password: hashedPassword },
    });

    await prisma.passwordReset.delete({ where: { id: entry.id } });

    // Now that the password has actually changed: anyone holding a session on
    // the old credentials loses it.
    try { await expireAllSessions(entry.user.id); } catch { /* non-fatal */ }

    const response: ApiResponse = {
      ok: true,
      data: { message: 'Пароль успешно сброшен' },
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Ошибка при сбросе пароля' });
  }
});
