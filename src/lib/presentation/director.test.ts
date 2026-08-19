import { describe, expect, it, vi } from 'vitest'

import type { Beat, PresentationScript, StageDirection } from './beats'
import {
  PresentationDirector,
  type PersonaChannel,
  type VisualizationSurface,
} from './director'
import { SilentPersona } from './silentPersona'

/**
 * The director is the piece that has to keep working when the persona changes
 * from text to a voice to a face, so it is tested against fakes rather than
 * against any of them. No DOM, no audio, no timers running in real time.
 */

function beat(actId: Beat['actId'], order: number, teeth: number[] = []): Beat {
  return {
    id: `${actId}-${order}`,
    actId,
    order,
    say: `Реплика ${actId} ${order}.`,
    estimatedMs: 3000,
    stage: {
      scene: teeth.length ? 'tooth_focus' : 'arches',
      highlightTeeth: teeth,
      camera: { focus: teeth.length ? 'teeth' : 'full_arches' },
    },
    refs: [],
  }
}

const SCRIPT: PresentationScript = {
  version: 1,
  locale: 'ru',
  releaseId: 'rel-1',
  personaName: 'Aura',
  acts: [
    { id: 'overview', title: 'Обзор', beats: [beat('overview', 1), beat('overview', 2)] },
    { id: 'findings', title: 'Находки', beats: [beat('findings', 1, [16]), beat('findings', 2, [24, 25])] },
    { id: 'solution', title: 'Решение', beats: [beat('solution', 1)] },
  ],
}

class FakePersona implements PersonaChannel {
  spoken: string[] = []
  paused = 0
  resumed = 0
  stopped = 0
  private pending: (() => void) | null = null
  /**
   * Every resolver ever handed out, kept even after the director moves on —
   * so a test can resolve a line the director has *abandoned* and prove that
   * doing so advances nothing.
   */
  private readonly resolvers: Array<{ id: string; resolve: () => void }> = []

  speak(b: Beat): Promise<void> {
    this.spoken.push(b.id)
    return new Promise<void>((resolve) => {
      this.pending = resolve
      this.resolvers.push({ id: b.id, resolve })
    })
  }

  /** Let the current line finish, the way a real one would. */
  finish(): Promise<void> {
    const resolve = this.pending
    this.pending = null
    resolve?.()
    return Promise.resolve()
  }

  /** Resolve one specific line, current or long abandoned. */
  finishNth(index: number): Promise<void> {
    this.resolvers[index]?.resolve()
    return Promise.resolve()
  }

  get isSpeaking(): boolean {
    return this.pending !== null
  }

  pause() { this.paused += 1 }
  resume() { this.resumed += 1 }
  stop() { this.stopped += 1; this.pending = null }
}

class FakeSurface implements VisualizationSurface {
  applied: StageDirection[] = []
  readonly capabilities = { camera3d: false, occlusalView: false, animation: true }
  apply(d: StageDirection) { this.applied.push(d) }
}

function makeDirector(events = {}) {
  const persona = new FakePersona()
  const surface = new FakeSurface()
  const director = new PresentationDirector(SCRIPT, persona, surface, { reducedMotion: false }, events)
  return { director, persona, surface }
}

/** Drive the script to completion, letting each line finish in turn. */
async function playThrough(persona: FakePersona, steps = 10) {
  for (let i = 0; i < steps; i += 1) {
    await Promise.resolve()
    if (!persona.isSpeaking) break
    await persona.finish()
    await Promise.resolve()
  }
}

describe('playback order', () => {
  it('walks every beat of every act, in order', async () => {
    const { director, persona } = makeDirector()
    const run = director.play()
    await playThrough(persona)
    await run
    expect(persona.spoken).toEqual([
      'overview-1', 'overview-2', 'findings-1', 'findings-2', 'solution-1',
    ])
  })

  it('directs the visualization before speaking, not after', async () => {
    const { director, persona, surface } = makeDirector()
    void director.play()
    await Promise.resolve()
    // One direction applied, one line started — the patient is already looking
    // at the right place when the sentence about it begins.
    expect(surface.applied).toHaveLength(1)
    expect(persona.spoken).toHaveLength(1)
  })

  it('passes each beat its own stage direction', async () => {
    const { director, persona, surface } = makeDirector()
    const run = director.play()
    await playThrough(persona)
    await run
    expect(surface.applied[2].highlightTeeth).toEqual([16])
    expect(surface.applied[3].highlightTeeth).toEqual([24, 25])
  })

  it('reports progress across the whole script, not per act', async () => {
    const { director, persona } = makeDirector()
    void director.play()
    await Promise.resolve()
    expect(director.state.progress).toEqual({ current: 1, total: 5 })
    await persona.finish()
    await Promise.resolve()
    expect(director.state.progress.current).toBe(2)
  })

  it('finishes exactly once', async () => {
    const onFinished = vi.fn()
    const { director, persona } = makeDirector({ onFinished })
    const run = director.play()
    await playThrough(persona)
    await run
    expect(onFinished).toHaveBeenCalledTimes(1)
    expect(director.state.status).toBe('finished')
  })
})

