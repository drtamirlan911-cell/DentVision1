import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
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
  OPENAI_MODEL: z.string().optional(),
  OPENAI_MODEL_MINI: z.string().optional(),
  OPENAI_MODEL_MODE: z.enum(['auto', 'mini', 'full']).default('auto'),
  OPENAI_IMAGE_MODEL: z.string().default('gpt-image-1'),
  MARKETING_IMAGE_DAILY_LIMIT: z.coerce.number().default(10),
  OPENAI_DAILY_MINI_TOKENS: z.coerce.number().default(2_400_000),
  OPENAI_DAILY_FULL_TOKENS: z.coerce.number().default(240_000),
  OPENAI_REASONING_EFFORT: z.enum(['low', 'medium', 'high']).default('low'),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CERTS_URL: z.string().url().optional(),
  RESEND_API_KEY: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  PLATFORM_OPS_SECRET: z.string().optional(),
  KASPI_CALLBACK_SECRET: z.string().optional(),
  KASPI_MERCHANT_ID: z.string().optional(),
  KASPI_API_KEY: z.string().optional(),
  KASPI_PAY_BASE_URL: z.string().url().optional(),
  FRONTEND_URL: z.string().url().optional(),
  PUBLIC_API_URL: z.string().url().optional(),
  REMINDER_CRON_MS: z.coerce.number().default(900000),
  META_APP_SECRET: z.string().min(10).optional(),
  META_APP_ID: z.string().optional(),
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  AI_ADMIN_MAX_HISTORY: z.coerce.number().default(20),
  AI_PATIENT_SCOPE: z.enum(['on', 'off']).default('off'),
});

export const env = envSchema.parse(process.env);

// Production must fail closed for integrations that can otherwise report a
// false success: payment callbacks, merchant payments, and medical-file storage.
// Local/test environments intentionally keep the existing optional fallbacks.
if (env.NODE_ENV === 'production') {
  const missing: string[] = [];
  if (!env.KASPI_CALLBACK_SECRET || env.KASPI_CALLBACK_SECRET.length < 32) {
    missing.push('KASPI_CALLBACK_SECRET (min 32 chars)');
  }
  if (!env.KASPI_MERCHANT_ID) missing.push('KASPI_MERCHANT_ID');
  if (!env.KASPI_API_KEY) missing.push('KASPI_API_KEY');
  if (!env.S3_BUCKET) missing.push('S3_BUCKET');
  if (!env.S3_ACCESS_KEY) missing.push('S3_ACCESS_KEY');
  if (!env.S3_SECRET_KEY) missing.push('S3_SECRET_KEY');
  if (!env.ENCRYPTION_KEY) missing.push('ENCRYPTION_KEY');
  if (!env.FRONTEND_URL) missing.push('FRONTEND_URL');
  if (!env.PUBLIC_API_URL) missing.push('PUBLIC_API_URL');

  if (env.CORS_ORIGIN === '*' || env.CORS_ORIGIN.includes('*')) {
    missing.push('CORS_ORIGIN must be an explicit production origin, not *');
  }

  if (missing.length > 0) {
    console.error(`[config] Production configuration is incomplete: ${missing.join(', ')}`);
    process.exit(1);
  }
}
