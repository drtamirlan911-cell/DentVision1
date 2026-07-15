// ═══════════════════════════════════════════════════════════════════
// DENTVISION API SERVER — PostgreSQL (Neon) Backend
// Modular architecture with JWT auth, RBAC, multi-tenant isolation
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
const publicBookingLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
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

// ═══════════════════════════════════════════════════════════════
// IMPORT ROUTE MODULES
// ═══════════════════════════════════════════════════════════════
import authRoutes from './routes/auth.js';
import clinicRoutes from './routes/clinic.js';
import medicalRoutes from './routes/medical.js';
import shopRoutes from './routes/shop.js';
import schoolRoutes from './routes/school.js';
import publicRoutes from './routes/public.js';
import auditRoutes from './routes/audit.js';
import { authenticate } from './middleware/auth.js';

// ═══════════════════════════════════════════════════════════════
// DATABASE INITIALIZATION (schema + seed data)
// ═══════════════════════════════════════════════════════════════
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

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
    await client.query(`CREATE INDEX IF NOT EXISTS idx_shop_products_category ON shop_products(category_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_shop_products_supplier ON shop_products(supplier_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_shop_orders_clinic ON shop_orders(clinic_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_shop_reviews_product ON shop_reviews(product_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_school_courses_category ON school_courses(category)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_school_modules_course ON school_modules(course_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_school_lessons_module ON school_lessons(module_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_school_enrollments_user ON school_enrollments(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_school_clinical_cases_category ON school_clinical_cases(category)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_school_library_category ON school_library(category)`);

    // Migrations
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
    await client.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS signature_data TEXT');
    await client.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP');
    await client.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS signed_by_name VARCHAR(255)');
    await client.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS patient_name VARCHAR(255)');
    await client.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS signature_token VARCHAR(255)');

    // Seed ICD-10
    const icd10Data = [
      ['K02', 'Кариес зубов', 'Кариес и некариозные поражения', 'Поражение твёрдых тканей зубов'],
      ['K02.0', 'Кариес эмали', 'Кариес', 'Начальный кариес в стадии белого пятна'],
      ['K02.1', 'Кариес дентина', 'Кариес', 'Кариес, поражающий дентин'],
      ['K02.2', 'Кариес цемента', 'Кариес', 'Кариес корня зуба'],
      ['K02.9', 'Кариес зубов неуточнённый', 'Кариес', 'Кариес без уточнения'],
      ['K03', 'Другие болезни твёрдых тканей зубов', 'Некариозные поражения', ''],
      ['K04', 'Болезни пульпы и периапикальных тканей', 'Эндодонтия', ''],
      ['K04.0', 'Пульпит', 'Эндодонтия', 'Воспаление пульпы зуба'],
      ['K04.3', 'Острый апикальный периодонтит', 'Эндодонтия', 'Воспаление периодонта у верхушки корня'],
      ['K04.4', 'Хронический апикальный периодонтит', 'Эндодонтия', ''],
      ['K05', 'Гингивит и болезни пародонта', 'Пародонтология', ''],
      ['K05.2', 'Острый пародонтит', 'Пародонтология', ''],
      ['K05.3', 'Хронический пародонтит', 'Пародонтология', ''],
      ['K07', 'Деформации челюстей и зубо-челюстного аппарата', 'Ортодонтия', ''],
      ['K07.1', 'Деформации зубных рядов', 'Ортодонтия', 'Неправильный прикус'],
      ['K07.3', 'Аномалии положения зубов', 'Ортодонтия', 'Дистопия, ретенция'],
      ['K08', 'Потеря зубов и замещение дефектов', 'Ортопедия', ''],
      ['K12', 'Стоматит и связанные поражения', 'Терапия', ''],
      ['S02.4', 'Перелом верхней челюсти', 'Травматология', ''],
      ['S02.5', 'Перелом нижней челюсти', 'Травматология', ''],
    ];
    for (const [code, name, category, description] of icd10Data) {
      await client.query(
        `INSERT INTO icd10 (code, name, category, description) VALUES ($1, $2, $3, $4) ON CONFLICT (code) DO NOTHING`,
        [code, name, category, description]
      );
    }

    // Seed users + clinics
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

    // Seed shop + school data (separate transaction)
    try {
      const catCount = await pool.query('SELECT COUNT(*) FROM shop_categories');
      if (parseInt(catCount.rows[0].count) === 0) {
        const cats = [
          { id: 'sc1', name: 'Материалы', slug: 'materials', icon: '🧪', description: 'Пломбировочные материалы', sort_order: 1 },
          { id: 'sc2', name: 'Импланты', slug: 'implants', icon: '🦷', description: 'Дентальные импланты', sort_order: 2 },
          { id: 'sc3', name: 'Инструменты', slug: 'instruments', icon: '🔧', description: 'Стоматологические инструменты', sort_order: 3 },
          { id: 'sc4', name: 'CAD/CAM', slug: 'cadcam', icon: '💻', description: 'Системы компьютерного проектирования', sort_order: 4 },
          { id: 'sc5', name: 'Микроскопы', slug: 'microscopes', icon: '🔬', description: 'Стоматологические микроскопы', sort_order: 5 },
          { id: 'sc6', name: 'Компрессоры', slug: 'compressors', icon: '🌬️', description: 'Стоматологические компрессоры', sort_order: 6 },
          { id: 'sc7', name: 'Автоклавы', slug: 'autoclaves', icon: '♨️', description: 'Стерилизационное оборудование', sort_order: 7 },
          { id: 'sc8', name: 'Сканеры', slug: 'scanners', icon: '📡', description: 'Внутриротовые и лабораторные сканеры', sort_order: 8 },
          { id: 'sc9', name: 'Кресла', slug: 'chairs', icon: '💺', description: 'Стоматологические кресла', sort_order: 9 },
          { id: 'sc10', name: 'Лазеры', slug: 'lasers', icon: '✨', description: 'Стоматологические лазеры', sort_order: 10 },
          { id: 'sc11', name: 'Расходники', slug: 'consumables', icon: '🧤', description: 'Одноразовые расходные материалы', sort_order: 11 },
          { id: 'sc12', name: 'Литература', slug: 'literature', icon: '📚', description: 'Учебники и пособия', sort_order: 12 },
        ];
        for (const c of cats) {
          await pool.query('INSERT INTO shop_categories (id, name, slug, icon, description, sort_order) VALUES ($1,$2,$3,$4,$5,$6)', [c.id, c.name, c.slug, c.icon, c.description, c.sort_order]);
        }

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

        const products = [
          { id: 'sp1', category_id: 'sc1', supplier_id: 'sup2', name: 'Filtek Supreme XTE', brand: '3M', model: 'Universal Restorative', description: 'Универсальный нанокомпозит для реставраций', price: 68000, old_price: 75000, stock: 45, min_stock: 10, rating: 4.8, review_count: 124, tags: '["композит","реставрация"]' },
          { id: 'sp2', category_id: 'sc1', supplier_id: 'sup2', name: 'Estelite Sigma Quick', brand: 'Tokuyama', model: 'Nano Composite', description: 'Наногибридный композит', price: 55000, stock: 32, min_stock: 10, rating: 4.7, review_count: 89, tags: '["композит","наногибрид"]' },
          { id: 'sp5', category_id: 'sc2', supplier_id: 'sup2', name: 'Bone Level Implant SLA', brand: 'Straumann', model: 'RB/LB', description: 'Имплантат Straumann Bone Level', price: 285000, old_price: 320000, stock: 18, min_stock: 5, rating: 4.9, review_count: 203, tags: '["имплант","Straumann"]' },
          { id: 'sp7', category_id: 'sc2', supplier_id: 'sup4', name: 'TS III SA Surface', brand: 'Osstem', model: 'Standard', description: 'Имплантат Osstem TS III', price: 95000, old_price: 110000, stock: 35, min_stock: 10, rating: 4.6, review_count: 312, tags: '["имплант","Osstem"]' },
          { id: 'sp10', category_id: 'sc4', supplier_id: 'sup2', name: 'CEREC PrimeScan', brand: 'Dentsply Sirona', model: 'Intraoral Scanner', description: 'Внутриротовой сканер нового поколения', price: 18500000, stock: 3, min_stock: 1, rating: 4.9, review_count: 87, tags: '["сканер","CEREC"]' },
          { id: 'sp18', category_id: 'sc11', supplier_id: 'sup4', name: 'Перчатки нитриловые S', brand: 'ZARYA', model: 'Powder Free', description: 'Нитриловые перчатки без талька', price: 4500, stock: 200, min_stock: 50, rating: 4.3, review_count: 89, tags: '["перчатки","расходник"]' },
        ];
        for (const p of products) {
          await pool.query(
            `INSERT INTO shop_products (id, category_id, supplier_id, name, brand, model, description, price, old_price, stock, min_stock, rating, review_count, tags) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
            [p.id, p.category_id, p.supplier_id, p.name, p.brand, p.model, p.description, p.price, p.old_price || null, p.stock, p.min_stock, p.rating, p.review_count, p.tags]
          );
        }

        const courses = [
          { id: 'crs1', category: 'Терапия', title: 'Современная терапия кариеса', subtitle: 'От диагностики до реставрации', description: 'Полный курс по терапевтической стоматологии', instructor: 'Иванова Мария Сергеевна', instructor_title: 'К.м.н., Терапевт', difficulty: 'beginner', duration_hours: 40, lesson_count: 24, price: 0, rating: 4.8, enrolled_count: 1247, tags: '["кариес","реставрация"]', certificate_enabled: true },
          { id: 'crs2', category: 'Имплантация', title: 'Имплантология: от А до Я', subtitle: 'Полный курс дентальной имплантации', description: 'Всё о дентальной имплантации', instructor: 'Петров Алексей Иванович', instructor_title: 'Хирург-имплантолог', difficulty: 'intermediate', duration_hours: 60, lesson_count: 32, price: 0, rating: 4.9, enrolled_count: 892, tags: '["имплантация","хирургия"]', certificate_enabled: true },
          { id: 'crs3', category: 'Ортодонтия', title: 'Ортодонтия с нуля', subtitle: 'Основы ортодонтического лечения', description: 'Курс для начинающих ортодонтов', instructor: 'Каримова Айгуль Т.', instructor_title: 'Ортодонт', difficulty: 'beginner', duration_hours: 30, lesson_count: 20, price: 0, rating: 4.7, enrolled_count: 634, tags: '["ортодонтия","брекеты"]', certificate_enabled: true },
          { id: 'crs9', category: 'AI', title: 'AI в стоматологии', subtitle: 'Искусственный интеллект в клинической практике', description: 'Как AI меняет стоматологию', instructor: 'Дмитрий Технологов', instructor_title: 'AI Research Lead', difficulty: 'intermediate', duration_hours: 25, lesson_count: 15, price: 0, rating: 4.7, enrolled_count: 432, tags: '["AI","диагностика"]', certificate_enabled: true },
        ];
        for (const c of courses) {
          await pool.query(
            `INSERT INTO school_courses (id, category, title, subtitle, description, instructor, instructor_title, difficulty, duration_hours, lesson_count, price, rating, enrolled_count, tags, certificate_enabled) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
            [c.id, c.category, c.title, c.subtitle, c.description, c.instructor, c.instructor_title, c.difficulty, c.duration_hours, c.lesson_count, c.price, c.rating, c.enrolled_count, c.tags, c.certificate_enabled]
          );
        }

        console.log('Shop + School seed data inserted');
      }
    } catch (seedErr) {
      console.error('Seed error:', seedErr.message);
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

// ═══════════════════════════════════════════════════════════════
// HEALTH CHECK (public)
// ═══════════════════════════════════════════════════════════════
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT NOW()');
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(500).json({ status: 'error', message: 'Database connection failed' });
  }
});

