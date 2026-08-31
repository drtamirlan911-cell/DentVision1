/**
 * Контент и продвижение клиники.
 *
 * Два маршрута: показать факты, на которых строится контент, и собрать по ним
 * план. Разделены намеренно — сводку можно посмотреть отдельно, она
 * детерминированная и ничего не стоит, а генерация плана дёргает модель.
 */

import { Router, type Response } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { AuthRequest, ApiResponse } from '../../types/index.js';
import { loadClinicAccess, blockClinicWrites } from '../../middleware/planGate.js';
import { auditFromReq } from '../compliance/audit.service.js';
import { buildMarketingContext } from './contentContext.js';
import { generateContentPlan } from './contentPlan.js';
import { savePlan, listPlans, getPlan, updateIdea, deletePlan, attachImages, findIdea } from './planStore.js';
import {
  imagesConfigured, buildImagePrompt, generateImage, consumeImageQuota, peekImageQuota,
  MAX_CAROUSEL_SLIDES,
} from './coverImage.js';
import { isProviderUnavailableError } from '../ai/lib/providerFetch.js';

const marketingRouter = Router();

marketingRouter.use(authenticate);
marketingRouter.use(loadClinicAccess);
marketingRouter.use(blockClinicWrites);

/** Факты о клинике, на которых строится контент. Без модели. */
marketingRouter.get('/context', requirePermission('patient.read'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }
    const context = await buildMarketingContext(clinicId);
    return res.json({ ok: true, data: context } satisfies ApiResponse);
  } catch (error) {
    console.error('[marketing] context', error);
    return res.status(500).json({ ok: false, error: 'Не удалось собрать данные клиники' } satisfies ApiResponse);
  }
});

/**
 * Контент-план.
 *
 * Право `patient.write`, а не `patient.read`: генерация тратит токены модели,
 * и запускать её должен тот, кто отвечает за работу клиники, а не любой,
 * кто может открыть экран.
 */
marketingRouter.post('/content-plan', requirePermission('patient.write'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }
    const tone = req.body?.tone ? String(req.body.tone) : undefined;
    const plan = await generateContentPlan({
      clinicId,
      count: Number(req.body?.count) || 6,
      tone,
    });

    // Пустой план не сохраняем. У клиники без закрытых приёмов, акций и
    // истории записи фактуры просто нет, а документ из нуля идей — мусор,
    // который пользователю потом придётся удалять руками.
    if (plan.ideas.length === 0) {
      return res.status(422).json({
        ok: false,
        error: 'Данных клиники пока не хватает на план: закройте несколько приёмов или заведите акцию',
      } satisfies ApiResponse);
    }

    // Сохраняем сразу: план, живущий только в состоянии браузера, исчезал
    // вместе с вкладкой, и работа пропадала.
    const stored = await savePlan({ clinicId, userId: req.user?.id, tone, plan });

    await auditFromReq(req, {
      action: 'marketing.content_plan.generated',
      entity: 'contentPlan',
      entityId: stored.id,
      details: { ideas: plan.ideas.length, deterministic: plan.deterministic },
    });

    return res.json({ ok: true, data: stored } satisfies ApiResponse);
  } catch (error) {
    console.error('[marketing] content-plan', error);
    return res.status(500).json({ ok: false, error: 'Не удалось собрать контент-план' } satisfies ApiResponse);
  }
});

/** Сохранённые планы клиники — история работы. */
marketingRouter.get('/content-plans', requirePermission('patient.read'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }
    const plans = await listPlans(clinicId, Number(req.query.limit) || 20);
    return res.json({ ok: true, data: plans } satisfies ApiResponse);
  } catch (error) {
    console.error('[marketing] content-plans list', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить планы' } satisfies ApiResponse);
  }
});

marketingRouter.get('/content-plans/:id', requirePermission('patient.read'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }
    const plan = await getPlan(clinicId, String(req.params.id));
    if (!plan) {
      return res.status(404).json({ ok: false, error: 'План не найден' } satisfies ApiResponse);
    }
    return res.json({ ok: true, data: plan } satisfies ApiResponse);
  } catch (error) {
    console.error('[marketing] content-plan get', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить план' } satisfies ApiResponse);
  }
});

/**
 * Правка текстов идеи.
 *
 * `basedOn` в список правимых полей не входит: это происхождение идеи, а не
 * копирайт. Разрешить его менять значило бы позволить сочинить обоснование
 * задним числом, и поле перестало бы что-либо значить.
 */
marketingRouter.patch('/content-ideas/:id', requirePermission('patient.write'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }
    const body = (req.body || {}) as Record<string, unknown>;
    const idea = await updateIdea(clinicId, String(req.params.id), {
      title: body.title !== undefined ? String(body.title) : undefined,
      hook: body.hook !== undefined ? String(body.hook) : undefined,
      caption: body.caption !== undefined ? String(body.caption) : undefined,
      callToAction: body.callToAction !== undefined ? String(body.callToAction) : undefined,
      hashtags: Array.isArray(body.hashtags) ? (body.hashtags as string[]) : undefined,
    });
    if (!idea) {
      return res.status(404).json({ ok: false, error: 'Идея не найдена' } satisfies ApiResponse);
    }
    return res.json({ ok: true, data: idea } satisfies ApiResponse);
  } catch (error) {
    console.error('[marketing] content-idea patch', error);
    return res.status(500).json({ ok: false, error: 'Не удалось сохранить правку' } satisfies ApiResponse);
  }
});

