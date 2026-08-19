import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Beat } from './beats'
import { AudioPersona } from './audioPersona'

/**
 * Everything worth testing here is a failure path.
 *
 * The happy case — a file plays, `ended` fires, the line is over — is one
 * branch. The other four are the reasons a patient's presentation must keep
 * moving anyway: no audio was synthesised for this line, the browser has no
 * `Audio` at all, the file will not load, autoplay is refused until the patient
 * taps something. Each of those has to land on reading time, silently, and none
 * of them may leave the promise hanging — a hung promise stops the script dead
 * on one sentence, which is the one outcome worse than silence.
 */

const beat: Beat = {
  id: 'overview-1',
  actId: 'overview',
  order: 1,
  say: 'Здравствуйте, я расскажу о вашем плане лечения.',
  estimatedMs: 4000,
  stage: { scene: 'arches', camera: { focus: 'full_arches' } },
  refs: [],
}

/** A stand-in for `Audio` that never touches the network. */
class FakeAudio {
  static instances: FakeAudio[] = []
  static playBehaviour: 'resolve' | 'reject' = 'resolve'

  paused = false
  currentTime = 0
  playCalls = 0
  private listeners = new Map<string, Set<() => void>>()

  constructor(public readonly src: string) {
    FakeAudio.instances.push(this)
  }

  addEventListener(type: string, fn: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(fn)
  }

  removeEventListener(type: string, fn: () => void) {
    this.listeners.get(type)?.delete(fn)
  }

  emit(type: string) {
    for (const fn of [...(this.listeners.get(type) ?? [])]) fn()
  }

  /** How many handlers are still attached — proves cleanup actually happened. */
  listenerCount() {
    return [...this.listeners.values()].reduce((n, set) => n + set.size, 0)
  }

  play() {
    this.playCalls += 1
    return FakeAudio.playBehaviour === 'resolve'
      ? Promise.resolve()
      : Promise.reject(new Error('NotAllowedError: play() needs a user gesture'))
  }

  pause() {
    this.paused = true
  }
}

function withFakeAudio() {
  FakeAudio.instances = []
  FakeAudio.playBehaviour = 'resolve'
  vi.stubGlobal('Audio', FakeAudio as unknown as typeof Audio)
  return FakeAudio
}

