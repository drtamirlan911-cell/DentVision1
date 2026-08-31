import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  assetFindUnique: vi.fn(),
  assetCreate: vi.fn(),
  assetUpdate: vi.fn(),
}));
const redis = vi.hoisted(() => ({ incrementDaily: vi.fn(), readDaily: vi.fn() }));
const net = vi.hoisted(() => ({ providerFetch: vi.fn() }));
const s3 = vi.hoisted(() => ({ storageConfigured: vi.fn(), uploadObject: vi.fn() }));

vi.mock('../../lib/prisma.js', () => ({
  default: { marketingAsset: { findUnique: db.assetFindUnique, create: db.assetCreate, update: db.assetUpdate } },
}));
vi.mock('../../lib/dailyCounter.js', () => ({
  incrementDaily: redis.incrementDaily,
  readDaily: redis.readDaily,
  utcDay: () => '2026-08-30',
}));
vi.mock('../ai/lib/providerFetch.js', () => ({ providerFetch: net.providerFetch }));
vi.mock('../../lib/storage.js', () => ({
  storageConfigured: s3.storageConfigured,
  uploadObject: s3.uploadObject,
  toStorageUrl: (k: string) => `s3://${k}`,
}));

const cfg = vi.hoisted(() => ({
  env: { OPENAI_API_KEY: 'sk-test', OPENAI_IMAGE_MODEL: 'gpt-image-1', MARKETING_IMAGE_DAILY_LIMIT: 10 },
}));
vi.mock('../../config.js', () => cfg);

import {
  imagesConfigured, imageCacheKey, buildImagePrompt, generateImage,
  consumeImageQuota, __resetImageQuotaForTests,
} from './coverImage.js';

const IDEA = { title: 'Профгигиена', format: 'post', hook: 'Чистка раз в полгода', basedOn: 'Услуга, 12 приёмов' };

beforeEach(() => {
  vi.clearAllMocks();
  __resetImageQuotaForTests();
  cfg.env.OPENAI_API_KEY = 'sk-test';
  s3.storageConfigured.mockReturnValue(true);
  db.assetFindUnique.mockResolvedValue(null);
  db.assetCreate.mockResolvedValue({});
  redis.incrementDaily.mockResolvedValue(null);
  redis.readDaily.mockResolvedValue(null);
});

describe('imagesConfigured', () => {
  it('требует обе половины', () => {
    expect(imagesConfigured()).toBe(true);

    s3.storageConfigured.mockReturnValue(false);
    expect(imagesConfigured(), 'без хранилища результат некуда положить').toBe(false);

    s3.storageConfigured.mockReturnValue(true);
    cfg.env.OPENAI_API_KEY = '';
    expect(imagesConfigured(), 'без ключа некому рисовать').toBe(false);
  });
});

describe('imageCacheKey', () => {
  it('устойчив к повтору', () => {
    expect(imageCacheKey('кот', '1024x1024')).toBe(imageCacheKey('кот', '1024x1024'));
  });

  it('различает размер и промпт', () => {
    expect(imageCacheKey('кот', '1024x1024')).not.toBe(imageCacheKey('кот', '512x512'));
    expect(imageCacheKey('кот', '1024x1024')).not.toBe(imageCacheKey('пёс', '1024x1024'));
  });

  it('не считает лишние пробелы разным запросом', () => {
    // Иначе случайный перенос строки в промпте стоил бы ещё одной генерации.
    expect(imageCacheKey('  кот  ', '1024x1024')).toBe(imageCacheKey('кот', '1024x1024'));
  });
});

describe('buildImagePrompt', () => {
  const prompt = buildImagePrompt(IDEA, 'Ромашка');

  it('называет клинику и тему', () => {
    expect(prompt).toContain('Ромашка');
    expect(prompt).toContain('Профгигиена');
  });

  // Эти запреты — не стилистика. Сгенерированное «до и после» или лицо,
  // поданное как пациент, — выдуманное клиническое утверждение в медицинской
  // рекламе. Тест стоит здесь, чтобы они не потерялись при правке промпта.
  it.each([
    ['лица как пациенты', /лиц[ао]\s+людей|как пациенты/i],
    ['до и после', /до и после/i],
    ['клинический результат', /клинический результат/i],
    ['текст на картинке', /текст, надписи/i],
    ['логотипы', /логотип/i],
  ])('запрещает: %s', (_label, re) => {
    expect(prompt).toMatch(re);
  });
});

describe('generateImage', () => {
  it('кладёт картинку в хранилище и записывает в кэш', async () => {
    net.providerFetch.mockResolvedValue({ data: [{ b64_json: Buffer.from('png').toString('base64') }] });

    const url = await generateImage({ clinicId: 'c1', prompt: 'кот' });

    expect(url).toMatch(/^s3:\/\/marketing\/c1\/[0-9a-f]{64}\.png$/);
    expect(s3.uploadObject).toHaveBeenCalledTimes(1);
    expect(s3.uploadObject.mock.calls[0][2]).toBe('image/png');
    expect(db.assetCreate).toHaveBeenCalledTimes(1);
  });

  it('повторный тот же промпт берётся из кэша и не стоит ничего', async () => {
    db.assetFindUnique.mockResolvedValue({ storageUrl: 's3://marketing/c1/abc.png' });

    const url = await generateImage({ clinicId: 'c1', prompt: 'кот' });

    expect(url).toBe('s3://marketing/c1/abc.png');
    expect(net.providerFetch, 'до модели дойти не должно').not.toHaveBeenCalled();
    expect(s3.uploadObject).not.toHaveBeenCalled();
  });

  it('пустой ответ модели не роняет вызов', async () => {
    net.providerFetch.mockResolvedValue({ data: [] });
    expect(await generateImage({ clinicId: 'c1', prompt: 'кот' })).toBeNull();
    expect(db.assetCreate).not.toHaveBeenCalled();
  });
});

describe('consumeImageQuota', () => {
  it('пускает до потолка и отсекает после', async () => {
    for (let i = 1; i <= 10; i++) {
      const q = await consumeImageQuota('c1');
      expect(q.allowed, `картинка ${i}`).toBe(true);
    }
    const eleventh = await consumeImageQuota('c1');
    expect(eleventh.allowed).toBe(false);
    expect(eleventh.remaining).toBe(0);
  });

  it('карусель списывает сразу за все слайды', async () => {
    const q = await consumeImageQuota('c1', 4);
    expect(q.used).toBe(4);
    expect(q.remaining).toBe(6);
  });

  it('считает по клиникам раздельно', async () => {
    await consumeImageQuota('c1', 10);
    const other = await consumeImageQuota('c2');
    expect(other.allowed, 'потолок соседа не должен задевать эту клинику').toBe(true);
  });

  it('использует общий счётчик, когда Redis доступен', async () => {
    redis.incrementDaily.mockResolvedValue(11);
    const q = await consumeImageQuota('c1');
    expect(q.allowed).toBe(false);
    expect(redis.incrementDaily).toHaveBeenCalledWith('marketing:img:c1:2026-08-30', 1);
  });
});
