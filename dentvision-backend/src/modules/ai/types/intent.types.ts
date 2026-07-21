export enum Intent {
  CREATE_APPOINTMENT = 'CREATE_APPOINTMENT',
  SEARCH_PATIENT = 'SEARCH_PATIENT',
  OPEN_MEDICAL_CARD = 'OPEN_MEDICAL_CARD',
  SHOW_CBCT = 'SHOW_CBCT',
  CREATE_TREATMENT_PLAN = 'CREATE_TREATMENT_PLAN',
  GENERATE_INVOICE = 'GENERATE_INVOICE',
  CHECK_DEBTS = 'CHECK_DEBTS',
  ORDER_PRODUCT = 'ORDER_PRODUCT',
  FIND_COURSE = 'FIND_COURSE',
  GENERATE_REPORT = 'GENERATE_REPORT',
  SEARCH_DOCUMENT = 'SEARCH_DOCUMENT',
  GET_ANALYTICS = 'GET_ANALYTICS',
  VIEW_SCHEDULE = 'VIEW_SCHEDULE',
  GET_MEDICAL_CARD = 'GET_MEDICAL_CARD',
  OPEN_IMAGING = 'OPEN_IMAGING',
  RECOMMEND_PRODUCT = 'RECOMMEND_PRODUCT',
  GET_DEBTORS = 'GET_DEBTORS',
  MORNING_BRIEFING = 'MORNING_BRIEFING',
  OPEN_CRM = 'OPEN_CRM',
  OPEN_SCHEDULE = 'OPEN_SCHEDULE',
  OPEN_PATIENTS = 'OPEN_PATIENTS',
  OPEN_SCHOOL = 'OPEN_SCHOOL',
  OPEN_SHOP = 'OPEN_SHOP',
  OPEN_FINANCE = 'OPEN_FINANCE',
  OPEN_LABORATORY = 'OPEN_LABORATORY',
  OPEN_ANALYTICS = 'OPEN_ANALYTICS',
  OPEN_INVENTORY = 'OPEN_INVENTORY',
  OPEN_DOCUMENTS = 'OPEN_DOCUMENTS',
  RECALL_PATIENT = 'RECALL_PATIENT',
  LOW_STOCK = 'LOW_STOCK',
  OPEN_MEDICAL_CARD_NAV = 'OPEN_MEDICAL_CARD_NAV',
  UNKNOWN = 'UNKNOWN',
}

