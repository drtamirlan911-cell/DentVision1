/**
 * Channel-aware notification dispatch.
 *
 * The in-app record is the source of truth and is always created. Additional
 * channels (WhatsApp, SMS, email) are best-effort: they only fire when the clinic has
 * enabled them AND the channel is actually configured AND the recipient identity
 * is known, and any channel failure is swallowed so it can never break the in-app
 * notification.
 */
import prisma from '../../lib/prisma.js';
import { uid } from '../../lib/helpers.js';
import { sendMessage } from '../ai-admin/sender/messenger.sender.js';
import type { Channel } from '../ai-admin/webhook/types.js';
import { createSmsProvider } from '../../services/messaging.js';
import type { SmsProvider } from '../../services/messaging.js';

/** Pluggable email gateway. No provider is configured yet → getEmailProvider returns null. */
export interface EmailProvider {
  send(to: string, subject: string, html: string): Promise<void>;
}

function getEmailProvider(): EmailProvider | null {
  // Wire SendGrid / SES / custom SMTP here (env-gated). Until then email is skipped.
  return null;
}

function getSmsProvider(): SmsProvider | null {
  return createSmsProvider();
}

export interface DispatchInput {
  userId: string;
  clinicId?: string | null;
  type: string;
  title: string;
  message: string;
  link?: string | null;
}

export interface DispatchResult {
  inApp: boolean;
  whatsapp: boolean;
  sms: boolean;
  email: boolean;
}

function composeText(input: DispatchInput): string {
  return `${input.title}\n\n${input.message}`.trim();
}

/**
 * Create the in-app notification and fan out to any enabled/configured channels.
 * Never throws — channel errors are logged and ignored.
 */
export async function dispatchNotification(input: DispatchInput): Promise<DispatchResult> {
  const result: DispatchResult = { inApp: false, whatsapp: false, sms: false, email: false };

  // 1) In-app — always, and it is the source of truth.
  try {
    await prisma.notification.create({
      data: {
        id: uid(),
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link || null,
      },
    });
    result.inApp = true;
  } catch (e) {
    console.error('[notify] in-app create failed', e);
  }

  if (!input.clinicId) return result;

  // Resolve clinic channel prefs + recipient contact (needed for WhatsApp/SMS/email).
  const [clinic, user] = await Promise.all([
    prisma.clinic.findUnique({ where: { id: input.clinicId }, select: { settings: true } }).catch(() => null),
    prisma.user.findUnique({ where: { id: input.userId }, select: { phone: true, email: true } }).catch(() => null),
  ]);
  const settings = (clinic?.settings && typeof clinic.settings === 'object'
    ? clinic.settings
    : {}) as Record<string, unknown>;
  const phone = user?.phone ? String(user.phone).replace(/[^\d]/g, '') : '';
  const text = composeText(input);

  // 2) WhatsApp — best-effort. Requires active WHATSAPP config + phone.
  if (phone && settings.whatsappEnabled !== false) {
    try {
      const cfg = await prisma.clinicMessengerConfig.findFirst({
        where: { clinicId: input.clinicId, channel: 'WHATSAPP' as never, isActive: true },
        select: { accessToken: true, phoneNumberId: true },
      });
      if (cfg?.accessToken && cfg.phoneNumberId) {
        await sendMessage({
          channel: 'WHATSAPP' as Channel,
          externalUserId: phone,
          text,
          accessToken: cfg.accessToken,
          phoneNumberId: cfg.phoneNumberId,
        });
        result.whatsapp = true;
      }
    } catch (e) {
      console.warn('[notify] whatsapp skipped/failed:', (e as Error)?.message);
    }
  }

  // 3) SMS — best-effort. Requires a configured provider + phone.
  if (phone && settings.smsEnabled) {
    const sms = getSmsProvider();
    if (sms) {
      try {
        await sms.send(phone, text);
        result.sms = true;
      } catch (e) {
        console.warn('[notify] sms failed:', (e as Error)?.message);
      }
    }
  }

  // 4) Email — best-effort. Requires a configured provider + recipient email.
  const email = user?.email || '';
  if (email && settings.emailEnabled) {
    const mailer = getEmailProvider();
    if (mailer) {
      try {
        await mailer.send(email, input.title, input.message);
        result.email = true;
      } catch (e) {
        console.warn('[notify] email failed:', (e as Error)?.message);
      }
    }
  }

  return result;
}

