import { describe, expect, it } from 'vitest';

import { buildWorkspaceContexts, roleLabelFor, userRoleForPartnerRole, type ContextSources } from './contexts.js';

const empty: ContextSources = { memberships: [], supplierMemberships: [], lecturer: null, diagnosticCenterMemberships: [], laboratoryMemberships: [], persons: [] };

describe('workspace contexts', () => {
  it('returns one row for a clinic that exists in both halves', () => {
    // The #174/#175 backfill mirrors every ClinicMember into a Person, so this
    // is the ordinary case, not an edge one — and it used to produce two rows.
    const contexts = buildWorkspaceContexts({
      ...empty,
      memberships: [
        { id: 'cm1', role: 'OWNER', clinicId: 'clinic-1', clinic: { id: 'clinic-1', name: 'Улыбка' } },
      ],
      persons: [
        {
          id: 'p1',
          personType: 'STAFF',
          organization: { id: 'org-uuid-1', name: 'Улыбка', type: 'CLINIC', originalId: 'clinic-1' },
          personRoles: [{ role: { key: 'owner' } }],
        },
      ],
    });

    expect(contexts).toHaveLength(1);
    expect(contexts[0].scopeId).toBe('clinic-1');
    expect(contexts[0].organizationId).toBe('org-uuid-1');
  });

  it('keys a clinic by its own id, never by Organization.id', () => {
    // `Organization.id` is a fresh uuid; the clinic's id lives in originalId.
    // Handing the former to a clinic-scoped call resolves to nothing.
    const contexts = buildWorkspaceContexts({
      ...empty,
      persons: [
        {
          id: 'p1',
          personType: 'STAFF',
          organization: { id: 'org-uuid-1', name: 'Улыбка', type: 'CLINIC', originalId: 'clinic-1' },
          personRoles: [{ role: { key: 'doctor' } }],
        },
      ],
    });

    expect(contexts[0].scopeId).toBe('clinic-1');
    expect(contexts[0].scopeId).not.toBe('org-uuid-1');
  });

  it('speaks one vocabulary: a supplier organisation is SUPPLIER, not SUPPLIER_COMPANY', () => {
    // Every consumer filters on the legacy name, so a unified-only supplier was
    // invisible to all of them.
    const contexts = buildWorkspaceContexts({
      ...empty,
      persons: [
        {
          id: 'p1',
          personType: 'SUPPLIER_REP',
          organization: { id: 'org-2', name: 'МедТорг', type: 'SUPPLIER_COMPANY', originalId: 'sup-1' },
          personRoles: [{ role: { key: 'seller' } }],
        },
      ],
    });

    expect(contexts[0].scopeType).toBe('SUPPLIER');
    expect(contexts[0].scopeId).toBe('sup-1');
  });

  it('merges a supplier reached from both halves', () => {
    const contexts = buildWorkspaceContexts({
      ...empty,
      supplierMemberships: [
        { id: 'sm1', role: 'seller', supplierId: 'sup-1', supplier: { id: 'sup-1', name: 'МедТорг' } },
      ],
      persons: [
        {
          id: 'p1',
          personType: 'SUPPLIER_REP',
          organization: { id: 'org-2', name: 'МедТорг', type: 'SUPPLIER_COMPANY', originalId: 'sup-1' },
          personRoles: [{ role: { key: 'seller' } }],
        },
      ],
    });

    expect(contexts).toHaveLength(1);
    expect(contexts[0].organizationId).toBe('org-2');
    expect(contexts[0].role).toBe('seller');
  });

  it('files a lecturer under LECTURER even though the Person hangs off the academy', () => {
    // Going by organisation type alone would file this as ACADEMY and leave it
    // beside the legacy LECTURER row as a second copy of one membership.
    const contexts = buildWorkspaceContexts({
      ...empty,
      lecturer: { id: 'lec-1', level: 'SENIOR', academy: { id: 'ac-1', name: 'DentAcademy' } },
      persons: [
        {
          id: 'p1',
          personType: 'LECTURER',
          originalId: 'lec-1',
          organization: { id: 'org-3', name: 'DentAcademy', type: 'ACADEMY', originalId: 'ac-1' },
          personRoles: [{ role: { key: 'lecturer' } }],
        },
      ],
    });

    expect(contexts).toHaveLength(1);
    expect(contexts[0].scopeType).toBe('LECTURER');
    expect(contexts[0].scopeId).toBe('lec-1');
  });


  it('includes a legacy laboratory membership as a laboratory workspace', () => {
    const contexts = buildWorkspaceContexts({
      ...empty,
      laboratoryMemberships: [
        { id: 'lm1', role: 'manager', labId: 'lab-1', lab: { id: 'lab-1', name: 'Dental Lab' } },
      ],
    });

    expect(contexts).toHaveLength(1);
    expect(contexts[0].scopeType).toBe('LABORATORY');
    expect(contexts[0].scopeId).toBe('lab-1');
    expect(contexts[0].roleLabel).toBe('Управляющий');
  });


  it('includes every legacy diagnostic-center role as a workspace', () => {
    const roles = ['owner', 'admin', 'manager', 'radiologist', 'operator'];
    const contexts = buildWorkspaceContexts({
      ...empty,
      diagnosticCenterMemberships: roles.map((role, index) => ({
        id: 'dm-' + index,
        role,
        centerId: 'center-' + index,
        center: { id: 'center-' + index, name: 'Center ' + index },
      })),
    });
    expect(contexts.map((c) => c.roleLabel)).toEqual([
      'Владелец',
      'Администратор',
      'Управляющий',
      'Рентгенолог',
      'Оператор',
    ]);
  });

  it('labels all partner roles without falling back to Участник', () => {
    const roles = [
      'diagnostic_owner', 'diagnostic_admin', 'diagnostic_manager', 'diagnostic_operator',
      'diagnostic_reception', 'diagnostic_finance', 'diagnostic_quality',
      'medical_lab_owner', 'medical_lab_admin', 'medical_lab_manager', 'medical_lab_reception',
      'medical_lab_technician', 'medical_lab_validator', 'medical_lab_doctor', 'medical_lab_finance',
      'medical_lab_quality', 'dental_lab_owner', 'dental_lab_admin', 'dental_lab_manager',
      'lab_coordinator', 'dental_technician', 'cad_designer', 'ceramist', 'orthodontic_technician',
      'qc_specialist', 'lab_finance',
    ];
    for (const role of roles) expect(roleLabelFor(role)).not.toBe('Участник');
  });

  it('keeps distinct workspaces distinct', () => {
    const contexts = buildWorkspaceContexts({
      ...empty,
      memberships: [
        { id: 'cm1', role: 'OWNER', clinicId: 'clinic-1', clinic: { id: 'clinic-1', name: 'Улыбка' } },
        { id: 'cm2', role: 'DOCTOR', clinicId: 'clinic-2', clinic: { id: 'clinic-2', name: 'Дента' } },
      ],
    });

    expect(contexts.map((c) => c.scopeId)).toEqual(['clinic-1', 'clinic-2']);
  });

  it('drops a Person with no organisation rather than inventing a workspace', () => {
    const contexts = buildWorkspaceContexts({
      ...empty,
      persons: [{ id: 'p1', personType: 'PLATFORM_ADMIN', organization: null, personRoles: [] }],
    });

    expect(contexts).toEqual([]);
  });

  it('never returns a raw enum or a dotted key as the role label', () => {
    const contexts = buildWorkspaceContexts({
      ...empty,
      memberships: [
        { id: 'cm1', role: 'OWNER', clinicId: 'clinic-1', clinic: { id: 'clinic-1', name: 'Улыбка' } },
      ],
    });

    expect(contexts[0].roleLabel).toBe('Владелец');
    expect(contexts[0].roleLabel).not.toMatch(/^[A-Z_]+$/);
  });
});

