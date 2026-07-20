/**
 * Clinic chairs / dental units — resource conflict axis for schedule.
 */
import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { uid } from '../../lib/helpers.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';

export const chairsRouter = Router();
chairsRouter.use(authenticate);

function requireClinic(req: AuthRequest, res: any): string | null {
  const clinicId = req.user?.clinicId;
  if (!clinicId) {
    res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    return null;
  }
  return clinicId;
}

async function ensureDefaultChairs(clinicId: string) {
  const count = await prisma.chair.count({ where: { clinicId } });
  if (count > 0) return;
  await prisma.chair.createMany({
    data: [1, 2, 3, 4].map((n) => ({
      id: uid(),
      clinicId,
      name: `Кресло ${n}`,
      sortOrder: n,
      active: true,
    })),
  });
}

chairsRouter.get('/chairs', async (req: AuthRequest, res) => {
  try {
    const clinicId = requireClinic(req, res);
    if (!clinicId) return;

    await ensureDefaultChairs(clinicId);
    const rows = await prisma.chair.findMany({
      where: { clinicId, active: true },
      orderBy: { sortOrder: 'asc' },
    });
    return res.json({ ok: true, data: rows } satisfies ApiResponse);
  } catch (error) {
    console.error('[Chairs] list', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить кресла' } satisfies ApiResponse);
  }
});

chairsRouter.post('/chairs', async (req: AuthRequest, res) => {
  try {
    const clinicId = requireClinic(req, res);
    if (!clinicId) return;

    const b = req.body || {};
    const id = b.id || uid();
    const existing = await prisma.chair.findFirst({ where: { id, clinicId } });
    const data = {
      name: String(b.name || 'Кресло').trim() || 'Кресло',
      sortOrder: Number(b.sortOrder) || 0,
      active: b.active !== false,
    };

    const row = existing
      ? await prisma.chair.update({ where: { id }, data })
      : await prisma.chair.create({ data: { id, clinicId, ...data } });

    return res.status(existing ? 200 : 201).json({ ok: true, data: row } satisfies ApiResponse);
  } catch (error) {
    console.error('[Chairs] upsert', error);
    return res.status(500).json({ ok: false, error: 'Не удалось сохранить кресло' } satisfies ApiResponse);
  }
});

chairsRouter.delete('/chairs/:id', async (req: AuthRequest, res) => {
  try {
    const clinicId = requireClinic(req, res);
    if (!clinicId) return;

    const existing = await prisma.chair.findFirst({
      where: { id: req.params.id as string, clinicId },
    });
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Кресло не найдено' } satisfies ApiResponse);
    }

    await prisma.chair.update({ where: { id: existing.id }, data: { active: false } });
    return res.json({ ok: true, data: { id: existing.id } } satisfies ApiResponse);
  } catch (error) {
    console.error('[Chairs] delete', error);
    return res.status(500).json({ ok: false, error: 'Не удалось удалить кресло' } satisfies ApiResponse);
  }
});
