// ═══════════════════════════════════════════════════════════════
// KNOWLEDGE ORCHESTRATOR — Оркестратор знаний
//
// Question → Knowledge Router → Sources → Merge → Answer
//
// Источники (строгий приоритет):
// 1. DentVision DB (CRM, пациенты, расписание, финансы, склад)
// 2. Внутренняя база знаний (протоколы, клин. рекомендации)
// 3. School (курсы, статьи, вебинары)
// 4. DentVision Shop (товары, оборудование)
// 5. Внешние источники (научные публикации)
//
// AI НЕ продаёт. AI консультирует.
// Товары показываются ТОЛЬКО после объективной рекомендации.
// ═══════════════════════════════════════════════════════════════

import prisma from '../../lib/prisma.js';
import { DENTAL_KNOWLEDGE, matchKnowledge } from '../knowledge.js';

export async function orchestrateKnowledge(message, ctx) {
  const { user, clinic, clinicContext, skillId, digitalTwin } = ctx;
  const msg = message.toLowerCase();

  // 1. Проверить внутреннюю базу знаний (быстрый ответ)
  const directMatch = matchKnowledge(message);
  if (directMatch?.type === 'answer') {
    const specialty = digitalTwin?.specialty || user?.spec || '';
    const personalized = specialty ? `\n\nУчитывая вашу специализацию (${specialty}), ` : '\n\n';

    // Параллельно ищем товары и курсы для дополнения ответа
    const enrichment = await Promise.allSettled([
      queryShop(message, 'shopping'),
      querySchool(message, 'learning'),
    ]);

    const products = enrichment[0].status === 'fulfilled' ? enrichment[0].value : null;
    const courses = enrichment[1].status === 'fulfilled' ? enrichment[1].value : null;

    let reply = directMatch.response;
    const extraData = {};
    const recs = [];

    if (products?.data) {
      extraData.products = products.data;
      recs.push(...(Array.isArray(products.data) ? products.data : []));
      reply += `\n\n**Доступно в DentVision Shop:**\n${formatProducts(products.data)}`;
    }

    if (courses?.data) {
      extraData.courses = courses.data;
      if (!recs.length) recs.push(...(Array.isArray(courses.data) ? courses.data : []));
      reply += `\n\n**Рекомендую курсы в Academy:**\n${formatCourses(courses.data)}`;
    }

    return {
      directAnswer: reply,
      source: 'knowledge_base',
      data: Object.keys(extraData).length ? extraData : undefined,
      recommendations: recs.length ? recs : undefined,
    };
  }

  // 2. Определить тип запроса по ключевым словам (не только по навыку)
  const isEquipmentQuery = /сканер|микроскоп|компрессор|автоклав|кресло|лазер|рентген|визиограф|аппарат|инструмент/i.test(msg);
  const isMaterialQuery = /композит|керамик|цирконий|имплант|анестетик|материал|пломб/i.test(msg);
  const isShoppingQuery = /стоимост|цена|купить|заказать|бюджет|выбрать|подбер/i.test(msg) || isEquipmentQuery || isMaterialQuery;
  const isLearningQuery = /курс|обучени|вебинар|статья|научиться|повысить|лекц/i.test(msg);
  const effectiveSkill = isShoppingQuery ? 'shopping' : isLearningQuery ? 'learning' : skillId;

  // 3. Собрать из всех источников параллельно
  const sources = await Promise.allSettled([
    queryDentVisionDB(message, clinic, skillId),
    queryDentalKnowledge(message, directMatch, digitalTwin),
    querySchool(message, effectiveSkill),
    queryShop(message, effectiveSkill),
  ]);

  // 4. Смержить результаты
  const merged = mergeSources(sources);

  // 5. Если запрос про оборудование/материалы и товаров нет — добавить уведомление
  if (merged && (isEquipmentQuery || isMaterialQuery)) {
    const hasProducts = sources.some(s => s.status === 'fulfilled' && s.value?.type === 'products');
    if (!hasProducts) {
      merged.contextual += '\n\nВ DentVision Shop этого товара пока нет. Могу предложить аналоги или помочь найти информацию о производителе.';
    }
    // Добавить специализацию в контекст
    if (digitalTwin?.specialty) {
      merged.contextual = `Для специалиста по ${digitalTwin.specialty}.\n\n${merged.contextual}`;
    }
  }

  return merged;
}

