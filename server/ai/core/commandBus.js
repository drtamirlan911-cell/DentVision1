// ═══════════════════════════════════════════════════════════════
// COMMAND BUS — Центральный диспетчер команд
//
// Принимает команду из Intent Engine, проверяет права,
// вызывает Action Registry, возвращает результат.
//
// Будущие каналы (голос, Telegram, WhatsApp, часы)
// подключаются сюда без изменения бизнес-логики.
// ═══════════════════════════════════════════════════════════════

import { getAction } from '../actions.js';
import { checkPermission } from './permissions.js';

// Хранилище middleware для Command Bus
const middlewares = [];

export function useCommandMiddleware(fn) {
  middlewares.push(fn);
}

// ─── DISPATCH ────────────────────────────────────────────────

export async function dispatch(command, ctx) {
  const { action: actionName, params = {}, confirmationRequired = false } = command;
  const { user, clinic } = ctx;

  // 1. Найти действие в реестре
  const action = getAction(actionName);
  if (!action) {
    return {
      success: false,
      error: `Действие "${actionName}" не найдено`,
      code: 'ACTION_NOT_FOUND',
    };
  }

  // 2. Проверить права доступа
  const permCheck = checkPermission(action, user, clinic);
  if (!permCheck.allowed) {
    return {
      success: false,
      error: permCheck.reason,
      code: 'PERMISSION_DENIED',
    };
  }

  // 3. Запрос подтверждения для критических действий
  if (confirmationRequired && action.requiresConfirmation) {
    return {
      success: false,
      requiresConfirmation: true,
      action: actionName,
      description: action.description,
      params,
      code: 'CONFIRMATION_REQUIRED',
    };
  }

  // 4. Выполнить middleware
  for (const mw of middlewares) {
    const result = await mw(command, ctx, action);
    if (result === false) {
      return {
        success: false,
        error: 'Команда заблокирована middleware',
        code: 'BLOCKED_BY_MIDDLEWARE',
      };
    }
  }

  // 5. Выполнить действие
  try {
    const result = await action.execute(params, {
      userId: user.id,
      clinicId: clinic?.id,
      user,
      clinic,
    });

    return {
      success: true,
      action: actionName,
      result,
    };
  } catch (e) {
    return {
      success: false,
      error: e && e.message || 'Ошибка выполнения действия',
      code: 'EXECUTION_ERROR',
    };
  }
}

// ─── BATCH DISPATCH ──────────────────────────────────────────

export async function dispatchBatch(commands, ctx) {
  const results = [];
  for (const cmd of commands) {
    const result = await dispatch(cmd, ctx);
    results.push(result);
    if (!result.success && cmd.stopOnError !== false) break;
  }
  return results;
}

// ─── INTENT → COMMAND RESOLUTION ─────────────────────────────

export function intentToCommands(intent, actions, message) {
  const commands = [];

  if (!actions || actions.length === 0) return commands;

  // Навигационные действия — первые
  const navActions = actions.filter(a =>
    ['OpenSchedule', 'OpenPatients', 'OpenShop', 'OpenSchool', 'OpenAnalytics',
     'OpenCashier', 'OpenLab', 'OpenInventory', 'OpenStaff', 'OpenSettings',
     'OpenProfile', 'OpenMyClinics', 'OpenVisits', 'OpenDocuments', 'OpenMedicalCard'].includes(a.name)
  );

  if (navActions.length > 0 && intent === 'navigation') {
    commands.push({ action: navActions[0].name, params: {} });
    return commands;
  }

  // Поисковые действия
  const searchActions = actions.filter(a =>
    ['SearchPatients', 'SearchShop', 'SearchCourses'].includes(a.name)
  );

  if (searchActions.length > 0 && intent === 'search') {
    const q = extractSearchQuery(message);
    if (q) {
      commands.push({ action: searchActions[0].name, params: { query: q } });
      return commands;
    }
  }

  // Действия создания
  const createActions = actions.filter(a =>
    ['CreateAppointment', 'CreatePatient', 'CreateLabOrder'].includes(a.name)
  );

  if (createActions.length > 0 && intent === 'action') {
    const params = extractCreateParams(message, createActions[0].name);
    if (params) {
      commands.push({ action: createActions[0].name, params, confirmationRequired: true });
      return commands;
    }
  }

  return commands;
}

function extractSearchQuery(message) {
  const patterns = [
    /найди\s+(.+)/i,
    /ищи\s+(.+)/i,
    /поиск\s+(.+)/i,
    /где\s+(.+)/i,
  ];
  for (const p of patterns) {
    const m = message.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

function extractCreateParams(message, actionName) {
  const msg = message.toLowerCase();

  if (actionName === 'CreateAppointment') {
    const patientM = message.match(/(?:запиши|запись|записать)\s+(.+?)(?:\s+на\s+(.+))?$/i);
    if (patientM) return { patientName: patientM[1].trim(), service: 'Приём', date: new Date().toISOString() };
  }

  if (actionName === 'CreatePatient') {
    const patientM = message.match(/(?:добавь|создай)\s+пациент[а-я]*\s+(.+)/i);
    if (patientM) return { name: patientM[1].trim() };
  }

  return null;
}

export default { dispatch, dispatchBatch, intentToCommands, useCommandMiddleware };
