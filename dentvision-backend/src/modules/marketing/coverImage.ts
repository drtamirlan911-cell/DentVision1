/**
 * Обложки и слайды для контент-плана.
 *
 * Устроено как озвучка презентаций (`patient-presentation/voice.service.ts`),
 * потому что задача та же: сходить в модель за бинарём, положить его в
 * объектное хранилище и отдавать подписанной ссылкой. Ключ кэша
 * содержательный — один и тот же промпт генерируется на платформе один раз.
 *
 * Это первая функция в проекте, где каждая единица работы стоит денег.
 * Отсюда три вещи, которых нет у текстовой генерации: кэш, дневной потолок и
 * отказ вместо тихой деградации.
 */

import { createHash } from 'node:crypto';
import { env } from '../../config.js';
import prisma from '../../lib/prisma.js';
import { storageConfigured, toStorageUrl, uploadObject } from '../../lib/storage.js';
import { incrementDaily, utcDay } from '../../lib/dailyCounter.js';
import { providerFetch } from '../ai/lib/providerFetch.js';

const IMAGES_ENDPOINT = 'https://api.openai.com/v1/images/generations';
const DEFAULT_SIZE = '1024x1024';
const REQUEST_TIMEOUT_MS = 90_000;

/** Сколько слайдов максимум в одной карусели. */
export const MAX_CAROUSEL_SLIDES = 5;

/**
 * Доступна ли генерация вообще.
 *
 * Обе половины обязательны. Без ключа некому рисовать; без хранилища
 * результат некуда положить — а класть многомегабайтный base64 в колонку
 * Postgres нельзя, это прямо описано как неповторяемая ошибка в шапке
 * `lib/imageUrl.ts`.
 */
export function imagesConfigured(): boolean {
  return Boolean(env.OPENAI_API_KEY) && storageConfigured();
}

export function imageCacheKey(prompt: string, size: string): string {
  return createHash('sha256')
    .update(`openai|${env.OPENAI_IMAGE_MODEL}|${size}|${prompt.trim()}`)
    .digest('hex');
}

export interface IdeaForPrompt {
  title: string;
  format: string;
  hook: string;
  basedOn: string;
}

/**
 * Промпт обложки.
 *
 * Запреты здесь — не стилистика, а суть. Сгенерированное «до и после» или
 * лицо, поданное как пациент клиники, — это выдуманное клиническое
 * утверждение в медицинской рекламе. Цена такой картинки не косметическая,
 * поэтому запреты закреплены тестом и не должны потеряться при следующей
 * правке формулировок.
 *
 * Текст на изображении запрещён отдельно: модели коверкают кириллицу, и
 * подпись всё равно набирается поверх при вёрстке поста.
 */
export function buildImagePrompt(idea: IdeaForPrompt, clinicName: string): string {
  return [
    `Фотореалистичное изображение для соцсетей стоматологической клиники «${clinicName}».`,
    `Тема: ${idea.title}. Настроение: ${idea.hook}`,
    '',
    'Стиль: современный светлый интерьер клиники, мягкий естественный свет,',
    'спокойная нейтральная палитра, предметная съёмка, много воздуха.',
    '',
    'СТРОГО ЗАПРЕЩЕНО:',
    '- узнаваемые лица людей и любые изображения, подаваемые как пациенты клиники;',
    '- сравнения «до и после» в любом виде;',
    '- крупные планы зубов, ротовой полости и всё, что читается как клинический результат;',
    '- любой текст, надписи, цифры и буквы на изображении;',
    '- логотипы, вывески и узнаваемые бренды;',
    '- медицинские процедуры в процессе, кровь, инструменты в контакте с человеком.',
  ].join('\n');
}

interface ImagesResponse {
  data?: Array<{ b64_json?: string }>;
}

/**
 * Сгенерировать картинку и положить в хранилище.
 *
 * Возвращает `s3://<key>` либо `null`, если модель ничего не отдала. Ошибку
 * сети и провайдера пробрасывает: маршрут выше отличает «кончились деньги» от
 * «притормози» и отвечает пользователю по-разному.
 */
export async function generateImage(args: {
  clinicId: string;
  prompt: string;
  size?: string;
}): Promise<string | null> {
  const size = args.size || DEFAULT_SIZE;
  const cacheKey = imageCacheKey(args.prompt, size);

  // Кэш — единственная причина, по которой повторный клик бесплатен.
  const cached = await prisma.marketingAsset.findUnique({ where: { cacheKey } });
  if (cached) {
    await prisma.marketingAsset.update({
      where: { cacheKey },
      data: { lastUsedAt: new Date() },
    });
    return cached.storageUrl;
  }

  const response = await providerFetch<ImagesResponse>(IMAGES_ENDPOINT, {
    apiKey: env.OPENAI_API_KEY!,
    timeoutMs: REQUEST_TIMEOUT_MS,
    body: {
      model: env.OPENAI_IMAGE_MODEL,
      prompt: args.prompt,
      size,
      n: 1,
    },
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) return null;

  const buffer = Buffer.from(b64, 'base64');
  const key = `marketing/${args.clinicId}/${cacheKey}.png`;
  await uploadObject(key, buffer, 'image/png');
  const storageUrl = toStorageUrl(key);

  await prisma.marketingAsset.create({
    data: {
      cacheKey,
      model: env.OPENAI_IMAGE_MODEL,
      size,
      storageUrl,
      bytes: buffer.byteLength,
    },
  });

  return storageUrl;
}

export interface QuotaState {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}

/**
 * Взять из дневного потолка и сказать, хватило ли.
 *
 * Форма — как у `enforceGuestAiQuota`: списать и проверить одним движением,
 * потому что проверка отдельно от списания это гонка.
 *
 * Без Redis `incrementDaily` возвращает `null`, и счёт ведётся в памяти
 * процесса — как у остальных квот проекта. Это значит, что на двух инстансах
 * потолок фактически удваивается. Отказывать в такой ситуации нельзя: это
 * сломало бы развёртывание без Redis целиком.
 */
const localCounts = new Map<string, { day: string; count: number }>();

export async function consumeImageQuota(clinicId: string, cost = 1): Promise<QuotaState> {
  const limit = env.MARKETING_IMAGE_DAILY_LIMIT;
  const day = utcDay();
  const key = `marketing:img:${clinicId}:${day}`;

  let used = await incrementDaily(key, cost);
  if (used === null) {
    const local = localCounts.get(clinicId);
    const base = local && local.day === day ? local.count : 0;
    used = base + cost;
    localCounts.set(clinicId, { day, count: used });
  }

  return {
    allowed: used <= limit,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}

/** Сколько ещё можно сегодня — без списания, для показа на экране. */
export async function peekImageQuota(clinicId: string): Promise<QuotaState> {
  const limit = env.MARKETING_IMAGE_DAILY_LIMIT;
  const day = utcDay();
  const { readDaily } = await import('../../lib/dailyCounter.js');
  let used = await readDaily(`marketing:img:${clinicId}:${day}`);
  if (used === null) {
    const local = localCounts.get(clinicId);
    used = local && local.day === day ? local.count : 0;
  }
  return { allowed: used < limit, used, limit, remaining: Math.max(0, limit - used) };
}

/** Только для тестов: обнулить счётчик в памяти процесса. */
export function __resetImageQuotaForTests(): void {
  localCounts.clear();
}
