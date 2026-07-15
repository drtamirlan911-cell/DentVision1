// ═══════════════════════════════════════════════════════════════════
// DENTVISION API SERVER — PostgreSQL (Neon) Backend
// Modular architecture with JWT auth, RBAC, multi-tenant isolation
// ═══════════════════════════════════════════════════════════════════

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import prisma from './lib/prisma.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/.*\.vercel\.app$/.test(origin)) return true;
  return false;
}

app.use(helmet());
app.use(cors({ origin: (origin, cb) => cb(null, isOriginAllowed(origin)), credentials: true }));
app.use(express.json({ limit: '1mb' }));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
const publicBookingLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);

// ═══════════════════════════════════════════════════════════════
// AUDIT LOG HELPER
// ═══════════════════════════════════════════════════════════════
async function writeAuditLog(clinicId, userId, userName, action, entityType, entityId, details) {
  try {
    await prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        clinicId,
        userId,
        userName,
        action,
        entityType,
        entityId: entityId || null,
        details: details ? JSON.stringify(details) : null,
      },
    });
  } catch (e) { console.error('Audit log write failed:', e.message); }
}

// ═══════════════════════════════════════════════════════════════
// IMPORT ROUTE MODULES
// ═══════════════════════════════════════════════════════════════
import authRoutes from './routes/auth.js';
import clinicRoutes from './routes/clinic.js';
import medicalRoutes from './routes/medical.js';
import shopRoutes from './routes/shop.js';
import schoolRoutes from './routes/school.js';
import publicRoutes from './routes/public.js';
import auditRoutes from './routes/audit.js';
import { authenticate } from './middleware/auth.js';

