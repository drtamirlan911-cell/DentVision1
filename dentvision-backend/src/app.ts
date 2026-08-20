import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { csrfProtection } from './middleware/csrf.js';
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
import { biRouter } from './modules/bi/bi.routes.js';
import { diagnosticsRouter } from './modules/diagnostics/diagnostics.routes.js';
import { legalRouter } from './modules/legal/legal.routes.js';
import { legalPartnerRouter } from './modules/legal/legal.partner.routes.js';
import { webhookGatewayRouter } from './modules/ai-admin/index.js';
import { metaRouter } from './modules/meta-oauth/meta.routes.js';
import { organizationsRouter } from './modules/organizations/organizations.routes.js';
import { personsRouter } from './modules/persons/persons.routes.js';
import { patientPortalRouter } from './modules/patient-portal/patientPortal.routes.js';
import { aiPatientRouter } from './modules/ai-patient/aiPatient.routes.js';
import { patientPresentationRouter } from './modules/patient-presentation/patientPresentation.routes.js';
import { patientConversationRouter } from './modules/patient-conversation/patientConversation.routes.js';
import { patientInboxRouter } from './modules/patient-conversation/patientInbox.routes.js';
import { crossClinicRouter } from './modules/cross-clinic/cross-clinic.routes.js';
import compatRouter from './compat/compatRouter.js';
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
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://dentvision-backend.onrender.com", "https://dent-vision1.vercel.app", "wss:"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
    }
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
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

app.use(cookieParser());

// Capture raw body for webhook signature verification (before JSON parse)
app.use(express.json({
  limit: '10mb',
  verify: (req: any, _res, buf) => { req.rawBody = buf },
}));

app.use(express.urlencoded({ extended: false }));
app.use(csrfProtection);

// Rate limiting — never throttle CORS preflight; always keep CORS headers on 429
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
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
  max: 40,
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
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  message: { ok: false, error: 'Слишком много AI-запросов. Подождите немного.', code: 'AI_RATE_LIMIT' },
});
const guestSessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
});
app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/refresh', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/auth/switch-clinic', authLimiter);
app.use('/api/ai/query', aiLimiter);
app.use('/api/ai/query/stream', aiLimiter);
app.use('/api/guest/session', guestSessionLimiter);
app.use('/api/guest/convert', authLimiter);
app.use('/api/audit/backup', apiLimiter);

// Webhook callbacks — tight limit (genuine callbacks are infrequent).
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, _next, options) => {
    applyCorsHeaders(req, res);
    res.status(options.statusCode).json({ ok: false, error: 'Too many webhook requests', code: 'WEBHOOK_RATE_LIMIT' });
  },
});
app.use('/api/payments/callbacks', webhookLimiter);

// ─── Health ───
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'dentvision-backend', version: '2.0.0', timestamp: new Date().toISOString() });
});

// ─── Legacy Compatibility (service-access/public) ───
app.use('/api', compatRouter);

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
app.use('/api/bi', biRouter);
app.use('/api/diagnostics', diagnosticsRouter);
app.use('/api/legal', legalRouter);
app.use('/api/partner/legal', legalPartnerRouter);
app.use('/api/finance', financeRouter);
app.use('/api/disputes', disputesRouter);
app.use('/api/ai-admin/webhook', webhookGatewayRouter);
app.use('/api/ai-governance', aiGovernanceRouter);
app.use('/api/meta', metaRouter);

// ─── Universal Organization / Person API (Phase 2) ───
app.use('/api/organizations', organizationsRouter);
app.use('/api/persons', personsRouter);
// Mounted before the portal router so the assistant is not behind the
// portal's blanket `requireConsent()` — a patient who has not yet accepted the
// AI agreement still needs `/ai/status` to tell the UI to ask for it.
app.use('/api/patient-portal/ai', aiPatientRouter);
// Beside the assistant, not under /api/ai: a patient's access to their own
// approved plan must not depend on their clinic's billing plan.
app.use('/api/patient-portal/presentation', patientPresentationRouter);
// Same reasoning: a live thread the assistant already escalated into must
// stay reachable even if the patient's AI consent lapses — this is a human
// conversation, not the assistant.
app.use('/api/patient-portal/conversation', patientConversationRouter);
app.use('/api/patient-portal', patientPortalRouter);
app.use('/api/cross-clinic', crossClinicRouter);
app.use('/api/patient-inbox', patientInboxRouter);

// ─── Restored after a silent regression in v2.0.0 ───
//
// These five were imported and mounted until `1d95e8ec`, a release-prep commit
// whose own message says it was *restoring* routes so the deploy could boot. In
// rewriting this file it dropped their `app.use` lines and left the imports, so
// the Developer Platform, Workflow Studio, Data Intelligence and Partner
// Program — and the public API-key surface — quietly 404'd for months. Nothing
// failed: the imports kept it compiling and no test asked.
//
// Prefixes are the originals from that diff. Every one of these routers applies
// `authenticate` at the router level and `requirePermission` on its mutating
// routes (`v1Router` uses `authenticateApiKey`), so this restores guarded
// functionality rather than opening a surface.
//
// `appMounts.test.ts` now fails if an imported router is ever left unmounted
// again.
app.use('/api/developer', developerRouter);
app.use('/api/v1', v1Router);
app.use('/api/partners', partnersRouter);
app.use('/api/workflows', workflowRouter);
app.use('/api/data', dataRouter);

// ─── Error Handling ───
app.use(notFound);
app.use(errorHandler);

export default app;
