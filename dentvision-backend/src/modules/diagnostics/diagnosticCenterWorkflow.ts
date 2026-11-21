export type DiagnosticCenterStatus = 'ACCEPTED' | 'SCHEDULED' | 'PATIENT_ARRIVED' | 'IN_PROGRESS' | 'DELIVERED';

export interface DiagnosticCenterTransitionInput {
  currentStatus: string;
  nextStatus: string;
  roleKeys: readonly string[];
  resultSignedAt?: Date | string | null;
}

export type DiagnosticCenterTransitionDecision =
  | { allowed: true; nextStatus: DiagnosticCenterStatus }
  | { allowed: false; status: 403 | 409; code: string; reason: string };

const MANAGER_ROLE_KEYS = new Set(['owner', 'admin', 'manager', 'director']);
const SCHEDULING_ROLE_KEYS = new Set([
  'diagnostic_operator', 'operator', 'reception', 'receptionist', 'registrar', 'center_reception',
]);
const ACQUISITION_ROLE_KEYS = new Set([
  ...SCHEDULING_ROLE_KEYS, 'modality_technician', 'radiology_technician', 'radiologist', 'diagnostic_radiologist', 'diagnostic_radiologist',
]);

function roleMatches(roleKeys: readonly string[], allowed: ReadonlySet<string>): boolean {
  return roleKeys.some((role) => {
    const key = String(role || '').trim().toLowerCase();
    return allowed.has(key);
  });
}

function isManager(roleKeys: readonly string[]): boolean {
  return roleKeys.some((role) => {
    const key = String(role || '').trim().toLowerCase();
    return MANAGER_ROLE_KEYS.has(key) || /_(owner|admin|manager|director)$/.test(key);
  });
}

/** Clinical referral details contain identifiers and must not be exposed to cashier-only or finance-only memberships. */
export function canReadDiagnosticCenterClinicalDetail(roleKeys: readonly string[]): boolean {
  return isManager(roleKeys) || roleMatches(roleKeys, ACQUISITION_ROLE_KEYS);
}

/**
 * The generic referral status endpoint must not let a center skip the RIS
 * work queue or mark a study complete without a signed result. Completion is
 * owned by the scoped radiologist signing endpoint.
 */
export function authorizeDiagnosticCenterStatusTransition(
  input: DiagnosticCenterTransitionInput,
): DiagnosticCenterTransitionDecision {
  const current = String(input.currentStatus || '').trim().toUpperCase();
  const next = String(input.nextStatus || '').trim().toUpperCase();
  const manager = isManager(input.roleKeys);
  const scheduler = roleMatches(input.roleKeys, SCHEDULING_ROLE_KEYS);
  const acquisition = roleMatches(input.roleKeys, ACQUISITION_ROLE_KEYS);

  const allowedNext: Record<string, readonly DiagnosticCenterStatus[]> = {
    SENT: ['ACCEPTED'],
    ACCEPTED: ['SCHEDULED'],
    SCHEDULED: ['PATIENT_ARRIVED'],
    PATIENT_ARRIVED: ['IN_PROGRESS'],
    COMPLETED: ['DELIVERED'],
  };

  if (next === 'COMPLETED' || next === 'REVIEWED') {
    return {
      allowed: false,
      status: 409,
      code: 'DIAGNOSTIC_RESULT_SIGN_REQUIRED',
      reason: 'Завершение исследования выполняется только после подписания заключения уполномоченным рентгенологом.',
    };
  }

  const permitted = allowedNext[current] || [];
  if (!permitted.includes(next as DiagnosticCenterStatus)) {
    return {
      allowed: false,
      status: 409,
      code: 'DIAGNOSTIC_STATUS_TRANSITION_INVALID',
      reason: `Переход направления ${current || '—'} → ${next || '—'} недопустим. Обновите очередь и выполните следующий этап.`,
    };
  }

  if (next === 'ACCEPTED' && !manager) {
    return { allowed: false, status: 403, code: 'DIAGNOSTIC_ACCEPT_FORBIDDEN', reason: 'Принимать новые направления может владелец или менеджер центра.' };
  }
  if ((next === 'SCHEDULED' || next === 'PATIENT_ARRIVED') && !manager && !scheduler) {
    return { allowed: false, status: 403, code: 'DIAGNOSTIC_SCHEDULING_FORBIDDEN', reason: 'Управлять расписанием и регистрацией прибытия может только уполномоченный сотрудник центра.' };
  }
  if (next === 'IN_PROGRESS' && !manager && !acquisition) {
    return { allowed: false, status: 403, code: 'DIAGNOSTIC_ACQUISITION_FORBIDDEN', reason: 'Начинать исследование может только владелец, менеджер, оператор или технический специалист центра.' };
  }
  if (next === 'DELIVERED') {
    if (!manager && !roleMatches(input.roleKeys, new Set(['radiologist', 'diagnostic_radiologist']))) {
      return { allowed: false, status: 403, code: 'DIAGNOSTIC_RELEASE_FORBIDDEN', reason: 'Передавать подписанное заключение клинике может только владелец, менеджер или рентгенолог.' };
    }
    if (!input.resultSignedAt) {
      return { allowed: false, status: 409, code: 'DIAGNOSTIC_RESULT_UNSIGNED', reason: 'Нельзя передать клинике неподписанное заключение.' };
    }
  }

  return { allowed: true, nextStatus: next as DiagnosticCenterStatus };
}
