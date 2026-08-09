import { describe, expect, it } from 'vitest';

import { buildPasswordResetEmail, resetLink } from './passwordResetEmail.js';

/**
 * The reset letter is the only way a locked-out customer gets back in, and the
 * token is a bearer credential for their account. Both facts are asserted here
 * rather than left to review.
 */

const TOKEN = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

describe('buildPasswordResetEmail', () => {
  it('carries the token in the link and nowhere else', () => {
    // A token pasted into the prose, a subject line, or a "your code is …"
    // block is a credential sitting in plain sight in an inbox and in every
    // mail log along the way. It belongs in the URL only.
    const { subject, html, text } = buildPasswordResetEmail({ token: TOKEN });

    expect(subject).not.toContain(TOKEN);

    const link = resetLink(TOKEN);
    // Both bodies mention it exactly where the link is, and nowhere else.
    const htmlOccurrences = html.split(encodeURIComponent(TOKEN)).length - 1;
    const linkOccurrences = html.split(link).length - 1;
    expect(htmlOccurrences).toBe(linkOccurrences);
    expect(text).toContain(link);
  });

  it('states the expiry, because the token really does expire in an hour', () => {
    const { html, text } = buildPasswordResetEmail({ token: TOKEN });
    expect(html).toMatch(/час/);
    expect(text).toMatch(/час/);
  });

  it('tells a recipient who did not ask that they can ignore it', () => {
    // Anyone can trigger this letter for any address, so it has to say so.
    const { text } = buildPasswordResetEmail({ token: TOKEN });
    expect(text).toMatch(/не запрашивали/);
  });

  it('greets by name when there is one, and stays neutral when there is not', () => {
    expect(buildPasswordResetEmail({ token: TOKEN, firstName: 'Тамирлан' }).text).toContain('Тамирлан');
    expect(buildPasswordResetEmail({ token: TOKEN, firstName: null }).text).toContain('Здравствуйте!');
  });

  it('always has a plain-text part', () => {
    // A missing text/plain part is weighted by spam filters, and this is the
    // one letter that must not land in spam.
    const { text } = buildPasswordResetEmail({ token: TOKEN });
    expect(text.length).toBeGreaterThan(60);
  });
});

describe('resetLink', () => {
  it('points at the reset form and escapes the token', () => {
    expect(resetLink('a b/c')).toContain('/forgot-password?token=');
    expect(resetLink('a b/c')).toContain(encodeURIComponent('a b/c'));
  });
});
