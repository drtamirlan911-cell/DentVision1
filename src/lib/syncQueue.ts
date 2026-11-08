/**
 * Offline-tolerant schedule sync queue.
 * Queues failed appointment upserts when offline / network error, flushes on online.
 */

import type { Appointment } from '../types'
import * as api from '../utils/api'
import { sanitizeForLocalStorage } from './localStoragePrivacy'

const QUEUE_KEY = 'dv_schedule_sync_queue_v1'
const CACHE_PREFIX = 'dv_schedule_day_'

export type SyncQueueContext = {
  clinicId: string
  workspaceId: string
  workspaceBranchId: string | null
}

export type SyncQueueItem = {
  id: string
  kind: 'upsert' | 'delete'
  payload: Partial<Appointment> & SyncQueueContext & { force?: boolean; id: string }
  enqueuedAt: string
  attempts: number
  lastError?: string
}

function sanitizeQueueItem(item: SyncQueueItem): SyncQueueItem {
  const sanitized: SyncQueueItem = {
    ...item,
    // Remove patient names, phones, notes, diagnosis and other sensitive
    // fields before anything enters persistent browser storage.
    payload: sanitizeForLocalStorage(item.payload),
  }
  // Raw API/network errors can echo patient-entered data. The UI only uses
  // queue counts, so error text is neither needed nor safe to persist.
  delete sanitized.lastError
  return sanitized
}

function loadQueue(): SyncQueueItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
    if (!Array.isArray(parsed)) return []
    const sanitized = parsed
      .filter((item): item is SyncQueueItem => Boolean(item && typeof item === 'object' && item.payload && typeof item.payload.id === 'string'))
      .map((item) => sanitizeQueueItem(item))
    // Rewrite old queues in-place, so PHI written by older builds is scrubbed
    // even when the user only reads the queue and never enqueues new work.
    const serialized = JSON.stringify(sanitized.slice(-100))
    if (localStorage.getItem(QUEUE_KEY) !== serialized) localStorage.setItem(QUEUE_KEY, serialized)
    return sanitized.slice(-100)
  } catch {
    return []
  }
}

function saveQueue(items: SyncQueueItem[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-100).map(sanitizeQueueItem)))
  } catch { /* ignore */ }
}

export function getSyncQueue(): SyncQueueItem[] {
  return loadQueue()
}

export function enqueueAppointmentUpsert(data: Partial<Appointment> & SyncQueueContext & { force?: boolean; id: string }): void {
  // The newest intent for an appointment supersedes every queued operation
  // for that ID. This prevents a stale delete from replaying before a later edit.
  const q = loadQueue().filter((i) => i.payload.id !== data.id)
  q.push({
    id: `uq_${data.id}_${Date.now()}`,
    kind: 'upsert',
    payload: data,
    enqueuedAt: new Date().toISOString(),
    attempts: 0,
  })
  saveQueue(q)
}

export function enqueueAppointmentDelete(id: string, context: SyncQueueContext): void {
  const current = loadQueue()
  const forAppointment = current.filter((item) => item.payload.id === id)
  const pendingUpsert = forAppointment.find((item) => item.kind === 'upsert')
  // If this appointment has never reached the server, preserve its queued
  // upsert and append the delete. Replay will create it before cancelling it.
  const q = current.filter((item) => item.payload.id !== id)
  if (pendingUpsert) q.push(pendingUpsert)
  q.push({
    id: `del_${id}_${Date.now()}`,
    kind: 'delete',
    payload: { id, ...context } as any,
    enqueuedAt: new Date().toISOString(),
    attempts: 0,
  })
  saveQueue(q)
}

function dayCacheKey(context: SyncQueueContext, date: string): string {
  return `${CACHE_PREFIX}${context.clinicId}_${context.workspaceId}_${context.workspaceBranchId ?? 'all'}_${date}`
}

export function cacheDayAppointments(context: SyncQueueContext | null, date: string, appointments: Appointment[]): void {
  if (!context?.clinicId || !context.workspaceId) return
  try {
    localStorage.setItem(
      dayCacheKey(context, date),
      JSON.stringify({
        savedAt: new Date().toISOString(),
        appointments: appointments.map((appointment) => sanitizeForLocalStorage(appointment)),
      }),
    )
  } catch { /* ignore */ }
}

export function readCachedDayAppointments(context: SyncQueueContext | null, date: string): Appointment[] | null {
  if (!context?.clinicId || !context.workspaceId) return null
  try {
    const key = dayCacheKey(context, date)
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed.appointments)) return null
    const appointments = parsed.appointments.map((appointment: Appointment) => sanitizeForLocalStorage(appointment))
    // Scrub caches created by pre-hardening versions as they are read.
    localStorage.setItem(key, JSON.stringify({ ...parsed, appointments }))
    return appointments
  } catch {
    return null
  }
}

export function isLikelyOffline(err?: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const msg = String((err as any)?.message || err || '')
  return /failed to fetch|network|offline|timeout|Load failed/i.test(msg)
}

let flushing = false

export async function flushSyncQueue(activeContext: SyncQueueContext | null): Promise<{ flushed: number; remaining: number }> {
  const queued = loadQueue()
  // The API derives tenant/workspace/branch from the active authenticated
  // session. A queued operation may only replay in the exact same context.
  // Legacy rows without a workspace/branch contract remain queued (fail closed).
  if (
    !activeContext?.clinicId
    || !activeContext.workspaceId
    || !Object.prototype.hasOwnProperty.call(activeContext, 'workspaceBranchId')
  ) return { flushed: 0, remaining: queued.length }
  if (flushing) return { flushed: 0, remaining: queued.length }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { flushed: 0, remaining: loadQueue().length }
  }
  flushing = true
  let flushed = 0
  try {
    const q = queued
    const remaining: SyncQueueItem[] = []
    const failedUpserts = new Set<string>()
    for (const item of q) {
      if (
        item.payload.clinicId !== activeContext.clinicId
        || item.payload.workspaceId !== activeContext.workspaceId
        || (item.payload.workspaceBranchId ?? null) !== (activeContext.workspaceBranchId ?? null)
      ) {
        remaining.push(item)
        continue
      }
      // Do not execute a queued delete when its create/update operation failed
      // earlier in this same replay. The next reconnect retries in order.
      if (item.kind === 'delete' && failedUpserts.has(item.payload.id)) {
        remaining.push(item)
        continue
      }
      try {
        if (item.kind === 'delete') {
          await api.deleteAppointment(item.payload.id)
        } else {
          await api.upsertAppointment(item.payload)
        }
        flushed += 1
      } catch (err: any) {
        if (item.kind === 'upsert') failedUpserts.add(item.payload.id)
        remaining.push({
          ...item,
          attempts: item.attempts + 1,
          lastError: String(err?.message || err),
        })
      }
    }
    saveQueue(remaining)
    return { flushed, remaining: remaining.length }
  } finally {
    flushing = false
  }
}

export function startSyncQueueListener(
  activeContext: SyncQueueContext | null,
  onFlush?: (r: { flushed: number; remaining: number }) => void,
): () => void {
  const handler = async () => {
    const r = await flushSyncQueue(activeContext)
    onFlush?.(r)
  }
  window.addEventListener('online', handler)
  // Opportunistic flush
  void handler()
  return () => window.removeEventListener('online', handler)
}