// ═══════════════════════════════════════════════════════════════
// DATABASE INITIALIZATION (seed data via raw SQL)
// ═══════════════════════════════════════════════════════════════
async function initDatabase() {
  try {
    // Seed ICD-10 if empty
    const icd10Count = await prisma.icd10.count();
    if (icd10Count === 0) {
      const icd10Data = [
        ['K02', 'Кариес зубов', 'Кариес и некариозные поражения', 'Поражение твёрдых тканей зубов'],
        ['K02.0', 'Кариес эмали', 'Кариес', 'Начальный кариес в стадии белого пятна'],
        ['K02.1', 'Кариес дентина', 'Кариес', 'Кариес, поражающий дентин'],
        ['K02.2', 'Кариес цемента', 'Кариес', 'Кариес корня зуба'],
        ['K02.9', 'Кариес зубов неуточнённый', 'Кариес', 'Кариес без уточнения'],
        ['K03', 'Другие болезни твёрдых тканей зубов', 'Некариозные поражения', ''],
        ['K04', 'Болезни пульпы и периапикальных тканей', 'Эндодонтия', ''],
        ['K04.0', 'Пульпит', 'Эндодонтия', 'Воспаление пульпы зуба'],
        ['K04.3', 'Острый апикальный периодонтит', 'Эндодонтия', 'Воспаление периодонта у верхушки корня'],
        ['K04.4', 'Хронический апикальный периодонтит', 'Эндодонтия', ''],
        ['K05', 'Гингивит и болезни пародонта', 'Пародонтология', ''],
        ['K05.2', 'Острый пародонтит', 'Пародонтология', ''],
        ['K05.3', 'Хронический пародонтит', 'Пародонтология', ''],
        ['K07', 'Деформации челюстей и зубо-челюстного аппарата', 'Ортодонтия', ''],
        ['K07.1', 'Деформации зубных рядов', 'Ортодонтия', 'Неправильный прикус'],
        ['K07.3', 'Аномалии положения зубов', 'Ортодонтия', 'Дистопия, ретенция'],
        ['K08', 'Потеря зубов и замещение дефектов', 'Ортопедия', ''],
        ['K12', 'Стоматит и связанные поражения', 'Терапия', ''],
        ['S02.4', 'Перелом верхней челюсти', 'Травматология', ''],
        ['S02.5', 'Перелом нижней челюсти', 'Травматология', ''],
      ];
      await prisma.icd10.createMany({ data: icd10Data.map(([code, name, category, description]) => ({ code, name, category, description })) });
    }

    // Seed users + clinics if empty
    const clinicCount = await prisma.clinic.count();
    if (clinicCount === 0) {
      const saPass = await bcrypt.hash('DentVision2025!', 10);
      const adminPass = await bcrypt.hash('admin123', 10);
      const docPass = await bcrypt.hash('doc123', 10);
      const dirPass = await bcrypt.hash('dir123', 10);
      const assistPass = await bcrypt.hash('assist123', 10);

      await prisma.clinic.createMany({
        data: [
          { id: 'c1', name: 'DentVision Тараз — Центр', city: 'Тараз', address: 'ул. Толе би, 32', phone: '+7 726 222-33-44', plan: 'pro', active: true, color: '#C9A96E' },
          { id: 'c2', name: 'DentVision Тараз — Север', city: 'Тараз', address: 'мкр. Мирас, 15', phone: '+7 726 255-11-22', plan: 'starter', active: true, color: '#3498DB' },
        ],
      });

      await prisma.user.createMany({
        data: [
          { id: 'sa', clinicId: null, login: 'dr.tamirlan', passwordHash: saPass, name: 'Dr. Tamirlan', role: 'superadmin' },
          { id: 'u1', clinicId: 'c1', login: 'admin_c1', passwordHash: adminPass, name: 'Анна Королёва', role: 'admin', phone: '+77161234567' },
          { id: 'u2', clinicId: 'c1', login: 'doc1_c1', passwordHash: docPass, name: 'Иванова Мария Сергеевна', role: 'doctor', spec: 'Терапевт', phone: '+77031112233' },
          { id: 'u3', clinicId: 'c1', login: 'doc2_c1', passwordHash: docPass, name: 'Петров Алексей Иванович', role: 'doctor', spec: 'Ортопед', phone: '+77017778899' },
          { id: 'u6', clinicId: 'c1', login: 'dir_c1', passwordHash: dirPass, name: 'Нурлан Бекжан', role: 'director', phone: '+77011234567' },
          { id: 'u7', clinicId: 'c1', login: 'assist_c1', passwordHash: assistPass, name: 'Карина Омарова', role: 'assistant', spec: 'Ассистент', phone: '+77055551234' },
          { id: 'u4', clinicId: 'c2', login: 'admin_c2', passwordHash: adminPass, name: 'Борис Сейткали', role: 'admin', phone: '+77261234567' },
          { id: 'u5', clinicId: 'c2', login: 'doc1_c2', passwordHash: docPass, name: 'Сидорова Елена Юрьевна', role: 'doctor', spec: 'Терапевт', phone: '+77265554433' },
        ],
      });

      // Seed shop + school data
      const catCount = await prisma.shopCategory.count();
      if (catCount === 0) {
        await prisma.shopCategory.createMany({
          data: [
            { id: 'sc1', name: 'Материалы', slug: 'materials', icon: '🧪', description: 'Пломбировочные материалы', sortOrder: 1 },
            { id: 'sc2', name: 'Импланты', slug: 'implants', icon: '🦷', description: 'Дентальные импланты', sortOrder: 2 },
            { id: 'sc3', name: 'Инструменты', slug: 'instruments', icon: '🔧', description: 'Стоматологические инструменты', sortOrder: 3 },
            { id: 'sc4', name: 'CAD/CAM', slug: 'cadcam', icon: '💻', description: 'Системы компьютерного проектирования', sortOrder: 4 },
            { id: 'sc5', name: 'Микроскопы', slug: 'microscopes', icon: '🔬', description: 'Стоматологические микроскопы', sortOrder: 5 },
            { id: 'sc6', name: 'Компрессоры', slug: 'compressors', icon: '🌬️', description: 'Стоматологические компрессоры', sortOrder: 6 },
            { id: 'sc7', name: 'Автоклавы', slug: 'autoclaves', icon: '♨️', description: 'Стерилизационное оборудование', sortOrder: 7 },
            { id: 'sc8', name: 'Сканеры', slug: 'scanners', icon: '📡', description: 'Внутриротовые и лабораторные сканеры', sortOrder: 8 },
            { id: 'sc9', name: 'Кресла', slug: 'chairs', icon: '💺', description: 'Стоматологические кресла', sortOrder: 9 },
            { id: 'sc10', name: 'Лазеры', slug: 'lasers', icon: '✨', description: 'Стоматологические лазеры', sortOrder: 10 },
            { id: 'sc11', name: 'Расходники', slug: 'consumables', icon: '🧤', description: 'Одноразовые расходные материалы', sortOrder: 11 },
            { id: 'sc12', name: 'Литература', slug: 'literature', icon: '📚', description: 'Учебники и пособия', sortOrder: 12 },
          ],
        });

        await prisma.shopSupplier.createMany({
          data: [
            { id: 'sup1', name: 'Dental World', country: 'Китай', city: 'Шэньчжэнь', phone: '+86-755-1234567', email: 'info@dentalworld.cn', website: 'dentalworld.cn', rating: 4.2, deliveryDays: 14, deliveryCost: 5000, freeDeliveryFrom: 100000 },
            { id: 'sup2', name: 'EuroDent Supply', country: 'Германия', city: 'Мюнхен', phone: '+49-89-7654321', email: 'order@eurodent.de', website: 'eurodent.de', rating: 4.8, deliveryDays: 10, deliveryCost: 8000, freeDeliveryFrom: 150000 },
            { id: 'sup3', name: 'MedTrade Plus', country: 'Россия', city: 'Москва', phone: '+7-495-1112233', email: 'sales@medtrade.ru', website: 'medtrade.ru', rating: 4.5, deliveryDays: 5, deliveryCost: 2500, freeDeliveryFrom: 50000 },
            { id: 'sup4', name: 'KazDent', country: 'Казахстан', city: 'Алматы', phone: '+7-727-3334455', email: 'info@kazdent.kz', website: 'kazdent.kz', rating: 4.6, deliveryDays: 2, deliveryCost: 0, freeDeliveryFrom: 20000 },
            { id: 'sup5', name: 'Global Dental', country: 'США', city: 'Нью-Йорк', phone: '+1-212-9876543', email: 'global@dentalsupply.com', website: 'dentalsupply.com', rating: 4.7, deliveryDays: 21, deliveryCost: 12000, freeDeliveryFrom: 200000 },
          ],
        });

        await prisma.shopProduct.createMany({
          data: [
            { id: 'sp1', categoryId: 'sc1', supplierId: 'sup2', name: 'Filtek Supreme XTE', brand: '3M', model: 'Universal Restorative', description: 'Универсальный нанокомпозит для реставраций', price: 68000, oldPrice: 75000, stock: 45, minStock: 10, rating: 4.8, reviewCount: 124, tags: ['композит', 'реставрация'] },
            { id: 'sp2', categoryId: 'sc1', supplierId: 'sup2', name: 'Estelite Sigma Quick', brand: 'Tokuyama', model: 'Nano Composite', description: 'Наногибридный композит', price: 55000, stock: 32, minStock: 10, rating: 4.7, reviewCount: 89, tags: ['композит', 'наногибрид'] },
            { id: 'sp5', categoryId: 'sc2', supplierId: 'sup2', name: 'Bone Level Implant SLA', brand: 'Straumann', model: 'RB/LB', description: 'Имплантат Straumann Bone Level', price: 285000, oldPrice: 320000, stock: 18, minStock: 5, rating: 4.9, reviewCount: 203, tags: ['имплант', 'Straumann'] },
            { id: 'sp7', categoryId: 'sc2', supplierId: 'sup4', name: 'TS III SA Surface', brand: 'Osstem', model: 'Standard', description: 'Имплантат Osstem TS III', price: 95000, oldPrice: 110000, stock: 35, minStock: 10, rating: 4.6, reviewCount: 312, tags: ['имплант', 'Osstem'] },
            { id: 'sp10', categoryId: 'sc4', supplierId: 'sup2', name: 'CEREC PrimeScan', brand: 'Dentsply Sirona', model: 'Intraoral Scanner', description: 'Внутриротовой сканер нового поколения', price: 18500000, stock: 3, minStock: 1, rating: 4.9, reviewCount: 87, tags: ['сканер', 'CEREC'] },
            { id: 'sp18', categoryId: 'sc11', supplierId: 'sup4', name: 'Перчатки нитриловые S', brand: 'ZARYA', model: 'Powder Free', description: 'Нитриловые перчатки без талька', price: 4500, stock: 200, minStock: 50, rating: 4.3, reviewCount: 89, tags: ['перчатки', 'расходник'] },
          ],
        });

        await prisma.schoolCourse.createMany({
          data: [
            { id: 'crs1', category: 'Терапия', title: 'Современная терапия кариеса', subtitle: 'От диагностики до реставрации', description: 'Полный курс по терапевтической стоматологии', instructor: 'Иванова Мария Сергеевна', instructorTitle: 'К.м.н., Терапевт', difficulty: 'beginner', durationHours: 40, lessonCount: 24, price: 0, rating: 4.8, enrolledCount: 1247, tags: ['кариес', 'реставрация'], certificateEnabled: true },
            { id: 'crs2', category: 'Имплантация', title: 'Имплантология: от А до Я', subtitle: 'Полный курс дентальной имплантации', description: 'Всё о дентальной имплантации', instructor: 'Петров Алексей Иванович', instructorTitle: 'Хирург-имплантолог', difficulty: 'intermediate', durationHours: 60, lessonCount: 32, price: 0, rating: 4.9, enrolledCount: 892, tags: ['имплантация', 'хирургия'], certificateEnabled: true },
            { id: 'crs3', category: 'Ортодонтия', title: 'Ортодонтия с нуля', subtitle: 'Основы ортодонтического лечения', description: 'Курс для начинающих ортодонтов', instructor: 'Каримова Айгуль Т.', instructorTitle: 'Ортодонт', difficulty: 'beginner', durationHours: 30, lessonCount: 20, price: 0, rating: 4.7, enrolledCount: 634, tags: ['ортодонтия', 'брекеты'], certificateEnabled: true },
            { id: 'crs9', category: 'AI', title: 'AI в стоматологии', subtitle: 'Искусственный интеллект в клинической практике', description: 'Как AI меняет стоматологию', instructor: 'Дмитрий Технологов', instructorTitle: 'AI Research Lead', difficulty: 'intermediate', durationHours: 25, lessonCount: 15, price: 0, rating: 4.7, enrolledCount: 432, tags: ['AI', 'диагностика'], certificateEnabled: true },
          ],
        });

        console.log('Shop + School seed data inserted');
      }
    }

    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Database initialization error:', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// HEALTH CHECK (public)
// ═══════════════════════════════════════════════════════════════
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT NOW()`;
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(500).json({ status: 'error', message: 'Database connection failed' });
  }
});

// ═══════════════════════════════════════════════════════════════
// PUBLIC ROUTES (no auth required)
// ═══════════════════════════════════════════════════════════════
app.use('/api/public', publicRoutes(publicBookingLimiter));

// Clinic list (public for login page)
app.get('/api/clinics', async (_req, res) => {
  try {
    const result = await prisma.clinic.findMany({ orderBy: { name: 'asc' } });
    res.json(result);
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

// ═══════════════════════════════════════════════════════════════
// AUTH ROUTES (with rate limiting)
// ═══════════════════════════════════════════════════════════════
app.use('/api/auth', authRoutes(authLimiter));

// ═══════════════════════════════════════════════════════════════
// PROTECTED ROUTES (JWT required)
// ═══════════════════════════════════════════════════════════════
app.use('/api/clinic', clinicRoutes(writeAuditLog));
app.use('/api', medicalRoutes(writeAuditLog));
app.use('/api/shop', shopRoutes());
app.use('/api/school', schoolRoutes());
app.use('/api', auditRoutes(writeAuditLog));

// ═══════════════════════════════════════════════════════════════
// CSP Policy endpoint (public)
// ═══════════════════════════════════════════════════════════════
app.get('/api/csp-policy', (_req, res) => {
  res.json({
    policy: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  });
});

// ═══════════════════════════════════════════════════════════════
// GRACEFUL SHUTDOWN
// ═══════════════════════════════════════════════════════════════
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });
process.on('SIGINT', async () => { await prisma.$disconnect(); process.exit(0); });

async function startServer() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`API Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

startServer();
