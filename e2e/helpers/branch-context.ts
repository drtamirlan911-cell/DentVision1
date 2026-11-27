import type { APIRequestContext } from '@playwright/test';
import { prisma } from './db';

export async function switchToAssignedClinicBranch(input: {
  request: APIRequestContext;
  baseUrl: string;
  accessToken: string;
  userId: string;
  clinicId: string;
}): Promise<{ accessToken: string; organizationId: string; branchId: string }> {
  const organization = await prisma.organization.findFirstOrThrow({
    where: {
      originalType: 'Clinic',
      originalId: input.clinicId,
      archivedAt: null,
    },
    select: { id: true },
  });
  const person = await prisma.person.findFirstOrThrow({
    where: { userId: input.userId, organizationId: organization.id },
    select: { id: true },
  });
  const branch = await prisma.branch.findFirst({
    where: {
      organizationId: organization.id,
      clinicId: input.clinicId,
      active: true,
      members: { some: { personId: person.id, active: true } },
    },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });
  if (!branch) {
    throw new Error('The clinic user has no active canonical BranchMember assignment');
  }

  const response = await input.request.post(`${input.baseUrl}/api/iam/switch-context`, {
    headers: { Authorization: `Bearer ${input.accessToken}` },
    data: {
      scopeType: 'CLINIC',
      scopeId: organization.id,
      branchId: branch.id,
    },
  });
  const responseText = await response.text();
  if (response.status() !== 200) {
    throw new Error(`Unable to select assigned clinic branch: ${response.status()} ${responseText}`);
  }

  const body = JSON.parse(responseText);
  const nextAccessToken = String(body?.data?.accessToken || '');
  if (!nextAccessToken) {
    throw new Error('Branch context switch did not return an access token');
  }

  return {
    accessToken: nextAccessToken,
    organizationId: organization.id,
    branchId: branch.id,
  };
}

/**
 * API E2E tests must select a branch explicitly after a role gains multiple
 * active BranchMember assignments. The contexts endpoint exposes the
 * organization default as a hint; switch-context validates and issues the
 * actual branch-scoped token.
 */
export async function switchToDefaultClinicBranch(input: {
  request: APIRequestContext;
  baseUrl: string;
  accessToken: string;
  clinicId?: string;
}): Promise<{ accessToken: string; organizationId?: string; clinicId: string; branchId: string }> {
  const headers = { Authorization: `Bearer ${input.accessToken}` };
  const contextsResponse = await input.request.get(`${input.baseUrl}/api/iam/me/contexts`, { headers });
  const contextsText = await contextsResponse.text();
  if (contextsResponse.status() !== 200) {
    throw new Error(`Unable to load clinic branch context hints: ${contextsResponse.status()} ${contextsText}`);
  }

  const contextsBody = JSON.parse(contextsText);
  const contexts = Array.isArray(contextsBody?.data?.contexts) ? contextsBody.data.contexts : [];
  const eligible = contexts.filter((context: {
    scopeType?: string;
    scopeId?: string;
    organizationId?: string;
    branchId?: string;
  }) => context.scopeType === 'CLINIC'
    && Boolean(context.branchId)
    && (!input.clinicId || context.scopeId === input.clinicId || context.organizationId === input.clinicId));

  if (eligible.length !== 1) {
    throw new Error(`Expected one clinic context with a configured default branch, found ${eligible.length}`);
  }

  const selected = eligible[0] as {
    scopeId: string;
    organizationId?: string;
    branchId: string;
  };
  const clinicId = input.clinicId || selected.scopeId;
  const scopeId = selected.organizationId || selected.scopeId;
  const switchResponse = await input.request.post(`${input.baseUrl}/api/iam/switch-context`, {
    headers,
    data: { scopeType: 'CLINIC', scopeId, branchId: selected.branchId },
  });
  const switchText = await switchResponse.text();
  if (switchResponse.status() !== 200) {
    throw new Error(`Unable to select the clinic default branch: ${switchResponse.status()} ${switchText}`);
  }

  const switchBody = JSON.parse(switchText);
  const accessToken = String(switchBody?.data?.accessToken || '');
  if (!accessToken) throw new Error('Clinic branch switch did not return an access token');

  return {
    accessToken,
    organizationId: selected.organizationId,
    clinicId,
    branchId: selected.branchId,
  };
}

