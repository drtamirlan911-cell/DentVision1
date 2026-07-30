import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { uid, paginate, paginatedResponse } from '../../lib/helpers.js';

export const organizationsRouter = Router();

organizationsRouter.use(authenticate);

// GET /api/organizations?type=CLINIC&search=...&page=1&limit=20
organizationsRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const type = req.query.type as string | undefined;
    const search = (req.query.search as string) || '';

    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const { skip, take } = paginate(page, limit);

    const [data, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
      }),
      prisma.organization.count({ where }),
    ]);

    return res.json({
      ok: true,
      ...paginatedResponse(data, total, page, limit),
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[organizations] list error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить список организаций' } satisfies ApiResponse);
  }
});

// GET /api/organizations/:id
organizationsRouter.get('/:id', async (req: AuthRequest, res) => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!org) {
      return res.status(404).json({ ok: false, error: 'Организация не найдена' } satisfies ApiResponse);
    }
    return res.json({ ok: true, data: org } satisfies ApiResponse);
  } catch (error) {
    console.error('[organizations] get error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить организацию' } satisfies ApiResponse);
  }
});

// POST /api/organizations
organizationsRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, type, taxId, address, phone, email, logo, contacts, settings } = req.body as {
      name: string; type: string; taxId?: string; address?: string; phone?: string;
      email?: string; logo?: string; contacts?: Record<string, unknown>; settings?: Record<string, unknown>;
    };

    if (!name || !type) {
      return res.status(400).json({ ok: false, error: 'name и type обязательны' } satisfies ApiResponse);
    }

    const org = await prisma.organization.create({
      data: { id: uid(), name, type, taxId, address, phone, email, logo, contacts, settings },
    });

    return res.status(201).json({ ok: true, data: org } satisfies ApiResponse);
  } catch (error) {
    console.error('[organizations] create error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось создать организацию' } satisfies ApiResponse);
  }
});

// PATCH /api/organizations/:id
organizationsRouter.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const { name, type, taxId, address, phone, email, logo, contacts, settings } = req.body as {
      name?: string; type?: string; taxId?: string; address?: string; phone?: string;
      email?: string; logo?: string; contacts?: Record<string, unknown>; settings?: Record<string, unknown>;
    };

    const existing = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Организация не найдена' } satisfies ApiResponse);
    }

    const org = await prisma.organization.update({
      where: { id: req.params.id },
      data: { name, type, taxId, address, phone, email, logo, contacts, settings },
    });

    return res.json({ ok: true, data: org } satisfies ApiResponse);
  } catch (error) {
    console.error('[organizations] update error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось обновить организацию' } satisfies ApiResponse);
  }
});

// DELETE /api/organizations/:id
organizationsRouter.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Организация не найдена' } satisfies ApiResponse);
    }

    await prisma.organization.delete({ where: { id: req.params.id } });

    return res.json({ ok: true, data: null } satisfies ApiResponse);
  } catch (error) {
    console.error('[organizations] delete error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось удалить организацию' } satisfies ApiResponse);
  }
});