// ─── SOURCE: DentVision Database ─────────────────────────────

async function queryDentVisionDB(message, clinic, skillId) {
  if (!clinic?.id) return null;
  const msg = message.toLowerCase();

  try {
    if (/пациент/i.test(msg)) {
      const nameMatch = msg.match(/пациент[а-я]*\s+([а-яё]+)/i);
      if (nameMatch) {
        const patients = await prisma.patient.findMany({
          where: {
            clinicId: clinic.id,
            name: { contains: nameMatch[1], mode: 'insensitive' },
          },
          take: 5,
          select: { id: true, name: true, phone: true, lastVisit: true },
        });
        if (patients.length > 0) {
          return {
            source: 'database',
            type: 'patients',
            data: patients,
            text: `Найдено ${patients.length} ${patients.length === 1 ? 'пациент' : 'пациентов'}: ${patients.map(p => p.name).join(', ')}`,
          };
        }
      }
    }

    if (/расписан/i.test(msg) || /запис/i.test(msg)) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const appointments = await prisma.appointment.findMany({
        where: { clinicId: clinic.id, date: { gte: today, lt: tomorrow } },
        orderBy: { date: 'asc' },
        select: { patientName: true, service: true, date: true, status: true, doctorName: true },
      });
      if (appointments.length > 0) {
        const list = appointments.map(a =>
          `${new Date(a.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} — ${a.patientName}${a.service ? ', ' + a.service : ''}`
        ).join('\n');
        return { source: 'database', type: 'schedule', data: appointments, text: `Расписание на сегодня:\n${list}` };
      }
      return { source: 'database', type: 'schedule', data: [], text: 'На сегодня записей нет.' };
    }

    if (/финанс|выручк|средн|счёт|счет|деньг/i.test(msg)) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const receipts = await prisma.receipt.aggregate({
        where: { clinicId: clinic.id, createdAt: { gte: today } },
        _sum: { total: true },
        _count: true,
      });
      return {
        source: 'database', type: 'finance',
        data: { revenue: receipts._sum.total || 0, count: receipts._count },
        text: `Сегодня: ${receipts._count} чеков, ${(receipts._sum.total || 0).toLocaleString('ru-RU')} ₸`,
      };
    }

    if (/лаборатор|лабор/i.test(msg)) {
      const orders = await prisma.labOrder.findMany({
        where: { clinicId: clinic.id, status: { in: ['pending', 'in_progress'] } },
        take: 10,
        select: { patientName: true, type: true, status: true, deadline: true },
      });
      if (orders.length > 0) {
        const list = orders.map(o => `- ${o.patientName}: ${o.type} (${o.status})`).join('\n');
        return { source: 'database', type: 'lab', data: orders, text: `Активные заказы:\n${list}` };
      }
    }
  } catch {
    return null;
  }

  return null;
}

// ─── SOURCE: School ──────────────────────────────────────────

async function querySchool(message, skillId) {
  if (skillId !== 'learning' && skillId !== 'research' && skillId !== 'shopping') return null;
  const msg = message.toLowerCase();

  try {
    const courses = await prisma.schoolCourse.findMany({
      where: {
        OR: [
          { title: { contains: message, mode: 'insensitive' } },
          { category: { contains: message, mode: 'insensitive' } },
          { tags: { has: message } },
          { tags: { hasSome: extractKeywords(msg) } },
        ],
      },
      orderBy: { rating: 'desc' },
      take: 5,
      select: { id: true, title: true, subtitle: true, category: true, instructor: true, durationHours: true, rating: true, enrolledCount: true },
    });

    if (courses.length > 0) {
      return {
        source: 'school',
        type: 'courses',
        data: courses,
        text: `Найдено ${courses.length} ${courses.length === 1 ? 'курс' : 'курсов'} в Academy`,
      };
    }
  } catch {
    return null;
  }

  return null;
}

