// ═══════════════════════════════════════════════════════════════
// Role-Based Access Control Middleware
// ═══════════════════════════════════════════════════════════════

const ROLE_HIERARCHY = {
  superadmin: 5,
  director: 4,
  admin: 3,
  doctor: 2,
  assistant: 1,
};

// Permissions per action
const ACTION_ROLES = {
  // Data reads — all authenticated users
  read: ['superadmin', 'director', 'admin', 'doctor', 'assistant'],

  // Data writes — all except assistant (read-only)
  write: ['superadmin', 'director', 'admin', 'doctor'],

  // User management
  manage_users: ['superadmin', 'director', 'admin'],

  // Financial data
  view_finances: ['superadmin', 'director'],

  // Audit logs
  view_audit: ['superadmin', 'director'],

  // Backup
  backup: ['superadmin', 'director'],

  // Super admin panel
  super_admin: ['superadmin'],

  // Settings
  settings: ['superadmin', 'director', 'admin'],
};

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

export function requirePermission(action) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const allowed = ACTION_ROLES[action];
    if (!allowed || !allowed.includes(req.user.role)) {
      return res.status(403).json({ error: `Permission denied: ${action}` });
    }
    next();
  };
}

// Allows only the platform superadmin (manages Shop / School content)
export function requireSuperadmin() {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Только администратор платформы' });
    }
    next();
  };
}

// Ensures user can only access their own clinic's data
export function requireSameClinic(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  // Superadmin can access any clinic
  if (req.user.role === 'superadmin') return next();

  // Get clinic_id from params, query, or body
  const clinicId = req.params.clinicId
    || req.query.clinic_id
    || req.body?.clinic_id;

  if (!clinicId) return next(); // No clinic_id in request — route doesn't require it

  if (clinicId !== req.user.clinicId) {
    return res.status(403).json({ error: 'Access denied: cross-clinic access forbidden' });
  }
  next();
}
