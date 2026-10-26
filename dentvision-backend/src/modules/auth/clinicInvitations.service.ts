import crypto from 'node:crypto';
import type { UserRole } from '@prisma/client';
import prisma from '../../lib/prisma.js';

/**
 * Persist an invitation and return its one-time code.
 * Retry only unique constraint collisions; all other persistence errors surface.
 */
export async function createClinicInvitation(input: {
  clinicId: string;
  email: string | null;
  role: UserRole;
  expiresAt: Date;
}): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = crypto.randomBytes(5).toString('hex').toUpperCase();
    try {
      await prisma.clinicInvitation.create({
        data: { clinicId: input.clinicId, email: input.email, role: input.role, code, expiresAt: input.expiresAt },
      });
      return code;
    } catch (error) {
      if ((error as { code?: string })?.code !== 'P2002') throw error;
    }
  }
  throw new Error('Не удалось сгенерировать код приглашения');
}
