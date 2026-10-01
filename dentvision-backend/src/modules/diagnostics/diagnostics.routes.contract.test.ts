import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(process.cwd(), 'dentvision-backend/src/modules/diagnostics/diagnostics.routes.ts'),
  'utf8',
);

describe('diagnostics route contract', () => {
  it('has no shadowed duplicate HTTP method + path handlers', () => {
    const routes = [...source.matchAll(/diagnosticsRouter\.(get|post|patch|delete)\('([^']+)'/g)]
      .map((match) => `${match[1].toUpperCase()} ${match[2]}`);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it('keeps payment transition separate from referral status', () => {
    expect((source.match(/diagnosticsRouter\.post\('\/referrals\/:id\/mark-paid'/g) || [])).toHaveLength(1);
    expect(source).toContain("diagnosticsRouter.post('/referrals/:id/status'");
    expect(source).toContain("'REVIEWED','DELIVERED','CLOSED'");
    expect(source).not.toContain("status === 'PAID'");
  });

  it('keeps partner pricing and cashier handlers unique', () => {
    expect((source.match(/diagnosticsRouter\.patch\('\/centers\/:id\/pricing'/g) || [])).toHaveLength(1);
    expect((source.match(/diagnosticsRouter\.post\('\/centers\/:id\/pricing'/g) || [])).toHaveLength(1);
    expect((source.match(/diagnosticsRouter\.patch\('\/laboratories\/:id\/pricing'/g) || [])).toHaveLength(1);
    expect((source.match(/diagnosticsRouter\.post\('\/laboratories\/:id\/pricing'/g) || [])).toHaveLength(1);
    expect((source.match(/diagnosticsRouter\.post\('\/centers\/:id\/cashier\/collect'/g) || [])).toHaveLength(1);
    expect((source.match(/diagnosticsRouter\.post\('\/laboratories\/:id\/cashier\/collect'/g) || [])).toHaveLength(1);
  });
});
