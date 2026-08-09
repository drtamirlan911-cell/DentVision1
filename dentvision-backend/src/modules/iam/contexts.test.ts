import { describe, expect, it } from 'vitest';

import { buildWorkspaceContexts, roleLabelFor, type ContextSources } from './contexts.js';

const empty: ContextSources = { memberships: [], supplierMemberships: [], lecturer: null, persons: [] };

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
