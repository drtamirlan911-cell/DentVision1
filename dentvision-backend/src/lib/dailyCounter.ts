import prisma from './prisma.js'

const TTL_MS = 48 * 60 * 60 * 1000

export function utcDay(at: Date = new Date()): string {
  return at.toISOString().slice(0, 10)
}

export async function incrementDaily(key: string, by = 1): Promise<number | null> {
  if (!Number.isFinite(by) || by <= 0) return null
  try {
    const expiresAt = new Date(Date.now() + TTL_MS)
    const rows = await prisma.$queryRaw<Array<{ total: number }>>`
      INSERT INTO daily_counters (key, day, total, expires_at, created_at, updated_at)
      VALUES (${key}, ${utcDay()}, ${by}, ${expiresAt}, NOW(), NOW())
      ON CONFLICT (key, day) DO UPDATE
      SET total = daily_counters.total + EXCLUDED.total, updated_at = NOW()
      RETURNING total
    `
    return Number(rows[0]?.total ?? 0)
  } catch {
    return null
  }
}

export async function readDaily(key: string): Promise<number | null> {
  try {
    const rows = await prisma.$queryRaw<Array<{ total: number }>>`
      SELECT total FROM daily_counters
      WHERE key = ${key} AND day = ${utcDay()} AND expires_at > NOW() LIMIT 1
    `
    return Number(rows[0]?.total ?? 0)
  } catch {
    return null
  }
}

export async function clearDaily(key: string): Promise<void> {
  try {
    await prisma.$executeRaw`DELETE FROM daily_counters WHERE key = ${key} AND day = ${utcDay()}`
  } catch {}
}

export const counterKeys = {
  modelBudget: (tier: string, day = utcDay()) => `dv:ai:budget:${day}:${tier}`,
  guestQuota: (userId: string, day = utcDay()) => `dv:ai:quota:guest:${day}:${userId}`,
  patientQuota: (userId: string, day = utcDay()) => `dv:ai:quota:patient:${day}:${userId}`,
}