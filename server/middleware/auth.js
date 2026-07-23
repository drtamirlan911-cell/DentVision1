// ═══════════════════════════════════════════════════════════════
// JWT Authentication Middleware
// ═══════════════════════════════════════════════════════════════
import jwt from 'jsonwebtoken';

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = '24h';
const REFRESH_EXPIRES = '7d';

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

// Express middleware: verifies Authorization: Bearer <token> or httpOnly cookie
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  let token = '';
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
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

// Optional auth: sets req.user if token present (from header or cookie), but doesn't fail
export function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : req.cookies?.accessToken || '';
  if (token) {
    try {
      req.user = verifyToken(token);
    } catch {}
  }
  next();
}
