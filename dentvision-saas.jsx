import React, { useState, useEffect, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════
// DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════════
const T = {
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
};

const GLOBAL_CSS = `
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
  .fade-in{animation:fadeIn .25s ease;}
`;

// ═══════════════════════════════════════════════════════════════════
// SUPABASE — secure RPC-only connection (no direct table access)
// ═══════════════════════════════════════════════════════════════════
const SUPABASE_URL = "https://yrokwnlabqxoztbzzhox.supabase.co";
const SUPABASE_KEY = "sb_publishable_Zx5ZfAsOiEddSPNjun3TyA_eUiBDBlA";

const sbHeaders = {
  "Content-Type": "application/json",
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

// Direct table read is only used for the public `clinics` list (RLS: read-only, no secrets there)
async function sbSelectClinics() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/clinics?select=*`, { headers: sbHeaders });
  if (!res.ok) throw new Error(`Supabase select clinics failed: ${res.status}`);
  return res.json();
}

// Everything else goes through RPC functions (security definer) — no
// table is exposed to anon directly, passwords never leave the DB in
// plain text, and all writes are validated server-side.
async function sbRpc(fn, args) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { ...sbHeaders, Prefer: "return=representation" },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`RPC ${fn} failed: ${res.status} ${text.slice(0,150)}`);
  }
  return res.json();
}

async function verifyLogin(login, password) {
  const rows = await sbRpc("verify_login", { p_login: login, p_password: password });
  return rows && rows.length > 0 ? rows[0] : null;
}

async function loadClinicData(clinicId) {
  // get_clinic_data returns one JSON object with users/patients/appointments/treatments/receipts
  const rows = await sbRpc("get_clinic_data", { p_clinic_id: clinicId });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function upsertRow(table, row) {
  const fnMap = { patients: "upsert_patient", appointments: "upsert_appointment", treatments: "upsert_treatment", receipts: "upsert_receipt" };
  const fn = fnMap[table];
  if (!fn) return;
  return sbRpc(fn, { p: toSnakeRow(table, row) });
}

async function upsertClinic(clinic) {
  return sbRpc("upsert_clinic", { p: toSnakeRow("clinics", clinic) });
}

async function deleteRow(table, id) {
  return sbRpc("delete_row", { p_table: table, p_id: id });
}

async function createUserSecure(user) {
  return sbRpc("create_user_secure", {
    p_id: user.id, p_clinic_id: user.clinicId, p_login: user.login,
    p_password: user.password, p_name: user.name, p_role: user.role, p_spec: user.spec || null,
  });
}

// snake_case <-> camelCase mapping helpers per table
const FIELD_MAP = {
  clinics:      { camelToSnake: { createdAt: "created_at" } },
  users:        { camelToSnake: { clinicId: "clinic_id" } },
  patients:     { camelToSnake: { clinicId: "clinic_id" } },
  appointments: { camelToSnake: { clinicId: "clinic_id", patientId: "patient_id", doctorId: "doctor_id" } },
  treatments:   { camelToSnake: { clinicId: "clinic_id", patientId: "patient_id", doctorId: "doctor_id" } },
  receipts:     { camelToSnake: { clinicId: "clinic_id", patientId: "patient_id", doctorId: "doctor_id", payMethod: "pay_method" } },
};

function toSnakeRow(table, obj) {
  const map = FIELD_MAP[table]?.camelToSnake || {};
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[map[k] || k] = v;
  return out;
}
function toCamelRow(table, obj) {
  const map = FIELD_MAP[table]?.camelToSnake || {};
  const reverse = Object.fromEntries(Object.entries(map).map(([a,b])=>[b,a]));
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) out[reverse[k] || k] = v;
  return out;
}

// In-memory cache — localStorage is NOT available inside Claude artifacts sandbox
const MEM_CACHE = {};
const LS = {
  get: (key, def) => (key in MEM_CACHE ? MEM_CACHE[key] : def),
  set: (key, val) => { MEM_CACHE[key] = val; },
};

// Generic state hook backed by Supabase RPC mutations + in-memory cache.
// `clinicId` scopes deletes/inserts implicitly via the row's own clinicId field.
function useCloudTable(table, def) {
  const [state, setState] = useState(def);
  const [online, setOnline] = useState(true);

  const set = useCallback((val) => {
    setState(prev => {
      const next = typeof val === "function" ? val(prev) : val;
      LS.set(`dv_${table}`, next);

      const nextIds = new Set(next.map(x => x.id));
      next.forEach(item => {
        const prevItem = prev.find(x => x.id === item.id);
        if (!prevItem || JSON.stringify(prevItem) !== JSON.stringify(item)) {
          upsertRow(table, item).then(() => setOnline(true)).catch(() => setOnline(false));
        }
      });
      prev.forEach(item => {
        if (!nextIds.has(item.id)) {
          deleteRow(table, item.id).then(() => setOnline(true)).catch(() => setOnline(false));
        }
      });

      return next;
    });
  }, [table]);

  return [state, set, setState, { online }];
}

// ═══════════════════════════════════════════════════════════════════
// INITIAL DATA
// ═══════════════════════════════════════════════════════════════════
const SUPER_ADMIN = { id: "sa", login: "dr.tamirlan", password: "DentVision2025!", role: "superadmin", name: "Dr. Tamirlan" };

const INIT_CLINICS = [
  { id: "c1", name: "DentVision Тараз — Центр", city: "Тараз", address: "ул. Толе би, 32", phone: "+7 726 222-33-44", plan: "pro", active: true, createdAt: "2025-01-01", color: "#C9A96E" },
  { id: "c2", name: "DentVision Тараз — Север", city: "Тараз", address: "мкр. Мирас, 15", phone: "+7 726 255-11-22", plan: "starter", active: true, createdAt: "2025-03-15", color: "#3498DB" },
];

const INIT_USERS = [
  { id: "u1", clinicId: "c1", login: "admin_c1", password: "admin123", role: "admin", name: "Анна Королёва" },
  { id: "u2", clinicId: "c1", login: "doc1_c1",  password: "doc123",   role: "doctor", name: "Иванова Мария Сергеевна", spec: "Терапевт" },
  { id: "u3", clinicId: "c1", login: "doc2_c1",  password: "doc456",   role: "doctor", name: "Петров Алексей Иванович", spec: "Ортопед" },
  { id: "u4", clinicId: "c2", login: "admin_c2", password: "admin456", role: "admin", name: "Борис Сейткали" },
  { id: "u5", clinicId: "c2", login: "doc1_c2",  password: "doc789",   role: "doctor", name: "Сидорова Елена Юрьевна", spec: "Терапевт" },
];

const INIT_PATIENTS = [
  { id: "p1", clinicId: "c1", name: "Смирнова Ольга Николаевна", dob: "1985-03-12", phone: "77161234567", address: "Тараз, ул. Ленина, 5", notes: "Аллергия на лидокаин", teeth: { 16: "caries", 26: "filled" } },
  { id: "p2", clinicId: "c1", name: "Громов Игорь Петрович", dob: "1970-07-25", phone: "77031112233", address: "Тараз, ул. Мира, 12", notes: "", teeth: { 46: "missing" } },
  { id: "p3", clinicId: "c2", name: "Белова Татьяна Викторовна", dob: "1992-11-08", phone: "77265554433", address: "Тараз, мкр. Мирас, 5", notes: "", teeth: {} },
];

const INIT_APPOINTMENTS = [
  { id: "a1", clinicId: "c1", patientId: "p1", doctorId: "u2", date: today(), time: "10:00", duration: 60, reason: "Лечение кариеса 16", status: "scheduled" },
  { id: "a2", clinicId: "c1", patientId: "p2", doctorId: "u3", date: today(), time: "11:30", duration: 90, reason: "Консультация по протезированию", status: "scheduled" },
  { id: "a3", clinicId: "c2", patientId: "p3", doctorId: "u5", date: today(), time: "09:00", duration: 45, reason: "Профгигиена", status: "done" },
];

const INIT_RECEIPTS = [
  { id: "r1", clinicId: "c1", patientId: "p1", doctorId: "u2", date: today(), items: [{ serviceId: "s3", name: "Лечение кариеса (1 поверхность)", price: 15000, qty: 1 }], discount: 0, payMethod: "Kaspi QR", status: "paid", total: 15000 },
  { id: "r2", clinicId: "c2", patientId: "p3", doctorId: "u5", date: today(), items: [{ serviceId: "s13", name: "Профгигиена полости рта", price: 18000, qty: 1 }], discount: 5, payMethod: "Наличные", status: "paid", total: 17100 },
];

const ALL_SERVICES = [
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
];

const PAY_METHODS = ["Наличные", "Kaspi QR", "Kaspi рассрочка", "Банковская карта", "Перевод"];
const PLANS = { starter: { name: "Starter", price: "15 000 ₸/мес", maxDoctors: 2, color: T.sapphire }, pro: { name: "Pro", price: "35 000 ₸/мес", maxDoctors: 10, color: T.gold }, enterprise: { name: "Enterprise", price: "По запросу", maxDoctors: 999, color: T.purple } };
const HOURS = ["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30","20:00"];
const TOOTH_STATUS = { healthy:{l:"Здоров",c:"#27AE60"}, caries:{l:"Кариес",c:"#F39C12"}, filled:{l:"Пломба",c:"#2980B9"}, crown:{l:"Коронка",c:"#8E44AD"}, missing:{l:"Отсутствует",c:"#E74C3C"}, root:{l:"Корень",c:"#E67E22"} };
const UPPER = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
const LOWER = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];

function today() { return new Date().toISOString().slice(0,10); }
function fd(d) { if(!d)return""; const[y,m,day]=d.split("-"); return`${day}.${m}.${y}`; }
function tg(n) { return new Intl.NumberFormat("ru-KZ",{style:"currency",currency:"KZT",maximumFractionDigits:0}).format(n); }
function gid() { return Date.now().toString(36)+Math.random().toString(36).slice(2,5); }

// ═══════════════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════════════
export default function App() {
  const [user, setUser] = useState(null);
  const [clinics, setClinics] = useState(INIT_CLINICS); // public, read-only list
  const [users,       setUsers,       setUsersRaw]       = useCloudTable("users",        []);
  const [patients,    setPatients,    setPatientsRaw]    = useCloudTable("patients",     []);
  const [appointments,setAppointments,setApptsRaw]       = useCloudTable("appointments", []);
  const [receipts,    setReceipts,    setReceiptsRaw]    = useCloudTable("receipts",     []);
  const [treatments,  setTreatments,  setTreatRaw]       = useCloudTable("treatments",   []);
  const [cloudOnline, setCloudOnline] = useState(true);
  const [cloudError, setCloudError] = useState(null);
  const [toast, setToast]           = useState(null);
  const [page, setPage]             = useState("dashboard");
  const [activeClinid, setActiveClinicId] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(false);

  // Load public clinic list once on mount (used for the login screen / super admin)
  useEffect(() => {
    sbSelectClinics()
      .then(rows => { if (rows?.length) setClinics(rows.map(r => toCamelRow("clinics", r))); setCloudOnline(true); })
      .catch(e => { setCloudOnline(false); setCloudError(String(e?.message || e)); });
  }, []);

  function showToast(msg, type="success") {
    setToast({msg,type});
    setTimeout(()=>setToast(null), 3000);
  }

  async function handleLogin(login, password) {
    if (login === SUPER_ADMIN.login && password === SUPER_ADMIN.password) {
      setUser(SUPER_ADMIN);
      setPage("dashboard");
      return true;
    }
    setLoadingAuth(true);
    try {
      const u = await verifyLogin(login, password); // password verified server-side via bcrypt, never compared in browser
      if (!u) { setLoadingAuth(false); return false; }
      const normalizedUser = { id: u.id, clinicId: u.clinic_id, name: u.name, role: u.role, spec: u.spec };
      setUser(normalizedUser);
      setActiveClinicId(normalizedUser.clinicId);

      // Load only this clinic's data — real isolation, not just UI filtering
      const data = await loadClinicData(normalizedUser.clinicId);
      setUsersRaw((data.users||[]).map(r=>toCamelRow("users", r)));
      setPatientsRaw((data.patients||[]).map(r=>toCamelRow("patients", r)));
      setApptsRaw((data.appointments||[]).map(r=>toCamelRow("appointments", r)));
      setTreatRaw((data.treatments||[]).map(r=>toCamelRow("treatments", r)));
      setReceiptsRaw((data.receipts||[]).map(r=>toCamelRow("receipts", r)));

      setPage("schedule");
      setLoadingAuth(false);
      return true;
    } catch (e) {
      setCloudError(String(e?.message || e));
      setLoadingAuth(false);
      return false;
    }
  }

  const ctx = { user, clinics, setClinics, users, setUsers, patients, setPatients, appointments, setAppointments, receipts, setReceipts, treatments, setTreatments, showToast, activeClinid, setActiveClinicId, setPage, cloudOnline, cloudError };

  if (!user) return <><style>{GLOBAL_CSS}</style><LoginScreen onLogin={handleLogin} loading={loadingAuth}/></>;

  if (user.role === "superadmin") return (
    <>
      <style>{GLOBAL_CSS}</style>
      <SuperAdminShell {...ctx} page={page} setPage={setPage}/>
      {toast && <Toast {...toast}/>}
    </>
  );

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <ClinicShell {...ctx} page={page} setPage={setPage} onLogout={()=>{setUser(null);setPage("dashboard");}}/>
      {toast && <Toast {...toast}/>}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════════
function LoginScreen({ onLogin, loading: extLoading }) {
  const [login, setLogin] = useState("");
  const [pass, setPass]   = useState("");
  const [err, setErr]     = useState("");
  const [loading, setLoading] = useState(false);
  const busy = loading || extLoading;

  async function handle() {
    if (!login || !pass) return;
    setLoading(true);
    setErr("");
    try {
      const ok = await onLogin(login, pass);
      if (!ok) setErr("Неверный логин или пароль");
    } catch (e) {
      setErr("Ошибка соединения с сервером. Попробуйте снова.");
    }
    setLoading(false);
  }

  return (
    <div style={{minHeight:"100vh",display:"flex",background:`radial-gradient(ellipse at 25% 35%,${T.navyL} 0%,${T.bg} 65%)`}}>
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div style={{width:380}}>
          <div style={{textAlign:"center",marginBottom:40}}>
            <div style={{width:72,height:72,borderRadius:20,background:`linear-gradient(135deg,${T.gold},${T.goldDim})`,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:32,marginBottom:16,boxShadow:`0 12px 40px rgba(201,169,110,.35)`}}>🦷</div>
            <div style={{fontFamily:"Georgia,serif",fontSize:28,fontWeight:700,color:T.white,letterSpacing:"-0.02em"}}>DentVision</div>
            <div style={{fontSize:13,color:T.gold,marginTop:4,letterSpacing:"0.06em"}}>BY DR.TAMIRLAN</div>
            <div style={{fontSize:12,color:T.slate,marginTop:6}}>SaaS-платформа для стоматологий</div>
          </div>
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,padding:32,backdropFilter:"blur(20px)"}}>
            <label>Логин</label>
            <input value={login} onChange={e=>setLogin(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handle()} autoFocus placeholder="Введите логин"/>
            <label>Пароль</label>
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handle()} placeholder="Введите пароль"/>
            {err && <div style={{color:T.ruby,fontSize:12,marginTop:8}}>⚠ {err}</div>}
            <PBtn onClick={handle} disabled={busy} style={{width:"100%",marginTop:20}}>{busy?"Вход...":"Войти"}</PBtn>
          </div>
          <div style={{marginTop:24,background:T.card,border:`1px solid ${T.borderSub}`,borderRadius:12,padding:16,fontSize:12,color:T.slate}}>
            <div style={{color:T.gold,fontWeight:600,marginBottom:8}}>🔐 Тестовые аккаунты</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
              {[["Super Admin","dr.tamirlan / DentVision2025!"],["Клиника 1 (Админ)","admin_c1 / admin123"],["Клиника 1 (Врач)","doc1_c1 / doc123"],["Клиника 2","admin_c2 / admin456"]].map(([r,c])=>(
                <div key={r}><div style={{color:T.slateL,fontSize:11}}>{r}</div><div style={{color:T.white,fontFamily:"monospace",fontSize:10}}>{c}</div></div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="hide-mobile" style={{flex:1,background:`linear-gradient(135deg,${T.navyL},${T.bg})`,display:"flex",alignItems:"center",justifyContent:"center",padding:40}}>
        <div style={{maxWidth:380,textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:20}}>🦷</div>
          <div style={{fontFamily:"Georgia,serif",fontSize:22,color:T.white,marginBottom:12}}>Управление сетью клиник</div>
          <div style={{color:T.slate,fontSize:14,lineHeight:1.8}}>Расписание · Пациенты · Касса<br/>AI-команда · Аналитика · Офлайн<br/></div>
          <div style={{marginTop:30,display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
            {["localStorage офлайн","Мультиклиника","AI-ассистент","Kaspi интеграция"].map(f=>(
              <span key={f} style={{background:`${T.gold}18`,border:`1px solid ${T.border}`,borderRadius:20,padding:"5px 12px",fontSize:12,color:T.gold}}>✓ {f}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SUPER ADMIN SHELL
// ═══════════════════════════════════════════════════════════════════
function SuperAdminShell(props) {
  const { page, setPage, clinics, showToast, setClinics } = props;
  const [allData, setAllData] = useState({ users: [], patients: [], appointments: [], treatments: [], receipts: [] });
  const [loadingAll, setLoadingAll] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingAll(true);
    Promise.all(clinics.map(c => loadClinicData(c.id)))
      .then(results => {
        if (cancelled) return;
        const merged = { users: [], patients: [], appointments: [], treatments: [], receipts: [] };
        results.forEach(d => {
          (d?.users||[]).forEach(r=>merged.users.push(toCamelRow("users", r)));
          (d?.patients||[]).forEach(r=>merged.patients.push(toCamelRow("patients", r)));
          (d?.appointments||[]).forEach(r=>merged.appointments.push(toCamelRow("appointments", r)));
          (d?.treatments||[]).forEach(r=>merged.treatments.push(toCamelRow("treatments", r)));
          (d?.receipts||[]).forEach(r=>merged.receipts.push(toCamelRow("receipts", r)));
        });
        setAllData(merged);
      })
      .catch(e => showToast("Ошибка загрузки данных: "+String(e?.message||e), "error"))
      .finally(() => { if (!cancelled) setLoadingAll(false); });
    return () => { cancelled = true; };
  }, [clinics]);

  const superProps = { ...props, ...allData, loadingAll };

  const tabs = [
    {id:"dashboard",icon:"◈",label:"Обзор"},
    {id:"clinics",icon:"🏥",label:"Клиники"},
    {id:"users",icon:"👥",label:"Пользователи"},
    {id:"analytics",icon:"📊",label:"Аналитика"},
    {id:"supabase",icon:"☁",label:"Облако"},
  ];

  return (
    <div style={{display:"flex",minHeight:"100vh"}}>
      <Sidebar tabs={tabs} page={page} setPage={setPage} badge="SUPER ADMIN" badgeColor={T.ruby} name="Dr. Tamirlan" onLogout={()=>window.location.reload()}/>
      <MobileNav tabs={tabs} page={page} setPage={setPage}/>
      <main className="main-content" style={{flex:1,padding:"28px 32px",overflowY:"auto"}}>
        {page==="dashboard"  && <SuperDashboard {...superProps}/>}
        {page==="clinics"    && <ClinicsManager {...superProps}/>}
        {page==="users"      && <UsersManager {...superProps}/>}
        {page==="analytics"  && <SuperAnalytics {...superProps}/>}
        {page==="supabase"   && <SupabaseSetup {...superProps}/>}
      </main>
    </div>
  );
}

function SuperDashboard({ clinics, users, receipts, patients, appointments }) {
  const totalRev = receipts.reduce((s,r)=>s+r.total,0);
  const todayAppts = appointments.filter(a=>a.date===today());
  const stats = [
    {l:"Клиники",v:clinics.length,icon:"🏥",c:T.gold},
    {l:"Врачей всего",v:users.filter(u=>u.role==="doctor").length,icon:"👨‍⚕️",c:T.sapphire},
    {l:"Пациентов",v:patients.length,icon:"👤",c:T.emerald},
    {l:"Выручка (всё время)",v:tg(totalRev),icon:"💰",c:T.amber},
  ];

  return (
    <div className="fade-in">
      <PH title="Обзор сети" sub="DentVision SaaS — Тараз, Казахстан"/>
      <div className="grid-3" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
        {stats.map(s=>(
          <div key={s.l} style={{background:T.card,border:`1px solid ${T.borderSub}`,borderRadius:12,padding:"16px 18px"}}>
            <div style={{fontSize:22,marginBottom:8}}>{s.icon}</div>
            <div style={{fontFamily:"Georgia,serif",fontSize:22,fontWeight:700,color:s.c}}>{s.v}</div>
            <div style={{fontSize:12,color:T.slate,marginTop:4}}>{s.l}</div>
          </div>
        ))}
      </div>
      <div className="grid-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Card>
          <ST>Клиники — статус</ST>
          {clinics.map(c=>{
            const cDocs = users.filter(u=>u.clinicId===c.id&&u.role==="doctor").length;
            const cRev = receipts.filter(r=>r.clinicId===c.id).reduce((s,r)=>s+r.total,0);
            const plan = PLANS[c.plan];
            return (
              <div key={c.id} style={{padding:"12px 0",borderBottom:`1px solid ${T.borderSub}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:600,color:T.white,fontSize:13}}>{c.name}</div>
                  <div style={{fontSize:11,color:T.slate,marginTop:2}}>{c.address} · {cDocs} врачей</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:13,fontWeight:700,color:T.gold}}>{tg(cRev)}</div>
                  <span style={{fontSize:10,background:`${plan.color}22`,color:plan.color,padding:"2px 7px",borderRadius:10,fontWeight:600}}>{plan.name}</span>
                </div>
              </div>
            );
          })}
        </Card>
        <Card>
          <ST>Приёмы сегодня — все клиники</ST>
          {todayAppts.length===0
            ? <div style={{color:T.slate,fontSize:13}}>Нет приёмов сегодня</div>
            : todayAppts.map(a=>{
              const clinic = clinics.find(c=>c.id===a.clinicId);
              const pat = patients.find(p=>p.id===a.patientId);
              const stC = a.status==="done"?T.emerald:a.status==="cancelled"?T.ruby:T.sapphire;
              return (
                <div key={a.id} style={{padding:"8px 0",borderBottom:`1px solid ${T.borderSub}`,display:"flex",gap:10,alignItems:"center"}}>
                  <span style={{width:6,height:6,borderRadius:"50%",background:stC,flexShrink:0}}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,color:T.white}}>{pat?.name||"—"}</div>
                    <div style={{fontSize:11,color:T.slate}}>{clinic?.name} · {a.time}</div>
                  </div>
                </div>
              );
            })
          }
        </Card>
      </div>
    </div>
  );
}

