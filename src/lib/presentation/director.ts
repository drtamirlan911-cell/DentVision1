/**
 * The presentation director — plain TypeScript, no React, no DOM, no audio.
 *
 * This is where vendor independence actually lives. The director walks acts and
 * beats, tells the visualization where to look and the persona what to say, and
 * handles being interrupted. It knows nothing about *how* either of those is
 * implemented, so today's silent text persona, tomorrow's synthesised voice and
 * a photoreal avatar after that are all the same three methods.
 *
 * Being free of the DOM is not an accident: the ordering, the pause/resume
 * behaviour around a patient's question, and the fallback when a beat has no
 * audio are the parts worth testing, and they are all testable here with two
 * fakes and no browser.
 */

import type { Beat, PresentationScript, StageDirection } from './beats'

/** Whatever is currently speaking: text on screen, an audio file, a face. */
export interface PersonaChannel {
  /** Resolves when the line has finished being delivered. */
  speak(beat: Beat): Promise<void>
  pause(): void
  resume(): void
  stop(): void
}

export interface VisualizationContext {
  reducedMotion: boolean
}

/** Whatever is being looked at: the 2D arches today, a 3D scene later. */
export interface VisualizationSurface {
  apply(direction: StageDirection, ctx: VisualizationContext): void
  readonly capabilities: { camera3d: boolean; occlusalView: boolean; animation: boolean }
}

export type DirectorStatus = 'idle' | 'playing' | 'paused' | 'interrupted' | 'finished'

export interface DirectorState {
  status: DirectorStatus
  actIndex: number
  beatIndex: number
  beat: Beat | null
  /** Position across the whole script, for a progress indicator. */
  progress: { current: number; total: number }
}

export interface DirectorEvents {
  onState?: (state: DirectorState) => void
  onBeat?: (beat: Beat) => void
  onFinished?: () => void
}

export class PresentationDirector {
  private readonly beats: Beat[]
  private readonly actIndexOf: number[]
  private cursor = -1
  private status: DirectorStatus = 'idle'
  /** Bumped on every stop/restart so a stale `speak` cannot advance the script. */
  private runToken = 0

  constructor(
    private readonly script: PresentationScript,
    private readonly persona: PersonaChannel,
    private readonly surface: VisualizationSurface,
    private readonly ctx: VisualizationContext,
    private readonly events: DirectorEvents = {},
  ) {
    this.beats = []
    this.actIndexOf = []
    script.acts.forEach((act, actIndex) => {
      for (const beat of act.beats) {
        this.beats.push(beat)
        this.actIndexOf.push(actIndex)
      }
    })
  }

  get state(): DirectorState {
    const beat = this.cursor >= 0 ? this.beats[this.cursor] ?? null : null
    return {
      status: this.status,
      actIndex: this.cursor >= 0 ? this.actIndexOf[this.cursor] ?? 0 : 0,
      beatIndex: this.cursor,
      beat,
      progress: { current: Math.max(0, this.cursor + 1), total: this.beats.length },
    }
  }

  private emit() {
    this.events.onState?.(this.state)
  }

  /** Play from the beginning, or from wherever `seek` left the cursor. */
  async play(): Promise<void> {
    if (this.status === 'playing') return
    const token = ++this.runToken
    this.status = 'playing'
    this.emit()

    while (this.status === 'playing' && this.cursor + 1 < this.beats.length) {
      this.cursor += 1
      const beat = this.beats[this.cursor]

      // Direction first, then speech: the patient should be looking at the
      // right tooth by the time the sentence about it starts.
      this.surface.apply(beat.stage, this.ctx)
      this.events.onBeat?.(beat)
      this.emit()

      await this.persona.speak(beat)

      // A stop() or interrupt() during `speak` invalidates this run — without
      // this the script would carry on underneath a patient's question.
      if (token !== this.runToken) return
    }

    if (token === this.runToken && this.cursor + 1 >= this.beats.length) {
      this.status = 'finished'
      this.emit()
      this.events.onFinished?.()
    }
  }

  pause(): void {
    if (this.status !== 'playing') return
    this.status = 'paused'
    this.runToken += 1
    this.persona.pause()
    this.emit()
  }

  resume(): void {
    if (this.status !== 'paused' && this.status !== 'interrupted') return
    this.persona.resume()
    // Replay the beat the patient was on rather than skipping it: they asked a
    // question in the middle of it and have not heard the end.
    this.cursor -= 1
    this.status = 'idle'
    void this.play()
  }

  /**
   * The patient asked something. Everything stops where it is — the concept is
   * explicit that they must be able to cut in, and resuming afterwards must not
   * lose their place.
   */
  interrupt(): void {
    if (this.status === 'finished') return
    this.status = 'interrupted'
    this.runToken += 1
    this.persona.pause()
    this.emit()
  }

  /** Jump to the first beat of an act — what the act rail does. */
  seekToAct(actIndex: number): void {
    const target = this.actIndexOf.indexOf(actIndex)
    if (target < 0) return
    this.runToken += 1
    this.persona.stop()
    this.cursor = target - 1
    this.status = 'idle'
    void this.play()
  }

  stop(): void {
    this.runToken += 1
    this.status = 'idle'
    this.persona.stop()
    this.emit()
  }

  /** Show the whole script at rest, without playing it. */
  showAll(): void {
    this.runToken += 1
    this.status = 'finished'
    this.cursor = this.beats.length - 1
    this.persona.stop()
    this.emit()
  }
}
