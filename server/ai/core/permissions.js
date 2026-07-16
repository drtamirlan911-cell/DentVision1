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
  return { allowed: true };
}

export function checkServiceAccess(_service, _user, _clinic) {
  return { allowed: true };
}

export default { checkPermission, checkServiceAccess };