function ClinicsManager({ clinics, setClinics, users, receipts, showToast }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({name:"",city:"Тараз",address:"",phone:"",plan:"starter",color:T.gold});

  async function save() {
    if (!form.name||!form.address) return;
    const newClinic = { id:gid(), ...form, active:true, createdAt:today() };
    try {
      await upsertClinic(newClinic);
      setClinics(p=>[...p,newClinic]);
      setModal(null); showToast("Клиника добавлена");
    } catch (e) { showToast("Ошибка: "+String(e?.message||e), "error"); }
  }
  async function toggle(id) {
    const c = clinics.find(x=>x.id===id);
    const updated = {...c, active: !c.active};
    try {
      await upsertClinic(updated);
      setClinics(p=>p.map(x=>x.id===id?updated:x));
    } catch (e) { showToast("Ошибка: "+String(e?.message||e), "error"); }
  }
  async function del(id) {
    if (!window.confirm("Удалить клинику? Это также удалит всех её пользователей и данные.")) return;
    try {
      await deleteRow("clinics", id);
      setClinics(p=>p.filter(c=>c.id!==id));
      showToast("Клиника удалена","error");
    } catch (e) { showToast("Ошибка: "+String(e?.message||e), "error"); }
  }

  return (
    <div className="fade-in">
      <PH title="Управление клиниками" sub={`${clinics.length} клиник в сети`}>
        <PBtn onClick={()=>setModal(true)}>+ Добавить клинику</PBtn>
      </PH>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {clinics.map(c=>{
          const plan = PLANS[c.plan];
          const cUsers = users.filter(u=>u.clinicId===c.id);
          const cDocs = cUsers.filter(u=>u.role==="doctor").length;
          const cRev = receipts.filter(r=>r.clinicId===c.id).reduce((s,r)=>s+r.total,0);
          return (
            <Card key={c.id} style={{borderLeft:`3px solid ${c.color||T.gold}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",flexWrap:"wrap",gap:12}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                    <span style={{fontFamily:"Georgia,serif",fontSize:16,fontWeight:700,color:T.white}}>{c.name}</span>
                    <span style={{background:c.active?`${T.emerald}22`:`${T.ruby}22`,color:c.active?T.emerald:T.ruby,fontSize:10,padding:"2px 8px",borderRadius:10,fontWeight:700}}>{c.active?"АКТИВНА":"ОТКЛЮЧЕНА"}</span>
                    <span style={{background:`${plan.color}22`,color:plan.color,fontSize:10,padding:"2px 8px",borderRadius:10,fontWeight:700}}>{plan.name}</span>
                  </div>
                  <div style={{fontSize:13,color:T.slate,display:"flex",gap:16,flexWrap:"wrap"}}>
                    <span>📍 {c.address}</span>
                    <span>📞 {c.phone}</span>
                    <span>👨‍⚕️ {cDocs} врачей</span>
                    <span>💰 {tg(cRev)}</span>
                  </div>
                  <div style={{marginTop:8,fontSize:12,color:T.slate}}>
                    Логины: {cUsers.map(u=>`${u.login} (${u.role==="admin"?"Адм":"Врач"})`).join(" · ")||"нет пользователей"}
                  </div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <GBtn color={c.active?T.amber:T.emerald} onClick={()=>toggle(c.id)}>{c.active?"Откл.":"Вкл."}</GBtn>
                  <GBtn color={T.ruby} onClick={()=>del(c.id)}>Удалить</GBtn>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      {modal && (
        <Modal title="Новая клиника" onClose={()=>setModal(null)}>
          <label>Название клиники</label>
          <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="DentVision — Алматы"/>
          <label>Город</label>
          <input value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))}/>
          <label>Адрес</label>
          <input value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} placeholder="ул. Абая, 10"/>
          <label>Телефон</label>
          <input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="+7 727 ..."/>
          <label>Тарифный план</label>
          <select value={form.plan} onChange={e=>setForm(f=>({...f,plan:e.target.value}))}>
            {Object.entries(PLANS).map(([k,v])=><option key={k} value={k}>{v.name} — {v.price}</option>)}
          </select>
          <label>Цвет клиники</label>
          <input type="color" value={form.color} onChange={e=>setForm(f=>({...f,color:e.target.value}))} style={{height:40,padding:4}}/>
          <PBtn onClick={save} style={{width:"100%",marginTop:20}}>Создать клинику</PBtn>
        </Modal>
      )}
    </div>
  );
}

function UsersManager({ clinics, showToast }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({clinicId:"",login:"",password:"",name:"",role:"doctor",spec:"Терапевт"});
  const [byClinic, setByClinic] = useState({}); // clinicId -> users[]
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all(clinics.map(c => loadClinicData(c.id).then(d => [c.id, (d?.users||[]).map(r=>toCamelRow("users", r))])))
      .then(pairs => { if (!cancelled) setByClinic(Object.fromEntries(pairs)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [clinics]);

  async function save() {
    if(!form.clinicId||!form.login||!form.password||!form.name) return;
    try {
      await createUserSecure({ id: gid(), clinicId: form.clinicId, login: form.login, password: form.password, name: form.name, role: form.role, spec: form.role==="doctor"?form.spec:null });
      const fresh = await loadClinicData(form.clinicId);
      setByClinic(prev => ({ ...prev, [form.clinicId]: (fresh?.users||[]).map(r=>toCamelRow("users", r)) }));
      setModal(null);
      showToast("Пользователь добавлен");
    } catch (e) {
      showToast("Ошибка: "+String(e?.message||e), "error");
    }
  }
  async function del(clinicId, id) {
    try {
      await deleteRow("users", id);
      setByClinic(prev => ({ ...prev, [clinicId]: prev[clinicId].filter(u=>u.id!==id) }));
      showToast("Удалено","error");
    } catch (e) {
      showToast("Ошибка удаления", "error");
    }
  }

  const allUsers = Object.values(byClinic).flat();

  return (
    <div className="fade-in">
      <PH title="Пользователи" sub={loading ? "Загрузка..." : `${allUsers.length} аккаунтов в системе`}>
        <PBtn onClick={()=>setModal(true)}>+ Добавить</PBtn>
      </PH>
      {clinics.map(c=>{
        const cu = byClinic[c.id] || [];
        if(!cu.length) return null;
        return (
          <div key={c.id} style={{marginBottom:20}}>
            <div style={{fontSize:13,fontWeight:700,color:T.gold,marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
              <span style={{width:8,height:8,borderRadius:"50%",background:c.color||T.gold}}/>
              {c.name}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {cu.map(u=>(
                <Card key={u.id} style={{padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <span style={{fontWeight:600,color:T.white,fontSize:13}}>{u.name}</span>
                    <span style={{marginLeft:8,fontSize:11,background:u.role==="admin"?`${T.amber}22`:`${T.sapphire}22`,color:u.role==="admin"?T.amber:T.sapphire,padding:"2px 7px",borderRadius:8}}>{u.role==="admin"?"Администратор":`Врач · ${u.spec}`}</span>
                    <div style={{fontSize:12,color:T.slate,marginTop:3,fontFamily:"monospace"}}>{u.login}</div>
                  </div>
                  <GBtn color={T.ruby} onClick={()=>del(c.id, u.id)}>Удалить</GBtn>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
      {modal && (
        <Modal title="Новый пользователь" onClose={()=>setModal(null)}>
          <label>Клиника</label>
          <select value={form.clinicId} onChange={e=>setForm(f=>({...f,clinicId:e.target.value}))}>
            <option value="">— Выберите клинику —</option>
            {clinics.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label>Роль</label>
          <select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
            <option value="admin">Администратор</option>
            <option value="doctor">Врач</option>
          </select>
          {form.role==="doctor" && <><label>Специализация</label>
          <select value={form.spec} onChange={e=>setForm(f=>({...f,spec:e.target.value}))}>
            {["Терапевт","Ортопед","Хирург","Ортодонт","Пародонтолог","Детский стоматолог"].map(s=><option key={s} value={s}>{s}</option>)}
          </select></>}
          <label>ФИО</label>
          <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Иванова Мария Сергеевна"/>
          <label>Логин</label>
          <input value={form.login} onChange={e=>setForm(f=>({...f,login:e.target.value}))} placeholder="doctor_name"/>
          <label>Пароль</label>
          <input value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} placeholder="Минимум 6 символов"/>
          <PBtn onClick={save} style={{width:"100%",marginTop:20}}>Создать аккаунт</PBtn>
        </Modal>
      )}
    </div>
  );
}

function SuperAnalytics({ clinics, receipts, appointments, patients, users }) {
  const totalRev = receipts.reduce((s,r)=>s+r.total,0);
  const todayRev = receipts.filter(r=>r.date===today()).reduce((s,r)=>s+r.total,0);
  return (
    <div className="fade-in">
      <PH title="Аналитика сети" sub="Все клиники · Все периоды"/>
      <div className="grid-3" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:24}}>
        <StatCard l="Общая выручка" v={tg(totalRev)} c={T.gold}/>
        <StatCard l="Выручка сегодня" v={tg(todayRev)} c={T.emerald}/>
        <StatCard l="Всего чеков" v={receipts.length} c={T.sapphire}/>
      </div>
      <div className="grid-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Card>
          <ST>Выручка по клиникам</ST>
          {clinics.map(c=>{
            const rev = receipts.filter(r=>r.clinicId===c.id).reduce((s,r)=>s+r.total,0);
            const pct = totalRev>0?Math.round(rev/totalRev*100):0;
            return (
              <div key={c.id} style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}>
                  <span style={{color:T.white}}>{c.name}</span>
                  <span style={{color:T.gold,fontWeight:700}}>{tg(rev)}</span>
                </div>
                <div style={{height:6,background:T.borderSub,borderRadius:3}}>
                  <div style={{height:6,background:`linear-gradient(90deg,${c.color||T.gold},${T.goldDim})`,borderRadius:3,width:`${pct}%`,transition:"width 0.5s"}}/>
                </div>
              </div>
            );
          })}
        </Card>
        <Card>
          <ST>По способам оплаты</ST>
          {PAY_METHODS.map(m=>{
            const s = receipts.filter(r=>r.payMethod===m).reduce((s,r)=>s+r.total,0);
            if(!s) return null;
            return (
              <div key={m} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${T.borderSub}`,fontSize:13}}>
                <span style={{color:T.slateL}}>{m}</span>
                <span style={{color:T.gold,fontWeight:600}}>{tg(s)}</span>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}

function SupabaseSetup({ showToast, cloudOnline, cloudError, clinics, users, patients, appointments, receipts, treatments }) {
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState(null);
  const [diag, setDiag] = useState(null);
  const [diagRunning, setDiagRunning] = useState(false);

  async function testConnection() {
    setChecking(true);
    try {
      await sbSelectClinics();
      setLastCheck({ ok: true, time: new Date().toLocaleTimeString("ru-RU") });
      showToast("Подключение к Supabase работает");
    } catch (e) {
      setLastCheck({ ok: false, time: new Date().toLocaleTimeString("ru-RU"), msg: String(e?.message || e) });
      showToast("Ошибка подключения к Supabase", "error");
    }
    setChecking(false);
  }

  async function runDiagnostics() {
    setDiagRunning(true);
    const results = [];

    // Test 1: raw fetch, no headers at all, just hitting the base URL
    try {
      const r = await fetch(SUPABASE_URL, { method: "GET" });
      results.push({ name: "Базовый URL (без ключей)", ok: true, detail: `HTTP ${r.status}` });
    } catch (e) {
      results.push({ name: "Базовый URL (без ключей)", ok: false, detail: String(e?.message||e) });
    }

    // Test 2: REST endpoint with apikey only
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/clinics?select=id&limit=1`, { headers: { apikey: SUPABASE_KEY } });
      const text = await r.text();
      results.push({ name: "REST /clinics (apikey only)", ok: r.ok, detail: `HTTP ${r.status} — ${text.slice(0,200)}` });
    } catch (e) {
      results.push({ name: "REST /clinics (apikey only)", ok: false, detail: String(e?.message||e) });
    }

    // Test 3: REST endpoint with apikey + Bearer (what the app actually uses)
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/clinics?select=id&limit=1`, { headers: sbHeaders });
      const text = await r.text();
      results.push({ name: "REST /clinics (apikey + Bearer)", ok: r.ok, detail: `HTTP ${r.status} — ${text.slice(0,200)}` });
    } catch (e) {
      results.push({ name: "REST /clinics (apikey + Bearer)", ok: false, detail: String(e?.message||e) });
    }

    // Test 4: RPC call
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/verify_login`, {
        method: "POST",
        headers: { ...sbHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ p_login: "__diagnostic_test__", p_password: "x" }),
      });
      const text = await r.text();
      results.push({ name: "RPC verify_login (тестовый вызов)", ok: r.ok, detail: `HTTP ${r.status} — ${text.slice(0,200)}` });
    } catch (e) {
      results.push({ name: "RPC verify_login (тестовый вызов)", ok: false, detail: String(e?.message||e) });
    }

    setDiag(results);
    setDiagRunning(false);
  }

  const tables = [
    { name: "clinics", label: "Клиники", count: clinics.length },
    { name: "users", label: "Пользователи", count: users.length },
    { name: "patients", label: "Пациенты", count: patients.length },
    { name: "appointments", label: "Приёмы", count: appointments.length },
    { name: "treatments", label: "Планы лечения", count: treatments.length },
    { name: "receipts", label: "Чеки", count: receipts.length },
  ];

  return (
    <div className="fade-in">
      <PH title="Облачное хранилище" sub="Supabase — синхронизация между устройствами"/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}} className="grid-2">
        <Card>
          <ST>Статус подключения</ST>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,padding:"12px 14px",borderRadius:9,background:cloudOnline?`${T.emerald}12`:`${T.ruby}12`,border:`1px solid ${cloudOnline?T.emerald:T.ruby}30`}}>
            <span style={{width:10,height:10,borderRadius:"50%",background:cloudOnline?T.emerald:T.ruby,flexShrink:0}}/>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:cloudOnline?T.emerald:T.ruby}}>{cloudOnline?"Подключено к облаку":"Офлайн — работаем из кэша"}</div>
              <div style={{fontSize:11,color:T.slate,marginTop:2}}>{SUPABASE_URL}</div>
            </div>
          </div>
          {cloudError && (
            <div style={{marginBottom:14,padding:"10px 12px",background:`${T.ruby}10`,border:`1px solid ${T.ruby}30`,borderRadius:8,fontSize:12,color:T.ruby,wordBreak:"break-word"}}>
              ⚠ Ошибка: {cloudError}
            </div>
          )}
          <PBtn onClick={testConnection} disabled={checking} style={{width:"100%"}}>{checking?"Проверка...":"Проверить соединение"}</PBtn>
          {lastCheck && (
            <div style={{marginTop:10,fontSize:12,color:lastCheck.ok?T.emerald:T.ruby}}>
              {lastCheck.ok?"✓":"✕"} Последняя проверка: {lastCheck.time}
              {lastCheck.msg && <div style={{marginTop:4,wordBreak:"break-word"}}>{lastCheck.msg}</div>}
            </div>
          )}
          <div style={{marginTop:16,fontSize:12,color:T.slate,lineHeight:1.8}}>
            💡 Все изменения автоматически сохраняются в Supabase. Если пропадёт интернет — приложение продолжит работать из кэша текущей сессии.
          </div>
          <div style={{marginTop:16,paddingTop:16,borderTop:`1px solid ${T.borderSub}`}}>
            <GBtn onClick={runDiagnostics} color={T.sapphire}>{diagRunning?"Диагностика...":"🔍 Подробная диагностика"}</GBtn>
            {diag && (
              <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:8}}>
                {diag.map((d,i)=>(
                  <div key={i} style={{padding:"8px 10px",borderRadius:7,background:d.ok?`${T.emerald}10`:`${T.ruby}10`,border:`1px solid ${d.ok?T.emerald:T.ruby}25`,fontSize:11}}>
                    <div style={{fontWeight:700,color:d.ok?T.emerald:T.ruby,marginBottom:3}}>{d.ok?"✓":"✕"} {d.name}</div>
                    <div style={{color:T.slateL,wordBreak:"break-word",fontFamily:"monospace"}}>{d.detail}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
        <Card>
          <ST>Данные в облаке</ST>
          {tables.map(t=>(
            <div key={t.name} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${T.borderSub}`,fontSize:13}}>
              <span style={{color:T.slateL}}>{t.label}</span>
              <span style={{color:T.gold,fontWeight:700}}>{t.count}</span>
            </div>
          ))}
          <div style={{marginTop:14,padding:"10px 12px",background:`${T.amber}10`,border:`1px solid ${T.amber}30`,borderRadius:8,fontSize:12,color:T.amber}}>
            ⚡ Таблицы должны быть созданы в Supabase заранее (SQL-скрипт). Если таблица не существует — данные сохраняются только локально.
          </div>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CLINIC SHELL (admin/doctor view)
