/**
 * Public routes — online patient booking (no auth).
 * KazDent donor: /book/:clinicId patient flow.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import prisma from '../../lib/prisma.js';
import { uid } from '../../lib/helpers.js';
import { mergeClinicSettings } from '../clinics/clinicSettings.js';
import { buildTimeSlots, filterAvailableSlots, isWorkingDay, splitPatientName } from './bookingSlots.js';
import { getDocumentForSigning, signDocument } from '../files/documentSign.service.js';

const publicBookingLimiter = rateLimit({ windowMs: 60 * 1000, max: 8, standardHeaders: true, legacyHeaders: false, message: { ok: false, error: 'Слишком много заявок. Подождите минуту.' } });
const documentSignLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { ok: false, error: 'Слишком много попыток. Подождите минуту.' } });
const discoveryLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, message: { ok: false, error: 'Слишком много запросов. Подождите минуту.' } });

export const publicRouter = Router();

function normalizePhone(phone: string): string { return String(phone || '').replace(/\D/g, ''); }

/** Public clinic discovery — no patient data. */
publicRouter.get('/clinics/discover', discoveryLimiter, async (req, res) => {
  try {
    const city = String(req.query.city || '').trim().toLowerCase();
    const q = String(req.query.q || '').trim().toLowerCase();
    const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 20);
    const clinics = await prisma.clinic.findMany({ select: { id: true, name: true, city: true, address: true, phone: true, logo: true, settings: true }, orderBy: { name: 'asc' }, take: 200 });
    const candidates = clinics
      .filter((clinic) => mergeClinicSettings(clinic.settings).onlineBookingEnabled !== false)
      .filter((clinic) => !city || String(clinic.city || '').toLowerCase().includes(city))
      .filter((clinic) => !q || [clinic.name, clinic.city, clinic.address].map((value) => String(value || '').toLowerCase()).join(' ').includes(q))
      .slice(0, limit);
    const data = await Promise.all(candidates.map(async (clinic) => {
      const members = await prisma.clinicMember.findMany({ where: { clinicId: clinic.id, role: { in: ['DOCTOR', 'OWNER'] } }, include: { user: { select: { id: true, firstName: true, lastName: true, spec: true, avatar: true } } }, orderBy: { joinedAt: 'asc' }, take: 6 });
      return { id: clinic.id, name: clinic.name, city: clinic.city, address: clinic.address, phone: clinic.phone, logo: clinic.logo, doctors: members.map((member) => ({ id: member.user.id, name: [member.user.firstName, member.user.lastName].filter(Boolean).join(' ').trim(), spec: member.user.spec || undefined, avatar: member.user.avatar || undefined })) };
    }));
    return res.json({ ok: true, data: { clinics: data, query: { city: city || null, q: q || null } } });
  } catch (error) {
    console.error('[Public] clinic discovery', error);
    return res.status(500).json({ ok: false, error: 'Не удалось выполнить поиск клиник' });
  }
});

/** Public diagnostic-center discovery — directory data only, no patient/medical data. */
publicRouter.get('/diagnostics/discover', discoveryLimiter, async (req, res) => {
  try {
    const city = String(req.query.city || '').trim().toLowerCase();
    const q = String(req.query.q || '').trim().toLowerCase();
    const category = String(req.query.category || '').trim().toLowerCase();
    const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 20);

    const centers = await prisma.diagnosticCenter.findMany({
      where: { active: true },
      select: { id: true, name: true, city: true, address: true, phone: true, rating: true, studies: { where: { active: true }, select: { id: true, name: true, category: true, price: true }, orderBy: { name: 'asc' }, take: 100 } },
      orderBy: { rating: 'desc' },
      take: 200,
    });

    const data = centers
      .filter((center) => !city || String(center.city || '').toLowerCase().includes(city))
      .map((center) => ({
        ...center,
        studies: center.studies.filter((study) => !category || String(study.category || '').toLowerCase().includes(category)),
      }))
      .filter((center) => !q || [center.name, center.city, center.address, ...center.studies.map((study) => study.name)].map((value) => String(value || '').toLowerCase()).join(' ').includes(q))
      .filter((center) => !category || center.studies.length > 0)
      .slice(0, limit)
      .map((center) => ({ ...center, studies: center.studies.slice(0, 12) }));

    return res.json({ ok: true, data: { centers: data, query: { city: city || null, q: q || null, category: category || null } } });
  } catch (error) {
    console.error('[Public] diagnostics discovery', error);
    return res.status(500).json({ ok: false, error: 'Не удалось выполнить поиск диагностических центров' });
  }
});

