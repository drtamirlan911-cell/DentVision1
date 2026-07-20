import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'community.json');

const SEED = [
  {
    id: 'post-1',
    authorId: null,
    authorName: 'Доктор Айдар К.',
    authorRole: 'Ортопед',
    content: 'Цифровое планирование имплантации с CBCT и CAD/CAM заметно повышает точность. Делюсь протоколом в треде.',
    tags: ['Имплантация', 'Цифровая стоматология'],
    kind: 'thread',
    likesCount: 24,
    commentsCount: 8,
    likedBy: [],
    createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
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
    likedBy: [],
    createdAt: new Date(Date.now() - 5 * 3600_000).toISOString(),
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
    likedBy: [],
    createdAt: new Date(Date.now() - 24 * 3600_000).toISOString(),
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
    likedBy: [],
    createdAt: new Date(Date.now() - 48 * 3600_000).toISOString(),
  },
];

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ posts: SEED }, null, 2));
  }
}

function readStore() {
  ensureStore();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeStore(data) {
  ensureStore();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

export default function communityRoutes() {
  const router = Router();

  router.get('/posts', optionalAuth, (req, res) => {
    try {
      const { topic } = req.query;
      const store = readStore();
      let posts = [...store.posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      if (topic && topic !== 'Все') {
        posts = posts.filter((p) => (p.tags || []).some((t) => String(t).includes(String(topic))));
      }
      const uid = req.user?.id;
      res.json(
        posts.map((p) => ({
          ...p,
          liked: uid ? (p.likedBy || []).includes(uid) : false,
        }))
      );
    } catch (e) {
      res.status(500).json({ error: e.message || 'Internal error' });
    }
  });

  router.post('/posts', authenticate, (req, res) => {
    try {
      const { content, tags, kind } = req.body || {};
      if (!content || !String(content).trim()) return res.status(400).json({ error: 'content required' });
      const store = readStore();
      const post = {
        id: crypto.randomUUID(),
        authorId: req.user.id,
        authorName: req.user.name || req.user.login || 'Пользователь',
        authorRole: req.user.role || 'Специалист',
        content: String(content).trim(),
        tags: Array.isArray(tags) ? tags : ['Тред'],
        kind: kind === 'media' ? 'media' : 'thread',
        likesCount: 0,
        commentsCount: 0,
        likedBy: [],
        createdAt: new Date().toISOString(),
      };
      store.posts.unshift(post);
      writeStore(store);
      res.status(201).json({ ...post, liked: false });
    } catch (e) {
      res.status(500).json({ error: e.message || 'Internal error' });
    }
  });

  router.post('/posts/:id/like', authenticate, (req, res) => {
    try {
      const store = readStore();
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
      writeStore(store);
      res.json({ ...post, liked: post.likedBy.includes(req.user.id) });
    } catch (e) {
      res.status(500).json({ error: e.message || 'Internal error' });
    }
  });

  return router;
}
