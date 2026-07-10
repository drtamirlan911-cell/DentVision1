// ═══════════════════════════════════════════════════════════════════
// DENTVISION BACKEND API SERVER
// PostgreSQL (Neon) + Express
// ═══════════════════════════════════════════════════════════════════

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 
    "postgresql://neondb_owner:npg_mvDyi8ntzIV9@ep-gentle-shadow-atzafh1s-pooler.c-9.us-east-1.aws.neon.tech/dent?sslmode=require",
  ssl: {
    rejectUnauthorized: false
  }
});

// Test database connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL (Neon)');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
});

// ═══════════════════════════════════════════════════════════════════
// DATABASE INITIALIZATION - RUN BEFORE ROUTES
// ═══════════════════════════════════════════════════════════════════

let dbInitialized = false;

async function initDatabase() {
  if (dbInitialized) return;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create clinics table
    await client.query(`
      CREATE TABLE IF NOT EXISTS clinics (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        city TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        plan TEXT DEFAULT 'starter',
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        color TEXT DEFAULT '#C9A96E'
      )
    `);

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        clinic_id TEXT REFERENCES clinics(id),
        login TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        spec TEXT,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create patients table
    await client.query(`
      CREATE TABLE IF NOT EXISTS patients (
        id TEXT PRIMARY KEY,
        clinic_id TEXT REFERENCES clinics(id),
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        birth_date TEXT,
        gender TEXT,
        address TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create appointments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id TEXT PRIMARY KEY,
        clinic_id TEXT REFERENCES clinics(id),
        patient_id TEXT REFERENCES patients(id),
        doctor_id TEXT REFERENCES users(id),
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        duration INTEGER DEFAULT 60,
        status TEXT DEFAULT 'scheduled',
        type TEXT DEFAULT 'consultation',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create treatments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS treatments (
        id TEXT PRIMARY KEY,
        clinic_id TEXT REFERENCES clinics(id),
        patient_id TEXT REFERENCES patients(id),
        doctor_id TEXT REFERENCES users(id),
        appointment_id TEXT REFERENCES appointments(id),
        service_name TEXT NOT NULL,
        tooth_number TEXT,
        price DECIMAL(10,2) DEFAULT 0,
        status TEXT DEFAULT 'completed',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create receipts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS receipts (
        id TEXT PRIMARY KEY,
        clinic_id TEXT REFERENCES clinics(id),
        patient_id TEXT REFERENCES patients(id),
        amount DECIMAL(10,2) NOT NULL,
        type TEXT NOT NULL,
        payment_method TEXT DEFAULT 'cash',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create subscriptions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        clinic_id TEXT REFERENCES clinics(id),
        plan TEXT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        status TEXT DEFAULT 'active',
        amount DECIMAL(10,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create lab_orders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS lab_orders (
        id TEXT PRIMARY KEY,
        clinic_id TEXT REFERENCES clinics(id),
        patient_id TEXT REFERENCES patients(id),
        doctor_id TEXT REFERENCES users(id),
        lab_name TEXT,
        order_type TEXT,
        description TEXT,
        status TEXT DEFAULT 'pending',
        cost DECIMAL(10,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        due_date TEXT
      )
    `);

    // Create photos table
    await client.query(`
      CREATE TABLE IF NOT EXISTS photos (
        id TEXT PRIMARY KEY,
        clinic_id TEXT REFERENCES clinics(id),
        patient_id TEXT REFERENCES patients(id),
        url TEXT NOT NULL,
        type TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create expenses table
    await client.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        clinic_id TEXT REFERENCES clinics(id),
        category TEXT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        description TEXT,
        payment_method TEXT,
        created_by TEXT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create inventory table
    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        id TEXT PRIMARY KEY,
        clinic_id TEXT REFERENCES clinics(id),
        name TEXT NOT NULL,
        quantity INTEGER DEFAULT 0,
        unit TEXT,
        min_quantity INTEGER DEFAULT 0,
        price DECIMAL(10,2),
        supplier TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create debts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS debts (
        id TEXT PRIMARY KEY,
        clinic_id TEXT REFERENCES clinics(id),
        patient_id TEXT REFERENCES patients(id),
        amount DECIMAL(10,2) NOT NULL,
        paid_amount DECIMAL(10,2) DEFAULT 0,
        due_date TEXT,
        status TEXT DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create referrals table
    await client.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id TEXT PRIMARY KEY,
        clinic_id TEXT REFERENCES clinics(id),
        patient_id TEXT REFERENCES patients(id),
        doctor_id TEXT REFERENCES users(id),
        referred_by TEXT,
        referral_type TEXT,
        status TEXT DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert default clinics
    await client.query(`
      INSERT INTO clinics (id, name, city, phone, email, address, plan, active, color)
      VALUES 
        ('clinic_1', 'DentVision Клиника 1', 'Москва', '+7 (495) 123-45-67', 'clinic1@dentvision.ru', 'ул. Ленина 1', 'starter', true, '#C9A96E'),
        ('clinic_2', 'DentVision Клиника 2', 'Санкт-Петербург', '+7 (812) 987-65-43', 'clinic2@dentvision.ru', 'Невский проспект 100', 'pro', true, '#4ECDC4')
      ON CONFLICT (id) DO NOTHING
    `);

    // Hash passwords for default users
    const hashPassword = (pwd) => crypto.createHash('sha256').update(pwd).digest('hex');
    
    const superAdminHash = hashPassword('DentVision2025!');
    const admin1Hash = hashPassword('admin123');
    const admin2Hash = hashPassword('admin456');
    const doctor1Hash = hashPassword('doctor123');

    // Insert default users
    await client.query(`
      INSERT INTO users (id, clinic_id, login, password_hash, name, role, spec, active)
      VALUES 
        ('superadmin', NULL, 'dr.tamirlan', $1, 'Др. Тамерлан', 'superadmin', 'Основатель', true),
        ('user_admin1', 'clinic_1', 'admin_c1', $2, 'Администратор 1', 'admin', 'Старший администратор', true),
        ('user_admin2', 'clinic_2', 'admin_c2', $3, 'Администратор 2', 'admin', 'Администратор', true),
        ('user_doctor1', 'clinic_1', 'doctor1', $4, 'Др. Иванов', 'doctor', 'Стоматолог-терапевт', true)
      ON CONFLICT (id) DO NOTHING
    `, [superAdminHash, admin1Hash, admin2Hash, doctor1Hash]);

    await client.query('COMMIT');
    console.log('✅ Database initialized successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Database initialization failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

// ═══════════════════════════════════════════════════════════════════
// API ENDPOINTS
// ═══════════════════════════════════════════════════════════════════

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Authentication
app.post('/api/auth/login', async (req, res) => {
  const { login, password } = req.body;
  
  if (!login || !password) {
    return res.status(400).json({ error: 'Login and password required' });
  }

  try {
    const hashPassword = (pwd) => crypto.createHash('sha256').update(pwd).digest('hex');
    const passwordHash = hashPassword(password);

    // Check super admin
    if (login === 'dr.tamirlan' && password === 'DentVision2025!') {
      return res.json({
        user: {
          id: 'superadmin',
          login: 'dr.tamirlan',
          name: 'Др. Тамерлан',
          role: 'superadmin',
          spec: 'Основатель'
        },
        clinic: null
      });
    }

    // Check regular users
    const result = await pool.query(
      `SELECT u.id, u.clinic_id, u.login, u.name, u.role, u.spec, c.name as clinic_name, c.city, c.plan
       FROM users u
       LEFT JOIN clinics c ON u.clinic_id = c.id
       WHERE u.login = $1 AND u.password_hash = $2 AND u.active = true`,
      [login, passwordHash]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const row = result.rows[0];
    res.json({
      user: {
        id: row.id,
        clinicId: row.clinic_id,
        login: row.login,
        name: row.name,
        role: row.role,
        spec: row.spec
      },
      clinic: row.clinic_id ? {
        id: row.clinic_id,
        name: row.clinic_name,
        city: row.city,
        plan: row.plan
      } : null
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get clinics
app.get('/api/clinics', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clinics WHERE active = true ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generic CRUD endpoints
app.get('/api/:table', async (req, res) => {
  const { table } = req.params;
  const { clinic_id } = req.query;
  
  try {
    let query = `SELECT * FROM ${table}`;
    const params = [];
    
    if (clinic_id) {
      query += ' WHERE clinic_id = $1';
      params.push(clinic_id);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/:table', async (req, res) => {
  const { table } = req.params;
  const data = req.body;
  
  try {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    
    const query = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;
    
    const result = await pool.query(query, values);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/:table/:id', async (req, res) => {
  const { table, id } = req.params;
  const data = req.body;
  
  try {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
    
    const query = `
      UPDATE ${table}
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${columns.length + 1}
      RETURNING *
    `;
    
    const result = await pool.query(query, [...values, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/:table/:id', async (req, res) => {
  const { table, id } = req.params;
  
  try {
    const result = await pool.query(`DELETE FROM ${table} WHERE id = $1 RETURNING *`, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    res.json({ success: true, deleted: result.rows[0] });
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
      console.log(`🚀 DentVision API Server running on http://localhost:${PORT}`);
      console.log(`📊 API Endpoints:`);
      console.log(`   GET  /api/health - Health check`);
      console.log(`   POST /api/auth/login - User login`);
      console.log(`   GET  /api/clinics - List clinics`);
      console.log(`   GET  /api/:table - List records`);
      console.log(`   POST /api/:table - Create record`);
      console.log(`   PUT  /api/:table/:id - Update record`);
      console.log(`   DELETE /api/:table/:id - Delete record`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
