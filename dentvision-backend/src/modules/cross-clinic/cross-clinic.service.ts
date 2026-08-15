/**
 * Patient-consented, cross-clinic access to medical history.
 *
 * The receiving clinic never gets a free-standing "does this IIN exist
 * elsewhere?" lookup — that would be an enumeration oracle over patients'
 * national IDs. `requestAccess` collapses "check" and "request" into one
 * action with a constant response (see its doc comment); the only way to
 * learn anything is to actually be granted access by the patient.
 */
import prisma from '../../lib/prisma.js';
import { uid } from '../../lib/helpers.js';
import { hmacIin, decryptField, decryptPatientFields } from '../../lib/phi.js';
import { writeAuditLog } from '../compliance/audit.service.js';
import { dispatchNotification, dispatchNotifications } from '../notifications/dispatch.service.js';
import { isStorageKey, keyFromStorageUrl, signedDownloadUrl } from '../../lib/storage.js';

const RESET_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface RequestAccessResult {
  requested: true;
}

/**
 * Clinic B requests access to a walk-in's history at other clinics.
 *
 * `receivingPatientId` must already exist as a real intake record in the
 * caller's own clinic — creating that record is itself an accountable,
 * tenant-scoped, already-audited action, which is what stands in for a
 * separate "lookup" step. The response is always `{ requested: true }`,
 * regardless of whether zero, one, or several matches were found, and
 * regardless of whether a match even has a portal account — none of that is
 * ever observable from the API response. Every call is logged to AuditLog
 * unconditionally so a support engineer can review the access pattern later
 * even though the caller gets no differential signal.
 */
export async function requestAccess(
  receivingClinicId: string,
  receivingPatientId: string,
  requestedByUserId: string,
  ip?: string | null,
): Promise<RequestAccessResult> {
  await writeAuditLog({
    action: 'CROSS_CLINIC_LOOKUP',
    entity: 'patient',
    entityId: receivingPatientId,
    clinicId: receivingClinicId,
    userId: requestedByUserId,
    ip: ip || undefined,
  });

  const receivingPatient = await prisma.patient.findFirst({
    where: { id: receivingPatientId, clinicId: receivingClinicId },
    select: { id: true, iin: true },
  });
  // A missing/foreign patient row gets exactly the same response as "no
  // history found elsewhere" — the caller cannot distinguish the cases.
  if (!receivingPatient?.iin) return { requested: true };

  const iinHash = hmacIin(decryptField(receivingPatient.iin));
  if (!iinHash) return { requested: true };

  const matches = await prisma.patient.findMany({
    where: {
      iinHash,
      userId: { not: null },
      clinicId: { not: receivingClinicId },
    },
    select: { id: true, clinicId: true, userId: true },
  });

  for (const match of matches) {
    if (!match.userId) continue;
    await upsertGrant({
      patientUserId: match.userId,
      sourceClinicId: match.clinicId,
      sourcePatientId: match.id,
      receivingClinicId,
      receivingPatientId,
      requestedByUserId,
    });
  }

  return { requested: true };
}

async function upsertGrant(input: {
  patientUserId: string;
  sourceClinicId: string;
  sourcePatientId: string;
  receivingClinicId: string;
  receivingPatientId: string;
  requestedByUserId: string;
}): Promise<void> {
  const existing = await prisma.crossClinicAccessGrant.findUnique({
    where: {
      patientUserId_sourceClinicId_receivingClinicId: {
        patientUserId: input.patientUserId,
        sourceClinicId: input.sourceClinicId,
        receivingClinicId: input.receivingClinicId,
      },
    },
  });

  if (existing) {
    // Active/pending/approved grants are left untouched — re-requesting an
    // already-PENDING or already-APPROVED grant must not reset it or spam
    // another notification. Only a DECLINED/REVOKED grant, and only after a
    // cooldown, gets reopened — otherwise a clinic could re-nag a patient who
    // already said no by repeatedly "onboarding" the same walk-in.
    if (existing.status === 'PENDING' || existing.status === 'APPROVED') return;
    const since = existing.revokedAt || existing.respondedAt || existing.updatedAt || existing.createdAt;
    if (since && Date.now() - since.getTime() < RESET_COOLDOWN_MS) return;

    await prisma.crossClinicAccessGrant.update({
      where: { id: existing.id },
      data: {
        status: 'PENDING',
        sourcePatientId: input.sourcePatientId,
        receivingPatientId: input.receivingPatientId,
        requestedByUserId: input.requestedByUserId,
        requestedAt: new Date(),
        respondedAt: null,
        revokedAt: null,
      },
    });
  } else {
    await prisma.crossClinicAccessGrant.create({
      data: {
        id: uid(),
        ...input,
      },
    });
  }

  const clinic = await prisma.clinic.findUnique({ where: { id: input.receivingClinicId }, select: { name: true } });
  await dispatchNotification({
    userId: input.patientUserId,
    type: 'cross_clinic_access_request',
    title: 'Запрос доступа к вашей медицинской карте',
    message: `Клиника «${clinic?.name || 'Клиника'}» запрашивает доступ к вашей истории лечения из другой клиники. Подтвердите или отклоните в личном кабинете.`,
    link: '/patient-portal?tab=access',
  });
}

