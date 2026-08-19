/**
 * The persona with no voice: the line appears on screen and holds for as long
 * as it would take to read.
 *
 * This is the phase-2 renderer and also the permanent fallback. When synthesis
 * is unavailable — no storage configured, the provider down, the audio element
 * refusing to load — the presentation must still run, silently, without ever
 * showing the patient an error. So the timing path is the one that always
 * works, and audio becomes an enhancement layered on top rather than a
 * dependency.
 */

import type { Beat } from './beats'
import type { PersonaChannel } from './director'

export interface SilentPersonaOptions {
  /** Speed multiplier; 0 plays the whole script instantly (used by tests). */
  rate?: number
  /** Injectable clock, so tests do not wait in real time. */
  setTimeoutFn?: (fn: () => void, ms: number) => unknown
  clearTimeoutFn?: (handle: unknown) => void
}

export class SilentPersona implements PersonaChannel {
  private handle: unknown = null
  private resolveCurrent: (() => void) | null = null
  private remainingMs = 0
  private startedAt = 0
  private paused = false

  private readonly rate: number
  private readonly setTimeoutFn: (fn: () => void, ms: number) => unknown
  private readonly clearTimeoutFn: (handle: unknown) => void

  constructor(options: SilentPersonaOptions = {}) {
    this.rate = options.rate ?? 1
    this.setTimeoutFn =
      options.setTimeoutFn ?? ((fn, ms) => setTimeout(fn, ms) as unknown)
    this.clearTimeoutFn = options.clearTimeoutFn ?? ((handle) => clearTimeout(handle as never))
  }

  speak(beat: Beat): Promise<void> {
    this.clear()
    const duration = this.rate === 0 ? 0 : Math.round(beat.estimatedMs / this.rate)
    if (duration === 0) return Promise.resolve()

    return new Promise<void>((resolve) => {
      this.resolveCurrent = resolve
      this.remainingMs = duration
      this.startedAt = Date.now()
      this.handle = this.setTimeoutFn(() => {
        this.handle = null
        this.resolveCurrent = null
        resolve()
      }, duration)
    })
  }

  pause(): void {
    if (this.paused || this.handle === null) return
    this.paused = true
    // Keep what is left so resume() finishes the line instead of restarting it.
    this.remainingMs = Math.max(0, this.remainingMs - (Date.now() - this.startedAt))
    this.clearTimeoutFn(this.handle)
    this.handle = null
  }

  resume(): void {
    if (!this.paused) return
    this.paused = false
    // The director replays the interrupted beat from its start, so a pending
    // promise here would resolve into a run that no longer exists. Drop it.
    this.resolveCurrent = null
  }

  stop(): void {
    this.clear()
    this.paused = false
  }

  private clear(): void {
    if (this.handle !== null) {
      this.clearTimeoutFn(this.handle)
      this.handle = null
    }
    this.resolveCurrent = null
    this.remainingMs = 0
  }
}
