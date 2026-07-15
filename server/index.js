// ═══════════════════════════════════════════════════════════════════
// DENTVISION API SERVER - PostgreSQL (Neon) Backend
// ═══════════════════════════════════════════════════════════════════

import express from 'express';
import { Pool } from 'pg';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const ALLOWED_TABLES = [
  'clinics', 'users', 'patients', 'appointments', 'treatments',
  'receipts', 'subscriptions', 'lab_orders', 'photos', 'expenses',
  'inventory', 'debts', 'referrals', 'promotions', 'bookings',
  'medical_cards', 'visits', 'documents', 'waiting_list',
  'shop_products', 'shop_categories', 'shop_orders', 'shop_order_items',
  'shop_reviews', 'shop_favorites', 'shop_suppliers',
  'school_courses', 'school_modules', 'school_lessons', 'school_enrollments',
  'school_certificates', 'school_clinical_cases', 'school_library',
];

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/.*\.vercel\.app$/.test(origin)) return true;
  return false;
}

app.use(helmet());
app.use(cors({ origin: (origin, cb) => cb(null, isOriginAllowed(origin)), credentials: true }));
app.use(express.json({ limit: '1mb' }));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);

// PostgreSQL connection pool (Neon)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// ═══════════════════════════════════════════════════════════════
// ENCRYPTION (AES-256-GCM for sensitive patient data)
// ═══════════════════════════════════════════════════════════════
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex').slice(0, 32);
const ENCRYPTION_IV_LENGTH = 16;