/** Patterns are scored by source string length — longer / more specific wins. */
export const INTENT_PATTERNS: Record<string, RegExp[]> = {
  [Intent.MORNING_BRIEFING]: [
    /что\s+важно/,
    /что\s+важного/,
    /сводка\s+(на\s+)?сегодня/,
    /брифинг/,
    /резюме\s+дня/,
    /утро\s+клиники/,
    /что\s+сегодня\s+важно/,
    /обзор\s+дня/,
    /сводка\s+дня/,
  ],
  [Intent.CREATE_APPOINTMENT]: [
    /записать\s+пациента/,
    /запиши\s+пациента/,
    /записать\s+на\s+прием/,
    /запиши\s+на\s+прием/,
    /запишите\s+пациента/,
    /создай\s+запись/,
    /добавь\s+в\s+расписание/,
    /запланируй\s+визит/,
    /новая\s+запись/,
    /запись\s+на\s+/,
    /запиши\s+пациент/,
    /запиши\s+.+\s+на\s+/,
  ],
  [Intent.SEARCH_PATIENT]: [
    /найти\s+пациента/,
    /поиск\s+пациента/,
    /найди\s+пациента/,
    /где\s+пациент/,
    /поиск\s+по\s+фамилии/,
    /найди\s+по\s+фамилии/,
  ],
  [Intent.OPEN_MEDICAL_CARD]: [
    /медицинская\s+карта/,
    /карта\s+пациента/,
    /открой\s+карту/,
    /покажи\s+карту/,
    /открой\s+карточку/,
    /карточка\s+пациента/,
  ],
  [Intent.SHOW_CBCT]: [
    /покажи\s+кт/,
    /покажи\s+кбкт/,
    /открой\s+снимок/,
    /рентген/,
    /cbct/,
    /кт\s+пациента/,
  ],
  [Intent.CREATE_TREATMENT_PLAN]: [
    /план\s+лечения/,
    /составь\s+план/,
    /план\s+терапии/,
    /создай\s+план/,
    /новый\s+план\s+лечения/,
  ],
  [Intent.GENERATE_INVOICE]: [
    /создай\s+счет/,
    /выпиши\s+счет/,
    /счет\s+на\s+оплату/,
    /инвойс/,
    /сделай\s+счет/,
    /открой\s+счет/,
  ],
  [Intent.CHECK_DEBTS]: [
    /проверь\s+долг/,
    /проверить\s+долг/,
    /покажи\s+долг/,
    /долги/,
    /должники/,
    /кто\s+не\s+заплатил/,
    /проверь\s+оплату/,
    /задолженност/,
  ],
  [Intent.ORDER_PRODUCT]: [
    /закажи\s+товар/,
    /купи\s+материал/,
    /заказ\s+в\s+магазин/,
    /пополни\s+склад/,
    /закажи\s+еще\s+\d+/,
    /заказать\s+имплант/,
  ],
  [Intent.FIND_COURSE]: [
    /найти\s+курс/,
    /подбери\s+курс/,
    /курс\s+для/,
    /обучение/,
    /найди\s+курс/,
    /курсы\s+по\s+/,
  ],
  [Intent.GENERATE_REPORT]: [
    /сгенерируй\s+отчет/,
    /создай\s+отчет/,
    /отчет\s+по/,
  ],
  [Intent.SEARCH_DOCUMENT]: [
    /документ/,
    /договор/,
    /согласие/,
    /найти\s+файл/,
  ],
  [Intent.GET_ANALYTICS]: [
    /выручк/,
    /доход/,
    /финанс/,
    /покажи\s+деньги/,
    /аналитик/,
    /kpi/,
    /показатели/,
    /статистика/,
    /открой\s+аналитик/,
    /открыть\s+аналитик/,
    /мой\s+доход/,
  ],
  [Intent.VIEW_SCHEDULE]: [
    /покажи\s+расписание/,
    /показать\s+расписание/,
    /открой\s+расписание/,
    /открыть\s+расписание/,
    /расписание\s+на\s+сегодня/,
    /расписание\s+на\s+завтра/,
    /расписание/,
    /кто\s+на\s+приеме/,
    /кто\s+сегодня\s+на\s+приеме/,
    /записи\s+на\s+сегодня/,
    /записи\s+на\s+завтра/,
    /мое\s+расписание/,
    /кто\s+работает/,
  ],
  [Intent.GET_MEDICAL_CARD]: [
    /медицинская\s+карта/,
    /карта\s+пациента/,
  ],
  [Intent.OPEN_IMAGING]: [
    /покажи\s+снимок/,
    /открой\s+рентген/,
    /cbct/,
    /открой\s+кт/,
  ],
  [Intent.RECOMMEND_PRODUCT]: [
    /рекомендуй\s+товар/,
    /что\s+лучше\s+купить/,
    /советуй/,
  ],
  [Intent.GET_DEBTORS]: [
    /должники/,
    /дебиторы/,
    /кто\s+не\s+заплатил/,
  ],
  [Intent.OPEN_CRM]: [
    /открой\s+crm/,
    /открыть\s+crm/,
    /перейти\s+в\s+crm/,
  ],
  [Intent.OPEN_SCHEDULE]: [
    /открой\s+расписание/,
    /открыть\s+расписание/,
    /расписание\s+приемов/,
  ],
  [Intent.OPEN_PATIENTS]: [
    /открой\s+пациент/,
    /открыть\s+пациент/,
    /список\s+пациентов/,
    /все\s+пациенты/,
  ],
  [Intent.OPEN_SCHOOL]: [
    /открой\s+школ/,
    /открыть\s+школ/,
    /школа/,
    /school/,
  ],
  [Intent.OPEN_SHOP]: [
    /открой\s+магазин/,
    /открыть\s+магазин/,
    /маркетплейс/,
    /шоп/,
    /shop/,
  ],
  [Intent.OPEN_FINANCE]: [
    /открой\s+финанс/,
    /открыть\s+финанс/,
    /покажи\s+финанс/,
    /показать\s+финанс/,
    /касса/,
  ],
  [Intent.OPEN_LABORATORY]: [
    /открой\s+лаборатор/,
    /открыть\s+лаборатор/,
    /лабораторные\s+работы/,
  ],
  [Intent.OPEN_ANALYTICS]: [
    /открой\s+аналитик/,
    /открыть\s+аналитик/,
  ],
  [Intent.OPEN_INVENTORY]: [
    /открой\s+склад/,
    /открыть\s+склад/,
    /что\s+на\s+складе/,
    /инвентарь/,
    /материалы\s+заканчив/,
    /что\s+заканчивается/,
    /остатки\s+на\s+складе/,
  ],
  [Intent.OPEN_DOCUMENTS]: [
    /открой\s+документ/,
    /документы/,
    /история\s+лечения/,
    /открой\s+историю/,
  ],
  [Intent.RECALL_PATIENT]: [
    /напоминание/,
    /напомни/,
    /отправь\s+напоминание/,
    /напомни\s+пациент/,
  ],
  [Intent.LOW_STOCK]: [
    /материалы\s+заканчив/,
    /заканчивается\s+анестетик/,
    /что\s+заканчивается\s+на\s+складе/,
    /низкие\s+остатки/,
  ],
  [Intent.OPEN_MEDICAL_CARD_NAV]: [
    /история\s+лечения/,
    /медицинская\s+карта/,
    /карта\s+пациента/,
  ],
};

