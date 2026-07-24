import prisma from '../../lib/prisma.js';

// ─── CONSENTS ───

export async function getConsents(userId: string) {
  return prisma.consent.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function upsertConsent(
  userId: string,
  type: string,
  accepted: boolean,
  ipAddress?: string,
  version = '1.0',
) {
  return prisma.consent.upsert({
    where: { userId_type: { userId, type } },
    update: { accepted, version, ipAddress: ipAddress || null },
    create: { userId, type, accepted, version, ipAddress: ipAddress || null },
  });
}

// ─── MEDICAL FILE ACCESS ───

export async function logMedicalFileAccess(
  patientId: string,
  fileType: string,
  storagePath: string,
  uploadedBy: string,
  action: 'UPLOAD' | 'VIEW' | 'DOWNLOAD',
  viewerId?: string,
) {
  return prisma.medicalFileAccess.create({
    data: {
      patientId,
      fileType,
      storagePath,
      uploadedBy,
      viewedBy: action === 'VIEW' ? viewerId : null,
      downloadedBy: action === 'DOWNLOAD' ? viewerId : null,
      action,
    },
  });
}

export async function getMedicalFileAccess(patientId: string) {
  return prisma.medicalFileAccess.findMany({
    where: { patientId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

// ─── AI ACTION LOG ───

export async function logAIAction(
  userId: string,
  agent: string,
  request: unknown,
  model?: string,
  patientId?: string,
) {
  return prisma.aIActionLog.create({
    data: {
      userId,
      patientId: patientId || null,
      agent,
      model: model || null,
      request: request as any,
      doctorConfirmed: false,
    },
  });
}

export async function confirmAIAction(logId: string, confirmedBy: string) {
  return prisma.aIActionLog.update({
    where: { id: logId },
    data: { doctorConfirmed: true, confirmedBy, confirmedAt: new Date() },
  });
}

export async function getAIActions(
  filters: { userId?: string; patientId?: string; agent?: string; limit?: number } = {},
) {
  const where: Record<string, unknown> = {};
  if (filters.userId) where.userId = filters.userId;
  if (filters.patientId) where.patientId = filters.patientId;
  if (filters.agent) where.agent = filters.agent;

  return prisma.aIActionLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: filters.limit || 50,
  });
}

// ─── SECURITY DASHBOARD ───

export async function getSecurityDashboard(userId: string, clinicId?: string) {
  const [sessions, consents, recentAI, failedLogins] = await Promise.all([
    prisma.userSession.findMany({
      where: { userId, expiredAt: { gt: new Date() } },
      orderBy: { lastActivity: 'desc' },
      take: 20,
    }),
    prisma.consent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.aIActionLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.auditLog.count({
      where: {
        clinicId: clinicId || undefined,
        action: { contains: 'LOGIN_FAILED', mode: 'insensitive' },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  return {
    sessions,
    consents,
    recentAI,
    failedLogins24h: failedLogins,
  };
}

// ═══════════════════════════════════════════════════════════════
// COMPLIANCE CHECKS (original — product/course/supplier rules)
// ═══════════════════════════════════════════════════════════════

export interface Finding {
  code: string;
  severity: 'block' | 'review';
  message: string;
}

const FORBIDDEN_TERMS = ['гарантия 100', '100% гарантия', 'чудо', 'излечивает навсегда', 'без побочных'];

function scanForbidden(text: string | null | undefined): Finding[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const hits = FORBIDDEN_TERMS.filter((t) => lower.includes(t));
  return hits.map((t) => ({
    code: 'forbidden_claim',
    severity: 'block' as const,
    message: `Недопустимое рекламное заявление: «${t}»`,
  }));
}

function verdict(findings: Finding[]): string {
  if (findings.some((f) => f.severity === 'block')) return 'blocked';
  if (findings.length > 0) return 'needs_review';
  return 'approved';
}

export async function runComplianceCheck(entityType: string, entityId: string) {
  let findings: Finding[];
  switch (entityType) {
    case 'product': {
      const product = await prisma.product.findUnique({
        where: { id: entityId },
        include: { _count: { select: { favorites: true } } },
      });
      if (!product) findings = [{ code: 'not_found', severity: 'block', message: 'Товар не найден' }];
      else {
        const f: Finding[] = [];
        f.push(...scanForbidden(product.name), ...scanForbidden(product.description));
        if (product.price <= 0) f.push({ code: 'invalid_price', severity: 'block', message: 'Цена должна быть положительной' });
        if (!product.description) f.push({ code: 'missing_description', severity: 'review', message: 'Отсутствует описание' });
        if ((product.category || '').toLowerCase().includes('имплант') && !product.supplierId) {
          f.push({ code: 'missing_supplier', severity: 'review', message: 'Для имплантов требуется привязка к поставщику' });
        }
        findings = f;
      }
      break;
    }
    case 'course': {
      const course = await prisma.course.findUnique({
        where: { id: entityId },
        include: { _count: { select: { lessons: true } } },
      });
      if (!course) findings = [{ code: 'not_found', severity: 'block', message: 'Курс не найден' }];
      else {
        const f: Finding[] = [];
        f.push(...scanForbidden(course.title), ...scanForbidden(course.description));
        if (course._count.lessons === 0) f.push({ code: 'no_lessons', severity: 'review', message: 'В курсе нет уроков' });
        findings = f;
      }
      break;
    }
    case 'supplier': {
      const supplier = await prisma.supplier.findUnique({
        where: { id: entityId },
        include: { _count: { select: { documents: true } } },
      });
      if (!supplier) findings = [{ code: 'not_found', severity: 'block', message: 'Поставщик не найден' }];
      else {
        const f: Finding[] = [];
        if (!supplier.bin) f.push({ code: 'missing_bin', severity: 'review', message: 'Не указан БИН' });
        if (supplier._count.documents === 0) f.push({ code: 'no_documents', severity: 'review', message: 'Нет загруженных документов' });
        findings = f;
      }
      break;
    }
    default: throw new Error('Unsupported entityType');
  }
  const status = verdict(findings);
  return prisma.complianceCheck.create({
    data: { entityType, entityId, status, findings: findings as unknown as object },
  });
}
