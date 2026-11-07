import type { NextFunction, Response } from 'express';
import type { AuthRequest, ApiResponse } from '../types/index.js';
import { requirePermission } from './rbac.js';

/** Full clinical chart access is narrower than reading a patient directory. */
const rolesWithoutClinicalChart = new Set([
  'ASSISTANT', 'MANAGER', 'LAB', 'SUPPORT', 'STUDENT', 'PATIENT', 'RECEPTION', 'RECEPTIONIST',
]);

export function requireClinicalChartRead(req: AuthRequest, res: Response, next: NextFunction) {
  const role = String(req.user?.role || '').toUpperCase();
  if (rolesWithoutClinicalChart.has(role)) {
    return res.status(403).json({
      ok: false,
      error: 'Недостаточно прав для просмотра медицинской карты',
    } satisfies ApiResponse);
  }
  return requirePermission('patient.read', 'medical.read')(req, res, next);
}
