/**
 * Centralised audit-log helper.
 * Call from any module: await audit(req, 'PATIENT_VIEW', 'patient', patientId, { old, new });
 * The middleware-based approach (AuthRequest) keeps caller code minimal.
 */
import prisma from '../../lib/prisma.js';
import { uid } from '../../lib/helpers.js';
import type { AuthRequest } from '../../types/index.js';

export interface AuditInput {
  action: string;
  entity?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  userId?: string;
  clinicId?: string;
  ip?: string;
}

export async function writeAuditLog(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      id: uid(),
      userId: input.userId || null,
      clinicId: input.clinicId || null,
      action: input.action,
      entity: input.entity || null,
      entityId: input.entityId || null,
      details: (input.details || undefined) as any,
      ip: input.ip || null,
    },
  });
}

/** Convenience: extract req context + pass through */
export function auditFromReq(req: AuthRequest, input: Omit<AuditInput, 'userId' | 'clinicId' | 'ip'>): Promise<void> {
  return writeAuditLog({
    ...input,
    userId: req.user?.id,
    clinicId: req.user?.clinicId,
    ip: req.ip || req.socket?.remoteAddress,
  });
}
