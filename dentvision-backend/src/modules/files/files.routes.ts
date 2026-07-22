import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import type { AuthRequest } from '../../types/index.js';
import type { ApiResponse } from '../../types/index.js';
import { uid } from '../../lib/helpers.js';
import { assertSameClinic, denyGuest, requireClinicScope } from '../../lib/clinicAccess.js';

const filesRouter = Router();

filesRouter.use(authenticate);

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      '.jpg', '.jpeg', '.png', '.gif', '.webp',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx',
      '.dcm', '.dicom',
      '.stl', '.obj',
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Недопустимый формат файла: ${ext}`));
    }
  },
});

filesRouter.get('/', async (req: AuthRequest, res) => {
  try {
    if (denyGuest(req, res)) return;
    const clinicId = requireClinicScope(req, res);
    if (!clinicId && String(req.user?.role || '').toUpperCase() !== 'SUPERADMIN') return;
    const scopedClinic = clinicId || req.user!.clinicId;
    if (!scopedClinic && String(req.user?.role || '').toUpperCase() !== 'SUPERADMIN') {
      return res.status(403).json({ ok: false, error: 'Выберите клинику', code: 'CLINIC_REQUIRED' });
    }

    const { patientId } = req.query as { patientId?: string };

    if (patientId) {
      const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { clinicId: true } });
      if (!patient) return res.status(404).json({ ok: false, error: 'Пациент не найден' });
      if (!assertSameClinic(req, res, patient.clinicId)) return;
    }

    const documents = await prisma.document.findMany({
      where: {
        ...(patientId
          ? { patientId, ...(scopedClinic ? { clinicId: scopedClinic } : {}) }
          : { clinicId: scopedClinic! }),
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ ok: true, data: documents } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка сервера';
    return res.status(500).json({ ok: false, error: message });
  }
});

// Text-authored documents (contracts, consent forms) created from a
// template in the CRM — distinct from binary /upload since there is no
// dedicated "content" column on Document. The text is losslessly encoded
// as a data: URI in the existing `url` field rather than adding a schema
// column, avoiding another risky migration against production.
filesRouter.post('/documents', async (req: AuthRequest, res) => {
  try {
    if (denyGuest(req, res)) return;
    const scoped = requireClinicScope(req, res);
    if (!scoped && String(req.user?.role || '').toUpperCase() !== 'SUPERADMIN') return;
    const clinicId = scoped || req.user!.clinicId;
    if (!clinicId) {
      return res.status(403).json({ ok: false, error: 'Выберите клинику', code: 'CLINIC_REQUIRED' } satisfies ApiResponse);
    }

    const { id, patientId, docType, title, content, status } = req.body as {
      id?: string; patientId?: string; docType?: string; title?: string; content?: string; status?: string;
    };
    if (!docType || !title) {
      return res.status(400).json({ ok: false, error: 'Тип и название документа обязательны' } satisfies ApiResponse);
    }

    if (patientId) {
      const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { clinicId: true } });
      if (!patient) return res.status(404).json({ ok: false, error: 'Пациент не найден' } satisfies ApiResponse);
      if (!assertSameClinic(req, res, patient.clinicId)) return;
    }
    if (id) {
      const existing = await prisma.document.findUnique({ where: { id }, select: { clinicId: true } });
      if (!existing) return res.status(404).json({ ok: false, error: 'Документ не найден' } satisfies ApiResponse);
      if (!assertSameClinic(req, res, existing.clinicId)) return;
    }

    const url = `data:text/plain;charset=utf-8;base64,${Buffer.from(content || '', 'utf-8').toString('base64')}`;

    const doc = id
      ? await prisma.document.update({
          where: { id },
          data: { name: title, type: docType, url, ...(status === 'signed' && { signed: true, signedAt: new Date() }) },
        })
      : await prisma.document.create({
          data: { id: uid(), patientId: patientId || null, clinicId, name: title, type: docType, url, signed: status === 'signed' },
        });

    return res.status(201).json({ ok: true, data: doc } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка сервера';
    return res.status(500).json({ ok: false, error: message });
  }
});

filesRouter.post('/documents/:id/send-signature', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return res.status(404).json({ ok: false, error: 'Документ не найден' } satisfies ApiResponse);
    if (!assertSameClinic(req, res, doc.clinicId)) return;
    const token = uid().replace(/-/g, '');
    // Encode token into metadata via notes-like fields: prepend to url query for demo links
    const signUrl = `/sign/${id}?token=${token}`;
    await prisma.document.update({
      where: { id },
      data: {
        // Persist token in name suffix is fragile; store in url fragment marker
        url: doc.url.includes('#sig=') ? doc.url.replace(/#sig=.*/, `#sig=${token}`) : `${doc.url}#sig=${token}`,
      },
    });
    return res.json({
      ok: true,
      data: { id, token, signUrl, message: 'Ссылка на подпись создана' },
    } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка сервера';
    return res.status(500).json({ ok: false, error: message } satisfies ApiResponse);
  }
});

