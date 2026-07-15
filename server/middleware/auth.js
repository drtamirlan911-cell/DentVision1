// ═══════════════════════════════════════════════════════════════
// JWT Authentication Middleware
// ═══════════════════════════════════════════════════════════════
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dv-' + (process.env.DATABASE_URL || 'fallback-secret-change-me').slice(-32);
const JWT_EXPIRES = '24h';
const REFRESH_EXPIRES = '7d';

export function generateTokens(user) {
  const payload = {
    id: user.id,
    login: user.login,
    name: user.name,
    role: user.role,
    clinicId: user.clinicId || user.clinic_id || null,
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
export function authenticate(req, res, next) {
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
export function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      req.user = verifyToken(authHeader.slice(7));
    } catch {}
  }
  next();
}