publicRouter.get('/clinic/:clinicId', async (req, res) => {
  try {
    const clinicId = req.params.clinicId as string;
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { id: true, name: true, city: true, address: true, phone: true, logo: true, settings: true } });
    if (!clinic) return res.status(404).json({ ok: false, error: 'Клиника не найдена' });
    const settings = mergeClinicSettings(clinic.settings);
    if (settings.onlineBookingEnabled === false) return res.status(403).json({ ok: false, error: 'Онлайн-запись временно недоступна' });
    const members = await prisma.clinicMember.findMany({ where: { clinicId, role: { in: ['DOCTOR', 'OWNER'] } }, include: { user: { select: { id: true, firstName: true, lastName: true, spec: true, avatar: true, phone: true } } }, orderBy: { joinedAt: 'asc' } });
    const org = await prisma.organization.findFirst({ where: { originalType: 'Clinic', originalId: clinicId } });
    const persons = org ? await prisma.person.findMany({ where: { organizationId: org.id, personType: 'DOCTOR', userId: { not: null } } }) : [];
    const memberSet = new Set(members.map(m => m.userId));
    const extraPersons = persons.filter(p => p.userId && !memberSet.has(p.userId));
    const doctors = [...members.map((m) => ({ id: m.user.id, name: [m.user.firstName, m.user.lastName].filter(Boolean).join(' ').trim(), spec: m.user.spec || undefined, avatar: m.user.avatar || undefined, phone: m.user.phone || undefined })), ...extraPersons.map((p) => ({ id: p.userId!, name: p.fullName, spec: p.specialization || undefined, avatar: p.avatar || undefined, phone: p.phone || undefined }))];
    const priceRows = await prisma.priceListItem.findMany({ where: { clinicId, active: true }, orderBy: { name: 'asc' }, take: 200 });
    const services = priceRows.map((p) => { const name = p.name || 'Услуга'; return { id: p.serviceCode, name, price: p.price, category: name.includes('·') ? name.split('·')[0].trim() : 'Услуги' }; });
    return res.json({ ok: true, clinic: { id: clinic.id, name: clinic.name, city: clinic.city, address: clinic.address, phone: clinic.phone, logo: clinic.logo }, doctors, services, settings: { workStart: settings.workStart, workEnd: settings.workEnd, workDays: settings.workDays, lunchStart: settings.lunchStart, lunchEnd: settings.lunchEnd, bookingSlotMinutes: settings.bookingSlotMinutes, defaultAppointmentDuration: settings.defaultAppointmentDuration, currency: settings.currency } });
  } catch (error) { console.error('[Public] clinic', error); return res.status(500).json({ ok: false, error: 'Не удалось загрузить клинику' }); }
});

publicRouter.get('/clinic/:clinicId/slots', async (req, res) => {
  try {
    const clinicId = req.params.clinicId as string;
    const dateStr = String(req.query.date || '');
    const doctorId = (req.query.doctorId as string) || null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return res.status(400).json({ ok: false, error: 'Укажите дату YYYY-MM-DD' });
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { settings: true } });
    if (!clinic) return res.status(404).json({ ok: false, error: 'Клиника не найдена' });
    const settings = mergeClinicSettings(clinic.settings);
    const doctorCount = doctorId ? 1 : await prisma.clinicMember.count({ where: { clinicId, role: { in: ['DOCTOR', 'OWNER'] } } }) || 1;
    const day = new Date(`${dateStr}T12:00:00.000Z`);
    if (!isWorkingDay(day, settings)) return res.json({ ok: true, data: { date: dateStr, slots: [], workingDay: false } });
    const dayStart = new Date(`${dateStr}T00:00:00.000Z`); const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);
    const [appointments, bookings] = await Promise.all([
      prisma.appointment.findMany({ where: { clinicId, date: { gte: dayStart, lte: dayEnd }, status: { notIn: ['cancelled', 'no_show'] }, ...(doctorId ? { doctorId } : {}) }, select: { time: true, doctorId: true } }),
      prisma.booking.findMany({ where: { clinicId, date: dayStart, status: { in: ['pending', 'confirmed'] }, ...(doctorId ? { doctorId } : {}) }, select: { time: true, doctorId: true } }),
    ]);
    const occupied = [...appointments.filter((a) => a.time).map((a) => ({ time: a.time!, doctorId: a.doctorId })), ...bookings.map((b) => ({ time: b.time, doctorId: b.doctorId }))];
    const slots = filterAvailableSlots(buildTimeSlots(settings), occupied, doctorId, doctorCount);
    return res.json({ ok: true, data: { date: dateStr, slots, workingDay: true, slotMinutes: settings.bookingSlotMinutes || 30 } });
  } catch (error) { console.error('[Public] slots', error); return res.status(500).json({ ok: false, error: 'Не удалось загрузить слоты' }); }
});

