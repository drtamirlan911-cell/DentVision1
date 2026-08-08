/**
 * Channel-aware notification dispatch.
 *
 * The in-app record is the source of truth and is always created. Additional
 * channels (WhatsApp, SMS) are best-effort: they only fire when the clinic has
 * enabled them AND the channel is actually configured AND the recipient identity
 * is known, and any channel failure is swallowed so it can never break the in-app
 * notification.
 */
import prisma from '../../lib/prisma.js';
import { uid } from '../../lib/helpers.js';
import { sendMessage } from '../ai-admin/sender/messenger.sender.js';
import type { Channel } from '../ai-admin/webhook/types.js';

/** Pluggable SMS gateway. No provider is configured yet → getSmsProvider returns null. */
export interface SmsProvider {
  send(to: string, text: string): Promise<void>;
}

function getSmsProvider(): SmsProvider | null {
  // Wire a real gateway here (env-gated) when one is available. Until then SMS is skipped.
  return null;
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
}

function composeText(input: DispatchInput): string {
  return `${input.title}\n\n${input.message}`.trim();
}

/**
 * Create the in-app notification and fan out to any enabled/configured channels.
 * Never throws — channel errors are logged and ignored.
 */
export async function dispatchNotification(input: DispatchInput): Promise<DispatchResult> {
  const result: DispatchResult = { inApp: false, whatsapp: false, sms: false };

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

  // Resolve clinic channel prefs + recipient phone (needed for WhatsApp/SMS).
  const [clinic, user] = await Promise.all([
    prisma.clinic.findUnique({ where: { id: input.clinicId }, select: { settings: true } }).catch(() => null),
    prisma.user.findUnique({ where: { id: input.userId }, select: { phone: true } }).catch(() => null),
  ]);
  const settings = (clinic?.settings && typeof clinic.settings === 'object'
    ? clinic.settings
    : {}) as Record<string, unknown>;
  const phone = user?.phone ? String(user.phone).replace(/[^\d]/g, '') : '';
  if (!phone) return result;
  const text = composeText(input);

  // 2) WhatsApp — best-effort. Requires an active WHATSAPP config for the clinic.
  if (settings.whatsappEnabled !== false) {
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

  // 3) SMS — best-effort via pluggable provider (none configured yet → skipped).
  if (settings.smsEnabled) {
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

  return result;
}
