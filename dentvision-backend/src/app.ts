import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

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
import { suppliersRouter } from './modules/suppliers/suppliers.routes.js';
import { academiesRouter, lecturersRouter } from './modules/academy/academy.routes.js';
import { financeRouter } from './modules/finance/finance.routes.js';
import { paymentsRouter } from './modules/payments/payments.routes.js';
import { subscriptionsRouter } from './modules/billing/subscriptions.routes.js';
import { disputesRouter } from './modules/finance/disputes.routes.js';
import { developerRouter } from './modules/developer/developer.routes.js';
import { v1Router } from './modules/developer/v1.routes.js';
import { registerSubscribers } from './events/subscribers.js';
import { registerWebhookDispatcher } from './modules/developer/webhook.dispatcher.js';

// Wire up domain-event subscribers (audit, webhooks, etc.) once at import time.
registerSubscribers();
registerWebhookDispatcher();

const app = express();

// ─── Global Middleware ───
app.set('trust proxy', 1);
app.use(helmet());
const corsOrigins = env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map(s => s.trim());
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ─── Health ───
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'dentvision-backend', version: '1.0.0', timestamp: new Date().toISOString() });
});

// ─── Routes ───
app.use('/api/auth', authRouter);
app.use('/api/iam', iamRouter);
app.use('/api/clinics', clinicsRouter);
app.use('/api/patients', patientsRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/medical', medicalRouter);
app.use('/api/billing', billingRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/shop', shopRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/academies', academiesRouter);
app.use('/api/lecturers', lecturersRouter);
app.use('/api/finance', financeRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/disputes', disputesRouter);
app.use('/api/developer', developerRouter);
app.use('/api/v1', v1Router);
app.use('/api/school', schoolRouter);
app.use('/api/ai', aiRouter);
app.use('/api/guest', guestRouter);
app.use('/api/analytics', analyticsRouter);
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

// ─── Error Handling ───
app.use(notFound);
app.use(errorHandler);

export default app;
