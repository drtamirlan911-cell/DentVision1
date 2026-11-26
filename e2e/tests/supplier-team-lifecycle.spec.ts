import { test, expect } from '@playwright/test';

const API = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';
const PASSWORD = 'Test1234!';

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function registerUser(request: any, email: string, firstName: string) {
  const response = await request.post(`${API}/api/auth/register`, {
    data: { email, password: PASSWORD, firstName, lastName: 'Supplier E2E' },
  });
  expect(response.status(), await response.text()).toBe(201);
  const body = await response.json();
  const token = body.data?.accessToken || body.accessToken;
  expect(token).toBeTruthy();
  return String(token);
}

async function switchToSupplier(request: any, token: string, supplierId: string) {
  const response = await request.post(`${API}/api/iam/switch-context`, {
    headers: auth(token),
    data: { scopeType: 'SUPPLIER', scopeId: supplierId },
  });
  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  const scopedToken = body.data?.accessToken || body.accessToken;
  expect(scopedToken).toBeTruthy();
  return String(scopedToken);
}

test.describe('Supplier owner team lifecycle', () => {
  test('owner can invite, see and remove a manager; removed JWT loses supplier access', async ({ request }) => {
    const stamp = Date.now();
    const ownerEmail = `supplier-owner-${stamp}@test.com`;
    const managerEmail = `supplier-manager-${stamp}@test.com`;
    let ownerToken = await registerUser(request, ownerEmail, 'Supplier Owner');
    const managerBaseToken = await registerUser(request, managerEmail, 'Supplier Manager');

    const created = await request.post(`${API}/api/organizations/self-service`, {
      headers: auth(ownerToken),
      data: { type: 'supplier', name: `E2E Supplier Team ${stamp}`, city: 'Тараз' },
    });
    expect(created.status(), await created.text()).toBe(201);
    const organization = (await created.json()).data;
    expect(organization.organizationId).toBeTruthy();
    expect(organization.entityId).toBeTruthy();

    ownerToken = await switchToSupplier(request, ownerToken, String(organization.entityId));
    const ownerWorkspace = await request.get(`${API}/api/supplier/me`, { headers: auth(ownerToken) });
    expect(ownerWorkspace.status(), await ownerWorkspace.text()).toBe(200);

    const invitationResponse = await request.post(`${API}/api/iam/invitations`, {
      headers: auth(ownerToken),
      data: {
        organizationId: organization.organizationId,
        role: 'owner',
        email: managerEmail,
      },
    });
    expect(invitationResponse.status(), await invitationResponse.text()).toBe(201);
    const invitation = (await invitationResponse.json()).data;
    expect(invitation.role).toBe('manager');
    expect(invitation.code).toMatch(/^[A-F0-9]{8}$/);

    const joined = await request.post(`${API}/api/iam/join-by-invite`, {
      headers: auth(managerBaseToken),
      data: { code: invitation.code },
    });
    expect(joined.status(), await joined.text()).toBe(201);
    const managerToken = await switchToSupplier(request, managerBaseToken, String(organization.entityId));

    const managerTeamRead = await request.get(`${API}/api/supplier/team`, { headers: auth(managerToken) });
    expect(managerTeamRead.status()).toBe(403);
    const managerInvite = await request.post(`${API}/api/iam/invitations`, {
      headers: auth(managerToken),
      data: { organizationId: organization.organizationId, role: 'manager' },
    });
    expect(managerInvite.status()).toBe(403);

    const teamResponse = await request.get(`${API}/api/supplier/team`, { headers: auth(ownerToken) });
    expect(teamResponse.status(), await teamResponse.text()).toBe(200);
    const members = (await teamResponse.json()).data;
    expect(members).toHaveLength(2);
    const ownerMember = members.find((member: any) => member.role === 'owner');
    const managerMember = members.find((member: any) => member.userId !== ownerMember?.userId);
    expect(ownerMember).toBeTruthy();
    expect(managerMember?.role).toBe('manager');

    const ownerRemoval = await request.delete(`${API}/api/supplier/team/${ownerMember.id}`, {
      headers: auth(ownerToken),
    });
    expect(ownerRemoval.status()).toBe(409);

    const removed = await request.delete(`${API}/api/supplier/team/${managerMember.id}`, {
      headers: auth(ownerToken),
    });
    expect(removed.status(), await removed.text()).toBe(200);

    const staleTokenRead = await request.get(`${API}/api/supplier/me`, {
      headers: auth(managerToken),
    });
    expect(staleTokenRead.status()).toBe(403);
    const staleTokenBody = await staleTokenRead.json();
    // The shared IAM authenticator may deny first because removing the
    // supplier PersonRole invalidates the organization-scoped JWT before the
    // supplier workspace membership guard executes.
    const deniedByIam = staleTokenBody.error === 'У вас нет активной роли в этой организации';
    const deniedBySupplierMembership = staleTokenBody.code === 'SUPPLIER_MEMBERSHIP_REVOKED';
    expect(staleTokenBody.ok).toBe(false);
    expect(deniedByIam || deniedBySupplierMembership).toBe(true);

    const refreshedTeam = await request.get(`${API}/api/supplier/team`, { headers: auth(ownerToken) });
    expect(refreshedTeam.status()).toBe(200);
    expect((await refreshedTeam.json()).data).toHaveLength(1);
  });
});
