import { describe, expect, it } from 'vitest';

import { canUseClinicWideAiShortcuts, formatWorkspaceContext, stripModelConfirmation } from './orchestrator.js';

describe('stripModelConfirmation', () => {
  it('removes a confirmation the model set itself', () => {
    const args = stripModelConfirmation({ patientId: 'p1', date: '2026-08-10', confirmed: true });

    expect(args).not.toHaveProperty('confirmed');
    expect(args).toEqual({ patientId: 'p1', date: '2026-08-10' });
  });

  it('removes it whatever the value, so no truthiness trick gets through', () => {
    for (const value of [true, 'true', 1, {}, []]) {
      expect(stripModelConfirmation({ confirmed: value })).toEqual({});
    }
  });

  it('leaves calls without the flag untouched', () => {
    const args = { patientId: 'p1' };
    expect(stripModelConfirmation(args)).toBe(args);
  });

  it('does not mutate the caller’s object', () => {
    const args = { patientId: 'p1', confirmed: true };
    stripModelConfirmation(args);
    expect(args.confirmed).toBe(true);
  });
});

describe('formatWorkspaceContext', () => {
  it('passes only the active workspace, verified branch and available workspace roles to Jarvis', () => {
    const context = formatWorkspaceContext({
      workspace: {
        name: 'Клиника А',
        scopeType: 'CLINIC',
        roleLabel: 'Руководитель',
        scopeId: 'clinic-a',
        organizationId: 'org-a',
      },
      branch: {
        id: 'branch-a',
        name: 'Филиал А',
        code: 'A',
        organizationId: 'org-a',
        clinicId: 'clinic-a',
      },
      availableWorkspaces: [
        { name: 'Клиника А', scopeType: 'CLINIC', roleLabel: 'Руководитель' },
        { name: 'Диагностика Б', scopeType: 'DIAGNOSTIC_CENTER', roleLabel: 'Рентгенолог' },
      ],
    });

    expect(context).toContain('Активное рабочее пространство: Клиника А');
    expect(context).toContain('Активный филиал: Филиал А · код: A');
    expect(context).toContain('Диагностика Б [DIAGNOSTIC_CENTER; Рентгенолог]');
  });

  it('never invents an active branch or workspace when IAM context is missing', () => {
    const context = formatWorkspaceContext({
      workspace: null,
      branch: null,
      availableWorkspaces: [],
    });

    expect(context).toContain('Активное рабочее пространство: не определено');
    expect(context).toContain('Активный филиал: не выбран или не подтверждён текущими правами');
    expect(context).toContain('Доступные рабочие пространства: —');
  });
});

describe('canUseClinicWideAiShortcuts', () => {
  it('allows organization-wide OWNER and ADMIN only when no branch is selected', () => {
    expect(canUseClinicWideAiShortcuts('OWNER')).toBe(true);
    expect(canUseClinicWideAiShortcuts('ADMIN', null, null)).toBe(true);
  });

  it('does not let branch roles or selected branch contexts use clinic-wide shortcuts', () => {
    expect(canUseClinicWideAiShortcuts('MANAGER')).toBe(false);
    expect(canUseClinicWideAiShortcuts('DOCTOR')).toBe(false);
    expect(canUseClinicWideAiShortcuts('OWNER', 'branch-1', null)).toBe(false);
    expect(canUseClinicWideAiShortcuts('ADMIN', null, 'branch-1')).toBe(false);
  });
});
