/**
 * DentVision AI employee heartbeat.
 *
 * This is deliberately deterministic: the heartbeat does not ask the model to
 * decide whether it should wake up. It wakes on a fixed schedule, finds active
 * clinic owners, and emits a DailySummary event. The Event OS then gathers the
 * clinic facts through its tools and lets OpenAI reason over those facts.
 *
 * Keeping the scheduler outside the LLM is important: an unavailable provider
 * must never stop the CRM, and the model must never become the source of truth
 * for whether a clinic exists or who may receive an executive brief.
 */
import prisma from '../lib/prisma.js';
import { withJobLock } from '../lib/jobLock.js';
import { eventBus, EventType } from '../modules/events/index.js';

let timer: ReturnType<typeof setInterval> | null = null;

async function runAiEmployeeHeartbeat(): Promise<void> {
  const clinics = await prisma.clinic.findMany({
    where: { active: true },
    select: {
      id: true,
      members: {
        where: {
          role: { in: ['OWNER', 'SUPERADMIN'] },
        },
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

export function startAiEmployeeHeartbeatInterval(ms = 24 * 60 * 60 * 1000): void {
  if (timer) clearInterval(timer);
  console.log(`[aiEmployeeHeartbeat] started, interval=${ms}ms`);

  setTimeout(() => {
    withJobLock('ai_employee_heartbeat', runAiEmployeeHeartbeat).catch((error) => {
      console.error('[aiEmployeeHeartbeat] boot run failed', error);
    });
  }, 60_000);

  timer = setInterval(() => {
    withJobLock('ai_employee_heartbeat', runAiEmployeeHeartbeat).catch((error) => {
      console.error('[aiEmployeeHeartbeat] interval failed', error);
    });
  }, ms);
}
