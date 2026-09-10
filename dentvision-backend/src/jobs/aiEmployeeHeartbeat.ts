/**
 * DentVision AI employee heartbeat.
 *
 * The heartbeat is deterministic: it never asks the model whether it should
 * wake up. It finds active clinic owners and emits a DailySummary event. The
 * Event OS gathers clinic facts through its tools and OpenAI reasons over those
 * facts. The scheduler itself is owned by an existing durable job loop.
 */
import prisma from '../lib/prisma.js';
import { eventBus, EventType } from '../modules/events/index.js';

export async function runAiEmployeeHeartbeat(): Promise<void> {
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
      eventBus.publish(
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
