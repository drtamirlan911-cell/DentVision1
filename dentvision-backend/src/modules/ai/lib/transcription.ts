/**
 * Server-side speech-to-text for chairside dictation.
 *
 * Dictation has run on the browser's Web Speech API: free, on-device, and
 * absent in Firefox — where the microphone button simply does not appear. This
 * gives those browsers a path, and gives every browser a second opinion when
 * the on-device recogniser mishears a tooth number.
 *
 * The transcript is only text. It goes into the same `parseDictation` the
 * typed path already uses, so nothing downstream has to know where the words
 * came from.
 */

import { env } from '../../../config.js';
import { resolveModels } from './modelCatalog.js';

const TRANSCRIPTION_URL = 'https://api.openai.com/v1/audio/transcriptions';
const REQUEST_TIMEOUT_MS = 60_000;
/** Provider cap on a single audio file. */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export const ALLOWED_AUDIO_TYPES = new Set([
  'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav',
  'audio/x-wav', 'audio/mp3', 'audio/m4a', 'audio/x-m4a', 'video/webm',
]);

export type TranscriptionFailure =
  | 'NO_KEY'
  | 'TOO_LARGE'
  | 'UNSUPPORTED_TYPE'
  | 'EMPTY'
  | 'PROVIDER_ERROR';

export type TranscriptionFailed = { ok: false; reason: TranscriptionFailure; error: string };

export type TranscriptionResult =
  | { ok: true; text: string; model: string }
  | TranscriptionFailed;

/**
 * Explicit predicate rather than `if (!result.ok)`: this package compiles
 * without `strictNullChecks`, where narrowing a boolean-discriminated union is
 * unreliable. Same reason as `os/imageConsent.ts`.
 */
export function isTranscriptionFailed(r: TranscriptionResult): r is TranscriptionFailed {
  return r.ok === false;
}

export const TRANSCRIPTION_MESSAGE: Record<TranscriptionFailure, string> = {
  NO_KEY: 'Распознавание речи не настроено',
  TOO_LARGE: 'Запись слишком длинная — до 25 МБ',
  UNSUPPORTED_TYPE: 'Неподдерживаемый формат аудио',
  EMPTY: 'Пустая запись',
  PROVIDER_ERROR: 'Не удалось распознать речь — попробуйте ещё раз',
};

export async function transcribeAudio(input: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  /** BCP-47 hint; the clinic works in ru/kk/en. */
  language?: string;
}): Promise<TranscriptionResult> {
  if (!env.OPENAI_API_KEY) {
    return { ok: false, reason: 'NO_KEY', error: TRANSCRIPTION_MESSAGE.NO_KEY };
  }
  if (!input.buffer?.length) {
    return { ok: false, reason: 'EMPTY', error: TRANSCRIPTION_MESSAGE.EMPTY };
  }
  if (input.buffer.length > MAX_AUDIO_BYTES) {
    return { ok: false, reason: 'TOO_LARGE', error: TRANSCRIPTION_MESSAGE.TOO_LARGE };
  }
  // The mime type can carry a codec suffix (`audio/webm;codecs=opus`).
  const baseType = String(input.mimeType || '').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_AUDIO_TYPES.has(baseType)) {
    return { ok: false, reason: 'UNSUPPORTED_TYPE', error: TRANSCRIPTION_MESSAGE.UNSUPPORTED_TYPE };
  }

  const { transcription: model } = await resolveModels({
    apiKey: env.OPENAI_API_KEY,
    envFull: env.OPENAI_MODEL,
    envMini: env.OPENAI_MODEL_MINI,
  });

  // Multipart, so this cannot go through `providerFetch`, which sends JSON.
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(input.buffer)], { type: baseType }), input.filename || 'audio.webm');
  form.append('model', model);
  if (input.language) form.append('language', input.language);
  // Dental vocabulary the recogniser would otherwise mangle into ordinary words.
  form.append(
    'prompt',
    'Стоматологический приём. Номера зубов по FDI. Термины: кариес, пульпит, периодонтит, ' +
      'коронка, имплант, винир, эндодонтия, окклюзионная, медиальная, дистальная, вестибулярная, нёбная.',
  );

  try {
    const res = await fetch(TRANSCRIPTION_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[transcription] provider rejected:', res.status, detail.slice(0, 200));
      return { ok: false, reason: 'PROVIDER_ERROR', error: TRANSCRIPTION_MESSAGE.PROVIDER_ERROR };
    }
    const payload = (await res.json()) as { text?: string };
    const text = String(payload.text || '').trim();
    if (!text) {
      return { ok: false, reason: 'EMPTY', error: TRANSCRIPTION_MESSAGE.EMPTY };
    }
    return { ok: true, text, model };
  } catch (error) {
    console.error('[transcription] request failed:', error);
    return { ok: false, reason: 'PROVIDER_ERROR', error: TRANSCRIPTION_MESSAGE.PROVIDER_ERROR };
  }
}
