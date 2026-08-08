import { prisma } from '../../../lib/prisma.js';
import { AIContext } from '../types/ai.types.js';
import { resolveClinicAccess } from '../../../lib/orgContext.js';

export class ContextManager {
  async loadContext(userId: string, clinicId: string): Promise<AIContext> {
    const [user, clinic] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } }),
      prisma.clinic.findUnique({ where: { id: clinicId }, select: { id: true, name: true } }),
    ]);

    const access = await resolveClinicAccess(userId, clinicId);

    return {
      userId,
      clinicId: clinic?.id ?? clinicId,
      role: access?.role ?? user?.role ?? 'DOCTOR',
      sessionId: crypto.randomUUID(),
      metadata: {},
    };
  }

  async loadPatientContext(patientId: string, clinicId: string): Promise<{
    patient: any;
    appointments: any[];
    visits: any[];
    treatmentPlans: any[];
    images: any[];
  }> {
    const [patient, appointments, visits, treatmentPlans, images] = await Promise.all([
      prisma.patient.findUnique({
        where: { id: patientId },
        include: { clinic: true },
      }),
      prisma.appointment.findMany({
        where: { patientId, clinicId },
        orderBy: { date: 'desc' },
        take: 5,
      }),
      prisma.visit.findMany({
        where: { patientId },
        orderBy: { date: 'desc' },
        take: 10,
      }),
      prisma.treatmentPlan.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.patientImage.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

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

  async getCurrentPermissions(userId: string, clinicId: string): Promise<string[]> {
    // DB-first (Person → PersonRole), legacy ClinicMember fallback — same
    // resolver loadContext() already uses, so a unified (Person-only, no
    // ClinicMember row) user gets their real role here instead of always
    // being treated as DOCTOR.
    const access = await resolveClinicAccess(userId, clinicId);
    const role = access?.role ?? 'DOCTOR';

    if (role === 'SUPERADMIN') return ['*'];

    const permissions: Record<string, string[]> = {
      OWNER: ['*'],
      ADMIN: ['patients:*', 'appointments:*', 'billing:*', 'inventory:*', 'reports:*'],
      DOCTOR: ['patients:read', 'appointments:*', 'medical:*', 'treatment-plans:*'],
      ASSISTANT: ['patients:read', 'appointments:read', 'medical:read'],
      LAB: ['lab-orders:*'],
      MANAGER: ['patients:*', 'appointments:*', 'inventory:*', 'reports:*'],
    };

    return permissions[role] ?? [];
  }
}

export const contextManager = new ContextManager();