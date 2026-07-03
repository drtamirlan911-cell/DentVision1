// ═══════════════════════════════════════════════════════════════════
// SUPABASE API LAYER
// ═══════════════════════════════════════════════════════════════════

import { toSnakeRow, toCamelRow, FIELD_MAP } from './constants';

const SUPABASE_URL = "https://yrokwnlabqxoztbzzhox.supabase.co";
const SUPABASE_KEY = "sb_publishable_Zx5ZfAsOiEddSPNjun3TyA_eUiBDBlA";

const sbHeaders = {
  "Content-Type": "application/json",
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

// Public read-only access to clinics list
export async function sbSelectClinics() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/clinics?select=*`, { headers: sbHeaders });
  if (!res.ok) throw new Error(`Supabase select clinics failed: ${res.status}`);
  return res.json();
}

// RPC calls for secure operations
export async function sbRpc(fn, args) {
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

// Authentication
export async function verifyLogin(login, password) {
  const rows = await sbRpc("verify_login", { p_login: login, p_password: password });
  return rows && rows.length > 0 ? rows[0] : null;
}

// Load all clinic data in one call
export async function loadClinicData(clinicId) {
  const rows = await sbRpc("get_clinic_data", { p_clinic_id: clinicId });
  return Array.isArray(rows) ? rows[0] : rows;
}

// Generic upsert for tables
export async function upsertRow(table, row) {
  const fnMap = { 
    patients: "upsert_patient", 
    appointments: "upsert_appointment", 
    treatments: "upsert_treatment", 
    receipts: "upsert_receipt",
    subscriptions: "upsert_subscription",
    lab_orders: "upsert_lab_order",
    photos: "upsert_photo",
    expenses: "upsert_expense",
    inventory: "upsert_inventory",
    debts: "upsert_debt",
    referrals: "upsert_referral"
  };
  const fn = fnMap[table];
  if (!fn) return;
  return sbRpc(fn, { p: toSnakeRow(table, row) });
}

// Clinic management (Super Admin only)
export async function upsertClinic(clinic) {
  return sbRpc("upsert_clinic", { p: toSnakeRow("clinics", clinic) });
}

// Delete row
export async function deleteRow(table, id) {
  return sbRpc("delete_row", { p_table: table, p_id: id });
}

// Create user with secure password hashing
export async function createUserSecure(user) {
  return sbRpc("create_user_secure", {
    p_id: user.id, 
    p_clinic_id: user.clinicId, 
    p_login: user.login,
    p_password: user.password, 
    p_name: user.name, 
    p_role: user.role, 
    p_spec: user.spec || null,
  });
}

// Subscription management
export async function createSubscription(clinicId, plan, months = 1) {
  return sbRpc("create_subscription", { 
    p_clinic_id: clinicId, 
    p_plan: plan,
    p_months: months 
  });
}

export async function getSubscriptionStatus(clinicId) {
  const rows = await sbRpc("get_subscription_status", { p_clinic_id: clinicId });
  return rows && rows.length > 0 ? rows[0] : null;
}

// WhatsApp integration
export async function sendWhatsAppMessage(phone, message) {
  try {
    // Using WhatsApp Business API or third-party service
    const res = await fetch("https://api.whatsapp.com/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, message }),
    });
    return res.ok;
  } catch (e) {
    console.error("WhatsApp send failed:", e);
    return false;
  }
}

// Appointment confirmation via WhatsApp
export async function confirmAppointmentViaWhatsApp(appointment, patient, clinic) {
  const message = `Здравствуйте, ${patient.name}!\n\nПодтвердите запись на приём:\n📅 ${appointment.date} в ${appointment.time}\n👨‍⚕️ Врач: ${appointment.doctorName}\n🏥 Клиника: ${clinic.name}\n\nОтветьте "ДА" для подтверждения или "НЕТ" для отмены.`;
  return sendWhatsAppMessage(patient.phone, message);
}

// Reminder automation
export async function sendAppointmentReminder(appointment, patient, clinic) {
  const message = `Напоминание о приёме завтра!\n\n${patient.name}, ждём вас:\n📅 ${appointment.date} в ${appointment.time}\n👨‍⚕️ ${appointment.doctorName}\n📍 ${clinic.address}\n\nПри необходимости отмените запись заранее.`;
  return sendWhatsAppMessage(patient.phone, message);
}

// Connection test
export async function testConnection() {
  try {
    await sbSelectClinics();
    return { ok: true, time: new Date().toLocaleTimeString("ru-RU") };
  } catch (e) {
    return { ok: false, time: new Date().toLocaleTimeString("ru-RU"), msg: String(e?.message || e) };
  }
}

// Diagnostics
export async function runDiagnostics() {
  const results = [];

  // Test 1: Base URL
  try {
    const r = await fetch(SUPABASE_URL, { method: "GET" });
    results.push({ name: "Базовый URL", ok: true, detail: `HTTP ${r.status}` });
  } catch (e) {
    results.push({ name: "Базовый URL", ok: false, detail: String(e?.message||e) });
  }

  // Test 2: REST with apikey
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/clinics?select=id&limit=1`, { headers: { apikey: SUPABASE_KEY } });
    const text = await r.text();
    results.push({ name: "REST /clinics (apikey)", ok: r.ok, detail: `HTTP ${r.status}` });
  } catch (e) {
    results.push({ name: "REST /clinics (apikey)", ok: false, detail: String(e?.message||e) });
  }

  // Test 3: Full auth
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/clinics?select=id&limit=1`, { headers: sbHeaders });
    results.push({ name: "REST /clinics (full auth)", ok: r.ok, detail: `HTTP ${r.status}` });
  } catch (e) {
    results.push({ name: "REST /clinics (full auth)", ok: false, detail: String(e?.message||e) });
  }

  // Test 4: RPC
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/verify_login`, {
      method: "POST",
      headers: { ...sbHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ p_login: "__test__", p_password: "x" }),
    });
    results.push({ name: "RPC verify_login", ok: r.ok, detail: `HTTP ${r.status}` });
  } catch (e) {
    results.push({ name: "RPC verify_login", ok: false, detail: String(e?.message||e) });
  }

  return results;
}
