import crypto from 'node:crypto';
import prisma from '../../lib/prisma.js';
import { hashPassword, assertPasswordPolicy } from '../../lib/password.js';
import { writeAuditLog } from '../compliance/audit.service.js';

export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export type PasswordResetResult =
  | { ok: true; userId: string }
  | { ok: false; status: number; error: string };

export async function issuePasswordResetToken(userId: string, now: Date = new Date()): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  await prisma.$transaction(async (tx) => {
    await tx.passwordReset.deleteMany({ where: { userId } });
    await tx.passwordReset.create({
      data: { userId, token: hashResetToken(token), expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MS) },
    });
  });
  return token;
}

export async function resetPasswordWithToken(
  rawToken: string, newPassword: string, now: Date = new Date(),
): Promise<PasswordResetResult> {
  if (!rawToken) return { ok: false, status: 400, error: 'Токен обязателен' };
  const policyError = assertPasswordPolicy(newPassword);
  if (policyError) return { ok: false, status: 400, error: policyError };

  const digest = hashResetToken(rawToken);
  const record = await prisma.passwordReset.findFirst({
    where: { token: digest, expiresAt: { gt: now } },
    select: { id: true, userId: true, expiresAt: true },
  });
  if (!record || record.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, status: 400, error: 'Ссылка для сброса пароля недействительна или истекла' };
  }

  const passwordHash = await hashPassword(newPassword);
  const consumed = await prisma.$transaction(async (tx) => {
    const claim = await tx.passwordReset.deleteMany({
      where: { id: record.id, token: digest, expiresAt: { gt: now } },
    });
    if (claim.count !== 1) return false;

    await tx.user.update({ where: { id: record.userId }, data: { password: passwordHash } });
    await tx.passwordReset.deleteMany({ where: { userId: record.userId } });
    await tx.userSession.updateMany({
      where: { userId: record.userId, expiredAt: { gt: now } }, data: { expiredAt: now },
    });
    await writeAuditLog({
      userId: record.userId, action: 'auth.password_reset', entity: 'user', entityId: record.userId,
    }, tx);
    return true;
  });
  if (!consumed) return { ok: false, status: 400, error: 'Ссылка для сброса пароля недействительна или истекла' };
  return { ok: true, userId: record.userId };
}