/** Reading time collapses to zero so tests do not wait four seconds. */
function persona(urls: Array<{ beatId: string; audioUrl: string | null }> = []) {
  const p = new AudioPersona(() => null, { rate: 0 })
  p.setUrls(urls)
  return p
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('a line that has audio', () => {
  it('plays the file and ends when the file ends, not on a timer', async () => {
    const Fake = withFakeAudio()
    const p = persona([{ beatId: 'overview-1', audioUrl: 'https://s3.example/a.mp3' }])

    let done = false
    const spoken = p.speak(beat).then(() => {
      done = true
    })

    // One tick is enough for a timer-based persona to have finished at rate 0.
    await Promise.resolve()
    await Promise.resolve()
    expect(done).toBe(false)
    expect(Fake.instances).toHaveLength(1)
    expect(Fake.instances[0].src).toBe('https://s3.example/a.mp3')
    expect(Fake.instances[0].playCalls).toBe(1)

    Fake.instances[0].emit('ended')
    await spoken
    expect(done).toBe(true)
  })

  it('detaches its handlers when the line is over', async () => {
    const Fake = withFakeAudio()
    const p = persona([{ beatId: 'overview-1', audioUrl: 'https://s3.example/a.mp3' }])
    const spoken = p.speak(beat)
    await Promise.resolve()
    Fake.instances[0].emit('ended')
    await spoken
    expect(Fake.instances[0].listenerCount()).toBe(0)
  })
})

describe('every way there is no audio ends in reading time, not in an error', () => {
  it('falls back when no url was synthesised for this line', async () => {
    const Fake = withFakeAudio()
    await expect(persona().speak(beat)).resolves.toBeUndefined()
    expect(Fake.instances).toHaveLength(0)
  })

  it('falls back when the browser has no Audio at all', async () => {
    vi.stubGlobal('Audio', undefined)
    const p = persona([{ beatId: 'overview-1', audioUrl: 'https://s3.example/a.mp3' }])
    await expect(p.speak(beat)).resolves.toBeUndefined()
  })

  it('falls back when the file fails to load', async () => {
    const Fake = withFakeAudio()
    const p = persona([{ beatId: 'overview-1', audioUrl: 'https://s3.example/gone.mp3' }])
    const spoken = p.speak(beat)
    await Promise.resolve()
    Fake.instances[0].emit('error')
    await expect(spoken).resolves.toBeUndefined()
    expect(Fake.instances[0].listenerCount()).toBe(0)
  })

  it('falls back when autoplay is refused', async () => {
    const Fake = withFakeAudio()
    Fake.playBehaviour = 'reject'
    const p = persona([{ beatId: 'overview-1', audioUrl: 'https://s3.example/a.mp3' }])
    await expect(p.speak(beat)).resolves.toBeUndefined()
  })

  it('resolves only once when the file both errors and then ends', async () => {
    const Fake = withFakeAudio()
    const p = persona([{ beatId: 'overview-1', audioUrl: 'https://s3.example/a.mp3' }])
    let resolutions = 0
    const spoken = p.speak(beat).then(() => {
      resolutions += 1
    })
    await Promise.resolve()
    Fake.instances[0].emit('error')
    Fake.instances[0].emit('ended')
    await spoken
    expect(resolutions).toBe(1)
  })
})

describe('setUrls', () => {
  it('keeps a line silent rather than playing a null url', async () => {
    const Fake = withFakeAudio()
    const p = persona([{ beatId: 'overview-1', audioUrl: null }])
    await expect(p.speak(beat)).resolves.toBeUndefined()
    expect(Fake.instances).toHaveLength(0)
  })

  it('accumulates across acts instead of replacing the previous act', async () => {
    const Fake = withFakeAudio()
    const p = persona([{ beatId: 'overview-1', audioUrl: 'https://s3.example/a.mp3' }])
    p.setUrls([{ beatId: 'findings-1', audioUrl: 'https://s3.example/b.mp3' }])

    void p.speak(beat)
    await Promise.resolve()
    void p.speak({ ...beat, id: 'findings-1', actId: 'findings' })
    await Promise.resolve()

    expect(Fake.instances.map((a) => a.src)).toEqual([
      'https://s3.example/a.mp3',
      'https://s3.example/b.mp3',
    ])
  })
})

describe('transport', () => {
  it('pauses the element rather than letting it play under a patient question', async () => {
    const Fake = withFakeAudio()
    const p = persona([{ beatId: 'overview-1', audioUrl: 'https://s3.example/a.mp3' }])
    void p.speak(beat)
    await Promise.resolve()
    p.pause()
    expect(Fake.instances[0].paused).toBe(true)
  })

  it('abandons the element on resume, because the director replays the beat', async () => {
    const Fake = withFakeAudio()
    const p = persona([{ beatId: 'overview-1', audioUrl: 'https://s3.example/a.mp3' }])
    void p.speak(beat)
    await Promise.resolve()
    p.pause()
    p.resume()
    expect(Fake.instances[0].paused).toBe(true)
    expect(Fake.instances[0].currentTime).toBe(0)
    expect(Fake.instances[0].listenerCount()).toBe(0)

    // Replaying starts a fresh element rather than resuming mid-sentence.
    void p.speak(beat)
    await Promise.resolve()
    expect(Fake.instances).toHaveLength(2)
  })

  it('stops the element when the screen unmounts', async () => {
    const Fake = withFakeAudio()
    const p = persona([{ beatId: 'overview-1', audioUrl: 'https://s3.example/a.mp3' }])
    void p.speak(beat)
    await Promise.resolve()
    p.stop()
    expect(Fake.instances[0].paused).toBe(true)
    expect(Fake.instances[0].listenerCount()).toBe(0)
  })

  it('does not leave the previous line playing when the next one starts', async () => {
    const Fake = withFakeAudio()
    const p = persona([
      { beatId: 'overview-1', audioUrl: 'https://s3.example/a.mp3' },
      { beatId: 'overview-2', audioUrl: 'https://s3.example/b.mp3' },
    ])
    void p.speak(beat)
    await Promise.resolve()
    void p.speak({ ...beat, id: 'overview-2', order: 2 })
    await Promise.resolve()
    expect(Fake.instances[0].paused).toBe(true)
    expect(Fake.instances[1].paused).toBe(false)
  })
})
