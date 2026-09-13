import { describe, expect, it } from 'vitest';
import { canAccessContent, getAllowedAudiences } from './contentAccessPolicy.js';

describe('context-bound content access', () => {
  it('allows patients to see general and patient Academy content', () => {
    expect(canAccessContent({ surface: 'ACADEMY', activeContext: 'PATIENT', audiences: ['PATIENT'] })).toBe(true);
    expect(canAccessContent({ surface: 'ACADEMY', activeContext: 'PATIENT', audiences: ['GENERAL'] })).toBe(true);
  });

  it('blocks professional Academy content in patient context', () => {
    expect(canAccessContent({ surface: 'ACADEMY', activeContext: 'PATIENT', audiences: ['PROFESSIONAL'] })).toBe(false);
    expect(canAccessContent({ surface: 'ACADEMY', activeContext: 'PATIENT', audiences: ['DOCTOR'] })).toBe(false);
    expect(canAccessContent({ surface: 'ACADEMY', activeContext: 'PATIENT', audiences: ['PROFESSIONAL', 'PATIENT'] })).toBe(true);
  });

  it('does not inherit doctor access when the same Person is in patient context', () => {
    expect(getAllowedAudiences('PATIENT')).not.toContain('PROFESSIONAL');
    expect(getAllowedAudiences('PATIENT')).not.toContain('DOCTOR');
    expect(getAllowedAudiences('DOCTOR')).toContain('PROFESSIONAL');
  });

  it('applies the same audience boundary to Marketplace products', () => {
    expect(canAccessContent({ surface: 'MARKETPLACE', activeContext: 'PATIENT', audiences: ['PATIENT'] })).toBe(true);
    expect(canAccessContent({ surface: 'MARKETPLACE', activeContext: 'PATIENT', audiences: ['PROFESSIONAL'] })).toBe(false);
    expect(canAccessContent({ surface: 'MARKETPLACE', activeContext: 'DOCTOR', audiences: ['PROFESSIONAL'] })).toBe(true);
  });
});
