// ═══════════════════════════════════════════════════════════════
// Public Routes — booking, document signing, clinic info (no auth)
// ═══════════════════════════════════════════════════════════════
import { Router } from 'express';
import crypto from 'crypto';

export default function publicRoutes(pool, publicBookingLimiter) {
  const router = Router();

  // ─── Get public clinic info ───
  router.get('/clinic/:clinicId', async (req, res) => {
    try {
      const { clinicId } = req.params;
      const clinicResult = await pool.query('SELECT id, name, city, address, phone, color FROM clinics WHERE id = $1 AND active = true', [clinicId]);
      if (clinicResult.rows.length === 0) return res.status(404).json({ error: 'Clinic not found' });
      const doctorsResult = await pool.query(
        "SELECT id, name, spec, bio, photo_url, experience_years FROM users WHERE clinic_id = $1 AND role = 'doctor' AND (visibility = 'public' OR visibility IS NULL) ORDER BY name",
        [clinicId]
      );
      res.json({ clinic: clinicResult.rows[0], doctors: doctorsResult.rows });
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Submit booking ───
  router.post('/booking', publicBookingLimiter, async (req, res) => {
    try {
      const { clinic_id, patient_name, phone, email, doctor_id, service_name, date, time, notes } = req.body;
      if (!clinic_id || !patient_name || !phone || !date || !time) {
        return res.status(400).json({ error: 'Заполните обязательные поля' });
      }
      if (!/^\d{10,15}$/.test(phone.replace(/\D/g, ''))) {
        return res.status(400).json({ error: 'Некорректный номер телефона' });
      }
      const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
      const result = await pool.query(
        `INSERT INTO bookings (id, clinic_id, patient_name, phone, email, doctor_id, service_name, date, time, notes, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending') RETURNING *`,
        [id, clinic_id, patient_name, phone, email || null, doctor_id || null, service_name || null, date, time, notes || null]
      );
      res.json(result.rows[0]);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── View document by signing token ───
  router.get('/document/:token', async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT d.*, c.name as clinic_name, c.phone as clinic_phone, c.address as clinic_address FROM documents d LEFT JOIN clinics c ON d.clinic_id = c.id WHERE d.signature_token = $1',
        [req.params.token]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Document not found or already signed' });
      res.json(result.rows[0]);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  return router;
}