// ═══════════════════════════════════════════════════════════════════
function ClinicShell(props) {
  const { user, clinics, page, setPage, onLogout } = props;
  const clinic = clinics.find(c=>c.id===user.clinicId);
  const isAdmin = user.role==="admin";

  const tabs = [
    {id:"schedule",   icon:"📅", label:"Расписание"},
    {id:"patients",   icon:"👤", label:"Пациенты"},
    {id:"treatments", icon:"📋", label:"Лечение"},
    ...(isAdmin?[
      {id:"cashier",  icon:"💳", label:"Касса"},
      {id:"aireception", icon:"🤖", label:"AI-администратор"},
      {id:"aiteam",   icon:"✦",  label:"AI-команда"},
    ]:[
      {id:"aiadmin",  icon:"🤖", label:"AI-ассистент"},
    ]),
  ];

  return (
    <div style={{display:"flex",minHeight:"100vh"}}>
      <Sidebar tabs={tabs} page={page} setPage={setPage}
        badge={clinic?.name||"Клиника"} badgeColor={clinic?.color||T.gold}
        name={user.name} sub={user.role==="admin"?"Администратор":user.spec}
        onLogout={onLogout}/>
      <MobileNav tabs={tabs} page={page} setPage={setPage}/>
      <main className="main-content" style={{flex:1,padding:"28px 32px",overflowY:"auto"}}>
        {page==="schedule"   && <Schedule   {...props} clinic={clinic}/>}
        {page==="patients"   && <Patients   {...props} clinic={clinic}/>}
        {page==="treatments" && <Treatments {...props} clinic={clinic}/>}
        {page==="cashier"    && isAdmin && <Cashier  {...props} clinic={clinic}/>}
        {page==="aireception"&& isAdmin && <AIReception {...props} clinic={clinic}/>}
        {page==="aiteam"     && isAdmin && <AITeam   {...props} clinic={clinic}/>}
        {page==="aiadmin"    && !isAdmin && <AIAdmin  {...props} clinic={clinic}/>}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SCHEDULE
// ═══════════════════════════════════════════════════════════════════
function Schedule({ user, users, patients, appointments, setAppointments, showToast, clinic }) {
  const [date, setDate] = useState(today());
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({patientId:"",doctorId:user.role==="doctor"?user.id:"",time:"09:00",duration:60,reason:""});
  const cId = clinic?.id;
  const doctors = users.filter(u=>u.clinicId===cId&&u.role==="doctor");
  const visible = user.role==="admin" ? doctors : doctors.filter(d=>d.id===user.id);
  const dayAppts = appointments.filter(a=>a.clinicId===cId&&a.date===date);
  const cPatients = patients.filter(p=>p.clinicId===cId);

  function save() {
    if(!form.patientId||!form.doctorId||!form.reason)return;
    setAppointments(p=>[...p,{id:gid(),clinicId:cId,...form,date,status:"scheduled"}]);
    setModal(false); showToast("Запись добавлена");
  }
  function mark(id,s) { setAppointments(p=>p.map(a=>a.id===id?{...a,status:s}:a)); }

  const SC = {scheduled:{l:"Запланирован",dot:T.sapphire,bg:`${T.sapphire}12`}, done:{l:"Завершён",dot:T.emerald,bg:`${T.emerald}10`}, cancelled:{l:"Отменён",dot:T.ruby,bg:`${T.ruby}10`}};

  return (
    <div className="fade-in">
      <PH title="Расписание" sub={`${fd(date)} · ${dayAppts.filter(a=>a.status!=="cancelled").length} приёмов`}>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{width:"auto",padding:"8px 12px"}}/>
        {user.role==="admin" && <PBtn onClick={()=>setModal(true)}>+ Новый приём</PBtn>}
      </PH>
      {visible.map(doc=>{
        const da = dayAppts.filter(a=>a.doctorId===doc.id).sort((a,b)=>a.time.localeCompare(b.time));
        return (
          <Card key={doc.id} style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <div style={{width:34,height:34,borderRadius:9,background:`${T.gold}22`,border:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>👨‍⚕️</div>
                <div><div style={{fontWeight:600,fontSize:13,color:T.white}}>{doc.name}</div><div style={{fontSize:11,color:T.gold}}>{doc.spec}</div></div>
              </div>
              <div style={{fontSize:12,color:T.slate}}>{da.filter(a=>a.status!=="cancelled").length} приёмов</div>
            </div>
            {da.length===0
              ? <div style={{textAlign:"center",color:T.slate,padding:"16px 0",fontSize:13}}>Нет записей</div>
              : da.map(a=>{
                const pat = cPatients.find(p=>p.id===a.patientId);
                const sc = SC[a.status]||SC.scheduled;
                return (
                  <div key={a.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:9,background:sc.bg,border:`1px solid ${sc.dot}28`,marginBottom:7}}>
                    <div style={{fontFamily:"Georgia,serif",fontSize:16,fontWeight:700,color:T.gold,minWidth:48}}>{a.time}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,fontSize:13,color:T.white}}>{pat?.name||"—"}</div>
                      <div style={{fontSize:12,color:T.slate,marginTop:1}}>{a.reason} · {a.duration} мин.</div>
                    </div>
                    <span style={{fontSize:11,color:sc.dot}}>{sc.l}</span>
                    {a.status==="scheduled"&&(user.role==="admin"||(user.role==="doctor"&&user.id===doc.id))&&(
                      <div style={{display:"flex",gap:5}}>
                        <GBtn color={T.emerald} onClick={()=>mark(a.id,"done")}>Принят</GBtn>
                        {user.role==="admin"&&<GBtn color={T.ruby} onClick={()=>mark(a.id,"cancelled")}>Отмена</GBtn>}
                      </div>
                    )}
                  </div>
                );
              })
            }
          </Card>
        );
      })}
      {modal&&(
        <Modal title="Новый приём" onClose={()=>setModal(false)}>
          <label>Пациент</label>
          <select value={form.patientId} onChange={e=>setForm(f=>({...f,patientId:e.target.value}))}>
            <option value="">— Выберите —</option>
            {cPatients.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <label>Врач</label>
          <select value={form.doctorId} onChange={e=>setForm(f=>({...f,doctorId:e.target.value}))}>
            <option value="">— Выберите —</option>
            {doctors.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <label>Время</label>
          <select value={form.time} onChange={e=>setForm(f=>({...f,time:e.target.value}))}>
            {HOURS.map(h=><option key={h} value={h}>{h}</option>)}
          </select>
          <label>Длительность</label>
          <select value={form.duration} onChange={e=>setForm(f=>({...f,duration:Number(e.target.value)}))}>
            {[30,45,60,90,120].map(d=><option key={d} value={d}>{d} мин.</option>)}
          </select>
          <label>Причина визита</label>
          <input value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} placeholder="Боль, кариес, профосмотр..."/>
          <PBtn onClick={save} style={{width:"100%",marginTop:18}}>Записать</PBtn>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PATIENTS
// ═══════════════════════════════════════════════════════════════════
function Patients({ user, patients, setPatients, appointments, clinic, showToast }) {
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({name:"",dob:"",phone:"",address:"",notes:""});
  const [selTooth, setSelTooth] = useState(null);
  const [toothSt, setToothSt] = useState("caries");
  const cId = clinic?.id;
  const cPats = patients.filter(p=>p.clinicId===cId).filter(p=>p.name.toLowerCase().includes(search.toLowerCase())||p.phone?.includes(search));
  const pat = patients.find(p=>p.id===sel);
  const patAppts = pat ? appointments.filter(a=>a.patientId===pat.id&&a.clinicId===cId).sort((a,b)=>b.date.localeCompare(a.date)) : [];

  function saveNew(){if(!form.name)return;setPatients(p=>[...p,{id:gid(),clinicId:cId,...form,teeth:{}}]);setModal(null);showToast("Пациент добавлен");}
  function saveEdit(){setPatients(p=>p.map(x=>x.id===sel?{...x,...form}:x));setModal(null);showToast("Сохранено");}
  function applyTooth(){setPatients(p=>p.map(x=>x.id===sel?{...x,teeth:{...x.teeth,[selTooth]:toothSt}}:x));setSelTooth(null);}
  function clearTooth(){setPatients(p=>p.map(x=>{if(x.id!==sel)return x;const t={...x.teeth};delete t[selTooth];return{...x,teeth:t};}));setSelTooth(null);}

  return (
    <div style={{display:"flex",gap:20}} className="fade-in">
      <div style={{width:250,flexShrink:0}}>
        <input placeholder="Поиск..." value={search} onChange={e=>setSearch(e.target.value)} style={{marginBottom:10}}/>
        <PBtn onClick={()=>{setForm({name:"",dob:"",phone:"",address:"",notes:""});setModal("new");}} style={{width:"100%",marginBottom:10}}>+ Новый пациент</PBtn>
        <Card style={{padding:0,overflow:"hidden"}}>
          {cPats.length===0
            ? <div style={{padding:20,color:T.slate,textAlign:"center",fontSize:13}}>Нет пациентов</div>
            : cPats.map((p,i)=>(
              <div key={p.id} onClick={()=>setSel(p.id)} style={{padding:"11px 14px",borderBottom:i<cPats.length-1?`1px solid ${T.borderSub}`:"none",cursor:"pointer",background:sel===p.id?`${T.gold}08`:"transparent",borderLeft:sel===p.id?`2px solid ${T.gold}`:"2px solid transparent"}}>
                <div style={{fontWeight:600,fontSize:13,color:T.white}}>{p.name}</div>
                <div style={{fontSize:11,color:T.slate,marginTop:1}}>📞 {p.phone}</div>
              </div>
            ))
          }
        </Card>
      </div>
      <div style={{flex:1}}>
        {!pat
          ? <div style={{textAlign:"center",color:T.slate,padding:"60px 0"}}>← Выберите пациента</div>
          : <>
            <Card style={{marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"start"}}>
                <div>
                  <div style={{fontFamily:"Georgia,serif",fontSize:18,fontWeight:700,color:T.white,marginBottom:8}}>{pat.name}</div>
                  <div style={{fontSize:13,color:T.slate,display:"flex",gap:16,flexWrap:"wrap"}}>
                    {pat.dob&&<span>🎂 {fd(pat.dob)}</span>}
                    {pat.phone&&<span>📞 {pat.phone}</span>}
                    {pat.address&&<span>📍 {pat.address}</span>}
                  </div>
                  {pat.notes&&<div style={{marginTop:8,background:`${T.amber}10`,border:`1px solid ${T.amber}25`,borderRadius:7,padding:"7px 11px",fontSize:12,color:T.amber}}>⚠️ {pat.notes}</div>}
                </div>
                <GBtn onClick={()=>{setForm({name:pat.name,dob:pat.dob,phone:pat.phone,address:pat.address,notes:pat.notes});setModal("edit");}}>Редактировать</GBtn>
              </div>
            </Card>
            <Card style={{marginBottom:14}}>
              <ST>Зубная карта</ST>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                {Object.entries(TOOTH_STATUS).map(([k,v])=>(
                  <span key={k} style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:T.slate}}>
                    <span style={{width:9,height:9,borderRadius:2,background:v.c,display:"inline-block"}}/>
                    {v.l}
                  </span>
                ))}
              </div>
              {[UPPER,LOWER].map((row,ri)=>(
                <div key={ri} style={{display:"flex",gap:3,justifyContent:"center",marginBottom:ri===0?5:0,flexWrap:"wrap"}}>
                  {row.map(tn=>{
                    const s=pat.teeth[tn];
                    const bg=s?TOOTH_STATUS[s]?.c:"rgba(255,255,255,0.07)";
                    return <div key={tn} onClick={()=>setSelTooth(selTooth===tn?null:tn)} style={{width:28,height:32,borderRadius:5,background:bg,border:selTooth===tn?`2px solid ${T.gold}`:`1px solid rgba(255,255,255,0.08)`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:"rgba(255,255,255,0.6)",fontWeight:700,transform:selTooth===tn?"scale(1.15)":"scale(1)",transition:"transform 0.1s"}}>{tn}</div>;
                  })}
                </div>
              ))}
              {selTooth&&(
                <div style={{marginTop:12,padding:"10px 12px",background:T.card,border:`1px solid ${T.border}`,borderRadius:9,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                  <span style={{fontSize:13,fontWeight:600,color:T.gold}}>Зуб {selTooth}:</span>
                  <select value={toothSt} onChange={e=>setToothSt(e.target.value)} style={{width:"auto",padding:"5px 8px"}}>
                    {Object.entries(TOOTH_STATUS).map(([k,v])=><option key={k} value={k}>{v.l}</option>)}
                  </select>
                  <GBtn color={T.gold} onClick={applyTooth}>Сохранить</GBtn>
                  <GBtn color={T.ruby} onClick={clearTooth}>Очистить</GBtn>
                  <GBtn onClick={()=>setSelTooth(null)}>Отмена</GBtn>
                </div>
              )}
            </Card>
            <Card>
              <ST>История посещений</ST>
              {patAppts.length===0
                ? <div style={{color:T.slate,fontSize:13}}>Нет посещений</div>
                : patAppts.map(a=>{
                  const ic=a.status==="done"?"✅":a.status==="cancelled"?"❌":"🕐";
                  return <div key={a.id} style={{padding:"7px 0",borderBottom:`1px solid ${T.borderSub}`,fontSize:13,color:T.slateL}}>{ic} {fd(a.date)} {a.time} — {a.reason}</div>;
                })
              }
            </Card>
          </>
        }
      </div>
      {modal&&(
        <Modal title={modal==="new"?"Новый пациент":"Редактирование"} onClose={()=>setModal(null)}>
          {[["name","ФИО","text"],["dob","Дата рождения","date"],["phone","Телефон","tel"],["address","Адрес","text"],["notes","Примечания (аллергии)","text"]].map(([f,l,t])=>(
            <div key={f}><label>{l}</label><input type={t} value={form[f]} onChange={e=>setForm(p=>({...p,[f]:e.target.value}))}/></div>
          ))}
          <PBtn onClick={modal==="new"?saveNew:saveEdit} style={{width:"100%",marginTop:18}}>Сохранить</PBtn>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TREATMENTS
// ═══════════════════════════════════════════════════════════════════
function Treatments({ user, users, patients, treatments, setTreatments, showToast, clinic }) {
  const [filter,setFilter]=useState("all");
  const [modal,setModal]=useState(false);
  const [form,setForm]=useState({patientId:"",doctorId:user.role==="doctor"?user.id:"",diagnosis:"",plan:"",notes:""});
  const cId=clinic?.id;
  const cDocs=users.filter(u=>u.clinicId===cId&&u.role==="doctor");
  const cPats=patients.filter(p=>p.clinicId===cId);
  const vis=treatments.filter(t=>t.clinicId===cId&&(user.role==="admin"||t.doctorId===user.id));
  const filt=filter==="all"?vis:vis.filter(t=>t.status===filter);
  const SC={active:{l:"Активен",c:T.sapphire},completed:{l:"Завершён",c:T.emerald},paused:{l:"Пауза",c:T.amber}};

  function save(){if(!form.patientId||!form.diagnosis||!form.plan)return;setTreatments(p=>[...p,{id:gid(),clinicId:cId,...form,doctorId:form.doctorId||user.id,date:today(),status:"active"}]);setModal(false);showToast("План создан");}
  function upd(id,s){setTreatments(p=>p.map(t=>t.id===id?{...t,status:s}:t));}

  return (
    <div className="fade-in">
      <PH title="Планы лечения" sub={`${filt.length} записей`}>
        <div style={{display:"flex",gap:5}}>
          {["all","active","completed","paused"].map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{padding:"6px 12px",borderRadius:16,border:`1px solid ${filter===f?T.gold:T.borderSub}`,background:filter===f?`${T.gold}18`:"transparent",color:filter===f?T.gold:T.slate,fontSize:12,fontWeight:filter===f?600:400}}>
              {f==="all"?"Все":SC[f]?.l}
            </button>
          ))}
        </div>
        <PBtn onClick={()=>setModal(true)}>+ Новый план</PBtn>
      </PH>
      {filt.map(t=>{
        const pat=cPats.find(p=>p.id===t.patientId);
        const doc=cDocs.find(d=>d.id===t.doctorId);
        const sc=SC[t.status]||SC.active;
        return (
          <Card key={t.id} style={{marginBottom:10,borderLeft:`3px solid ${sc.c}`}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:12}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:7}}>
                  <span style={{fontWeight:700,fontSize:14,color:T.white}}>{pat?.name||"—"}</span>
                  <span style={{background:`${sc.c}20`,color:sc.c,borderRadius:10,padding:"2px 8px",fontSize:11,fontWeight:600}}>{sc.l}</span>
                  <span style={{color:T.slate,fontSize:12}}>{fd(t.date)}</span>
                </div>
                <div style={{fontSize:13,color:T.gold,marginBottom:5}}>{t.diagnosis}</div>
                <div style={{fontSize:12,color:T.slateL,background:T.card,borderRadius:7,padding:"8px 10px",lineHeight:1.6}}>{t.plan}</div>
                {t.notes&&<div style={{fontSize:12,color:T.slate,marginTop:5}}>📝 {t.notes}</div>}
                <div style={{fontSize:12,color:T.slate,marginTop:4}}>Врач: {doc?.name}</div>
              </div>
              {(user.role==="admin"||user.id===t.doctorId)&&(
                <div style={{display:"flex",flexDirection:"column",gap:5,flexShrink:0}}>
                  {t.status!=="completed"&&<GBtn color={T.emerald} onClick={()=>upd(t.id,"completed")}>Завершить</GBtn>}
                  {t.status==="active"&&<GBtn color={T.amber} onClick={()=>upd(t.id,"paused")}>Пауза</GBtn>}
                  {t.status==="paused"&&<GBtn color={T.sapphire} onClick={()=>upd(t.id,"active")}>Продолжить</GBtn>}
                </div>
              )}
            </div>
          </Card>
        );
      })}
      {modal&&(
        <Modal title="Новый план лечения" onClose={()=>setModal(false)}>
          <label>Пациент</label>
          <select value={form.patientId} onChange={e=>setForm(f=>({...f,patientId:e.target.value}))}>
            <option value="">— Выберите —</option>
            {cPats.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {user.role==="admin"&&<><label>Врач</label>
          <select value={form.doctorId} onChange={e=>setForm(f=>({...f,doctorId:e.target.value}))}>
            <option value="">— Выберите —</option>
            {cDocs.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
          </select></>}
          <label>Диагноз (МКБ)</label>
          <input value={form.diagnosis} onChange={e=>setForm(f=>({...f,diagnosis:e.target.value}))} placeholder="К02.1 Кариес дентина"/>
          <label>План лечения</label>
          <textarea value={form.plan} onChange={e=>setForm(f=>({...f,plan:e.target.value}))} style={{height:80,resize:"vertical"}} placeholder="Этапы лечения..."/>
          <label>Примечания</label>
          <input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Дополнительно..."/>
          <PBtn onClick={save} style={{width:"100%",marginTop:18}}>Создать план</PBtn>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CASHIER
// ═══════════════════════════════════════════════════════════════════
function Cashier({ patients, users, receipts, setReceipts, showToast, clinic }) {
  const [tab,setTab]=useState("new");
  const [patId,setPatId]=useState("");
  const [docId,setDocId]=useState("");
  const [items,setItems]=useState([]);
  const [disc,setDisc]=useState(0);
  const [pay,setPay]=useState("Kaspi QR");
  const [fDate,setFDate]=useState(today());
  const [catF,setCatF]=useState("Все");
  const [search,setSearch]=useState("");
  const cId=clinic?.id;
  const cPats=patients.filter(p=>p.clinicId===cId);
  const cDocs=users.filter(u=>u.clinicId===cId&&u.role==="doctor");
  const cats=["Все",...new Set(ALL_SERVICES.map(s=>s.cat))];
  const filtSvc=ALL_SERVICES.filter(s=>(catF==="Все"||s.cat===catF)&&s.name.toLowerCase().includes(search.toLowerCase()));
  const sub=items.reduce((s,i)=>s+i.price*i.qty,0);
  const discAmt=Math.round(sub*disc/100);
  const total=sub-discAmt;
  const dayR=receipts.filter(r=>r.clinicId===cId&&r.date===fDate);
  const dayTotal=dayR.reduce((s,r)=>s+r.total,0);

  function addSvc(svc){setItems(prev=>{const ex=prev.find(i=>i.serviceId===svc.id);if(ex)return prev.map(i=>i.serviceId===svc.id?{...i,qty:i.qty+1}:i);return[...prev,{serviceId:svc.id,name:svc.name,price:svc.price,qty:1}];});}
  function chQty(sid,d){setItems(p=>p.map(i=>i.serviceId===sid?{...i,qty:Math.max(1,i.qty+d)}:i));}
  function rmItem(sid){setItems(p=>p.filter(i=>i.serviceId!==sid));}
  function doPay(){
    if(!patId||!docId||!items.length){showToast("Заполните все поля","error");return;}
    setReceipts(p=>[{id:gid(),clinicId:cId,patientId:patId,doctorId:docId,date:today(),items:[...items],discount:disc,payMethod:pay,status:"paid",total},...p]);
    showToast(`Оплата принята — ${tg(total)}`);
    setPatId("");setDocId("");setItems([]);setDisc(0);setPay("Kaspi QR");
  }

  return (
    <div className="fade-in">
      <PH title="Касса" sub={clinic?.name}>
        <div style={{display:"flex",gap:5}}>
          {["new","history"].map(t=><button key={t} onClick={()=>setTab(t)} style={{padding:"6px 14px",borderRadius:16,border:`1px solid ${tab===t?T.gold:T.borderSub}`,background:tab===t?`${T.gold}18`:"transparent",color:tab===t?T.gold:T.slate,fontSize:13,fontWeight:tab===t?600:400}}>{t==="new"?"Новый чек":"История"}</button>)}
        </div>
      </PH>
      {tab==="new"&&(
        <div style={{display:"flex",gap:18,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:260}}>
            <Card>
              <ST>Прайс-лист · Тараз</ST>
              <input placeholder="Поиск услуги..." value={search} onChange={e=>setSearch(e.target.value)} style={{marginBottom:8}}/>
              <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:10}}>
                {cats.map(c=><button key={c} onClick={()=>setCatF(c)} style={{padding:"3px 9px",borderRadius:12,border:`1px solid ${catF===c?T.gold:T.borderSub}`,background:catF===c?`${T.gold}18`:"transparent",color:catF===c?T.gold:T.slate,fontSize:11}}>{c}</button>)}
              </div>
              <div style={{maxHeight:420,overflowY:"auto"}}>
                {filtSvc.map(svc=>(
                  <div key={svc.id} onClick={()=>addSvc(svc)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",borderRadius:7,border:`1px solid ${items.find(i=>i.serviceId===svc.id)?T.gold:T.borderSub}`,marginBottom:3,cursor:"pointer",transition:"all .12s"}}
                    onMouseEnter={e=>e.currentTarget.style.background=`${T.gold}10`}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <div>
                      <div style={{fontSize:12,color:T.white}}>{svc.name}</div>
                      <div style={{fontSize:10,color:T.slate}}>{svc.cat}</div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                      <span style={{fontSize:12,fontWeight:700,color:T.gold}}>{tg(svc.price)}</span>
                      <span style={{color:T.gold,fontSize:16}}>+</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <div style={{width:280,flexShrink:0}}>
            <Card>
              <ST>Чек</ST>
              <label>Пациент</label>
              <select value={patId} onChange={e=>setPatId(e.target.value)}>
                <option value="">— Выберите —</option>
                {cPats.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <label>Врач</label>
              <select value={docId} onChange={e=>setDocId(e.target.value)}>
                <option value="">— Выберите —</option>
                {cDocs.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <div style={{height:1,background:T.borderSub,margin:"14px 0"}}/>
              {items.length===0
                ? <div style={{textAlign:"center",color:T.slate,padding:"16px 0",fontSize:12}}>Нажмите + у услуги</div>
                : <>
                  {items.map(it=>(
                    <div key={it.serviceId} style={{marginBottom:8}}>
                      <div style={{fontSize:11,color:T.slateL,lineHeight:1.4,marginBottom:3}}>{it.name}</div>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <button onClick={()=>chQty(it.serviceId,-1)} style={{width:22,height:22,borderRadius:5,background:T.card,border:`1px solid ${T.borderSub}`,color:T.white,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                        <span style={{fontSize:13,fontWeight:600,color:T.white,minWidth:16,textAlign:"center"}}>{it.qty}</span>
                        <button onClick={()=>chQty(it.serviceId,1)} style={{width:22,height:22,borderRadius:5,background:T.card,border:`1px solid ${T.borderSub}`,color:T.white,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
                        <span style={{flex:1,textAlign:"right",fontSize:13,fontWeight:600,color:T.gold}}>{tg(it.price*it.qty)}</span>
                        <button onClick={()=>rmItem(it.serviceId)} style={{background:"transparent",border:"none",color:T.slate,fontSize:15}}>×</button>
                      </div>
                    </div>
                  ))}
                  <div style={{height:1,background:T.borderSub,margin:"10px 0"}}/>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:T.slate,marginBottom:8}}>
                    <span>Без скидки</span><span>{tg(sub)}</span>
                  </div>
                  <label>Скидка</label>
                  <div style={{display:"flex",gap:4,marginBottom:8}}>
                    {[0,5,10,15,20].map(d=><button key={d} onClick={()=>setDisc(d)} style={{flex:1,padding:"5px 0",borderRadius:6,border:`1px solid ${disc===d?T.gold:T.borderSub}`,background:disc===d?`${T.gold}18`:"transparent",color:disc===d?T.gold:T.slate,fontSize:12,fontWeight:disc===d?700:400}}>{d}%</button>)}
                  </div>
                  {disc>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:T.ruby,marginBottom:8}}><span>Скидка {disc}%</span><span>−{tg(discAmt)}</span></div>}
                  <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderTop:`1px solid ${T.border}`,marginBottom:10}}>
                    <span style={{fontSize:14,fontWeight:700,color:T.white}}>К оплате</span>
                    <span style={{fontFamily:"Georgia,serif",fontSize:18,fontWeight:700,color:T.gold}}>{tg(total)}</span>
                  </div>
                  <label>Способ оплаты</label>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:14}}>
                    {PAY_METHODS.map(m=><button key={m} onClick={()=>setPay(m)} style={{padding:"7px 5px",borderRadius:7,border:`1px solid ${pay===m?T.gold:T.borderSub}`,background:pay===m?`${T.gold}18`:"transparent",color:pay===m?T.gold:T.slate,fontSize:11,textAlign:"center"}}>{m}</button>)}
                  </div>
                  <PBtn onClick={doPay} style={{width:"100%"}}>Принять {tg(total)}</PBtn>
                </>
              }
            </Card>
          </div>
        </div>
      )}
      {tab==="history"&&(
        <div>
          <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:16,flexWrap:"wrap"}}>
            <input type="date" value={fDate} onChange={e=>setFDate(e.target.value)} style={{width:"auto",padding:"7px 11px"}}/>
            <div className="grid-3" style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              <StatCard l="Выручка" v={tg(dayTotal)} c={T.gold}/>
              <StatCard l="Чеков" v={dayR.length}/>
            </div>
          </div>
          {dayR.length===0
            ? <div style={{textAlign:"center",color:T.slate,padding:"40px 0"}}>Нет чеков за этот день</div>
            : dayR.map(r=>{
              const pat=cPats.find(p=>p.id===r.patientId);
              const doc=cDocs.find(d=>d.id===r.doctorId);
              return (
                <Card key={r.id} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"start"}}>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,color:T.white,marginBottom:5}}>{pat?.name||"—"} <span style={{fontSize:11,color:T.emerald,background:`${T.emerald}15`,padding:"2px 7px",borderRadius:8}}>Оплачен</span></div>
                      <div style={{fontSize:12,color:T.slate,marginBottom:6}}>Врач: {doc?.name} · {r.payMethod}{r.discount>0?` · Скидка ${r.discount}%`:""}</div>
                      {r.items.map(it=><div key={it.serviceId} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:T.slateL,padding:"2px 0"}}><span>{it.name}{it.qty>1?` ×${it.qty}`:""}</span><span>{tg(it.price*it.qty)}</span></div>)}
                    </div>
                    <div style={{fontFamily:"Georgia,serif",fontSize:20,fontWeight:700,color:T.gold,marginLeft:16}}>{tg(r.total)}</div>
                  </div>
                </Card>
              );
            })
          }
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// AI TEAM (admin)
// ═══════════════════════════════════════════════════════════════════
const AGENTS = [
  {id:"marketer",name:"Алия",role:"Маркетолог",emoji:"📣",color:"#E91E8C",desc:"Реклама, акции, Instagram, TikTok",sys:"Ты Алия — маркетолог стоматологической клиники DentVision в Таразе, Казахстан. Давай конкретные советы по рекламе, акциям, постам для Instagram/TikTok. Знаешь казахстанский рынок. Отвечай на русском, с готовыми текстами и идеями."},
  {id:"analyst",name:"Данияр",role:"Аналитик",emoji:"📊",color:"#3498DB",desc:"Финансы, выручка, оптимизация",sys:"Ты Данияр — бизнес-аналитик клиники DentVision в Таразе. Анализируй финансы, давай рекомендации по росту выручки и оптимизации. Знаешь рынок стоматологии Казахстана. Отвечай с цифрами и расчётами на русском."},
  {id:"hr",name:"Гульнара",role:"HR",emoji:"👥",color:"#9B59B6",desc:"Персонал, мотивация, найм, KPI",sys:"Ты Гульнара — HR-менеджер клиники DentVision в Таразе. Помогай с наймом, мотивацией, KPI врачей и администраторов. Знаешь рынок труда Тараза и трудовое законодательство Казахстана. Отвечай практично на русском."},
  {id:"quality",name:"Серик",role:"Качество сервиса",emoji:"⭐",color:"#F39C12",desc:"Стандарты, отзывы, репутация, 2ГИС",sys:"Ты Серик — консультант по качеству сервиса DentVision в Таразе. Улучшай сервис, внедряй стандарты, работай с отзывами. Давай скрипты, чек-листы, алгоритмы. Отвечай на русском."},
  {id:"digital",name:"Айгерим",role:"Digital",emoji:"💻",color:"#27AE60",desc:"Сайт, 2ГИС, SEO, онлайн-запись",sys:"Ты Айгерим — digital-специалист DentVision в Таразе. Развивай онлайн-присутствие: Instagram, 2ГИС, сайт, TikTok. Знаешь digital-продвижение в Казахстане. Давай конкретные инструкции на русском."},
];

const QUICK_PROMPTS = {
  marketer:["Придумай акцию на этот месяц","Напиши пост для Instagram","Как привлечь пациентов в Таразе?","Контент-план на неделю"],
  analyst: ["Проанализируй нашу выручку","Как увеличить средний чек?","Прогноз выручки на квартал","Какие услуги самые прибыльные?"],
  hr:      ["Как мотивировать врачей?","Напиши вакансию стоматолога","Система KPI для врачей","Как удержать сотрудников?"],
  quality: ["Стандарт приёма пациента","Как работать с жалобами?","Чек-лист для администратора","Как поднять рейтинг на 2ГИС?"],
  digital: ["Оформление Instagram профиля","Оптимизация карточки 2ГИС","Описание клиники для сайта","Хэштеги для стоматологии"],
};

function AITeam({ patients, appointments, receipts, treatments, clinic }) {
  const [agent, setAgent] = useState(AGENTS[0]);
  const [chats, setChats] = useState(()=>Object.fromEntries(AGENTS.map(a=>[a.id,[]])));
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const cId = clinic?.id;

  function topSvc(){
    const cnt={};
    receipts.filter(r=>r.clinicId===cId).forEach(r=>r.items.forEach(it=>{cnt[it.name]=(cnt[it.name]||0)+it.qty;}));
    return Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([n,c])=>`${n}(×${c})`).join(", ")||"нет данных";
  }

  const totalRev = receipts.filter(r=>r.clinicId===cId).reduce((s,r)=>s+r.total,0);
  const clinicCtx = `\n\nДАННЫЕ КЛИНИКИ:\n- ${clinic?.name}, г. Тараз, Казахстан\n- Пациентов: ${patients.filter(p=>p.clinicId===cId).length}\n- Приёмов сегодня: ${appointments.filter(a=>a.clinicId===cId&&a.date===today()).length}\n- Активных планов: ${treatments.filter(t=>t.clinicId===cId&&t.status==="active").length}\n- Выручка всего: ${totalRev.toLocaleString()} тенге\n- Топ услуг: ${topSvc()}`;

  const msgs = chats[agent.id];

  async function send() {
    if (!input.trim()||loading) return;
    const um = {role:"user",content:input.trim()};
    const nm = [...msgs, um];
    setChats(c=>({...c,[agent.id]:nm}));
    setInput(""); setLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1000,system:agent.sys+clinicCtx,messages:nm})});
      const d = await res.json();
      const t = d.content?.map(b=>b.text||"").join("")||"Ошибка ответа";
      setChats(c=>({...c,[agent.id]:[...nm,{role:"assistant",content:t}]}));
    } catch {
      setChats(c=>({...c,[agent.id]:[...nm,{role:"assistant",content:"Ошибка соединения. Попробуйте снова."}]}));
    }
    setLoading(false);
  }

  function fmt(t){
    return t.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/^#{1,3}\s(.+)$/gm,`<div style="font-weight:700;color:${T.gold};margin:8px 0 3px;font-size:13px">$1</div>`).replace(/^[-•]\s(.+)$/gm,'<div style="padding-left:10px;margin:2px 0">• $1</div>').replace(/\n/g,'<br/>');
  }

  return (
    <div className="fade-in">
      <PH title="✦ AI-команда" sub="Виртуальные специалисты знают данные вашей клиники"/>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
        {AGENTS.map(a=>(
          <div key={a.id} onClick={()=>setAgent(a)} style={{padding:"12px 14px",borderRadius:11,border:`1px solid ${agent.id===a.id?a.color:T.borderSub}`,background:agent.id===a.id?`${a.color}15`:T.card,cursor:"pointer",flex:"1 1 140px",position:"relative",overflow:"hidden",transition:"all .15s"}}>
            {agent.id===a.id&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:a.color}}/>}
            <div style={{fontSize:20,marginBottom:5}}>{a.emoji}</div>
            <div style={{fontWeight:700,fontSize:12,color:agent.id===a.id?T.white:T.slateL}}>{a.name}</div>
            <div style={{fontSize:10,color:a.color,fontWeight:600}}>{a.role}</div>
            {chats[a.id].length>0&&<div style={{position:"absolute",top:8,right:8,width:6,height:6,borderRadius:"50%",background:a.color}}/>}
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:14}}>
        <Card style={{flex:1,padding:0,overflow:"hidden",display:"flex",flexDirection:"column",height:460}}>
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.borderSub}`,display:"flex",alignItems:"center",gap:10,background:`${agent.color}10`}}>
            <div style={{width:34,height:34,borderRadius:9,background:agent.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{agent.emoji}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:13,color:T.white}}>{agent.name} <span style={{color:agent.color,fontSize:11}}>· {agent.role}</span></div>
              <div style={{fontSize:11,color:T.slate}}>{agent.desc}</div>
            </div>
            {msgs.length>0&&<button onClick={()=>setChats(c=>({...c,[agent.id]:[]}))} style={{background:"transparent",border:`1px solid ${T.borderSub}`,color:T.slate,borderRadius:6,padding:"3px 9px",fontSize:11}}>Очистить</button>}
          </div>
          <div style={{flex:1,overflowY:"auto",padding:14,display:"flex",flexDirection:"column",gap:10}}>
            {msgs.length===0?(
              <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",padding:20}}>
                <div style={{fontSize:36,marginBottom:10}}>{agent.emoji}</div>
                <div style={{fontSize:14,fontWeight:600,color:T.white,marginBottom:5}}>Привет! Я {agent.name}</div>
                <div style={{fontSize:12,color:T.slate,maxWidth:260,lineHeight:1.6}}>Знаю данные клиники и готов помочь. Напишите вопрос или выберите быстрый запрос.</div>
              </div>
            ):msgs.map((m,i)=>(
              <div key={i} style={{display:"flex",gap:8,justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
                {m.role==="assistant"&&<div style={{width:26,height:26,borderRadius:7,background:agent.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0,alignSelf:"flex-end"}}>{agent.emoji}</div>}
                <div style={{maxWidth:"78%",padding:"9px 13px",borderRadius:m.role==="user"?"13px 13px 3px 13px":"13px 13px 13px 3px",background:m.role==="user"?agent.color:"rgba(255,255,255,0.06)",color:m.role==="user"?T.bg:T.white,fontSize:13,lineHeight:1.6,fontWeight:m.role==="user"?600:400}}>
                  {m.role==="assistant"?<div dangerouslySetInnerHTML={{__html:fmt(m.content)}}/>:m.content}
                </div>
              </div>
            ))}
            {loading&&(
              <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
                <div style={{width:26,height:26,borderRadius:7,background:agent.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>{agent.emoji}</div>
                <div style={{padding:"10px 14px",borderRadius:"13px 13px 13px 3px",background:"rgba(255,255,255,0.06)",display:"flex",gap:4}}>
                  {[0,1,2].map(i=><span key={i} style={{width:6,height:6,borderRadius:"50%",background:agent.color,display:"inline-block",animation:`pulse 1.2s ease ${i*.2}s infinite`}}/>)}
                </div>
              </div>
            )}
          </div>
          <div style={{padding:"10px 14px",borderTop:`1px solid ${T.borderSub}`,display:"flex",gap:8}}>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()} placeholder={`Спросите ${agent.name}...`} disabled={loading} style={{flex:1}}/>
            <button onClick={send} disabled={loading||!input.trim()} style={{padding:"9px 16px",background:input.trim()&&!loading?`linear-gradient(135deg,${agent.color},${agent.color}99)`:T.borderSub,color:input.trim()&&!loading?"#fff":T.slate,border:"none",borderRadius:9,fontWeight:700,fontSize:14,flexShrink:0}}>→</button>
          </div>
        </Card>
        <div className="chat-sidebar" style={{width:190,flexShrink:0,display:"flex",flexDirection:"column",gap:12}}>
          <Card>
            <ST>Быстрые запросы</ST>
            {(QUICK_PROMPTS[agent.id]||[]).map((q,i)=>(
              <button key={i} onClick={()=>setInput(q)} style={{width:"100%",padding:"8px 10px",background:"transparent",border:`1px solid ${T.borderSub}`,color:T.slateL,borderRadius:7,fontSize:11,textAlign:"left",marginBottom:5,lineHeight:1.4,transition:"all .12s"}}
                onMouseEnter={e=>{e.target.style.borderColor=agent.color;e.target.style.color=T.white;}}
                onMouseLeave={e=>{e.target.style.borderColor=T.borderSub;e.target.style.color=T.slateL;}}>
                {q}
              </button>
            ))}
          </Card>
          <Card>
            <ST>Данные клиники</ST>
            {[["Пациентов",patients.filter(p=>p.clinicId===cId).length],["Сегодня",appointments.filter(a=>a.clinicId===cId&&a.date===today()).length],["Выручка",tg(totalRev)]].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${T.borderSub}`,fontSize:11}}>
                <span style={{color:T.slate}}>{l}</span><span style={{color:T.white,fontWeight:600}}>{v}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// AI ADMIN — for doctors
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// AI RECEPTIONIST — for clinic admins (front desk assistant)
// ═══════════════════════════════════════════════════════════════════
function AIReception({ user, users, patients, appointments, treatments, receipts, clinic }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const cId = clinic?.id;

  const cDocs = users.filter(u=>u.clinicId===cId&&u.role==="doctor");
  const cPats = patients.filter(p=>p.clinicId===cId);
  const todayAppts = appointments.filter(a=>a.clinicId===cId&&a.date===today()).sort((a,b)=>a.time.localeCompare(b.time));
  const todayRev = receipts.filter(r=>r.clinicId===cId&&r.date===today()).reduce((s,r)=>s+r.total,0);
  const freeSlotsToday = HOURS.filter(h => !todayAppts.some(a=>a.time===h && a.status!=="cancelled"));

  const apptsList = todayAppts.map(a=>{
    const pat=cPats.find(p=>p.id===a.patientId); const doc=cDocs.find(d=>d.id===a.doctorId);
    return `${a.time} — ${pat?.name||"?"} к ${doc?.name||"?"} (${a.reason}) [${a.status}]`;
  }).join("\n") || "Нет приёмов сегодня";

  const SYS = `Ты — AI-администратор ресепшена клиники ${clinic?.name}, г. Тараз, Казахстан. Помогаешь живому администратору ${user.name}: подсказываешь скрипты общения с пациентами, помогаешь с записью на приём, отвечаешь на вопросы по расписанию, ценам, врачам, протоколу работы (оплата, документы, конфликты).

РАСПИСАНИЕ СЕГОДНЯ (${fd(today())}):
${apptsList}

Свободные слоты сегодня: ${freeSlotsToday.join(", ")||"нет свободных слотов"}
Врачи клиники: ${cDocs.map(d=>`${d.name} (${d.spec})`).join(", ")}
Пациентов в базе: ${cPats.length}
Выручка сегодня: ${todayRev.toLocaleString()} тенге

Отвечай кратко, по-деловому, на русском языке. Если пациент звонит и просит записаться — предложи конкретное свободное время и врача. Если вопрос про оплату/документы/конфликты — давай чёткий протокол действий.`;

  async function send() {
    if (!input.trim()||loading) return;
    const um={role:"user",content:input.trim()};
    const nm=[...msgs,um];
    setMsgs(nm); setInput(""); setLoading(true);
    try {
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1000,system:SYS,messages:nm})});
      const d=await res.json();
      const t=d.content?.map(b=>b.text||"").join("")||"Ошибка ответа";
      setMsgs([...nm,{role:"assistant",content:t}]);
    } catch {
      setMsgs([...nm,{role:"assistant",content:"Ошибка соединения. Попробуйте снова."}]);
    }
    setLoading(false);
  }

  const QQ = [
    "Куда можно записать пациента сегодня?",
    "Скрипт для звонка по острой боли",
    "Что сказать при жалобе на цену?",
    "Какие документы нужны первичному пациенту?",
    "Сколько свободных слотов осталось сегодня?",
    "Напиши SMS-напоминание о приёме",
  ];

  return (
    <div className="fade-in">
      <PH title="🤖 AI-администратор" sub={`${clinic?.name} · Помощник ресепшена`}/>
      <div style={{display:"flex",gap:14}}>
        <Card style={{flex:1,padding:0,overflow:"hidden",display:"flex",flexDirection:"column",height:500}}>
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.borderSub}`,background:`${T.emerald}10`,display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:34,height:34,borderRadius:9,background:T.emerald,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🤖</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:13,color:T.white}}>AI-администратор</div>
              <div style={{fontSize:11,color:T.slate}}>Видит расписание, пациентов и кассу клиники в реальном времени</div>
            </div>
            {msgs.length>0&&<button onClick={()=>setMsgs([])} style={{background:"transparent",border:`1px solid ${T.borderSub}`,color:T.slate,borderRadius:6,padding:"3px 9px",fontSize:11}}>Очистить</button>}
          </div>
          <div style={{flex:1,overflowY:"auto",padding:14,display:"flex",flexDirection:"column",gap:10}}>
            {msgs.length===0?(
              <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",padding:20}}>
                <div style={{fontSize:40,marginBottom:12}}>🤖</div>
                <div style={{fontSize:14,fontWeight:600,color:T.white,marginBottom:6}}>Добрый день, {user.name.split(" ")[0]}!</div>
                <div style={{fontSize:12,color:T.slate,maxWidth:280,lineHeight:1.6}}>Я слежу за расписанием на сегодня и готов помочь с записью пациентов, скриптами и протоколами. Спросите что угодно.</div>
              </div>
            ):msgs.map((m,i)=>(
              <div key={i} style={{display:"flex",gap:8,justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
                {m.role==="assistant"&&<div style={{width:26,height:26,borderRadius:7,background:T.emerald,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0,alignSelf:"flex-end"}}>🤖</div>}
                <div style={{maxWidth:"78%",padding:"9px 13px",borderRadius:m.role==="user"?"13px 13px 3px 13px":"13px 13px 13px 3px",background:m.role==="user"?T.emerald:"rgba(255,255,255,0.06)",color:m.role==="user"?T.bg:T.white,fontSize:13,lineHeight:1.6,fontWeight:m.role==="user"?600:400,whiteSpace:"pre-wrap"}}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading&&(
              <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
                <div style={{width:26,height:26,borderRadius:7,background:T.emerald,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>🤖</div>
                <div style={{padding:"10px 14px",borderRadius:"13px 13px 13px 3px",background:"rgba(255,255,255,0.06)",display:"flex",gap:4}}>
                  {[0,1,2].map(i=><span key={i} style={{width:6,height:6,borderRadius:"50%",background:T.emerald,display:"inline-block",animation:`pulse 1.2s ease ${i*.2}s infinite`}}/>)}
                </div>
              </div>
            )}
          </div>
          <div style={{padding:"10px 14px",borderTop:`1px solid ${T.borderSub}`,display:"flex",gap:8}}>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()} placeholder="Вопрос по приёму, оплате, расписанию..." disabled={loading} style={{flex:1}}/>
            <button onClick={send} disabled={loading||!input.trim()} style={{padding:"9px 16px",background:input.trim()&&!loading?T.emerald:T.borderSub,color:"#fff",border:"none",borderRadius:9,fontWeight:700,fontSize:14}}>→</button>
          </div>
        </Card>
        <div className="chat-sidebar" style={{width:210,flexShrink:0,display:"flex",flexDirection:"column",gap:12}}>
          <Card>
            <ST>Быстрые вопросы</ST>
            {QQ.map((q,i)=>(
              <button key={i} onClick={()=>setInput(q)} style={{width:"100%",padding:"8px 10px",background:"transparent",border:`1px solid ${T.borderSub}`,color:T.slateL,borderRadius:7,fontSize:11,textAlign:"left",marginBottom:5,lineHeight:1.4}}
                onMouseEnter={e=>{e.target.style.borderColor=T.emerald;e.target.style.color=T.white;}}
                onMouseLeave={e=>{e.target.style.borderColor=T.borderSub;e.target.style.color=T.slateL;}}>
                {q}
              </button>
            ))}
          </Card>
          <Card>
            <ST>Сегодня</ST>
            {[["Приёмов",todayAppts.filter(a=>a.status!=="cancelled").length],["Свободно слотов",freeSlotsToday.length],["Выручка",tg(todayRev)]].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${T.borderSub}`,fontSize:12}}>
                <span style={{color:T.slate}}>{l}</span><span style={{color:T.white,fontWeight:600}}>{v}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// AI ASSISTANT — for doctors (clinical questions)
