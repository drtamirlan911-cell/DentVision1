/**
 * Контент-план клиники: идеи постов, привязанные к её собственным данным.
 *
 * Модель получает не пустой лист, а сводку из `contentContext`: что в клинике
 * реально делают, по каким ценам, какие акции идут, в каком месяце проседает
 * запись. Каждая идея обязана назвать, на какой факт она опирается — поле
 * `basedOn` в схеме ответа не необязательное. Без него «идея» была бы
 * неотличима от того, что можно написать про любую клинику мира.
 *
 * Без ключа модели возвращается детерминированный план, собранный из тех же
 * фактов. Он беднее по формулировкам, но не врёт и не оставляет экран пустым —
 * тот же приём, что и у остального ИИ в этом проекте.
 */

import { env } from '../../config.js';
import { simpleChat } from '../ai/llm/client.js';
import { buildMarketingContext, describeContext, plural, type MarketingContext } from './contentContext.js';

export type ContentFormat = 'post' | 'reels' | 'story' | 'carousel';

export interface ContentIdea {
  /** Заголовок идеи — о чём пост. */
  title: string;
  /** Формат подачи. */
  format: ContentFormat;
  /** Первая фраза, которая останавливает пролистывание. */
  hook: string;
  /** Готовый текст подписи. */
  caption: string;
  hashtags: string[];
  /** Действие, к которому ведёт пост. */
  callToAction: string;
  /** Факт из данных клиники, на котором построена идея. */
  basedOn: string;
}

export interface ContentPlan {
  ideas: ContentIdea[];
  /** Чем план обоснован — та же сводка, что ушла в модель. */
  context: MarketingContext;
  /** true, когда план собран без модели. */
  deterministic: boolean;
}

const FORMATS: ContentFormat[] = ['post', 'reels', 'story', 'carousel'];

const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ideas'],
  properties: {
    ideas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'format', 'hook', 'caption', 'hashtags', 'callToAction', 'basedOn'],
        properties: {
          title: { type: 'string' },
          format: { type: 'string', enum: FORMATS },
          hook: { type: 'string' },
          caption: { type: 'string' },
          hashtags: { type: 'array', items: { type: 'string' } },
          callToAction: { type: 'string' },
          basedOn: { type: 'string' },
        },
      },
    },
  },
} as const;

function systemPrompt(count: number, tone: string): string {
  return `Ты — контент-стратег стоматологической клиники. Пишешь по-русски, для соцсетей.

Твоя задача: ${count} идей постов, каждая опирается на конкретный факт о ЭТОЙ клинике.

ПРАВИЛА:
1. Каждая идея обязана иметь basedOn — факт из присланных данных, на котором она построена. Не «стоматология важна», а «профгигиена — вторая по частоте услуга, средний чек 18 000 ₸».
2. Не выдумывай цифры, услуги, врачей и результаты, которых нет в данных.
3. Не обещай медицинский результат и не ставь диагноз. Это реклама клиники, а не консультация.
4. Хук — одна фраза, ради которой останавливаются. Без «Дорогие друзья» и «Знаете ли вы».
5. Подпись — 3–6 предложений, живым языком, без канцелярита и без нагромождения эмодзи.
6. Хештеги — 5–8, по-русски и по делу, без мусорных «#инстаграм».
7. Тональность: ${tone}.
8. Форматы чередуй: пост, reels, сторис, карусель.`;
}

