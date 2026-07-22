/**
 * Persist dismissed proactive tips across reloads (guest & clinic).
 * Keys are stable (action type / text), not random render ids.
 */

const STORAGE_KEY = 'dv_dismissed_alerts'
const MAX_KEYS = 80

function readKeys(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : []
  } catch {
    return []
  }
}

function writeKeys(keys: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys.slice(-MAX_KEYS)))
  } catch {
    /* ignore quota / private mode */
  }
}

/** Stable identity for an alert so dismiss survives remount / refetch. */
export function alertDismissKey(alert: {
  id?: string
  action?: { type?: string; params?: Record<string, unknown> } | null
  text?: string
  message?: string
}): string {
  const actionType = alert.action?.type
  if (actionType) return `action:${actionType}`
  const text = String(alert.text || alert.message || '').trim().toLowerCase()
  if (text) return `text:${text.slice(0, 120)}`
  return `id:${alert.id || 'unknown'}`
}

export function isAlertDismissed(alert: Parameters<typeof alertDismissKey>[0]): boolean {
  const key = alertDismissKey(alert)
  return readKeys().includes(key)
}

export function dismissAlertPersist(alert: Parameters<typeof alertDismissKey>[0]): void {
  const key = alertDismissKey(alert)
  const next = readKeys().filter((k) => k !== key)
  next.push(key)
  writeKeys(next)
}

export function dismissAlertsPersist(alerts: Array<Parameters<typeof alertDismissKey>[0]>): void {
  const existing = new Set(readKeys())
  for (const a of alerts) existing.add(alertDismissKey(a))
  writeKeys([...existing])
}

export function filterDismissedAlerts<T extends Parameters<typeof alertDismissKey>[0]>(alerts: T[]): T[] {
  const dismissed = new Set(readKeys())
  return alerts.filter((a) => !dismissed.has(alertDismissKey(a)))
}