describe('the patient can cut in', () => {
  it('stops the script where it stands', async () => {
    const { director, persona } = makeDirector()
    void director.play()
    await Promise.resolve()
    await persona.finish()
    await Promise.resolve()
    expect(persona.spoken).toHaveLength(2)

    director.interrupt()
    expect(director.state.status).toBe('interrupted')
    expect(persona.paused).toBe(1)

    // The line that was in flight must not advance the script underneath the
    // question — this is the bug the run token exists to prevent.
    await persona.finish()
    await Promise.resolve()
    expect(persona.spoken).toHaveLength(2)
  })

  it('resumes by replaying the beat it was interrupted on', async () => {
    const { director, persona } = makeDirector()
    void director.play()
    await Promise.resolve()
    await persona.finish()
    await Promise.resolve()
    const interruptedOn = director.state.beat!.id
    director.interrupt()

    director.resume()
    await Promise.resolve()
    // Not skipped: the patient asked a question halfway through and has not
    // heard the end of it.
    expect(persona.spoken[persona.spoken.length - 1]).toBe(interruptedOn)
    expect(persona.resumed).toBe(1)
  })

  it('ignores an interrupt after the script has finished', async () => {
    const { director, persona } = makeDirector()
    const run = director.play()
    await playThrough(persona)
    await run
    director.interrupt()
    expect(director.state.status).toBe('finished')
  })
})

describe('pause and resume', () => {
  it('pauses and picks the same beat back up', async () => {
    const { director, persona } = makeDirector()
    void director.play()
    await Promise.resolve()
    const on = director.state.beat!.id

    director.pause()
    expect(director.state.status).toBe('paused')
    expect(persona.paused).toBe(1)

    director.resume()
    await Promise.resolve()
    expect(persona.spoken[persona.spoken.length - 1]).toBe(on)
  })

  it('does nothing when asked to pause while not playing', () => {
    const { director, persona } = makeDirector()
    director.pause()
    expect(persona.paused).toBe(0)
    expect(director.state.status).toBe('idle')
  })
})

describe('jumping between acts', () => {
  it('seeks to the first beat of the requested act', async () => {
    const { director, persona } = makeDirector()
    director.seekToAct(2)
    await Promise.resolve()
    expect(persona.spoken).toEqual(['solution-1'])
  })

  it('abandons the line in flight rather than letting it resolve into the jump', async () => {
    const { director, persona } = makeDirector()
    void director.play()
    await Promise.resolve()
    director.seekToAct(1)
    await Promise.resolve()
    expect(persona.spoken).toEqual(['overview-1', 'findings-1'])

    // Now resolve the *abandoned* overview-1 line. Without the run token this
    // would push the old run forward and play overview-2 on top of the jump.
    await persona.finishNth(0)
    await Promise.resolve()
    expect(persona.spoken).toEqual(['overview-1', 'findings-1'])
  })

  it('ignores an act that does not exist', () => {
    const { director, persona } = makeDirector()
    director.seekToAct(99)
    expect(persona.spoken).toEqual([])
  })
})

describe('showAll', () => {
  it('puts the whole script at rest without playing it', () => {
    const { director, persona } = makeDirector()
    director.showAll()
    expect(persona.spoken).toEqual([])
    expect(director.state.status).toBe('finished')
    expect(director.state.progress).toEqual({ current: 5, total: 5 })
  })
})

describe('SilentPersona', () => {
  it('holds each line for its estimated reading time', async () => {
    let scheduled: number | null = null
    const persona = new SilentPersona({
      setTimeoutFn: (fn, ms) => {
        scheduled = ms
        fn()
        return 1
      },
      clearTimeoutFn: () => {},
    })
    await persona.speak(beat('overview', 1))
    expect(scheduled).toBe(3000)
  })

  it('resolves instantly at rate 0, so tests never wait', async () => {
    const persona = new SilentPersona({ rate: 0 })
    await expect(persona.speak(beat('overview', 1))).resolves.toBeUndefined()
  })

  it('drives the director to the end with no timers at all', async () => {
    const surface = new FakeSurface()
    const director = new PresentationDirector(
      SCRIPT,
      new SilentPersona({ rate: 0 }),
      surface,
      { reducedMotion: true },
    )
    await director.play()
    expect(director.state.status).toBe('finished')
    expect(surface.applied).toHaveLength(5)
  })

  it('clears its timer when stopped', () => {
    const clearTimeoutFn = vi.fn()
    const persona = new SilentPersona({ setTimeoutFn: () => 42, clearTimeoutFn })
    void persona.speak(beat('overview', 1))
    persona.stop()
    expect(clearTimeoutFn).toHaveBeenCalledWith(42)
  })
})
