import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every router imported into `app.ts` must also be mounted.
 *
 * This exists because five of them were not, and nothing noticed for months.
 *
 * `1d95e8ec` — "chore(release): подготовка к релизу v2.0.0" — set out to *add*
 * routes: its own message says "Fix backend app.ts missing route imports
 * (runtime crash on startup)" and "Register supplier/lecturer workspace
 * routes". In rewriting `app.ts` it dropped five `app.use` lines and left the
 * imports behind:
 *
 *     -app.use('/api/developer', developerRouter);
 *     -app.use('/api/v1', v1Router);
 *     -app.use('/api/partners', partnersRouter);
 *     -app.use('/api/workflows', workflowRouter);
 *     -app.use('/api/data', dataRouter);
 *
 * Four whole subsystems — the Developer Platform, Workflow Studio, Data
 * Intelligence and the Partner Program — plus the public API-key surface went
 * dark in a release, and 23 handlers became unreachable over HTTP. Nothing
 * failed: the imports kept the file compiling, the tests never asked, and the
 * modules kept passing their own unit tests in isolation.
 *
 * An unmounted router is the quietest possible regression. It has no stack
 * trace, no failing assertion and no error in a log — the endpoint simply 404s,
 * and only a user who knew the feature existed would ever report it.
 *
 * A source-reading test rather than a runtime one on purpose: mounting the real
 * app would need a database, and this has to hold in CI with nothing running.
 * The repository already uses this idiom — see `planReleaseBoundary.test.ts`
 * and `patientTools.test.ts`.
 */

const APP = readFileSync(resolve(__dirname, 'app.ts'), 'utf8');

/**
 * Router identifiers imported into `app.ts`, in either form.
 *
 * Both are in use: most routers are named exports, but `compatRouter` is a
 * default import. Matching only `{ ... }` reported it as mounted-without-import,
 * which is a claim about the parser rather than about the app.
 */
function importedRouters(source: string): string[] {
  const names = new Set<string>();

  // Named: import { aRouter, bRouter as cRouter } from '...'
  for (const match of source.matchAll(/import\s*(?:\w+\s*,\s*)?\{([^}]+)\}\s*from\s*'[^']+'/g)) {
    for (const raw of match[1].split(',')) {
      // `foo as bar` binds `bar`; the local name is what `app.use` would name.
      const local = raw.trim().split(/\s+as\s+/).pop()?.trim() ?? '';
      if (/Router$/.test(local)) names.add(local);
    }
  }

  // Default: import compatRouter from '...'
  for (const match of source.matchAll(/import\s+(\w+Router)\s*(?:,\s*\{[^}]*\})?\s*from\s*'[^']+'/g)) {
    names.add(match[1]);
  }

  return [...names].sort();
}

/** Router identifiers actually passed to `app.use(...)`. */
function mountedRouters(source: string): string[] {
  const names = new Set<string>();
  for (const match of source.matchAll(/app\.use\([^)]*?\b(\w+Router)\b/g)) {
    names.add(match[1]);
  }
  return [...names].sort();
}

describe('every router imported into app.ts is reachable over HTTP', () => {
  const imported = importedRouters(APP);
  const mounted = mountedRouters(APP);

  it('finds the routers at all, so the test cannot pass by reading nothing', () => {
    expect(imported.length).toBeGreaterThan(20);
    expect(mounted.length).toBeGreaterThan(20);
  });

  it('mounts every router it imports', () => {
    const unmounted = imported.filter((name) => !mounted.includes(name));
    expect(
      unmounted,
      `imported into app.ts but never passed to app.use — these endpoints 404 in production: ${unmounted.join(', ')}`,
    ).toEqual([]);
  });

  it('imports every router it mounts, which would otherwise not compile', () => {
    const unimported = mounted.filter((name) => !imported.includes(name));
    expect(unimported).toEqual([]);
  });
});
