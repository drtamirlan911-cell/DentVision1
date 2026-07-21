/**
 * Community social — feed, comments, saves, DMs (IG/Threads/Telegram essentials).
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
    commentsCount: 0,
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
    commentsCount: 0,
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
    commentsCount: 0,
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
    commentsCount: 0,
  },
];

function displayName(user: { firstName?: string | null; lastName?: string | null; email?: string | null }) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email || 'Пользователь';
}

function pairKeyFor(a: string, b: string) {
  return [a, b].sort().join(':');
}

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

function mapPost(p: any, userId?: string) {
  const likes = p.likes as { id: string }[] | undefined;
  const saves = p.saves as { id: string }[] | undefined;
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
    saved: userId ? !!(saves && saves.length > 0) : false,
  };
}

// ─── Feed ───────────────────────────────────────────────────────────

communityRouter.get('/posts', optionalAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeed();
    const topic = String(req.query.topic || '');
    const userId = req.user?.id;
    const savedOnly = String(req.query.saved || '') === '1';

    let posts = await prisma.communityPost.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        ...(userId
          ? {
              likes: { where: { userId }, select: { id: true } },
              saves: { where: { userId }, select: { id: true } },
            }
          : {}),
      },
      take: 100,
    });

    if (savedOnly && userId) {
      posts = posts.filter((p) => ((p as any).saves || []).length > 0);
    }

    if (topic && topic !== 'Все') {
      posts = posts.filter(
        (p) => Array.isArray(p.tags) && (p.tags as unknown[]).some((t) => String(t).includes(topic)),
      );
    }

    return res.json({ ok: true, data: posts.map((p) => mapPost(p, userId)) } satisfies ApiResponse);
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

    const name = displayName(req.user!);
    const post = await prisma.communityPost.create({
      data: {
        id: uid(),
        authorId: req.user!.id,
        authorName: name,
        authorRole: req.user!.role || 'Специалист',
        content: String(content).trim().slice(0, 4000),
        tags: Array.isArray(tags) ? tags : ['Тред'],
        kind: kind === 'media' ? 'media' : 'thread',
        likesCount: 0,
        commentsCount: 0,
      },
    });

    return res.status(201).json({
      ok: true,
      data: { ...post, liked: false, saved: false },
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

communityRouter.post('/posts/:id/save', authenticate, async (req: AuthRequest, res) => {
  try {
    const postId = req.params.id as string;
    const userId = req.user!.id;
    const post = await prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ ok: false, error: 'Пост не найден' } satisfies ApiResponse);

    const existing = await prisma.communitySave.findUnique({
      where: { postId_userId: { postId, userId } },
    });
    if (existing) {
      await prisma.communitySave.delete({ where: { id: existing.id } });
      return res.json({ ok: true, data: { saved: false } } satisfies ApiResponse);
    }
    await prisma.communitySave.create({ data: { id: uid(), postId, userId } });
    return res.json({ ok: true, data: { saved: true } } satisfies ApiResponse);
  } catch (error) {
    console.error('[Community] save', error);
    return res.status(500).json({ ok: false, error: 'Не удалось сохранить' } satisfies ApiResponse);
  }
});

// ─── Comments ───────────────────────────────────────────────────────

communityRouter.get('/posts/:id/comments', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const postId = req.params.id as string;
    const comments = await prisma.communityComment.findMany({
      where: { postId },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    return res.json({ ok: true, data: comments } satisfies ApiResponse);
  } catch (error) {
    console.error('[Community] comments', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить комментарии' } satisfies ApiResponse);
  }
});

communityRouter.post('/posts/:id/comments', authenticate, async (req: AuthRequest, res) => {
  try {
    const postId = req.params.id as string;
    const content = String(req.body?.content || '').trim();
    if (!content) return res.status(400).json({ ok: false, error: 'Текст обязателен' } satisfies ApiResponse);

    const post = await prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ ok: false, error: 'Пост не найден' } satisfies ApiResponse);

    const comment = await prisma.communityComment.create({
      data: {
        id: uid(),
        postId,
        authorId: req.user!.id,
        authorName: displayName(req.user!),
        content: content.slice(0, 2000),
      },
    });
    await prisma.communityPost.update({
      where: { id: postId },
      data: { commentsCount: { increment: 1 } },
    });

    return res.status(201).json({ ok: true, data: comment } satisfies ApiResponse);
  } catch (error) {
    console.error('[Community] add comment', error);
    return res.status(500).json({ ok: false, error: 'Не удалось отправить комментарий' } satisfies ApiResponse);
  }
});

// ─── People search (start DM) ───────────────────────────────────────

communityRouter.get('/people', authenticate, async (req: AuthRequest, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 1) {
      return res.json({ ok: true, data: [] } satisfies ApiResponse);
    }
    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: req.user!.id } },
          {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: { id: true, firstName: true, lastName: true, email: true, avatar: true, role: true, spec: true },
      take: 20,
    });
    return res.json({
      ok: true,
      data: users.map((u) => ({
        id: u.id,
        name: displayName(u),
        email: u.email,
        avatar: u.avatar,
        role: u.role,
        spec: u.spec,
      })),
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[Community] people', error);
    return res.status(500).json({ ok: false, error: 'Не удалось найти людей' } satisfies ApiResponse);
  }
});

// ─── Direct messages ────────────────────────────────────────────────

communityRouter.get('/dm/unread-count', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const parts = await prisma.dmParticipant.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
    });
    let unread = 0;
    for (const p of parts) {
      const last = p.conversation.messages[0];
      if (!last) continue;
      if (last.senderId === userId) continue;
      if (!p.lastReadAt || last.createdAt > p.lastReadAt) unread += 1;
    }
    return res.json({ ok: true, data: { unread } } satisfies ApiResponse);
  } catch (error) {
    console.error('[Community] dm unread', error);
    return res.status(500).json({ ok: false, error: 'Ошибка' } satisfies ApiResponse);
  }
});

communityRouter.get('/dm', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const parts = await prisma.dmParticipant.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            participants: true,
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
      orderBy: { conversation: { updatedAt: 'desc' } },
    });

    const otherIds = parts
      .map((p) => p.conversation.participants.find((x) => x.userId !== userId)?.userId)
      .filter(Boolean) as string[];

    const others = otherIds.length
      ? await prisma.user.findMany({
          where: { id: { in: otherIds } },
          select: { id: true, firstName: true, lastName: true, email: true, avatar: true, role: true },
        })
      : [];
    const otherMap = new Map(others.map((u) => [u.id, u]));

    const data = parts.map((p) => {
      const otherId = p.conversation.participants.find((x) => x.userId !== userId)?.userId;
      const other = otherId ? otherMap.get(otherId) : null;
      const last = p.conversation.messages[0] || null;
      const unread =
        !!last &&
        last.senderId !== userId &&
        (!p.lastReadAt || last.createdAt > p.lastReadAt);
      return {
        id: p.conversation.id,
        updatedAt: p.conversation.updatedAt,
        peer: other
          ? { id: other.id, name: displayName(other), avatar: other.avatar, role: other.role }
          : { id: otherId || '', name: 'Пользователь', avatar: null, role: null },
        lastMessage: last
          ? { id: last.id, body: last.body, senderId: last.senderId, createdAt: last.createdAt }
          : null,
        unread,
      };
    });

    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (error) {
    console.error('[Community] dm inbox', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить сообщения' } satisfies ApiResponse);
  }
});

communityRouter.post('/dm/open', authenticate, async (req: AuthRequest, res) => {
  try {
    const peerId = String(req.body?.userId || '').trim();
    if (!peerId) return res.status(400).json({ ok: false, error: 'userId обязателен' } satisfies ApiResponse);
    if (peerId === req.user!.id) {
      return res.status(400).json({ ok: false, error: 'Нельзя написать себе' } satisfies ApiResponse);
    }

    const peer = await prisma.user.findUnique({
      where: { id: peerId },
      select: { id: true, firstName: true, lastName: true, email: true, avatar: true, role: true },
    });
    if (!peer) return res.status(404).json({ ok: false, error: 'Пользователь не найден' } satisfies ApiResponse);

    const key = pairKeyFor(req.user!.id, peerId);
    let conv = await prisma.dmConversation.findUnique({ where: { pairKey: key } });
    if (!conv) {
      conv = await prisma.dmConversation.create({
        data: {
          id: uid(),
          pairKey: key,
          participants: {
            create: [
              { id: uid(), userId: req.user!.id },
              { id: uid(), userId: peerId },
            ],
          },
        },
      });
    }

    return res.json({
      ok: true,
      data: {
        id: conv.id,
        peer: { id: peer.id, name: displayName(peer), avatar: peer.avatar, role: peer.role },
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[Community] dm open', error);
    return res.status(500).json({ ok: false, error: 'Не удалось открыть чат' } satisfies ApiResponse);
  }
});

communityRouter.get('/dm/:id/messages', authenticate, async (req: AuthRequest, res) => {
  try {
    const conversationId = req.params.id as string;
    const userId = req.user!.id;

    const part = await prisma.dmParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!part) return res.status(403).json({ ok: false, error: 'Нет доступа' } satisfies ApiResponse);

    const messages = await prisma.dmMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 300,
    });

    await prisma.dmParticipant.update({
      where: { id: part.id },
      data: { lastReadAt: new Date() },
    });

    const conv = await prisma.dmConversation.findUnique({
      where: { id: conversationId },
      include: { participants: true },
    });
    const peerId = conv?.participants.find((p) => p.userId !== userId)?.userId;
    const peer = peerId
      ? await prisma.user.findUnique({
          where: { id: peerId },
          select: { id: true, firstName: true, lastName: true, email: true, avatar: true, role: true },
        })
      : null;

    return res.json({
      ok: true,
      data: {
        messages,
        peer: peer
          ? { id: peer.id, name: displayName(peer), avatar: peer.avatar, role: peer.role }
          : null,
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[Community] dm messages', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить чат' } satisfies ApiResponse);
  }
});

communityRouter.post('/dm/:id/messages', authenticate, async (req: AuthRequest, res) => {
  try {
    const conversationId = req.params.id as string;
    const userId = req.user!.id;
    const body = String(req.body?.body || '').trim();
    if (!body) return res.status(400).json({ ok: false, error: 'Пустое сообщение' } satisfies ApiResponse);

    const part = await prisma.dmParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!part) return res.status(403).json({ ok: false, error: 'Нет доступа' } satisfies ApiResponse);

    const msg = await prisma.dmMessage.create({
      data: {
        id: uid(),
        conversationId,
        senderId: userId,
        body: body.slice(0, 4000),
      },
    });
    await prisma.dmConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    await prisma.dmParticipant.update({
      where: { id: part.id },
      data: { lastReadAt: new Date() },
    });

    return res.status(201).json({ ok: true, data: msg } satisfies ApiResponse);
  } catch (error) {
    console.error('[Community] dm send', error);
    return res.status(500).json({ ok: false, error: 'Не удалось отправить' } satisfies ApiResponse);
  }
});
