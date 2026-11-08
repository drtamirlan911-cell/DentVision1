/**
 * Offline-tolerant schedule sync queue.
 * Queues failed appointment upserts when offline / network error, flushes on online.
 */

import type { Appointment } from '../types'
import * as api from '../utils/api'
import { sanitizeForLocalStorage } from './localStoragePrivacy'

const QUEUE_KEY = 'dv_schedule_sync_queue_v1'
const CACHE_PREFIX = 'dv_schedule_day_'

export type SyncQueueItem = {
  id: string
  kind: 'upsert' | 'delete'
  payload: Partial<Appointment> & { force?: boolean; id: string }
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

export function enqueueAppointmentUpsert(data: Partial<Appointment> & { force?: boolean; id: string }): void {
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

export function enqueueAppointmentDelete(id: string, clinicId: string): void {
  const q = loadQueue().filter((i) => i.payload.id !== id)
  q.push({
    id: `del_${id}_${Date.now()}`,
    kind: 'delete',
    payload: { id, clinicId } as any,
    enqueuedAt: new Date().toISOString(),
    attempts: 0,
  })
  saveQueue(q)
}

export function cacheDayAppointments(clinicId: string, date: string, appointments: Appointment[]): void {
  try {
    localStorage.setItem(
      `${CACHE_PREFIX}${clinicId}_${date}`,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        appointments: appointments.map((appointment) => sanitizeForLocalStorage(appointment)),
      }),
    )
  } catch { /* ignore */ }
}

export function readCachedDayAppointments(clinicId: string, date: string): Appointment[] | null {
  try {
    const key = `${CACHE_PREFIX}${clinicId}_${date}`
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

export async function flushSyncQueue(activeClinicId: string): Promise<{ flushed: number; remaining: number }> {
  const queued = loadQueue()
  // The API derives its tenant from the active authenticated session, not from
  // a client-supplied clinicId. Never replay another clinic's queue under the
  // currently active clinic, and fail closed when the context is unavailable.
  if (!activeClinicId) return { flushed: 0, remaining: queued.length }
  if (flushing) return { flushed: 0, remaining: queued.length }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { flushed: 0, remaining: loadQueue().length }
  }
  flushing = true
  let flushed = 0
  try {
    const q = queued
    const remaining: SyncQueueItem[] = []
    for (const item of q) {
      if (item.payload.clinicId !== activeClinicId) {
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
  clinicId: string,
  onFlush?: (r: { flushed: number; remaining: number }) => void,
): () => void {
  const handler = async () => {
    const r = await flushSyncQueue(clinicId)
    onFlush?.(r)
  }
  window.addEventListener('online', handler)
  // Opportunistic flush
  void handler()
  return () => window.removeEventListener('online', handler)
}
