import prisma from '../../lib/prisma.js';

interface AuditEntry {
  documentId: string;
  action: string;
  fromStatus?: string;
  toStatus?: string;
  fromVersion?: number;
  toVersion?: number;
  diff?: any;
  performedBy: string;
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  await prisma.legalAuditLog.create({
    data: {
      documentId: entry.documentId,
      action: entry.action,
      fromStatus: entry.fromStatus as any,
      toStatus: entry.toStatus as any,
      fromVersion: entry.fromVersion,
      toVersion: entry.toVersion,
      diff: entry.diff ?? undefined,
      performedBy: entry.performedBy,
    },
  });
}