publicRouter.post('/booking', publicBookingLimiter, async (req, res) => {
  try {
    const b = req.body || {}; const clinicId = b.clinic_id || b.clinicId; const patientName = String(b.patient_name || b.patientName || '').trim(); const phone = normalizePhone(b.phone || ''); const email = b.email ? String(b.email).trim() : null; const doctorId = b.doctor_id || b.doctorId || null; const serviceName = b.service_name || b.serviceName || null; const dateStr = b.date; const time = String(b.time || '').trim(); const notes = b.notes ? String(b.notes).trim() : null;
    if (!clinicId || !patientName || !phone || !dateStr || !time) return res.status(400).json({ ok: false, error: 'Заполните обязательные поля' });
    if (phone.length < 10 || phone.length > 15) return res.status(400).json({ ok: false, error: 'Некорректный номер телефона' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return res.status(400).json({ ok: false, error: 'Некорректная дата' });
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { id: true, settings: true } });
    if (!clinic) return res.status(404).json({ ok: false, error: 'Клиника не найдена' });
    const settings = mergeClinicSettings(clinic.settings); if (settings.onlineBookingEnabled === false) return res.status(403).json({ ok: false, error: 'Онлайн-запись временно недоступна' });
    const day = new Date(`${dateStr}T12:00:00.000Z`); if (!isWorkingDay(day, settings)) return res.status(400).json({ ok: false, error: 'Клиника не работает в выбранный день' });
    if (!buildTimeSlots(settings).includes(time)) return res.status(400).json({ ok: false, error: 'Выбранное время недоступно' });
    const dayStart = new Date(`${dateStr}T00:00:00.000Z`); const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);
    const conflictAppt = await prisma.appointment.findFirst({ where: { clinicId, date: { gte: dayStart, lte: dayEnd }, time, status: { notIn: ['cancelled', 'no_show'] }, ...(doctorId ? { doctorId } : {}) } });
    if (conflictAppt) return res.status(409).json({ ok: false, error: 'Это время уже занято. Выберите другое.' });
    const conflictBooking = await prisma.booking.findFirst({ where: { clinicId, date: dayStart, time, status: { in: ['pending', 'confirmed'] }, ...(doctorId ? { doctorId } : {}) } });
    if (conflictBooking) return res.status(409).json({ ok: false, error: 'Это время уже занято. Выберите другое.' });
    let doctorName: string | null = null;
    if (doctorId) { const member = await prisma.clinicMember.findFirst({ where: { clinicId, userId: doctorId }, include: { user: { select: { firstName: true, lastName: true } } } }); if (!member) return res.status(400).json({ ok: false, error: 'Врач не найден' }); doctorName = [member.user.firstName, member.user.lastName].filter(Boolean).join(' ').trim(); }
    const row = await prisma.booking.create({ data: { id: uid(), clinicId, patientName, phone, email, doctorId, doctorName, serviceName, date: dayStart, time, notes, status: 'pending', source: 'online' } });
    return res.status(201).json({ ok: true, data: { id: row.id, clinicId: row.clinicId, patientName: row.patientName, phone: row.phone, date: dateStr, time: row.time, status: row.status } });
  } catch (error) { console.error('[Public] booking', error); return res.status(500).json({ ok: false, error: 'Не удалось отправить заявку' }); }
});

