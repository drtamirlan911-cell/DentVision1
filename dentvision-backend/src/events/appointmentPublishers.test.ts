import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MODULES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'modules');

/**
 * Files that create an appointment on purpose without announcing it.
 *
 * `auth.routes.ts` seeds two demo appointments into a brand-new clinic at
 * registration so the schedule is not empty on first login. They are sample
 * data, created inside a `$transaction([...])` array that never captures the
 * generated ids — there is no real actor, no real patient relationship, and
 * nothing downstream should react as if a clinic booked someone.
 */
const DELIBERATELY_SILENT = new Set(['auth/auth.routes.ts']);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

/**
 * Regression guard for event coverage.
 *
 * Audit, workflow triggers and developer webhooks all subscribe to
 * `appointment.created`, and so does the patient-assignment subscriber that
 * decides which doctor the AI considers responsible for a patient. Before this
 * guard existed, exactly one of the five write paths published the event — the
 * schedule screen — so an appointment booked by the AI, by the online booking
 * funnel or by the ai-admin webhook was invisible to all four subscribers.
 *
 * A text scan rather than a runtime check: the failure mode is a new call site
 * that simply forgets, which no type system can catch.
 */
describe('every appointment write path announces itself', () => {
  const offenders = walk(MODULES_DIR)
    .map((file) => ({ file, source: readFileSync(file, 'utf8') }))
    .filter(({ source }) => /prisma\.appointment\.create\(/.test(source))
    .filter(({ source }) => !/publish\(\s*'appointment\.created'/.test(source))
    .map(({ file }) => relative(MODULES_DIR, file).split('\\').join('/'))
    .filter((rel) => !DELIBERATELY_SILENT.has(rel));

  it('leaves no appointment created without publishing appointment.created', () => {
    expect(offenders).toEqual([]);
  });

  it('covers the paths that were silent before: booking, AI tool, ai-admin, legacy agent', () => {
    const publishers = walk(MODULES_DIR)
      .filter((file) => /publish\(\s*'appointment\.created'/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(MODULES_DIR, file).split('\\').join('/'));

    expect(publishers).toEqual(
      expect.arrayContaining([
        'appointments/appointments.routes.ts',
        'crm/ops.routes.ts',
        'ai/os/tools.ts',
        'ai/agents/admin.agent.ts',
        'ai-admin/llm/tools/book_appointment.tool.ts',
      ]),
    );
  });
});
