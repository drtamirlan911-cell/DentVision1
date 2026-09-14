import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const migration = new URL('./migration.sql', import.meta.url);

describe('finance branch consistency migration', () => {
  it('covers both clinic finance tables', async () => {
    const source = await readFile(migration, 'utf8');
    expect(source).toContain('ON invoices');
    expect(source).toContain('ON expenses');
  });

  it('never accepts an active branch from another clinic', async () => {
    const source = await readFile(migration, 'utf8');
    expect(source).toContain("RAISE EXCEPTION 'finance record branch does not belong to clinic'");
    expect(source).toContain('AND b.active = true');
    expect(source).toContain('branch_clinic_id <> NEW.clinic_id');
  });

  it('does not invent a branch for platform-only finance rows', async () => {
    const source = await readFile(migration, 'utf8');
    expect(source).toContain('WHERE b.clinic_id = NEW.clinic_id');
    expect(source).toContain('IF NEW.branch_id IS NULL THEN');
  });
});
