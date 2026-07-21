import prisma from '../../lib/prisma.js';

// Compliance gate (Phase 7, DENTVISION_V2_INTEGRATION_PLAN.md §7.2).
// Rule-based checks approximating KZ requirements (medical advertising, required
// certificates, content completeness). Returns a verdict and stores it.

export interface Finding {
  code: string;
  severity: 'block' | 'review';
  message: string;
}

// Forbidden marketing claims (medical-advertising rules): absolute guarantees,
// "miracle" cures, etc.
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

async function checkProduct(id: string): Promise<Finding[]> {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { _count: { select: { favorites: true } } },
  });
  if (!product) return [{ code: 'not_found', severity: 'block', message: 'Товар не найден' }];
  const findings: Finding[] = [];
  findings.push(...scanForbidden(product.name), ...scanForbidden(product.description));
  if (product.price <= 0) {
    findings.push({ code: 'invalid_price', severity: 'block', message: 'Цена должна быть положительной' });
  }
  if (!product.description) {
    findings.push({ code: 'missing_description', severity: 'review', message: 'Отсутствует описание' });
  }
  // Implants must be tied to a (verified) supplier for traceability.
  if ((product.category || '').toLowerCase().includes('имплант') && !product.supplierId) {
    findings.push({ code: 'missing_supplier', severity: 'review', message: 'Для имплантов требуется привязка к поставщику' });
  }
  return findings;
}

async function checkCourse(id: string): Promise<Finding[]> {
  const course = await prisma.course.findUnique({
    where: { id },
    include: { _count: { select: { lessons: true } } },
  });
  if (!course) return [{ code: 'not_found', severity: 'block', message: 'Курс не найден' }];
  const findings: Finding[] = [];
  findings.push(...scanForbidden(course.title), ...scanForbidden(course.description));
  if (course._count.lessons === 0) {
    findings.push({ code: 'no_lessons', severity: 'review', message: 'В курсе нет уроков' });
  }
  return findings;
}

async function checkSupplier(id: string): Promise<Finding[]> {
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: { _count: { select: { documents: true } } },
  });
  if (!supplier) return [{ code: 'not_found', severity: 'block', message: 'Поставщик не найден' }];
  const findings: Finding[] = [];
  if (!supplier.bin) {
    findings.push({ code: 'missing_bin', severity: 'review', message: 'Не указан БИН' });
  }
  if (supplier._count.documents === 0) {
    findings.push({ code: 'no_documents', severity: 'review', message: 'Нет загруженных документов' });
  }
  return findings;
}

export async function runComplianceCheck(entityType: string, entityId: string) {
  let findings: Finding[];
  switch (entityType) {
    case 'product': findings = await checkProduct(entityId); break;
    case 'course': findings = await checkCourse(entityId); break;
    case 'supplier': findings = await checkSupplier(entityId); break;
    default: throw new Error('Unsupported entityType');
  }
  const status = verdict(findings);
  return prisma.complianceCheck.create({
    data: { entityType, entityId, status, findings: findings as unknown as object },
  });
}