/** План из фактов, когда модель недоступна. */
function deterministicPlan(ctx: MarketingContext, count: number): ContentIdea[] {
  const ideas: ContentIdea[] = [];

  for (const s of ctx.topServices.slice(0, count)) {
    const times = `${s.count} ${plural(s.count, 'раз', 'раза', 'раз')}`;
    const visits = `${s.count} ${plural(s.count, 'приём', 'приёма', 'приёмов')}`;
    ideas.push({
      title: `${s.name}: как это проходит`,
      format: 'post',
      // «Одна из самых частых» на единственном приёме — преувеличение,
      // а пост клиники не должен начинаться с натяжки.
      hook: s.count > 2
        ? `${s.name} — одна из самых частых процедур в клинике.`
        : `${s.name}: рассказываем, как проходит приём.`,
      caption: `За последние полгода мы провели ${s.name.toLowerCase()} ${times}. Рассказываем, как проходит приём, сколько занимает времени и что чувствует пациент. Средняя стоимость — ${s.averagePrice.toLocaleString('ru-RU')} ₸.`,
      hashtags: ['#стоматология', '#здоровыезубы', '#лечениезубов'],
      callToAction: 'Записаться на приём',
      basedOn: `Услуга «${s.name}»: ${visits} за полгода, средний чек ${s.averagePrice} ₸.`,
    });
  }

  for (const p of ctx.activePromotions) {
    if (ideas.length >= count) break;
    ideas.push({
      title: p.title,
      format: 'story',
      hook: p.discountPercent ? `−${p.discountPercent}% — до конца акции.` : p.title,
      caption: p.description || p.title,
      hashtags: ['#акция', '#стоматология'],
      callToAction: 'Записаться по акции',
      basedOn: `Действующая акция «${p.title}»${p.endsAt ? ` до ${p.endsAt}` : ''}.`,
    });
  }

  if (ctx.quietestMonth && ideas.length < count) {
    ideas.push({
      title: `Свободные окна в ${ctx.quietestMonth.month}`,
      format: 'story',
      hook: `В ${ctx.quietestMonth.month} у нас больше свободного времени, чем обычно.`,
      caption: `${ctx.quietestMonth.month} — самый спокойный месяц в клинике. Это лучшее время для плановых процедур: можно выбрать удобное время и не спешить.`,
      hashtags: ['#записькврачу', '#стоматология'],
      callToAction: 'Выбрать время',
      basedOn: `Спад записи: ${ctx.quietestMonth.month}, ${ctx.quietestMonth.appointments} ${plural(ctx.quietestMonth.appointments, 'приём', 'приёма', 'приёмов')}.`,
    });
  }

  for (const name of ctx.neglectedServices) {
    if (ideas.length >= count) break;
    ideas.push({
      title: `${name}: делаем, но об этом мало кто знает`,
      format: 'carousel',
      hook: `${name} — услуга, о которой чаще всего спрашивают уже в кресле.`,
      caption: `Эта услуга есть в нашем прайсе, но записываются на неё редко. Рассказываем, кому она нужна и почему её стоит не откладывать.`,
      hashtags: ['#стоматология', '#услугиклиники'],
      callToAction: 'Узнать подробнее',
      basedOn: `Услуга «${name}» есть в прайсе, но за полгода ни одного приёма.`,
    });
  }

  return ideas.slice(0, count);
}

export async function generateContentPlan(args: {
  clinicId: string;
  count?: number;
  tone?: string;
}): Promise<ContentPlan> {
  const count = Math.min(Math.max(Number(args.count) || 6, 1), 12);
  const tone = String(args.tone || 'спокойная, профессиональная, без давления').slice(0, 120);
  const context = await buildMarketingContext(args.clinicId);

  if (!env.OPENAI_API_KEY) {
    return { ideas: deterministicPlan(context, count), context, deterministic: true };
  }

  try {
    const raw = await simpleChat(
      systemPrompt(count, tone),
      `Данные клиники:\n\n${describeContext(context)}`,
      { jsonSchema: { name: 'content_plan', schema: PLAN_SCHEMA as unknown as Record<string, unknown> }, maxTokens: 3000 },
    );
    const parsed = JSON.parse(raw) as { ideas?: ContentIdea[] };
    const ideas = Array.isArray(parsed.ideas) ? parsed.ideas.slice(0, count) : [];
    // Пустой ответ модели — не повод показать пустой экран.
    if (ideas.length === 0) {
      return { ideas: deterministicPlan(context, count), context, deterministic: true };
    }
    return { ideas, context, deterministic: false };
  } catch {
    return { ideas: deterministicPlan(context, count), context, deterministic: true };
  }
}
