import { T } from './design-tokens'
import type { Clinic, User, Patient, Appointment, Receipt, Service } from '../types'

export const SUPER_ADMIN = {
  id: "sa",
  login: "dr.tamirlan",
  role: "superadmin",
  name: "Dr. Tamirlan"
} as const;

export const INIT_CLINICS: Clinic[] = [
  { id: "c1", name: "DentVision Тараз — Центр", city: "Тараз", address: "ул. Толе би, 32", phone: "+7 726 222-33-44", plan: "pro", active: true, createdAt: "2025-01-01", color: "#C9A96E", country: "KZ", currency: "KZT", locale: "ru-KZ" },
  { id: "c2", name: "DentVision Тараз — Север", city: "Тараз", address: "мкр. Мирас, 15", phone: "+7 726 255-11-22", plan: "starter", active: true, createdAt: "2025-03-15", color: "#3498DB", country: "KZ", currency: "KZT", locale: "ru-KZ" },
];

export const INIT_USERS: User[] = [
  { id: "u1", clinicId: "c1", login: "admin_c1",   role: "admin",     name: "Анна Королёва",           phone: "+77161234567" },
  { id: "u2", clinicId: "c1", login: "doc1_c1",    role: "doctor",    name: "Иванова Мария Сергеевна", spec: "Терапевт",   phone: "+77031112233" },
  { id: "u3", clinicId: "c1", login: "doc2_c1",    role: "doctor",    name: "Петров Алексей Иванович", spec: "Ортопед",    phone: "+77017778899" },
  { id: "u6", clinicId: "c1", login: "dir_c1",     role: "director",  name: "Нурлан Бекжан",           phone: "+77011234567" },
  { id: "u7", clinicId: "c1", login: "assist_c1",  role: "assistant", name: "Карина Омарова",          spec: "Ассистент",  phone: "+77055551234" },
  { id: "u4", clinicId: "c2", login: "admin_c2",   role: "admin",     name: "Борис Сейткали",          phone: "+77261234567" },
  { id: "u5", clinicId: "c2", login: "doc1_c2",    role: "doctor",    name: "Сидорова Елена Юрьевна", spec: "Терапевт",   phone: "+77265554433" },
];

export const INIT_PATIENTS: Patient[] = [
  { id: "p1", clinicId: "c1", name: "Смирнова Ольга Николаевна", dob: "1985-03-12", phone: "77161234567", address: "Тараз, ул. Ленина, 5", notes: "Аллергия на лидокаин", teeth: { 16: "caries", 26: "filled" } },
  { id: "p2", clinicId: "c1", name: "Громов Игорь Петрович", dob: "1970-07-25", phone: "77031112233", address: "Тараз, ул. Мира, 12", notes: "", teeth: { 46: "missing" } },
  { id: "p3", clinicId: "c2", name: "Белова Татьяна Викторовна", dob: "1992-11-08", phone: "77265554433", address: "Тараз, мкр. Мирас, 5", notes: "", teeth: {} },
];

export const INIT_APPOINTMENTS: Appointment[] = [
  { id: "a1", clinicId: "c1", patientId: "p1", doctorId: "u2", date: new Date().toISOString().slice(0,10), time: "10:00", duration: 60, reason: "Лечение кариеса 16", status: "scheduled" },
  { id: "a2", clinicId: "c1", patientId: "p2", doctorId: "u3", date: new Date().toISOString().slice(0,10), time: "11:30", duration: 90, reason: "Консультация по протезированию", status: "scheduled" },
  { id: "a3", clinicId: "c2", patientId: "p3", doctorId: "u5", date: new Date().toISOString().slice(0,10), time: "09:00", duration: 45, reason: "Профгигиена", status: "done" },
];

export const INIT_RECEIPTS: Receipt[] = [
  { id: "r1", clinicId: "c1", patientId: "p1", doctorId: "u2", date: new Date().toISOString().slice(0,10), items: [{ serviceId: "s3", name: "Лечение кариеса (1 поверхность)", price: 15000, qty: 1 }], discount: 0, payMethod: "QR-оплата", status: "paid", total: 15000 },
  { id: "r2", clinicId: "c2", patientId: "p3", doctorId: "u5", date: new Date().toISOString().slice(0,10), items: [{ serviceId: "s13", name: "Профгигиена полости рта", price: 18000, qty: 1 }], discount: 5, payMethod: "Наличные", status: "paid", total: 17100 },
];