export type CrossClinicStatus = 'none' | 'pending' | 'approved' | 'declined';

/**
 * Aggregated status only — never names source clinics before APPROVED.
 * Naming the source clinic is the entire point of approval; doing it earlier
 * would leak "this person has records at clinic X" to clinic B's staff
 * before the patient consented to even that much.
 */
export async function getStatus(receivingClinicId: string, receivingPatientId: string): Promise<CrossClinicStatus> {
  const grants = await prisma.crossClinicAccessGrant.findMany({
    where: { receivingClinicId, receivingPatientId },
    select: { status: true },
  });
  if (grants.length === 0) return 'none';
  if (grants.some((g) => g.status === 'APPROVED')) return 'approved';
  if (grants.some((g) => g.status === 'PENDING')) return 'pending';
  return 'declined';
}

export interface CrossClinicHistoryBlock {
  sourceClinic: { id: string; name: string };
  approvedAt: Date | null;
  visits: Array<{ id: string; date: Date; diagnosis: string | null; complaints: string | null; treatment: unknown; notes: string | null }>;
  treatmentPlans: Array<{ id: string; title: string; status: string; items: unknown; createdAt: Date }>;
  medicalHistory: unknown;
  images: Array<{ id: string; type: string; name: string | null; url: string | null; createdAt: Date }>;
  documents: Array<{ id: string; type: string; name: string | null; url: string | null; createdAt: Date }>;
}

/**
 * Full clinical picture from every clinic the patient has approved for this
 * receiving-clinic patient — explicitly excludes Invoice/prepaidBalance
 * (billing stays clinic-internal, this is medical data only). Each block is
 * clearly attributed to its source clinic; nothing here merges into the
 * caller's own editable records — that's the caller's job in the UI layer.
 */
