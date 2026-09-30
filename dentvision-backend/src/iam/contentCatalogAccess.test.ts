import { describe, expect, it } from 'vitest';
import { resolveActiveContentContext } from './contentCatalogAccess.js';

describe('catalog audience resolution', () => {
  it('never trusts anonymous query/header context', () => {
    const req = {
      query: { context: 'DOCTOR' },
      get: (name: string) => name.toLowerCase() === 'x-dentvision-context' ? 'DOCTOR' : undefined,
    } as any;
    expect(resolveActiveContentContext(req)).toBe('PUBLIC');
  });

  it('derives partner audience from authenticated organization context', () => {
    const req = {
      query: { context: 'PATIENT' },
      get: () => 'PATIENT',
      user: { role: 'OWNER', organizationType: 'DIAGNOSTIC_CENTER' },
    } as any;
    expect(resolveActiveContentContext(req)).toBe('DIAGNOSTIC');
  });

  it('uses authenticated role for clinic professional catalog access', () => {
    const req = {
      query: { context: 'PATIENT' },
      get: () => 'PATIENT',
      user: { role: 'DOCTOR', organizationType: 'CLINIC' },
    } as any;
    expect(resolveActiveContentContext(req)).toBe('DOCTOR');
  });
});
