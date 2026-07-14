// ═══════════════════════════════════════════════════════════════════
// DESIGN TOKENS & GLOBAL STYLES
// ═══════════════════════════════════════════════════════════════════

export const T = {
  bg:       "#080F1A",
  navy:     "#0D1B2E",
  navyL:    "#132540",
  card:     "rgba(255,255,255,0.035)",
  cardHov:  "rgba(255,255,255,0.06)",
  gold:     "#C9A96E",
  goldL:    "#E2C898",
  goldDim:  "#8B6F3E",
  border:   "rgba(201,169,110,0.15)",
  borderSub:"rgba(255,255,255,0.06)",
  white:    "#FFFFFF",
  slate:    "#7A8899",
  slateL:   "#B0BEC5",
  emerald:  "#27AE60",
  ruby:     "#E74C3C",
  amber:    "#F39C12",
  sapphire: "#2980B9",
  purple:   "#8E44AD",
  cyan:     "#00BCD4",
  pink:     "#E91E8C",
  teal:     "#009688",
  orange:   "#FF5722",
};

// Цвета для категорий и статусов
export const COLORS = {
  primary: T.gold,
  secondary: T.sapphire,
  success: T.emerald,
  danger: T.ruby,
  warning: T.amber,
  info: T.cyan,
  patientNew: T.pink,
  patientRegular: T.teal,
  patientVip: T.purple,
  appointmentConfirmed: T.emerald,
  appointmentPending: T.amber,
  appointmentCancelled: T.ruby,
  appointmentCompleted: T.cyan,
};

export const GLOBAL_CSS = `
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Inter',system-ui,sans-serif;background:${T.bg};color:${T.white};-webkit-font-smoothing:antialiased;}
  input,select,textarea{font-family:inherit;background:rgba(255,255,255,0.05);border:1px solid ${T.border};color:${T.white};border-radius:8px;padding:10px 13px;font-size:13px;width:100%;outline:none;transition:border-color .2s;}
  input:focus,select:focus,textarea:focus{border-color:${T.gold};}
  input::placeholder,textarea::placeholder{color:${T.slate};}
  select option{background:${T.navy};color:${T.white};}
  button{cursor:pointer;font-family:inherit;}
  ::-webkit-scrollbar{width:4px;}
  ::-webkit-scrollbar-track{background:transparent;}
  ::-webkit-scrollbar-thumb{background:${T.goldDim};border-radius:4px;}
  @media(max-width:768px){
    .sidebar{display:none!important;}
    .mobile-nav{display:flex!important;}
    .main-content{padding:16px!important;}
    .page-header{flex-direction:column!important;gap:10px!important;align-items:flex-start!important;}
    .grid-2{grid-template-columns:1fr!important;}
    .grid-3{grid-template-columns:1fr 1fr!important;}
    .hide-mobile{display:none!important;}
    .chat-sidebar{display:none!important;}
  }
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
  @keyframes pulse{0%,80%,100%{transform:scale(.6);opacity:.4;}40%{transform:scale(1);opacity:1;}}
  @keyframes spin{to{transform:rotate(360deg);}}
  @keyframes slideIn{from{transform:translateX(-100%);}to{transform:translateX(0);}}
  .fade-in{animation:fadeIn .25s ease;}
  .slide-in{animation:slideIn .3s ease;}
`;

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS & INITIAL DATA
// ═══════════════════════════════════════════════════════════════════

export const SUPER_ADMIN = { 
  id: "sa", 
  login: "dr.tamirlan", 
  role: "superadmin", 
  name: "Dr. Tamirlan" 
};

export const INIT_CLINICS = [
  { id: "c1", name: "DentVision Тараз — Центр", city: "Тараз", address: "ул. Толе би, 32", phone: "+7 726 222-33-44", plan: "pro", active: true, createdAt: "2025-01-01", color: "#C9A96E", country: "KZ", currency: "KZT", locale: "ru-KZ" },
  { id: "c2", name: "DentVision Тараз — Север", city: "Тараз", address: "мкр. Мирас, 15", phone: "+7 726 255-11-22", plan: "starter", active: true, createdAt: "2025-03-15", color: "#3498DB", country: "KZ", currency: "KZT", locale: "ru-KZ" },
];

