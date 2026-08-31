import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  /** Set to 'true' to force Redis even for localhost/sidecar URLs (used by BullMQ + EventBus). Off by default → in-memory fallbacks. */
  REDIS_ENABLED: z.string().default('false'),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('24h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  ENCRYPTION_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().min(20).optional(),
  /**
   * Optional operator pin for the full tier. Leave unset and `modelCatalog`
   * discovers the best available model via `/v1/models`.
   *
   * These used to carry defaults, which is how production ended up on a
   * two-year-old model that nobody chose: the default always beat the newer id
   * declared elsewhere, and `render.yaml` never set either variable.
   */
  OPENAI_MODEL: z.string().optional(),
  /** Optional operator pin for the cheap tier. Unset ⇒ discovered. */
  OPENAI_MODEL_MINI: z.string().optional(),
  /** auto = cheap-first router; mini/full = force one tier. */
  OPENAI_MODEL_MODE: z.enum(['auto', 'mini', 'full']).default('auto'),
  /** Soft in-process daily budgets (approx tokens). Leave headroom vs provider caps. */
  /// Модель генерации картинок для контента. Отдельно от текстовой:
  /// у неё своя доступность и своя цена за штуку.
  OPENAI_IMAGE_MODEL: z.string().default('gpt-image-1'),
  /// Сколько картинок в сутки может сгенерировать одна клиника.
  /// Первая функция в проекте с оплатой за штуку — без потолка выпускать нельзя.
  MARKETING_IMAGE_DAILY_LIMIT: z.coerce.number().default(10),
  OPENAI_DAILY_MINI_TOKENS: z.coerce.number().default(2_400_000),
  OPENAI_DAILY_FULL_TOKENS: z.coerce.number().default(240_000),
  /** Reasoning effort for full-tier calls; mini always uses low. */
  OPENAI_REASONING_EFFORT: z.enum(['low', 'medium', 'high']).default('low'),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),
  /**
   * Transactional email.
   *
   * Primary transport is SMTP — the product sends from the Google account
   * dentvision.kz@gmail.com. `SMTP_PASSWORD` must be a Google **App Password**
   * (16 characters, spaces optional): Google refuses account passwords for SMTP,
   * and App Passwords only exist once 2-Step Verification is on.
   *
   * The two HTTP providers stay as alternatives for when the product outgrows a
   * Gmail sending limit; neither needs a package. With nothing configured every
   * send is skipped and callers behave exactly as they did before.
   */
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  /**
   * Google sign-in. Public value (it ships to the browser as
   * VITE_GOOGLE_CLIENT_ID too) — env-gated so the feature is simply off until
   * an OAuth client exists. No client secret: the ID-token flow does not use one.
   */
  GOOGLE_CLIENT_ID: z.string().optional(),
  /**
   * Development-only override for Google's JWKS endpoint, so the sign-in route
   * can be exercised end to end against a local key. Ignored in production —
   * see googleAuth.ts.
   */
  GOOGLE_CERTS_URL: z.string().url().optional(),
  RESEND_API_KEY: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  /** Envelope sender. Defaults to the SMTP account when one is configured. */
  EMAIL_FROM: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  /** Shared secret for hidden platform-ops surface (supplier verify, etc.). Min 24 chars in production. */
  PLATFORM_OPS_SECRET: z.string().optional(),
  /** Kaspi / payment webhook shared secret (min 32 in production). Required to accept paid callbacks. */
  KASPI_CALLBACK_SECRET: z.string().optional(),
  /** Kaspi merchant ID from Kaspi Business dashboard. */
  KASPI_MERCHANT_ID: z.string().optional(),
  /** Kaspi API key from Kaspi Business dashboard. */
  KASPI_API_KEY: z.string().optional(),
  /** Kaspi pay base URL for QR deeplinks. */
  KASPI_PAY_BASE_URL: z.string().url().optional(),
  /** Frontend URL for Kaspi ReturnUrl. */
  FRONTEND_URL: z.string().url().optional(),
  /** Public API URL for webhook callbacks. Used by clinic payments module. */
  PUBLIC_API_URL: z.string().url().optional(),
  REMINDER_CRON_MS: z.coerce.number().default(900000),
  /** Meta App Secret for WhatsApp/Instagram webhook signature verification. */
  META_APP_SECRET: z.string().min(10).optional(),
  /** Meta App ID for OAuth Embedded Signup. */
  META_APP_ID: z.string().optional(),
  /** Shared webhook verify token for Meta — if set, overrides per-clinic tokens. */
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  /** Max conversation history messages sent to LLM. */
  AI_ADMIN_MAX_HISTORY: z.coerce.number().default(20),
  /**
   * Enforces the AI kernel's patient-scope check (`ai/os/kernel.ts` step 5):
   * a DOCTOR/ASSISTANT may only use a single-patient tool (getPatientCard,
   * createTreatmentPlan, createAppointment, createInvoice) on a patient
   * `PatientAssignment` links them to. AI-only: human REST/UI access is
   * unaffected either way.
   *
   * Safe to turn on once the backfill migration has run: assignments no longer
   * come only from that one-off backfill. `lib/patientAssignment.ts`, driven by
   * the `appointment.created` subscriber, records one every time a patient is
   * booked with a doctor — through the schedule, online booking, the AI tools
   * or the ai-admin webhook — and the patient card has a «Ответственные»
   * section for the exceptions. Before that existed, every patient seen after
   * the backfill had no row and their own doctor was refused.
   *
   * Still off by default: switching it on narrows what the AI will do for a
   * doctor, and that is a clinic's decision to make deliberately.
   */
  AI_PATIENT_SCOPE: z.enum(['on', 'off']).default('off'),
});

export const env = envSchema.parse(process.env);

// Startup validation: require KASPI_CALLBACK_SECRET in production
if (env.NODE_ENV === 'production') {
  if (!env.KASPI_CALLBACK_SECRET || env.KASPI_CALLBACK_SECRET.length < 32) {
    console.error('[config] KASPI_CALLBACK_SECRET must be set in production (min 32 chars)');
    process.exit(1);
  }

}
