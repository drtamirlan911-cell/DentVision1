import { describe, expect, it } from 'vitest';
import { pagesForCaller, permissionsForRole } from './permissions.js';

describe('community page permissions', () => {
  it.each([
    ['OWNER', true],
    ['ADMIN', true],
    ['DOCTOR', true],
    ['ASSISTANT', true],
    ['MANAGER', false],
    ['LAB', false],
    ['STUDENT', false],
    ['PATIENT', false],
  ] as const)('%s resolves community page access to %s', (role, expected) => {
    const pages = pagesForCaller(permissionsForRole(role), role);
    expect(pages.includes('community')).toBe(expected);
  });
});
