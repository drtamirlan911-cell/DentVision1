import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import type { AuthRequest } from '../../types/index.js';
import type { ApiResponse } from '../../types/index.js';
import { uid } from '../../lib/helpers.js';
import { assertSameClinic, denyGuest, requireClinicScope } from '../../lib/clinicAccess.js';
import { isStorageKey, keyFromStorageUrl, signedDownloadUrl, storageConfigured, toStorageUrl, uploadObject } from '../../lib/storage.js';
import { createSignLink, signDocument } from './documentSign.service.js';

const filesRouter = Router();

filesRouter.use(authenticate);

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  // CBCT/DICOM studies commonly run 50MB+; 10MB silently truncated real cases.
  limits: { fileSize: 60 * 1024 * 1024 },
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

filesRouter.get('/', requirePermission('patient.read'), async (req: AuthRequest, res) => {
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

    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '200'), 10) || 200, 1), 1000);

    const documents = await prisma.document.findMany({
      where: {
        ...(patientId
          ? { patientId, ...(scopedClinic ? { clinicId: scopedClinic } : {}) }
          : { clinicId: scopedClinic! }),
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
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
filesRouter.post('/documents', requirePermission('patient.write'), async (req: AuthRequest, res) => {
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

filesRouter.post('/documents/:id/send-signature', requirePermission('patient.write'), async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const doc = await prisma.document.findUnique({ where: { id }, select: { clinicId: true } });
    if (!doc) return res.status(404).json({ ok: false, error: 'Документ не найден' } satisfies ApiResponse);
    if (!assertSameClinic(req, res, doc.clinicId)) return;
    const { token, signUrl } = await createSignLink(id);
    return res.json({
      ok: true,
      data: { id, token, signUrl, message: 'Ссылка на подпись создана' },
    } satisfies ApiResponse);
  } catch (err: any) {
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка сервера';
    return res.status(err?.status || 500).json({ ok: false, error: message } satisfies ApiResponse);
  }
});

// In-clinic, staff-witnessed signing (authenticated). The remote patient-link
// path is public — see POST /api/public/document/:token/sign.
filesRouter.post('/documents/:id/sign', requirePermission('patient.write'), async (req: AuthRequest, res) => {
  try {
    const { signatureData, signedByName, token } = req.body || {};
    const updated = await signDocument({
      documentId: req.params.id as string,
      signatureData,
      signedByName,
      token,
      requesterClinicId: req.user?.clinicId,
    });
    return res.json({ ok: true, data: updated } satisfies ApiResponse);
  } catch (err: any) {
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка сервера';
    return res.status(err?.status || 500).json({ ok: false, error: message } satisfies ApiResponse);
  }
});

filesRouter.post('/upload', upload.single('file'), requirePermission('patient.write'), async (req: AuthRequest, res) => {
  try {
    if (denyGuest(req, res)) return;
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'Файл не загружен' });
    }
    if (!storageConfigured()) {
      // Refuse loudly rather than fabricate a URL nothing serves — the prior
      // "mock-storage" path looked like success and silently discarded every
      // uploaded X-ray/CBCT/consent file.
      console.error('[files] Upload rejected: S3_BUCKET/S3_ACCESS_KEY/S3_SECRET_KEY not configured');
      return res.status(503).json({ ok: false, error: 'Файловое хранилище не настроено. Обратитесь к администратору.' });
    }

    const clinicId = requireClinicScope(req, res);
    if (!clinicId && String(req.user?.role || '').toUpperCase() !== 'SUPERADMIN') return;
    const scopedClinic = clinicId || req.user!.clinicId || null;
    if (!scopedClinic) {
      return res.status(403).json({ ok: false, error: 'Выберите клинику', code: 'CLINIC_REQUIRED' });
    }

    const { patientId, type, imageType: requestedImageType } = req.body as { patientId?: string; type?: string; imageType?: string };
    if (patientId) {
      const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { clinicId: true } });
      if (!patient) return res.status(404).json({ ok: false, error: 'Пациент не найден' });
      if (!assertSameClinic(req, res, patient.clinicId)) return;
    }

    const fileType = type || path.extname(req.file.originalname).slice(1).toUpperCase() || 'FILE';

    const fileSize = req.file.size;
    const mimeType = req.file.mimetype;

    const fileId = uid();
    const safeName = req.file.originalname.replace(/[/\\]/g, '_');
    const safeExt = path.extname(safeName).toLowerCase();
    // Clinic-prefixed key: even though reads are already gated by
    // assertSameClinic on every route below, this keeps objects segregated
    // in the bucket itself rather than relying solely on the app-layer check.
    const storageKey = `clinics/${scopedClinic}/${fileId}${safeExt}`;
    await uploadObject(storageKey, req.file.buffer, req.file.mimetype);

    const doc = await prisma.document.create({
      data: {
        id: uid(),
        patientId: patientId || null,
        clinicId: scopedClinic,
        type: fileType,
        name: safeName,
        url: toStorageUrl(storageKey),
      },
    });

    if (patientId && ['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP'].includes(fileType)) {
      // `type` above is the file extension; what kind of study this is has to
      // be said separately. Without `imageType` this path hardcoded PHOTO, so
      // X_RAY, CBCT and SCAN were never produced by it at all — an uploaded
      // radiograph was filed as a photo.
      const VALID_IMAGE_TYPES = ['PHOTO', 'X_RAY', 'CBCT', 'DICOM', 'SCAN'];
      const imageType = VALID_IMAGE_TYPES.includes(String(requestedImageType || '').toUpperCase())
        ? String(requestedImageType).toUpperCase()
        : req.file.mimetype.includes('dicom') ? 'DICOM' : 'PHOTO';
      await prisma.patientImage.create({
        data: {
          id: uid(),
          patientId,
          type: imageType as 'PHOTO' | 'X_RAY' | 'CBCT' | 'DICOM' | 'SCAN',
          url: doc.url,
          name: safeName,
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

// Document content — serves actual file bytes for download/viewing.
// Works for both text templates (data:text/plain URLs) and uploaded files.
filesRouter.get('/:id/content', requirePermission('patient.read'), async (req: AuthRequest, res) => {
  try {
    if (denyGuest(req, res)) return;
    const id = req.params.id as string;
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return res.status(404).json({ ok: false, error: 'Документ не найден' });
    if (!assertSameClinic(req, res, doc.clinicId)) return;

    const url = String(doc.url || '');
    const title = doc.name || 'document';

    // Text templates stored as data:text/plain URLs
    if (url.startsWith('data:text/plain')) {
      const base64Match = url.match(/;base64,(.+)$/);
      const content = base64Match
        ? Buffer.from(base64Match[1], 'base64').toString('utf-8')
        : decodeURIComponent(url.replace(/^data:text\/plain;charset=utf-8,/, ''));
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(title)}.txt"`);
      return res.send(content);
    }

    // External URL — redirect
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return res.redirect(url);
    }

    // S3-backed upload — access was already checked above (assertSameClinic);
    // hand the client a short-lived signed URL rather than the bucket key.
    if (isStorageKey(url)) {
      if (!storageConfigured()) {
        return res.status(503).json({ ok: false, error: 'Файловое хранилище не настроено' });
      }
      const signed = await signedDownloadUrl(keyFromStorageUrl(url));
      return res.redirect(signed);
    }

    // Legacy placeholder from before real storage was wired up — the file
    // behind this URL was never actually persisted.
    return res.status(410).json({ ok: false, error: 'Файл недоступен (загружен до подключения хранилища)' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка сервера';
    return res.status(500).json({ ok: false, error: message });
  }
});

filesRouter.get('/:id', requirePermission('patient.read'), async (req: AuthRequest, res) => {
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

filesRouter.delete('/:id', requirePermission('patient.write'), async (req: AuthRequest, res) => {
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
