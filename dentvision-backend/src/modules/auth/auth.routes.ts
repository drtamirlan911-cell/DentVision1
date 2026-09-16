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
import { auditFromReq, writeAuditLog } from '../compliance/audit.service.js';
import { createSession } from '../compliance/session.service.js';
import { expireAllSessions } from '../compliance/session.service.js';
import { checkLoginAttempts, recordFailedAttempt, resetAttempts } from '../../lib/loginGuard.js';
import crypto from 'node:crypto';
import { setCsrfCookie } from '../../middleware/csrf.js';

function setAuthCookies(res: any, accessToken: string, refreshToken: string) {
  res.cookie('accessToken', accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', maxAge: 24 * 60 * 60 * 1000, path: '/' });
  res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' });
  setCsrfCookie(res);
}

function clearAuthCookies(res: any) {
  res.clearCookie('accessToken', { path: '/', secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' });
  res.clearCookie('refreshToken', { path: '/', secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' });
}

function isMissingColumnError(err: unknown, column: string): boolean {
  const msg = (err as any)?.message ?? '';
  const code = (err as any)?.code;
  return typeof msg === 'string' && msg.toLowerCase().includes(String(column).toLowerCase()) && (/(column|does not exist|missing|undefined)/i.test(msg) || code === 'P2025' || code === 'P2000');
}

interface SignInUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  password?: string | null;
  memberships: Array<{ id: string; role: string; clinicId: string; joinedAt: Date; clinic: unknown }>;
}

async function buildSignInPayload(user: SignInUser, req: any, res: any) {
  const authContext = await resolveAuthContext(user.id, { clinicId: user.memberships[0]?.clinicId });
  const clinicId = authContext.clinicId;
  const activeMembership = user.memberships[0] ? { id: user.memberships[0].id, role: user.memberships[0].role, clinicId: user.memberships[0].clinicId, joinedAt: user.memberships[0].joinedAt, clinic: user.memberships[0].clinic } : null;
  const session = await createSession(user.id, req.ip, req.headers['user-agent']);
  const tokens = generateTokens({ sub: user.id, email: user.email, role: user.role, ...authContext, sessionId: session.id });
  const { password: _password, memberships, ...userWithoutPassword } = user;
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  const effectivePermissions = await resolveUserPermissions(user.id, authContext.organizationId);
  const scopedRole = clinicId ? (await resolveClinicAccess(user.id, clinicId))?.role || user.role : user.role;
  return { user: { ...userWithoutPassword, clinicId, name: `${user.firstName} ${user.lastName}`.trim() }, memberships: memberships.map((m) => ({ id: m.id, role: m.role, clinicId: m.clinicId, joinedAt: m.joinedAt, clinic: m.clinic })), activeMembership, permissions: effectivePermissions, pages: pagesForCaller(effectivePermissions, scopedRole), capabilities: capabilitiesForPermissions(effectivePermissions, scopedRole), effectiveRole: scopedRole, ...tokens };
}

export const authRouter = Router();

/**
 * Public registration creates an unscoped account only. Clinic/partner roles
 * are granted later through organization onboarding or an explicit invitation,
 * where the role is attached to a verified organization/person scope.
 *
 * The requested role is intentionally ignored here: accepting OWNER/DOCTOR/LAB
 * would let an anonymous caller receive a privileged global User.role before
 * any organization membership exists. This is prohibited by the canonical IAM
 * model (Person → organization → role → permission → scope).
 */
function publicRegistrationRole(_raw: unknown): UserRole {
  return 'STUDENT';
}

authRouter.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, role } = req.body as { email: string; password: string; firstName: string; lastName: string; phone?: string; role?: string };
    if (!email || !password || !firstName || !lastName) return res.status(400).json({ ok: false, error: 'Все обязательные поля должны быть заполнены' });
    const passwordError = assertPasswordPolicy(password); if (passwordError) return res.status(400).json({ ok: false, error: passwordError });
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!normalizedEmail.includes('@') || normalizedEmail.endsWith('@guest.local')) return res.status(400).json({ ok: false, error: 'Некорректный email' });
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) return res.status(409).json({ ok: false, error: 'Если указанный email зарегистрирован, вы получите письмо' });
    const requestedRole = publicRegistrationRole(role);
    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({ data: { id: uid(), email: normalizedEmail, password: hashedPassword, firstName: String(firstName).trim(), lastName: String(lastName).trim(), phone: phone || null, role: requestedRole }, select: { id: true, email: true, firstName: true, lastName: true, role: true } });
    const session = await createSession(user.id, req.ip, req.headers['user-agent']);
    const tokens = generateTokens({ sub: user.id, email: user.email, role: user.role, sessionId: session.id });
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    await writeAuditLog({ userId: user.id, action: 'auth.register', entity: 'user', entityId: user.id, ip: req.ip || req.socket?.remoteAddress });
    const response: ApiResponse = { ok: true, data: { user, ...tokens } }; res.status(201).json(response);
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2002') return res.status(409).json({ ok: false, error: 'Если указанный email зарегистрирован, вы получите письмо' });
    clearAuthCookies(res); res.status(500).json({ ok: false, error: 'Ошибка при регистрации' });
  }
});

authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) return res.status(400).json({ ok: false, error: 'Email и пароль обязательны' });
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const { allowed, remainingAttempts, lockoutMinutes } = await checkLoginAttempts(email, ip);
    if (!allowed) return res.status(429).json({ ok: false, error: `Слишком много попыток входа. Повторите через ${lockoutMinutes} мин.`, remainingAttempts: 0, lockoutMinutes });
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, firstName: true, lastName: true, role: true, password: true, memberships: { select: { id: true, role: true, clinicId: true, joinedAt: true, clinic: { select: { id: true, name: true, city: true, plan: true, logo: true } } } } } });
    if (!user) { await recordFailedAttempt(email, ip); return res.status(401).json({ ok: false, error: 'Неверный email или пароль' }); }
    if (!user.password) { await recordFailedAttempt(email, ip); return res.status(401).json({ ok: false, error: 'Этот аккаунт создан через Google. Войдите через Google или задайте пароль через «Забыли пароль?»' }); }
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) { await recordFailedAttempt(email, ip); const { remainingAttempts: remaining } = await checkLoginAttempts(email, ip); return res.status(401).json({ ok: false, error: 'Неверный email или пароль', remainingAttempts: remaining }); }
    await resetAttempts(email, ip);
    const response: ApiResponse = { ok: true, data: await buildSignInPayload(user, req, res) };
    await writeAuditLog({ userId: user.id, action: 'auth.login', entity: 'user', entityId: user.id, ip: String(ip) }); res.json(response);
  } catch (error) { clearAuthCookies(res); res.status(500).json({ ok: false, error: 'Ошибка при входе' }); }
});

authRouter.post('/google', async (req, res) => {
  try {
    if (!googleSignInEnabled()) return res.status(503).json({ ok: false, error: 'Вход через Google не настроен' });
    const idToken = String((req.body || {}).idToken || (req.body || {}).credential || '');
    const profile = await verifyGoogleIdToken(idToken);
    if (!profile.emailVerified) return res.status(403).json({ ok: false, error: 'Google не подтвердил этот адрес электронной почты' });
    if (profile.email.endsWith('@guest.local')) return res.status(400).json({ ok: false, error: 'Некорректный email' });
    const membershipSelect = { id: true, email: true, firstName: true, lastName: true, role: true, password: true, memberships: { select: { id: true, role: true, clinicId: true, joinedAt: true, clinic: { select: { id: true, name: true, city: true, plan: true, logo: true } } } } } as const;
    let user = await prisma.user.findUnique({ where: { email: profile.email }, select: membershipSelect });
    const isNewAccount = !user;
    if (user) {
      await prisma.user.update({ where: { id: user.id }, data: { googleId: profile.googleId } }).catch((e) => console.warn('[auth/google] could not record googleId:', isMissingColumnError(e, 'googleId') ? 'column missing in live DB (run `prisma migrate deploy`)' : e?.message));
    } else {
      const { firstName, lastName } = namesFromProfile(profile);
      try { await prisma.user.create({ data: { id: uid(), email: profile.email, firstName, lastName, avatar: profile.picture || null, googleId: profile.googleId, role: 'STUDENT' } }); }
      catch (createErr: any) { if (isMissingColumnError(createErr, 'googleId')) { console.warn('[auth/google] googleId column missing; creating user without it'); await prisma.user.create({ data: { id: uid(), email: profile.email, firstName, lastName, avatar: profile.picture || null, role: 'STUDENT' } }); } else throw createErr; }
      user = await prisma.user.findUnique({ where: { email: profile.email }, select: membershipSelect });
    }
    if (!user) return res.status(500).json({ ok: false, error: 'Не удалось создать аккаунт' });
    await writeAuditLog({ userId: user.id, action: isNewAccount ? 'auth.google_signup' : 'auth.google_login', entity: 'user', entityId: user.id, ip: req.ip || req.socket?.remoteAddress });
    return res.json({ ok: true, data: await buildSignInPayload(user, req, res) });
  } catch (error) { clearAuthCookies(res); const status = (error as GoogleAuthError)?.status; if (status) return res.status(status).json({ ok: false, error: (error as Error).message }); console.error('[auth/google]', error); return res.status(500).json({ ok: false, error: 'Ошибка входа через Google' }); }
});

