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
