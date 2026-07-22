/**
 * Daily AI chat archive helpers.
 * - One active chat per user/clinic per calendar day (clinic/client TZ)
 * - At midnight the previous chat becomes archived
 * - Archives are readable for 7 days, then purged
 */

import { prisma } from '../../../lib/prisma.js';
import {
  DEFAULT_CLINIC_TZ,
  formatDateInTz,
  resolveTimeZone,
  zonedLocalToUtc,
} from '../lib/timezone.js';

export const ARCHIVE_RETENTION_DAYS = 7;

export type SessionArchiveMeta = {
  dayKey?: string;
  status?: 'active' | 'archived';
  archivedAt?: string;
  preview?: string;
  timeZone?: string;
};

function asMeta(context: unknown): SessionArchiveMeta {
  if (context && typeof context === 'object' && !Array.isArray(context)) {
    return { ...(context as SessionArchiveMeta) };
  }
  return {};
}

/** YYYY-MM-DD in the given IANA timezone. */
export function dayKeyInTz(date = new Date(), timeZone = DEFAULT_CLINIC_TZ): string {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // en-CA → YYYY-MM-DD
  return dtf.format(date);
}

export function labelForDayKey(dayKey: string, timeZone = DEFAULT_CLINIC_TZ, todayKey?: string): string {
  const today = todayKey || dayKeyInTz(new Date(), timeZone);
  if (dayKey === today) return 'Сегодня';
  const [y, m, d] = dayKey.split('-').map(Number);
  if (!y || !m || !d) return dayKey;
  const noon = zonedLocalToUtc(timeZone, y, m, d, 12, 0, 0);
  return formatDateInTz(noon, timeZone, { day: 'numeric', month: 'long', weekday: 'short' });
}

function daysAgoKey(days: number, timeZone: string, now = new Date()): string {
  const [y, m, d] = dayKeyInTz(now, timeZone).split('-').map(Number);
  const noon = zonedLocalToUtc(timeZone, y, m, d, 12, 0, 0);
  const past = new Date(noon.getTime() - days * 86_400_000);
  return dayKeyInTz(past, timeZone);
}

function previewFromMessages(messages: unknown): string | undefined {
  if (!Array.isArray(messages)) return undefined;
  const userMsg = [...messages].reverse().find((m: any) => m?.role === 'user' && String(m?.content || '').trim());
  if (!userMsg) return undefined;
  const text = String(userMsg.content).replace(/\s+/g, ' ').trim();
  return text.length > 72 ? `${text.slice(0, 72)}…` : text;
}

async function messageCount(sessionId: string): Promise<number> {
  return prisma.aIMessage.count({ where: { sessionId } });
}

/** Hard-delete sessions older than retention window. */
export async function purgeExpiredAiSessions(userId?: string): Promise<number> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - (ARCHIVE_RETENTION_DAYS + 1));
  const where: Record<string, unknown> = {
    updatedAt: { lt: cutoff },
  };
  if (userId) where.userId = userId;

  // Prefer meta-based purge for accuracy, but also catch stale sessions by age.
  const stale = await prisma.aISession.findMany({
    where,
    select: { id: true, context: true, createdAt: true, updatedAt: true },
    take: 200,
  });

  const toDelete: string[] = [];
  for (const s of stale) {
    const meta = asMeta(s.context);
    if (meta.status === 'archived' || meta.dayKey) {
      toDelete.push(s.id);
      continue;
    }
    // Legacy sessions with no meta: drop if older than retention
    if (s.updatedAt < cutoff) toDelete.push(s.id);
  }

  if (!toDelete.length) return 0;

  await prisma.aIMessage.deleteMany({ where: { sessionId: { in: toDelete } } });
  const result = await prisma.aISession.deleteMany({ where: { id: { in: toDelete } } });
  return result.count;
}

