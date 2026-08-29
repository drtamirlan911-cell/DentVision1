/**
 * The one place the odontogram is written.
 *
 * A patient's chart lives in two shapes at once: the FDI map inside
 * `Patient.medicalHistory.teeth`, which the CRM reads and writes, and the
 * `Tooth` rows, which the rest of the backend joins against. Both have to move
 * together — a second implementation that updated only one of them would put
 * the same tooth in two states, which is precisely the class of bug this
 * module exists to prevent.
 */

import prisma from '../../lib/prisma.js';
import { uid } from '../../lib/helpers.js';

export type ToothMap = Record<string, unknown>;

/** Mirror the FDI map into `Tooth` rows. */
export async function syncTeeth(patientId: string, teeth: ToothMap | undefined): Promise<void> {
  if (!teeth || typeof teeth !== 'object') return;
  for (const [num, val] of Object.entries(teeth)) {
    const number = parseInt(num, 10);
    if (!Number.isFinite(number)) continue;
    const entry = val as Record<string, any> | string | null;
    const condition = typeof entry === 'string' ? entry : entry?.status || entry?.condition || 'healthy';
    const diagnosis = typeof entry === 'object' && entry ? entry.diagnosis || null : null;
    let notes: string | null = typeof entry === 'object' && entry ? entry.notes || null : null;
    if (typeof entry === 'object' && entry?.surfaces && typeof entry.surfaces === 'object') {
      notes = JSON.stringify({ surfaces: entry.surfaces, note: typeof notes === 'string' ? notes : null });
    }
    await prisma.tooth.upsert({
      where: { patientId_number: { patientId, number } },
      create: { id: uid(), patientId, number, condition, diagnosis, notes },
      update: { condition, diagnosis, notes },
    });
  }
}

export interface ToothFinding {
  /** FDI number. */
  tooth: number;
  /** A key from the chart's status vocabulary (caries, filled, crown, …). */
  status: string;
  /** Surfaces the status applies to; empty means the whole tooth. */
  surfaces?: string[];
  note?: string | null;
}

const SURFACE_KEYS = new Set(['M', 'O', 'D', 'B', 'L']);
/** A tooth that is gone cannot keep surface paint from when it was there. */
const WHOLE_TOOTH_ONLY = new Set(['missing', 'extracted', 'implant']);

export function isValidFdi(n: number): boolean {
  const quadrant = Math.floor(n / 10);
  const position = n % 10;
  if (position < 1) return false;
  if (quadrant >= 1 && quadrant <= 4) return position <= 8;
  if (quadrant >= 5 && quadrant <= 8) return position <= 5;
  return false;
}

/**
 * Apply findings onto the patient's existing chart and persist both shapes.
 *
 * Additive: teeth not mentioned are left exactly as they were. Returns the
 * before/after of each tooth it touched, which is what the approval record and
 * the audit trail show — "16: здоров → кариес" is reviewable, a diff-less
 * "chart updated" is not.
 */
export async function applyToothFindings(
  patientId: string,
  clinicId: string,
  findings: ToothFinding[],
): Promise<Array<{ tooth: number; before: string; after: string }>> {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, clinicId },
    select: { id: true, medicalHistory: true },
  });
  if (!patient) throw new Error('PATIENT_NOT_FOUND');

  const history = (patient.medicalHistory && typeof patient.medicalHistory === 'object'
    ? { ...(patient.medicalHistory as Record<string, unknown>) }
    : {}) as Record<string, unknown>;
  const teeth: ToothMap =
    history.teeth && typeof history.teeth === 'object' ? { ...(history.teeth as ToothMap) } : {};

  const changes: Array<{ tooth: number; before: string; after: string }> = [];

  for (const finding of findings) {
    if (!isValidFdi(Number(finding.tooth))) continue;
    const key = String(finding.tooth);
    const current = teeth[key];
    const currentObj = (typeof current === 'object' && current ? current : {}) as Record<string, any>;
    const before = typeof current === 'string' ? current : currentObj.status || 'healthy';

    const surfaces = (finding.surfaces || []).filter((s) => SURFACE_KEYS.has(s));
    const keepSurfaces = WHOLE_TOOTH_ONLY.has(finding.status)
      ? {}
      : {
          ...(typeof currentObj.surfaces === 'object' ? currentObj.surfaces : {}),
          ...Object.fromEntries(surfaces.map((s) => [s, finding.status])),
        };

    teeth[key] = {
      ...currentObj,
      status: finding.status,
      surfaces: keepSurfaces,
      ...(finding.note ? { notes: finding.note } : {}),
    };
    changes.push({ tooth: Number(finding.tooth), before, after: finding.status });
  }

  if (changes.length === 0) return changes;

  history.teeth = teeth;
  await prisma.patient.update({
    where: { id: patientId },
    data: { medicalHistory: history as any },
  });
  await syncTeeth(patientId, teeth);

  return changes;
}