/**
 * Password reset requests intentionally return the same response for existing
 * and unknown addresses. The reset token is random and is only ever placed in
 * the email link; delivery failures are logged but do not disclose account
 * existence to the caller.
 */
authRouter.post('/forgot-password', async (req, res) => {
  try {
    const normalizedEmail = String(req.body?.email || '').trim().toLowerCase();
    if (normalizedEmail.includes('@') && !normalizedEmail.endsWith('@guest.local')) {
      const user = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true, email: true, firstName: true, password: true } });
      if (user?.password) {
        const token = crypto.randomBytes(32).toString('hex');
        try {
          await sendEmail({ to: user.email, ...buildPasswordResetEmail({ token, firstName: user.firstName }) });
        } catch (error) {
          console.warn('[auth/forgot-password] email delivery unavailable:', (error as Error)?.message || error);
        }
      }
    }
    return res.status(200).json({ ok: true, data: { message: 'Если указанный email зарегистрирован, вы получите письмо с инструкциями.' } });
  } catch (error) {
    console.error('[auth/forgot-password]', error);
    return res.status(200).json({ ok: true, data: { message: 'Если указанный email зарегистрирован, вы получите письмо с инструкциями.' } });
  }
});

authRouter.post('/logout', authenticate, async (req: AuthRequest, res) => {
  try {
    await prisma.userSession.updateMany({ where: { userId: req.user!.id, expiredAt: { gt: new Date() } }, data: { expiredAt: new Date() } }).catch(() => {});
    await auditFromReq(req, { action: 'auth.logout', entity: 'user', entityId: req.user!.id });
    clearAuthCookies(res); res.json({ ok: true, data: { message: 'Logged out' } });
  } catch { clearAuthCookies(res); res.json({ ok: true, data: { message: 'Logged out' } }); }
});

authRouter.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body as { refreshToken: string };
    if (!refreshToken) return res.status(400).json({ ok: false, error: 'Refresh токен обязателен' });
    const payload = verifyRefreshToken(refreshToken);
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, email: true, role: true } });
    if (!user) return res.status(401).json({ ok: false, error: 'Пользователь не найден' });
    const sessionId = (payload as any).sessionId as string | undefined;
    if (!sessionId) return res.status(401).json({ ok: false, error: 'Сессия токена отсутствует' });
    const session = await prisma.userSession.findUnique({ where: { id: sessionId }, select: { id: true, userId: true, expiredAt: true } });
    if (!session || session.userId !== user.id || (session.expiredAt && session.expiredAt <= new Date())) return res.status(401).json({ ok: false, error: 'Сессия недействительна' });

    // A refresh token may carry a workspace context, but that context is only
    // a claim. Re-resolve it against the current Person/organization or legacy
    // ClinicMember link before rotating the session. If a scoped token points
    // at a revoked/deleted context, fail closed instead of silently falling
    // back to the global User.role or another workspace.
    const requestedOrganizationId = typeof payload.organizationId === 'string' ? payload.organizationId : undefined;
    const requestedClinicId = typeof payload.clinicId === 'string' ? payload.clinicId : undefined;
    const hadScopedContext = Boolean(requestedOrganizationId || requestedClinicId);
    const authContext = await resolveAuthContext(user.id, {
      organizationId: requestedOrganizationId,
      clinicId: requestedClinicId,
    });
    if (hadScopedContext && !authContext.organizationId && !authContext.clinicId) {
      return res.status(401).json({ ok: false, error: 'Контекст организации больше недействителен' });
    }

    await expireAllSessions(user.id);
    const newSession = await createSession(user.id, req.ip, req.headers['user-agent']);
    const tokens = generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
      ...authContext,
      sessionId: newSession.id,
    });
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    res.json({ ok: true, data: tokens });
  } catch { clearAuthCookies(res); res.status(401).json({ ok: false, error: 'Недействительный refresh токен' }); }
});
