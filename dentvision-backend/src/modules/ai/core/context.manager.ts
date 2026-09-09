import { prisma } from '../../../lib/prisma.js';
import { AIContext } from '../types/ai.types.js';
import { resolveClinicAccess, resolveOrganizationIdForClinic } from '../../../lib/orgContext.js';
import { resolveUserPermissions } from '../../../lib/resolvePermissions.js';

export class ContextManager {
  async loadContext(userId: string, clinicId: string): Promise<AIContext> {
    const [user, clinic, access] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } }),
      prisma.clinic.findUnique({ where: { id: clinicId }, select: { id: true, name: true } }),
      resolveClinicAccess(userId, clinicId),
    ]);

    // The AI context is an authorization boundary, not merely presentation
    // state. Never construct a context for a clinic the caller cannot access,
    // and never fall back to the global user role for an unscoped request.
    if (!user) throw new Error('USER_NOT_FOUND');
    if (!clinic) throw new Error('CLINIC_NOT_FOUND');
    if (!access) throw new Error('CLINIC_ACCESS_REQUIRED');

    return {
      userId,
      clinicId: clinic.id,
      role: access.role ?? user.role ?? 'DOCTOR',
      sessionId: crypto.randomUUID(),
      metadata: {},
    };
  }

  async loadPatientContext(userId: string, patientId: string, clinicId: string): Promise<{
    patient: any;
    appointments: any[];
    visits: any[];
    treatmentPlans: any[];
    images: any[];
  }> {
    // Patient context is clinical data. Never resolve a caller-supplied patient
    // id before proving that the caller belongs to the requested clinic.
    const access = await resolveClinicAccess(userId, clinicId);
    if (!access) {
      throw new Error('CLINIC_ACCESS_REQUIRED');
    }

    const [patient, appointments, visits, treatmentPlans, images] = await Promise.all([
      prisma.patient.findFirst({
        where: { id: patientId, clinicId },
        include: { clinic: true },
      }),
      prisma.appointment.findMany({
        where: { patientId, clinicId },
        orderBy: { date: 'desc' },
        take: 5,
      }),
      // Visit is already tenant-bound through the patient loaded above, but
      // the legacy Visit model has no clinicId column. Do not fabricate a
      // schema field here; the patient boundary is the authoritative scope.
      prisma.visit.findMany({
        where: { patientId },
        orderBy: { date: 'desc' },
        take: 10,
      }),
      prisma.treatmentPlan.findMany({
        where: { patientId, clinicId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.patientImage.findMany({
        where: { patientId, patient: { clinicId } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    if (!patient) {
      throw new Error('PATIENT_OUTSIDE_CLINIC');
    }

    return { patient, appointments, visits, treatmentPlans, images };
  }

  async loadClinicContext(clinicId: string): Promise<any> {
    return prisma.clinic.findUnique({
      where: { id: clinicId },
      include: {
        members: {
          include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } },
        },
        _count: {
          select: {
            patients: true,
            appointments: true,
            invoices: true,
          },
        },
      },
    });
  }

  /**
   * Effective permissions for the AI intent router.
   *
   * This used to be a hardcoded map in its own vocabulary (`patients:read`,
   * `treatment-plans:*`, `lab-orders:*`) — a fifth permission dictionary that
   * neither rbac.ts nor the Person → PersonRole graph had any say in, and whose
   * module names existed nowhere else. It now returns the same dot-notation
   * keys the REST routes are gated on, resolved from the database for the
   * clinic-scoped role.
   */
  async getCurrentPermissions(userId: string, clinicId: string): Promise<string[]> {
    // DB-first (Person → PersonRole), legacy ClinicMember fallback — same
    // resolver loadContext() already uses, so a unified (Person-only, no
    // ClinicMember row) user gets their real role here instead of always
    // being treated as DOCTOR.
    const access = await resolveClinicAccess(userId, clinicId);
    const role = access?.role ?? 'DOCTOR';

    if (role === 'SUPERADMIN') return ['*'];

    const organizationId = await resolveOrganizationIdForClinic(clinicId);
    return resolveUserPermissions(userId, organizationId, role);
  }
}

export const contextManager = new ContextManager();
