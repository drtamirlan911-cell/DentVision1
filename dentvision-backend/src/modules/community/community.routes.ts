/**
 * Community feed — posts + likes (ported from legacy server/routes/community.js).
 */
import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate, optionalAuth } from '../../middleware/auth.js';
import { uid } from '../../lib/helpers.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';

export const communityRouter = Router();

const SEED = [
  {
    id: 'post-1',
    authorId: null as string | null,
    authorName: 'Доктор Айдар К.',
    authorRole: 'Ортопед',
    content: 'Цифровое планирование имплантации с CBCT и CAD/CAM заметно повышает точность. Делюсь протоколом в треде.',
    tags: ['Имплантация', 'Цифровая стоматология'],
    kind: 'thread',
    likesCount: 24,
    commentsCount: 8,
  },
  {
    id: 'post-2',
    authorId: null,
    authorName: 'Клиника Smile',
    authorRole: 'Клиника',
    content: 'Открыли новый филиал. Ищем специалистов — вакансии в Jobs.',
    tags: ['Вакансии'],
    kind: 'media',
    likesCount: 42,
    commentsCount: 15,
  },
  {
    id: 'post-3',
    authorId: null,
    authorName: 'Доктор Елена М.',
    authorRole: 'Терапевт',
    content: 'Клинический кейс: реставрация 11. До/после — в портфолио профиля.',
    tags: ['Терапия', 'Кейс'],
    kind: 'media',
    likesCount: 31,
    commentsCount: 6,
  },
  {
    id: 'post-4',
    authorId: null,
    authorName: 'DentVision Academy',
    authorRole: 'Платформа',
    content: 'Новый курс: «Основы лазерной стоматологии» — 12 модулей, сертификат.',
    tags: ['Обучение', 'Курс'],
    kind: 'thread',
    likesCount: 56,
    commentsCount: 22,
  },
];

async function ensureSeed() {
  const count = await prisma.communityPost.count();
  if (count > 0) return;
  for (const s of SEED) {
    await prisma.communityPost.create({
      data: {
        id: s.id,
        authorId: s.authorId,
        authorName: s.authorName,
        authorRole: s.authorRole,
        content: s.content,
        tags: s.tags,
        kind: s.kind,
        likesCount: s.likesCount,
        commentsCount: s.commentsCount,
      },
    });
  }
}

communityRouter.get('/posts', optionalAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeed();
    const topic = String(req.query.topic || '');
    const userId = req.user?.id;

    let posts = await prisma.communityPost.findMany({
      orderBy: { createdAt: 'desc' },
      include: userId
        ? { likes: { where: { userId }, select: { id: true } } }
        : undefined,
      take: 100,
    });

    if (topic && topic !== 'Все') {
      posts = posts.filter(
        (p) => Array.isArray(p.tags) && (p.tags as unknown[]).some((t) => String(t).includes(topic)),
      );
    }

    const data = posts.map((p) => {
      const likes = (p as { likes?: { id: string }[] }).likes;
      return {
        id: p.id,
        authorId: p.authorId,
        authorName: p.authorName,
        authorRole: p.authorRole,
        content: p.content,
        tags: p.tags,
        kind: p.kind,
        likesCount: p.likesCount,
        commentsCount: p.commentsCount,
        createdAt: p.createdAt,
        liked: userId ? !!(likes && likes.length > 0) : false,
      };
    });

    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (error) {
    console.error('[Community] list posts', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить ленту' } satisfies ApiResponse);
  }
});

communityRouter.post('/posts', authenticate, async (req: AuthRequest, res) => {
  try {
    const { content, tags, kind } = req.body || {};
    if (!content || !String(content).trim()) {
      return res.status(400).json({ ok: false, error: 'content обязателен' } satisfies ApiResponse);
    }

    const name = [req.user!.firstName, req.user!.lastName].filter(Boolean).join(' ').trim()
      || req.user!.email
      || 'Пользователь';

    const post = await prisma.communityPost.create({
      data: {
        id: uid(),
        authorId: req.user!.id,
        authorName: name,
        authorRole: req.user!.role || 'Специалист',
        content: String(content).trim(),
        tags: Array.isArray(tags) ? tags : ['Тред'],
        kind: kind === 'media' ? 'media' : 'thread',
        likesCount: 0,
        commentsCount: 0,
      },
    });

    return res.status(201).json({
      ok: true,
      data: { ...post, liked: false },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[Community] create post', error);
    return res.status(500).json({ ok: false, error: 'Не удалось опубликовать' } satisfies ApiResponse);
  }
});

communityRouter.post('/posts/:id/like', authenticate, async (req: AuthRequest, res) => {
  try {
    const postId = req.params.id as string;
    const userId = req.user!.id;

    const post = await prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post) {
      return res.status(404).json({ ok: false, error: 'Пост не найден' } satisfies ApiResponse);
    }

    const existing = await prisma.communityLike.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existing) {
      await prisma.communityLike.delete({ where: { id: existing.id } });
      const updated = await prisma.communityPost.update({
        where: { id: postId },
        data: { likesCount: { decrement: 1 } },
      });
      return res.json({ ok: true, data: { ...updated, liked: false } } satisfies ApiResponse);
    }

    await prisma.communityLike.create({
      data: { id: uid(), postId, userId },
    });
    const updated = await prisma.communityPost.update({
      where: { id: postId },
      data: { likesCount: { increment: 1 } },
    });
    return res.json({ ok: true, data: { ...updated, liked: true } } satisfies ApiResponse);
  } catch (error) {
    console.error('[Community] like', error);
    return res.status(500).json({ ok: false, error: 'Не удалось обновить лайк' } satisfies ApiResponse);
  }
});
