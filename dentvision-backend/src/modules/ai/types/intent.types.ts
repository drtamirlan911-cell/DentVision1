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

export const INTENT_PATTERNS: Record<string, RegExp[]> = {
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
    /долги/,
    /должники/,
    /кто\s+не\s+заплатил/,
    /проверь\s+оплату/,
    /задолженности/,
    /покажи\s+задолженности/,
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
    /школа/,
    /найди\s+курс/,
    /курсы\s+по\s+/,
  ],
  [Intent.GENERATE_REPORT]: [
    /отчет/,
    /аналитика/,
    /kpi/,
    /показатели/,
    /статистика/,
    /доход\s+за/,
    /мой\s+доход/,
  ],
  [Intent.SEARCH_DOCUMENT]: [
    /документ/,
    /договор/,
    /согласие/,
    /найти\s+файл/,
  ],
  [Intent.GET_ANALYTICS]: [
    /аналитика/,
    /kpi/,
    /показатели/,
    /статистика/,
    /открой\s+аналитику/,
  ],
  [Intent.VIEW_SCHEDULE]: [
    /расписание/,
    /кто\s+на\s+приеме/,
    /завтра/,
    /сегодня/,
    /кто\s+работает/,
    /мое\s+расписание/,
    /покажи\s+расписание/,
  ],
  [Intent.GET_MEDICAL_CARD]: [
    /медицинская\s+карта/,
    /карта\s+пациента/,
  ],
  [Intent.OPEN_IMAGING]: [
    /покажи\s+снимок/,
    /открой\s+рентген/,
    /cbct/,
    /кт/,
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
    /crm/,
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
    /шоп/,
    /shop/,
  ],
  [Intent.OPEN_FINANCE]: [
    /открой\s+финанс/,
    /открыть\s+финанс/,
    /финансы/,
  ],
  [Intent.OPEN_LABORATORY]: [
    /открой\s+лаборатор/,
    /открыть\s+лаборатор/,
    /лабор?\s*работ/,
    /лабораторные\s+работы/,
  ],
  [Intent.OPEN_ANALYTICS]: [
    /открой\s+аналитик/,
    /открыть\s+аналитик/,
  ],
  [Intent.OPEN_INVENTORY]: [
    /открой\s+склад/,
    /открыть\s+склад/,
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

export function classifyIntent(text: string): { intent: Intent; confidence: number } {
  const lowerText = text.toLowerCase();
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(lowerText)) {
        return { intent: intent as Intent, confidence: 0.9 };
      }
    }
  }
  return { intent: Intent.UNKNOWN, confidence: 0 };
}

export type IntentResult = {
  intent: Intent;
  confidence: number;
  action?: { type: string; params: Record<string, unknown> };
};