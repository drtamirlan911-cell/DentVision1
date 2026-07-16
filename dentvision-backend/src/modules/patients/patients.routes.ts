import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { uid, paginate, paginatedResponse } from '../../lib/helpers.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';

export const patientsRouter = Router();

patientsRouter.use(authenticate);

patientsRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = (req.query.search as string) || '';
    const { skip, take } = paginate(page, limit);

    const where = {
      clinicId,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' as const } },
              { lastName: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.patient.count({ where }),
    ]);

    const result = paginatedResponse(patients, total, page, limit);

    return res.json({ ok: true, data: result } satisfies ApiResponse);
  } catch (error) {
    console.error('List patients error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при получении списка пациентов' } satisfies ApiResponse);
  }
});

patientsRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }

    const { firstName, lastName, phone, email, birthDate, gender, notes } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({ ok: false, error: 'Имя и фамилия обязательны' } satisfies ApiResponse);
    }

    const patient = await prisma.patient.create({
      data: {
        id: uid(),
        clinicId,
        firstName,
        lastName,
        phone: phone || null,
        email: email || null,
        birthDate: birthDate ? new Date(birthDate) : null,
        gender: gender || null,
        notes: notes || null,
      },
    });

    return res.status(201).json({ ok: true, data: patient } satisfies ApiResponse);
  } catch (error) {
    console.error('Create patient error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при создании пациента' } satisfies ApiResponse);
  }
});

patientsRouter.get('/:id', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }

    const patient = await prisma.patient.findFirst({
      where: { id: req.params.id as string, clinicId },
      include: {
        visits: { orderBy: { date: 'desc' } },
        appointments: { orderBy: { date: 'desc' } },
        teeth: { orderBy: { number: 'asc' } },
        treatmentPlans: { orderBy: { createdAt: 'desc' } },
        images: { orderBy: { createdAt: 'desc' } },
        documents: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!patient) {
      return res.status(404).json({ ok: false, error: 'Пациент не найден' } satisfies ApiResponse);
    }

    return res.json({ ok: true, data: patient } satisfies ApiResponse);
  } catch (error) {
    console.error('Get patient error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при получении пациента' } satisfies ApiResponse);
  }
});

patientsRouter.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }

    const existing = await prisma.patient.findFirst({
      where: { id: req.params.id as string, clinicId },
    });

    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Пациент не найден' } satisfies ApiResponse);
    }

    const { firstName, lastName, phone, email, birthDate, gender, notes, address, medicalHistory } = req.body;

    const patient = await prisma.patient.update({
      where: { id: req.params.id as string },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(email !== undefined && { email: email || null }),
        ...(birthDate !== undefined && { birthDate: birthDate ? new Date(birthDate) : null }),
        ...(gender !== undefined && { gender: gender || null }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(address !== undefined && { address: address || null }),
        ...(medicalHistory !== undefined && { medicalHistory }),
      },
    });

    return res.json({ ok: true, data: patient } satisfies ApiResponse);
  } catch (error) {
    console.error('Update patient error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при обновлении пациента' } satisfies ApiResponse);
  }
});

patientsRouter.get('/:id/history', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }

    const patient = await prisma.patient.findFirst({
      where: { id: req.params.id as string, clinicId },
      select: { id: true },
    });

    if (!patient) {
      return res.status(404).json({ ok: false, error: 'Пациент не найден' } satisfies ApiResponse);
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const { skip, take } = paginate(page, limit);

    const where = { patientId: req.params.id as string };

    const [visits, total] = await Promise.all([
      prisma.visit.findMany({
        where,
        skip,
        take,
        orderBy: { date: 'desc' },
      }),
      prisma.visit.count({ where }),
    ]);

    const result = paginatedResponse(visits, total, page, limit);

    return res.json({ ok: true, data: result } satisfies ApiResponse);
  } catch (error) {
    console.error('Get patient history error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при получении истории визитов' } satisfies ApiResponse);
  }
});

patientsRouter.get('/:id/images', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }

    const patient = await prisma.patient.findFirst({
      where: { id: req.params.id as string, clinicId },
      select: { id: true },
    });

    if (!patient) {
      return res.status(404).json({ ok: false, error: 'Пациент не найден' } satisfies ApiResponse);
    }

    const images = await prisma.patientImage.findMany({
      where: { patientId: req.params.id as string },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ ok: true, data: images } satisfies ApiResponse);
  } catch (error) {
    console.error('Get patient images error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при получении изображений пациента' } satisfies ApiResponse);
  }
});

patientsRouter.get('/:id/treatment-plan', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    }

    const patient = await prisma.patient.findFirst({
      where: { id: req.params.id as string, clinicId },
      select: { id: true },
    });

    if (!patient) {
      return res.status(404).json({ ok: false, error: 'Пациент не найден' } satisfies ApiResponse);
    }

    const plans = await prisma.treatmentPlan.findMany({
      where: { patientId: req.params.id as string },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ ok: true, data: plans } satisfies ApiResponse);
  } catch (error) {
    console.error('Get patient treatment plans error:', error);
    return res.status(500).json({ ok: false, error: 'Ошибка при получении планов лечения' } satisfies ApiResponse);
  }
});
