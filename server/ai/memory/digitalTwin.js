// ═══════════════════════════════════════════════════════════════
// DIGITAL TWIN — Профессиональный цифровой двойник
//
// AI знает пользователя глубоко:
// - специализацию и опыт
// - оборудование и инструменты
// - пройденные курсы
// - статистику в клинике
// - стиль работы
// - интересы и предпочтения
// - истории покупок
// - достижения
//
// Это позволяет давать персональные рекомендации.
// ═══════════════════════════════════════════════════════════════

import prisma from '../../lib/prisma.js';

const twinCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 минут

export async function buildDigitalTwin(userId) {
  const cached = twinCache.get(userId);
  if (cached && Date.now() - cached.builtAt < CACHE_TTL) {
    return cached.data;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        spec: true,
        role: true,
        platformRole: true,
        city: true,
        country: true,
        experienceYears: true,
        memberships: {
          select: {
            role: true,
            spec: true,
            department: true,
            clinic: { select: { name: true, type: true } },
          },
        },
      },
    });

    if (!user) return null;

    const [skills, certificates, courses, activities, shopOrders] = await Promise.all([
      prisma.userSkill.findMany({
        where: { userId },
        select: { name: true, level: true },
      }),
      prisma.userCertificateModel.findMany({
        where: { userId },
        select: { title: true, issuer: true, year: true },
      }),
      prisma.schoolEnrollment.findMany({
        where: { userId, status: 'completed' },
        select: { courseId: true, completedAt: true },
        include: { course: { select: { title: true, category: true } } },
      }).catch(() => []),
      prisma.userActivity.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { type: true, title: true, createdAt: true },
      }),
      prisma.shopOrder.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, createdAt: true },
        include: { items: { select: { product: { select: { name: true, brand: true, category: true } } } } },
      }).catch(() => []),
    ]);

    const specialties = analyzeSpecialties(user, skills, certificates, courses);
    const equipment = inferEquipment(courses, activities);
    const learningPath = buildLearningPath(courses, certificates, specialties);
    const purchaseProfile = analyzePurchases(shopOrders);
    const activityLevel = assessActivity(activities);

    const twin = {
      userId,
      name: user.name,
      specialty: user.spec || specialties.primary || 'Стоматолог',
      specialties,
      role: user.role || user.platformRole,
      experience: user.experienceYears || 0,
      city: user.city,
      skills: skills.map(s => ({ name: s.name, level: s.level })),
      certificates: certificates.map(c => ({ title: c.title, issuer: c.issuer, year: c.year })),
      completedCourses: courses.length,
      courseCategories: [...new Set(courses.map(c => c.course?.category).filter(Boolean))],
      equipment,
      learningPath,
      purchaseProfile,
      activityLevel,
      recentActivity: activities.slice(0, 5).map(a => a.title),
      builtAt: Date.now(),
    };

    twinCache.set(userId, { data: twin, builtAt: Date.now() });
    return twin;
  } catch {
    return null;
  }
}

function analyzeSpecialties(user, skills, certificates, courses) {
  const allSignals = [];

  if (user.spec) allSignals.push({ source: 'profile', value: user.spec, weight: 3 });
  skills.forEach(s => allSignals.push({ source: 'skill', value: s.name, weight: 2 }));
  certificates.forEach(c => allSignals.push({ source: 'certificate', value: c.title, weight: 2 }));
  courses.forEach(c => {
    if (c.course?.category) allSignals.push({ source: 'course', value: c.course.category, weight: 1 });
  });

  const freq = {};
  for (const s of allSignals) {
    const key = s.value.toLowerCase();
    freq[key] = (freq[key] || 0) + s.weight;
  }

  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  return {
    primary: sorted[0]?.[0] || user.spec || 'Стоматолог',
    secondary: sorted.slice(1, 4).map(([k]) => k),
    confidence: sorted.length > 0 ? Math.min(sorted[0][1] / 10, 1) : 0,
  };
}

function inferEquipment(courses, activities) {
  const equipment = [];
  const keywords = {
    'микроскоп': ['эндодонтический', 'микроскоп', 'эндодонтия'],
    'сканер': ['CEREC', 'сканер', 'CAD', 'CAM', 'intraoral'],
    'лазер': ['лазер', 'laser', 'диодный'],
  };

  const allText = [...courses.map(c => c.course?.title || ''), ...activities.map(a => a.title)]
    .join(' ').toLowerCase();

  for (const [item, triggers] of Object.entries(keywords)) {
    if (triggers.some(t => allText.includes(t.toLowerCase()))) {
      equipment.push(item);
    }
  }

  return equipment;
}

function buildLearningPath(courses, certificates, specialties) {
  const completed = new Set(courses.map(c => c.course?.category).filter(Boolean));
  const certTitles = certificates.map(c => c.title?.toLowerCase() || '').join(' ');

  const paths = [];
  if (specialties.primary?.includes('терапи') && !completed.has('Терапия')) {
    paths.push('Современная терапия кариеса');
  }
  if ((specialties.primary?.includes('ортопед') || specialties.primary?.includes('хирург')) && !completed.has('Имплантация')) {
    paths.push('Дентальная имплантология');
  }
  if (!certTitles.includes('ортодонти')) {
    paths.push('Основы ортодонтии');
  }
  if (specialties.primary?.includes('терапи') && !certTitles.includes('AI')) {
    paths.push('AI в стоматологии');
  }

  return paths;
}

function analyzePurchases(orders) {
  const brands = {};
  const categories = {};

  for (const order of orders) {
    for (const item of order.items || []) {
      const p = item.product;
      if (!p) continue;
      brands[p.brand] = (brands[p.brand] || 0) + 1;
      categories[p.category] = (categories[p.category] || 0) + 1;
    }
  }

  const topBrands = Object.entries(brands).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topCategories = Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return {
    topBrands: topBrands.map(([b, c]) => ({ brand: b, count: c })),
    topCategories: topCategories.map(([cat, c]) => ({ category: cat, count: c })),
    totalOrders: orders.length,
  };
}

function assessActivity(activities) {
  const recentWeek = activities.filter(a => {
    const d = new Date(a.createdAt);
    return Date.now() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
  }).length;

  if (recentWeek >= 10) return 'very_active';
  if (recentWeek >= 5) return 'active';
  if (recentWeek >= 1) return 'moderate';
  return 'low';
}

export default { buildDigitalTwin };
