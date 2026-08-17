/**
 * Dental urgency, decided by rules rather than by generation.
 *
 * The assistant conducts the conversation — it is good at turning "щека
 * раздуло и глотать больно" into filled slots. It does not decide how urgent
 * that is. This module does, from a fixed table, because an urgency verdict
 * has three properties a language model cannot give it: it is reproducible
 * (the same answers always produce the same level), it is testable (every red
 * flag below has a case), and it is reviewable by a clinician who does not
 * read TypeScript but can read a list of rules.
 *
 * The bar is deliberately asymmetric. Sending someone to a clinic they did not
 * strictly need costs an appointment; missing a spreading odontogenic
 * infection costs an airway. Every rule here is written to fail toward "go
 * now".
 *
 * This is triage — deciding *how fast* to be seen. It is not diagnosis, and
 * nothing here names a condition to the patient.
 */

export type TriageLevel = 'emergency' | 'urgent' | 'soon' | 'routine';

/**
 * What the conversation has to establish. Everything optional: a patient who
 * stops answering still gets a verdict from what is known, and unknown is
 * never read as reassuring.
 */
export interface TriageAnswers {
  /** 0–10 as the patient rates it. */
  painLevel?: number;
  /** How far any swelling has gone — the single most decisive input. */
  swelling?: 'none' | 'local' | 'spreading';
  /** Trouble breathing or swallowing. Airway first, always. */
  breathingOrSwallowing?: boolean;
  /** Measured or felt fever. */
  fever?: boolean;
  /** Bleeding that has not stopped with pressure. */
  uncontrolledBleeding?: boolean;
  /** A blow to the face or mouth. */
  trauma?: boolean;
  /** A permanent tooth knocked completely out. */
  toothKnockedOut?: boolean;
  /** Pain that wakes the patient at night — a classic irreversible-pulpitis marker. */
  wakesAtNight?: boolean;
  /** How long it has been going on. */
  durationDays?: number;
}

export interface TriageVerdict {
  level: TriageLevel;
  /** Stable identifier for the rule that fired — logged, and testable. */
  reasonCode: string;
  /** What the patient is told. Plain, specific, no diagnosis. */
  patientMessage: string;
  /** True when the patient should stop reading and telephone someone. */
  callNow: boolean;
}

/**
 * Red flags, in the order they are checked.
 *
 * Order is clinical, not cosmetic: the airway outranks everything, and a
 * spreading infection outranks a knocked-out tooth even though the tooth is
 * the more time-critical *repair*, because one of them is survivable to lose.
 */
const RED_FLAGS: Array<{
  code: string;
  when: (a: TriageAnswers) => boolean;
  message: string;
}> = [
  {
    code: 'AIRWAY',
    when: (a) => a.breathingOrSwallowing === true,
    message:
      'Трудно дышать или глотать — это неотложно. Звоните в скорую (103) или езжайте в приёмный покой прямо сейчас, не ждите приёма у стоматолога.',
  },
  {
    code: 'SPREADING_SWELLING',
    when: (a) => a.swelling === 'spreading',
    message:
      'Отёк, который расходится по лицу или шее, нельзя откладывать. Свяжитесь с клиникой немедленно, а если она закрыта — обратитесь в приёмный покой сегодня же.',
  },
  {
    code: 'SWELLING_WITH_FEVER',
    when: (a) => a.swelling === 'local' && a.fever === true,
    message:
      'Отёк вместе с температурой — признак того, что ждать не стоит. Свяжитесь с клиникой сегодня; если она закрыта, обратитесь в приёмный покой.',
  },
  {
    code: 'UNCONTROLLED_BLEEDING',
    when: (a) => a.uncontrolledBleeding === true,
    message:
      'Кровотечение, которое не останавливается прижатием, требует помощи сейчас. Прижмите марлю и позвоните в клинику или в скорую (103).',
  },
  {
    code: 'AVULSED_TOOTH',
    when: (a) => a.toothKnockedOut === true,
    message:
      'Выбитый постоянный зуб можно спасти, но счёт идёт на минуты. Возьмите зуб за коронку, не трогая корень, положите в молоко или физраствор — и сразу в клинику.',
  },
];