const PRIVACY_POLICY = 'Политика конфиденциальности DentVision\n\n1. Сбор данных. Мы собираем только необходимые персональные данные (ФИО, телефон, email, медицинские данные) для оказания стоматологических услуг.\n2. Использование. Данные используются для записи на приём, ведения медицинской карты, выставления счетов и коммуникации.\n3. Хранение. Данные хранятся на защищённых серверах в соответствии с законодательством РК.\n4. Защита. Применяются организационные и технические меры защиты, включая шифрование при передаче и хранении.\n5. Права. Вы можете запросить удаление, изменение или выгрузку ваших данных.\n6. Срок хранения. Медицинские данные хранятся 5 лет с момента последнего обращения.\n7. Контакты. По вопросам обработки данных: privacy@dent-vision.com';
const TERMS_OF_SERVICE = 'Пользовательское соглашение DentVision\n\n1. Предмет. Сервис предоставляет инструменты для управления стоматологической клиникой.\n2. Регистрация. Пользователь обязуется предоставлять достоверные данные.\n3. Обязанности. Клиника несёт ответственность за сохранность учётных данных.\n4. Оплата. Тарифы указаны на сайте. Списание происходит ежемесячно.\n5. Отказ от ответственности. Сервис предоставляется «как есть».\n6. Разрешение споров. Споры рассматриваются в суде г. Алматы по законодательству РК.\n7. Изменения. Администрация вправе изменять соглашение с уведомлением за 14 дней.';

publicRouter.get('/document/:token', documentSignLimiter, async (req, res) => { try { const data = await getDocumentForSigning(req.params.token as string); if (!data) return res.status(404).json({ ok: false, error: 'Document not found' }); res.json({ ok: true, data }); } catch (e) { res.status(500).json({ ok: false, error: 'Failed to load document' }); } });
publicRouter.post('/document/:token/sign', documentSignLimiter, async (req, res) => { try { const token = req.params.token as string; const existing = await getDocumentForSigning(token); if (!existing) return res.status(404).json({ ok: false, error: 'Document not found' }); const { signatureData, signedByName } = req.body || {}; const updated = await signDocument({ documentId: existing.documentId, token, signatureData, signedByName }); res.json({ ok: true, data: updated }); } catch (e: any) { res.status(e?.status || 500).json({ ok: false, error: e instanceof Error ? e.message : 'Failed to sign document' }); } });