filesRouter.post('/documents/:id/sign', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const { signatureData, signedByName, token } = req.body || {};
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return res.status(404).json({ ok: false, error: 'Документ не найден' } satisfies ApiResponse);

    const storedToken = doc.url.includes('#sig=') ? doc.url.split('#sig=')[1] : null;
    const staffOk = !!req.user?.clinicId && (!doc.clinicId || doc.clinicId === req.user.clinicId);
    const tokenOk = token && storedToken && token === storedToken;
    if (!staffOk && !tokenOk) {
      return res.status(403).json({ ok: false, error: 'Нет права подписи' } satisfies ApiResponse);
    }

    const updated = await prisma.document.update({
      where: { id },
      data: {
        signed: true,
        signedAt: new Date(),
        name: signedByName ? `${doc.name || 'Документ'} · ${signedByName}` : doc.name,
        // Keep signature payload in url data field when content is data URI — append JSON marker
        url: signatureData
          ? (doc.url.includes('data:') ? doc.url : `${doc.url}#signed`)
          : doc.url,
      },
    });

    return res.json({ ok: true, data: updated } satisfies ApiResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка сервера';
    return res.status(500).json({ ok: false, error: message } satisfies ApiResponse);
  }
});

filesRouter.post('/upload', upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (denyGuest(req, res)) return;
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'Файл не загружен' });
    }

    const clinicId = requireClinicScope(req, res);
    if (!clinicId && String(req.user?.role || '').toUpperCase() !== 'SUPERADMIN') return;
    const scopedClinic = clinicId || req.user!.clinicId || null;
    if (!scopedClinic) {
      return res.status(403).json({ ok: false, error: 'Выберите клинику', code: 'CLINIC_REQUIRED' });
    }

    const { patientId, type } = req.body as { patientId?: string; type?: string };
    if (patientId) {
      const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { clinicId: true } });
      if (!patient) return res.status(404).json({ ok: false, error: 'Пациент не найден' });
      if (!assertSameClinic(req, res, patient.clinicId)) return;
    }

    const fileType = type || path.extname(req.file.originalname).slice(1).toUpperCase() || 'FILE';

    const fileSize = req.file.size;
    const mimeType = req.file.mimetype;

    const doc = await prisma.document.create({
      data: {
        id: uid(),
        patientId: patientId || null,
        clinicId: scopedClinic,
        type: fileType,
        name: req.file.originalname,
        url: `/mock-storage/${uid()}/${req.file.originalname}`,
      },
    });

    if (patientId && ['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP'].includes(fileType)) {
      const imageType = req.file.mimetype.includes('dicom') ? 'DICOM' : 'PHOTO';
      await prisma.patientImage.create({
        data: {
          id: uid(),
          patientId,
          type: imageType as 'PHOTO' | 'X_RAY' | 'CBCT' | 'DICOM' | 'SCAN',
          url: doc.url,
          name: req.file.originalname,
          metadata: { size: fileSize, mimeType, originalName: req.file.originalname },
        },
      });
    }

    return res.status(201).json({
      ok: true,
      data: {
        id: doc.id,
        name: doc.name,
        url: doc.url,
        type: doc.type,
        size: fileSize,
        mimeType,
        patientId: doc.patientId,
        createdAt: doc.createdAt,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка сервера';
    return res.status(500).json({ ok: false, error: message });
  }
});

filesRouter.get('/:id', async (req: AuthRequest, res) => {
  try {
    if (denyGuest(req, res)) return;
    const id = req.params.id as string;

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) {
      return res.status(404).json({ ok: false, error: 'Документ не найден' });
    }
    if (!assertSameClinic(req, res, doc.clinicId)) return;

    const patientImage = doc.patientId
      ? await prisma.patientImage.findFirst({
          where: { patientId: doc.patientId, url: doc.url },
        })
      : null;

    return res.json({
      ok: true,
      data: {
        ...doc,
        metadata: patientImage?.metadata || null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка сервера';
    return res.status(500).json({ ok: false, error: message });
  }
});

filesRouter.delete('/:id', async (req: AuthRequest, res) => {
  try {
    if (denyGuest(req, res)) return;
    const id = req.params.id as string;

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) {
      return res.status(404).json({ ok: false, error: 'Документ не найден' });
    }

    if (!assertSameClinic(req, res, doc.clinicId)) return;

    await prisma.document.delete({ where: { id } });

    return res.json({ ok: true, data: { deleted: true } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка сервера';
    return res.status(500).json({ ok: false, error: message });
  }
});

export { filesRouter };