/** Prefer specific intents when several patterns match. */
const INTENT_PRIORITY: Partial<Record<Intent, number>> = {
  [Intent.MORNING_BRIEFING]: 100,
  [Intent.CREATE_APPOINTMENT]: 90,
  [Intent.CHECK_DEBTS]: 85,
  [Intent.GET_DEBTORS]: 85,
  [Intent.GET_ANALYTICS]: 80,
  [Intent.OPEN_FINANCE]: 78,
  [Intent.OPEN_INVENTORY]: 78,
  [Intent.OPEN_ANALYTICS]: 78,
  [Intent.VIEW_SCHEDULE]: 70,
  [Intent.OPEN_SCHEDULE]: 72,
  [Intent.GENERATE_REPORT]: 75,
};

export function normalizeAiText(text: string): string {
  return text.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

export function classifyIntent(text: string): { intent: Intent; confidence: number } {
  const lowerText = normalizeAiText(text);
  if (!lowerText) return { intent: Intent.UNKNOWN, confidence: 0 };

  let best: { intent: Intent; score: number } | null = null;

  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      const match = lowerText.match(pattern);
      if (!match) continue;
      const priority = INTENT_PRIORITY[intent as Intent] ?? 50;
      const score = priority * 1000 + match[0].length;
      if (!best || score > best.score) {
        best = { intent: intent as Intent, score };
      }
    }
  }

  if (!best) return { intent: Intent.UNKNOWN, confidence: 0 };
  return { intent: best.intent, confidence: 0.9 };
}

/** Light param extraction for owner/doctor demos without an LLM. */
export function extractIntentParams(text: string, intent: Intent): Record<string, unknown> {
  const lower = normalizeAiText(text);
  const params: Record<string, unknown> = {};

  if (intent === Intent.GET_ANALYTICS || intent === Intent.GENERATE_REPORT) {
    if (/выручк|доход|финанс/.test(lower)) params.type = 'revenue';
    else if (/врач|загрузк/.test(lower)) params.type = 'doctors';
    else params.type = 'overview';
  }

  if (intent === Intent.VIEW_SCHEDULE) {
    if (/завтра/.test(lower)) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      params.date = d.toISOString().split('T')[0];
    } else {
      params.date = new Date().toISOString().split('T')[0];
    }
  }

  if (intent === Intent.CREATE_APPOINTMENT && /завтра/.test(lower)) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    params.date = d.toISOString().split('T')[0];
  }

  return params;
}

export type IntentResult = {
  intent: Intent;
  confidence: number;
  action?: { type: string; params: Record<string, unknown> };
};
