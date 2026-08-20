/**
 * What happens if a finding is left alone — written once, by a clinician, never
 * by a model.
 *
 * "Problem → consequence" is a prognosis. Even "may progress" is a clinical
 * statement about a specific person, and the moment a language model authors
 * one, the clinic is answering for a sentence no clinician wrote. So this file
 * is a fixed library: entries are keyed by `(status, urgency)`, versioned, and
 * a beat may only **quote** one — and only when the frozen plan really records
 * that finding. A later LLM pass may rephrase the wording under the validator;
 * it may never author an entry or apply one to a finding that is not there.
 *
 * Two rules the wording itself has to keep, and which the tests enforce:
 *
 *   - **General, not personal.** Every line describes what the condition does
 *     in general, not what will happen to this patient. The disclaimer beat
 *     that closes the act says so out loud.
 *   - **No frightening, no promising.** No tooth loss imagery, no cancer, no
 *     "danger to life", and equally no "guaranteed", "forever", "100%",
 *     "painless". A patient scared into treatment is a complaint waiting to
 *     happen, and a patient promised an outcome is a lawsuit waiting to happen.
 *
 * Bumping a `version` is how an edit is made visible: released presentations
 * carry the version they quoted, so a change to this file cannot silently
 * rewrite what a patient was already shown.
 */

import type { FindingUrgency } from '../../lib/treatmentPlanShape.js';
import type { PresentationLocale } from './beats.js';

export interface ConsequenceEntry {
  /** `${status}:${urgency}` — the key a beat's ref carries. */
  key: string;
  status: string;
  urgency: FindingUrgency;
  version: string;
  text: Record<PresentationLocale, string>;
}

const ENTRIES: ConsequenceEntry[] = [
  {
    key: 'caries:medium',
    status: 'caries',
    urgency: 'medium',
    version: '1',
    text: {
      ru: 'Кариес сам не проходит. Пока он небольшой, лечение обычно проще и дешевле, чем когда полость доходит до нерва.',
      kk: 'Тіс жегісі өздігінен кетпейді. Ол кішкентай кезінде емдеу әдетте жүйкеге жеткен кездегіден оңай әрі арзан.',
      en: 'Decay does not reverse on its own. While it is small, treatment is usually simpler and costs less than once the cavity reaches the nerve.',
    },
  },
  {
    key: 'caries:high',
    status: 'caries',
    urgency: 'high',
    version: '1',
    text: {
      ru: 'Когда кариес занимает несколько поверхностей, он обычно распространяется быстрее, и объём лечения со временем растёт.',
      kk: 'Тіс жегісі бірнеше бетті қамтығанда әдетте тезірек таралады, ал емдеу көлемі уақыт өте ұлғаяды.',
      en: 'When decay covers several surfaces it usually spreads faster, and the amount of treatment needed grows over time.',
    },
  },
  {
    key: 'root:high',
    status: 'root',
    urgency: 'high',
    version: '1',
    text: {
      ru: 'Оставшийся корень со временем обычно перестаёт быть пригодным для восстановления, и вариантов лечения становится меньше.',
      kk: 'Қалған тамыр уақыт өте әдетте қалпына келтіруге жарамсыз болады, ал емдеу нұсқалары азаяды.',
      en: 'A retained root usually stops being restorable over time, which leaves fewer treatment options open.',
    },
  },
  {
    key: 'endo_fail:high',
    status: 'endo_fail',
    urgency: 'high',
    version: '1',
    text: {
      ru: 'Если канал пролечен не полностью, воспаление у корня обычно сохраняется, и повторное лечение со временем усложняется.',
      kk: 'Арна толық емделмесе, тамыр маңындағы қабыну әдетте сақталады, ал қайта емдеу уақыт өте қиындайды.',
      en: 'When a canal is incompletely treated, inflammation at the root typically persists, and re-treatment becomes harder over time.',
    },
  },
  {
    key: 'missing:low',
    status: 'missing',
    urgency: 'low',
    version: '1',
    text: {
      ru: 'На месте промежутка соседние зубы обычно постепенно смещаются, а жевательная нагрузка перераспределяется на другие зубы.',
      kk: 'Бос орында көрші тістер әдетте біртіндеп ығысады, ал шайнау жүктемесі басқа тістерге ауысады.',
      en: 'Neighbouring teeth usually drift into a gap over time, and chewing load shifts onto the remaining teeth.',
    },
  },
];

/** The line that must accompany any consequence shown to a patient. */
export const CONSEQUENCE_DISCLAIMER: Record<PresentationLocale, string> = {
  ru: 'Это общая информация о состоянии, а не прогноз именно для вас. Что будет в вашем случае, решает врач на осмотре.',
  kk: 'Бұл жағдай туралы жалпы ақпарат, сізге арналған болжам емес. Сіздің жағдайыңызды дәрігер қабылдауда шешеді.',
  en: 'This is general information about the condition, not a prediction for you. What applies in your case is for your doctor to say.',
};

const BY_KEY = new Map(ENTRIES.map((e) => [e.key, e]));

export function consequenceKey(status: string, urgency: FindingUrgency): string {
  return `${status}:${urgency}`;
}

/**
 * The library entry for a finding, or `null`.
 *
 * `null` is a normal answer: a finding nobody has written a consequence for
 * simply gets no beat. Inventing one is the failure mode this returns null to
 * avoid.
 */
export function lookupConsequence(status: string, urgency: FindingUrgency): ConsequenceEntry | null {
  return BY_KEY.get(consequenceKey(status, urgency)) ?? null;
}

export function allConsequences(): ConsequenceEntry[] {
  return [...ENTRIES];
}

/**
 * Words no consequence may contain, in any locale.
 *
 * Split in two because they fail for opposite reasons: the first group frightens
 * a patient into treatment, the second promises them an outcome. Both are
 * enforced by a test over this file rather than by review.
 */
export const FORBIDDEN_FEAR_PATTERNS: readonly RegExp[] = [
  /выпад\w*/i,
  /потеряете\s+(все\s+)?зуб\w*/i,
  /\bрак\b/i,
  /опасно\s+для\s+жизни/i,
  /түсіп\s+қал\w*/i,
  /\bқатерлі\s+ісік\b/i,
  /\bfall\s+out\b/i,
  /\blose\s+(all\s+)?your\s+teeth\b/i,
  /\bcancer\b/i,
  /life[-\s]threatening/i,
];

export const FORBIDDEN_PROMISE_PATTERNS: readonly RegExp[] = [
  // Stem, not one inflection: "гарантированно" is the form a model actually
  // writes, and `гарантиру` does not match it.
  /гаранти\w*/i,
  /навсегда/i,
  /полностью\s+вылеч\w*/i,
  /\b100\s*%/,
  /без\s+боли/i,
  /кепілдік\s*бер\w*/i,
  /мәңгі/i,
  /\bguarantee\w*/i,
  /\bforever\b/i,
  /\bfully\s+cured?\b/i,
  /\bpainless\b/i,
];