async function archiveSession(sessionId: string, timeZone: string): Promise<void> {
  const session = await prisma.aISession.findUnique({ where: { id: sessionId } });
  if (!session) return;
  const meta = asMeta(session.context);
  if (meta.status === 'archived') return;

  const preview =
    meta.preview ||
    previewFromMessages(session.messages) ||
    (await (async () => {
      const rows = await prisma.aIMessage.findMany({
        where: { sessionId, role: 'user' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { content: true },
      });
      const text = rows[0]?.content?.replace(/\s+/g, ' ').trim();
      return text ? (text.length > 72 ? `${text.slice(0, 72)}…` : text) : undefined;
    })());

  await prisma.aISession.update({
    where: { id: sessionId },
    data: {
      context: {
        ...meta,
        status: 'archived',
        archivedAt: new Date().toISOString(),
        dayKey: meta.dayKey || dayKeyInTz(session.createdAt, timeZone),
        preview,
        timeZone,
      },
    },
  });
}

/**
 * Ensure there is exactly one active chat for today.
 * Previous day's active chat is archived (kept 7 days).
 */
export async function ensureTodaySession(opts: {
  userId: string;
  clinicId: string;
  timeZone?: string | null;
}): Promise<{ sessionId: string; dayKey: string; rolled: boolean; timeZone: string }> {
  const timeZone = resolveTimeZone(opts.timeZone);
  const todayKey = dayKeyInTz(new Date(), timeZone);

  // Opportunistic cleanup
  void purgeExpiredAiSessions(opts.userId).catch(() => undefined);

  const sessions = await prisma.aISession.findMany({
    where: { userId: opts.userId, clinicId: opts.clinicId },
    orderBy: { updatedAt: 'desc' },
    take: 30,
    select: { id: true, context: true, messages: true, createdAt: true, updatedAt: true },
  });

  const todayActive = sessions.find((s) => {
    const meta = asMeta(s.context);
    return meta.dayKey === todayKey && meta.status !== 'archived';
  });
  if (todayActive) {
    return { sessionId: todayActive.id, dayKey: todayKey, rolled: false, timeZone };
  }

  // Adopt a legacy session created today that has no dayKey stamp yet
  const legacyToday = sessions.find((s) => {
    const meta = asMeta(s.context);
    if (meta.status === 'archived') return false;
    const key = meta.dayKey || dayKeyInTz(s.createdAt, timeZone);
    return key === todayKey;
  });
  if (legacyToday) {
    const meta = asMeta(legacyToday.context);
    await prisma.aISession.update({
      where: { id: legacyToday.id },
      data: {
        context: {
          ...meta,
          dayKey: todayKey,
          status: 'active',
          timeZone,
          preview: meta.preview || previewFromMessages(legacyToday.messages),
        },
      },
    });
    return { sessionId: legacyToday.id, dayKey: todayKey, rolled: false, timeZone };
  }

  // Archive any lingering "active" sessions from other days
  let rolled = false;
  for (const s of sessions) {
    const meta = asMeta(s.context);
    if (meta.status === 'archived') continue;
    const key = meta.dayKey || dayKeyInTz(s.createdAt, timeZone);
    if (key === todayKey) continue;

    const count = Array.isArray(s.messages) && (s.messages as unknown[]).length
      ? (s.messages as unknown[]).length
      : await messageCount(s.id);

    if (count > 0) {
      await archiveSession(s.id, timeZone);
      rolled = true;
    } else {
      // Empty leftover — reuse as today's chat
      await prisma.aISession.update({
        where: { id: s.id },
        data: {
          context: {
            ...meta,
            dayKey: todayKey,
            status: 'active',
            timeZone,
            archivedAt: undefined,
          },
          messages: [],
        },
      });
      return { sessionId: s.id, dayKey: todayKey, rolled: true, timeZone };
    }
  }

  const id = crypto.randomUUID();
  await prisma.aISession.create({
    data: {
      id,
      userId: opts.userId,
      clinicId: opts.clinicId,
      messages: [],
      context: {
        dayKey: todayKey,
        status: 'active',
        timeZone,
      },
    },
  });

  return { sessionId: id, dayKey: todayKey, rolled, timeZone };
}

export type ArchiveThreadSummary = {
  threadId: string;
  sessionId: string;
  dayKey: string;
  label: string;
  status: 'active' | 'archived';
  preview?: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  expiresInDays?: number;
};

export async function listDailyThreads(opts: {
  userId: string;
  clinicId?: string | null;
  timeZone?: string | null;
}): Promise<{ active: ArchiveThreadSummary | null; archives: ArchiveThreadSummary[]; retentionDays: number }> {
  const timeZone = resolveTimeZone(opts.timeZone);
  const todayKey = dayKeyInTz(new Date(), timeZone);
  const oldestKeep = daysAgoKey(ARCHIVE_RETENTION_DAYS - 1, timeZone);

  await ensureTodaySession({
    userId: opts.userId,
    clinicId: opts.clinicId || 'platform',
    timeZone,
  });

  const sessions = await prisma.aISession.findMany({
    where: {
      userId: opts.userId,
      ...(opts.clinicId ? { clinicId: opts.clinicId } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: 40,
    select: { id: true, context: true, messages: true, createdAt: true, updatedAt: true },
  });

  const summaries: ArchiveThreadSummary[] = [];
  for (const s of sessions) {
    const meta = asMeta(s.context);
    const dayKey = meta.dayKey || dayKeyInTz(s.createdAt, timeZone);
    if (dayKey < oldestKeep && dayKey !== todayKey) continue;

    const msgCount = Array.isArray(s.messages)
      ? (s.messages as unknown[]).length
      : await messageCount(s.id);

    const status: 'active' | 'archived' =
      dayKey === todayKey && meta.status !== 'archived' ? 'active' : 'archived';

    // How many calendar days remain until purge (approx)
    let expiresInDays: number | undefined;
    if (status === 'archived') {
      const [y, m, d] = dayKey.split('-').map(Number);
      const dayDate = zonedLocalToUtc(timeZone, y, m, d, 12, 0, 0);
      const expireAt = new Date(dayDate);
      expireAt.setUTCDate(expireAt.getUTCDate() + ARCHIVE_RETENTION_DAYS);
      expiresInDays = Math.max(0, Math.ceil((expireAt.getTime() - Date.now()) / 86_400_000));
    }

    summaries.push({
      threadId: s.id,
      sessionId: s.id,
      dayKey,
      label: labelForDayKey(dayKey, timeZone, todayKey),
      status,
      preview: meta.preview || previewFromMessages(s.messages),
      messageCount: msgCount,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      expiresInDays,
    });
  }

  // Deduplicate by dayKey — keep newest
  const byDay = new Map<string, ArchiveThreadSummary>();
  for (const row of summaries) {
    const prev = byDay.get(row.dayKey);
    if (!prev || prev.updatedAt < row.updatedAt) byDay.set(row.dayKey, row);
  }

  const unique = [...byDay.values()].sort((a, b) => (a.dayKey < b.dayKey ? 1 : -1));
  const active = unique.find((t) => t.status === 'active') || null;
  const archives = unique.filter((t) => t.status === 'archived');

  return { active, archives, retentionDays: ARCHIVE_RETENTION_DAYS };
}

export async function getThreadMessages(opts: {
  userId: string;
  sessionId: string;
}): Promise<{
  sessionId: string;
  dayKey: string;
  label: string;
  status: 'active' | 'archived';
  messages: Array<{ id: string; role: string; content: string; timestamp: string }>;
  readOnly: boolean;
} | null> {
  const session = await prisma.aISession.findFirst({
    where: { id: opts.sessionId, userId: opts.userId },
  });
  if (!session) return null;

  const meta = asMeta(session.context);
  const timeZone = resolveTimeZone(meta.timeZone);
  const todayKey = dayKeyInTz(new Date(), timeZone);
  const dayKey = meta.dayKey || dayKeyInTz(session.createdAt, timeZone);
  const status: 'active' | 'archived' =
    dayKey === todayKey && meta.status !== 'archived' ? 'active' : 'archived';

  let messages: Array<{ id: string; role: string; content: string; timestamp: string }> = [];
  if (Array.isArray(session.messages) && (session.messages as any[]).length) {
    messages = (session.messages as any[]).map((m, i) => ({
      id: m.id || `m-${i}`,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp || session.updatedAt.toISOString(),
    }));
  } else {
    const rows = await prisma.aIMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    messages = rows.map((r) => ({
      id: r.id,
      role: r.role,
      content: r.content,
      timestamp: r.createdAt.toISOString(),
    }));
  }

  return {
    sessionId: session.id,
    dayKey,
    label: labelForDayKey(dayKey, timeZone, todayKey),
    status,
    messages,
    readOnly: status === 'archived',
  };
}

/** Keep session meta in sync after messages change. */
export async function touchSessionMeta(sessionId: string, messages: unknown[], timeZone?: string): Promise<void> {
  const session = await prisma.aISession.findUnique({ where: { id: sessionId }, select: { context: true } });
  if (!session) return;
  const meta = asMeta(session.context);
  const tz = resolveTimeZone(timeZone || meta.timeZone);
  const todayKey = dayKeyInTz(new Date(), tz);
  await prisma.aISession.update({
    where: { id: sessionId },
    data: {
      context: {
        ...meta,
        dayKey: meta.dayKey || todayKey,
        status: meta.status === 'archived' ? 'archived' : 'active',
        timeZone: tz,
        preview: previewFromMessages(messages) || meta.preview,
      },
    },
  });
}
