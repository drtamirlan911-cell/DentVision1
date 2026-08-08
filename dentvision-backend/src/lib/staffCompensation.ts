/**
 * Payroll configuration for a staff member.
 *
 * `commissionPercent` / `baseSalary` / `payType` lived only on `ClinicMember`,
 * so staff represented purely as a Person had no configuration at all:
 * `/billing/my-payroll` answered 404 for them and the clinic payroll run left
 * them out. This resolves it the same way every other resolver in this codebase
 * does — unified model first, legacy table as fallback — and adds the writer
 * used to keep both in step until the legacy columns are retired.
 */

import prisma from './prisma.js';
import { resolveOrganizationIdForClinic } from './orgContext.js';

export interface StaffCompensation {
  commissionPercent: number;
  baseSalary: number;
  payType: string;
  /** Which store answered — useful for spotting staff still on legacy only. */
  source: 'person' | 'clinicMember' | 'default';
}

/** What a member gets when nobody has configured them, matching the Prisma defaults. */
export const DEFAULT_COMPENSATION: Omit<StaffCompensation, 'source'> = {
  commissionPercent: 30,
  baseSalary: 0,
  payType: 'commission',
};

/** The Person representing this user's membership of this clinic, if any. */
async function findMembershipPerson(userId: string, clinicId: string) {
  const organizationId = await resolveOrganizationIdForClinic(clinicId);
  if (!organizationId) return null;
  return prisma.person.findFirst({
    where: { userId, organizationId },
    select: { id: true },
  });
}

export async function resolveStaffCompensation(
  userId: string,
  clinicId: string,
): Promise<StaffCompensation> {
  const person = await findMembershipPerson(userId, clinicId);
  if (person) {
    const compensation = await prisma.personCompensation.findUnique({
      where: { personId: person.id },
    });
    if (compensation) {
      return {
        commissionPercent: compensation.commissionPercent,
        baseSalary: compensation.baseSalary,
        payType: compensation.payType,
        source: 'person',
      };
    }
  }

  const member = await prisma.clinicMember.findUnique({
    where: { userId_clinicId: { userId, clinicId } },
    select: { commissionPercent: true, baseSalary: true, payType: true },
  });
  if (member) {
    return {
      commissionPercent: member.commissionPercent ?? DEFAULT_COMPENSATION.commissionPercent,
      baseSalary: member.baseSalary ?? DEFAULT_COMPENSATION.baseSalary,
      payType: member.payType ?? DEFAULT_COMPENSATION.payType,
      source: 'clinicMember',
    };
  }

  return { ...DEFAULT_COMPENSATION, source: 'default' };
}

/**
 * Write payroll configuration into the unified model.
 *
 * Call sites keep writing ClinicMember as well — it stays the source of truth
 * until the legacy columns are retired, and dual-writing means the two cannot
 * drift in the meantime. A no-op when the Person does not exist yet (the
 * caller's syncPersonFromClinicMember creates it on the next write).
 */
export async function upsertStaffCompensation(
  userId: string,
  clinicId: string,
  data: { commissionPercent?: number; baseSalary?: number; payType?: string },
): Promise<void> {
  const person = await findMembershipPerson(userId, clinicId);
  if (!person) return;

  await prisma.personCompensation.upsert({
    where: { personId: person.id },
    update: data,
    create: { personId: person.id, ...DEFAULT_COMPENSATION, ...data },
  });
}
