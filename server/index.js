// ═══════════════════════════════════════════════════════════════════
// DENTVISION API SERVER - PostgreSQL (Neon) Backend
// ═══════════════════════════════════════════════════════════════════

import express from 'express';
import { Pool } from 'pg';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection pool (Neon)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Проверка подключения к БД
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL (Neon)');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
});

// ═══════════════════════════════════════════════════════════════════
// DATABASE INITIALIZATION
// ═══════════════════════════════════════════════════════════════════

async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Таблица клиник
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

    // Таблица пользователей
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица пациентов
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

    // Таблица приёмов
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

    // Таблица лечений
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

    // Таблица оплат
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

    // Таблица подписок
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

    // Таблица лабораторных заказов
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

    // Таблица фотографий
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

    // Таблица расходов
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

    // Таблица инвентаря
    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        id VARCHAR(50) PRIMARY KEY,
        clinic_id VARCHAR(50) REFERENCES clinics(id),
        name VARCHAR(255) NOT NULL,
        quantity INTEGER DEFAULT 0,
        unit VARCHAR(50),
        min_quantity INTEGER DEFAULT 0,
        last_order DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица долгов
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

    // Таблица рефералов
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

    // Индексы для производительности
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_clinic ON users(clinic_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_patients_clinic ON patients(clinic_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_appointments_clinic ON appointments(clinic_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_treatments_patient ON treatments(patient_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_receipts_clinic ON receipts(clinic_id)`);

    // Вставка начальных данных (Super Admin и клиники)
    const hashedPassword = await bcrypt.hash('DentVision2025!', 10);
    
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
      await bcrypt.hash('admin123', 10),
      await bcrypt.hash('doc123', 10),
      await bcrypt.hash('doc456', 10),
      await bcrypt.hash('dir123', 10),
      await bcrypt.hash('assist123', 10),
      await bcrypt.hash('admin456', 10),
      await bcrypt.hash('doc789', 10)
    ]);

    await client.query('COMMIT');
    console.log('✅ Database initialized successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Database initialization error:', err);
    throw err;
  } finally {
    client.release();
  }
}

// ═══════════════════════════════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════════════════════════════

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT NOW()');
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Получить все клиники
app.get('/clinics', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clinics ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Аутентификация
app.post('/auth/login', async (req, res) => {
  try {
    const { login, password } = req.body;
    
    const result = await pool.query(
      'SELECT * FROM users WHERE login = $1',
      [login]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }
    
    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }
    
    // Убираем хэш пароля из ответа
    const { password_hash, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Загрузка данных клиники
app.get('/clinic/:clinicId/data', async (req, res) => {
  try {
    const { clinicId } = req.params;
    
    const [patients, appointments, treatments, receipts, subscriptions, labOrders, photos, expenses, inventory, debts, referrals] = await Promise.all([
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
      pool.query('SELECT * FROM referrals WHERE clinic_id = $1', [clinicId])
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
      referrals: referrals.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Универсальный endpoint для upsert
app.post('/:table/upsert', async (req, res) => {
  try {
    const { table } = req.params;
    const row = req.body;
    
    const columns = Object.keys(row);
    const values = Object.values(row);
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Удаление записи
app.delete('/:table/:id', async (req, res) => {
  try {
    const { table, id } = req.params;
    const result = await pool.query(
      `DELETE FROM ${table} WHERE id = $1 RETURNING *`,
      [id]
    );
    res.json(result.rows[0] || { deleted: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Создание пользователя с хешированием пароля
app.post('/users/create', async (req, res) => {
  try {
    const { id, clinic_id, login, password, name, role, spec, phone } = req.body;
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════════

async function startServer() {
  try {
    await initDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 API Server running on http://localhost:${PORT}`);
      console.log(`📊 PostgreSQL connected: ${process.env.DATABASE_URL ? 'Yes' : 'No'}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
