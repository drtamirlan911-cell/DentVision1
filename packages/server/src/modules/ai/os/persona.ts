/**
 * Operational personas — Spec §16 (AI Strategy).
 *
 * User always talks to one Jarvis; internally we resolve which of the 8
 * personas leads the turn. Clinical specialties (§4.4) stay under Doctor.
 */

export type PersonaId =
  | 'doctor'
  | 'reception'
  | 'analyst'
  | 'finance'
  | 'supply'
  | 'education'
  | 'marketing'
  | 'ceo'
  | 'guest';

export const PERSONA_LABELS: Record<PersonaId, string> = {
  doctor: 'AI Doctor',
  reception: 'AI Reception',
  analyst: 'AI Analyst',
  finance: 'AI Finance',
  supply: 'AI Supply',
  education: 'AI Education',
  marketing: 'AI Marketing',
  ceo: 'AI CEO',
  guest: 'Concierge',
};

const PERSONA_IDS = new Set<string>(Object.keys(PERSONA_LABELS));

export function isPersonaId(value: string | null | undefined): value is PersonaId {
  return Boolean(value && PERSONA_IDS.has(value));
}

export function personaLabel(id: PersonaId | string | null | undefined): string {
  if (id && isPersonaId(id)) return PERSONA_LABELS[id];
  return 'Jarvis';
}

/** Role → default persona (step 1). */
export function defaultPersonaForRole(role?: string | null): PersonaId {
  const r = String(role || '').toUpperCase();
  if (r === 'GUEST' || !r) return 'guest';
  if (r === 'DOCTOR' || r === 'ASSISTANT') return 'doctor';
  if (r === 'ADMIN' || r === 'RECEPTION' || r === 'CASHIER') return 'reception';
  if (r === 'OWNER' || r === 'DIRECTOR') return 'ceo';
  if (r === 'MANAGER') return 'analyst';
  if (r === 'BUYER' || r === 'SUPPLIER') return 'supply';
  if (r === 'LECTURER' || r === 'STUDENT') return 'education';
  if (r === 'LAB') return 'doctor';
  if (r === 'SUPERADMIN') return 'ceo';
  return 'ceo';
}

/** Stage (pathname) → persona (step 2). */
export function personaFromStage(stage?: string | null): PersonaId | null {
  switch (String(stage || '').toLowerCase()) {
    case 'finance':
    case 'cash':
    case 'invoices':
      return 'finance';
    case 'schedule':
    case 'reception':
    case 'reminders':
      return 'reception';
    case 'patients':
    case 'clinical':
    case 'dental-chart':
    case 'treatment-plans':
    case 'visits':
    case 'lab':
      return 'doctor';
    case 'analytics':
    case 'dashboard':
      return 'analyst';
    case 'shop':
    case 'inventory':
    case 'supplier':
      return 'supply';
    case 'school':
    case 'lecturer':
      return 'education';
    case 'marketing':
    case 'promotions':
    case 'pricelist':
      return 'marketing';
    default:
      return null;
  }
}

/** Explicit «как CEO» / «спроси Marketing» (step 4). */
export function personaFromExplicitCall(text: string): PersonaId | null {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return null;

  if (/(как\s+ceo|режим\s+ceo|спроси\s+ceo|ai\s+ceo|как\s+директор|executive\s+brief)/i.test(t)) {
    return 'ceo';
  }
  if (/(спроси\s+marketing|как\s+marketing|ai\s+marketing|маркетинг[\s-]*аи|режим\s+маркетинг)/i.test(t)) {
    return 'marketing';
  }
  if (/(спроси\s+finance|как\s+finance|ai\s+finance|режим\s+финанс)/i.test(t)) {
    return 'finance';
  }
  if (/(спроси\s+reception|как\s+reception|ai\s+reception|режим\s+ресепш)/i.test(t)) {
    return 'reception';
  }
  if (/(спроси\s+doctor|как\s+doctor|ai\s+doctor|режим\s+врач)/i.test(t)) {
    return 'doctor';
  }
  if (/(спроси\s+analyst|как\s+analyst|ai\s+analyst|режим\s+аналит)/i.test(t)) {
    return 'analyst';
  }
  if (/(спроси\s+supply|как\s+supply|ai\s+supply|режим\s+склад|режим\s+закуп)/i.test(t)) {
    return 'supply';
  }
  if (/(спроси\s+education|как\s+education|ai\s+education|режим\s+академи)/i.test(t)) {
    return 'education';
  }
  return null;
}

/** Intent keywords (step 3). */
export function personaFromIntent(text: string): PersonaId | null {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return null;

  if (/(акци|промо|скидк|реактив|recall|whatsapp\s*шаблон|вернуть\s+баз|рассылк)/i.test(t)) {
    return 'marketing';
  }
  if (/(долг|выручк|касс|счет|счёт|p&l|фоты|зарплат|расход|дебитор)/i.test(t)) {
    return 'finance';
  }
  if (/(запиш|перенес|отмен|расписан|слот|no[\s-]?show|лист\s+ожидан|подтверд)/i.test(t)) {
    return 'reception';
  }
  if (/(одонтограм|зубн|план\s+лечен|пациент|медкарт|снимок|кбкт|диагноз)/i.test(t)) {
    return 'doctor';
  }
  if (/(kpi|загрузк\s+врач|воронк|аномал|сравн(и|ение)\s+период|почему\s+упал)/i.test(t)) {
    return 'analyst';
  }
  if (/(склад|остатк|дозаказ|закуп|маркетплейс|поставщик|инвентар)/i.test(t)) {
    return 'supply';
  }
  if (/(курс|вебинар|академи|обучен|лектор|учебн)/i.test(t)) {
    return 'education';
  }
  return null;
}

export interface ResolvePersonaInput {
  role?: string | null;
  stage?: string | null;
  pathname?: string | null;
  text?: string | null;
  isGuest?: boolean;
}

/**
 * Deterministic persona resolution (§16.4):
 * explicit call → intent → stage → role default.
 */
export function resolveActivePersona(input: ResolvePersonaInput): PersonaId {
  if (input.isGuest || String(input.role || '').toUpperCase() === 'GUEST') {
    return 'guest';
  }

  const explicit = personaFromExplicitCall(input.text || '');
  if (explicit) return explicit;

  const intent = personaFromIntent(input.text || '');
  if (intent) return intent;

  const fromStage = personaFromStage(input.stage);
  if (fromStage) return fromStage;

  return defaultPersonaForRole(input.role);
}