// ═══════════════════════════════════════════════════════════════
// PUBLIC ROUTES (no auth required)
// ═══════════════════════════════════════════════════════════════
app.use('/api/public', publicRoutes(pool, publicBookingLimiter));

// Clinic list (public for login page)
app.get('/api/clinics', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clinics ORDER BY name');
    res.json(result.rows);
  } catch { res.status(500).json({ error: 'Internal server error' }); }
});

// ═══════════════════════════════════════════════════════════════
// AUTH ROUTES (with rate limiting)
// ═══════════════════════════════════════════════════════════════
app.use('/api/auth', authRoutes(pool, authLimiter));

// ═══════════════════════════════════════════════════════════════
// PROTECTED ROUTES (JWT required)
// ═══════════════════════════════════════════════════════════════
app.use('/api/clinic', clinicRoutes(pool, writeAuditLog));
app.use('/api', medicalRoutes(pool, writeAuditLog));
app.use('/api/shop', shopRoutes(pool));
app.use('/api/school', schoolRoutes(pool));
app.use('/api', auditRoutes(pool, writeAuditLog));

// ═══════════════════════════════════════════════════════════════
// CSP Policy endpoint (public)
// ═══════════════════════════════════════════════════════════════
app.get('/api/csp-policy', (_req, res) => {
  res.json({
    policy: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  });
});

// ═══════════════════════════════════════════════════════════════
// GRACEFUL SHUTDOWN
// ═══════════════════════════════════════════════════════════════
process.on('SIGTERM', async () => { await pool.end(); process.exit(0); });
process.on('SIGINT', async () => { await pool.end(); process.exit(0); });

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
