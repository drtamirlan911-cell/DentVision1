import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

const portalRoutes = read('dentvision-backend/src/modules/patient-portal/patientPortal.routes.ts');
const patientRoutes = read('dentvision-backend/src/modules/patients/patients.routes.ts');
const learningService = read('dentvision-backend/src/modules/ai/learning/learning.service.ts');
const aiService = read('dentvision-backend/src/modules/ai/core/ai.service.ts');

describe('PHI-safe internal error boundaries', () => {
  it('does not return raw exception messages from Portal HTTP 500 responses', () => {
    expect(portalRoutes).not.toMatch(/status\\(500\\)[\\s\\S]{0,160}?error:\\s*e\\.message/);
    expect(portalRoutes).toContain('Не удалось выполнить запрос. Попробуйте позже.');
    expect(portalRoutes).toContain('e instanceof portalSvc.PortalActionError');
  });

  it('does not log raw exceptions from Patient API operations', () => {
    expect(patientRoutes).not.toMatch(/console\\.(?:error|warn)\\([^;]*(?:,\\s*e\\)|,\\s*error\\))/);
    expect(patientRoutes).toContain('safeErrorKind');
  });

  it('does not log raw exceptions from AI Learning or AI core', () => {
    expect(learningService).not.toMatch(/console\\.(?:error|warn)\\([^;]*,\\s*e\\)/);
    expect(aiService).not.toMatch(/console\\.(?:error|warn)\\([^;]*,\\s*e\\)/);
    expect(learningService).toContain('safeErrorKind');
    expect(aiService).toContain('safeErrorKind');
  });
});