const COMMERCIAL_TERMS_VERSION = '1.2';
const COMMERCIAL_TERMS_EFFECTIVE_DATE = '2026-09-17';
const COMMERCIAL_TERMS = [
  { type:'clinic', label:'Клиника / владелец', subscriptions:[
      {name:'START',priceKzt:19900,period:'month',note:'1–2 врача'},
      {name:'PRO',priceKzt:39900,period:'month',note:'до 5 врачей'},
      {name:'BUSINESS',priceKzt:79900,period:'month',note:'до 15 врачей'},
      {name:'NETWORK',priceKzt:149900,period:'month_per_branch',note:'от, для групп/сетей'}
    ], transaction:{ratePercent:0,minKzt:0,capKzt:null,basis:'клиническая выручка клиники',note:'По умолчанию комиссия с общей клинической выручки не взимается.'}, documents:['CLINIC_AGREEMENT','NDA','DPA'] },
  { type:'diagnostic_center', label:'Диагностический / 3D-центр', subscriptions:[{name:'BRANCH',priceKzt:49900,period:'month_per_active_billable_branch'}], transaction:{ratePercent:7,minKzt:500,capKzt:3000,basis:'за исследование через DentVision'}, documents:['DIAGNOSTICS_AGREEMENT','NDA'] },
  { type:'medical_lab', label:'Медицинская лаборатория', subscriptions:[{name:'BRANCH',priceKzt:19900,period:'month_per_active_billable_branch'}], transaction:{ratePercent:6,minKzt:150,capKzt:2500,basis:'за анализ/заказ через DentVision'}, documents:['LABORATORY_AGREEMENT','NDA'] },
  { type:'dental_lab', label:'Зуботехническая / стоматологическая лаборатория', subscriptions:[{name:'BRANCH',priceKzt:29900,period:'month_per_active_billable_branch'}], transaction:{ratePercent:8,minKzt:500,capKzt:15000,basis:'за кейс',volumeTiers:[
      {gmvFromKzt:0,ratePercent:10},{gmvFromKzt:1000000,ratePercent:8},{gmvFromKzt:5000000,ratePercent:7},{gmvFromKzt:15000000,ratePercent:6},{gmvFromKzt:30000000,ratePercent:5}
    ]}, documents:['LABORATORY_AGREEMENT','NDA'] },
  { type:'supplier', label:'Поставщик / продавец', subscriptions:[], transaction:{ratePercent:8,minKzt:0,capKzt:null,basis:'GMV маркетплейса',volumeTiers:[
      {label:'standard',ratePercent:8},{label:'high_volume',ratePercent:6},{label:'strategic',ratePercent:5,negotiatedRangePercent:[4,5]}
    ],note:'Эквайринг/платёжные расходы учитываются отдельно.'}, documents:['SUPPLIER_AGREEMENT','NDA'] },
  { type:'academy', label:'Академия / школа', subscriptions:[], transaction:{ratePercent:null,minKzt:0,capKzt:null,basis:'зависит от модели привлечения студента',note:'Комиссия определяется источником привлечения.'},
    acquisitionModels:[
      {name:'Лектор привёл студента',dentVisionPercent:10,lecturerPercent:90},
      {name:'DentVision привёл студента',dentVisionPercent:25,lecturerPercent:75},
      {name:'DentVision: полный маркетинг + продажи',dentVisionPercent:30,lecturerPercent:70}
    ], documents:['ACADEMY_AGREEMENT','NDA'] },
  { type:'lecturer', label:'Лектор / эксперт', subscriptions:[], transaction:{ratePercent:null,minKzt:0,capKzt:null,basis:'выручка от обучения',note:'Доля зависит от источника привлечения студента.'},
    acquisitionModels:[
      {name:'Лектор привёл студента',dentVisionPercent:10,lecturerPercent:90},
      {name:'DentVision привёл студента',dentVisionPercent:25,lecturerPercent:75},
      {name:'DentVision: полный маркетинг + продажи',dentVisionPercent:30,lecturerPercent:70}
    ], documents:['LECTURER_AGREEMENT','NDA'] }
];

publicRouter.get('/commercial-terms', discoveryLimiter, (_req, res) => res.json({ok:true,data:{
  version:COMMERCIAL_TERMS_VERSION,effectiveDate:COMMERCIAL_TERMS_EFFECTIVE_DATE,currency:'KZT',
  disclosure:'Все опубликованные подписки, комиссии, минимальные и максимальные сборы и модели распределения показываются до регистрации. Платёжные комиссии, налоги, возвраты и иные удержания не включаются в комиссию DentVision и показываются отдельно там, где они известны.',
  terms:COMMERCIAL_TERMS
}}));

publicRouter.get('/commercial-documents', discoveryLimiter, async (req,res) => {
  try {
    const requested=String(req.query.type||'').trim().toUpperCase();
    const allowed=new Set(COMMERCIAL_TERMS.flatMap((item:any)=>item.documents));
    const where:any={versions:{some:{status:'PUBLISHED'}}};
    if(requested && allowed.has(requested)) where.type=requested;
    else where.type={in:Array.from(allowed)};
    const templates=await prisma.legalTemplate.findMany({where,include:{versions:{where:{status:'PUBLISHED'},orderBy:{version:'desc'},take:1}},orderBy:{updatedAt:'desc'}});
    return res.json({ok:true,data:templates.map((template:any)=>({
      id:template.id,type:template.type,name:template.name,description:template.description,version:template.currentVersion,
      content:template.versions[0]?.content||'',publishedAt:template.versions[0]?.publishedAt||null
    }))});
  } catch(error) {
    console.error('[Public] commercial documents',error);
    return res.status(500).json({ok:false,error:'Не удалось загрузить публичные документы'});
  }
});

publicRouter.get('/privacy', (_req, res) => { res.json({ ok: true, data: { content: PRIVACY_POLICY, format: 'text', updatedAt: '2025-07-30' } }); });
publicRouter.get('/terms', (_req, res) => { res.json({ ok: true, data: { content: TERMS_OF_SERVICE, format: 'text', updatedAt: '2025-07-30' } }); });
