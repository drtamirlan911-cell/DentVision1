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
  // Last ten digits identify the subscriber; the country prefix is what varies
  // between "+7 707 …", "8 707 …" and "707 …" for the same person.
  return digits.length >= 10 ? digits.slice(-10) : '';
}

export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = phoneNeedle(a);
  return !!left && left === phoneNeedle(b);
}

/**
 * Find this user's patient card, linking it on first match.
 *
 * `clinicId` narrows the search when the caller knows which clinic is meant
 * (the booking flow does); without it any clinic is acceptable, which is the
 * behaviour the portal already had.
 */
export async function resolvePatientForUser(
  user: { id: string; email?: string | null; phone?: string | null },
  opts: { clinicId?: string | null; phoneHint?: string | null } = {},
): Promise<PatientMatch | null> {
  const clinicScope = opts.clinicId ? { clinicId: opts.clinicId } : {};

  const byUserId = await prisma.patient.findFirst({
    where: { userId: user.id, ...clinicScope },
    select: { id: true, clinicId: true },
  });
  if (byUserId) return { ...byUserId, via: 'userId' };

  // Only ever adopt a card that belongs to nobody yet. Claiming one that is
  // already linked would hand a stranger another person's medical history.
  if (user.email) {
    const byEmail = await prisma.patient.findFirst({
      where: { email: user.email, userId: null, ...clinicScope },
      select: { id: true, clinicId: true },
    });
    if (byEmail) {
      await claim(byEmail.id, user.id);
      return { ...byEmail, via: 'email' };
    }
  }

  const wanted = opts.phoneHint || user.phone;
  const needle = phoneNeedle(wanted);
  if (needle) {
    // Compare digits, not the stored string. Prisma's `contains` runs against
    // the raw column, and reception types "+7 707 555 33 22" — the spaces alone
    // make a digits-only needle miss every time, which is how a phone-only
    // patient still ended up with a duplicate card. Postgres strips the
    // formatting on its side instead.
    const rows = await prisma.$queryRaw<Array<{ id: string; clinicId: string; phone: string | null }>>`
      SELECT id, "clinicId", phone
      FROM patients
      WHERE "userId" IS NULL
        AND phone IS NOT NULL
        AND regexp_replace(phone, '[^0-9]', '', 'g') LIKE ${'%' + needle}
        ${opts.clinicId ? Prisma.sql`AND "clinicId" = ${opts.clinicId}` : Prisma.empty}
      LIMIT 20
    `;
    // The raw filter is coarse (it ignores the country prefix); the normalised
    // comparison is what decides.
    const hit = rows.find((c) => phonesMatch(c.phone, wanted));
    if (hit) {
      await claim(hit.id, user.id);
      return { id: hit.id, clinicId: hit.clinicId, via: 'phone' };
    }
  }

  return null;
}

/**
 * Write the link, but only while the card is still unclaimed.
 *
 * `updateMany` with the guard in the filter makes this a compare-and-set: two
 * concurrent logins cannot both take the same card.
 */
async function claim(patientId: string, userId: string): Promise<void> {
  await prisma.patient.updateMany({
    where: { id: patientId, userId: null },
    data: { userId },
  });
}
