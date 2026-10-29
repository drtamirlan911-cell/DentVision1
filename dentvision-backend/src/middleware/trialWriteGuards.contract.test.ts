import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFile(resolve(process.cwd(), path), 'utf8');

describe('trial read-only route coverage', () => {
  it('gates CRM operational mutations while leaving GETs readable', async () => {
    const text = await source('dentvision-backend/src/modules/crm/ops.routes.ts');
    expect(text).toContain('crmOpsRouter.use(loadClinicAccess)');
    expect(text).toContain('crmOpsRouter.use(blockClinicWrites)');
    expect(text).toContain("crmOpsRouter.post('/waiting-list'");
    expect(text).toContain("crmOpsRouter.delete('/expenses/:id'");
  });

  it('gates authenticated reminder mutations but preserves the secret-only cron endpoint', async () => {
    const text = await source('dentvision-backend/src/modules/crm/reminders.routes.ts');
    expect(text).toContain("remindersRouter.post('/waitlist', authenticate, loadClinicAccess, blockClinicWrites");
    expect(text).toContain("remindersRouter.post('/reminders/run', authenticate, loadClinicAccess, blockClinicWrites");
    const cronLine = text.split('\n').find(line => line.includes("remindersRouter.post('/reminders/cron'"));
    expect(cronLine).toBeTruthy();
    expect(cronLine).not.toContain('blockClinicWrites');
  });

  it('gates all treatment-case mutations as well as preserving read-only GETs', async () => {
    const text = await source('dentvision-backend/src/modules/crm/treatmentCase.routes.ts');
    expect(text).toContain("treatmentCaseRouter.post('/', loadClinicAccess, blockClinicWrites");
    expect(text).toContain("treatmentCaseRouter.patch('/:id', loadClinicAccess, blockClinicWrites");
    expect(text).toContain("treatmentCaseRouter.delete('/:id', loadClinicAccess, blockClinicWrites");
  });

  it('does not lazily create clinic chairs on GET after the trial expires', async () => {
    const text = await source('dentvision-backend/src/modules/crm/chairs.routes.ts');
    expect(text).toContain('if (req.clinicAccess?.writeBlocked !== true) await ensureDefaultChairs(clinicId);');
  });

  it('checks clinic subscription before a patient can cancel an appointment', async () => {
    const text = await source('dentvision-backend/src/modules/patient-portal/patientPortal.routes.ts');
    const start = text.indexOf("patientPortalRouter.post('/appointments/:id/cancel'");
    const route = text.slice(start, text.indexOf('\n', start));
    expect(route.indexOf('ensureClinicWritableForPatient')).toBeGreaterThan(-1);
    expect(route.indexOf('ensureClinicWritableForPatient')).toBeLessThan(route.indexOf('portalSvc.cancelAppointment'));
  });
});
