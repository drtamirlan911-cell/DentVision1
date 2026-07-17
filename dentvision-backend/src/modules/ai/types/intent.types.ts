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