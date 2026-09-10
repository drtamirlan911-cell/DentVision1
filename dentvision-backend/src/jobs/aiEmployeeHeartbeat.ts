/**
 * DentVision AI employee heartbeat.
 *
 * The heartbeat is deterministic: it never asks the model whether it should
 * wake up. It finds active clinic owners and emits one DailySummary event per
 * clinic/day. The Event OS gathers clinic facts and the CEO agent can hand
 * those facts to OpenAI for reasoning. The scheduler itself is owned by the
 * existing durable job loop.
 */
import prisma from '../lib/prisma.js';
import { eventBus, EventType } from '../modules/events/index.js';

const HEARTBEAT_TITLE = 'DentVision AI — ceo';

export async function runAiEmployeeHeartbeat(): Promise<void> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const clinics = await prisma.clinic.findMany({
    where: { active: true },
    select: {
      id: true,
      members: {
        where: { role: { in: ['OWNER', 'SUPERADMIN'] } },
        select: { userId: true },
        take: 2,
      },
    },
  });

  for (const clinic of clinics) {
    for (const member of clinic.members) {
      // The durable job may tick more frequently than once per day. Do not
      // turn that scheduler into a notification spammer.
      const alreadyDelivered = await prisma.notification.findFirst({
        where: {
          userId: member.userId,
          title: HEARTBEAT_TITLE,
          createdAt: { gte: startOfDay },
        },
        select: { id: true },
      });
      if (alreadyDelivered) continue;

      await eventBus.publish(
        EventType.DailySummary,
        {
          trigger: 'ai_employee_heartbeat',
          generatedAt: new Date().toISOString(),
          proactive: true,
        },
        {
          clinicId: clinic.id,
          userId: member.userId,
          source: 'ai_employee_heartbeat',
        },
      );
    }
  }
}
