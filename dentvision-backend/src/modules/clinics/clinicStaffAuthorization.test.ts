import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { authorizeClinicStaffMutation } from './clinicStaffAuthorization.js';

describe('clinic staff owner governance', () => {
  it('does not allow an administrator to grant a new owner role', () => {
    expect(authorizeClinicStaffMutation({
      actorRole: 'ADMIN',
      nextMemberRole: 'OWNER',
    })).toEqual({ ok: false, status: 403, code: 'OWNER_REQUIRED' });
  });

  it('allows an existing owner or platform superadmin to grant owner role', () => {
    expect(authorizeClinicStaffMutation({
      actorRole: 'OWNER',
      nextMemberRole: 'OWNER',
    })).toEqual({ ok: true });
    expect(authorizeClinicStaffMutation({
      actorRole: 'ADMIN',
      nextMemberRole: 'OWNER',
      isSuperadmin: true,
    })).toEqual({ ok: true });
  });

  it('prevents administrators from editing an existing owner profile or password', () => {
    expect(authorizeClinicStaffMutation({
      actorRole: 'ADMIN',
      currentMemberRole: 'OWNER',
      nextMemberRole: 'OWNER',
    })).toEqual({ ok: false, status: 403, code: 'OWNER_REQUIRED' });
  });

  it('prevents demotion of the last owner, including by platform operations', () => {
    expect(authorizeClinicStaffMutation({
      actorRole: 'OWNER',
      currentMemberRole: 'OWNER',
      nextMemberRole: 'ADMIN',
      ownerCount: 1,
    })).toEqual({ ok: false, status: 409, code: 'LAST_OWNER' });
    expect(authorizeClinicStaffMutation({
      actorRole: 'SUPERADMIN',
      currentMemberRole: 'OWNER',
      nextMemberRole: 'ADMIN',
      ownerCount: 1,
      isSuperadmin: true,
    })).toEqual({ ok: false, status: 409, code: 'LAST_OWNER' });
  });

  it('allows an owner to transfer ownership only when another owner remains', () => {
    expect(authorizeClinicStaffMutation({
      actorRole: 'OWNER',
      currentMemberRole: 'OWNER',
      nextMemberRole: 'ADMIN',
      ownerCount: 2,
    })).toEqual({ ok: true });
  });

  it('allows administrators to manage non-owner staff', () => {
    expect(authorizeClinicStaffMutation({
      actorRole: 'ADMIN',
      currentMemberRole: 'DOCTOR',
      nextMemberRole: 'MANAGER',
    })).toEqual({ ok: true });
  });
});


describe('clinic staff route wiring', () => {
  it('checks owner authority before creating a clinic owner', async () => {
    const source = await readFile(resolve(process.cwd(), 'dentvision-backend/src/modules/clinics/clinics.routes.ts'), 'utf8');
    const start = source.indexOf("clinicsRouter.post('/:id/staff'");
    const end = source.indexOf("clinicsRouter.patch('/:id/staff/:userId'", start);
    const route = source.slice(start, end);
    const guard = route.indexOf('authorizeClinicStaffMutation');
    const create = route.indexOf('prisma.clinicMember.create');
    expect(guard).toBeGreaterThan(-1);
    expect(create).toBeGreaterThan(guard);
    expect(route).toContain('nextMemberRole: role');
  });

  it('checks owner authority before profile/password changes and protects the last owner', async () => {
    const source = await readFile(resolve(process.cwd(), 'dentvision-backend/src/modules/clinics/clinics.routes.ts'), 'utf8');
    const start = source.indexOf("clinicsRouter.patch('/:id/staff/:userId'");
    const end = source.indexOf("clinicsRouter.delete('/:id/staff/:userId'", start);
    const route = source.slice(start, end);
    const guard = route.indexOf('authorizeClinicStaffMutation');
    const userWrite = route.indexOf('prisma.user.update');
    expect(guard).toBeGreaterThan(-1);
    expect(userWrite).toBeGreaterThan(guard);
    expect(route).toContain("prisma.clinicMember.count({ where: { clinicId, role: 'OWNER' } })");
    expect(route).toContain('currentMemberRole: member.role');
    expect(route).toContain('nextMemberRole: nextRole');
  });
});
