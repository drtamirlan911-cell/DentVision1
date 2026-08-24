import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(HERE, 'tools.ts'), 'utf8');

/**
 * Regression guard for the by-id clinic-scope helper (`scopedId`). Every
 * tool that resolves "the record with this id" must scope that lookup to
 * the caller's clinic — composing `{ id: ..., clinicId }` inline at a new
 * call site is the exact ad-hoc pattern that let a future tool drop
 * `clinicId` silently (the row still resolves, just for the wrong tenant).
 * A text scan rather than a typed check because the risk is precisely at
 * the object-literal level, before any type system sees it.
 */
describe('tools.ts — by-id lookups stay routed through scopedId()', () => {
  it('never reintroduces an inline `{ id: ..., clinicId }` where-clause', () => {
    const inlinePattern = /where:\s*\{\s*id:\s*[^,}]+,\s*clinicId\s*\}/g;
    const matches = [...SOURCE.matchAll(inlinePattern)].map((m) => m[0]);
    expect(matches).toEqual([]);
  });

  it('has at least one real call site using scopedId(clinicId, ...)', () => {
    const calls = [...SOURCE.matchAll(/where:\s*scopedId\(clinicId,/g)];
    expect(calls.length).toBeGreaterThanOrEqual(8);
  });
});