/**
 * Batched fan-out for N recipients (cron/activation paths). Creates all in-app
 * notifications in one query and resolves clinic/user/channel config with a
 * handful of queries instead of 3N+1. External channel sends still happen per
 * recipient but only when the clinic has them configured.
 */
export async function dispatchNotifications(inputs: DispatchInput[]): Promise<DispatchResult> {
  const result: DispatchResult = { inApp: false, whatsapp: false, sms: false, email: false };
  if (inputs.length === 0) return result;

  // 1) In-app — always, batched, and it is the source of truth.
  try {
    await prisma.notification.createMany({
      data: inputs.map((i) => ({
        id: uid(),
        userId: i.userId,
        type: i.type,
        title: i.title,
        message: i.message,
        link: i.link || null,
      })),
    });
    result.inApp = true;
  } catch (e) {
    console.error('[notify] in-app createMany failed', e);
  }

  const clinicIds = Array.from(new Set(inputs.map((i) => i.clinicId).filter(Boolean))) as string[];
  if (clinicIds.length === 0) return result;

  const userIds = Array.from(new Set(inputs.map((i) => i.userId)));

  const [clinics, users, configs] = await Promise.all([
    prisma.clinic
      .findMany({ where: { id: { in: clinicIds } }, select: { id: true, settings: true } })
      .catch((): Array<{ id: string; settings: unknown }> => []),
    prisma.user
      .findMany({ where: { id: { in: userIds } }, select: { id: true, phone: true, email: true } })
      .catch((): Array<{ id: string; phone: string | null; email: string | null }> => []),
    prisma.clinicMessengerConfig
      .findMany({
        where: { clinicId: { in: clinicIds }, channel: 'WHATSAPP' as never, isActive: true },
        select: { clinicId: true, accessToken: true, phoneNumberId: true },
      })
      .catch((): Array<{ clinicId: string; accessToken: string | null; phoneNumberId: string | null }> => []),
  ]);

  const settingsByClinic = new Map(
    clinics.map(
      (c): [string, Record<string, unknown>] => [
        c.id,
        (c.settings && typeof c.settings === 'object' ? c.settings : {}) as Record<string, unknown>,
      ],
    ),
  );
  const phoneByUser = new Map(
    users.map((u): [string, string] => [u.id, String(u.phone || '').replace(/[^\d]/g, '')]),
  );
  const emailByUser = new Map(
    users.map((u): [string, string] => [u.id, u.email || '']),
  );
  const configByClinic = new Map(
    configs.map(
      (cfg): [string, { accessToken: string | null; phoneNumberId: string | null }] => [
        cfg.clinicId,
        cfg,
      ],
    ),
  );

  for (const input of inputs) {
    if (!input.clinicId) continue;
    const settings = settingsByClinic.get(input.clinicId) || {};
    const phone = phoneByUser.get(input.userId) || '';
    const text = composeText(input);

    // 2) WhatsApp — best-effort. Requires active WHATSAPP config + phone.
    if (phone && settings.whatsappEnabled !== false) {
      const cfg = configByClinic.get(input.clinicId);
      if (cfg?.accessToken && cfg.phoneNumberId) {
        try {
          await sendMessage({
            channel: 'WHATSAPP' as Channel,
            externalUserId: phone,
            text,
            accessToken: cfg.accessToken,
            phoneNumberId: cfg.phoneNumberId,
          });
          result.whatsapp = true;
        } catch (e) {
          console.warn('[notify] whatsapp skipped/failed:', (e as Error)?.message);
        }
      }
    }

    // 3) SMS — best-effort. Requires a configured provider + phone.
    if (phone && settings.smsEnabled) {
      const sms = getSmsProvider();
      if (sms) {
        try {
          await sms.send(phone, text);
          result.sms = true;
        } catch (e) {
          console.warn('[notify] sms failed:', (e as Error)?.message);
        }
      }
    }

    // 4) Email — best-effort. Requires a configured provider + recipient email.
    const email = emailByUser.get(input.userId) || '';
    if (email && settings.emailEnabled) {
      const mailer = getEmailProvider();
      if (mailer) {
        try {
          await mailer.send(email, input.title, input.message);
          result.email = true;
        } catch (e) {
          console.warn('[notify] email failed:', (e as Error)?.message);
        }
      }
    }
  }

  return result;
}