export const INIT_USERS = [
  { id: "u1", clinicId: "c1", login: "admin_c1",   role: "admin",     name: "Анна Королёва",           phone: "+77161234567" },
  { id: "u2", clinicId: "c1", login: "doc1_c1",    role: "doctor",    name: "Иванова Мария Сергеевна", spec: "Терапевт",   phone: "+77031112233" },
  { id: "u3", clinicId: "c1", login: "doc2_c1",    role: "doctor",    name: "Петров Алексей Иванович", spec: "Ортопед",    phone: "+77017778899" },
  { id: "u6", clinicId: "c1", login: "dir_c1",     role: "director",  name: "Нурлан Бекжан",           phone: "+77011234567" },
  { id: "u7", clinicId: "c1", login: "assist_c1",  role: "assistant", name: "Карина Омарова",          spec: "Ассистент",  phone: "+77055551234" },
  { id: "u4", clinicId: "c2", login: "admin_c2",   role: "admin",     name: "Борис Сейткали",          phone: "+77261234567" },
  { id: "u5", clinicId: "c2", login: "doc1_c2",    role: "doctor",    name: "Сидорова Елена Юрьевна", spec: "Терапевт",   phone: "+77265554433" },
];

export const INIT_PATIENTS = [
  { id: "p1", clinicId: "c1", name: "Смирнова Ольга Николаевна", dob: "1985-03-12", phone: "77161234567", address: "Тараз, ул. Ленина, 5", notes: "Аллергия на лидокаин", teeth: { 16: "caries", 26: "filled" } },
  { id: "p2", clinicId: "c1", name: "Громов Игорь Петрович", dob: "1970-07-25", phone: "77031112233", address: "Тараз, ул. Мира, 12", notes: "", teeth: { 46: "missing" } },
  { id: "p3", clinicId: "c2", name: "Белова Татьяна Викторовна", dob: "1992-11-08", phone: "77265554433", address: "Тараз, мкр. Мирас, 5", notes: "", teeth: {} },
];

export const INIT_APPOINTMENTS = [
  { id: "a1", clinicId: "c1", patientId: "p1", doctorId: "u2", date: new Date().toISOString().slice(0,10), time: "10:00", duration: 60, reason: "Лечение кариеса 16", status: "scheduled" },
  { id: "a2", clinicId: "c1", patientId: "p2", doctorId: "u3", date: new Date().toISOString().slice(0,10), time: "11:30", duration: 90, reason: "Консультация по протезированию", status: "scheduled" },
  { id: "a3", clinicId: "c2", patientId: "p3", doctorId: "u5", date: new Date().toISOString().slice(0,10), time: "09:00", duration: 45, reason: "Профгигиена", status: "done" },
];

export const INIT_RECEIPTS = [
  { id: "r1", clinicId: "c1", patientId: "p1", doctorId: "u2", date: new Date().toISOString().slice(0,10), items: [{ serviceId: "s3", name: "Лечение кариеса (1 поверхность)", price: 15000, qty: 1 }], discount: 0, payMethod: "Kaspi QR", status: "paid", total: 15000 },
  { id: "r2", clinicId: "c2", patientId: "p3", doctorId: "u5", date: new Date().toISOString().slice(0,10), items: [{ serviceId: "s13", name: "Профгигиена полости рта", price: 18000, qty: 1 }], discount: 5, payMethod: "Наличные", status: "paid", total: 17100 },
];

export const ALL_SERVICES = [
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

export const PAY_METHODS = ["Наличные", "Kaspi QR", "Kaspi рассрочка", "Банковская карта", "Перевод"];

export const PLANS = { 
  starter: { name: "Starter", price: "15 000 ₸/мес", maxDoctors: 2, color: T.sapphire, features: ["До 2 врачей", "Расписание", "Пациенты", "Касса"] }, 
  pro: { name: "Pro", price: "35 000 ₸/мес", maxDoctors: 10, color: T.gold, features: ["До 10 врачей", "AI-команда", "Аналитика", "Фотопротокол", "3D Odontogram"] }, 
  enterprise: { name: "Enterprise", price: "По запросу", maxDoctors: 999, color: T.purple, features: ["Безлимит врачей", "API доступ", "White label", "Персональный менеджер"] }
};

export const HOURS = ["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30","20:00"];

export const TOOTH_STATUS = { 
  healthy:{l:"Здоров",c:"#27AE60"}, 
  caries:{l:"Кариес",c:"#F39C12"}, 
  filled:{l:"Пломба",c:"#2980B9"}, 
  crown:{l:"Коронка",c:"#8E44AD"}, 
  missing:{l:"Отсутствует",c:"#E74C3C"}, 
  root:{l:"Корень",c:"#E67E22"},
  implant:{l:"Имплант",c:"#00BCD4"},
  veneer:{l:"Винир",c:"#E91E8C"}
};

export const UPPER = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
export const LOWER = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];

