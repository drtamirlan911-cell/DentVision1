// ═══════════════════════════════════════════════════════════════
// Auth Routes — login, register, forgot/reset password, token refresh
// ═══════════════════════════════════════════════════════════════
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { generateTokens, verifyToken, authenticate } from '../middleware/auth.js';

export default function authRoutes(pool, authLimiter) {
  const router = Router();

  // ─── Login ───
  router.post('/login', authLimiter, async (req, res) => {
    try {
      const { login, password } = req.body;
      if (!login || !password) {
        return res.status(400).json({ error: 'Login and password required' });
      }
      const result = await pool.query('SELECT * FROM users WHERE login = $1', [login]);
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const user = result.rows[0];
      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const tokens = generateTokens({
        id: user.id,
        login: user.login,
        name: user.name,
        role: user.role,
        clinicId: user.clinic_id,
        spec: user.spec,
        phone: user.phone,
        email: user.email,
        photo_url: user.photo_url,
      });
      res.json(tokens);
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Register ───
  router.post('/register', authLimiter, async (req, res) => {
    try {
      const { clinicName, city, phone, email, directorName, login: loginStr, password } = req.body;
      if (!clinicName || !loginStr || !password || !directorName) {
        return res.status(400).json({ error: 'Заполните все обязательные поля' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
      }
      const existing = await pool.query('SELECT id FROM users WHERE login = $1', [loginStr]);
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Такой логин уже занят — выберите другой' });
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const clinicId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
        await client.query(
          `INSERT INTO clinics (id, name, city, phone, address, plan, active, color) VALUES ($1, $2, $3, $4, '', 'starter', true, '#C9A96E')`,
          [clinicId, clinicName, city || '', phone || '']
        );
        const directorId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
        const passwordHash = await bcrypt.hash(password, 10);
        await client.query(
          `INSERT INTO users (id, clinic_id, login, password_hash, name, role, spec, phone, email) VALUES ($1, $2, $3, $4, $5, 'director', 'Руководитель', $6, $7)`,
          [directorId, clinicId, loginStr, passwordHash, directorName, phone || '', email || '']
        );
        await client.query('COMMIT');
        const tokens = generateTokens({
          id: directorId, login: loginStr, name: directorName, role: 'director', clinicId,
        });
        res.json({
          ...tokens,
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

  // ─── Refresh Token ───
  router.post('/refresh', async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });
      const decoded = verifyToken(refreshToken);
      if (decoded.type !== 'refresh') return res.status(401).json({ error: 'Invalid refresh token' });
      // Re-fetch user to get current role/clinic
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.id]);
      if (result.rows.length === 0) return res.status(401).json({ error: 'User not found' });
      const user = result.rows[0];
      const tokens = generateTokens({
        id: user.id, login: user.login, name: user.name, role: user.role, clinicId: user.clinic_id,
      });
      res.json(tokens);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
  });

  // ─── Me (get current user from token) ───
  router.get('/me', authenticate, async (req, res) => {
    try {
      const result = await pool.query('SELECT id, clinic_id, login, name, role, spec, phone, email, photo_url FROM users WHERE id = $1', [req.user.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
      const user = result.rows[0];
      res.json({ ...user, clinicId: user.clinic_id });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Forgot Password ───
  router.post('/forgot-password', authLimiter, async (req, res) => {
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
        `INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET token = $2, expires_at = $3`,
        [result.rows[0].id, token, expires]
      );
      // In production, send via email/SMS. For now return message only (no token leak).
      res.json({ message: 'Если аккаунт существует, инструкция отправлена' });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Reset Password ───
  router.post('/reset-password', authLimiter, async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) return res.status(400).json({ error: 'Токен и новый пароль обязательны' });
      if (newPassword.length < 6) return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
      const result = await pool.query('SELECT user_id FROM password_resets WHERE token = $1 AND expires_at > NOW()', [token]);
      if (result.rows.length === 0) return res.status(400).json({ error: 'Неверный или просроченный токен' });
      const hash = await bcrypt.hash(newPassword, 10);
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, result.rows[0].user_id]);
      await pool.query('DELETE FROM password_resets WHERE token = $1', [token]);
      res.json({ message: 'Пароль успешно изменён' });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
