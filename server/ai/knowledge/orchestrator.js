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

  // 1. Проверить внутреннюю базу знаний
  const directMatch = matchKnowledge(message);
  if (directMatch?.type === 'answer') {
    return {
      directAnswer: directMatch.response,
      source: 'knowledge_base',
    };
  }

  // 2. Собрать из всех источников параллельно
  // 2. Определить приоритеты по ключевым словам (не только по навыку)
  const isShoppingQuery = /стоимост|цена|купить|заказать|бюджет|выбрать|сканер|композит/i.test(msg);
  const isLearningQuery = /курс|обучени|вебинар|статья|научиться|повысить/i.test(msg);
  const effectiveSkill = isShoppingQuery ? 'shopping' : isLearningQuery ? 'learning' : skillId;

  const sources = await Promise.allSettled([
    queryDentVisionDB(message, clinic, skillId),
    queryDentalKnowledge(message, directMatch, digitalTwin),
    querySchool(message, effectiveSkill),
    queryShop(message, effectiveSkill),
  ]);

  // 3. Смержить результаты
  const merged = mergeSources(sources);

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

export default { orchestrateKnowledge };
