import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import type { AuthRequest } from '../../types/index.js';
import type { ApiResponse } from '../../types/index.js';
import { uid } from '../../lib/helpers.js';

const filesRouter = Router();

filesRouter.use(authenticate);

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
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

filesRouter.post('/upload', upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'Файл не загружен' });
    }

    const { patientId, type } = req.body as { patientId?: string; type?: string };
    const fileType = type || path.extname(req.file.originalname).slice(1).toUpperCase() || 'FILE';

    const fileSize = req.file.size;
    const mimeType = req.file.mimetype;

    const doc = await prisma.document.create({
      data: {
        id: uid(),
        patientId: patientId || null,
        clinicId: req.user!.clinicId || null,
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
    const id = req.params.id as string;

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) {
      return res.status(404).json({ ok: false, error: 'Документ не найден' });
    }

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
    const id = req.params.id as string;

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) {
      return res.status(404).json({ ok: false, error: 'Документ не найден' });
    }

    if (doc.clinicId && doc.clinicId !== req.user!.clinicId) {
      return res.status(403).json({ ok: false, error: 'Доступ запрещён' });
    }

    await prisma.document.delete({ where: { id } });

    return res.json({ ok: true, data: { deleted: true } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка сервера';
    return res.status(500).json({ ok: false, error: message });
  }
});

export { filesRouter };
