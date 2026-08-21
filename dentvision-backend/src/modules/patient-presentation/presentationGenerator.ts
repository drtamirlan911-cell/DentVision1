/**
 * The one place a model is allowed to touch a patient's presentation.
 *
 * This function does exactly one thing: ask a model to rephrase each beat's
 * `say`/`saySimple`, and nothing else. It never decides what ships — every
 * candidate it returns still has to win `scriptValidator.ts::applyRewrite`,
 * which rejects anything that adds a number, a tooth, a diagnosis or a
 * promise the template did not already state. If the request fails, the
 * response is empty, or it cannot be parsed, this returns `null` and the
 * caller keeps the deterministic template — a quiet model failure and a
 * malicious one degrade the same way.
 *
 * Quoted beats (`isVerbatimQuote`) are never sent to the model at all: the
 * validator would refuse any change to them, so there is nothing to gain by
 * asking, and one less place the doctor's own words pass through a model.
 */

import { simpleChat } from '../ai/llm/client.js';
import { isVerbatimQuote, type Beat, type PresentationLocale, type PresentationScript } from './beats.js';

export interface BeatCandidate {
  say: string;
  saySimple?: string;
}

const LOCALE_NAME: Record<PresentationLocale, string> = {
  ru: 'русском',
  kk: 'қазақ',
  en: 'English',
};

function buildInstructions(locale: PresentationLocale): string {
  return [
    'Ты переписываешь реплики сценария презентации плана лечения для пациента стоматологической клиники.',
    'На вход подаётся JSON-массив реплик: [{"id": "...", "say": "...", "saySimple": "..." или null}].',
    'Для каждой реплики верни более естественную, живую формулировку — меняй только стиль и порядок слов.',
    'СТРОГО ЗАПРЕЩЕНО добавлять любые числа, суммы, номера зубов, названия диагнозов, обещания результата, сроков или гарантий, которых нет в исходном тексте этой же реплики.',
    'Не меняй смысл, не добавляй факты, не удаляй информацию, не объединяй и не разбивай реплики.',
    `Пиши на ${LOCALE_NAME[locale] ?? 'русском'} языке.`,
    'Ответь СТРОГО JSON-массивом той же длины и в том же порядке, без какого-либо текста до или после: [{"id": "...", "say": "...", "saySimple": "..." или null}]. Если у реплики не было saySimple, верни null.',
  ].join('\n');
}

/** Pulls the JSON array out of a response that may be wrapped in prose or a code fence. */
function extractJsonArray(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('[');
  const end = body.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) return body;
  return body.slice(start, end + 1);
}

function allBeats(script: PresentationScript): Beat[] {
  return script.acts.flatMap((act) => act.beats);
}

/**
 * Ask a model to rephrase every rewritable beat in one call.
 *
 * `null` means "no rewrite happened" (no API key, request failed, response
 * unusable) — a complete, safe template script either way. An empty `Map`
 * means the call succeeded but there was nothing to rewrite (no beats
 * eligible), which is a normal outcome for a very short plan.
 */
export async function rewriteScript(script: PresentationScript): Promise<Map<string, BeatCandidate> | null> {
  const rewritable = allBeats(script).filter((b) => !isVerbatimQuote(b));
  if (rewritable.length === 0) return new Map();

  const input = JSON.stringify(
    rewritable.map((b) => ({ id: b.id, say: b.say, saySimple: b.saySimple ?? null })),
  );

  let raw: string;
  try {
    raw = await simpleChat(buildInstructions(script.locale), input, { maxTokens: 4000 });
  } catch (error) {
    console.warn('[Presentation] LLM rewrite request failed; keeping template', error);
    return null;
  }
  if (!raw || !raw.trim()) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonArray(raw));
  } catch {
    console.warn('[Presentation] LLM rewrite returned unparsable output; keeping template');
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const out = new Map<string, BeatCandidate>();
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') continue;
    const id = String((entry as Record<string, unknown>).id ?? '').trim();
    const say = String((entry as Record<string, unknown>).say ?? '').trim();
    if (!id || !say) continue;
    const saySimpleRaw = (entry as Record<string, unknown>).saySimple;
    const saySimple = typeof saySimpleRaw === 'string' ? saySimpleRaw.trim() : '';
    out.set(id, saySimple ? { say, saySimple } : { say });
  }
  return out;
}
