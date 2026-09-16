/**
 * Matching a signed-in user to the patient card a clinic already holds.
 *
 * Matching is deliberately deterministic and clinic-scoped when context is
 * available. IIN is the strongest patient identifier in Kazakhstan; email and
 * phone remain fallback contact identifiers.
 */

import { Prisma } from '@prisma/client';

import prisma from '../../lib/prisma.js';
import { normalizePhone } from '../crm/reminderEligibility.js';
import { hmacIin } from '../../lib/phi.js';

export interface PatientMatch {
  id: string;
  clinicId: string;
  /** How the card was found — worth logging when a link is created. */
  via: 'userId' | 'iin' | 'email' | 'phone';
}

/** The digits a phone can be searched by, ignoring +7 / 8 / spacing. */
export function phoneNeedle(phone: string | null | undefined): string {
  const digits = normalizePhone(phone);
  return digits.length >= 10 ? digits.slice(-10) : '';
}

export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = phoneNeedle(a);
  return !!left && left === phoneNeedle(b);
}

/**
 * Find this user's patient card, linking it on first match.
 *
 * IIN is checked first, then email and phone. The caller should only provide
 * an IIN collected from the authenticated patient; the stored IIN itself is
 * encrypted and is never used as a plaintext SQL lookup.
 */
export async function resolvePatientForUser(
  user: { id: string; email?: string | null; phone?: string | null; iin?: string | null; clinicId?: string | null },
  opts: { clinicId?: string | null; phoneHint?: string | null; iinHint?: string | null } = {},
): Promise<PatientMatch | null> {
  const effectiveClinicId = opts.clinicId ?? user.clinicId ?? null;
  const clinicScope = effectiveClinicId ? { clinicId: effectiveClinicId } : {};

  const byUserId = await prisma.patient.findFirst({
    where: { userId: user.id, ...clinicScope },
    select: { id: true, clinicId: true },
  });
  if (byUserId) return { ...byUserId, via: 'userId' };

  const wantedIin = opts.iinHint ?? user.iin;
  const iinHash = hmacIin(wantedIin);
  if (iinHash) {
    const byIin = await prisma.patient.findFirst({
      where: { iinHash, userId: null, ...clinicScope },
      select: { id: true, clinicId: true },
    });
    if (byIin && await claim(byIin.id, user.id)) {
      return { ...byIin, via: 'iin' };
    }
  }

  if (user.email) {
    const byEmail = await prisma.patient.findFirst({
      where: { email: user.email, userId: null, ...clinicScope },
      select: { id: true, clinicId: true },
    });
    if (byEmail && await claim(byEmail.id, user.id)) {
      return { ...byEmail, via: 'email' };
    }
  }

  const wanted = opts.phoneHint || user.phone;
  const needle = phoneNeedle(wanted);
  if (needle) {
    const rows = await prisma.$queryRaw<Array<{ id: string; clinicId: string; phone: string | null }>>`
      SELECT id, "clinicId", phone
      FROM patients
      WHERE "userId" IS NULL
        AND phone IS NOT NULL
        AND regexp_replace(phone, '[^0-9]', '', 'g') LIKE ${'%' + needle}
        ${effectiveClinicId ? Prisma.sql`AND "clinicId" = ${effectiveClinicId}` : Prisma.empty}
      LIMIT 20
    `;
    const hit = rows.find((c) => phonesMatch(c.phone, wanted));
    if (hit && await claim(hit.id, user.id)) {
      return { id: hit.id, clinicId: hit.clinicId, via: 'phone' };
    }
  }

  const afterRace = await prisma.patient.findFirst({
    where: { userId: user.id, ...clinicScope },
    select: { id: true, clinicId: true },
  });
  return afterRace ? { ...afterRace, via: 'userId' } : null;
}

/** Write the link only while the card is still unclaimed (compare-and-set). */
async function claim(patientId: string, userId: string): Promise<boolean> {
  const result = await prisma.patient.updateMany({
    where: { id: patientId, userId: null },
    data: { userId },
  });
  return result.count === 1;
}
