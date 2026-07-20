import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'community.json');

const SEED = [
  {
    id: 'post-1', authorId: null, authorName: 'Доктор Айдар К.', authorRole: 'Ортопед',
    content: 'Цифровое планирование имплантации с CBCT и CAD/CAM заметно повышает точность. Делюсь протоколом в треде.',
    tags: ['Имплантация', 'Цифровая стоматология'], kind: 'thread', likesCount: 24, commentsCount: 8,
  },
  {
    id: 'post-2', authorId: null, authorName: 'Клиника Smile', authorRole: 'Клиника',
    content: 'Открыли новый филиал. Ищем специалистов — вакансии в Jobs.',
    tags: ['Вакансии'], kind: 'media', likesCount: 42, commentsCount: 15,
  },
  {
    id: 'post-3', authorId: null, authorName: 'Доктор Елена М.', authorRole: 'Терапевт',
    content: 'Клинический кейс: реставрация 11. До/после — в портфолио профиля.',
    tags: ['Терапия', 'Кейс'], kind: 'media', likesCount: 31, commentsCount: 6,
  },
  {
    id: 'post-4', authorId: null, authorName: 'DentVision Academy', authorRole: 'Платформа',
    content: 'Новый курс: «Основы лазерной стоматологии» — 12 модулей, сертификат.',
    tags: ['Обучение', 'Курс'], kind: 'thread', likesCount: 56, commentsCount: 22,
  },
];

function ensureJson() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
      posts: SEED.map((s) => ({ ...s, likedBy: [], createdAt: new Date().toISOString() })),
    }, null, 2));
  }
}
function readJson() {
  ensureJson();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function writeJson(data) {
  ensureJson();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

async function usePrisma() {
  try {
    if (!prisma.communityPost) return false;
    await prisma.communityPost.count();
    return true;
  } catch {
    return false;
  }
}

async function ensurePrismaSeed() {
  const count = await prisma.communityPost.count();
  if (count === 0) {
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
}

export default function communityRoutes() {
  const router = Router();

  router.get('/posts', optionalAuth, async (req, res) => {
    try {
      const { topic } = req.query;
      const uid = req.user?.id;

      if (await usePrisma()) {
        await ensurePrismaSeed();
        const where = {};
        // topic filter applied in memory for JSON tags flexibility
        let posts = await prisma.communityPost.findMany({
          orderBy: { createdAt: 'desc' },
          include: uid ? { likes: { where: { userId: uid }, select: { id: true } } } : false,
        });
        if (topic && topic !== 'Все') {
          posts = posts.filter((p) => Array.isArray(p.tags) && p.tags.some((t) => String(t).includes(String(topic))));
        }
        return res.json(posts.map((p) => ({
          ...p,
          liked: uid ? (p.likes?.length > 0) : false,
          likes: undefined,
        })));
      }

      const store = readJson();
      let posts = [...store.posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      if (topic && topic !== 'Все') {
        posts = posts.filter((p) => (p.tags || []).some((t) => String(t).includes(String(topic))));
      }
      res.json(posts.map((p) => ({ ...p, liked: uid ? (p.likedBy || []).includes(uid) : false })));
    } catch (e) {
      res.status(500).json({ error: e.message || 'Internal error' });
    }
  });

  router.post('/posts', authenticate, async (req, res) => {
    try {
      const { content, tags, kind } = req.body || {};
      if (!content || !String(content).trim()) return res.status(400).json({ error: 'content required' });
      const data = {
        id: crypto.randomUUID(),
        authorId: req.user.id,
        authorName: req.user.name || req.user.login || 'Пользователь',
        authorRole: req.user.role || 'Специалист',
        content: String(content).trim(),
        tags: Array.isArray(tags) ? tags : ['Тред'],
        kind: kind === 'media' ? 'media' : 'thread',
        likesCount: 0,
        commentsCount: 0,
      };

      if (await usePrisma()) {
        const post = await prisma.communityPost.create({ data });
        return res.status(201).json({ ...post, liked: false });
      }

      const store = readJson();
      const post = { ...data, likedBy: [], createdAt: new Date().toISOString() };
      store.posts.unshift(post);
      writeJson(store);
      res.status(201).json({ ...post, liked: false });
    } catch (e) {
      res.status(500).json({ error: e.message || 'Internal error' });
    }
  });

  router.post('/posts/:id/like', authenticate, async (req, res) => {
    try {
      if (await usePrisma()) {
        const post = await prisma.communityPost.findUnique({ where: { id: req.params.id } });
        if (!post) return res.status(404).json({ error: 'Not found' });
        const existing = await prisma.communityLike.findFirst({
          where: { postId: req.params.id, userId: req.user.id },
        });
        if (existing) {
          await prisma.communityLike.delete({ where: { id: existing.id } });
          const updated = await prisma.communityPost.update({
            where: { id: req.params.id },
            data: { likesCount: { decrement: 1 } },
          });
          return res.json({ ...updated, liked: false });
        }
        await prisma.communityLike.create({
          data: { id: crypto.randomUUID(), postId: req.params.id, userId: req.user.id },
        });
        const updated = await prisma.communityPost.update({
          where: { id: req.params.id },
          data: { likesCount: { increment: 1 } },
        });
        return res.json({ ...updated, liked: true });
      }

      const store = readJson();
      const post = store.posts.find((p) => p.id === req.params.id);
      if (!post) return res.status(404).json({ error: 'Not found' });
      post.likedBy = post.likedBy || [];
      const idx = post.likedBy.indexOf(req.user.id);
      if (idx >= 0) {
        post.likedBy.splice(idx, 1);
        post.likesCount = Math.max(0, (post.likesCount || 0) - 1);
      } else {
        post.likedBy.push(req.user.id);
        post.likesCount = (post.likesCount || 0) + 1;
      }
      writeJson(store);
      res.json({ ...post, liked: post.likedBy.includes(req.user.id) });
    } catch (e) {
      res.status(500).json({ error: e.message || 'Internal error' });
    }
  });

  return router;
}
