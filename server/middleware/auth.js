// ═══════════════════════════════════════════════════════════════
// JWT Authentication Middleware
// ═══════════════════════════════════════════════════════════════
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../lib/prisma.js';

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = '24h';
const REFRESH_EXPIRES = '7d';

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function isTokenBlacklisted(token) {
  const blacklisted = await prisma.tokenBlacklist.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { tokenHash: true },
  });
  return !!blacklisted;
}

export async function blacklistToken(token, expiresAt) {
  await prisma.tokenBlacklist.upsert({
    where: { tokenHash: hashToken(token) },
    update: {},
    create: { tokenHash: hashToken(token), expiresAt: new Date(expiresAt) },
  });
}

export function generateTokens(user, activeClinic = null, activeRole = null) {
  const payload = {
    id: user.id,
    login: user.login,
    name: user.name,
    role: user.role,
    platformRole: user.platformRole || 'user',
    clinicId: user.clinicId || user.clinic_id || null,
    activeClinicId: activeClinic || user.clinicId || user.clinic_id || null,
    activeRole: activeRole || user.role || null,
  };
  return {
    accessToken: jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES }),
    refreshToken: jwt.sign({ ...payload, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_EXPIRES }),
    user: payload,
  };
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// Express middleware: verifies Authorization: Bearer <token>
export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const token = authHeader.slice(7);
    const decoded = verifyToken(token);
    if (decoded.type === 'refresh') {
      return res.status(401).json({ error: 'Access token required, not refresh token' });
    }
    if (await isTokenBlacklisted(token)) {
      return res.status(401).json({ error: 'Token revoked' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Optional auth: sets req.user if token present, but doesn't fail
export async function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      if (!(await isTokenBlacklisted(token))) {
        req.user = verifyToken(token);
      }
    } catch {}
  }
  next();
}
