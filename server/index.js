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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const ALLOWED_TABLES = [
  'clinics', 'users', 'patients', 'appointments', 'treatments',
  'receipts', 'subscriptions', 'lab_orders', 'photos', 'expenses',
  'inventory', 'debts', 'referrals', 'promotions', 'bookings',
];

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(helmet());
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
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

    // Indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_clinic ON users(clinic_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_patients_clinic ON patients(clinic_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_appointments_clinic ON appointments(clinic_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_treatments_patient ON treatments(patient_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_receipts_clinic ON receipts(clinic_id)`);

    // Seed data with environment variable passwords
    const hashedPassword = await bcrypt.hash(process.env.SUPERADMIN_PASSWORD || 'changeme', 10);

    await client.query(`
      INSERT INTO clinics (id, name, city, address, phone, plan, active, color)
      VALUES 
        ('c1', 'DentVision Тараз — Центр', 'Тараз', 'ул. Толе би, 32', '+7 726 222-33-44', 'pro', true, '#C9A96E'),
        ('c2', 'DentVision Тараз — Север', 'Тараз', 'мкр. Мирас, 15', '+7 726 255-11-22', 'starter', true, '#3498DB')
      ON CONFLICT (id) DO NOTHING
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
        ('u4', 'c2', 'admin_c2', $7, 'Борис Сейткали', 'admin', NULL, '+77261234567'),
        ('u5', 'c2', 'doc1_c2', $8, 'Сидорова Елена Юрьевна', 'doctor', 'Терапевт', '+77265554433')
      ON CONFLICT (id) DO NOTHING
    `, [
      hashedPassword,
      await bcrypt.hash(process.env.ADMIN1_PASSWORD || 'changeme', 10),
      await bcrypt.hash(process.env.DOCTOR1_PASSWORD || 'changeme', 10),
      await bcrypt.hash(process.env.DOCTOR2_PASSWORD || 'changeme', 10),
      await bcrypt.hash(process.env.DIRECTOR_PASSWORD || 'changeme', 10),
      await bcrypt.hash(process.env.ASSISTANT_PASSWORD || 'changeme', 10),
      await bcrypt.hash(process.env.ADMIN2_PASSWORD || 'changeme', 10),
      await bcrypt.hash(process.env.DOCTOR3_PASSWORD || 'changeme', 10)
    ]);

    await client.query('COMMIT');
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
    res.json(userWithoutPassword);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Clinic data
app.get('/api/clinic/:clinicId/data', async (req, res) => {
  try {
    const { clinicId } = req.params;

    const [patients, appointments, treatments, receipts, subscriptions, labOrders, photos, expenses, inventory, debts, referrals, promotions, bookings] = await Promise.all([
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
    ]);

    res.json({
      patients: patients.rows,
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
