/**
 * Хранение контент-планов.
 *
 * До этого план жил только в состоянии браузера: закрыл вкладку — работы нет.
 * Здесь он становится документом, который можно открыть завтра и поправить.
 *
 * Всё чтение и запись скоупятся по клинике прямо в `where`, а не проверкой
 * после выборки: так чужой план нельзя вытащить по прямому идентификатору
 * даже случайно.
 */

import prisma from '../../lib/prisma.js';
import { isStorageKey, keyFromStorageUrl, signedDownloadUrl, storageConfigured } from '../../lib/storage.js';
import type { ContentIdea, ContentPlan } from './contentPlan.js';

/** Сколько живёт подписанная ссылка на картинку. Как у озвучки. */
const SIGNED_URL_TTL_SECONDS = 900;

export interface StoredIdea extends ContentIdea {
  id: string;
  position: number;
  edited: boolean;
  coverUrl: string | null;
  slideUrls: string[];
}

export interface StoredPlan {
  id: string;
  title: string;
  tone: string | null;
  deterministic: boolean;
  createdAt: string;
  ideas: StoredIdea[];
  context: unknown;
}

export interface PlanSummary {
  id: string;
  title: string;
  deterministic: boolean;
  ideaCount: number;
  createdAt: string;
}

/**
 * Ссылка, которую браузер действительно может загрузить.
 *
 * В базе лежит `s3://<key>`; отдавать его наружу бессмысленно — ни один
 * `<img>` его не отрисует. При ошибке подписи возвращаем `null`, а не роняем
 * весь план: отсутствующая картинка не повод не показать текст.
 */
async function toBrowserUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  if (!isStorageKey(url)) return url;
  if (!storageConfigured()) return null;
  try {
    return await signedDownloadUrl(keyFromStorageUrl(url), SIGNED_URL_TTL_SECONDS);
  } catch {
    return null;
  }
}

function defaultTitle(at: Date): string {
  return `План от ${at.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`;
}

export async function savePlan(args: {
  clinicId: string;
  userId?: string | null;
  tone?: string | null;
  plan: { ideas: ContentIdea[]; context: unknown; deterministic: boolean };
}): Promise<StoredPlan> {
  const now = new Date();
  const created = await prisma.contentPlan.create({
    data: {
      clinicId: args.clinicId,
      title: defaultTitle(now),
      tone: args.tone || null,
      contextSnapshot: args.plan.context as never,
      deterministic: args.plan.deterministic,
      createdByUserId: args.userId || null,
      ideas: {
        create: args.plan.ideas.map((idea, position) => ({
          position,
          title: idea.title,
          format: idea.format,
          hook: idea.hook,
          caption: idea.caption,
          hashtags: idea.hashtags as never,
          callToAction: idea.callToAction,
          basedOn: idea.basedOn,
        })),
      },
    },
    include: { ideas: { orderBy: { position: 'asc' } } },
  });

  return {
    id: created.id,
    title: created.title || defaultTitle(created.createdAt),
    tone: created.tone,
    deterministic: created.deterministic,
    createdAt: created.createdAt.toISOString(),
    context: created.contextSnapshot,
    ideas: created.ideas.map((i) => ({
      id: i.id,
      position: i.position,
      title: i.title,
      format: i.format as ContentIdea['format'],
      hook: i.hook,
      caption: i.caption,
      hashtags: (i.hashtags as string[]) || [],
      callToAction: i.callToAction,
      basedOn: i.basedOn,
      edited: i.edited,
      coverUrl: null,
      slideUrls: [],
    })),
  };
}

