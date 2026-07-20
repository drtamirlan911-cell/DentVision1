import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'jobs.json');

const SEED = [
  {
    id: 'job-1', title: 'Врач-стоматолог-терапевт', clinicName: 'KazDent', city: 'Алматы',
    salary: '450 000 — 700 000 ₸', employmentType: 'Полная занятость',
    description: 'Требуется опытный стоматолог-терапевт. Современное оборудование, цифровая рентгенография.',
    tags: ['Терапия', 'Эндодонтия'], status: 'open',
  },
  {
    id: 'job-2', title: 'Дентальный гигиенист', clinicName: 'Smile Clinic', city: 'Астана',
    salary: '300 000 — 450 000 ₸', employmentType: 'Полная занятость',
    description: 'Ищем гигиениста для профилактических процедур и чистки.',
    tags: ['Профилактика'], status: 'open',
  },
  {
    id: 'job-3', title: 'Врач-ортодонт', clinicName: 'Dental Premium', city: 'Алматы',
    salary: '600 000 — 900 000 ₸', employmentType: 'Полная занятость',
    description: 'Ортодонт с опытом работы с элайнерами и брекетами.',
    tags: ['Ортодонтия', 'Элайнеры'], status: 'open',
  },
  {
    id: 'job-4', title: 'Ассистент стоматолога', clinicName: 'MedDent', city: 'Шымкент',
    salary: '200 000 — 300 000 ₸', employmentType: 'Полная занятость',
    description: 'Ассистент врача с опытом работы в стоматологии.',
    tags: ['Ассистент'], status: 'open',
  },
  {
    id: 'job-5', title: 'Врач-хирург-имплантолог', clinicName: 'Implant Center', city: 'Алматы',
    salary: '800 000 — 1 200 000 ₸', employmentType: 'Частичная занятость',
    description: 'Хирург-имплантолог для проведения операций по установке имплантов.',
    tags: ['Хирургия', 'Имплантация'], status: 'open',
  },
];

function ensureJson() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ vacancies: SEED.map((s) => ({ ...s, createdAt: new Date().toISOString() })), applications: [] }, null, 2));
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
    if (!prisma.jobVacancy) return false;
    await prisma.jobVacancy.count();
    return true;
  } catch {
    return false;
  }
}

async function ensurePrismaSeed() {
  const count = await prisma.jobVacancy.count();
  if (count === 0) {
    await prisma.jobVacancy.createMany({
      data: SEED.map((s) => ({
        ...s,
        id: s.id,
        tags: s.tags,
      })),
    });
  }
}

export default function jobsRoutes() {
  const router = Router();

  router.get('/', optionalAuth, async (req, res) => {
    try {
      const { q, city } = req.query;
      if (await usePrisma()) {
        await ensurePrismaSeed();
        const where = { status: 'open' };
        if (city && city !== 'all') where.city = String(city);
        if (q) {
          where.OR = [
            { title: { contains: String(q), mode: 'insensitive' } },
            { clinicName: { contains: String(q), mode: 'insensitive' } },
            { description: { contains: String(q), mode: 'insensitive' } },
          ];
        }
        const list = await prisma.jobVacancy.findMany({ where, orderBy: { createdAt: 'desc' } });
        return res.json(list);
      }

      const store = readJson();
      let list = store.vacancies.filter((v) => v.status === 'open');
      if (city && city !== 'all') list = list.filter((v) => v.city === city);
      if (q) {
        const s = String(q).toLowerCase();
        list = list.filter((v) =>
          v.title.toLowerCase().includes(s) ||
          v.clinicName.toLowerCase().includes(s) ||
          (v.description || '').toLowerCase().includes(s)
        );
      }
      res.json(list);
    } catch (e) {
      res.status(500).json({ error: e.message || 'Internal error' });
    }
  });

  router.get('/me/applications', authenticate, async (req, res) => {
    try {
      if (await usePrisma()) {
        const apps = await prisma.jobApplication.findMany({
          where: { userId: req.user.id },
          orderBy: { createdAt: 'desc' },
        });
        return res.json(apps);
      }
      const store = readJson();
      res.json(store.applications.filter((a) => a.userId === req.user.id));
    } catch (e) {
      res.status(500).json({ error: e.message || 'Internal error' });
    }
  });

  router.get('/:id', optionalAuth, async (req, res) => {
    try {
      if (await usePrisma()) {
        const item = await prisma.jobVacancy.findUnique({ where: { id: req.params.id } });
        if (!item) return res.status(404).json({ error: 'Not found' });
        return res.json(item);
      }
      const store = readJson();
      const item = store.vacancies.find((v) => v.id === req.params.id);
      if (!item) return res.status(404).json({ error: 'Not found' });
      res.json(item);
    } catch (e) {
      res.status(500).json({ error: e.message || 'Internal error' });
    }
  });

  router.post('/', authenticate, async (req, res) => {
    try {
      const { title, clinicName, city, salary, employmentType, description, tags } = req.body || {};
      if (!title) return res.status(400).json({ error: 'title required' });
      const vacancy = {
        id: crypto.randomUUID(),
        title,
        clinicName: clinicName || req.user?.name || 'Клиника',
        city: city || '',
        salary: salary || '',
        employmentType: employmentType || 'Полная занятость',
        description: description || '',
        tags: Array.isArray(tags) ? tags : [],
        status: 'open',
        userId: req.user.id,
        clinicId: req.user.activeClinicId || req.user.clinicId || null,
      };

      if (await usePrisma()) {
        const created = await prisma.jobVacancy.create({ data: vacancy });
        return res.status(201).json(created);
      }

      const store = readJson();
      store.vacancies.unshift({ ...vacancy, createdAt: new Date().toISOString() });
      writeJson(store);
      res.status(201).json(store.vacancies[0]);
    } catch (e) {
      res.status(500).json({ error: e.message || 'Internal error' });
    }
  });

  router.post('/:id/apply', authenticate, async (req, res) => {
    try {
      if (await usePrisma()) {
        const vacancy = await prisma.jobVacancy.findUnique({ where: { id: req.params.id } });
        if (!vacancy) return res.status(404).json({ error: 'Not found' });
        const existing = await prisma.jobApplication.findFirst({
          where: { vacancyId: req.params.id, userId: req.user.id },
        });
        if (existing) return res.json(existing);
        const application = await prisma.jobApplication.create({
          data: {
            id: crypto.randomUUID(),
            vacancyId: req.params.id,
            userId: req.user.id,
            userName: req.user.name || req.user.login,
            coverNote: req.body?.coverNote || '',
            status: 'new',
          },
        });
        return res.status(201).json(application);
      }

      const store = readJson();
      const vacancy = store.vacancies.find((v) => v.id === req.params.id);
      if (!vacancy) return res.status(404).json({ error: 'Not found' });
      const existing = store.applications.find((a) => a.vacancyId === req.params.id && a.userId === req.user.id);
      if (existing) return res.json(existing);
      const application = {
        id: crypto.randomUUID(),
        vacancyId: req.params.id,
        userId: req.user.id,
        userName: req.user.name || req.user.login,
        coverNote: req.body?.coverNote || '',
        status: 'new',
        createdAt: new Date().toISOString(),
      };
      store.applications.push(application);
      writeJson(store);
      res.status(201).json(application);
    } catch (e) {
      res.status(500).json({ error: e.message || 'Internal error' });
    }
  });

  return router;
}
