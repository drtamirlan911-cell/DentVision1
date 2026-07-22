import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import {
  applyCorsHeaders,
  corsGuard,
  isOriginAllowed,
  CORS_HEADERS,
  CORS_METHODS,
} from './lib/cors.js';

// Routes
import { authRouter } from './modules/auth/auth.routes.js';
import { clinicsRouter } from './modules/clinics/clinics.routes.js';
import { patientsRouter } from './modules/patients/patients.routes.js';
import { appointmentsRouter } from './modules/appointments/appointments.routes.js';
import { medicalRouter } from './modules/medical/medical.routes.js';
import { billingRouter } from './modules/billing/billing.routes.js';
import { inventoryRouter } from './modules/inventory/inventory.routes.js';
import { shopRouter } from './modules/shop/shop.routes.js';
import { schoolRouter } from './modules/school/school.routes.js';
import { aiRouter } from './modules/ai/ai.routes.js';
import { guestRouter } from './modules/guest/guest.routes.js';
import { analyticsRouter } from './modules/analytics/analytics.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { filesRouter } from './modules/files/files.routes.js';
import { auditRouter } from './modules/audit/audit.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { crmRouter } from './modules/crm/crm.routes.js';
import { crmOpsRouter } from './modules/crm/ops.routes.js';
import { remindersRouter } from './modules/crm/reminders.routes.js';
import { chairsRouter } from './modules/crm/chairs.routes.js';
import { labRouter } from './modules/lab/lab.routes.js';
import { communityRouter } from './modules/community/community.routes.js';
import { iamRouter } from './modules/iam/iam.routes.js';
import { academiesRouter, lecturersRouter } from './modules/academy/academy.routes.js';
import { financeRouter } from './modules/finance/finance.routes.js';
import { paymentsRouter } from './modules/payments/payments.routes.js';
import { subscriptionsRouter } from './modules/billing/subscriptions.routes.js';
import { clinicBillingRouter } from './modules/billing/clinicBilling.routes.js';
import { disputesRouter } from './modules/finance/disputes.routes.js';
import { developerRouter } from './modules/developer/developer.routes.js';
import { v1Router } from './modules/developer/v1.routes.js';
import { partnersRouter } from './modules/partners/partners.routes.js';
import { workflowRouter } from './modules/workflow/workflow.routes.js';
import { dataRouter } from './modules/data/data.routes.js';
import { aiGovernanceRouter } from './modules/ai-governance/ai-governance.routes.js';
import { supplierWorkspaceRouter } from './modules/supplier-workspace/workspace.routes.js';
import { lecturerRouter } from './modules/school-workspace/lecturer.routes.js';
import { profileRouter } from './modules/profile/profile.routes.js';
import { jobsRouter } from './modules/jobs/jobs.routes.js';
import { opsSuppliersRouter } from './modules/ops/ops.suppliers.routes.js';
import { opsHubRouter } from './modules/ops/ops.hub.routes.js';
import { suppliersRouter } from './modules/suppliers/suppliers.routes.js';
import { ecosystemRouter } from './modules/analytics/ecosystem.routes.js';
import { complianceRouter } from './modules/compliance/compliance.routes.js';
import { publicRouter } from './modules/public/public.routes.js';
import { dentcashRouter } from './modules/dentcash/dentcash.routes.js';
import { registerSubscribers } from './events/subscribers.js';

// Wire up domain-event subscribers (audit, etc.) once at import time.
registerSubscribers();

const app = express();

// ─── Global Middleware ───
app.set('trust proxy', 1);

// Always set CORS first — including on 4xx/5xx/429 — so browsers show real errors.
app.use(corsGuard);

// Helmet: keep security headers, but allow cross-origin browser fetches from Vercel.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
}));

app.use(cors({
  origin(origin, cb) {
    if (isOriginAllowed(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
  methods: [...CORS_METHODS],
  allowedHeaders: [...CORS_HEADERS],
  optionsSuccessStatus: 204,
  maxAge: 86400,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting — never throttle CORS preflight; always keep CORS headers on 429
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  handler: (req, res, _next, options) => {
    applyCorsHeaders(req, res);
    res.status(options.statusCode).json({
      ok: false,
      error: 'Слишком много запросов. Подождите немного.',
      code: 'RATE_LIMIT',
    });
  },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  handler: (req, res, _next, options) => {
    applyCorsHeaders(req, res);
    res.status(options.statusCode).json({
      ok: false,
      error: 'Слишком много попыток входа. Подождите 15 минут.',
      code: 'AUTH_RATE_LIMIT',
    });
  },
});
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  message: { ok: false, error: 'Слишком много AI-запросов. Подождите немного.', code: 'AI_RATE_LIMIT' },
});
const guestSessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
});
app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/ai/query', aiLimiter);
app.use('/api/ai/query/stream', aiLimiter);
app.use('/api/guest/session', guestSessionLimiter);
app.use('/api/guest/convert', authLimiter);

// ─── Health ───
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'dentvision-backend', version: '2.0.0', timestamp: new Date().toISOString() });
});

// ─── Routes ───
app.use('/api/auth', authRouter);
app.use('/api/iam', iamRouter);
app.use('/api/clinics', clinicsRouter);
app.use('/api/patients', patientsRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/medical', medicalRouter);
app.use('/api/billing', billingRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/clinic-billing', clinicBillingRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/shop', shopRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/supplier', supplierWorkspaceRouter);
app.use('/api/lecturer', lecturerRouter);
app.use('/api/school', schoolRouter);
app.use('/api/dentcash', dentcashRouter);
app.use('/api/academies', academiesRouter);
app.use('/api/lecturers', lecturersRouter);
app.use('/api/ai', aiRouter);
app.use('/api/guest', guestRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/analytics', ecosystemRouter);
app.use('/api/compliance', complianceRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/files', filesRouter);
app.use('/api/documents', filesRouter);
app.use('/api/audit', auditRouter);
app.use('/api/admin', adminRouter);
app.use('/api/crm', crmRouter);
app.use('/api/crm', crmOpsRouter);
app.use('/api/crm', remindersRouter);
app.use('/api/crm', chairsRouter);
app.use('/api/lab-orders', labRouter);
app.use('/api/community', communityRouter);
app.use('/api/public', publicRouter);
app.use('/api/profile', profileRouter);
app.use('/api/jobs', jobsRouter);
// Hidden platform ops (no UI nav). SUPERADMIN + X-Platform-Ops-Key required; else 404.
app.use('/api/ops/suppliers', opsSuppliersRouter);
app.use('/api/ops', opsHubRouter);

// ─── Error Handling ───
app.use(notFound);
app.use(errorHandler);

export default app;
