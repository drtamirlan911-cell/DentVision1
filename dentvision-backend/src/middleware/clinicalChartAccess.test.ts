import { describe, expect, it, vi } from 'vitest';
import type { AuthRequest } from '../types/index.js';
import { requireClinicalChartRead } from './clinicalChartAccess.js';

describe('clinical chart read boundary', () => {
  for (const role of ['ASSISTANT', 'MANAGER', 'LAB', 'SUPPORT', 'STUDENT', 'PATIENT', 'RECEPTION', 'RECEPTIONIST']) {
    it(`denies full chart reads to ${role}`, async () => {
      const req = { user: { role, id: 'user-1', clinicId: 'clinic-1' } } as unknown as AuthRequest;
      const json = vi.fn();
      const res = { status: vi.fn().mockReturnThis(), json } as any;
      const next = vi.fn();
      await requireClinicalChartRead(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
      expect(next).not.toHaveBeenCalled();
    });
  }
});
