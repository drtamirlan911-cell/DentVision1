/**
 * Digital Twin Event OS Extension — enriches the digital twin
 * with real-time Event OS data (recent AI actions, agent status).
 */

import prisma from '../../../lib/prisma.js';

// ─── Types ───

export interface TwinEventOSData {
  recentActions: Array<{
    agent: string;
    action: string;
    timestamp: Date;
    success: boolean;
  }>;
  agentStatus: Record<string, {
    lastActive: Date | null;
    actionsToday: number;
    successRate: number;
  }>;
  pendingAlerts: number;
  timelineSize: number;
}

// ─── Service ───

export async function getTwinEventOSData(
  clinicId: string
): Promise<TwinEventOSData> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Fetch recent AI events
  const recentEvents = await prisma.aIEvent.findMany({
    where: { clinicId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  // Build recent actions
  const recentActions = recentEvents.map((e) => ({
    agent: e.source,
    action: e.type,
    timestamp: e.createdAt,
    success: e.status === 'COMPLETED',
  }));

  // Build agent status
  const agentStatus: Record<string, {
    lastActive: Date | null;
    actionsToday: number;
    successRate: number;
  }> = {};

  for (const event of recentEvents) {
    const agent = event.source;
    if (!agentStatus[agent]) {
      agentStatus[agent] = {
        lastActive: event.createdAt,
        actionsToday: 0,
        successRate: 100,
      };
    }
    if (event.createdAt >= todayStart) {
      agentStatus[agent].actionsToday++;
    }
  }

  // Count pending alerts
  const pendingAlerts = await prisma.aIEvent.count({
    where: {
      clinicId,
      status: 'PENDING',
    },
  });

  const timelineSize = await prisma.aIEvent.count({
    where: { clinicId },
  });

  return {
    recentActions,
    agentStatus,
    pendingAlerts,
    timelineSize,
  };
}

/**
 * Merge Event OS data into an existing digital twin object.
 */
export function enrichTwinWithEventOS(
  twin: Record<string, unknown>,
  eventOSData: TwinEventOSData
): Record<string, unknown> {
  return {
    ...twin,
    eventOS: {
      recentActions: eventOSData.recentActions.slice(0, 5),
      agentCount: Object.keys(eventOSData.agentStatus).length,
      pendingAlerts: eventOSData.pendingAlerts,
      timelineSize: eventOSData.timelineSize,
      topAgents: Object.entries(eventOSData.agentStatus)
        .sort(([, a], [, b]) => b.actionsToday - a.actionsToday)
        .slice(0, 3)
        .map(([name, data]) => ({
          name,
          actionsToday: data.actionsToday,
          lastActive: data.lastActive,
        })),
    },
  };
}
