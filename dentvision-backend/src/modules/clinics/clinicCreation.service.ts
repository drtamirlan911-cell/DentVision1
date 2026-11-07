import type { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { uid } from '../../lib/helpers.js';
import { writeAuditLog, type AuditInput } from '../compliance/audit.service.js';
import { TRIAL_DAYS } from '../billing/clinicSubscription.service.js';

export interface ClinicCreationInput {
  name: string;
  city?: string;
  address?: string;
  phone?: string;
}

export function normalizeClinicInput(value: unknown, fallbackName?: string): ClinicCreationInput | null {
  const body = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const rawName = typeof body.name === 'string' ? body.name.trim() : '';
  const name = rawName || fallbackName || '';
  if (!name || name.length > 120) return null;

  const limits = { city: 120, address: 300, phone: 40 } as const;
  const normalized: ClinicCreationInput = { name };
  for (const field of ['city', 'address', 'phone'] as const) {
    const raw = body[field];
    if (raw === undefined || raw === null || raw === '') continue;
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (trimmed.length > limits[field]) return null;
    if (trimmed) normalized[field] = trimmed;
  }
  return normalized;
}

/** Atomic canonical creation for the legacy Clinic and unified IAM graph. */
export async function createClinicForOwnerInTransaction(
  tx: Prisma.TransactionClient,
  userId: string,
  input: ClinicCreationInput,
  audit?: Omit<AuditInput, 'entityId'>,
) {
  const [ownerRole, ownerUser] = await Promise.all([
    tx.role.findUnique({ where: { key: 'owner' } }),
    tx.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, phone: true, email: true, spec: true } }),
  ]);
  if (!ownerRole || !ownerUser) throw new Error('Clinic owner IAM bootstrap prerequisites are missing');

  const clinicId = uid();
  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + TRIAL_DAYS);
  const clinic = await tx.clinic.create({
    data: { id: clinicId, name: input.name, city: input.city || null, address: input.address || null, phone: input.phone || null, plan: 'ENTERPRISE', active: true },
  });
  await tx.subscription.create({
    data: { ownerType: 'CLINIC', ownerId: clinicId, plan: 'enterprise', status: 'trialing', periodEnd },
  });
  await tx.clinicMember.create({ data: { id: uid(), userId, clinicId, role: 'OWNER' } });

  const organization = await tx.organization.upsert({
    where: { originalType_originalId: { originalType: 'Clinic', originalId: clinicId } },
    update: { name: input.name, address: input.address || null, phone: input.phone || null },
    create: {
      id: uid(), name: input.name, type: 'CLINIC', address: input.address || null, phone: input.phone || null,
      contacts: input.city ? { city: input.city } : undefined, originalType: 'Clinic', originalId: clinicId,
    },
  });
  const fullName = `${ownerUser.firstName} ${ownerUser.lastName}`.trim() || 'Владелец клиники';
  const person = await tx.person.upsert({
    where: { userId_organizationId: { userId, organizationId: organization.id } },
    update: {
      fullName, personType: 'STAFF', phone: ownerUser.phone || undefined, email: ownerUser.email || undefined,
      specialization: ownerUser.spec || undefined, originalType: 'ClinicMember', originalId: `${clinicId}:${userId}`,
    },
    create: {
      id: uid(), fullName, personType: 'STAFF', organizationId: organization.id, userId,
      phone: ownerUser.phone || undefined, email: ownerUser.email || undefined, specialization: ownerUser.spec || undefined,
      originalType: 'ClinicMember', originalId: `${clinicId}:${userId}`,
    },
  });
  await tx.personRole.upsert({
    where: { personId_roleId_scopeKey: { personId: person.id, roleId: ownerRole.id, scopeKey: `organization:${organization.id}` } },
    update: { scopeType: 'organization', scopeId: organization.id },
    create: { personId: person.id, roleId: ownerRole.id, scopeType: 'organization', scopeId: organization.id, scopeKey: `organization:${organization.id}` },
  });
  if (audit) await writeAuditLog({ ...audit, entityId: clinic.id }, tx);
  return { clinic, organization, person };
}

export async function createClinicForOwner(
  userId: string,
  input: ClinicCreationInput,
  audit?: Omit<AuditInput, 'entityId'>,
) {
  return prisma.$transaction((tx) => createClinicForOwnerInTransaction(tx, userId, input, audit));
}
