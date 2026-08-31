import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  clinicFindUnique: vi.fn(),
  apptFindMany: vi.fn(),
  promoFindMany: vi.fn(),
  priceFindMany: vi.fn(),
  memberCount: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  default: {
    clinic: { findUnique: db.clinicFindUnique },
    appointment: { findMany: db.apptFindMany },
    promotion: { findMany: db.promoFindMany },
    priceListItem: { findMany: db.priceFindMany },
    clinicMember: { count: db.memberCount },
  },
}));

// Без ключа модели генератор обязан отдавать детерминированный план —
// именно эту ветку тест и проверяет, никуда не ходя по сети.
vi.mock('../../config.js', () => ({ env: { OPENAI_API_KEY: '' } }));

import { buildMarketingContext, describeContext, plural } from './contentContext.js';
import { generateContentPlan } from './contentPlan.js';

function appt(services: Array<{ name: string; price: number }>, diagnosis?: string, date = new Date()) {
  return { meta: { services, ...(diagnosis ? { diagnosis } : {}) }, date };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.clinicFindUnique.mockResolvedValue({ name: 'Ромашка', city: 'Алматы' });
  db.promoFindMany.mockResolvedValue([]);
  db.priceFindMany.mockResolvedValue([]);
  db.memberCount.mockResolvedValue(3);
  db.apptFindMany.mockResolvedValue([]);
});

describe('plural', () => {
  it('склоняет по русским правилам', () => {
    expect(plural(1, 'приём', 'приёма', 'приёмов')).toBe('приём');
    expect(plural(2, 'приём', 'приёма', 'приёмов')).toBe('приёма');
    expect(plural(5, 'приём', 'приёма', 'приёмов')).toBe('приёмов');
    expect(plural(21, 'приём', 'приёма', 'приёмов')).toBe('приём');
  });

  it('не спотыкается на второй десятке', () => {
    // 11–14 — исключение: «одиннадцать приёмов», а не «приём».
    for (const n of [11, 12, 13, 14]) {
      expect(plural(n, 'приём', 'приёма', 'приёмов'), String(n)).toBe('приёмов');
    }
    expect(plural(111, 'приём', 'приёма', 'приёмов')).toBe('приёмов');
  });

  it('считает ноль множественным', () => {
    expect(plural(0, 'приём', 'приёма', 'приёмов')).toBe('приёмов');
  });
});

describe('buildMarketingContext', () => {
  it('считает частоту услуги и средний чек', async () => {
    db.apptFindMany.mockResolvedValue([
      appt([{ name: 'Профгигиена', price: 18000 }]),
      appt([{ name: 'Профгигиена', price: 22000 }]),
      appt([{ name: 'Лечение кариеса', price: 15000 }]),
    ]);

    const ctx = await buildMarketingContext('c1');

    expect(ctx.topServices[0]).toEqual({ name: 'Профгигиена', count: 2, averagePrice: 20000 });
    expect(ctx.topServices[1]).toMatchObject({ name: 'Лечение кариеса', count: 1 });
  });

  it('не считает услугой заглушку «Услуга»', async () => {
    // Так закрытие приёма называет строку, когда услугу не выбрали.
    // Пост «приходите на Услугу» — это то, ради чего фильтр и стоит.
    db.apptFindMany.mockResolvedValue([appt([{ name: 'Услуга', price: 5000 }])]);
    const ctx = await buildMarketingContext('c1');
    expect(ctx.topServices).toEqual([]);
  });

  it('находит услуги прайса, которых не делали', async () => {
    db.apptFindMany.mockResolvedValue([appt([{ name: 'Профгигиена', price: 18000 }])]);
    db.priceFindMany.mockResolvedValue([
      { name: 'Профгигиена', serviceCode: 's13' },
      { name: 'Отбеливание ZOOM 4', serviceCode: 's138' },
    ]);

    const ctx = await buildMarketingContext('c1');

    expect(ctx.neglectedServices).toEqual(['Отбеливание ZOOM 4']);
  });

  it('достаёт код МКБ-10 из свободного текста диагноза', async () => {
    db.apptFindMany.mockResolvedValue([
      appt([{ name: 'Лечение кариеса', price: 15000 }], 'K02.1 — Кариес дентина'),
      appt([{ name: 'Лечение кариеса', price: 15000 }], 'K02.1 — Кариес дентина'),
    ]);
    const ctx = await buildMarketingContext('c1');
    expect(ctx.frequentDiagnoses[0]).toEqual({ code: 'K02.1', count: 2 });
  });

  it('молчит о спаде, когда месяцев меньше трёх', async () => {
    // На двух месяцах «самый пустой месяц» — не сезонность, а отсутствие
    // истории. Утверждать такое в посте нельзя.
    const jan = new Date('2026-01-15');
    const feb = new Date('2026-02-15');
    db.apptFindMany.mockImplementation(({ select }: any) =>
      Promise.resolve(select?.date ? [{ date: jan }, { date: jan }, { date: feb }] : []));

    const ctx = await buildMarketingContext('c1');

    expect(ctx.busiestMonth).toMatchObject({ month: 'январь' });
    expect(ctx.quietestMonth).toBeNull();
  });
});

describe('describeContext', () => {
  it('честно говорит, когда статистики нет', async () => {
    const ctx = await buildMarketingContext('c1');
    expect(describeContext(ctx)).toContain('статистики по услугам пока не набралось');
  });
});

describe('generateContentPlan без ключа модели', () => {
  it('строит план из фактов, а не из воздуха', async () => {
    db.apptFindMany.mockResolvedValue([
      appt([{ name: 'Профгигиена', price: 18000 }]),
      appt([{ name: 'Профгигиена', price: 18000 }]),
    ]);

    const plan = await generateContentPlan({ clinicId: 'c1', count: 3 });

    expect(plan.deterministic).toBe(true);
    expect(plan.ideas.length).toBeGreaterThan(0);
    // Каждая идея обязана назвать факт, на котором стоит.
    for (const idea of plan.ideas) {
      expect(idea.basedOn.length).toBeGreaterThan(10);
      expect(idea.caption.length).toBeGreaterThan(20);
    }
    expect(plan.ideas[0].basedOn).toContain('Профгигиена');
    // Текст уходит прямо в пост: «1 приёмов» там недопустимо.
    for (const idea of plan.ideas) {
      expect(idea.basedOn).not.toMatch(/\b1 приёмов\b/);
      expect(idea.caption).not.toMatch(/\b1 раза\b/);
    }
  });

  it('подхватывает действующую акцию', async () => {
    db.promoFindMany.mockResolvedValue([
      { title: 'Чистка со скидкой', description: 'До конца месяца', discountPercent: 20, endDate: new Date('2026-09-30') },
    ]);
    const plan = await generateContentPlan({ clinicId: 'c1', count: 5 });
    expect(plan.ideas.some((i) => i.basedOn.includes('Чистка со скидкой'))).toBe(true);
  });

  it('держит количество идей в разумных границах', async () => {
    db.apptFindMany.mockResolvedValue([appt([{ name: 'Профгигиена', price: 18000 }])]);
    const plan = await generateContentPlan({ clinicId: 'c1', count: 999 });
    expect(plan.ideas.length).toBeLessThanOrEqual(12);
  });
});
