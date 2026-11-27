import { describe, expect, it } from 'vitest';
import { resolveLaboratoryWorkspaceKind } from './laboratoryWorkspace';

describe('resolveLaboratoryWorkspaceKind', () => {
  it('uses the scoped medical-lab role instead of the legacy OWNER JWT role', () => {
    expect(resolveLaboratoryWorkspaceKind({
      roleKey: 'medical_lab_owner',
      effectiveRole: 'owner',
      organizationType: 'LABORATORY',
    })).toBe('medical');
  });

  it('keeps a dental-lab owner in the dental production workspace', () => {
    expect(resolveLaboratoryWorkspaceKind({
      roleKey: 'dental_lab_owner',
      effectiveRole: 'owner',
      organizationType: 'LABORATORY',
    })).toBe('dental');
  });

  it('keeps legacy dental-lab staff in dental production despite a mixed fallback role list', () => {
    expect(resolveLaboratoryWorkspaceKind({
      roleKey: 'laboratory_technician,medical_lab_technician,dental_technician',
      organizationType: 'LABORATORY',
    })).toBe('dental');
  });

  it('accepts a role list and recognizes a medical-lab capability within it', () => {
    expect(resolveLaboratoryWorkspaceKind({
      roleKey: 'laboratory_manager,medical_lab_validator',
      organizationType: 'LABORATORY',
    })).toBe('medical');
  });

  it('preserves the legacy lab_diagnostic role as a medical-laboratory context', () => {
    expect(resolveLaboratoryWorkspaceKind({
      roleKey: 'lab_diagnostic',
      organizationType: 'LABORATORY',
    })).toBe('medical');
  });

  it('uses the route hint only when no scoped lab role is available', () => {
    expect(resolveLaboratoryWorkspaceKind({
      workspaceParam: 'medical-lab',
      effectiveRole: 'owner',
      organizationType: 'LABORATORY',
    })).toBe('medical');
  });

  it('does not classify unrelated organizations as a laboratory cabinet', () => {
    expect(resolveLaboratoryWorkspaceKind({
      roleKey: 'employer_owner',
      organizationType: 'EMPLOYER',
    })).toBe('generic');
  });
});