export async function getHistory(
  receivingClinicId: string,
  receivingPatientId: string,
  accessedByUserId: string,
): Promise<CrossClinicHistoryBlock[]> {
  const grants = await prisma.crossClinicAccessGrant.findMany({
    where: { receivingClinicId, receivingPatientId, status: 'APPROVED', revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
  });

  const blocks: CrossClinicHistoryBlock[] = [];
  for (const grant of grants) {
    const [sourceClinic, sourcePatient, visits, treatmentPlans, images, documents] = await Promise.all([
      prisma.clinic.findUnique({ where: { id: grant.sourceClinicId }, select: { id: true, name: true } }),
      prisma.patient.findUnique({ where: { id: grant.sourcePatientId }, select: { medicalHistory: true } }),
      prisma.visit.findMany({
        where: { patientId: grant.sourcePatientId, deletedAt: null },
        select: { id: true, date: true, diagnosis: true, complaints: true, treatment: true, notes: true },
        orderBy: { date: 'desc' },
      }),
      prisma.treatmentPlan.findMany({
        where: { patientId: grant.sourcePatientId, deletedAt: null },
        select: { id: true, title: true, status: true, items: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.patientImage.findMany({
        where: { patientId: grant.sourcePatientId, deletedAt: null },
        select: { id: true, type: true, name: true, url: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.document.findMany({
        where: { patientId: grant.sourcePatientId, deletedAt: null },
        select: { id: true, type: true, name: true, url: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    if (!sourceClinic || !sourcePatient) continue;

    const [signedImages, signedDocuments] = await Promise.all([
      Promise.all(images.map((img) => withSignedUrl(img))),
      Promise.all(documents.map((doc) => withSignedUrl(doc))),
    ]);

    blocks.push({
      sourceClinic,
      approvedAt: grant.respondedAt,
      visits,
      treatmentPlans,
      medicalHistory: decryptPatientFields({ medicalHistory: sourcePatient.medicalHistory }).medicalHistory,
      images: signedImages,
      documents: signedDocuments,
    });

    await prisma.crossClinicAccessLog.create({
      data: { id: uid(), grantId: grant.id, accessedByUserId, dataCategory: 'full_summary', recordCount: visits.length + treatmentPlans.length },
    });
  }

  return blocks;
}

async function withSignedUrl<T extends { url: string | null }>(row: T): Promise<T> {
  if (!row.url || !isStorageKey(row.url)) return row;
  try {
    const signed = await signedDownloadUrl(keyFromStorageUrl(row.url));
    return { ...row, url: signed };
  } catch {
    return { ...row, url: null };
  }
}

async function getGrantForPatient(grantId: string, patientUserId: string) {
  const grant = await prisma.crossClinicAccessGrant.findUnique({ where: { id: grantId } });
  if (!grant || grant.patientUserId !== patientUserId) return null;
  return grant;
}

export async function listAccessRequests(patientUserId: string) {
  return prisma.crossClinicAccessGrant.findMany({
    where: { patientUserId, status: 'PENDING' },
    include: {
      receivingClinic: { select: { id: true, name: true } },
      sourceClinic: { select: { id: true, name: true } },
    },
    orderBy: { requestedAt: 'desc' },
  });
}

export async function listAccessGrants(patientUserId: string) {
  return prisma.crossClinicAccessGrant.findMany({
    where: { patientUserId, status: 'APPROVED' },
    include: {
      receivingClinic: { select: { id: true, name: true } },
      sourceClinic: { select: { id: true, name: true } },
    },
    orderBy: { respondedAt: 'desc' },
  });
}

async function notifyReceivingClinicOwners(clinicId: string, title: string, message: string): Promise<void> {
  const members = await prisma.clinicMember.findMany({
    where: { clinicId, role: { in: ['OWNER', 'ADMIN'] } },
    select: { userId: true },
  });
  if (members.length === 0) return;
  await dispatchNotifications(
    members.map((m) => ({
      userId: m.userId,
      clinicId,
      type: 'cross_clinic_access_response',
      title,
      message,
      link: '/crm/patients',
    })),
  );
}

export async function approveRequest(grantId: string, patientUserId: string): Promise<boolean> {
  const grant = await getGrantForPatient(grantId, patientUserId);
  if (!grant || grant.status !== 'PENDING') return false;
  await prisma.crossClinicAccessGrant.update({
    where: { id: grant.id },
    data: { status: 'APPROVED', respondedAt: new Date() },
  });
  await notifyReceivingClinicOwners(grant.receivingClinicId, 'Пациент подтвердил доступ', 'Пациент разрешил просмотр истории лечения из другой клиники.');
  return true;
}

export async function declineRequest(grantId: string, patientUserId: string): Promise<boolean> {
  const grant = await getGrantForPatient(grantId, patientUserId);
  if (!grant || grant.status !== 'PENDING') return false;
  await prisma.crossClinicAccessGrant.update({
    where: { id: grant.id },
    data: { status: 'DECLINED', respondedAt: new Date() },
  });
  return true;
}

export async function revokeGrant(grantId: string, patientUserId: string): Promise<boolean> {
  const grant = await getGrantForPatient(grantId, patientUserId);
  if (!grant || grant.status !== 'APPROVED') return false;
  await prisma.crossClinicAccessGrant.update({
    where: { id: grant.id },
    data: { status: 'REVOKED', revokedAt: new Date() },
  });
  return true;
}

export async function getAccessLog(patientUserId: string) {
  const logs = await prisma.crossClinicAccessLog.findMany({
    where: { grant: { patientUserId } },
    include: {
      grant: { select: { receivingClinicId: true, receivingClinic: { select: { name: true } } } },
      accessedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return logs.map((l) => ({
    id: l.id,
    receivingClinicName: l.grant.receivingClinic.name,
    accessedBy: `${l.accessedBy.firstName} ${l.accessedBy.lastName}`.trim(),
    dataCategory: l.dataCategory,
    createdAt: l.createdAt,
  }));
}
