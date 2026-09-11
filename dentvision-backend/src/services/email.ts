/**
 * Transactional email.
 *
 * One configured transport is used for transactional messages. Missing mail
 * credentials are treated as a configuration failure by callers; a configured
 * transport that rejects a message throws so the HTTP layer cannot report a
 * false success.
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

import { env } from '../config.js';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export type EmailTransport = 'smtp' | 'resend' | 'sendgrid' | 'none';

export function emailTransport(): EmailTransport {
  if (env.SMTP_USER && env.SMTP_PASSWORD) return 'smtp';
  if (env.RESEND_API_KEY) return 'resend';
  if (env.SENDGRID_API_KEY) return 'sendgrid';
  return 'none';
}

function sender(): string {
  if (env.EMAIL_FROM) return env.EMAIL_FROM;
  if (env.SMTP_USER) return `DentVision <${env.SMTP_USER}>`;
  return 'DentVision <no-reply@dentvision.kz>';
}

let transporter: Transporter | null = null;

function smtpTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
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

export async function verifyEmailTransport(): Promise<{ ok: boolean; transport: EmailTransport; error?: string }> {
  const transport = emailTransport();
  if (transport === 'none') return { ok: false, transport, error: 'No email transport configured' };
  if (transport !== 'smtp') return { ok: true, transport };
  try {
    await smtpTransporter().verify();
    return { ok: true, transport };
  } catch (error) {
    return { ok: false, transport, error: (error as Error).message };
  }
}

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
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

async function sendViaSendgrid(msg: EmailMessage): Promise<void> {
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
  if (!res.ok) throw new Error(`SendGrid ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

/**
 * Sends a message and only resolves successfully after the provider accepts it.
 * Missing configuration and provider failures are explicit failures; callers
 * must not present a successful "email sent" state in either case.
 */
export async function sendEmail(msg: EmailMessage): Promise<{ sent: true; transport: Exclude<EmailTransport, 'none'> }> {
  if (!msg.to) throw new Error('Recipient email is empty');

  const transport = emailTransport();
  if (transport === 'none') throw new Error('No email transport configured');

  if (transport === 'smtp') await sendViaSmtp(msg);
  else if (transport === 'resend') await sendViaResend(msg);
  else await sendViaSendgrid(msg);

  return { sent: true, transport };
}
