import type { Beat } from './beats'
import type { PersonaChannel } from './director'
import { SilentPersona, type SilentPersonaOptions } from './silentPersona'

/**
 * The persona with a voice: play the synthesised line, and fall back to reading
 * time whenever there is nothing to play.
 *
 * The fallback is not an error path, it is the normal one whenever storage is
 * unconfigured, the provider is down, the character budget is spent, or the
 * browser simply refuses the file. In every one of those cases the presentation
 * keeps running silently and the patient is never shown a failure — so this
 * class holds a `SilentPersona` and delegates to it rather than reimplementing
 * timing that has to work anyway.
 */
export class AudioPersona implements PersonaChannel {
  private readonly silent: SilentPersona
  private audio: HTMLAudioElement | null = null
  private urls = new Map<string, string>()
  private cleanup: (() => void) | null = null

  constructor(
    /** Resolves audio for a beat, or `null` when there is none. */
    private readonly urlFor: (beat: Beat) => string | null | undefined = () => null,
    /** Passed straight to the fallback persona, so tests need not wait in real time. */
    silentOptions: SilentPersonaOptions = {},
  ) {
    this.silent = new SilentPersona(silentOptions)
  }

  /** Feed in URLs as acts are fetched; unknown beats simply stay silent. */
  setUrls(entries: Array<{ beatId: string; audioUrl: string | null }>): void {
    for (const entry of entries) {
      if (entry.audioUrl) this.urls.set(entry.beatId, entry.audioUrl)
    }
  }

  private resolveUrl(beat: Beat): string | null {
    return this.urls.get(beat.id) ?? this.urlFor(beat) ?? null
  }

  speak(beat: Beat): Promise<void> {
    const url = this.resolveUrl(beat)
    if (!url || typeof Audio === 'undefined') return this.silent.speak(beat)

    this.stopAudio()
    const audio = new Audio(url)
    this.audio = audio

    return new Promise<void>((resolve) => {
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        this.detach()
        resolve()
      }

      const onEnded = () => finish()
      // A file that will not load must not strand the presentation: fall
      // through to the reading-time path for this line and carry on.
      const onError = () => {
        if (settled) return
        settled = true
        this.detach()
        void this.silent.speak(beat).then(resolve)
      }

      audio.addEventListener('ended', onEnded)
      audio.addEventListener('error', onError)
      this.cleanup = () => {
        audio.removeEventListener('ended', onEnded)
        audio.removeEventListener('error', onError)
      }

      // Autoplay can be refused until the patient has interacted with the page;
      // that is a silent line, not a broken presentation.
      void audio.play().catch(onError)
    })
  }

  pause(): void {
    this.audio?.pause()
    this.silent.pause()
  }

  resume(): void {
    // The director replays the interrupted beat from its start, so the element
    // in flight is abandoned rather than resumed mid-sentence.
    this.stopAudio()
    this.silent.resume()
  }

  stop(): void {
    this.stopAudio()
    this.silent.stop()
  }

  private detach(): void {
    this.cleanup?.()
    this.cleanup = null
  }

  private stopAudio(): void {
    this.detach()
    if (!this.audio) return
    try {
      this.audio.pause()
      this.audio.currentTime = 0
    } catch {
      // A detached element can refuse both; nothing here is worth surfacing.
    }
    this.audio = null
  }
}
