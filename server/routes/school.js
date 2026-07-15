// ═══════════════════════════════════════════════════════════════
// School Routes — courses, enrollments, clinical cases, library
// ═══════════════════════════════════════════════════════════════
import { Router } from 'express';
import crypto from 'crypto';
import { authenticate } from '../middleware/auth.js';

export default function schoolRoutes(pool) {
  const router = Router();

  // ─── Courses (public read) ───
  router.get('/courses', async (req, res) => {
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

  router.get('/courses/:id', async (req, res) => {
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

  // ─── Enrollments (authenticated) ───
  router.post('/enrollments', authenticate, async (req, res) => {
    try {
      const { course_id } = req.body;
      const existing = await pool.query('SELECT * FROM school_enrollments WHERE user_id = $1 AND course_id = $2', [req.user.id, course_id]);
      if (existing.rows[0]) return res.json(existing.rows[0]);
      const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
      await pool.query('INSERT INTO school_enrollments (id, clinic_id, user_id, user_name, course_id) VALUES ($1,$2,$3,$4,$5)', [id, req.user.clinicId, req.user.id, req.user.name, course_id]);
      await pool.query('UPDATE school_courses SET enrolled_count = enrolled_count + 1 WHERE id = $1', [course_id]);
      res.json({ id, success: true });
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  router.get('/enrollments', authenticate, async (req, res) => {
    try {
      const result = await pool.query('SELECT e.*, c.title, c.category, c.difficulty, c.image_url, c.instructor FROM school_enrollments e JOIN school_courses c ON e.course_id = c.id WHERE e.user_id = $1 ORDER BY e.started_at DESC', [req.user.id]);
      res.json(result.rows);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Clinical Cases (public read) ───
  router.get('/clinical-cases', async (req, res) => {
    try {
      const { category } = req.query;
      let query = 'SELECT * FROM school_clinical_cases'; const params = [];
      if (category) { query += ' WHERE category = $1'; params.push(category); }
      query += ' ORDER BY created_at DESC';
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  // ─── Library (public read) ───
  router.get('/library', async (req, res) => {
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

  // ─── Certificates (authenticated) ───
  router.get('/certificates', authenticate, async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM school_certificates WHERE user_id = $1 ORDER BY issued_at DESC', [req.user.id]);
      res.json(result.rows);
    } catch { res.status(500).json({ error: 'Internal server error' }); }
  });

  return router;
}
