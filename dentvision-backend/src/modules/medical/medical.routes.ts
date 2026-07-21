import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { AuthRequest, ApiResponse } from '../../types/index.js';
import { uid } from '../../lib/helpers.js';

const medicalRouter = Router();

medicalRouter.use(authenticate);

medicalRouter.post('/visits', async (req: AuthRequest, res) => {
  try {
    const { patientId, doctorId, diagnosis, complaints, anamnesis, treatment, notes } = req.body;

    if (!patientId || !doctorId) {
      res.status(400).json({ ok: false, error: 'patientId and doctorId are required' });
      return;
    }

    const visit = await prisma.visit.create({
      data: {
        id: uid(),
        patientId,
        doctorId,
        diagnosis: diagnosis || null,
        complaints: complaints || null,
        anamnesis: anamnesis || null,
        treatment: treatment || null,
        notes: notes || null,
      },
    });

    res.status(201).json({ ok: true, data: visit });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to create visit' });
  }
});

medicalRouter.patch('/visits/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const { diagnosis, complaints, anamnesis, treatment, notes, doctorId } = req.body;

    const visit = await prisma.visit.update({
      where: { id },
      data: {
        ...(doctorId !== undefined && { doctorId }),
        ...(diagnosis !== undefined && { diagnosis: diagnosis || null }),
        ...(complaints !== undefined && { complaints: complaints || null }),
        ...(anamnesis !== undefined && { anamnesis: anamnesis || null }),
        ...(treatment !== undefined && { treatment }),
        ...(notes !== undefined && { notes: notes || null }),
      },
    });

    res.json({ ok: true, data: visit });
  } catch (error) {
    console.error('Update visit error:', error);
    res.status(500).json({ ok: false, error: 'Failed to update visit' });
  }
});

medicalRouter.get('/visits/:patientId', async (req: AuthRequest, res) => {
  try {
    const { patientId } = req.params as { patientId: string };

    const visits = await prisma.visit.findMany({
      where: { patientId },
      orderBy: { date: 'desc' },
    });

    res.json({ ok: true, data: visits });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch visits' });
  }
});

// Get all visits for a clinic (for global dashboard load)
medicalRouter.get('/visits', async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user!.clinicId;
    const visits = await prisma.visit.findMany({
      where: { patient: { clinicId } },
      orderBy: { date: 'desc' },
      take: 100,
    });
    res.json({ ok: true, data: visits });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch visits' });
  }
});

// Alias for frontend compatibility: /api/medical/patients/:patientId/visits
medicalRouter.get('/patients/:patientId/visits', async (req: AuthRequest, res) => {
  try {
    const { patientId } = req.params as { patientId: string };

    const visits = await prisma.visit.findMany({
      where: { patientId },
      orderBy: { date: 'desc' },
    });

    res.json({ ok: true, data: visits });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch visits' });
  }
});

medicalRouter.post('/treatment-plan', async (req: AuthRequest, res) => {
  try {
    const { patientId, title, items, price } = req.body;

    if (!patientId || !title) {
      res.status(400).json({ ok: false, error: 'patientId and title are required' });
      return;
    }

    const plan = await prisma.treatmentPlan.create({
      data: {
        id: uid(),
        patientId,
        title,
        items: items || undefined,
        price: price || 0,
      },
    });

    res.status(201).json({ ok: true, data: plan });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to create treatment plan' });
  }
});

medicalRouter.patch('/treatment-plan/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const { title, items, price, status } = req.body;

    const plan = await prisma.treatmentPlan.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(items !== undefined && { items }),
        ...(price !== undefined && { price }),
        ...(status !== undefined && { status }),
      },
    });

    res.json({ ok: true, data: plan });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to update treatment plan' });
  }
});

medicalRouter.get('/treatment-plan/:patientId', async (req: AuthRequest, res) => {
  try {
    const { patientId } = req.params as { patientId: string };

    const plans = await prisma.treatmentPlan.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ ok: true, data: plans });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch treatment plans' });
  }
});

medicalRouter.post('/teeth', async (req: AuthRequest, res) => {
  try {
    const { patientId, number, condition, diagnosis, notes } = req.body;

    if (!patientId || number === undefined) {
      res.status(400).json({ ok: false, error: 'patientId and number are required' });
      return;
    }

    const tooth = await prisma.tooth.upsert({
      where: {
        patientId_number: { patientId, number },
      },
      update: {
        condition: condition || null,
        diagnosis: diagnosis || null,
        notes: notes || null,
      },
      create: {
        id: uid(),
        patientId,
        number,
        condition: condition || null,
        diagnosis: diagnosis || null,
        notes: notes || null,
      },
    });

    res.status(201).json({ ok: true, data: tooth });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to upsert tooth record' });
  }
});

medicalRouter.get('/teeth/:patientId', async (req: AuthRequest, res) => {
  try {
    const { patientId } = req.params as { patientId: string };

    const teeth = await prisma.tooth.findMany({
      where: { patientId },
      orderBy: { number: 'asc' },
    });

    res.json({ ok: true, data: teeth });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch dental chart' });
  }
});

medicalRouter.post('/images', async (req: AuthRequest, res) => {
  try {
    const { patientId, type, url, metadata } = req.body;

    if (!patientId || !type || !url) {
      res.status(400).json({ ok: false, error: 'patientId, type, and url are required' });
      return;
    }

    const validTypes = ['PHOTO', 'X_RAY', 'CBCT', 'DICOM', 'SCAN'];
    if (!validTypes.includes(type)) {
      res.status(400).json({ ok: false, error: `type must be one of: ${validTypes.join(', ')}` });
      return;
    }

    const image = await prisma.patientImage.create({
      data: {
        id: uid(),
        patientId,
        type,
        url,
        metadata: metadata || undefined,
      },
    });

    res.status(201).json({ ok: true, data: image });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to record patient image' });
  }
});

medicalRouter.get('/images/:patientId', async (req: AuthRequest, res) => {
  try {
    const { patientId } = req.params as { patientId: string };

    const images = await prisma.patientImage.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ ok: true, data: images });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to fetch patient images' });
  }
});

medicalRouter.delete('/images/:id', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const image = await prisma.patientImage.findUnique({
      where: { id },
      include: { patient: { select: { clinicId: true } } },
    });
    if (!image) {
      return res.status(404).json({ ok: false, error: 'Изображение не найдено' });
    }
    // RBAC: ensure image belongs to current user's clinic
    if (image.patient?.clinicId && image.patient.clinicId !== req.user?.clinicId) {
      return res.status(403).json({ ok: false, error: 'Доступ запрещён' });
    }
    await prisma.patientImage.delete({ where: { id } });
    return res.json({ ok: true, data: { deleted: true, id } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete patient image';
    return res.status(500).json({ ok: false, error: message });
  }
});

medicalRouter.get('/icd10', async (req: AuthRequest, res) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      res.status(400).json({ ok: false, error: 'Search query (q) is required' });
      return;
    }

    const codes = await prisma.iCD10Code.findMany({
      where: {
        OR: [
          { code: { contains: q } },
          { description: { contains: q } },
        ],
      },
      take: 20,
    });

    res.json({ ok: true, data: codes });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Failed to search ICD-10 codes' });
  }
});

export { medicalRouter };