export const ALL_SERVICES: Service[] = [
  { id:"s1",  cat:"Консультации",  name:"Первичная консультация",                  price:3000 },
  { id:"s2",  cat:"Консультации",  name:"Повторная консультация",                   price:2000 },
  { id:"s3",  cat:"Терапия",       name:"Лечение кариеса (1 поверхность)",          price:15000 },
  { id:"s4",  cat:"Терапия",       name:"Лечение кариеса (2 поверхности)",          price:20000 },
  { id:"s5",  cat:"Терапия",       name:"Лечение кариеса (3 поверхности)",          price:25000 },
  { id:"s6",  cat:"Эндодонтия",    name:"Лечение пульпита (1 канал)",               price:30000 },
  { id:"s7",  cat:"Эндодонтия",    name:"Лечение пульпита (2 канала)",              price:40000 },
  { id:"s8",  cat:"Эндодонтия",    name:"Лечение пульпита (3 канала)",              price:50000 },
  { id:"s9",  cat:"Хирургия",      name:"Удаление зуба (простое)",                  price:12000 },
  { id:"s10", cat:"Хирургия",      name:"Удаление зуба (сложное)",                  price:25000 },
  { id:"s11", cat:"Ортопедия",     name:"Коронка металлокерамика",                  price:45000 },
  { id:"s12", cat:"Ортопедия",     name:"Коронка диоксид циркония",                 price:80000 },
  { id:"s13", cat:"Гигиена",       name:"Профгигиена полости рта",                  price:18000 },
  { id:"s14", cat:"Гигиена",       name:"Отбеливание (кабинетное)",                 price:45000 },
  { id:"s15", cat:"Диагностика",   name:"Рентген прицельный",                       price:2000 },
  { id:"s16", cat:"Диагностика",   name:"Панорамный снимок ОПТГ",                   price:7000 },
  { id:"s17", cat:"Анестезия",     name:"Аппликационная анестезия",                 price:1500 },
  { id:"s18", cat:"Анестезия",     name:"Инфильтрационная анестезия",               price:3000 },
  { id:"s19", cat:"Ортодонтия",    name:"Консультация ортодонта",                   price:5000 },
  { id:"s20", cat:"Ортодонтия",    name:"Установка брекет-системы (1 челюсть)",     price:150000 },
  { id:"s21", cat:"Детская",       name:"Лечение молочного зуба",                   price:10000 },
  { id:"s22", cat:"Детская",       name:"Удаление молочного зуба",                  price:5000 },
  { id:"s23", cat:"Имплантация",   name:"Установка импланта (без коронки)",         price:200000 },
  { id:"s24", cat:"Имплантация",   name:"Коронка на имплант (цирконий)",            price:90000 },
  { id:"s25", cat:"Пародонтология",name:"Кюретаж закрытый (1 сегмент)",             price:20000 },
  { id:"s26", cat:"Wax-Up",        name:"Цифровой Wax-Up (1 зуб)",                  price:15000 },
  { id:"s27", cat:"Smile Design",  name:"Планирование улыбки",                      price:35000 },
  { id:"s28", cat:"Лаборатория",   name:"Временная коронка",                        price:8000 },
];

export const PAY_METHODS = ["Наличные", "QR-оплата", "Рассрочка", "Банковская карта", "Перевод"] as const;

export const PLANS = {
  starter: { name: "Starter", price: "0 ₸", maxDoctors: 1, color: T.sapphire, features: ["До 100 пациентов", "1 пользователь", "Расписание", "Без AI"] },
  professional: { name: "Professional", price: "49 900 ₸/мес", maxDoctors: 10, color: T.gold, features: ["Безлимит пациентов", "До 10 пользователей", "AI 100/мес", "Аналитика"] },
  pro: { name: "Professional", price: "49 900 ₸/мес", maxDoctors: 10, color: T.gold, features: ["Безлимит пациентов", "До 10 пользователей", "AI 100/мес", "Аналитика"] },
  enterprise: { name: "Enterprise", price: "149 900 ₸/мес", maxDoctors: 999, color: T.purple, features: ["Безлимит AI", "Мульти-клиника", "Приоритетная поддержка", "SLA"] }
} as const;

export const HOURS = ["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30","20:00"] as const;

export const TOOTH_STATUS = {
  healthy:{l:"Здоров",c:"#27AE60"},
  caries:{l:"Кариес",c:"#F39C12"},
  filled:{l:"Пломба",c:"#2980B9"},
  crown:{l:"Коронка",c:"#8E44AD"},
  missing:{l:"Отсутствует",c:"#E74C3C"},
  root:{l:"Корень",c:"#E67E22"},
  implant:{l:"Имплант",c:"#00BCD4"},
  veneer:{l:"Винир",c:"#E91E8C"}
} as const;