// Поверхности зубов для 3D odontogram
export const TOOTH_SURFACES = ["M", "O", "D", "B", "L"]; // Mesial, Occlusal, Distal, Buccal, Lingual

export const APPOINTMENT_STATUS = {
  scheduled: { l: "Запланирован", dot: T.sapphire, bg: `${T.sapphire}12` },
  confirmed: { l: "Подтверждён", dot: T.emerald, bg: `${T.emerald}12` },
  reminderSent: { l: "Напоминание отправлено", dot: T.amber, bg: `${T.amber}12` },
  done: { l: "Завершён", dot: T.emerald, bg: `${T.emerald}10` },
  cancelled: { l: "Отменён", dot: T.ruby, bg: `${T.ruby}10` },
  noShow: { l: "Неявка", dot: T.ruby, bg: `${T.ruby}15` }
};

export const PATIENT_CATEGORY = {
  new: { l: "Новый", c: T.emerald },
  regular: { l: "Постоянный", c: T.gold },
  vip: { l: "VIP", c: T.purple },
  debt: { l: "Должник", c: T.ruby }
};

export const LAB_STATUS = {
  pending: { l: "Заказано", c: T.slate },
  inProgress: { l: "В работе", c: T.amber },
  ready: { l: "Готово", c: T.emerald },
  delivered: { l: "Выдано", c: T.gold }
};

export const PHOTO_CATEGORIES = {
  smile: "Улыбка",
  face: "Лицо",
  intraoral: "Интраоральные",
  xray: "Рентген",
  documents: "Документы"
};

export const SPECIALTIES = [
  "Терапевт", "Ортопед", "Хирург", "Ортодонт", 
  "Пародонтолог", "Детский стоматолог", "Имплантолог", "Эндодонтист"
];

// ═══════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

export function today() { 
  return new Date().toISOString().slice(0,10); 
}

export function fd(d) { 
  if(!d) return ""; 
  const [y,m,day] = d.split("-"); 
  return `${day}.${m}.${y}`; 
}

export function ft(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  return `${h}:${m}`;
}

export const CIS_CURRENCY_BY_COUNTRY = {
  KZ: { currency: "KZT", locale: "ru-KZ" },
  RU: { currency: "RUB", locale: "ru-RU" },
  KG: { currency: "KGS", locale: "ru-KG" },
  UZ: { currency: "UZS", locale: "ru-UZ" },
  TJ: { currency: "TJS", locale: "ru-TJ" },
  AZ: { currency: "AZN", locale: "az-AZ" },
  AM: { currency: "AMD", locale: "hy-AM" },
  BY: { currency: "BYN", locale: "ru-BY" },
  MD: { currency: "MDL", locale: "ro-MD" },
};

export function getClinicCurrency(clinic) {
  const countryDefaults = CIS_CURRENCY_BY_COUNTRY[clinic?.country];
  return {
    currency: clinic?.currency || countryDefaults?.currency || "KZT",
    locale: clinic?.locale || countryDefaults?.locale || "ru-KZ",
  };
}

export function formatMoney(n, clinicOrCurrency) {
  const settings = typeof clinicOrCurrency === "string"
    ? { currency: clinicOrCurrency, locale: "ru-RU" }
    : getClinicCurrency(clinicOrCurrency);
  return new Intl.NumberFormat(settings.locale, {
    style: "currency",
    currency: settings.currency,
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);
}

export function tg(n, clinicOrCurrency) {
  return formatMoney(n, clinicOrCurrency);
}

export function gid() { 
  // Используем crypto.randomUUID() для гарантированной уникальности
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback для старых браузеров
  return Date.now().toString(36) + Math.random().toString(36).slice(2,5); 
}

export function calculateAge(dob) {
  if (!dob) return "";
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function formatPhone(phone) {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11 && cleaned.startsWith("7")) {
    return `+7 (${cleaned.slice(1,4)}) ${cleaned.slice(4,7)}-${cleaned.slice(7,9)}-${cleaned.slice(9)}`;
  }
  return phone;
}

export function getNextAvailableSlot(appointments, date, doctorId) {
  const dayAppts = appointments.filter(a => a.date === date && a.doctorId === doctorId && a.status !== "cancelled");
  const bookedTimes = dayAppts.map(a => a.time);
  return HOURS.find(h => !bookedTimes.includes(h)) || null;
}

export function getWeekStart(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff)).toISOString().slice(0, 10);
}

