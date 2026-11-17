import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

describe('clinic invitation route contract', () => {
  it('connects clinic invitation creation to persisted records and owner authorization', async () => {
    const [clinicRoutes, frontendApi] = await Promise.all([
      readFile(resolve(process.cwd(), 'dentvision-backend/src/modules/clinics/clinics.routes.ts'), 'utf8'),
      readFile(resolve(process.cwd(), 'src/utils/api.ts'), 'utf8'),
    ]);
    const start = clinicRoutes.indexOf("clinicsRouter.post('/:id/invite'");
    const end = clinicRoutes.indexOf("clinicsRouter.post('/:id/staff'", start);
    const route = clinicRoutes.slice(start, end);
    expect(route).toContain('createClinicInvitation');
    expect(route).toContain('authorizeClinicStaffMutation');
    expect(route).toContain('expiresInDays');
    expect(frontendApi).toContain('/api/clinics/${encodeURIComponent(data.clinicId)}/invite');
  });

  it('provides public lookup and authenticated, email-bound, one-time acceptance', async () => {
    const [authRoutes, frontendApi] = await Promise.all([
      readFile(resolve(process.cwd(), 'dentvision-backend/src/modules/auth/auth.routes.ts'), 'utf8'),
      readFile(resolve(process.cwd(), 'src/utils/api.ts'), 'utf8'),
    ]);
    expect(authRoutes).toContain("authRouter.get('/invitations/lookup'");
    expect(authRoutes).toContain("authRouter.post('/join-clinic', authenticate");
    expect(authRoutes).toContain('INVITATION_EMAIL_MISMATCH');
    expect(authRoutes).toContain('invitation.expiresAt <= now');
    expect(authRoutes).toContain('usedAt: null');
    expect(authRoutes).toContain('usedBy: req.user!.id');
    expect(authRoutes).toContain('syncPersonFromClinicMember');
    expect(frontendApi).toContain('/api/auth/invitations/lookup?code=');
    expect(frontendApi).toContain('/api/auth/join-clinic');
  });
});
