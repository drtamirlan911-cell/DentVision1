import type { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma.js';

export type OrganizationDeletionResult =
  | { ok: true; data: { id: string; name: string } }
  | { ok: false; status: number; error: string };
type OrganizationClient = Pick<Prisma.TransactionClient, 'organization'>;

/** Delete only an empty organization; may run inside a caller's transaction. */
export async function deleteOrganizationIfEmpty(id: string, client: OrganizationClient = prisma): Promise<OrganizationDeletionResult> {
  const org = await client.organization.findUnique({
    where: { id }, select: { id: true, name: true, _count: { select: { persons: true, branches: true } } },
  });
  if (!org) return { ok: false, status: 404, error: 'Организация не найдена' };
  if (org._count.persons > 0 || org._count.branches > 0) {
    return { ok: false, status: 409, error: 'Нельзя удалить организацию, пока к ней привязаны сотрудники или филиалы' };
  }
  await client.organization.delete({ where: { id } });
  return { ok: true, data: { id: org.id, name: org.name } };
}