// ─── SOURCE: Shop ────────────────────────────────────────────

async function queryShop(message, skillId) {
  if (skillId !== 'shopping') return null;

  try {
    const products = await prisma.shopProduct.findMany({
      where: {
        OR: [
          { name: { contains: message, mode: 'insensitive' } },
          { brand: { contains: message, mode: 'insensitive' } },
          { description: { contains: message, mode: 'insensitive' } },
          { tags: { hasSome: extractKeywords(message.toLowerCase()) } },
        ],
      },
      orderBy: { rating: 'desc' },
      take: 8,
      select: { id: true, name: true, brand: true, price: true, rating: true, reviewCount: true, description: true, stock: true },
    });

    if (products.length > 0) {
      return {
        source: 'shop',
        type: 'products',
        data: products,
        text: `В каталоге найдено ${products.length} ${products.length === 1 ? 'товар' : 'товаров'}`,
      };
    }
  } catch {
    return null;
  }

  return null;
}

// ─── SOURCE: Dental Knowledge ────────────────────────────────

async function queryDentalKnowledge(message, directMatch, digitalTwin) {
  if (directMatch?.type === 'topic') {
    let context = directMatch.context || '';
    if (digitalTwin?.specialty) {
      context += `\nСпециализация пользователя: ${digitalTwin.specialty}.`;
    }
    return {
      source: 'knowledge_base',
      type: 'dental_expertise',
      data: { category: directMatch.category, name: directMatch.name },
      text: context,
    };
  }

  if (directMatch?.type === 'specialty') {
    return {
      source: 'knowledge_base',
      type: 'specialty',
      data: { name: directMatch.name, topics: directMatch.topics },
      text: `${directMatch.description}. Ключевые темы: ${directMatch.topics.slice(0, 5).join(', ')}`,
    };
  }

  return null;
}

// ─── MERGE ───────────────────────────────────────────────────

const SOURCE_PRIORITY = ['database', 'knowledge_base', 'school', 'shop', 'manufacturer'];

function mergeSources(results) {
  const texts = [];
  let data = null;
  let recommendations = null;
  let source = 'internal';
  let bestPriority = Infinity;

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      const v = r.value;
      const priority = SOURCE_PRIORITY.indexOf(v.source || 'internal');
      if (v.text) texts.push(v.text);
      if (v.data) {
        if (!data) data = {};
        data[v.type] = v.data;
      }
      if (v.type === 'products') recommendations = v.data;
      if (v.type === 'courses' && !recommendations) recommendations = v.data;
      if (priority >= 0 && priority < bestPriority) {
        bestPriority = priority;
        source = v.source || source;
      }
    }
  }

  if (texts.length === 0) return null;

  return {
    contextual: texts.join('\n\n'),
    data,
    recommendations,
    source,
  };
}

function extractKeywords(text) {
  const dental = [
    'терапия', 'хирургия', 'ортопедия', 'ортодонтия', 'пародонтология',
    'имплантация', 'эндодонтия', 'гигиена', 'отбеливание', 'реставрация',
    'композит', 'керамика', 'цирконий', 'имплант', 'микроскоп',
  ];
  return dental.filter(k => text.includes(k));
}

function formatProducts(products) {
  if (!products?.length) return '';
  return products.slice(0, 4).map(p =>
    `• ${p.brand ? p.brand + ' ' : ''}${p.name} — ${p.price?.toLocaleString('ru-RU') || 'цена по запросу'} ₸, рейтинг ${p.rating || '—'}`
  ).join('\n');
}

function formatCourses(courses) {
  if (!courses?.length) return '';
  return courses.slice(0, 4).map(c =>
    `• «${c.title}» — ${c.instructor || c.category || ''}, ${c.durationHours || ''} ч.`
  ).join('\n');
}

export default { orchestrateKnowledge };
