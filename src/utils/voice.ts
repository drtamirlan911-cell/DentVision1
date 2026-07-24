/**
 * Voice Agent (client) — Spec §15.10 Communication Layer.
 *
 * Speech-to-text uses the browser's Web Speech API (ru-RU), text-to-speech
 * uses speechSynthesis. Both run fully on-device: no audio ever leaves the
 * browser, which keeps clinic conversations private and adds zero latency
 * or API cost.
 */

export interface VoiceRecognitionHandle {
  stop: () => void
}

export interface RecognitionCallbacks {
  /** Fires with the accumulating transcript while the user speaks. */
  onInterim: (transcript: string) => void
  /** Fires once with the final phrase when the user stops speaking. */
  onFinal: (transcript: string) => void
  onEnd: () => void
  onError: (error: string) => void
}

type SpeechRecognitionCtor = new () => {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null
  onend: (() => void) | null
  onerror: ((event: { error?: string }) => void) | null
  start: () => void
  stop: () => void
}

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function voiceInputSupported(): boolean {
  return typeof window !== 'undefined' && getRecognitionCtor() !== null
}

export function voiceOutputSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function startRecognition(callbacks: RecognitionCallbacks): VoiceRecognitionHandle | null {
  const Ctor = getRecognitionCtor()
  if (!Ctor) {
    callbacks.onError('Браузер не поддерживает распознавание речи')
    return null
  }

  const recognition = new Ctor()
  recognition.lang = 'ru-RU'
  recognition.interimResults = true
  recognition.continuous = false

  let finalTranscript = ''

  recognition.onresult = (event) => {
    let interim = ''
    finalTranscript = ''
    for (let i = 0; i < event.results.length; i++) {
      const result = event.results[i]
      if (result.isFinal) finalTranscript += result[0].transcript
      else interim += result[0].transcript
    }
    callbacks.onInterim((finalTranscript + interim).trim())
  }

  recognition.onend = () => {
    const phrase = finalTranscript.trim()
    if (phrase) callbacks.onFinal(phrase)
    callbacks.onEnd()
  }

  recognition.onerror = (event) => {
    const code = event.error || 'unknown'
    const message =
      code === 'not-allowed' || code === 'service-not-allowed'
        ? 'Доступ к микрофону запрещён — разрешите его в настройках браузера'
        : code === 'no-speech'
          ? 'Речь не распознана — попробуйте ещё раз'
          : 'Ошибка распознавания речи'
    callbacks.onError(message)
  }

  try {
    recognition.start()
  } catch {
    callbacks.onError('Не удалось запустить распознавание')
    return null
  }

  return { stop: () => { try { recognition.stop() } catch { /* already stopped */ } } }
}

// ─── Text-to-speech ───

const VOICE_PREF_KEY = 'dv_voice_replies'

export function isVoiceRepliesEnabled(): boolean {
  try { return localStorage.getItem(VOICE_PREF_KEY) === '1' } catch { return false }
}

export function setVoiceRepliesEnabled(enabled: boolean): void {
  try { localStorage.setItem(VOICE_PREF_KEY, enabled ? '1' : '0') } catch { /* ignore */ }
  if (!enabled) stopSpeaking()
}

function pickRussianVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find((v) => v.lang === 'ru-RU' && v.localService) ||
    voices.find((v) => v.lang === 'ru-RU') ||
    voices.find((v) => v.lang.startsWith('ru')) ||
    null
  )
}

/** Strip markdown/emoji so TTS reads clean prose. */
function toSpeakable(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_#>`|]/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1200)
}

export interface SpeakOptions {
  /** Called when speech finishes (or is cancelled / fails). */
  onEnd?: () => void
}

export function speak(text: string, options: SpeakOptions = {}): void {
  if (!voiceOutputSupported()) {
    options.onEnd?.()
    return
  }
  const clean = toSpeakable(text)
  if (!clean) {
    options.onEnd?.()
    return
  }

  const run = () => {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(clean)
    utterance.lang = 'ru-RU'
    utterance.rate = 1.05
    const voice = pickRussianVoice()
    if (voice) utterance.voice = voice
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      options.onEnd?.()
    }
    utterance.onend = finish
    utterance.onerror = finish
    window.speechSynthesis.speak(utterance)
  }

  // Chrome loads voices asynchronously; wait once if the list is still empty.
  if (window.speechSynthesis.getVoices().length === 0) {
    const once = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', once)
      run()
    }
    window.speechSynthesis.addEventListener('voiceschanged', once)
    // Fallback if voiceschanged never fires.
    setTimeout(() => {
      window.speechSynthesis.removeEventListener('voiceschanged', once)
      if (!window.speechSynthesis.speaking) run()
    }, 400)
    return
  }

  run()
}

export function stopSpeaking(): void {
  if (voiceOutputSupported()) window.speechSynthesis.cancel()
}
