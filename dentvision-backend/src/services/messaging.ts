/**
 * Outbound SMS / WhatsApp messaging.
 * Uses Twilio when TWILIO_* env vars are set; otherwise dry-run (logs + succeeds)
 * so cron / ReminderLog work in demo and Render Free without credentials.
 */

import { env } from '../config.js';
import { normalizePhone } from '../modules/crm/reminderEligibility.js';

export type MessageChannel = 'sms' | 'whatsapp' | 'console';

export interface SendMessageResult {
  ok: boolean;
  channel: MessageChannel;
  sid?: string;
  error?: string;
  dryRun?: boolean;
}

function twilioConfigured(): boolean {
  return !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && (env.TWILIO_FROM_NUMBER || env.TWILIO_WHATSAPP_FROM));
}

function twilioSmsConfigured(): boolean {
  return !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER);
}

/** Standard SmsProvider interface — shared between messaging layer and notification dispatch. */
export interface SmsProvider {
  send(to: string, text: string): Promise<void>;
}

/**
 * Create an SMS provider backed by Twilio.
 * Returns null when Twilio SMS is not configured → dispatch skips SMS.
 */
export function createSmsProvider(): SmsProvider | null {
  if (!twilioSmsConfigured()) return null;
  return {
    async send(to, text) {
      const result = await sendSms(to, text);
      if (!result.ok) throw new Error(result.error || 'Twilio SMS failed');
    },
  };
}

export async function sendSms(toPhone: string, body: string): Promise<SendMessageResult> {
  const to = normalizePhone(toPhone);
  if (!to) return { ok: false, channel: 'sms', error: 'Нет телефона' };

  if (!twilioConfigured() || !env.TWILIO_FROM_NUMBER) {
    console.log(`[Messaging:dry-run:sms] → +${to}: ${body.slice(0, 120)}…`);
    return { ok: true, channel: 'console', dryRun: true };
  }

  try {
    const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
    const params = new URLSearchParams({
      To: `+${to}`,
      From: env.TWILIO_FROM_NUMBER,
      Body: body,
    });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      },
    );
    const json = (await res.json()) as { sid?: string; message?: string; error_message?: string };
    if (!res.ok) {
      return { ok: false, channel: 'sms', error: json.message || json.error_message || `Twilio ${res.status}` };
    }
    return { ok: true, channel: 'sms', sid: json.sid };
  } catch (err: any) {
    return { ok: false, channel: 'sms', error: err?.message || 'Twilio SMS failed' };
  }
}

export async function sendWhatsApp(toPhone: string, body: string): Promise<SendMessageResult> {
  const to = normalizePhone(toPhone);
  if (!to) return { ok: false, channel: 'whatsapp', error: 'Нет телефона' };

  const from = env.TWILIO_WHATSAPP_FROM || env.TWILIO_FROM_NUMBER;
  if (!twilioConfigured() || !from) {
    console.log(`[Messaging:dry-run:whatsapp] → +${to}: ${body.slice(0, 120)}…`);
    return { ok: true, channel: 'console', dryRun: true };
  }

  try {
    const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
    const fromWa = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;
    const params = new URLSearchParams({
      To: `whatsapp:+${to}`,
      From: fromWa,
      Body: body,
    });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      },
    );
    const json = (await res.json()) as { sid?: string; message?: string; error_message?: string };
    if (!res.ok) {
      return { ok: false, channel: 'whatsapp', error: json.message || json.error_message || `Twilio ${res.status}` };
    }
    return { ok: true, channel: 'whatsapp', sid: json.sid };
  } catch (err: any) {
    return { ok: false, channel: 'whatsapp', error: err?.message || 'Twilio WhatsApp failed' };
  }
}

/** Prefer WhatsApp; fall back to SMS. */
export async function sendReminderMessage(toPhone: string, body: string): Promise<SendMessageResult> {
  const wa = await sendWhatsApp(toPhone, body);
  if (wa.ok) return wa;
  return sendSms(toPhone, body);
}