marketingRouter.delete('/content-plans/:id', requirePermission('patient.write'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }
    const removed = await deletePlan(clinicId, String(req.params.id));
    if (!removed) {
      return res.status(404).json({ ok: false, error: 'План не найден' } satisfies ApiResponse);
    }
    return res.json({ ok: true, data: null } satisfies ApiResponse);
  } catch (error) {
    console.error('[marketing] content-plan delete', error);
    return res.status(500).json({ ok: false, error: 'Не удалось удалить план' } satisfies ApiResponse);
  }
});

/** Сколько картинок ещё можно сегодня — экран показывает это рядом с кнопкой. */
marketingRouter.get('/image-quota', requirePermission('patient.read'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }
    const quota = await peekImageQuota(clinicId);
    return res.json({ ok: true, data: { ...quota, configured: imagesConfigured() } } satisfies ApiResponse);
  } catch (error) {
    console.error('[marketing] image-quota', error);
    return res.status(500).json({ ok: false, error: 'Не удалось прочитать лимит' } satisfies ApiResponse);
  }
});

/**
 * Общая часть генерации: проверить доступность, списать потолок, нарисовать.
 *
 * Отказ здесь честный и разный по причине. «Хранилище не настроено» — это не
 * ошибка пользователя и не повод молча положить base64 в базу; «кончились
 * деньги у провайдера» — не то же самое, что «притормози».
 */
async function runImageGeneration(
  req: AuthRequest,
  res: Response,
  count: number,
): Promise<{ clinicId: string; idea: Awaited<ReturnType<typeof findIdea>> } | null> {
  const clinicId = req.user?.clinicId;
  if (!clinicId) {
    res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    return null;
  }
  if (!imagesConfigured()) {
    res.status(503).json({
      ok: false,
      error: 'Генерация картинок не настроена: нужны ключ модели и объектное хранилище',
    } satisfies ApiResponse);
    return null;
  }
  const idea = await findIdea(clinicId, String(req.params.id));
  if (!idea) {
    res.status(404).json({ ok: false, error: 'Идея не найдена' } satisfies ApiResponse);
    return null;
  }
  const quota = await consumeImageQuota(clinicId, count);
  if (!quota.allowed) {
    res.status(429)
      .set('X-Marketing-Images-Remaining', '0')
      .json({
        ok: false,
        error: `Дневной лимит картинок исчерпан: ${quota.limit} в сутки`,
        code: 'IMAGE_DAILY_LIMIT',
      } as ApiResponse);
    return null;
  }
  res.set('X-Marketing-Images-Remaining', String(quota.remaining));
  return { clinicId, idea };
}

marketingRouter.post('/content-ideas/:id/cover', requirePermission('patient.write'), async (req: AuthRequest, res) => {
  try {
    const ctx = await runImageGeneration(req, res, 1);
    if (!ctx) return;
    const prompt = buildImagePrompt(ctx.idea!, ctx.idea!.clinicName);
    const url = await generateImage({ clinicId: ctx.clinicId, prompt });
    if (!url) {
      return res.status(502).json({ ok: false, error: 'Модель не вернула изображение' } satisfies ApiResponse);
    }
    const idea = await attachImages(ctx.clinicId, String(req.params.id), { coverUrl: url, imagePrompt: prompt });
    await auditFromReq(req, {
      action: 'marketing.cover.generated',
      entity: 'contentIdea',
      entityId: String(req.params.id),
      details: { count: 1 },
    });
    return res.json({ ok: true, data: idea } satisfies ApiResponse);
  } catch (error) {
    console.error('[marketing] cover', error);
    const spent = isProviderUnavailableError(error);
    return res.status(spent ? 402 : 500).json({
      ok: false,
      error: spent ? 'Провайдер отклонил запрос: проверьте баланс или ключ' : 'Не удалось сгенерировать обложку',
    } satisfies ApiResponse);
  }
});

marketingRouter.post('/content-ideas/:id/carousel', requirePermission('patient.write'), async (req: AuthRequest, res) => {
  const slides = Math.min(Math.max(Number(req.body?.slides) || 3, 2), MAX_CAROUSEL_SLIDES);
  try {
    const ctx = await runImageGeneration(req, res, slides);
    if (!ctx) return;
    if (ctx.idea!.format !== 'carousel') {
      return res.status(400).json({
        ok: false,
        error: 'Слайды имеют смысл только для идеи в формате карусели',
      } satisfies ApiResponse);
    }
    const base = buildImagePrompt(ctx.idea!, ctx.idea!.clinicName);
    const urls: string[] = [];
    for (let i = 0; i < slides; i++) {
      // Слайды различаем номером в промпте: одинаковый промпт вернул бы одну
      // и ту же картинку из кэша, и карусель получилась бы из клонов.
      const url = await generateImage({
        clinicId: ctx.clinicId,
        prompt: `${base}\n\nКадр ${i + 1} из ${slides}: другой ракурс и композиция, та же палитра и стиль.`,
      });
      if (url) urls.push(url);
    }
    if (urls.length === 0) {
      return res.status(502).json({ ok: false, error: 'Модель не вернула изображения' } satisfies ApiResponse);
    }
    const idea = await attachImages(ctx.clinicId, String(req.params.id), { slideUrls: urls });
    await auditFromReq(req, {
      action: 'marketing.carousel.generated',
      entity: 'contentIdea',
      entityId: String(req.params.id),
      details: { count: urls.length },
    });
    return res.json({ ok: true, data: idea } satisfies ApiResponse);
  } catch (error) {
    console.error('[marketing] carousel', error);
    const spent = isProviderUnavailableError(error);
    return res.status(spent ? 402 : 500).json({
      ok: false,
      error: spent ? 'Провайдер отклонил запрос: проверьте баланс или ключ' : 'Не удалось сгенерировать слайды',
    } satisfies ApiResponse);
  }
});

export { marketingRouter };
