import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('bounded Playwright failure digest', () => {
  it('groups retry duplicates and preserves the first useful assertion evidence', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dentvision-e2e-digest-'));
    tempDirs.push(dir);
    const log = join(dir, 'e2e-core.log');
    writeFileSync(log, [
      '  1) [e2e-core] › e2e/tests/example.spec.ts:10:3 › owner can create a branch',
      '',
      '    Error: expect(locator).toBeVisible() failed',
      '    Locator: getByText(\'E2E Branch 1792925278298\', { exact: true })',
      '    Expected: visible',
      '    Timeout: 15000ms',
      '',
      '    Retry #1 ─────────────────────────────────────────',
      '  1) [e2e-core] › e2e/tests/example.spec.ts:10:3 › owner can create a branch',
      '',
      '    Error: expect(locator).toBeVisible() failed',
      '    Locator: getByText(\'E2E Branch 1792925297517\', { exact: true })',
      '    Expected: visible',
      '    Timeout: 15000ms',
      '',
      '  1 failed',
    ].join('\n'));

    const script = resolve(process.cwd(), 'quality-scripts/summarize-e2e-failures.mjs');
    const output = execFileSync(process.execPath, [script, log], { encoding: 'utf8' });
    expect(output).toContain('unique failure signatures: 1');
    expect(output).toContain('Occurrences (including retries): 2');
    expect(output).toContain('UI/WAIT');
    expect(output).toContain('Expected: visible');
    expect(output.length).toBeLessThan(18000);
  });

  it('does not report a missing log as a successful test run', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dentvision-e2e-empty-'));
    tempDirs.push(dir);
    const script = resolve(process.cwd(), 'quality-scripts/summarize-e2e-failures.mjs');
    const output = execFileSync(process.execPath, [script, join(dir, 'missing.log')], { encoding: 'utf8' });
    expect(output).toContain('No Playwright failure blocks were recognized');
    expect(output).toContain('do not interpret this as a passing E2E run');
  });
});