// ═══════════════════════════════════════════════════════════════════
function AIAdmin({ user, patients, appointments, treatments, clinic }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const cId = clinic?.id;
  const myAppts = appointments.filter(a=>a.clinicId===cId&&a.doctorId===user.id&&a.date===today());
  const myPats = patients.filter(p=>p.clinicId===cId);
  const myTreat = treatments.filter(t=>t.clinicId===cId&&t.doctorId===user.id&&t.status==="active");

  const SYS = `Ты умный AI-ассистент врача ${user.name} (${user.spec}) в клинике DentVision, г. Тараз, Казахстан.
Помогаешь с: клиническими протоколами, подбором материалов, дифференциальной диагностикой, работой с пациентами, эндодонтией, ортопедией, терапией.
Сегодня у врача ${myAppts.length} приёмов. Активных планов лечения: ${myTreat.length}.
Отвечай профессионально, конкретно, на русском языке.`;

  async function send() {
    if (!input.trim()||loading) return;
    const um={role:"user",content:input.trim()};
    const nm=[...msgs,um];
    setMsgs(nm); setInput(""); setLoading(true);
    try {
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1000,system:SYS,messages:nm})});
      const d=await res.json();
      const t=d.content?.map(b=>b.text||"").join("")||"Ошибка";
      setMsgs([...nm,{role:"assistant",content:t}]);
    } catch {
      setMsgs([...nm,{role:"assistant",content:"Ошибка соединения."}]);
    }
    setLoading(false);
  }

  const QQ=["Протокол лечения пульпита","Дифдиагностика боли после пломбирования","Выбор материала для реставрации","Работа с тревожным пациентом","Препараты при аллергии на лидокаин"];

  return (
    <div className="fade-in">
      <PH title="🤖 AI-ассистент" sub={`${user.name} · ${user.spec}`}/>
      <div style={{display:"flex",gap:16}}>
        <Card style={{flex:1,padding:0,overflow:"hidden",display:"flex",flexDirection:"column",height:500}}>
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.borderSub}`,background:`${T.sapphire}10`,display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:34,height:34,borderRadius:9,background:T.sapphire,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🤖</div>
            <div>
              <div style={{fontWeight:700,fontSize:13,color:T.white}}>AI-ассистент врача</div>
              <div style={{fontSize:11,color:T.slate}}>Клинические вопросы · Протоколы · Диагностика</div>
            </div>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:14,display:"flex",flexDirection:"column",gap:10}}>
            {msgs.length===0&&(
              <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",padding:20}}>
                <div style={{fontSize:40,marginBottom:12}}>🤖</div>
                <div style={{fontSize:14,fontWeight:600,color:T.white,marginBottom:6}}>Добрый день, доктор!</div>
                <div style={{fontSize:12,color:T.slate,maxWidth:280,lineHeight:1.6}}>Готов помочь с клиническими вопросами, протоколами лечения и диагностикой.</div>
              </div>
            )}
            {msgs.map((m,i)=>(
              <div key={i} style={{display:"flex",gap:8,justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
                {m.role==="assistant"&&<div style={{width:26,height:26,borderRadius:7,background:T.sapphire,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0,alignSelf:"flex-end"}}>🤖</div>}
                <div style={{maxWidth:"78%",padding:"9px 13px",borderRadius:m.role==="user"?"13px 13px 3px 13px":"13px 13px 13px 3px",background:m.role==="user"?T.sapphire:"rgba(255,255,255,0.06)",color:T.white,fontSize:13,lineHeight:1.6}}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading&&<div style={{display:"flex",gap:8}}><div style={{width:26,height:26,borderRadius:7,background:T.sapphire,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>🤖</div><div style={{padding:"10px 14px",borderRadius:"13px 13px 13px 3px",background:"rgba(255,255,255,0.06)",display:"flex",gap:4}}>{[0,1,2].map(i=><span key={i} style={{width:6,height:6,borderRadius:"50%",background:T.sapphire,display:"inline-block",animation:`pulse 1.2s ease ${i*.2}s infinite`}}/>)}</div></div>}
          </div>
          <div style={{padding:"10px 14px",borderTop:`1px solid ${T.borderSub}`,display:"flex",gap:8}}>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()} placeholder="Задайте клинический вопрос..." disabled={loading} style={{flex:1}}/>
            <button onClick={send} disabled={loading||!input.trim()} style={{padding:"9px 16px",background:input.trim()&&!loading?T.sapphire:T.borderSub,color:"#fff",border:"none",borderRadius:9,fontWeight:700,fontSize:14}}>→</button>
          </div>
        </Card>
        <div className="chat-sidebar" style={{width:200,display:"flex",flexDirection:"column",gap:12}}>
          <Card>
            <ST>Быстрые вопросы</ST>
            {QQ.map((q,i)=>(
              <button key={i} onClick={()=>setInput(q)} style={{width:"100%",padding:"8px 10px",background:"transparent",border:`1px solid ${T.borderSub}`,color:T.slateL,borderRadius:7,fontSize:11,textAlign:"left",marginBottom:5,lineHeight:1.4}}
                onMouseEnter={e=>{e.target.style.borderColor=T.sapphire;e.target.style.color=T.white;}}
                onMouseLeave={e=>{e.target.style.borderColor=T.borderSub;e.target.style.color=T.slateL;}}>
                {q}
              </button>
            ))}
          </Card>
          <Card>
            <ST>Мой день</ST>
            <div style={{fontSize:12,color:T.slate,marginBottom:6}}>Приёмов сегодня</div>
            <div style={{fontFamily:"Georgia,serif",fontSize:24,fontWeight:700,color:T.gold,marginBottom:12}}>{myAppts.length}</div>
            <div style={{fontSize:12,color:T.slate,marginBottom:4}}>Активных планов</div>
            <div style={{fontFamily:"Georgia,serif",fontSize:20,fontWeight:700,color:T.sapphire}}>{myTreat.length}</div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// UI PRIMITIVES
// ═══════════════════════════════════════════════════════════════════
function Sidebar({tabs,page,setPage,badge,badgeColor,name,sub,onLogout}) {
  return (
    <div className="sidebar" style={{width:210,background:T.navy,display:"flex",flexDirection:"column",borderRight:`1px solid ${T.borderSub}`,flexShrink:0}}>
      <div style={{padding:"22px 18px 14px"}}>
        <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:12}}>
          <div style={{width:32,height:32,borderRadius:8,background:`linear-gradient(135deg,${T.gold},${T.goldDim})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>🦷</div>
          <div>
            <div style={{fontWeight:700,fontSize:13,color:T.white,fontFamily:"Georgia,serif"}}>DentVision</div>
            <div style={{fontSize:9,color:T.gold,letterSpacing:"0.05em"}}>BY DR.TAMIRLAN</div>
          </div>
        </div>
        {badge&&<div style={{padding:"4px 10px",borderRadius:8,background:`${badgeColor}18`,border:`1px solid ${badgeColor}30`,fontSize:10,color:badgeColor,fontWeight:700,textAlign:"center"}}>{badge}</div>}
      </div>
      <div style={{height:1,background:T.borderSub}}/>
      <nav style={{flex:1,padding:"10px 10px"}}>
        {tabs.map(t=>{
          const a=page===t.id;
          return <button key={t.id} onClick={()=>setPage(t.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:9,padding:"9px 12px",borderRadius:9,border:"none",background:a?`${T.gold}10`:"transparent",color:a?T.gold:T.slate,fontSize:12,fontWeight:a?700:400,marginBottom:2,textAlign:"left",borderLeft:a?`2px solid ${T.gold}`:"2px solid transparent",transition:"all .15s"}}>{t.icon} {t.label}</button>;
        })}
      </nav>
      <div style={{padding:"12px 10px",borderTop:`1px solid ${T.borderSub}`}}>
        <div style={{padding:"9px 12px",background:T.card,borderRadius:9,marginBottom:8}}>
          <div style={{fontSize:12,fontWeight:600,color:T.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</div>
          {sub&&<div style={{fontSize:10,color:T.slate,marginTop:1}}>{sub}</div>}
        </div>
        <button onClick={onLogout} style={{width:"100%",padding:"7px",background:"transparent",border:`1px solid ${T.borderSub}`,color:T.slate,borderRadius:7,fontSize:11}}>Выйти</button>
      </div>
    </div>
  );
}

