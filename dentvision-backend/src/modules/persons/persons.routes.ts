import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { uid, paginate, paginatedResponse } from '../../lib/helpers.js';

export const personsRouter = Router();

personsRouter.use(authenticate);

// GET /api/persons?personType=DOCTOR&organizationId=...&search=...&page=1&limit=20
personsRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const personType = req.query.personType as string | undefined;
    const organizationId = req.query.organizationId as string | undefined;
    const search = (req.query.search as string) || '';

    const where: Record<string, unknown> = {};
    if (personType) where.personType = personType;
    if (organizationId) where.organizationId = organizationId;
    if (search) where.fullName = { contains: search, mode: 'insensitive' };

    const { skip, take } = paginate(page, limit);

    const [data, total] = await Promise.all([
      prisma.person.findMany({
        where,
        skip,
        take,
        include: { organization: { select: { id: true, name: true, type: true } } },
        orderBy: { fullName: 'asc' },
      }),
      prisma.person.count({ where }),
    ]);

    return res.json({
      ok: true,
      ...paginatedResponse(data, total, page, limit),
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[persons] list error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить список людей' } satisfies ApiResponse);
  }
});

// GET /api/persons/:id
personsRouter.get('/:id', async (req: AuthRequest, res) => {
  try {
    const person = await prisma.person.findUnique({
      where: { id: req.params.id },
      include: { organization: { select: { id: true, name: true, type: true } } },
    });
    if (!person) {
      return res.status(404).json({ ok: false, error: 'Персона не найдена' } satisfies ApiResponse);
    }
    return res.json({ ok: true, data: person } satisfies ApiResponse);
  } catch (error) {
    console.error('[persons] get error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить персону' } satisfies ApiResponse);
  }
});

// POST /api/persons
personsRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const { fullName, personType, organizationId, userId, phone, email, specialization, bio, contacts } = req.body as {
      fullName: string; personType: string; organizationId?: string; userId?: string;
      phone?: string; email?: string; specialization?: string; bio?: string;
      contacts?: Record<string, unknown>;
    };

    if (!fullName || !personType) {
      return res.status(400).json({ ok: false, error: 'fullName и personType обязательны' } satisfies ApiResponse);
    }

    if (userId) {
      const existing = await prisma.person.findUnique({ where: { userId } });
      if (existing) {
        return res.status(409).json({ ok: false, error: 'Этот пользователь уже привязан к персоне' } satisfies ApiResponse);
      }
    }

    const person = await prisma.person.create({
      data: { id: uid(), fullName, personType, organizationId, userId, phone, email, specialization, bio, contacts },
    });

    return res.status(201).json({ ok: true, data: person } satisfies ApiResponse);
  } catch (error) {
    console.error('[persons] create error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось создать персону' } satisfies ApiResponse);
  }
});

// PATCH /api/persons/:id
personsRouter.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const { fullName, personType, organizationId, phone, email, specialization, bio, contacts } = req.body as {
      fullName?: string; personType?: string; organizationId?: string;
      phone?: string; email?: string; specialization?: string; bio?: string;
      contacts?: Record<string, unknown>;
    };

    const existing = await prisma.person.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Персона не найдена' } satisfies ApiResponse);
    }

    const person = await prisma.person.update({
      where: { id: req.params.id },
      data: { fullName, personType, organizationId, phone, email, specialization, bio, contacts },
    });

    return res.json({ ok: true, data: person } satisfies ApiResponse);
  } catch (error) {
    console.error('[persons] update error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось обновить персону' } satisfies ApiResponse);
  }
});

// DELETE /api/persons/:id
personsRouter.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.person.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Персона не найдена' } satisfies ApiResponse);
    }

    await prisma.person.delete({ where: { id: req.params.id } });

    return res.json({ ok: true, data: null } satisfies ApiResponse);
  } catch (error) {
    console.error('[persons] delete error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось удалить персону' } satisfies ApiResponse);
  }
});