export async function listPlans(clinicId: string, limit = 20): Promise<PlanSummary[]> {
  const rows = await prisma.contentPlan.findMany({
    where: { clinicId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 50),
    select: {
      id: true, title: true, deterministic: true, createdAt: true,
      _count: { select: { ideas: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title || defaultTitle(r.createdAt),
    deterministic: r.deterministic,
    ideaCount: r._count.ideas,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getPlan(clinicId: string, planId: string): Promise<StoredPlan | null> {
  const row = await prisma.contentPlan.findFirst({
    where: { id: planId, clinicId },
    include: { ideas: { orderBy: { position: 'asc' } } },
  });
  if (!row) return null;

  const ideas: StoredIdea[] = await Promise.all(
    row.ideas.map(async (i) => ({
      id: i.id,
      position: i.position,
      title: i.title,
      format: i.format as ContentIdea['format'],
      hook: i.hook,
      caption: i.caption,
      hashtags: (i.hashtags as string[]) || [],
      callToAction: i.callToAction,
      basedOn: i.basedOn,
      edited: i.edited,
      coverUrl: await toBrowserUrl(i.coverUrl),
      slideUrls: (await Promise.all(
        ((i.slideUrls as string[]) || []).map((u) => toBrowserUrl(u)),
      )).filter((u): u is string => Boolean(u)),
    })),
  );

  return {
    id: row.id,
    title: row.title || defaultTitle(row.createdAt),
    tone: row.tone,
    deterministic: row.deterministic,
    createdAt: row.createdAt.toISOString(),
    context: row.contextSnapshot,
    ideas,
  };
}

/** Поля, которые человеку можно править. `basedOn` сюда не входит намеренно. */
export interface IdeaPatch {
  title?: string;
  hook?: string;
  caption?: string;
  hashtags?: string[];
  callToAction?: string;
}

export async function updateIdea(
  clinicId: string,
  ideaId: string,
  patch: IdeaPatch,
): Promise<StoredIdea | null> {
  // Идея принадлежит клинике через план — проверяем связь, а не только id.
  const existing = await prisma.contentIdea.findFirst({
    where: { id: ideaId, plan: { clinicId } },
    select: { id: true },
  });
  if (!existing) return null;

  const data: Record<string, unknown> = { edited: true };
  if (patch.title !== undefined) data.title = String(patch.title).slice(0, 200);
  if (patch.hook !== undefined) data.hook = String(patch.hook).slice(0, 500);
  if (patch.caption !== undefined) data.caption = String(patch.caption).slice(0, 5000);
  if (patch.callToAction !== undefined) data.callToAction = String(patch.callToAction).slice(0, 200);
  if (Array.isArray(patch.hashtags)) {
    data.hashtags = patch.hashtags.map((h) => String(h).slice(0, 60)).slice(0, 30);
  }

  const updated = await prisma.contentIdea.update({ where: { id: ideaId }, data });

  return {
    id: updated.id,
    position: updated.position,
    title: updated.title,
    format: updated.format as ContentIdea['format'],
    hook: updated.hook,
    caption: updated.caption,
    hashtags: (updated.hashtags as string[]) || [],
    callToAction: updated.callToAction,
    basedOn: updated.basedOn,
    edited: updated.edited,
    coverUrl: await toBrowserUrl(updated.coverUrl),
    slideUrls: (await Promise.all(
      ((updated.slideUrls as string[]) || []).map((u) => toBrowserUrl(u)),
    )).filter((u): u is string => Boolean(u)),
  };
}

export async function deletePlan(clinicId: string, planId: string): Promise<boolean> {
  const result = await prisma.contentPlan.deleteMany({ where: { id: planId, clinicId } });
  return result.count > 0;
}

/**
 * Идея вместе с названием клиники — всё, что нужно промпту обложки.
 *
 * Скоуп по клинике идёт через связь с планом: у самой идеи `clinicId` нет,
 * и проверять только её собственный id было бы дырой.
 */
export async function findIdea(clinicId: string, ideaId: string): Promise<
  { id: string; title: string; format: string; hook: string; basedOn: string; clinicName: string } | null
> {
  const row = await prisma.contentIdea.findFirst({
    where: { id: ideaId, plan: { clinicId } },
    select: {
      id: true, title: true, format: true, hook: true, basedOn: true,
      plan: { select: { clinic: { select: { name: true } } } },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    format: row.format,
    hook: row.hook,
    basedOn: row.basedOn,
    clinicName: row.plan.clinic.name,
  };
}

/** Привязать сгенерированные картинки к идее. Ссылки хранятся как `s3://`. */
export async function attachImages(
  clinicId: string,
  ideaId: string,
  images: { coverUrl?: string; slideUrls?: string[]; imagePrompt?: string },
): Promise<StoredIdea | null> {
  const existing = await prisma.contentIdea.findFirst({
    where: { id: ideaId, plan: { clinicId } },
    select: { id: true },
  });
  if (!existing) return null;

  const updated = await prisma.contentIdea.update({
    where: { id: ideaId },
    data: {
      ...(images.coverUrl !== undefined && { coverUrl: images.coverUrl }),
      ...(images.slideUrls !== undefined && { slideUrls: images.slideUrls as never }),
      ...(images.imagePrompt !== undefined && { imagePrompt: images.imagePrompt }),
    },
  });

  return {
    id: updated.id,
    position: updated.position,
    title: updated.title,
    format: updated.format as ContentIdea['format'],
    hook: updated.hook,
    caption: updated.caption,
    hashtags: (updated.hashtags as string[]) || [],
    callToAction: updated.callToAction,
    basedOn: updated.basedOn,
    edited: updated.edited,
    coverUrl: await toBrowserUrl(updated.coverUrl),
    slideUrls: (await Promise.all(
      ((updated.slideUrls as string[]) || []).map((u) => toBrowserUrl(u)),
    )).filter((u): u is string => Boolean(u)),
  };
}
