import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = resolve(
  process.cwd(),
  'dentvision-backend/prisma/migrations/20261123140000_legal_partner_multi_org/migration.sql',
);

describe('multi-organization legal partner migration', () => {
  const source = readFileSync(migration, 'utf8');

  it('removes the global one-legal-package-per-user constraint', () => {
    expect(source).toContain('DROP INDEX IF EXISTS "legal_partners_userId_key"');
  });

  it('retains an efficient user lookup without restoring uniqueness', () => {
    expect(source).toContain('CREATE INDEX IF NOT EXISTS "legal_partners_userId_idx"');
    expect(source).not.toContain('CREATE UNIQUE INDEX');
  });
});