function encrypt(text) {
  if (!text) return text;
  try {
    const iv = crypto.randomBytes(ENCRYPTION_IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf8'), iv);
    let encrypted = cipher.update(String(text), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch { return text; }
}

function decrypt(text) {
  if (!text || !text.includes(':')) return text;
  try {
    const [ivHex, encrypted] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf8'), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch { return text; }
}

// Fields to encrypt in patients table
const PATIENT_ENCRYPT_FIELDS = ['address', 'email', 'notes'];

function encryptPatient(row) {
  if (!row) return row;
  const out = { ...row };
  for (const f of PATIENT_ENCRYPT_FIELDS) { if (out[f]) out[f] = encrypt(out[f]); }
  return out;
}

function decryptPatient(row) {
  if (!row) return row;
  const out = { ...row };
  for (const f of PATIENT_ENCRYPT_FIELDS) { if (out[f]) out[f] = decrypt(out[f]); }
  return out;
}

function decryptPatients(rows) { return rows.map(decryptPatient); }

// ═══════════════════════════════════════════════════════════════
// AUDIT LOG HELPER
// ═══════════════════════════════════════════════════════════════
async function writeAuditLog(clinicId, userId, userName, action, entityType, entityId, details) {
  try {
    const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    await pool.query(
      `INSERT INTO audit_log (id, clinic_id, user_id, user_name, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, clinicId, userId, userName, action, entityType, entityId || null, details ? JSON.stringify(details) : null]
    );
  } catch (e) { console.error('Audit log write failed:', e.message); }
}

function validateTable(table) {
  return ALLOWED_TABLES.includes(table);
}

function sanitizeColumnName(col) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col);
}

// DATABASE INITIALIZATION
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Reset DB if RESET_DB=true (set in Render env vars, then remove after one deploy)
    if (process.env.RESET_DB === 'true') {
      console.log('RESET_DB is true — dropping all tables...');
      await client.query(`
        DROP TABLE IF EXISTS audit_log CASCADE;
        DROP TABLE IF EXISTS documents CASCADE;
        DROP TABLE IF EXISTS visits CASCADE;
        DROP TABLE IF EXISTS medical_cards CASCADE;
        DROP TABLE IF EXISTS icd10 CASCADE;
        DROP TABLE IF EXISTS password_resets CASCADE;
        DROP TABLE IF EXISTS referrals CASCADE;
        DROP TABLE IF EXISTS debts CASCADE;
        DROP TABLE IF EXISTS bookings CASCADE;
        DROP TABLE IF EXISTS promotions CASCADE;
        DROP TABLE IF EXISTS inventory CASCADE;
        DROP TABLE IF EXISTS expenses CASCADE;
        DROP TABLE IF EXISTS photos CASCADE;
        DROP TABLE IF EXISTS lab_orders CASCADE;
        DROP TABLE IF EXISTS subscriptions CASCADE;
        DROP TABLE IF EXISTS receipts CASCADE;
        DROP TABLE IF EXISTS treatments CASCADE;
        DROP TABLE IF EXISTS appointments CASCADE;
        DROP TABLE IF EXISTS patients CASCADE;
        DROP TABLE IF EXISTS users CASCADE;
        DROP TABLE IF EXISTS clinics CASCADE;
      `);
      console.log('All tables dropped. Recreating...');
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS clinics (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        city VARCHAR(100),
        address TEXT,
        phone VARCHAR(50),
        plan VARCHAR(50) DEFAULT 'starter',
        active BOOLEAN DEFAULT true,
        color VARCHAR(7) DEFAULT '#C9A96E',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        clinic_id VARCHAR(50) REFERENCES clinics(id),
        login VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        spec VARCHAR(100),
        phone VARCHAR(50),
        email VARCHAR(255),
        bio TEXT,
        photo_url TEXT,
        visibility VARCHAR(20) DEFAULT 'public',
        experience_years INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS patients (
        id VARCHAR(50) PRIMARY KEY,
        clinic_id VARCHAR(50) REFERENCES clinics(id),
        full_name VARCHAR(255) NOT NULL,
        dob DATE,
        gender VARCHAR(10),
        phone VARCHAR(50),
        email VARCHAR(255),
        address TEXT,
        occupation VARCHAR(100),
        notes TEXT,
        category VARCHAR(50) DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id VARCHAR(50) PRIMARY KEY,
        clinic_id VARCHAR(50) REFERENCES clinics(id),
        patient_id VARCHAR(50) REFERENCES patients(id),
        doctor_id VARCHAR(50) REFERENCES users(id),
        date DATE NOT NULL,
        time VARCHAR(10) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS treatments (
        id VARCHAR(50) PRIMARY KEY,
        clinic_id VARCHAR(50) REFERENCES clinics(id),
        patient_id VARCHAR(50) REFERENCES patients(id),
        doctor_id VARCHAR(50) REFERENCES users(id),
        appointment_id VARCHAR(50) REFERENCES appointments(id),
        tooth_number VARCHAR(10),
        procedure_type VARCHAR(100),
        description TEXT,
        cost DECIMAL(10,2),
        status VARCHAR(50) DEFAULT 'in_progress',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS receipts (
        id VARCHAR(50) PRIMARY KEY,
        clinic_id VARCHAR(50) REFERENCES clinics(id),
        patient_id VARCHAR(50) REFERENCES patients(id),
        doctor_id VARCHAR(50) REFERENCES users(id),
        amount DECIMAL(10,2) NOT NULL,
        pay_method VARCHAR(50) DEFAULT 'cash',
        status VARCHAR(50) DEFAULT 'paid',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id VARCHAR(50) PRIMARY KEY,
        clinic_id VARCHAR(50) REFERENCES clinics(id) UNIQUE,
        plan VARCHAR(50) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        next_billing DATE,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS lab_orders (
        id VARCHAR(50) PRIMARY KEY,
        clinic_id VARCHAR(50) REFERENCES clinics(id),
        patient_id VARCHAR(50) REFERENCES patients(id),
        doctor_id VARCHAR(50) REFERENCES users(id),
        lab_type VARCHAR(100),
        description TEXT,
        due_date DATE,
        status VARCHAR(50) DEFAULT 'pending',
        cost DECIMAL(10,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS photos (
        id VARCHAR(50) PRIMARY KEY,
        clinic_id VARCHAR(50) REFERENCES clinics(id),
        patient_id VARCHAR(50) REFERENCES patients(id),
        url TEXT NOT NULL,
        title VARCHAR(255),
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id VARCHAR(50) PRIMARY KEY,
        clinic_id VARCHAR(50) REFERENCES clinics(id),
        category_id VARCHAR(50),
        amount DECIMAL(10,2) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        id VARCHAR(50) PRIMARY KEY,
        clinic_id VARCHAR(50) REFERENCES clinics(id),
        name VARCHAR(255) NOT NULL,
        quantity INTEGER DEFAULT 0,
        unit VARCHAR(50),
        min_quantity INTEGER DEFAULT 0,
        category VARCHAR(100),
        supplier VARCHAR(255),
        cost DECIMAL(10,2) DEFAULT 0,
        expiry_date DATE,
        last_order DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS promotions (
        id VARCHAR(50) PRIMARY KEY,
        clinic_id VARCHAR(50) REFERENCES clinics(id),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        discount_percent INTEGER DEFAULT 0,
        service_ids TEXT,
        start_date DATE,
        end_date DATE,
        active BOOLEAN DEFAULT true,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id VARCHAR(50) PRIMARY KEY,
        clinic_id VARCHAR(50) REFERENCES clinics(id),
        patient_name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        email VARCHAR(255),
        doctor_id VARCHAR(50) REFERENCES users(id),
        service_name VARCHAR(255),
        date DATE NOT NULL,
        time VARCHAR(10) NOT NULL,
        notes TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS debts (
        id VARCHAR(50) PRIMARY KEY,
        clinic_id VARCHAR(50) REFERENCES clinics(id),
        patient_id VARCHAR(50) REFERENCES patients(id),
        amount DECIMAL(10,2) NOT NULL,
        paid_amount DECIMAL(10,2) DEFAULT 0,
        due_date DATE,
        status VARCHAR(50) DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id VARCHAR(50) PRIMARY KEY,
        clinic_id VARCHAR(50) REFERENCES clinics(id),
        patient_id VARCHAR(50) REFERENCES patients(id),
        referred_by VARCHAR(255),
        reward DECIMAL(10,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        user_id VARCHAR(50) PRIMARY KEY REFERENCES users(id),
        token VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ═══ Stage 2 MIS Tables ═══

    await client.query(`
      CREATE TABLE IF NOT EXISTS medical_cards (
        id VARCHAR(50) PRIMARY KEY,
        patient_id VARCHAR(50) REFERENCES patients(id) ON DELETE CASCADE,
        clinic_id VARCHAR(50) REFERENCES clinics(id),
        blood_type VARCHAR(10),
        allergies TEXT,
        chronic_diseases TEXT,
        medications TEXT,
        past_surgeries TEXT,
        family_history TEXT,
        emergency_contact VARCHAR(255),
        emergency_phone VARCHAR(50),
        insurance_provider VARCHAR(255),
        insurance_number VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS icd10 (
        code VARCHAR(10) PRIMARY KEY,
        name VARCHAR(500) NOT NULL,
        category VARCHAR(255),
        description TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS visits (
        id VARCHAR(50) PRIMARY KEY,
        clinic_id VARCHAR(50) REFERENCES clinics(id),
        patient_id VARCHAR(50) REFERENCES patients(id),
        doctor_id VARCHAR(50) REFERENCES users(id),
        appointment_id VARCHAR(50),
        visit_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        chief_complaint TEXT,
        diagnosis TEXT,
        icd10_codes TEXT,
        treatment_plan TEXT,
        procedures_done TEXT,
        prescriptions TEXT,
        next_visit_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id VARCHAR(50) PRIMARY KEY,
        clinic_id VARCHAR(50) REFERENCES clinics(id),
        patient_id VARCHAR(50) REFERENCES patients(id),
        doctor_id VARCHAR(50) REFERENCES users(id),
        doc_type VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        file_url TEXT,
        status VARCHAR(50) DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS waiting_list (
        id VARCHAR(50) PRIMARY KEY,
        clinic_id VARCHAR(50) REFERENCES clinics(id),
        patient_id VARCHAR(50) REFERENCES patients(id),
        patient_name VARCHAR(255),
        patient_phone VARCHAR(50),
        doctor_id VARCHAR(50),
        doctor_name VARCHAR(255),
        preferred_date DATE,
        preferred_time VARCHAR(10),
        preferred_service VARCHAR(255),
        notes TEXT,
        status VARCHAR(50) DEFAULT 'waiting',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id VARCHAR(50) PRIMARY KEY,
        clinic_id VARCHAR(50) REFERENCES clinics(id),
        user_id VARCHAR(50),
        user_name VARCHAR(255),
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100),
        entity_id VARCHAR(50),
        details TEXT,
        ip_address VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ═══ SHOP TABLES ═══

    await client.query(`
      CREATE TABLE IF NOT EXISTS shop_categories (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        icon VARCHAR(50),
        description TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS shop_suppliers (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        country VARCHAR(100),
        city VARCHAR(100),
        phone VARCHAR(50),
        email VARCHAR(255),
        website VARCHAR(255),
        rating DECIMAL(2,1) DEFAULT 4.0,
        delivery_days INTEGER DEFAULT 7,
        delivery_cost DECIMAL(10,2) DEFAULT 0,
        free_delivery_from DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS shop_products (
        id VARCHAR(50) PRIMARY KEY,
        category_id VARCHAR(50) REFERENCES shop_categories(id),
        supplier_id VARCHAR(50) REFERENCES shop_suppliers(id),
        name VARCHAR(255) NOT NULL,
        brand VARCHAR(255),
        model VARCHAR(255),
        description TEXT,
        instructions TEXT,
        specifications JSONB,
        price DECIMAL(10,2) NOT NULL,
        old_price DECIMAL(10,2),
        currency VARCHAR(10) DEFAULT '₸',
        stock INTEGER DEFAULT 0,
        min_stock INTEGER DEFAULT 5,
        unit VARCHAR(50) DEFAULT 'шт',
        sku VARCHAR(100),
        rating DECIMAL(2,1) DEFAULT 0,
        review_count INTEGER DEFAULT 0,
        image_url TEXT,
        images JSONB,
        video_url TEXT,
        model_3d_url TEXT,
        tags JSONB,
        compatibility JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS shop_orders (
        id VARCHAR(50) PRIMARY KEY,
        clinic_id VARCHAR(50) REFERENCES clinics(id),
        user_id VARCHAR(50),
        user_name VARCHAR(255),
        status VARCHAR(50) DEFAULT 'pending',
        total DECIMAL(10,2) NOT NULL,
        delivery_address TEXT,
        delivery_method VARCHAR(100),
        delivery_cost DECIMAL(10,2) DEFAULT 0,
        payment_method VARCHAR(50),
        payment_status VARCHAR(50) DEFAULT 'unpaid',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS shop_order_items (
        id VARCHAR(50) PRIMARY KEY,
        order_id VARCHAR(50) REFERENCES shop_orders(id),
        product_id VARCHAR(50) REFERENCES shop_products(id),
        product_name VARCHAR(255),
        quantity INTEGER DEFAULT 1,
        price DECIMAL(10,2) NOT NULL,
        total DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS shop_reviews (
        id VARCHAR(50) PRIMARY KEY,
        product_id VARCHAR(50) REFERENCES shop_products(id),
        clinic_id VARCHAR(50),
        user_id VARCHAR(50),
        user_name VARCHAR(255),
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        pros TEXT,
        cons TEXT,
        comment TEXT,
        helpful_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS shop_favorites (
        id VARCHAR(50) PRIMARY KEY,
        clinic_id VARCHAR(50),
        user_id VARCHAR(50),
        product_id VARCHAR(50) REFERENCES shop_products(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(clinic_id, product_id)
      )
    `);

    // ═══ SCHOOL TABLES ═══

    await client.query(`
      CREATE TABLE IF NOT EXISTS school_courses (
        id VARCHAR(50) PRIMARY KEY,
        category VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        subtitle VARCHAR(255),
        description TEXT,
        instructor VARCHAR(255),
        instructor_avatar TEXT,
        instructor_title VARCHAR(255),
        difficulty VARCHAR(50) DEFAULT 'beginner',
        duration_hours INTEGER DEFAULT 10,
        lesson_count INTEGER DEFAULT 20,
        price DECIMAL(10,2) DEFAULT 0,
        rating DECIMAL(2,1) DEFAULT 0,
        enrolled_count INTEGER DEFAULT 0,
        image_url TEXT,
        tags JSONB,
        certificate_enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS school_modules (
        id VARCHAR(50) PRIMARY KEY,
        course_id VARCHAR(50) REFERENCES school_courses(id),
        title VARCHAR(255) NOT NULL,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS school_lessons (
        id VARCHAR(50) PRIMARY KEY,
        module_id VARCHAR(50) REFERENCES school_modules(id),
        course_id VARCHAR(50) REFERENCES school_courses(id),
        title VARCHAR(255) NOT NULL,
        type VARCHAR(50) DEFAULT 'video',
        content TEXT,
        video_url TEXT,
        duration_minutes INTEGER DEFAULT 30,
        sort_order INTEGER DEFAULT 0,
        is_free BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS school_enrollments (
        id VARCHAR(50) PRIMARY KEY,
        clinic_id VARCHAR(50),
        user_id VARCHAR(50),
        user_name VARCHAR(255),
        course_id VARCHAR(50) REFERENCES school_courses(id),
        progress INTEGER DEFAULT 0,
        completed BOOLEAN DEFAULT false,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        UNIQUE(user_id, course_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS school_certificates (
        id VARCHAR(50) PRIMARY KEY,
        clinic_id VARCHAR(50),
        user_id VARCHAR(50),
        user_name VARCHAR(255),
        course_id VARCHAR(50) REFERENCES school_courses(id),
        course_title VARCHAR(255),
        issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        certificate_number VARCHAR(100) UNIQUE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS school_clinical_cases (
        id VARCHAR(50) PRIMARY KEY,
        category VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        diagnosis TEXT,
        treatment_plan TEXT,
        before_images JSONB,
        after_images JSONB,
        cbct_url TEXT,
        video_url TEXT,
        errors TEXT,
        discussion TEXT,
        author VARCHAR(255),
        difficulty VARCHAR(50) DEFAULT 'medium',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS school_library (
        id VARCHAR(50) PRIMARY KEY,
        category VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        type VARCHAR(50) DEFAULT 'article',
        content TEXT,
        file_url TEXT,
        author VARCHAR(255),
        tags JSONB,
        download_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_clinic ON users(clinic_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_patients_clinic ON patients(clinic_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_appointments_clinic ON appointments(clinic_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_treatments_patient ON treatments(patient_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_receipts_clinic ON receipts(clinic_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_medical_cards_patient ON medical_cards(patient_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_visits_clinic ON visits(clinic_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patient_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_documents_clinic ON documents(clinic_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_log_clinic ON audit_log(clinic_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_icd10_name ON icd10 USING gin(to_tsvector('russian', name))`);

    // Shop indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_shop_products_category ON shop_products(category_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_shop_products_supplier ON shop_products(supplier_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_shop_orders_clinic ON shop_orders(clinic_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_shop_reviews_product ON shop_reviews(product_id)`);
    // School indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_school_courses_category ON school_courses(category)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_school_modules_course ON school_modules(course_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_school_lessons_module ON school_lessons(module_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_school_enrollments_user ON school_enrollments(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_school_clinical_cases_category ON school_clinical_cases(category)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_school_library_category ON school_library(category)`);

    // MIGRATION: add missing columns to existing tables
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50)');
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255)');
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT');
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT');
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT \'public\'');
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS experience_years INTEGER DEFAULT 0');
    await client.query('ALTER TABLE clinics ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT \'#C9A96E\'');
    await client.query('ALTER TABLE clinics ADD COLUMN IF NOT EXISTS city VARCHAR(100)');
    await client.query('ALTER TABLE patients ADD COLUMN IF NOT EXISTS source VARCHAR(100)');
    await client.query('ALTER TABLE patients ADD COLUMN IF NOT EXISTS notes TEXT');
    await client.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 60');
    await client.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS notes TEXT');
    await client.query('ALTER TABLE receipts ADD COLUMN IF NOT EXISTS items JSONB');
    await client.query('ALTER TABLE receipts ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT \'pending\'');
    await client.query('ALTER TABLE patients ADD COLUMN IF NOT EXISTS source VARCHAR(100)');
    await client.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS signature_data TEXT');
    await client.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP');
    await client.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS signed_by_name VARCHAR(255)');
    await client.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS patient_name VARCHAR(255)');
    await client.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS signature_token VARCHAR(255)');

    // Seed ICD-10 (common dental diagnoses)
    const icd10Data = [
      ['K02', 'Кариес зубов', 'Кариес и некариозные поражения', 'Поражение твёрдых тканей зубов'],
      ['K02.0', 'Кариес эмали', 'Кариес', 'Начальный кариес в стадии белого пятна'],
      ['K02.1', 'Кариес дентина', 'Кариес', 'Кариес, поражающий дентин'],
      ['K02.2', 'Кариес цемента', 'Кариес', 'Кариес корня зуба'],
      ['K02.9', 'Кариес зубов неуточнённый', 'Кариес', 'Кариес без уточнения'],
      ['K03', 'Другие болезни твёрдых тканей зубов', 'Некариозные поражения', ''],
      ['K03.0', 'Атрия зубов', 'Некариозные поражения', 'Патологическая стираемость'],
      ['K03.1', 'Абразия зубов', 'Некариозные поражения', 'Стирание от внешних факторов'],
      ['K03.2', 'Эрозия зубов', 'Некариозные поражения', 'Химическое поражение эмали'],
      ['K03.6', 'Гиперцементоз', 'Некариозные поражения', 'Избыточное отложение цемента'],
      ['K04', 'Болезни пульпы и периапикальных тканей', 'Эндодонтия', ''],
      ['K04.0', 'Пульпит', 'Эндодонтия', 'Воспаление пульпы зуба'],
      ['K04.1', 'Пulpus gangraena', 'Эндодонтия', 'Гангрена пульпы'],
      ['K04.2', 'Дегенерация пульпы', 'Эндодонтия', 'Дегенеративные изменения пульпы'],
      ['K04.3', 'Острый апикальный периодонтит', 'Эндодонтия', 'Воспаление периодонта у верхушки корня'],
      ['K04.4', 'Хронический апикальный периодонтит', 'Эндодонтия', ''],
      ['K04.5', 'Хронический периапикальный абсцесс', 'Эндодонтия', ''],
      ['K04.6', 'Абсцесс периапикальный с窦道', 'Эндодонтия', ''],
      ['K05', 'Гингивит и болезни пародонта', 'Пародонтология', ''],
      ['K05.0', 'Острый гингивит', 'Пародонтология', ''],
      ['K05.1', 'Хронический гингивит', 'Пародонтология', ''],
      ['K05.2', 'Острый пародонтит', 'Пародонтология', ''],
      ['K05.3', 'Хронический пародонтит', 'Пародонтология', ''],
      ['K05.4', 'Пародонтоз', 'Пародонтология', 'Атрофия альвеолярного отростка'],
      ['K06', 'Другие изменений десны и беззубого альвеолярного гребня', 'Пародонтология', ''],
      ['K07', 'Деформации челюстей и зубо-челюстного аппарата', 'Ортодонтия', ''],
      ['K07.1', 'Деформации зубных рядов', 'Ортодонтия', 'Неправильный прикус'],
      ['K07.2', 'Аномалии соотношений челюстей', 'Ортодонтия', 'Скелетная аномалия'],
      ['K07.3', 'Аномалии положения зубов', 'Ортодонтия', 'Дистопия, ретенция'],
      ['K08', 'Потеря зубов и замещение дефектов', 'Ортопедия', ''],
      ['K08.1', 'Потеря зубов вследствие травмы', 'Ортопедия', ''],
      ['K08.2', 'Потеря зубов по другой причине', 'Ортопедия', ''],
      ['K09', 'Кисты челюстных костей', 'Хирургия', ''],
      ['K09.0', 'Кисты развития зубов', 'Хирургия', 'Фолликулярная, радикулярная киста'],
      ['K09.1', 'Кисты неodontогенного происхождения', 'Хирургия', 'Новообразования неodontогенного характера'],
      ['K10', 'Другие болезни челюстей', 'Хирургия', ''],
      ['K10.0', 'Развивающиеся кисты челюсти', 'Хирургия', ''],
      ['K10.1', 'Гранулема челюсти', 'Хирургия', ''],
      ['K10.2', 'Остеомиелит челюсти', 'Хирургия', 'Воспаление костной ткани'],
      ['K11', 'Болезни слюнных желёз', 'Хирургия', ''],
      ['K11.1', 'Гипертрофия слюнных желёз', 'Хирургия', ''],
      ['K11.2', 'Сиалоаденит', 'Хирургия', 'Воспаление слюнной железы'],
      ['K12', 'Стоматит и связанные поражения', 'Терапия', ''],
      ['K12.0', 'Рецидивирующее афтозное воспаление полости рта', 'Терапия', 'Афты'],
      ['K12.1', 'Другие формы стоматита', 'Терапия', ''],
      ['K13', 'Другие болезни губ и слизистой оболочки полости рта', 'Терапия', ''],
      ['K13.1', 'Травма слизистой оболочки полости рта', 'Терапия', ''],
      ['K13.2', 'Лейкоплакия полости рта', 'Терапия', 'Предраковое состояние'],
      ['K14', 'Болезни языка', 'Терапия', ''],
      ['S02', 'Перелом черепа и лицевых костей', 'Травматология', ''],
      ['S02.4', 'Перелом верхней челюсти', 'Травматология', ''],
      ['S02.5', 'Перелом нижней челюсти', 'Травматология', ''],
      ['S09', 'Другие травмы головы', 'Травматология', ''],
      ['M26', 'Деформации челюстно-лицевой области', 'Ортодонтия', 'Врождённые и приобретённые'],
      ['Z01', 'Особые состояния, связанные с обследованием', 'Прочее', ''],
      ['Z01.2', 'Стоматологическое обследование', 'Прочее', ''],
      ['Z46.0', 'Замена и ремонт зубного протеза', 'Прочее', ''],
      ['Z58', 'Проблемы, связанные с физической средой', 'Прочее', ''],
    ];
    for (const [code, name, category, description] of icd10Data) {
      await client.query(
        `INSERT INTO icd10 (code, name, category, description) VALUES ($1, $2, $3, $4) ON CONFLICT (code) DO NOTHING`,
        [code, name, category, description]
      );
    }

    // Seed data
    const saPass = await bcrypt.hash('DentVision2025!', 10);
    const adminPass = await bcrypt.hash('admin123', 10);
    const docPass = await bcrypt.hash('doc123', 10);
    const dirPass = await bcrypt.hash('dir123', 10);
    const assistPass = await bcrypt.hash('assist123', 10);

    await client.query(`
      INSERT INTO clinics (id, name, city, address, phone, plan, active, color)
      VALUES 
        ('c1', 'DentVision Тараз — Центр', 'Тараз', 'ул. Толе би, 32', '+7 726 222-33-44', 'pro', true, '#C9A96E'),
        ('c2', 'DentVision Тараз — Север', 'Тараз', 'мкр. Мирас, 15', '+7 726 255-11-22', 'starter', true, '#3498DB')
      ON CONFLICT DO NOTHING
    `);

    await client.query(`
      INSERT INTO users (id, clinic_id, login, password_hash, name, role, spec, phone)
      VALUES 
        ('sa', NULL, 'dr.tamirlan', $1, 'Dr. Tamirlan', 'superadmin', NULL, NULL),
        ('u1', 'c1', 'admin_c1', $2, 'Анна Королёва', 'admin', NULL, '+77161234567'),
        ('u2', 'c1', 'doc1_c1', $3, 'Иванова Мария Сергеевна', 'doctor', 'Терапевт', '+77031112233'),
        ('u3', 'c1', 'doc2_c1', $4, 'Петров Алексей Иванович', 'doctor', 'Ортопед', '+77017778899'),
        ('u6', 'c1', 'dir_c1', $5, 'Нурлан Бекжан', 'director', NULL, '+77011234567'),
        ('u7', 'c1', 'assist_c1', $6, 'Карина Омарова', 'assistant', 'Ассистент', '+77055551234'),
        ('u4', 'c2', 'admin_c2', $2, 'Борис Сейткали', 'admin', NULL, '+77261234567'),
        ('u5', 'c2', 'doc1_c2', $3, 'Сидорова Елена Юрьевна', 'doctor', 'Терапевт', '+77265554433')
      ON CONFLICT DO NOTHING
    `, [saPass, adminPass, docPass, docPass, dirPass, assistPass]);

    await client.query('COMMIT');

    // ═══════════════════════════════════════════════════════════
    // SEED: SHOP + SCHOOL (after COMMIT, in separate transaction)
    // ═══════════════════════════════════════════════════════════
    try {
      const catCount = await pool.query('SELECT COUNT(*) FROM shop_categories');
      if (parseInt(catCount.rows[0].count) === 0) {
        // --- SHOP CATEGORIES ---
        const cats = [
          { id: 'sc1', name: 'Материалы', slug: 'materials', icon: '🧪', description: 'Пломбировочные материалы, композиты, цементы', sort_order: 1 },
          { id: 'sc2', name: 'Импланты', slug: 'implants', icon: '🦷', description: 'Дентальные импланты и компоненты', sort_order: 2 },
          { id: 'sc3', name: 'Инструменты', slug: 'instruments', icon: '🔧', description: 'Стоматологические инструменты', sort_order: 3 },
          { id: 'sc4', name: 'CAD/CAM', slug: 'cadcam', icon: '💻', description: 'Системы компьютерного проектирования', sort_order: 4 },
          { id: 'sc5', name: 'Микроскопы', slug: 'microscopes', icon: '🔬', description: 'Стоматологические микроскопы', sort_order: 5 },
          { id: 'sc6', name: 'Компрессоры', slug: 'compressors', icon: '🌬️', description: 'Стоматологические компрессоры', sort_order: 6 },
          { id: 'sc7', name: 'Автоклавы', slug: 'autoclaves', icon: '♨️', description: 'Стерилизационное оборудование', sort_order: 7 },
          { id: 'sc8', name: 'Сканеры', slug: 'scanners', icon: '📡', description: 'Внутриротовые и лабораторные сканеры', sort_order: 8 },
          { id: 'sc9', name: 'Кресла', slug: 'chairs', icon: '💺', description: 'Стоматологические кресла и установки', sort_order: 9 },
          { id: 'sc10', name: 'Лазеры', slug: 'lasers', icon: '✨', description: 'Стоматологические лазеры', sort_order: 10 },
          { id: 'sc11', name: 'Расходники', slug: 'consumables', icon: '🧤', description: 'Одноразовые расходные материалы', sort_order: 11 },
          { id: 'sc12', name: 'Литература', slug: 'literature', icon: '📚', description: 'Учебники и пособия', sort_order: 12 },
        ];
        for (const c of cats) {
          await pool.query('INSERT INTO shop_categories (id, name, slug, icon, description, sort_order) VALUES ($1,$2,$3,$4,$5,$6)', [c.id, c.name, c.slug, c.icon, c.description, c.sort_order]);
        }

        // --- SHOP SUPPLIERS ---
        const suppliers = [
          { id: 'sup1', name: 'Dental World', country: 'Китай', city: 'Шэньчжэнь', phone: '+86-755-1234567', email: 'info@dentalworld.cn', website: 'dentalworld.cn', rating: 4.2, delivery_days: 14, delivery_cost: 5000, free_delivery_from: 100000 },
          { id: 'sup2', name: 'EuroDent Supply', country: 'Германия', city: 'Мюнхен', phone: '+49-89-7654321', email: 'order@eurodent.de', website: 'eurodent.de', rating: 4.8, delivery_days: 10, delivery_cost: 8000, free_delivery_from: 150000 },
          { id: 'sup3', name: 'MedTrade Plus', country: 'Россия', city: 'Москва', phone: '+7-495-1112233', email: 'sales@medtrade.ru', website: 'medtrade.ru', rating: 4.5, delivery_days: 5, delivery_cost: 2500, free_delivery_from: 50000 },
          { id: 'sup4', name: 'KazDent', country: 'Казахстан', city: 'Алматы', phone: '+7-727-3334455', email: 'info@kazdent.kz', website: 'kazdent.kz', rating: 4.6, delivery_days: 2, delivery_cost: 0, free_delivery_from: 20000 },
          { id: 'sup5', name: 'Global Dental', country: 'США', city: 'Нью-Йорк', phone: '+1-212-9876543', email: 'global@dentalsupply.com', website: 'dentalsupply.com', rating: 4.7, delivery_days: 21, delivery_cost: 12000, free_delivery_from: 200000 },
        ];
        for (const s of suppliers) {
          await pool.query('INSERT INTO shop_suppliers (id, name, country, city, phone, email, website, rating, delivery_days, delivery_cost, free_delivery_from) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [s.id, s.name, s.country, s.city, s.phone, s.email, s.website, s.rating, s.delivery_days, s.delivery_cost, s.free_delivery_from]);
        }

        // --- SHOP PRODUCTS (20 items) ---
        const products = [
          { id: 'sp1', category_id: 'sc1', supplier_id: 'sup2', name: 'Filtek Supreme XTE', brand: '3M', model: 'Universal Restorative', description: 'Универсальный нанокомпозит для реставраций передних и боковых зубов. Отличная полируемость и естественная эстетика. Доступен в 32 оттенках.', price: 68000, old_price: 75000, stock: 45, min_stock: 10, rating: 4.8, review_count: 124, tags: '["композит","реставрация","передние зубы"]' },
          { id: 'sp2', category_id: 'sc1', supplier_id: 'sup2', name: 'Estelite Sigma Quick', brand: 'Tokuyama', model: 'Nano Composite', description: 'Наногибридный композит с превосходными эстетическими свойствами. Уникальная технология AST поставки наполнителя обеспечивает естественный блеск.', price: 55000, old_price: null, stock: 32, min_stock: 10, rating: 4.7, review_count: 89, tags: '["композит","наногибрид","эстетика"]' },
          { id: 'sp3', category_id: 'sc1', supplier_id: 'sup2', name: 'GC Essentia', brand: 'GC', model: 'Universal', description: 'Универсальный композит нового поколения. Оптимальный баланс между прочностью и эстетикой. Идеален для повседневных реставраций.', price: 45000, old_price: 52000, stock: 28, min_stock: 10, rating: 4.5, review_count: 67, tags: '["композит","универсальный","GC"]' },
          { id: 'sp4', category_id: 'sc1', supplier_id: 'sup3', name: 'Ketac CEM Maxicap', brand: '3M', model: 'Glass Ionomer', description: 'Стеклоиономерный цемент для фиксации коронок, мостов и вкладок. Химическая адгезия к эмали и дентину.', price: 28000, old_price: null, stock: 50, min_stock: 15, rating: 4.4, review_count: 56, tags: '["цемент","стеклоиономер","фиксация"]' },
          { id: 'sp5', category_id: 'sc2', supplier_id: 'sup2', name: 'Bone Level Implant SLA', brand: 'Straumann', model: 'RB/LB', description: 'Имплантат Straumann Bone Level с поверхностью SLA. Золотой стандарт дентальной имплантологии. Подходит для всех клинических ситуаций.', price: 285000, old_price: 320000, stock: 18, min_stock: 5, rating: 4.9, review_count: 203, tags: '["имплант","Straumann","SLA"]' },
          { id: 'sp6', category_id: 'sc2', supplier_id: 'sup5', name: 'Replace Select Tapered', brand: 'Nobel Biocare', model: 'Groovy', description: 'Конусный имплантат Nobel Biocare Replace с агрессивной резьбой для первичной стабильности. Идеален для немедленной нагрузки.', price: 265000, old_price: null, stock: 12, min_stock: 5, rating: 4.8, review_count: 178, tags: '["имплант","Nobel","конусный"]' },
          { id: 'sp7', category_id: 'sc2', supplier_id: 'sup4', name: 'TS III SA Surface', brand: 'Osstem', model: 'Standard', description: 'Имплантат Osstem TS III с шероховатой SA-поверхностью. Лучшее соотношение цена/качество. Востребован в более чем 70 странах мира.', price: 95000, old_price: 110000, stock: 35, min_stock: 10, rating: 4.6, review_count: 312, tags: '["имплант","Osstem","бюджетный"]' },
          { id: 'sp8', category_id: 'sc3', supplier_id: 'sup3', name: 'Экскаватор双侧 23/24', brand: 'Hu-Friedy', model: 'College Pliers', description: 'Стоматологические плоскогубцы College Pliers для формирования и адаптации пломбировочных материалов. Эргономичная ручка.', price: 38000, old_price: null, stock: 22, min_stock: 8, rating: 4.7, review_count: 45, tags: '["плоскогубцы","инструмент","формирование"]' },
          { id: 'sp9', category_id: 'sc3', supplier_id: 'sup3', name: 'Скалер金刚石 PM137', brand: 'Kerr', model: 'Sonic Scaler', description: 'Ультразвуковой скалер Kerr для профгигиены. Рабочая насадка с алмазным покрытием. 5 уровней мощности.', price: 72000, old_price: 80000, stock: 15, min_stock: 5, rating: 4.5, review_count: 38, tags: '["скалер","профгигиена","ультразвук"]' },
          { id: 'sp10', category_id: 'sc4', supplier_id: 'sup2', name: 'CEREC PrimeScan', brand: 'Dentsply Sirona', model: 'Intraoral Scanner', description: 'Внутриротовой сканер нового поколения. Скорость сканирования до 50 000 изображений в секунду. ИИ-алгоритм автоматического распознавания.', price: 18500000, old_price: null, stock: 3, min_stock: 1, rating: 4.9, review_count: 87, tags: '["сканер","CEREC","CAD/CAM"]' },
          { id: 'sp11', category_id: 'sc4', supplier_id: 'sup2', name: 'e.max CAD Blocks', brand: 'Ivoclar', model: 'CAD Block', description: 'Блоки из дисиликата лития для фрезерования коронок, вкладок и виниров. Высокая прочность (400 МПа) и превосходная эстетика.', price: 15000, old_price: 18000, stock: 80, min_stock: 20, rating: 4.8, review_count: 156, tags: '["блок","CAD","e.max","Ivoclar"]' },
          { id: 'sp12', category_id: 'sc5', supplier_id: 'sup2', name: 'OPMI pico', brand: 'Carl Zeiss', model: 'Surgical Microscope', description: 'Хирургический микросkop Carl Zeiss для эндодонтии и микрохирургии. Оптическое увеличение до 16x, LED-подсветка 120 000 люкс.', price: 8500000, old_price: null, stock: 2, min_stock: 1, rating: 4.9, review_count: 34, tags: '["микроскоп","Zeiss","хирургия"]' },
          { id: 'sp13', category_id: 'sc6', supplier_id: 'sup2', name: 'Varios 980', brand: 'Durr Dental', model: 'Oil-Free', description: 'Безмасляный компрессор Durr Dental. Производительность 300 л/мин, давление 10 бар. Тихая работа 62 дБ. Идеален для 2-3 кресел.', price: 1850000, old_price: 2100000, stock: 4, min_stock: 2, rating: 4.7, review_count: 28, tags: '["компрессор","Durr","безмасляный"]' },
          { id: 'sp14', category_id: 'sc7', supplier_id: 'sup3', name: 'Vacuklav 41 B1', brand: 'Melag', model: 'Class B', description: 'Автоклав класса B Melag Vacuklav 41. Объём камеры 22 л. 18 программ стерилизации. Автоматическая загрузка воды. Документирование каждого цикла.', price: 3200000, old_price: null, stock: 5, min_stock: 2, rating: 4.8, review_count: 41, tags: '["автоклав","Melag","класс B"]' },
          { id: 'sp15', category_id: 'sc8', supplier_id: 'sup5', name: 'TRIOS 4', brand: '3Shape', model: 'Intraoral Scanner', description: 'Внутриротовой сканер 3Shape с технологией True Color. Поддержка модели прикуса и автоматическое сканирование. Интеграция с Invisalign.', price: 6800000, old_price: 7500000, stock: 3, min_stock: 1, rating: 4.7, review_count: 62, tags: '["сканер","3Shape","TRIOS"]' },
          { id: 'sp16', category_id: 'sc9', supplier_id: 'sup2', name: 'A-dec 500', brand: 'A-dec', model: 'Dental Chair', description: 'Премиальное стоматологическое кресло A-dec 500. Эргономичный дизайн, 12-positions подголовник, интегрированная подсветка. 5 лет гарантии.', price: 5200000, old_price: null, stock: 2, min_stock: 1, rating: 4.9, review_count: 53, tags: '["кресло","A-dec","премиум"]' },
          { id: 'sp17', category_id: 'sc10', supplier_id: 'sup5', name: 'LightWalker AT', brand: 'Fotona', model: 'Dual Wavelength', description: 'Лазерная система Fotona с двумя длинами волн: Er:YAG (2940 нм) и Nd:YAG (1064 нм). Лечение кариеса, хирургия, отбеливание, лазерная эндодонтия.', price: 4500000, old_price: null, stock: 2, min_stock: 1, rating: 4.8, review_count: 29, tags: '["лазер","Fotona","двухволновой"]' },
          { id: 'sp18', category_id: 'sc11', supplier_id: 'sup4', name: 'Перчатки нитриловые S', brand: 'ZARYA', model: 'Powder Free', description: 'Нитриловые перчатки без талька. Размер S (Small). Повышенная тактильная чувствительность. 100 шт в упаковке. Порошко-нет.', price: 4500, old_price: null, stock: 200, min_stock: 50, rating: 4.3, review_count: 89, tags: '["перчатки","нитрил","расходник"]' },
          { id: 'sp19', category_id: 'sc11', supplier_id: 'sup4', name: 'Маски медицинские 3-слойные', brand: 'Биотехмед', model: '50 шт', description: 'Одноразовые медицинские маски 3-слойные. Бактериальная фильтрация 98%. Эластичные ушные петли. Упаковка 50 шт.', price: 2800, old_price: 3500, stock: 150, min_stock: 50, rating: 4.2, review_count: 67, tags: '["маски","расходник","защита"]' },
          { id: 'sp20', category_id: 'sc12', supplier_id: 'sup3', name: 'Терапия зубов: полный курс', brand: 'Де-Медо', model: 'Учебник', description: 'Современный учебник по терапевтической стоматологии. 680 страниц, цветные иллюстрации, QR-коды на видео. Переработанное издание 2024 года.', price: 18000, old_price: null, stock: 30, min_stock: 5, rating: 4.6, review_count: 44, tags: '["учебник","терапия","книга"]' },
        ];
        for (const p of products) {
          await pool.query(
            `INSERT INTO shop_products (id, category_id, supplier_id, name, brand, model, description, price, old_price, stock, min_stock, rating, review_count, tags)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
            [p.id, p.category_id, p.supplier_id, p.name, p.brand, p.model, p.description, p.price, p.old_price, p.stock, p.min_stock, p.rating, p.review_count, p.tags]
          );
        }

        // --- SHOP REVIEWS ---
        const reviews = [
          { product_id: 'sp1', user_name: 'Иванова М.С.', rating: 5, pros: 'Отличная полируемость, натуральный блеск', cons: 'Высокая цена', comment: 'Использую более 5 лет. Лучший композит на рынке.' },
          { product_id: 'sp5', user_name: 'Петров А.И.', rating: 5, pros: 'Предсказуемый результат, высокая приживляемость', cons: 'Дороговато', comment: 'Straumann — золотой стандарт. Ни одной отторжения за 3 года.' },
          { product_id: 'sp7', user_name: 'Сидорова Е.Ю.', rating: 4, pros: 'Хорошее соотношение цена/качество', cons: 'Нужно больше компонентов', comment: 'Osstem — отличный выбор для начинающих имплантологов.' },
          { product_id: 'sp10', user_name: 'Бекжан Н.', rating: 5, pros: 'Невероятная скорость сканирования', cons: 'Дорогой, тяжёлый', comment: 'CEREC PrimeScan изменил наш подход к протезированию.' },
          { product_id: 'sp20', user_name: 'Королёва А.', rating: 4, pros: 'Понятно написано, много иллюстраций', cons: 'Нет онлайн-версии', comment: 'Лучший учебник по терапии на русском языке.' },
        ];
        for (const r of reviews) {
          await pool.query(
            `INSERT INTO shop_reviews (id, product_id, user_name, rating, pros, cons, comment) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            ['rv' + Math.random().toString(36).slice(2, 8), r.product_id, r.user_name, r.rating, r.pros, r.cons, r.comment]
          );
        }

        console.log('Shop seed data inserted');
      }

      // --- SCHOOL COURSES ---
      const schoolCatCount = await pool.query('SELECT COUNT(*) FROM school_courses');
      if (parseInt(schoolCatCount.rows[0].count) === 0) {
        const courses = [
          { id: 'crs1', category: 'Терапия', title: 'Современная терапия кариеса', subtitle: 'От диагностики до реставрации', description: 'Полный курс по терапевтической стоматологии. Изучите современные методы диагностики, препарирования и реставрации кариозных поражений.', instructor: 'Иванова Мария Сергеевна', instructor_title: 'К.м.н., Терапевт', difficulty: 'beginner', duration_hours: 40, lesson_count: 24, price: 0, rating: 4.8, enrolled_count: 1247, tags: '["кариес","реставрация","композит"]', certificate_enabled: true },
          { id: 'crs2', category: 'Имплантация', title: 'Имплантология: от А до Я', subtitle: 'Полный курс дентальной имплантации', description: 'Всё о дентальной имплантации: от планирования до протезирования на имплантах. Клинические протоколы, хирургические техники, осложнения.', instructor: 'Петров Алексей Иванович', instructor_title: 'Хирург-имплантолог, 15 лет опыта', difficulty: 'intermediate', duration_hours: 60, lesson_count: 32, price: 0, rating: 4.9, enrolled_count: 892, tags: '["имплантация","хирургия","протезирование"]', certificate_enabled: true },
          { id: 'crs3', category: 'Ортодонтия', title: 'Ортодонтия с нуля', subtitle: 'Основы ортодонтического лечения', description: 'Курс для начинающих ортодонтов. Диагностика, планирование, фиксация брекетов, элайнеры, ретенция.', instructor: 'Каримова Айгуль Т.', instructor_title: 'Ортодонт, MASTER Invisalign', difficulty: 'beginner', duration_hours: 30, lesson_count: 20, price: 0, rating: 4.7, enrolled_count: 634, tags: '["ортодонтия","брекеты","элайнеры"]', certificate_enabled: true },
          { id: 'crs4', category: 'Хирургия', title: 'Хирургическая стоматология', subtitle: 'Аугментация, синус-лифтинг, удаление', description: 'Продвинутый курс хирургической стоматологии. Костная аугментация, синус-лифтинг, удаление зубов мудрости, управление осложнениями.', instructor: 'Бекжан Нурлан', instructor_title: 'Д.м.н., Хирург', difficulty: 'advanced', duration_hours: 50, lesson_count: 28, price: 0, rating: 4.8, enrolled_count: 456, tags: '["хирургия","аугментация","синус-лифтинг"]', certificate_enabled: true },
          { id: 'crs5', category: 'Ортопедия', title: 'CAD/CAM в стоматологии', subtitle: 'Цифровые технологии протезирования', description: 'Курс по цифровым технологиям: внутриротовые сканеры, CAD-проектирование, фрезерование, 3D-печать в стоматологии.', instructor: 'Смирнов Дмитрий', instructor_title: 'Инженер-технолог, CAD/CAM эксперт', difficulty: 'intermediate', duration_hours: 35, lesson_count: 18, price: 0, rating: 4.6, enrolled_count: 523, tags: '["CAD","CAM","сканер","фрезерование"]', certificate_enabled: true },
          { id: 'crs6', category: 'Маркетинг', title: 'Маркетинг стоматологической клиники', subtitle: 'Привлечение и удержание пациентов', description: 'Как привлекать пациентов через digital-маркетинг, соцсети, SEO и контент. Стратегия роста, сквозная аналитика, управление репутацией.', instructor: 'Ольга Маркетингова', instructor_title: 'CEO Dental Marketing Agency', difficulty: 'beginner', duration_hours: 20, lesson_count: 12, price: 0, rating: 4.5, enrolled_count: 789, tags: '["маркетинг","SMM","SEO","репутация"]', certificate_enabled: true },
          { id: 'crs7', category: 'Фотография', title: 'Клиническая фотография', subtitle: 'Профессиональная съёмка в стоматологии', description: 'Научитесь делать профессиональные фото полости рта, зубов, улыбки. Освещение, ракурсы, макросъёмка, обработка.', instructor: 'Алексей Фотографов', instructor_title: 'Фотограф, преподаватель', difficulty: 'beginner', duration_hours: 15, lesson_count: 10, price: 0, rating: 4.4, enrolled_count: 345, tags: '["фотография","макро","портфолио"]', certificate_enabled: true },
          { id: 'crs8', category: 'Эндодонтия', title: 'Эндодонтия: мастер-класс', subtitle: 'Лечение каналов нового поколения', description: 'Современная эндодонтия: NiTi-инструменты, ирригация, микроскоп, биокерамика. Навигация, мультикорневые зубы, перелечивание.', instructor: 'Иванова Мария Сергеевна', instructor_title: 'К.м.н., Эндодонтист', difficulty: 'advanced', duration_hours: 40, lesson_count: 22, price: 0, rating: 4.9, enrolled_count: 567, tags: '["эндодонтия","каналы","микроскоп"]', certificate_enabled: true },
          { id: 'crs9', category: 'AI', title: 'AI в стоматологии', subtitle: 'Искусственный интеллект в клинической практике', description: 'Как AI меняет стоматологию: компьютерная диагностика, автоматическое планирование, AI-помощник в документации и общении с пациентами.', instructor: 'Дмитрий Технологов', instructor_title: 'AI Research Lead', difficulty: 'intermediate', duration_hours: 25, lesson_count: 15, price: 0, rating: 4.7, enrolled_count: 432, tags: '["AI","диагностика","автоматизация"]', certificate_enabled: true },
        ];
        for (const c of courses) {
          await pool.query(
            `INSERT INTO school_courses (id, category, title, subtitle, description, instructor, instructor_title, difficulty, duration_hours, lesson_count, price, rating, enrolled_count, tags, certificate_enabled)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
            [c.id, c.category, c.title, c.subtitle, c.description, c.instructor, c.instructor_title, c.difficulty, c.duration_hours, c.lesson_count, c.price, c.rating, c.enrolled_count, c.tags, c.certificate_enabled]
          );
        }

        // --- SCHOOL MODULES + LESSONS (sample for first 3 courses) ---
        const modules = [
          { id: 'mod1', course_id: 'crs1', title: 'Введение в терапевтическую стоматологию', sort_order: 1 },
          { id: 'mod2', course_id: 'crs1', title: 'Диагностика кариеса', sort_order: 2 },
          { id: 'mod3', course_id: 'crs1', title: 'Препарирование и пломбирование', sort_order: 3 },
          { id: 'mod4', course_id: 'crs2', title: 'Основы имплантологии', sort_order: 1 },
          { id: 'mod5', course_id: 'crs2', title: 'Хирургический протокол', sort_order: 2 },
          { id: 'mod6', course_id: 'crs2', title: 'Протезирование на имплантах', sort_order: 3 },
          { id: 'mod7', course_id: 'crs8', title: 'Анатомия корневых каналов', sort_order: 1 },
          { id: 'mod8', course_id: 'crs8', title: 'Инструменты и техники', sort_order: 2 },
        ];
        for (const m of modules) {
          await pool.query('INSERT INTO school_modules (id, course_id, title, sort_order) VALUES ($1,$2,$3,$4)', [m.id, m.course_id, m.title, m.sort_order]);
        }

        const lessons = [
          { id: 'l1', module_id: 'mod1', course_id: 'crs1', title: 'Обзор дисциплины', type: 'video', duration_minutes: 15, sort_order: 1, is_free: true },
          { id: 'l2', module_id: 'mod1', course_id: 'crs1', title: 'Инструментарий терапевта', type: 'video', duration_minutes: 25, sort_order: 2, is_free: true },
          { id: 'l3', module_id: 'mod1', course_id: 'crs1', title: 'Материалы для пломбирования', type: 'text', duration_minutes: 20, sort_order: 3 },
          { id: 'l4', module_id: 'mod2', course_id: 'crs1', title: 'Визуальный осмотр и зондирование', type: 'video', duration_minutes: 30, sort_order: 1 },
          { id: 'l5', module_id: 'mod2', course_id: 'crs1', title: 'Рентгенодиагностика', type: 'video', duration_minutes: 35, sort_order: 2 },
          { id: 'l6', module_id: 'mod2', course_id: 'crs1', title: 'Тест: диагностика кариеса', type: 'test', duration_minutes: 15, sort_order: 3 },
          { id: 'l7', module_id: 'mod3', course_id: 'crs1', title: 'Препарирование кариозной полости', type: 'video', duration_minutes: 40, sort_order: 1 },
          { id: 'l8', module_id: 'mod3', course_id: 'crs1', title: 'Наложение коффердама', type: 'video', duration_minutes: 20, sort_order: 2 },
          { id: 'l9', module_id: 'mod4', course_id: 'crs2', title: 'История дентальной имплантации', type: 'video', duration_minutes: 20, sort_order: 1, is_free: true },
          { id: 'l10', module_id: 'mod4', course_id: 'crs2', title: 'Биомеханика остеоинтеграции', type: 'text', duration_minutes: 25, sort_order: 2 },
          { id: 'l11', module_id: 'mod5', course_id: 'crs2', title: 'Планирование по КЛКТ', type: 'video', duration_minutes: 45, sort_order: 1 },
          { id: 'l12', module_id: 'mod5', course_id: 'crs2', title: 'Хирургический набор и протокол', type: 'video', duration_minutes: 50, sort_order: 2 },
        ];
        for (const l of lessons) {
          await pool.query(
            'INSERT INTO school_lessons (id, module_id, course_id, title, type, duration_minutes, sort_order, is_free) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
            [l.id, l.module_id, l.course_id, l.title, l.type, l.duration_minutes, l.sort_order, l.is_free || false]
          );
        }

        // --- SCHOOL CLINICAL CASES ---
        const cases = [
          { id: 'cc1', category: 'Терапия', title: 'Восстановление переднего зуба после травмы', description: 'Пациент 25 лет,复合性 перелом зуба 11. Этапы восстановления: эндодонтия → штифт → коронка.', diagnosis: 'Перелом коронки зуба 11, пульпит', treatment_plan: 'Эндодонтическое лечение → углепластиковый штифт → керамическая коронка', author: 'Иванова М.С.', difficulty: 'medium' },
          { id: 'cc2', category: 'Имплантация', title: 'Полная адентия нижней челюсти', description: 'Пациент 62 года, адентия нижней челюсти. All-on-4 на 4 имплантах Osstem TS III.', diagnosis: 'Полная адентия нижней челюсти, атрофия альвеолярного отростка', treatment_plan: 'All-on-4: 2 ангулярных + 2 базальных импланта → мостовидный протез', author: 'Бекжан Н.', difficulty: 'hard' },
          { id: 'cc3', category: 'Ортодонтия', title: 'Дисталь прикус у подростка', description: 'Пациент 14 лет, дистальный прикус, скученность зубов нижней челюсти. Лечение брекет-системой.', diagnosis: 'Дистальный прикус II класс, скученность', treatment_plan: 'Лечение на самолигирующих брекетах Damon Q, 18 месяцев', author: 'Каримова А.Т.', difficulty: 'medium' },
          { id: 'cc4', category: 'Хирургия', title: 'Удаление ретинированного зуба мудрости', description: 'Пациент 28 лет, ретинированный зуб 48, горизонтальное положение. Синус-лифтинг латеральный.', diagnosis: 'Ретенция зуба 48, дистопия', treatment_plan: 'Удаление под местной анестезией → контроль через 7 дней', author: 'Петров А.И.', difficulty: 'hard' },
          { id: 'cc5', category: 'Эндодонтия', title: 'Перелечивание канала зуба 46', description: 'Пациент 45 лет, боли в зубе 46 после прежнего лечения. Перелечивание под микроскопом.', diagnosis: 'Периапикальный периодонтит зуба 46, перфорация дна полости', treatment_plan: 'Перелечивание каналов:拆除旧充填物 → постановка MTA → пломбирование', author: 'Иванова М.С.', difficulty: 'hard' },
          { id: 'cc6', category: 'Ортопедия', title: 'CAD/CAM реставрация: коронка на зуб 45', description: 'Пациент 38 лет, кариозная полость IV класса по Блеку. Восстановление керамической коронкой по протоколу CEREC.', diagnosis: 'Кариес зуба 45, дефект более 2/3 коронки', treatment_plan: 'Препарирование → внутриротовое сканирование → фрезерование коронки e.max → цементировка', author: 'Смирнов Д.', difficulty: 'medium' },
        ];
        for (const c of cases) {
          await pool.query(
            `INSERT INTO school_clinical_cases (id, category, title, description, diagnosis, treatment_plan, author, difficulty) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [c.id, c.category, c.title, c.description, c.diagnosis, c.treatment_plan, c.author, c.difficulty]
          );
        }

        // --- SCHOOL LIBRARY ---
        const libItems = [
          { id: 'lib1', category: 'Протоколы', title: 'Протокол лечения кариеса I класса', type: 'protocol', author: 'Иванова М.С.', tags: '["кариес","протокол","терапия"]' },
          { id: 'lib2', category: 'Исследования', title: 'Сравнение эффективности NiTi-инструментов', type: 'research', author: 'Петров А.И.', tags: '["эндодонтия","NiTi","исследование"]' },
          { id: 'lib3', category: 'Статьи', title: 'Цифровые оттиски: обзор технологий 2024', type: 'article', author: 'Смирнов Д.', tags: '["сканер","CAD/CAM","обзор"]' },
          { id: 'lib4', category: 'Шаблоны', title: 'Шаблон информированного согласия', type: 'template', author: 'ДентВижн', tags: '["документ","согласие","шаблон"]' },
          { id: 'lib5', category: 'Протоколы', title: 'Протокол отбеливания зубов', type: 'protocol', author: 'Каримова А.Т.', tags: '["отбеливание","протокол","эстетика"]' },
          { id: 'lib6', category: 'Исследования', title: 'Остеоинтеграция: факторы успеха', type: 'research', author: 'Бекжан Н.', tags: '["имплантация","остеоинтеграция","исследование"]' },
          { id: 'lib7', category: 'Статьи', title: 'AI в диагностике кариеса: систематический обзор', type: 'article', author: 'Технологов Д.', tags: '["AI","диагностика","обзор"]' },
          { id: 'lib8', category: 'Шаблоны', title: 'Шаблон плана лечения', type: 'template', author: 'ДентВижн', tags: '["документ","план","шаблон"]' },
        ];
        for (const l of libItems) {
          await pool.query(
            `INSERT INTO school_library (id, category, title, type, author, tags) VALUES ($1,$2,$3,$4,$5,$6)`,
            [l.id, l.category, l.title, l.type, l.author, l.tags]
          );
        }

        console.log('School seed data inserted');
      }
    } catch (seedErr) {
      console.error('Shop/School seed error:', seedErr.message);
    }

    console.log('Database initialized successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Database initialization error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

// API ROUTES

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT NOW()');
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(500).json({ status: 'error', message: 'Database connection failed' });
  }
});

// Clinics
app.get('/api/clinics', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clinics ORDER BY name');
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Registration: create clinic + director account ───
app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { clinicName, city, phone, email, directorName, login: loginStr, password } = req.body;

    if (!clinicName || !loginStr || !password || !directorName) {
      return res.status(400).json({ error: 'Заполните все обязательные поля' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
    }

    // Check if login already exists
    const existing = await pool.query('SELECT id FROM users WHERE login = $1', [loginStr]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Такой логин уже занят — выберите другой' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const clinicId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
      await client.query(
        `INSERT INTO clinics (id, name, city, phone, address, plan, active, color)
         VALUES ($1, $2, $3, $4, '', 'starter', true, '#C9A96E')`,
        [clinicId, clinicName, city || '', phone || '']
      );

      const directorId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
      const passwordHash = await bcrypt.hash(password, 10);
      await client.query(
        `INSERT INTO users (id, clinic_id, login, password_hash, name, role, spec, phone, email)
         VALUES ($1, $2, $3, $4, $5, 'director', 'Руководитель', $6, $7)`,
        [directorId, clinicId, loginStr, passwordHash, directorName, phone || '', email || '']
      );

      await client.query('COMMIT');

      res.json({
        user: { id: directorId, clinicId, login: loginStr, name: directorName, role: 'director', spec: 'Руководитель', phone: phone || '' },
        clinic: { id: clinicId, name: clinicName, city: city || '', plan: 'starter', active: true, color: '#C9A96E' },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Authentication
app.post('/api/auth/login', async (req, res) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({ error: 'Login and password required' });
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE login = $1',
      [login]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { password_hash, ...userWithoutPassword } = user;
    // Map snake_case to camelCase for frontend
    const mapped = {
      ...userWithoutPassword,
      clinicId: userWithoutPassword.clinic_id,
    };
    delete mapped.clinic_id;
    res.json(mapped);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Clinic data
app.get('/api/clinic/:clinicId/data', async (req, res) => {
  try {
    const { clinicId } = req.params;

    const [patients, appointments, treatments, receipts, subscriptions, labOrders, photos, expenses, inventory, debts, referrals, promotions, bookings, medicalCards, visits, documents, waitingList] = await Promise.all([
      pool.query('SELECT * FROM patients WHERE clinic_id = $1', [clinicId]),
      pool.query('SELECT * FROM appointments WHERE clinic_id = $1', [clinicId]),
      pool.query('SELECT * FROM treatments WHERE clinic_id = $1', [clinicId]),
      pool.query('SELECT * FROM receipts WHERE clinic_id = $1', [clinicId]),
      pool.query('SELECT * FROM subscriptions WHERE clinic_id = $1', [clinicId]),
      pool.query('SELECT * FROM lab_orders WHERE clinic_id = $1', [clinicId]),
      pool.query('SELECT * FROM photos WHERE clinic_id = $1', [clinicId]),
      pool.query('SELECT * FROM expenses WHERE clinic_id = $1', [clinicId]),
      pool.query('SELECT * FROM inventory WHERE clinic_id = $1', [clinicId]),
      pool.query('SELECT * FROM debts WHERE clinic_id = $1', [clinicId]),
      pool.query('SELECT * FROM referrals WHERE clinic_id = $1', [clinicId]),
      pool.query('SELECT * FROM promotions WHERE clinic_id = $1', [clinicId]),
      pool.query('SELECT * FROM bookings WHERE clinic_id = $1', [clinicId]),
      pool.query('SELECT * FROM medical_cards WHERE clinic_id = $1', [clinicId]),
      pool.query('SELECT * FROM visits WHERE clinic_id = $1', [clinicId]),
      pool.query('SELECT * FROM documents WHERE clinic_id = $1', [clinicId]),
      pool.query('SELECT * FROM waiting_list WHERE clinic_id = $1', [clinicId]),
    ]);

    res.json({
      patients: decryptPatients(patients.rows),
      appointments: appointments.rows,
      treatments: treatments.rows,
      receipts: receipts.rows,
      subscriptions: subscriptions.rows,
      labOrders: labOrders.rows,
      photos: photos.rows,
      expenses: expenses.rows,
      inventory: inventory.rows,
      debts: debts.rows,
      referrals: referrals.rows,
      promotions: promotions.rows,
      bookings: bookings.rows,
      medicalCards: medicalCards.rows,
      visits: visits.rows,
      documents: documents.rows,
      waitingList: waitingList.rows,
    });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generic upsert with table whitelist
app.post('/api/:table/upsert', async (req, res) => {
  try {
    const { table } = req.params;
    if (!validateTable(table)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }
    const row = req.body;

    const columns = Object.keys(row).filter(sanitizeColumnName);
    if (columns.length === 0) {
      return res.status(400).json({ error: 'No valid columns provided' });
    }
    const values = columns.map(c => row[c]);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const updates = columns.map((col, i) => `${col} = EXCLUDED.${col}`).join(', ');

    const query = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES (${placeholders})
      ON CONFLICT (id) DO UPDATE SET ${updates}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    // Write audit log for write operations
    if (row.clinic_id && result.rows[0]) {
      const action = table === 'patients' ? 'update_patient' :
                     table === 'users' ? 'update_user' :
                     table === 'appointments' ? 'update_appointment' :
                     table === 'receipts' ? 'update_receipt' :
                     `upsert_${table}`;
      writeAuditLog(row.clinic_id, row.user_id, row.user_name, action, table, row.id, { table, id: row.id });
    }

    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generic delete with table whitelist
app.delete('/api/:table/:id', async (req, res) => {
  try {
    const { table, id } = req.params;
    if (!validateTable(table)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }
    const result = await pool.query(
      `DELETE FROM ${table} WHERE id = $1 RETURNING *`,
      [id]
    );

    // Write audit log for deletes
    if (req.query.clinic_id && result.rows[0]) {
      writeAuditLog(req.query.clinic_id, req.query.user_id, req.query.user_name, `delete_${table}`, table, id, { table, id });
    }

    res.json(result.rows[0] || { deleted: true, id });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User creation with password hashing
app.post('/api/users/create', async (req, res) => {
  try {
    const { id, clinic_id, login, password, name, role, spec, phone } = req.body;

    if (!login || !password || !name || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (id, clinic_id, login, password_hash, name, role, spec, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         clinic_id = EXCLUDED.clinic_id,
         login = EXCLUDED.login,
         name = EXCLUDED.name,
         role = EXCLUDED.role,
         spec = EXCLUDED.spec,
         phone = EXCLUDED.phone
       RETURNING *`,
      [id, clinic_id, login, password_hash, name, role, spec, phone]
    );

    const { password_hash: _, ...user } = result.rows[0];
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Public Booking (no auth required) ───
const publicBookingLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

app.get('/api/public/clinic/:clinicId', async (req, res) => {
  try {
    const { clinicId } = req.params;
    const clinicResult = await pool.query('SELECT id, name, city, address, phone, color FROM clinics WHERE id = $1 AND active = true', [clinicId]);
    if (clinicResult.rows.length === 0) return res.status(404).json({ error: 'Clinic not found' });

    const doctorsResult = await pool.query(
      "SELECT id, name, spec, bio, photo_url, experience_years FROM users WHERE clinic_id = $1 AND role = 'doctor' AND (visibility = 'public' OR visibility IS NULL) ORDER BY name",
      [clinicId]
    );

    const servicesResult = await pool.query(
      "SELECT id, name FROM pg_tables WHERE schemaname = 'public'"
    );

    res.json({
      clinic: clinicResult.rows[0],
      doctors: doctorsResult.rows,
    });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/public/booking', publicBookingLimiter, async (req, res) => {
  try {
    const { clinic_id, patient_name, phone, email, doctor_id, service_name, date, time, notes } = req.body;

    if (!clinic_id || !patient_name || !phone || !date || !time) {
      return res.status(400).json({ error: 'Заполните обязательные поля' });
    }

    if (!/^\d{10,15}$/.test(phone.replace(/\D/g, ''))) {
      return res.status(400).json({ error: 'Некорректный номер телефона' });
    }

    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);

    const result = await pool.query(
      `INSERT INTO bookings (id, clinic_id, patient_name, phone, email, doctor_id, service_name, date, time, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
       RETURNING *`,
      [id, clinic_id, patient_name, phone, email || null, doctor_id || null, service_name || null, date, time, notes || null]
    );

    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Password Reset (simple token-based) ───
app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
  try {
    const { login } = req.body;
    if (!login) return res.status(400).json({ error: 'Введите логин' });

    const result = await pool.query('SELECT id, login, name FROM users WHERE login = $1', [login]);
    if (result.rows.length === 0) {
      return res.json({ message: 'Если аккаунт существует, инструкция отправлена' });
    }

    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO password_resets (user_id, token, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET token = $2, expires_at = $3`,
      [result.rows[0].id, token, expires]
    );

    res.json({ message: 'Если аккаунт существует, инструкция отправлена', _devToken: token });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Токен и новый пароль обязательны' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });

    const result = await pool.query(
      'SELECT user_id FROM password_resets WHERE token = $1 AND expires_at > NOW()',
      [token]
    );
    if (result.rows.length === 0) return res.status(400).json({ error: 'Неверный или просроченный токен' });

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, result.rows[0].user_id]);
    await pool.query('DELETE FROM password_resets WHERE token = $1', [token]);

    res.json({ message: 'Пароль успешно изменён' });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── CSP Header endpoint ───
app.get('/api/csp-policy', (_req, res) => {
  res.json({
    policy: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  });
});

// ═══════════════════════════════════════════════════════════════
// STAGE 2 MIS ENDPOINTS
// ═══════════════════════════════════════════════════════════════

// ─── ICD-10 Dictionary ───
app.get('/api/icd10', async (req, res) => {
  try {
    const { search } = req.query;
    let result;
    if (search && search.length >= 2) {
      result = await pool.query(
        `SELECT * FROM icd10 WHERE code ILIKE $1 OR name ILIKE $1 ORDER BY code LIMIT 50`,
        [`%${search}%`]
      );
    } else {
      result = await pool.query('SELECT * FROM icd10 ORDER BY code LIMIT 200');
    }
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Medical Card ───
app.get('/api/medical-cards/:patientId', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM medical_cards WHERE patient_id = $1 ORDER BY updated_at DESC LIMIT 1', [req.params.patientId]);
    res.json(result.rows[0] || null);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/medical-cards/upsert', async (req, res) => {
  try {
    const row = req.body;
    const columns = Object.keys(row).filter(sanitizeColumnName);
    if (columns.length === 0) return res.status(400).json({ error: 'No valid columns' });
    const values = columns.map(c => row[c]);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const updates = columns.map((col, i) => `${col} = EXCLUDED.${col}`).join(', ');
    const result = await pool.query(
      `INSERT INTO medical_cards (${columns.join(', ')})
       VALUES (${placeholders})
       ON CONFLICT (id) DO UPDATE SET ${updates}, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      values
    );
    await writeAuditLog(row.clinic_id, row.user_id, row.user_name, 'upsert', 'medical_card', row.id, { patient_id: row.patient_id });
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Visits ───
app.get('/api/visits', async (req, res) => {
  try {
    const { clinic_id, patient_id } = req.query;
    let query = 'SELECT v.*, p.full_name as patient_name, u.name as doctor_name FROM visits v LEFT JOIN patients p ON v.patient_id = p.id LEFT JOIN users u ON v.doctor_id = u.id WHERE 1=1';
    const params = [];
    let idx = 1;
    if (clinic_id) { query += ` AND v.clinic_id = $${idx++}`; params.push(clinic_id); }
    if (patient_id) { query += ` AND v.patient_id = $${idx++}`; params.push(patient_id); }
    query += ' ORDER BY v.visit_date DESC LIMIT 200';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/visits/upsert', async (req, res) => {
  try {
    const row = req.body;
    const id = row.id || (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
    const result = await pool.query(
      `INSERT INTO visits (id, clinic_id, patient_id, doctor_id, appointment_id, chief_complaint, diagnosis, icd10_codes, treatment_plan, procedures_done, prescriptions, next_visit_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (id) DO UPDATE SET
         chief_complaint=EXCLUDED.chief_complaint, diagnosis=EXCLUDED.diagnosis,
         icd10_codes=EXCLUDED.icd10_codes, treatment_plan=EXCLUDED.treatment_plan,
         procedures_done=EXCLUDED.procedures_done, prescriptions=EXCLUDED.prescriptions,
         next_visit_date=EXCLUDED.next_visit_date, notes=EXCLUDED.notes
       RETURNING *`,
      [id, row.clinic_id, row.patient_id, row.doctor_id || null, row.appointment_id || null,
       row.chief_complaint || null, row.diagnosis || null, row.icd10_codes || null,
       row.treatment_plan || null, row.procedures_done || null, row.prescriptions || null,
       row.next_visit_date || null, row.notes || null]
    );
    await writeAuditLog(row.clinic_id, row.user_id, row.user_name, 'create_visit', 'visit', id, { patient_id: row.patient_id, diagnosis: row.diagnosis });
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Documents ───
app.get('/api/documents', async (req, res) => {
  try {
    const { clinic_id, patient_id } = req.query;
    let query = 'SELECT d.*, p.full_name as patient_name, u.name as doctor_name FROM documents d LEFT JOIN patients p ON d.patient_id = p.id LEFT JOIN users u ON d.doctor_id = u.id WHERE 1=1';
    const params = [];
    let idx = 1;
    if (clinic_id) { query += ` AND d.clinic_id = $${idx++}`; params.push(clinic_id); }
    if (patient_id) { query += ` AND d.patient_id = $${idx++}`; params.push(patient_id); }
    query += ' ORDER BY d.created_at DESC LIMIT 200';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/documents/upsert', async (req, res) => {
  try {
    const row = req.body;
    const columns = Object.keys(row).filter(sanitizeColumnName);
    if (columns.length === 0) return res.status(400).json({ error: 'No valid columns' });
    const values = columns.map(c => row[c]);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const updates = columns.map((col, i) => `${col} = EXCLUDED.${col}`).join(', ');
    const result = await pool.query(
      `INSERT INTO documents (${columns.join(', ')})
       VALUES (${placeholders})
       ON CONFLICT (id) DO UPDATE SET ${updates}, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      values
    );
    await writeAuditLog(row.clinic_id, row.user_id, row.user_name, 'upsert', 'document', row.id, { title: row.title, doc_type: row.doc_type });
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/documents/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM documents WHERE id = $1 RETURNING *', [req.params.id]);
    res.json(result.rows[0] || { deleted: true, id: req.params.id });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Document Signature: generate signing link ───
app.post('/api/documents/:id/send-signature', async (req, res) => {
  try {
    const token = crypto.randomUUID();
    const result = await pool.query(
      'UPDATE documents SET signature_token = $1, status = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
      [token, 'pending_signature', req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Document not found' });
    const baseUrl = process.env.SIGNING_BASE_URL || req.headers.origin || 'https://dent-vision1.vercel.app';
    res.json({ document: result.rows[0], signingUrl: `${baseUrl}/sign/${token}` });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Document Signature: save signature ───
app.put('/api/documents/:id/sign', async (req, res) => {
  try {
    const { signature_data, signed_by_name, token } = req.body;
    if (!signature_data) return res.status(400).json({ error: 'signature_data required' });

    let query, params;
    if (token) {
      query = 'UPDATE documents SET signature_data = $1, signed_at = NOW(), signed_by_name = $2, status = $3, signature_token = NULL, updated_at = NOW() WHERE signature_token = $4 RETURNING *';
      params = [signature_data, signed_by_name || 'Пациент', 'signed', token];
    } else {
      query = 'UPDATE documents SET signature_data = $1, signed_at = NOW(), signed_by_name = $2, status = $3, updated_at = NOW() WHERE id = $4 RETURNING *';
      params = [signature_data, signed_by_name || 'Пациент', 'signed', req.params.id];
    }
    const result = await pool.query(query, params);
    if (!result.rows[0]) return res.status(404).json({ error: 'Document not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Public: view document by signing token ───
app.get('/api/public/document/:token', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT d.*, c.name as clinic_name, c.phone as clinic_phone, c.address as clinic_address FROM documents d LEFT JOIN clinics c ON d.clinic_id = c.id WHERE d.signature_token = $1',
      [req.params.token]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Document not found or already signed' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Audit Log ───
app.get('/api/audit-log', async (req, res) => {
  try {
    const { clinic_id, limit = 100 } = req.query;
    const result = await pool.query(
      'SELECT * FROM audit_log WHERE clinic_id = $1 ORDER BY created_at DESC LIMIT $2',
      [clinic_id, parseInt(limit)]
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Backup ───
app.post('/api/backup', async (req, res) => {
  try {
    const { clinic_id } = req.body;
    if (!clinic_id) return res.status(400).json({ error: 'clinic_id required' });

    const tables = ['patients', 'appointments', 'treatments', 'receipts', 'lab_orders', 'photos', 'expenses', 'inventory', 'debts', 'referrals', 'promotions', 'bookings', 'medical_cards', 'visits', 'documents', 'audit_log'];
    const backup = {};
    for (const t of tables) {
      const result = await pool.query(`SELECT * FROM ${t} WHERE clinic_id = $1`, [clinic_id]);
      backup[t] = result.rows;
    }
    backup.metadata = {
      clinic_id,
      backup_date: new Date().toISOString(),
      tables: tables.length,
      records: Object.values(backup).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0),
    };

    await writeAuditLog(clinic_id, req.body.user_id, req.body.user_name, 'backup', 'system', null, backup.metadata);

    res.json(backup);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════
// SHOP ENDPOINTS
// ═══════════════════════════════════════════════════════════════

app.get('/api/shop/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM shop_categories ORDER BY sort_order');
    res.json(result.rows);
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

app.get('/api/shop/products', async (req, res) => {
  try {
    const { category, search, sort, min_price, max_price, brand } = req.query;
    let query = `SELECT p.*, c.name as category_name, s.name as supplier_name, s.country as supplier_country
                 FROM shop_products p LEFT JOIN shop_categories c ON p.category_id = c.id
                 LEFT JOIN shop_suppliers s ON p.supplier_id = s.id WHERE 1=1`;
    const params = []; let idx = 1;
    if (category) { query += ` AND p.category_id = $${idx++}`; params.push(category); }
    if (search) { query += ` AND (LOWER(p.name) LIKE $${idx} OR LOWER(p.brand) LIKE $${idx} OR LOWER(p.description) LIKE $${idx})`; params.push(`%${search.toLowerCase()}%`); idx++; }
    if (min_price) { query += ` AND p.price >= $${idx++}`; params.push(Number(min_price)); }
    if (max_price) { query += ` AND p.price <= $${idx++}`; params.push(Number(max_price)); }
    if (brand) { query += ` AND LOWER(p.brand) = $${idx++}`; params.push(brand.toLowerCase()); }
    if (sort === 'price_asc') query += ' ORDER BY p.price ASC';
    else if (sort === 'price_desc') query += ' ORDER BY p.price DESC';
    else if (sort === 'rating') query += ' ORDER BY p.rating DESC';
    else if (sort === 'newest') query += ' ORDER BY p.created_at DESC';
    else query += ' ORDER BY p.rating DESC, p.review_count DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

app.get('/api/shop/products/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, c.name as category_name, s.name as supplier_name, s.country as supplier_country, s.delivery_days, s.delivery_cost, s.free_delivery_from
       FROM shop_products p LEFT JOIN shop_categories c ON p.category_id = c.id
       LEFT JOIN shop_suppliers s ON p.supplier_id = s.id WHERE p.id = $1`, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    const reviews = await pool.query('SELECT * FROM shop_reviews WHERE product_id = $1 ORDER BY created_at DESC', [req.params.id]);
    const related = await pool.query('SELECT * FROM shop_products WHERE category_id = $1 AND id != $2 LIMIT 6', [result.rows[0].category_id, req.params.id]);
    res.json({ ...result.rows[0], reviews: reviews.rows, related: related.rows });
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

app.get('/api/shop/suppliers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM shop_suppliers ORDER BY name');
    res.json(result.rows);
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

app.post('/api/shop/orders', async (req, res) => {
  try {
    const { clinic_id, user_id, user_name, items, delivery_address, delivery_method, payment_method, notes } = req.body;
    if (!items || items.length === 0) return res.status(400).json({ error: 'No items' });
    const orderId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    let total = 0; const orderItems = [];
    for (const item of items) {
      const prod = await pool.query('SELECT * FROM shop_products WHERE id = $1', [item.product_id]);
      if (!prod.rows[0]) continue;
      const itemTotal = prod.rows[0].price * item.quantity; total += itemTotal;
      const itemId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
      orderItems.push({ id: itemId, product_id: item.product_id, product_name: prod.rows[0].name, quantity: item.quantity, price: prod.rows[0].price, total: itemTotal });
    }
    const deliveryCost = total >= 50000 ? 0 : 2500;
    await pool.query('INSERT INTO shop_orders (id, clinic_id, user_id, user_name, status, total, delivery_address, delivery_method, delivery_cost, payment_method, notes) VALUES ($1,$2,$3,$4,\'pending\',$5,$6,$7,$8,$9,$10)', [orderId, clinic_id, user_id, user_name, total + deliveryCost, delivery_address, delivery_method, deliveryCost, payment_method, notes]);
    for (const item of orderItems) {
      await pool.query('INSERT INTO shop_order_items (id, order_id, product_id, product_name, quantity, price, total) VALUES ($1,$2,$3,$4,$5,$6,$7)', [item.id, orderId, item.product_id, item.product_name, item.quantity, item.price, item.total]);
      await pool.query('UPDATE shop_products SET stock = stock - $1 WHERE id = $2', [item.quantity, item.product_id]);
    }
    res.json({ id: orderId, total: total + deliveryCost, items: orderItems });
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

app.get('/api/shop/orders', async (req, res) => {
  try {
    const { clinic_id } = req.query;
    let query = 'SELECT * FROM shop_orders'; const params = [];
    if (clinic_id) { query += ' WHERE clinic_id = $1'; params.push(clinic_id); }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    for (const order of result.rows) { const items = await pool.query('SELECT * FROM shop_order_items WHERE order_id = $1', [order.id]); order.items = items.rows; }
    res.json(result.rows);
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

app.post('/api/shop/reviews', async (req, res) => {
  try {
    const { product_id, clinic_id, user_id, user_name, rating, pros, cons, comment } = req.body;
    const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    await pool.query('INSERT INTO shop_reviews (id, product_id, clinic_id, user_id, user_name, rating, pros, cons, comment) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [id, product_id, clinic_id, user_id, user_name, rating, pros, cons, comment]);
    await pool.query('UPDATE shop_products SET rating = (SELECT AVG(rating)::DECIMAL(2,1) FROM shop_reviews WHERE product_id = $1), review_count = (SELECT COUNT(*) FROM shop_reviews WHERE product_id = $1) WHERE id = $1', [product_id]);
    res.json({ id, success: true });
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

app.post('/api/shop/favorites', async (req, res) => {
  try {
    const { clinic_id, user_id, product_id } = req.body;
    const existing = await pool.query('SELECT id FROM shop_favorites WHERE clinic_id = $1 AND product_id = $2', [clinic_id, product_id]);
    if (existing.rows[0]) { await pool.query('DELETE FROM shop_favorites WHERE id = $1', [existing.rows[0].id]); return res.json({ added: false }); }
    const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    await pool.query('INSERT INTO shop_favorites (id, clinic_id, user_id, product_id) VALUES ($1,$2,$3,$4)', [id, clinic_id, user_id, product_id]);
    res.json({ added: true, id });
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

app.get('/api/shop/favorites', async (req, res) => {
  try {
    const { clinic_id } = req.query;
    const result = await pool.query('SELECT f.*, p.name, p.brand, p.price, p.image_url, p.rating, p.review_count, p.stock FROM shop_favorites f JOIN shop_products p ON f.product_id = p.id WHERE f.clinic_id = $1 ORDER BY f.created_at DESC', [clinic_id]);
    res.json(result.rows);
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

// ═══════════════════════════════════════════════════════════════
// SCHOOL ENDPOINTS
// ═══════════════════════════════════════════════════════════════

app.get('/api/school/courses', async (req, res) => {
  try {
    const { category, search, difficulty } = req.query;
    let query = 'SELECT * FROM school_courses WHERE 1=1'; const params = []; let idx = 1;
    if (category) { query += ` AND category = $${idx++}`; params.push(category); }
    if (search) { query += ` AND (LOWER(title) LIKE $${idx} OR LOWER(description) LIKE $${idx})`; params.push(`%${search.toLowerCase()}%`); idx++; }
    if (difficulty) { query += ` AND difficulty = $${idx++}`; params.push(difficulty); }
    query += ' ORDER BY enrolled_count DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

app.get('/api/school/courses/:id', async (req, res) => {
  try {
    const course = await pool.query('SELECT * FROM school_courses WHERE id = $1', [req.params.id]);
    if (!course.rows[0]) return res.status(404).json({ error: 'Not found' });
    const modules = await pool.query('SELECT * FROM school_modules WHERE course_id = $1 ORDER BY sort_order', [req.params.id]);
    for (const mod of modules.rows) {
      const lessons = await pool.query('SELECT * FROM school_lessons WHERE module_id = $1 ORDER BY sort_order', [mod.id]);
      mod.lessons = lessons.rows;
    }
    res.json({ ...course.rows[0], modules: modules.rows });
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

app.post('/api/school/enrollments', async (req, res) => {
  try {
    const { clinic_id, user_id, user_name, course_id } = req.body;
    const existing = await pool.query('SELECT * FROM school_enrollments WHERE user_id = $1 AND course_id = $2', [user_id, course_id]);
    if (existing.rows[0]) return res.json(existing.rows[0]);
    const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    await pool.query('INSERT INTO school_enrollments (id, clinic_id, user_id, user_name, course_id) VALUES ($1,$2,$3,$4,$5)', [id, clinic_id, user_id, user_name, course_id]);
    await pool.query('UPDATE school_courses SET enrolled_count = enrolled_count + 1 WHERE id = $1', [course_id]);
    res.json({ id, success: true });
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

app.get('/api/school/enrollments', async (req, res) => {
  try {
    const { user_id } = req.query;
    const result = await pool.query('SELECT e.*, c.title, c.category, c.difficulty, c.image_url, c.instructor FROM school_enrollments e JOIN school_courses c ON e.course_id = c.id WHERE e.user_id = $1 ORDER BY e.started_at DESC', [user_id]);
    res.json(result.rows);
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

app.get('/api/school/clinical-cases', async (req, res) => {
  try {
    const { category } = req.query;
    let query = 'SELECT * FROM school_clinical_cases'; const params = [];
    if (category) { query += ' WHERE category = $1'; params.push(category); }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

app.get('/api/school/library', async (req, res) => {
  try {
    const { category, type } = req.query;
    let query = 'SELECT * FROM school_library WHERE 1=1'; const params = []; let idx = 1;
    if (category) { query += ` AND category = $${idx++}`; params.push(category); }
    if (type) { query += ` AND type = $${idx++}`; params.push(type); }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

app.get('/api/school/certificates', async (req, res) => {
  try {
    const { user_id } = req.query;
    const result = await pool.query('SELECT * FROM school_certificates WHERE user_id = $1 ORDER BY issued_at DESC', [user_id]);
    res.json(result.rows);
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});

async function startServer() {
  try {
    await initDatabase();

    app.listen(PORT, () => {
      console.log(`API Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

startServer();
