import prisma from '../lib/prisma.js';
import { uid } from '../lib/helpers.js';
import { dispatchNotification, dispatchNotifications } from '../modules/notifications/dispatch.service.js';

/**
 * Unified notification service — single entry point for all platform notifications.
 *
 * Every module (CRM, Diagnostics, Shop, School, Admin) creates notifications
 * through this service so that:
 *  - user preferences are respected (opt-in / opt-out per type)
 *  - channel dispatch (WhatsApp / SMS / email) happens automatically
 *  - deep links are consistent
 */

export const NOTIFICATION_TYPES = {
  // CRM
  APPOINTMENT_REMINDER: 'crm.appointment.reminder',
  APPOINTMENT_CANCELLED: 'crm.appointment.cancelled',
  PATIENT_NO_SHOW: 'crm.patient.no_show',
  INVOICE_PAID: 'crm.invoice.paid',
  INVENTORY_LOW: 'crm.inventory.low',

  // Diagnostics
  REFERRAL_SENT: 'diagnostics.referral.sent',
  REFERRAL_ACCEPTED: 'diagnostics.referral.accepted',
  REFERRAL_RESULT: 'diagnostics.referral.result',
  REFERRAL_PAYMENT: 'diagnostics.referral.payment',

  // Shop
  ORDER_PLACED: 'shop.order.placed',
  ORDER_STATUS: 'shop.order.status',
  ORDER_PAYMENT: 'shop.order.payment',

  // School
  ENROLLMENT_CONFIRMED: 'school.enrollment.confirmed',
  COURSE_COMPLETED: 'school.course.completed',
  CERTIFICATE_READY: 'school.certificate.ready',

  // Admin
  CLINIC_EXPIRING: 'admin.clinic.expiring',
  CLINIC_EXPIRED: 'admin.clinic.expired',
  NEW_CLINIC: 'admin.clinic.new',

  // Platform
  SYSTEM: 'platform.system',
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType | string;
  title: string;
  message: string;
  link?: string;
  /** Skip the user-preference check (always-deliver, e.g. security alerts). */
  force?: boolean;
}

/**
 * Create a notification for a single user if they have not opted out of this type.
 * Dispatches to all configured channels (in-app, WhatsApp, SMS, email).
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    if (!input.force) {
      const pref = await prisma.notificationPreference.findUnique({
        where: { userId_type: { userId: input.userId, type: input.type } },
      });
      if (pref && pref.enabled === false) return;
    }

    await dispatchNotification({
      userId: input.userId,
      clinicId: input.clinicId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link,
    });
  } catch (err) {
    console.error('[NotificationService] Failed to create notification:', err);
  }
}

/**
 * Create the same notification for multiple users (batch).
 * Checks preferences per-user.
 */
export async function createNotificationForMany(
  userIds: string[],
  input: Omit<CreateNotificationInput, 'userId'>,
): Promise<void> {
  for (const userId of [...new Set(userIds)]) {
    await createNotification({ ...input, userId });
  }
}

/**
 * Create notifications for all members of a clinic.
 */
export async function createNotificationForClinic(
  clinicId: string,
  input: Omit<CreateNotificationInput, 'userId'>,
  opts?: { roles?: string[] },
): Promise<void> {
  try {
    const where: any = { clinicId };
    if (opts?.roles?.length) where.role = { in: opts.roles };
    const members = await prisma.clinicMember.findMany({ where, select: { userId: true } });
    await createNotificationForMany(members.map((m) => m.userId), { ...input, clinicId });
  } catch (err) {
    console.error('[NotificationService] Failed to create clinic notifications:', err);
  }
}

/**
 * Create notifications for all members of a diagnostic center / lab.
 */
export async function createNotificationForCenter(
  organizationId: string,
  input: Omit<CreateNotificationInput, 'userId'>,
): Promise<void> {
  try {
    const persons = await prisma.person.findMany({
      where: { organizationId },
      select: { userId: true },
    });
    const userIds = persons.map((p) => p.userId).filter(Boolean);
    await createNotificationForMany(userIds, input);
  } catch (err) {
    console.error('[NotificationService] Failed to create center notifications:', err);
  }
}