/** Same-day or next-day, but not an emergency run. */
const URGENT_RULES: Array<{
  code: string;
  when: (a: TriageAnswers) => boolean;
  message: string;
}> = [
  {
    code: 'SEVERE_PAIN',
    when: (a) => typeof a.painLevel === 'number' && a.painLevel >= 7,
    message:
      'Такая боль — повод попасть к врачу сегодня или завтра. Напишите клинике, что боль сильная: обычно на это находят место вне записи.',
  },
  {
    code: 'LOCAL_SWELLING',
    when: (a) => a.swelling === 'local',
    message:
      'Отёк стоит показать врачу в ближайший день, даже если пока терпимо: сам он не проходит.',
  },
  {
    code: 'TRAUMA',
    when: (a) => a.trauma === true,
    message:
      'После удара по лицу или зубам нужен осмотр в ближайший день, даже если внешне всё цело — трещины и повреждения корня не видны снаружи.',
  },
  {
    code: 'NIGHT_PAIN',
    when: (a) => a.wakesAtNight === true,
    message:
      'Боль, которая будит ночью, обычно означает, что она сама не пройдёт. Запишитесь в ближайшие дни.',
  },
];

const MODERATE_PAIN_MIN = 4;
/** Two weeks of anything is no longer "поболит и пройдёт". */
const LINGERING_DAYS = 14;

/**
 * Decide urgency from the answers.
 *
 * Pure and total: any input produces a verdict, and the same input always
 * produces the same one.
 */
export function assessTriage(answers: TriageAnswers): TriageVerdict {
  for (const flag of RED_FLAGS) {
    if (flag.when(answers)) {
      return { level: 'emergency', reasonCode: flag.code, patientMessage: flag.message, callNow: true };
    }
  }

  for (const rule of URGENT_RULES) {
    if (rule.when(answers)) {
      return { level: 'urgent', reasonCode: rule.code, patientMessage: rule.message, callNow: false };
    }
  }

  if (typeof answers.painLevel === 'number' && answers.painLevel >= MODERATE_PAIN_MIN) {
    return {
      level: 'soon',
      reasonCode: 'MODERATE_PAIN',
      patientMessage:
        'Терпимая, но заметная боль — запишитесь на ближайшие дни. Чем раньше, тем меньше лечения потребуется.',
      callNow: false,
    };
  }

  if (typeof answers.durationDays === 'number' && answers.durationDays >= LINGERING_DAYS) {
    return {
      level: 'soon',
      reasonCode: 'LINGERING',
      patientMessage:
        'Если это тянется уже две недели, само оно не пройдёт — стоит показаться врачу в ближайшее время.',
      callNow: false,
    };
  }

  return {
    level: 'routine',
    reasonCode: 'ROUTINE',
    patientMessage:
      'Судя по ответам, срочности нет. Запишитесь в удобное время — а если станет хуже, появится отёк или поднимется температура, свяжитесь с клиникой сразу.',
    callNow: false,
  };
}

/**
 * The questions to ask, in order, skipping what is already known.
 *
 * Kept here rather than in the prompt so the protocol is one thing that can be
 * reviewed and changed, instead of drifting between the model's improvisation
 * and this table.
 */
export const TRIAGE_QUESTIONS: Array<{ slot: keyof TriageAnswers; question: string }> = [
  { slot: 'breathingOrSwallowing', question: 'Вам трудно дышать или глотать?' },
  { slot: 'swelling', question: 'Есть отёк? Если да — только у зуба или расходится по лицу и шее?' },
  { slot: 'fever', question: 'Есть температура?' },
  { slot: 'uncontrolledBleeding', question: 'Есть кровотечение, которое не останавливается?' },
  { slot: 'trauma', question: 'Был ли удар по лицу или зубам?' },
  { slot: 'toothKnockedOut', question: 'Зуб выбит полностью?' },
  { slot: 'painLevel', question: 'Насколько сильная боль по шкале от 0 до 10?' },
  { slot: 'wakesAtNight', question: 'Боль будит вас ночью?' },
  { slot: 'durationDays', question: 'Сколько дней это продолжается?' },
];

/** The next unanswered question, or null when the protocol is complete. */
export function nextTriageQuestion(answers: TriageAnswers): string | null {
  for (const { slot, question } of TRIAGE_QUESTIONS) {
    if (answers[slot] === undefined) return question;
  }
  return null;
}
