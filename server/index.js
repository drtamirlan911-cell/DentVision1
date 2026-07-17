import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import prisma from './lib/prisma.js';
import { initDatabase } from './seed.js';
import registerBridgeRoutes from './routes/bridge.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1);

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
app.use(express.urlencoded({ limit: '1mb', extended: true }));
app.use((err, _req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Некорректный JSON в теле запроса' });
  }
  next(err);
});

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false, validate: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, validate: false });
const publicBookingLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, validate: false });
app.use('/api/', apiLimiter);

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

import crypto from 'crypto';

import authRoutes from './routes/auth.js';
import clinicRoutes from './routes/clinic.js';
import crmRoutes from './routes/crm.js';
import medicalRoutes from './routes/medical.js';
import shopRoutes from './routes/shop.js';
import schoolRoutes from './routes/school.js';
import publicRoutes from './routes/public.js';
import auditRoutes from './routes/audit.js';
import serviceAccessRoutes from './routes/serviceAccess.js';
import notificationRoutes from './routes/notifications.js';
import profileRoutes from './routes/profile.js';
import aiRoutes from './ai/chat.js';
import { authenticate } from './middleware/auth.js';
import { requirePermission, requireSuperadmin } from './middleware/rbac.js';

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT NOW()`;
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(500).json({ status: 'error', message: 'Database connection failed' });
  }
});

app.use('/api/public', publicRoutes(publicBookingLimiter));

app.get('/api/clinics', async (_req, res) => {
  try {
    const result = await prisma.clinic.findMany({ orderBy: { name: 'asc' } });
    res.json(result);
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

app.use('/api/auth', authRoutes(authLimiter));
app.use('/api/profile', authenticate, profileRoutes());
app.use('/api/ai', aiRoutes());

app.use('/api/clinic', clinicRoutes(writeAuditLog));
app.use('/api/crm', crmRoutes(writeAuditLog));
app.use('/api', medicalRoutes(writeAuditLog));
app.use('/api/shop', shopRoutes());
app.use('/api/school', schoolRoutes());
app.use('/api/service-access', serviceAccessRoutes());
app.use('/api/notifications', notificationRoutes());
app.use('/api', auditRoutes(writeAuditLog));

registerBridgeRoutes(app, writeAuditLog);

app.get('/api/csp-policy', (_req, res) => {
  res.json({
    policy: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  });
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.message, err.stack);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal server error' });
});

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
