import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The Clinical AI / Patient AI boundary, enforced by reading the source rather
 * than by convention.
 *
 * `TreatmentPlan.items` is a mutable JSON blob with three writers, one of them
 * an LLM agent. So "the doctor approves, then the patient sees it" cannot be a
 * status on that row — it has to be a separate table that exactly one function
 * writes. These tests fail the moment someone shortcuts that, which is the only
 * kind of guarantee worth having here.
 *
 * The repo already asserts invariants this way: patientTools.test.ts checks
 * FORBIDDEN_PARAM_NAMES against the declared tool schemas the same way.
 */

const BACKEND_SRC = resolve(__dirname, '../..');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...sourceFiles(path));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      out.push(path);
    }
  }
  return out;
}

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function rel(path: string): string {
  return path.slice(BACKEND_SRC.length + 1);
}

describe('the patient side never reads TreatmentPlan directly', () => {
  // Everything a logged-in patient can reach. A read of `TreatmentPlan` from
  // here would show a document that changes under them mid-read, and that an
  // agent can write to.
  const PATIENT_FACING_DIRS = ['modules/patient-portal', 'modules/ai-patient'];

  for (const dirname of PATIENT_FACING_DIRS) {
    it(`${dirname} does not query prisma.treatmentPlan`, () => {
      const files = sourceFiles(resolve(BACKEND_SRC, dirname));
      expect(files.length).toBeGreaterThan(0);

      const offenders = files
        .filter((file) => /\btreatmentPlan\s*\.\s*(findMany|findFirst|findUnique|create|update|updateMany|upsert|delete|deleteMany|count)/.test(read(file)))
        .map(rel);

      expect(offenders).toEqual([]);
    });
  }

  it('the portal service reads releases instead', () => {
    const service = read(resolve(BACKEND_SRC, 'modules/patient-portal/patientPortal.service.ts'));
    expect(service).toContain('listPublishedReleases');
  });
});

describe('only the clinic side can approve or publish', () => {
  // An agent has no user to offer, and `approveAndRelease` requires one. This
  // test closes the other half: no AI module may even reach the function.
  const AI_DIRS = ['modules/ai', 'modules/ai-admin', 'modules/ai-patient'];

  for (const dirname of AI_DIRS) {
    it(`${dirname} does not import planRelease.service`, () => {
      const files = sourceFiles(resolve(BACKEND_SRC, dirname));
      expect(files.length).toBeGreaterThan(0);

      const offenders = files
        .filter((file) => /planRelease\.service/.test(read(file)))
        .map(rel);

      expect(offenders).toEqual([]);
    });
  }

  it('approval is gated on medical.manage, not patient.write', () => {
    const routes = read(resolve(BACKEND_SRC, 'modules/crm/crm.routes.ts'));
    // Authoring a plan and certifying it clinically are different rights.
    expect(routes).toMatch(/treatment-plans\/:id\/approve'[\s\S]{0,80}requirePermission\('medical\.manage'\)/);
    expect(routes).toMatch(/plan-releases\/:releaseId\/publish'[\s\S]{0,80}requirePermission\('medical\.manage'\)/);
    expect(routes).toMatch(/plan-releases\/:releaseId\/withdraw'[\s\S]{0,80}requirePermission\('medical\.manage'\)/);
  });
});

describe('medical.manage is held by clinicians only', () => {
  it('OWNER and DOCTOR have it; ADMIN does not', async () => {
    const { ROLE_PERMISSIONS } = await import('../../lib/permissions.js');
    expect(ROLE_PERMISSIONS.OWNER).toContain('medical.manage');
    expect(ROLE_PERMISSIONS.DOCTOR).toContain('medical.manage');
    // The separation is the point of the layer: an administrator may author and
    // edit a plan, but must not be the one who certifies it clinically.
    expect(ROLE_PERMISSIONS.ADMIN).not.toContain('medical.manage');
    expect(ROLE_PERMISSIONS.ASSISTANT).not.toContain('medical.manage');
    expect(ROLE_PERMISSIONS.STUDENT).not.toContain('medical.manage');
  });
});