export function getMonthStart(dateStr) {
  const date = new Date(dateStr);
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}

export function addDays(dateStr, days) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatDateRange(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const options = { day: 'numeric', month: 'long' };
  return `${startDate.toLocaleDateString('ru-RU', options)} — ${endDate.toLocaleDateString('ru-RU', options)}`;
}

// Snake/Camel case conversion for Supabase
export const FIELD_MAP = {
  clinics:      { camelToSnake: { createdAt: "created_at" } },
  users:        { camelToSnake: { clinicId: "clinic_id", spec: "spec", photoUrl: "photo_url", visibility: "visibility", experienceYears: "experience_years" } },
  patients:     { camelToSnake: { clinicId: "clinic_id" } },
  appointments: { camelToSnake: { clinicId: "clinic_id", patientId: "patient_id", doctorId: "doctor_id" } },
  treatments:   { camelToSnake: { clinicId: "clinic_id", patientId: "patient_id", doctorId: "doctor_id" } },
  receipts:     { camelToSnake: { clinicId: "clinic_id", patientId: "patient_id", doctorId: "doctor_id", payMethod: "pay_method" } },
  subscriptions:{ camelToSnake: { clinicId: "clinic_id", startDate: "start_date", endDate: "end_date", nextBilling: "next_billing" } },
  labOrders:    { camelToSnake: { clinicId: "clinic_id", patientId: "patient_id", doctorId: "doctor_id", dueDate: "due_date" } },
  photos:       { camelToSnake: { clinicId: "clinic_id", patientId: "patient_id", uploadDate: "upload_date" } },
  expenses:     { camelToSnake: { clinicId: "clinic_id", categoryId: "category_id", createdAt: "created_at" } },
  inventory:    { camelToSnake: { clinicId: "clinic_id", lastOrder: "last_order", minQuantity: "min_quantity", expiryDate: "expiry_date" } },
  promotions:   { camelToSnake: { clinicId: "clinic_id", discountPercent: "discount_percent", serviceIds: "service_ids", startDate: "start_date", endDate: "end_date", imageUrl: "image_url", createdAt: "created_at" } },
  bookings:     { camelToSnake: { clinicId: "clinic_id", patientName: "patient_name", doctorId: "doctor_id", serviceName: "service_name", createdAt: "created_at" } },
};

export function toSnakeRow(table, obj) {
  const map = FIELD_MAP[table]?.camelToSnake || {};
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[map[k] || k] = v;
  return out;
}

export function toCamelRow(table, obj) {
  const map = FIELD_MAP[table]?.camelToSnake || {};
  const reverse = Object.fromEntries(Object.entries(map).map(([a,b])=>[b,a]));
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) out[reverse[k] || k] = v;
  return out;
}

// In-memory cache for session
export const MEM_CACHE = {};

// ═══════════════════════════════════════════════════════════════════
// PROMOTIONS, BOOKING, INVENTORY CONSTANTS
// ═══════════════════════════════════════════════════════════════════

export const PROMOTION_STATUS = {
  active:   { l: "Активна", c: T.emerald },
  inactive: { l: "Неактивна", c: T.slate },
  expired:  { l: "Истекла", c: T.ruby },
};

export const BOOKING_STATUS = {
  pending:   { l: "Ожидает", c: T.amber, dot: T.amber },
  confirmed: { l: "Подтверждена", c: T.emerald, dot: T.emerald },
  cancelled: { l: "Отменена", c: T.ruby, dot: T.ruby },
  completed: { l: "Завершена", c: T.sapphire, dot: T.sapphire },
};

export const INVENTORY_CATEGORIES = [
  "Расходные материалы",
  "Инструменты",
  "Анестетики",
  "Лекарства",
  "Ортопедия",
  "Ортодонтия",
  "Гигиена",
  "Рентген",
  "Лаборатория",
  "Прочее",
];

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
];

export const VISIBILITY_OPTIONS = [
  { value: "public", label: "Публичный — виден на сайте" },
  { value: "private", label: "Приватный — только в CRM" },
];
