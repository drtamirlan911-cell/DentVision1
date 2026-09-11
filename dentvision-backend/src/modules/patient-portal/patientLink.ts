/**
 * Matching a signed-in user to the patient card a clinic already holds.
 *
 * The portal used to bridge the two by email alone, and never wrote the link
 * down: `/me`, `ensurePatient` and `/link` each redid the same email lookup on
 * every request. Two consequences, both routine rather than exotic:
 *
 *  - reception commonly enters a patient by phone with no email, and the public
 *    booking form makes email optional while requiring the phone. Those patients
 *    matched nothing, so registering gave them a second, empty card — no visits,
 *    no invoices, no images — while their real one sat in the same clinic;
 *  - because the match was never persisted, changing the email on the card
 *    silently revoked the patient's access to their own history.
 *
 * Phone is the identifier this product actually always has, so it is matched
 * too, and a match by either identifier writes `userId` once.
 */

import { Prisma } from '@prisma/client';

import prisma from '../../lib/prisma.js';
import { normalizePhone } from '../crm/reminderEligibility.js';

export interface PatientMatch {
  id: string;
  clinicId: string;
  /** How the card was found — worth logging when a link is created. */
  via: 'userId' | 'email' | 'phone';
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
 * When the authenticated session carries an active clinic context, that
 * context is the default scope. Callers may still pass an explicit clinicId
 * (for example during a deliberate clinic-link flow), but absence of an
 * explicit option no longer means "search every clinic" for a multi-clinic
 * user. This makes the active workspace context part of the patient identity
 * boundary instead of relying on first-match semantics.
 */
export async function resolvePatientForUser(
  user: { id: string; email?: string | null; phone?: string | null; clinicId?: string | null },
  opts: { clinicId?: string | null; phoneHint?: string | null } = {},
): Promise<PatientMatch | null> {
  const effectiveClinicId = opts.clinicId ?? user.clinicId ?? null;
  const clinicScope = effectiveClinicId ? { clinicId: effectiveClinicId } : {};

  const byUserId = await prisma.patient.findFirst({
    where: { userId: user.id, ...clinicScope },
    select: { id: true, clinicId: true },
  });
  if (byUserId) return { ...byUserId, via: 'userId' };

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
