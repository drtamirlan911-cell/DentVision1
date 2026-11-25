import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { safeErrorKind } from '../../lib/safeError.js';

const routePaths = [
  "dentvision-backend/src/modules/lab/labPlatform.routes.ts",
  "dentvision-backend/src/modules/diagnostics/diagnostics.routes.ts",
  "dentvision-backend/src/modules/lab/medicalLab.routes.ts",
  "dentvision-backend/src/modules/supplier-workspace/workspace.routes.ts",
  "dentvision-backend/src/modules/academy/academy.routes.ts",
  "dentvision-backend/src/modules/lab/lab.routes.ts",
  "dentvision-backend/src/modules/public/publicDiagnosticsBooking.routes.ts",
  "dentvision-backend/src/modules/community/community.routes.ts",
  "dentvision-backend/src/modules/jobs/jobs.routes.ts",
  "dentvision-backend/src/modules/ops/ops.suppliers.routes.ts",
  "dentvision-backend/src/modules/suppliers/suppliers.routes.ts",
  "dentvision-backend/src/modules/diagnostics/diagnostics.service.ts",
  "dentvision-backend/src/modules/school/academyContent.ts",
  "dentvision-backend/src/modules/payments/payments.routes.ts",
  "dentvision-backend/src/modules/finance/finance.routes.ts",
  "dentvision-backend/src/modules/finance/disputes.routes.ts",
  "dentvision-backend/src/modules/billing/clinicBilling.routes.ts",
  "dentvision-backend/src/modules/billing/clinicSubscription.service.ts"
];

const routeSources = routePaths.map((path) => ({
  path,
  source: readFileSync(resolve(process.cwd(), path), 'utf8'),
}));

describe('Partner, patient-facing and finance privacy logging', () => {
  it('classifies Error objects without serializing patient, financial or clinical details', () => {
    const result = safeErrorKind(new Error(
      'Patient Dana Example, phone +7 701 555 0101, diagnosis private pulpitis, payment token secret',
    ));
    expect(result).toBe('Error');
    expect(JSON.stringify(result)).not.toContain('Dana Example');
    expect(JSON.stringify(result)).not.toContain('+7 701 555 0101');
    expect(JSON.stringify(result)).not.toContain('private pulpitis');
    expect(JSON.stringify(result)).not.toContain('payment token secret');
  });

  it('classifies non-Error throws without serializing their value', () => {
    const result = safeErrorKind('Patient Dana Example +7 701 555 0101 payment token secret');
    expect(result).toBe('NonError');
    expect(JSON.stringify(result)).not.toContain('Dana Example');
    expect(JSON.stringify(result)).not.toContain('+7 701 555 0101');
    expect(JSON.stringify(result)).not.toContain('payment token secret');
  });

  it('never logs raw exception messages or objects from ecosystem and financial routes', () => {
    for (const { path, source } of routeSources) {
      const logLines = source.split(String.fromCharCode(10)).filter((line) =>
        line.includes('console.error(') || line.includes('console.warn('),
      );
      expect(logLines.length, path).toBeGreaterThan(0);
      expect(source, path).toContain("import { safeErrorKind } from '../../lib/safeError.js';");
      const unsafeExceptionLogs = logLines.filter((line) => {
        const rawArgument = /,\s*(?:error|err|e)(?:\?\.message)?(?:\);|\)\);|\s*as Error)/.test(line);
        return rawArgument && !line.includes('safeErrorKind(');
      });
      expect(unsafeExceptionLogs, path).toEqual([]);
    }
  });
});
