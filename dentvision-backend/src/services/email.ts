/**
 * Transactional email.
 *
 * There was no transport at all: `/forgot-password` created a reset token, told
 * the caller a letter had been sent, and sent nothing. A customer who forgot
 * their password was locked out until a superadmin reset it by hand.
 *
 * The product sends from a Google account over SMTP. The two HTTP providers
 * remain as alternatives for when a Gmail sending limit becomes the constraint.
 * Which one is used is decided by whichever credentials are present; with none,
 * `send` reports that nothing was sent and callers behave exactly as before.
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

import { env } from '../config.js';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  /** Plain-text alternative. Spam filters weight its absence. */
  text?: string;
}

export type EmailTransport = 'smtp' | 'resend' | 'sendgrid' | 'none';

/** Which transport the current environment can use. */
export function emailTransport(): EmailTransport {
  if (env.SMTP_USER && env.SMTP_PASSWORD) return 'smtp';
  if (env.RESEND_API_KEY) return 'resend';
  if (env.SENDGRID_API_KEY) return 'sendgrid';
  return 'none';
}

function sender(): string {
  if (env.EMAIL_FROM) return env.EMAIL_FROM;
  // Gmail rewrites the From header to the authenticated account anyway, so
  // defaulting to it keeps the header and the envelope in agreement.
  if (env.SMTP_USER) return `DentVision <${env.SMTP_USER}>`;
  return 'DentVision <no-reply@dentvision.kz>';
}

/**
 * One connection pool for the process.
 *
 * Gmail throttles connection churn harder than it throttles messages, so a new
 * transport per letter is the wrong shape even at low volume.
 */
let transporter: Transporter | null = null;

function smtpTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      // 465 is implicit TLS; 587 starts plaintext and upgrades.
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        // Google App Passwords are shown in groups of four; the spaces are
        // presentation only and Google rejects them if they are sent.
        pass: (env.SMTP_PASSWORD || '').replace(/\s+/g, ''),
      },
      pool: true,
      maxConnections: 2,
    });
  }
  return transporter;
}

async function sendViaSmtp(msg: EmailMessage): Promise<void> {
  await smtpTransporter().sendMail({
    from: sender(),
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text || htmlToText(msg.html),
  });
}

/** Prove the credentials before trusting them in production. */
export async function verifyEmailTransport(): Promise<{ ok: boolean; transport: EmailTransport; error?: string }> {
  const transport = emailTransport();
  if (transport !== 'smtp') return { ok: transport !== 'none', transport };
  try {
    await smtpTransporter().verify();
    return { ok: true, transport };
  } catch (error) {
    return { ok: false, transport, error: (error as Error).message };
  }
}

/** Strip tags for the plain-text part when a caller did not supply one. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function sendViaResend(msg: EmailMessage): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: sender(),
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
      text: msg.text || htmlToText(msg.html),
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

async function sendViaSendgrid(msg: EmailMessage): Promise<void> {
  // SendGrid wants the address bare, without the display name.
  const from = sender();
  const bare = from.match(/<([^>]+)>/)?.[1] || from;
  const name = from.includes('<') ? from.split('<')[0].trim() : undefined;

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: msg.to }] }],
      from: name ? { email: bare, name } : { email: bare },
      subject: msg.subject,
      content: [
        { type: 'text/plain', value: msg.text || htmlToText(msg.html) },
        { type: 'text/html', value: msg.html },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`SendGrid ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

/**
 * Send one message.
 *
 * Returns whether it went out rather than throwing on a missing transport: a
 * deployment with no mail account configured is a supported state, not an error.
 * A configured transport that *fails* does throw, so the caller can decide.
 */
export async function sendEmail(msg: EmailMessage): Promise<{ sent: boolean; transport: EmailTransport }> {
  const transport = emailTransport();
  if (transport === 'none') return { sent: false, transport };
  if (!msg.to) return { sent: false, transport };

  if (transport === 'smtp') await sendViaSmtp(msg);
  else if (transport === 'resend') await sendViaResend(msg);
  else await sendViaSendgrid(msg);

  return { sent: true, transport };
}
