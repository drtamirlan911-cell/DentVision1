import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { AuthRequest, ApiResponse } from '../../types/index.js';
import { uid } from '../../lib/helpers.js';
import { loadClinicAccess, blockClinicWrites } from '../../middleware/planGate.js';
import { DENTAL_ICD10_SEED, mapIcd10Row, searchDentalCatalog } from './icd10.catalog.js';

const medicalRouter = Router();

medicalRouter.use(authenticate);
medicalRouter.use(loadClinicAccess);
medicalRouter.use(blockClinicWrites);

/** Verifies that the patient belongs to the current user's clinic. Returns 403 if not. */
async function requirePatientAccess(req: AuthRequest, res: any, patientId: string): Promise<boolean> {
  const clinicId = req.user!.clinicId;
  if (!clinicId) {
    res.status(403).json({ ok: false, error: 'Доступ запрещён' });
    return false;
  }
  const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { clinicId: true } });
  if (!patient || patient.clinicId !== clinicId) {
    res.status(403).json({ ok: false, error: 'Доступ запрещён' });
    return false;
  }
  return true;
}

/** Verifies that a visit belongs to the current user's clinic. */
async function requireVisitAccess(req: AuthRequest, res: any, visitId: string): Promise<boolean> {
  const clinicId = req.user!.clinicId;
  if (!clinicId) {
    res.status(403).json({ ok: false, error: 'Доступ запрещён' });
    return false;
  }
  const visit = await prisma.visit.findUnique({ where: { id: visitId }, include: { patient: { select: { clinicId: true } } } });
  if (!visit || visit.patient?.clinicId !== clinicId) {
    res.status(403).json({ ok: false, error: 'Доступ запрещён' });
    return false;
  }
  return true;
}

/** Verifies that a treatment plan belongs to the current user's clinic. */
async function requireTreatmentPlanAccess(req: AuthRequest, res: any, planId: string): Promise<boolean> {
  const clinicId = req.user!.clinicId;
  if (!clinicId) {
    res.status(403).json({ ok: false, error: 'Доступ запрещён' });
    return false;
  }
  const plan = await prisma.treatmentPlan.findUnique({ where: { id: planId }, include: { patient: { select: { clinicId: true } } } });
  if (!plan || plan.patient?.clinicId !== clinicId) {
    res.status(403).json({ ok: false, error: 'Доступ запрещён' });
    return false;
  }
  return true;
}

/** Idempotent seed of dental ICD-10 codes when the reference table is empty. */
async function ensureIcd10Seeded() {
  const count = await prisma.iCD10Code.count();
  if (count > 0) return count;
  await prisma.iCD10Code.createMany({
    data: DENTAL_ICD10_SEED,
    skipDuplicates: true,
  });
  return DENTAL_ICD10_SEED.length;
}

medicalRouter.post('/visits', async (req: AuthRequest, res) => {
  try {
    const { patientId, doctorId, diagnosis, complaints, anamnesis, treatment, notes } = req.body;

    if (!patientId || !doctorId) {
      res.status(400).json({ ok: false, error: 'patientId and doctorId are required' });
      return;
    }

    if (!(await requirePatientAccess(req, res, patientId))) return;

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
    if (!(await requireVisitAccess(req, res, id))) return;

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
    if (!(await requirePatientAccess(req, res, patientId))) return;

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
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
      },
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

    if (!(await requirePatientAccess(req, res, patientId))) return;

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
    if (!(await requireTreatmentPlanAccess(req, res, id))) return;

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
    if (!(await requirePatientAccess(req, res, patientId))) return;

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

    if (!(await requirePatientAccess(req, res, patientId))) return;

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
    if (!(await requirePatientAccess(req, res, patientId))) return;

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

    if (!(await requirePatientAccess(req, res, patientId))) return;

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
    if (!(await requirePatientAccess(req, res, patientId))) return;

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
    const rawQ = req.query.q ?? req.query.search;
    const q = typeof rawQ === 'string' ? rawQ.trim() : '';

    try {
      await ensureIcd10Seeded();
    } catch (seedErr) {
      console.warn('[icd10] seed skipped:', seedErr);
    }

    let rows: Array<{ code: string; description: string; category: string | null }> = [];
    try {
      rows = await prisma.iCD10Code.findMany({
        where: q
          ? {
              OR: [
                { code: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
                { category: { contains: q, mode: 'insensitive' } },
              ],
            }
          : undefined,
        orderBy: { code: 'asc' },
        take: q ? 50 : 300,
      });
    } catch (dbErr) {
      console.warn('[icd10] db read failed, using built-in catalog:', dbErr);
    }

    // Empty DB / failed query → still show the built-in dental catalog.
    const data =
      rows.length > 0
        ? rows.map(mapIcd10Row)
        : searchDentalCatalog(q || undefined, q ? 50 : 300);

    return res.json({ ok: true, data });
  } catch (error) {
    console.error('[icd10]', error);
    // Last resort: never leave the CRM page blank.
    return res.json({ ok: true, data: searchDentalCatalog(undefined, 300) });
  }
});

export { medicalRouter };
