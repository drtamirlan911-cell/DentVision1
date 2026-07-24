import prisma from '../../lib/prisma.js';
import { runComplianceCheck, type Finding } from '../compliance/compliance.service.js';

// AI Governance (Phase 6, DENTVISION_V2_INTEGRATION_PLAN.md §5.4 / §6.4).
// Rule-based agents consistent with the platform's intent-engine approach
// (no external LLM): Quality Control (wraps Compliance), Supplier Agent and
// Course Builder helpers.

// Turns compliance findings into actionable recommendations.
function recommendationsFromFindings(findings: Finding[]): string[] {
  const map: Record<string, string> = {
    missing_description: 'Добавьте подробное описание — это повышает доверие и конверсию.',
    missing_bin: 'Укажите БИН компании для верификации.',
    no_documents: 'Загрузите лицензии/сертификаты, чтобы получить статус Verified.',
    missing_supplier: 'Привяжите товар к проверенному поставщику.',
    no_lessons: 'Добавьте уроки — курс без уроков не может быть опубликован.',
    invalid_price: 'Исправьте цену: должна быть положительной.',
    forbidden_claim: 'Уберите недопустимые рекламные заявления (требования РК к рекламе медуслуг).',
  };
  return findings.map((f) => map[f.code] || f.message);
}

export async function aiQualityReview(entityType: string, entityId: string) {
  const check = await runComplianceCheck(entityType, entityId);
  const findings = (check.findings as unknown as Finding[]) || [];
  return {
    entityType,
    entityId,
    verdict: check.status,
    findings,
    recommendations: recommendationsFromFindings(findings),
    badgeEligible: check.status === 'approved',
  };
}

// AI Supplier Agent — profile-completeness + verification next-step guidance,
// plus a naive market price comparison against the category average.
export async function aiSupplierSuggest(supplierId: string) {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    include: { products: true, _count: { select: { documents: true } } },
  });
  if (!supplier) throw new Error('Supplier not found');

  const suggestions: string[] = [];
  if (!supplier.bin) suggestions.push('Заполните БИН для прохождения верификации.');
  if (supplier._count.documents === 0) suggestions.push('Загрузите документы (лицензии, сертификаты).');
  if (supplier.status === 'pending') suggestions.push('Отправьте документы на проверку, чтобы перейти в Documents Review.');
  if (supplier.status === 'verified') suggestions.push('Наращивайте продажи и рейтинг для статуса Official Partner.');

  // Naive price comparison per product vs its category average.
  const priceInsights: Array<{ product: string; price: number; categoryAvg: number; deltaPct: number }> = [];
  for (const p of supplier.products) {
    if (!p.category) continue;
    const agg = await prisma.product.aggregate({ where: { category: p.category }, _avg: { price: true } });
    const avg = agg._avg.price || p.price;
    const deltaPct = avg ? Math.round(((p.price - avg) / avg) * 100) : 0;
    priceInsights.push({ product: p.name, price: p.price, categoryAvg: Math.round(avg), deltaPct });
    if (deltaPct > 15) {
      suggestions.push(`«${p.name}» дороже рынка на ${deltaPct}% — добавьте клинические исследования/видео или скорректируйте цену.`);
    }
  }

  return { supplierId, status: supplier.status, suggestions, priceInsights };
}

// AI Course Builder — deterministic outline generator (rule-based template).
export function aiCourseOutline(title: string, level = 'Beginner') {
  const t = title.toLowerCase();
  let modules: string[];
  if (t.includes('винир')) {
    modules = ['Диагностика и планирование улыбки', 'Препарирование под виниры', 'Оттиски и коммуникация с лабораторией', 'Фиксация виниров'];
  } else if (t.includes('имплант')) {
    modules = ['Диагностика и планирование', 'Хирургический протокол', 'Костная пластика', 'Протезирование на имплантах'];
  } else if (t.includes('эндодонт') || t.includes('канал')) {
    modules = ['Диагностика пульпы', 'Механическая обработка каналов', 'Ирригация', 'Обтурация'];
  } else {
    modules = ['Введение и теория', 'Диагностика', 'Клинический протокол', 'Практика и разбор случаев'];
  }
  return {
    title,
    level,
    modules: modules.map((name, i) => ({ order: i + 1, title: `Модуль ${i + 1}: ${name}`, lessons: 3 })),
    finalTest: { questions: 30, passScore: 70 },
    estimatedLessons: modules.length * 3,
  };
}