describe('userRoleForPartnerRole', () => {
  it('maps every legacy partner role to a valid scoped application role', () => {
    const cases: Array<[string, string]> = [
      ['diagnostic_owner', 'OWNER'], ['diagnostic_admin', 'ADMIN'], ['diagnostic_manager', 'MANAGER'],
      ['diagnostic_operator', 'ASSISTANT'], ['diagnostic_reception', 'ASSISTANT'], ['diagnostic_finance', 'ADMIN'], ['diagnostic_quality', 'ADMIN'],
      ['medical_lab_owner', 'OWNER'], ['medical_lab_admin', 'ADMIN'], ['medical_lab_manager', 'MANAGER'], ['medical_lab_reception', 'ASSISTANT'],
      ['medical_lab_technician', 'LAB'], ['medical_lab_validator', 'DOCTOR'], ['medical_lab_doctor', 'DOCTOR'], ['medical_lab_finance', 'ADMIN'], ['medical_lab_quality', 'ADMIN'],
      ['dental_lab_owner', 'OWNER'], ['dental_lab_admin', 'ADMIN'], ['dental_lab_manager', 'MANAGER'], ['lab_coordinator', 'ASSISTANT'],
      ['dental_technician', 'LAB'], ['cad_designer', 'LAB'], ['ceramist', 'LAB'], ['orthodontic_technician', 'LAB'], ['qc_specialist', 'ADMIN'], ['lab_finance', 'ADMIN'],
    ];
    for (const [key, expected] of cases) expect(userRoleForPartnerRole(key, 'PATIENT')).toBe(expected);
  });

  it('fails closed to the current role for an unknown partner role', () => {
    expect(userRoleForPartnerRole('future_partner_role', 'PATIENT')).toBe('PATIENT');
  });
});

describe('roleLabelFor', () => {
  it('reads a dotted key, a bare key and an upper-case enum the same way', () => {
    expect(roleLabelFor('clinic.owner')).toBe('Владелец');
    expect(roleLabelFor('owner')).toBe('Владелец');
    expect(roleLabelFor('OWNER')).toBe('Владелец');
  });

  it('takes the first of several roles', () => {
    expect(roleLabelFor('doctor,assistant')).toBe('Врач');
  });

  it('falls back to a word, never to nothing', () => {
    expect(roleLabelFor(undefined)).toBe('Участник');
    expect(roleLabelFor('something_new')).toBe('Участник');
  });
});
