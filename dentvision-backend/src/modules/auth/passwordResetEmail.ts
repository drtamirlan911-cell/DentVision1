/**
 * The password-reset letter.
 *
 * Kept as a pure builder so the copy and the link shape can be asserted without
 * a mail account: the one thing that must never regress is that the token
 * travels in the link and nowhere else.
 */

import { env } from '../../config.js';

/** Where the reset form lives. Falls back to the CORS origin, which is the app. */
export function resetBaseUrl(): string {
  return (env.FRONTEND_URL || env.CORS_ORIGIN || '').replace(/\/+$/, '');
}

export function resetLink(token: string): string {
  return `${resetBaseUrl()}/forgot-password?token=${encodeURIComponent(token)}`;
}

export function buildPasswordResetEmail(input: { token: string; firstName?: string | null }) {
  const link = resetLink(input.token);
  const greeting = input.firstName ? `Здравствуйте, ${input.firstName}!` : 'Здравствуйте!';

  // Inline styles and a table-free layout on purpose: mail clients strip
  // stylesheets, and the app's design tokens do not exist in an inbox.
  const html = `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#14181F">
  <h1 style="font-size:20px;font-weight:700;margin:0 0 16px">Сброс пароля DentVision</h1>
  <p style="font-size:15px;line-height:1.6;margin:0 0 16px">${greeting}</p>
  <p style="font-size:15px;line-height:1.6;margin:0 0 24px">
    Мы получили запрос на сброс пароля. Нажмите кнопку ниже, чтобы задать новый.
    Ссылка действует один час.
  </p>
  <p style="margin:0 0 24px">
    <a href="${link}" style="display:inline-block;background:#785C26;color:#FFFFFF;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600">Задать новый пароль</a>
  </p>
  <p style="font-size:13px;line-height:1.6;color:#6B7079;margin:0 0 8px">
    Если кнопка не открывается, скопируйте ссылку:
  </p>
  <p style="font-size:13px;line-height:1.6;color:#6B7079;word-break:break-all;margin:0 0 24px">${link}</p>
  <p style="font-size:13px;line-height:1.6;color:#6B7079;margin:0">
    Если вы не запрашивали сброс, просто проигнорируйте это письмо — пароль останется прежним.
  </p>
</div>`.trim();

  return {
    subject: 'Сброс пароля DentVision',
    html,
    text: [
      greeting,
      '',
      'Мы получили запрос на сброс пароля. Ссылка действует один час:',
      link,
      '',
      'Если вы не запрашивали сброс, проигнорируйте это письмо.',
    ].join('\n'),
  };
}
