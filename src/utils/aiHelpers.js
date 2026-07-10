import { tg } from './constants.js';

function normalize(text) {
  return (text || '').toLowerCase();
}

function summarizeCounts(patients = [], appointments = [], receipts = [], doctors = []) {
  const paidRevenue = receipts.reduce((sum, receipt) => sum + Number(receipt.total || 0), 0);
  return {
    patientsCount: patients.length,
    appointmentsCount: appointments.length,
    revenue: paidRevenue,
    doctorsCount: doctors.length,
  };
}

export function buildAiReply({ message, clinicName, patients, appointments, receipts, doctors }) {
  const text = normalize(message);
  const summary = summarizeCounts(patients, appointments, receipts, doctors);

  if (text.includes('цена') || text.includes('стоимость') || text.includes('имплант')) {
    return `Для ${clinicName} у нас доступны основные услуги: терапия от 15 000 ₸, профгигиена от 18 000 ₸ и имплантация от 200 000 ₸. Если хотите, я помогу подобрать вариант под бюджет пациента.`;
  }

  if (text.includes('отчёт') || text.includes('отчет') || text.includes('сегодня')) {
    const revenueValue = String(summary.revenue).replace(/\s|\u00A0/g, '');
    return `Отчёт по ${clinicName}: ${summary.patientsCount} пациента, ${summary.appointmentsCount} записи и ${revenueValue} ₸ выручки сегодня. Врачей в смене: ${summary.doctorsCount}.`;
  }

  if (text.includes('запись') || text.includes('расписание') || text.includes('свобод')) {
    return `По расписанию для ${clinicName} рекомендую проверить ближайшие свободные окна утром и после обеда. Я могу помочь сформировать оптимальный график приёма.`;
  }

  if (text.includes('маркет') || text.includes('акция') || text.includes('отзыв')) {
    return `Для ${clinicName} сильнее всего работают рекомендации и Instagram. Рекомендую запустить акцию «Профгигиена + консультация» и ответить на отзывы в течение суток.`;
  }

  return `Я помогу ${clinicName} с вопросами по расписанию, пациентам, услугам и операционной аналитикой. Сформулируйте запрос конкретнее, и я дам практический ответ.`;
}
