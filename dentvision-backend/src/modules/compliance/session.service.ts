import prisma from '../../lib/prisma.js';

export interface SessionInfo {
  id: string;
  device: string | null;
  browser: string | null;
  ipAddress: string | null;
  lastActivity: Date;
  createdAt: Date;
  expiredAt: Date | null;
}

/** Parse User-Agent into device / browser labels */
function parseUA(ua: string | undefined): { device: string; browser: string } {
  if (!ua) return { device: 'Unknown', browser: 'Unknown' };
  const lower = ua.toLowerCase();
  const device = lower.includes('mobile') ? 'Mobile' : lower.includes('tablet') ? 'Tablet' : 'Desktop';
  let browser = 'Unknown';
  if (lower.includes('edg')) browser = 'Edge';
  else if (lower.includes('chrome')) browser = 'Chrome';
  else if (lower.includes('firefox')) browser = 'Firefox';
  else if (lower.includes('safari')) browser = 'Safari';
  else if (lower.includes('opera')) browser = 'Opera';
  return { device, browser };
}

/** Record a new login session */
export async function createSession(
  userId: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<SessionInfo> {
  const { device, browser } = parseUA(userAgent);
  const session = await prisma.userSession.create({
    data: {
      userId,
      device,
      browser,
      ipAddress: ipAddress || null,
      lastActivity: new Date(),
      expiredAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });
  return session;
}

/** Refresh lastActivity to keep session alive */
export async function touchSession(sessionId: string): Promise<void> {
  await prisma.userSession.update({
    where: { id: sessionId },
    data: { lastActivity: new Date() },
  });
}

/** List active (non-expired) sessions for a user */
export async function listActiveSessions(userId: string): Promise<SessionInfo[]> {
  return prisma.userSession.findMany({
    where: { userId, expiredAt: { gt: new Date() } },
    orderBy: { lastActivity: 'desc' },
  });
}

/** Expire a session (logout) */
export async function expireSession(sessionId: string): Promise<void> {
  await prisma.userSession.update({
    where: { id: sessionId },
    data: { expiredAt: new Date() },
  });
}

/** Expire all sessions for a user (logout everywhere) */
export async function expireAllSessions(userId: string): Promise<void> {
  await prisma.userSession.updateMany({
    where: { userId, expiredAt: { gt: new Date() } },
    data: { expiredAt: new Date() },
  });
}