export const UPPER = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28] as const;
export const LOWER = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38] as const;
export const TOOTH_SURFACES = ["M", "O", "D", "B", "L"] as const;

export const APPOINTMENT_STATUS = {
  scheduled: { l: "Запланирован", label: "Запланирован", dot: T.sapphire, bg: `${T.sapphire}12` },
  confirmed: { l: "Подтверждён", label: "Подтверждён", dot: T.emerald, bg: `${T.emerald}12` },
  arrived: { l: "Пришёл", label: "Пришёл", dot: T.amber, bg: `${T.amber}12` },
  in_chair: { l: "В кресле", label: "В кресле", dot: T.gold, bg: `${T.gold}15` },
  reminderSent: { l: "Напоминание отправлено", label: "Напоминание", dot: T.amber, bg: `${T.amber}12` },
  done: { l: "Завершён", label: "Завершён", dot: T.emerald, bg: `${T.emerald}10` },
  cancelled: { l: "Отменён", label: "Отменён", dot: T.ruby, bg: `${T.ruby}10` },
  noShow: { l: "Неявка", label: "Неявка", dot: T.ruby, bg: `${T.ruby}15` }
} as const;

export const PATIENT_CATEGORY = {
  new: { l: "Новый", c: T.emerald },
  regular: { l: "Постоянный", c: T.gold },
  vip: { l: "VIP", c: T.purple },
  debt: { l: "Должник", c: T.ruby }
} as const;

export const LAB_STATUS = {
  pending: { l: "Заказано", c: T.slate },
  inProgress: { l: "В работе", c: T.amber },
  ready: { l: "Готово", c: T.emerald },
  delivered: { l: "Выдано", c: T.gold }
} as const;

export const PHOTO_CATEGORIES = {
  smile: "Улыбка",
  face: "Лицо",
  intraoral: "Интраоральные",
  xray: "Рентген",
  documents: "Документы"
} as const;

export const SPECIALTIES = [
  "Терапевт", "Ортопед", "Хирург", "Ортодонт",
  "Пародонтолог", "Детский стоматолог", "Имплантолог", "Эндодонтист"
] as const;

export const PROMOTION_STATUS = {
  active:   { l: "Активна", c: T.emerald },
  inactive: { l: "Неактивна", c: T.slate },
  expired:  { l: "Истекла", c: T.ruby },
} as const;

export const BOOKING_STATUS = {
  pending:   { l: "Ожидает", c: T.amber, dot: T.amber },
  confirmed: { l: "Подтверждена", c: T.emerald, dot: T.emerald },
  cancelled: { l: "Отменена", c: T.ruby, dot: T.ruby },
  completed: { l: "Завершена", c: T.sapphire, dot: T.sapphire },
} as const;

export const INVENTORY_CATEGORIES = [
  "Расходные материалы", "Инструменты", "Анестетики", "Лекарства",
  "Ортопедия", "Ортодонтия", "Гигиена", "Рентген", "Лаборатория", "Прочее",
] as const;

export const INVENTORY_UNITS = [
  { value: "шт", label: "Шт." },
  { value: "уп", label: "Уп." },
  { value: "пар", label: "Пар" },
  { value: "набор", label: "Набор" },
  { value: "фл", label: "Фл." },
  { value: "мл", label: "мл" },
  { value: "г", label: "г" },
  { value: "кг", label: "кг" },
  { value: "коробка", label: "Коробка" },
] as const;

export const VISIBILITY_OPTIONS = [
  { value: "public", label: "Публичный — виден на сайте" },
  { value: "private", label: "Приватный — только в CRM" },
] as const;

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

export const DOC_TYPES = [
  'Согласие на лечение', 'Согласие на анестезию', 'Согласие на операцию',
  'Медицинское заключение', 'Справка', 'Рецепт', 'Направление',
  'Эпикриз', 'Договор', 'Претензия', 'Другое'
] as const;

export const DOC_STATUS = {
  draft:   { l: 'Черновик', c: T.slate },
  active:  { l: 'Действующий', c: T.emerald },
  archived:{ l: 'Архив', c: T.sapphire },
} as const;

export const AUDIT_ACTIONS = {
  create_patient:    { l: 'Создал пациента', c: T.emerald },
  update_patient:    { l: 'Обновил пациента', c: T.sapphire },
  delete_patient:    { l: 'Удалил пациента', c: T.ruby },
  create_visit:      { l: 'Добавил посещение', c: T.gold },
  backup:            { l: 'Резервное копирование', c: T.teal },
} as const;