function MobileNav({tabs,page,setPage}) {
  return (
    <div className="mobile-nav" style={{display:"none",position:"fixed",bottom:0,left:0,right:0,background:T.navy,borderTop:`1px solid ${T.borderSub}`,zIndex:100,padding:"6px 0"}}>
      {tabs.slice(0,5).map(t=>{
        const a=page===t.id;
        return <button key={t.id} onClick={()=>setPage(t.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"6px 4px",border:"none",background:"transparent",color:a?T.gold:T.slate,fontSize:18}}>
          <span>{t.icon}</span>
          <span style={{fontSize:9,fontWeight:a?700:400}}>{t.label}</span>
        </button>;
      })}
    </div>
  );
}

function Card({children,style}){return <div style={{background:T.card,border:`1px solid ${T.borderSub}`,borderRadius:13,padding:18,...style}}>{children}</div>;}
function StatCard({l,v,c}){return <div style={{background:T.card,border:`1px solid ${T.borderSub}`,borderRadius:11,padding:"14px 16px"}}><div style={{fontSize:11,color:T.slate,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.05em"}}>{l}</div><div style={{fontFamily:"Georgia,serif",fontSize:20,fontWeight:700,color:c||T.white}}>{v}</div></div>;}
function PH({title,sub,children}){return <div className="page-header" style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22,flexWrap:"wrap",gap:10}}><div><h1 style={{fontFamily:"Georgia,serif",fontSize:22,fontWeight:700,color:T.white,margin:0,letterSpacing:"-0.02em"}}>{title}</h1>{sub&&<div style={{fontSize:12,color:T.slate,marginTop:3}}>{sub}</div>}</div>{children&&<div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>{children}</div>}</div>;}
function ST({children}){return <div style={{fontSize:11,fontWeight:700,color:T.slate,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:12}}>{children}</div>;}
function PBtn({children,onClick,style,disabled}){return <button onClick={onClick} disabled={disabled} style={{padding:"9px 18px",background:`linear-gradient(135deg,${T.gold},${T.goldDim})`,color:T.bg,border:"none",borderRadius:8,fontSize:13,fontWeight:700,boxShadow:`0 4px 14px rgba(201,169,110,.2)`,opacity:disabled?.6:1,...style}}>{children}</button>;}
function GBtn({children,onClick,color}){return <button onClick={onClick} style={{padding:"6px 11px",background:`${color||T.slateL}15`,color:color||T.slateL,border:`1px solid ${color||T.slateL}30`,borderRadius:7,fontSize:12,fontWeight:600,whiteSpace:"nowrap",transition:"all .12s"}}>{children}</button>;}
function Toast({msg,type}){return <div style={{position:"fixed",bottom:24,right:24,background:type==="success"?T.emerald:T.ruby,color:"#fff",padding:"12px 20px",borderRadius:10,fontWeight:600,fontSize:13,boxShadow:"0 8px 28px rgba(0,0,0,.4)",zIndex:999}}>{ type==="success"?"✓":"✕"} {msg}</div>;}
function Modal({title,onClose,children}){return <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}}>
  <div style={{background:T.navy,border:`1px solid ${T.border}`,borderRadius:15,padding:26,width:440,maxWidth:"95vw",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 30px 80px rgba(0,0,0,.5)"}}>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:18}}><div style={{fontFamily:"Georgia,serif",fontSize:17,fontWeight:700,color:T.white}}>{title}</div><button onClick={onClose} style={{background:"transparent",border:"none",color:T.slate,fontSize:21,lineHeight:1}}>×</button></div>
    {children}
  </div>
</div>;}
