// ═══════════════════════════════════════════════════════════════
// PERMISSION GATE — Проверка прав доступа для AI-действий
// ═══════════════════════════════════════════════════════════════

export function checkPermission(action, user, clinic) {
  if (!user) {
    return { allowed: false, reason: 'Не авторизован' };
  }

  if (user.platformRole === 'superadmin') {
    return { allowed: true };
  }

  const allowedRoles = action.allowedRoles || [];
  if (allowedRoles.includes('*')) {
    return checkClinicScope(action, user, clinic);
  }

  if (action.clinicScoped && !clinic?.id) {
    return { allowed: false, reason: 'Требуется активное рабочее пространство' };
  }

  const userRole = user.role || user.platformRole || 'user';
  if (allowedRoles.includes(userRole)) {
    return checkClinicScope(action, user, clinic);
  }

  return {
    allowed: false,
    reason: `Роль "${userRole}" не имеет доступа к действию "${action.name}"`,
  };
}

function checkClinicScope(action, user, clinic) {
  if (!action.clinicScoped) return { allowed: true };
  if (!clinic?.id) return { allowed: false, reason: 'Требуется активное рабочее пространство' };
  if (user.platformRole === 'superadmin') return { allowed: true };
  if (user.clinicId !== clinic.id && !user.clinicIds?.includes(clinic.id)) {
    return { allowed: false, reason: 'Нет доступа к этой клинике' };
  }
  return { allowed: true };
}

export function checkServiceAccess(service, user, clinic) {
  if (!user) {
    return { allowed: false, reason: 'Не авторизован' };
  }

  /** restricted AI services that require clinic membership */
  const restricted = ['getVisits', 'getTreatmentPlans', 'getPatients', 'getFinancialReport', 'sendSms'];
  if (!restricted.includes(service)) {
    return { allowed: true };
  }

  if (user.platformRole === 'superadmin') {
    return { allowed: true };
  }

  if (!clinic?.id) {
    return { allowed: false, reason: 'Требуется активное рабочее пространство' };
  }

  // user must be a member of the clinic to access restricted services
  if (user.clinicId !== clinic.id && !user.clinicIds?.includes(clinic.id)) {
    return { allowed: false, reason: 'Нет доступа к данным этой клиники' };
  }

  return { allowed: true };
}

export default { checkPermission, checkServiceAccess };
