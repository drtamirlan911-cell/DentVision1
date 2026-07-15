// ═══════════════════════════════════════════════════════════════
// Service Access Middleware — checks if a service is enabled
// ═══════════════════════════════════════════════════════════════
import prisma from '../lib/prisma.js';

// Cache service access per clinic (TTL: 5 minutes)
const _cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

async function getClinicServices(clinicId) {
  if (!clinicId) return null;
  const cached = _cache.get(clinicId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.services;

  const access = await prisma.serviceAccess.findMany({
    where: { clinicId },
  });
  const services = {};
  for (const a of access) {
    services[a.service] = a.enabled;
  }
  _cache.set(clinicId, { services, ts: Date.now() });
  return services;
}

export function invalidateServiceCache(clinicId) {
  if (clinicId) _cache.delete(clinicId);
  else _cache.clear();
}

/**
 * Middleware: requireServiceAccess(serviceKey)
 * Checks if the specified service is enabled for the user's clinic.
 * Returns 403 if disabled. Skips check for superadmin.
 */
export function requireServiceAccess(serviceKey) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    // Superadmin bypasses service access checks
    if (req.user.role === 'superadmin') return next();

    const clinicId = req.user.clinicId;
    if (!clinicId) return next(); // No clinic — skip check

    const services = await getClinicServices(clinicId);
    if (services && services[serviceKey] === false) {
      return res.status(403).json({
        error: `Service '${serviceKey}' is not enabled for your clinic`,
        code: 'SERVICE_DISABLED',
        service: serviceKey,
      });
    }
    next();
  };
}

/**
 * Helper: getEnabledServices(clinicId)
 * Returns an object map of service → enabled boolean.
 * Used by frontend endpoints to filter services.
 */
export async function getEnabledServices(clinicId) {
  return getClinicServices(clinicId);
}
