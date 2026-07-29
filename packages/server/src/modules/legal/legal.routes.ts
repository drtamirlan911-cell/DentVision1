import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { requireAuth, requireSuperAdmin } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { emitAuditEvent } from '../../lib/events.js';
import { uid } from '../../lib/helpers.js';
import {
  getDashboardStats,
  createDocumentFromTemplate,
  changeDocumentStatus,
  onboardPartner,
} from './legal.service.js';
import {
  createTemplateSchema,
  updateTemplateSchema,
  createBlockSchema,
  updateBlockSchema,
  createPartnerSchema,
  createDocumentSchema,
  updateDocumentStatusSchema,
  createDocumentVersionSchema,
  createInvoiceSchema,
  updateInvoiceStatusSchema,
  explainSchema,
  diffSchema,
  checkSchema,
} from './legal.schemas.js';
import { writeAuditLog } from './legal.audit.js';
import { exportDocument } from './legal.export.js';
import { explainDocument, diffVersions, checkConflicts } from './legal.ai.js';

const legalRouter = Router();

legalRouter.use(requireAuth);
legalRouter.use(requireSuperAdmin);

legalRouter.get('/dashboard', async (_req, res, next) => {
  try {
    res.status(200).json({ ok: true, data: await getDashboardStats() });
  } catch (err) { next(err); }
});

legalRouter.get('/templates', async (_req, res, next) => {
  try {
    const data = await prisma.legalTemplate.findMany({
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    res.status(200).json({ ok: true, data });
  } catch (err) { next(err); }
});

legalRouter.post('/templates', validate(createTemplateSchema), async (req, res, next) => {
  try {
    const { name, description, category, content, metadata } = req.body;
    const template = await prisma.legalTemplate.create({
      data: { id: uid(), name, description: description || null, category: category || null, metadata: metadata || null },
    });
    await prisma.legalTemplateVersion.create({
      data: { id: uid(), templateId: template.id, version: 1, content, published: false },
    });
    const data = await prisma.legalTemplate.findUnique({
      where: { id: template.id },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    res.status(201).json({ ok: true, data });
  } catch (err) { next(err); }
});

legalRouter.get('/templates/:id', async (req, res, next) => {
  try {
    const data = await prisma.legalTemplate.findUnique({
      where: { id: req.params.id },
      include: { versions: { orderBy: { version: 'desc' } } },
    });
    if (!data) { res.status(404).json({ ok: false, error: 'Template not found' }); return; }
    res.status(200).json({ ok: true, data });
  } catch (err) { next(err); }
});

legalRouter.put('/templates/:id', validate(updateTemplateSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, category, content, metadata } = req.body;
    const existing = await prisma.legalTemplate.findUnique({ where: { id }, select: { id: true } });
    if (!existing) { res.status(404).json({ ok: false, error: 'Template not found' }); return; }
    await prisma.legalTemplate.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(metadata !== undefined ? { metadata } : {}),
      },
    });
    const latest = await prisma.legalTemplateVersion.findFirst({
      where: { templateId: id }, orderBy: { version: 'desc' }, select: { version: true },
    });
    await prisma.legalTemplateVersion.create({
      data: { id: uid(), templateId: id, version: (latest?.version ?? 0) + 1, content: content || '', published: false },
    });
    const data = await prisma.legalTemplate.findUnique({
      where: { id }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    res.status(200).json({ ok: true, data });
  } catch (err) { next(err); }
});

legalRouter.post('/templates/:id/publish', async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await prisma.legalTemplate.findUnique({ where: { id }, select: { id: true } });
    if (!existing) { res.status(404).json({ ok: false, error: 'Template not found' }); return; }
    const latest = await prisma.legalTemplateVersion.findFirst({
      where: { templateId: id }, orderBy: { version: 'desc' }, select: { version: true, content: true },
    });
    if (!latest) { res.status(400).json({ ok: false, error: 'No versions to publish' }); return; }
    await prisma.legalTemplateVersion.create({
      data: { id: uid(), templateId: id, version: latest.version + 1, content: latest.content, published: true },
    });
    const data = await prisma.legalTemplate.findUnique({
      where: { id }, include: { versions: { orderBy: { version: 'desc' }, where: { published: true } } },
    });
    res.status(200).json({ ok: true, data });
  } catch (err) { next(err); }
});

legalRouter.post('/templates/:id/archive', async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await prisma.legalTemplate.findUnique({ where: { id }, select: { id: true } });
    if (!existing) { res.status(404).json({ ok: false, error: 'Template not found' }); return; }
    const data = await prisma.legalTemplate.update({ where: { id }, data: { isActive: false } });
    res.status(200).json({ ok: true, data });
  } catch (err) { next(err); }
});

legalRouter.get('/blocks', async (_req, res, next) => {
  try {
    res.status(200).json({ ok: true, data: await prisma.legalBlock.findMany() });
  } catch (err) { next(err); }
});

legalRouter.post('/blocks', validate(createBlockSchema), async (req, res, next) => {
  try {
    const { name, content, category, metadata } = req.body;
    const data = await prisma.legalBlock.create({
      data: { id: uid(), name, content, category: category || null, metadata: metadata || null },
    });
    res.status(201).json({ ok: true, data });
  } catch (err) { next(err); }
});

legalRouter.put('/blocks/:id', validate(updateBlockSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, content, category, metadata } = req.body;
    const existing = await prisma.legalBlock.findUnique({ where: { id }, select: { id: true } });
    if (!existing) { res.status(404).json({ ok: false, error: 'Block not found' }); return; }
    const data = await prisma.legalBlock.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(content !== undefined ? { content } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(metadata !== undefined ? { metadata } : {}),
      },
    });
    res.status(200).json({ ok: true, data });
  } catch (err) { next(err); }
});

legalRouter.delete('/blocks/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await prisma.legalBlock.findUnique({ where: { id }, select: { id: true } });
    if (!existing) { res.status(404).json({ ok: false, error: 'Block not found' }); return; }
    const data = await prisma.legalBlock.update({ where: { id }, data: { isActive: false } });
    res.status(200).json({ ok: true, data });
  } catch (err) { next(err); }
});

legalRouter.get('/partners', async (_req, res, next) => {
  try {
    const data = await prisma.legalPartner.findMany({
      include: { _count: { select: { documents: true } } },
    });
    res.status(200).json({ ok: true, data });
  } catch (err) { next(err); }
});

legalRouter.post('/partners', validate(createPartnerSchema), async (req, res, next) => {
  try {
    res.status(201).json({ ok: true, data: await onboardPartner(req.body) });
  } catch (err) { next(err); }
});

legalRouter.get('/partners/:id', async (req, res, next) => {
  try {
    const data = await prisma.legalPartner.findUnique({
      where: { id: req.params.id },
      include: { documents: true, invoices: true },
    });
    if (!data) { res.status(404).json({ ok: false, error: 'Partner not found' }); return; }
    res.status(200).json({ ok: true, data });
  } catch (err) { next(err); }
});

legalRouter.get('/documents', async (req, res, next) => {
  try {
    const { status, templateId, partnerId, search } = req.query;
    const where: Record<string, unknown> = {};
    if (status && typeof status === 'string') where.status = status;
    if (templateId && typeof templateId === 'string') where.templateId = templateId;
    if (partnerId && typeof partnerId === 'string') where.partnerId = partnerId;
    if (search && typeof search === 'string') {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } },
      ];
    }
    res.status(200).json({ ok: true, data: await prisma.legalDocument.findMany({ where }) });
  } catch (err) { next(err); }
});

legalRouter.post('/documents', validate(createDocumentSchema), async (req, res, next) => {
  try {
    res.status(201).json({ ok: true, data: await createDocumentFromTemplate(req.body) });
  } catch (err) { next(err); }
});

legalRouter.get('/documents/:id', async (req, res, next) => {
  try {
    const data = await prisma.legalDocument.findUnique({
      where: { id: req.params.id },
      include: {
        template: true, partner: true,
        versions: { orderBy: { version: 'desc' } },
        auditLogs: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!data) { res.status(404).json({ ok: false, error: 'Document not found' }); return; }
    res.status(200).json({ ok: true, data });
  } catch (err) { next(err); }
});

legalRouter.put('/documents/:id/status', validate(updateDocumentStatusSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    res.status(200).json({ ok: true, data: await changeDocumentStatus(id, status, reason) });
  } catch (err) { next(err); }
});

legalRouter.post('/documents/:id/version', validate(createDocumentVersionSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content, notes } = req.body;
    const existing = await prisma.legalDocument.findUnique({ where: { id }, select: { id: true } });
    if (!existing) { res.status(404).json({ ok: false, error: 'Document not found' }); return; }
    const latest = await prisma.legalDocumentVersion.findFirst({
      where: { documentId: id }, orderBy: { version: 'desc' }, select: { version: true },
    });
    const data = await prisma.legalDocumentVersion.create({
      data: { id: uid(), documentId: id, version: (latest?.version ?? 0) + 1, content, notes: notes || null },
    });
    res.status(201).json({ ok: true, data });
  } catch (err) { next(err); }
});

legalRouter.get('/documents/:id/versions', async (req, res, next) => {
  try {
    const data = await prisma.legalDocumentVersion.findMany({
      where: { documentId: req.params.id }, orderBy: { version: 'desc' },
    });
    res.status(200).json({ ok: true, data });
  } catch (err) { next(err); }
});

legalRouter.get('/documents/:id/audit', async (req, res, next) => {
  try {
    const data = await prisma.legalAuditLog.findMany({
      where: { documentId: req.params.id }, orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ ok: true, data });
  } catch (err) { next(err); }
});

legalRouter.get('/documents/:id/export', async (req, res, next) => {
  try {
    res.status(200).json({ ok: true, data: await exportDocument(req.params.id) });
  } catch (err) { next(err); }
});

legalRouter.get('/invoices', async (_req, res, next) => {
  try {
    const data = await prisma.legalInvoice.findMany({ include: { partner: true } });
    res.status(200).json({ ok: true, data });
  } catch (err) { next(err); }
});

legalRouter.post('/invoices', validate(createInvoiceSchema), async (req, res, next) => {
  try {
    const { partnerId, documentId, amount, currency, dueDate, lineItems, notes } = req.body;
    const data = await prisma.legalInvoice.create({
      data: {
        id: uid(), partnerId, documentId: documentId || null, amount, currency: currency || 'USD',
        dueDate: dueDate ? new Date(dueDate) : null, lineItems: lineItems || null, notes: notes || null,
      },
    });
    res.status(201).json({ ok: true, data });
  } catch (err) { next(err); }
});

legalRouter.get('/invoices/:id', async (req, res, next) => {
  try {
    const data = await prisma.legalInvoice.findUnique({
      where: { id: req.params.id }, include: { partner: true, document: true },
    });
    if (!data) { res.status(404).json({ ok: false, error: 'Invoice not found' }); return; }
    res.status(200).json({ ok: true, data });
  } catch (err) { next(err); }
});

legalRouter.put('/invoices/:id/status', validate(updateInvoiceStatusSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const existing = await prisma.legalInvoice.findUnique({ where: { id }, select: { id: true } });
    if (!existing) { res.status(404).json({ ok: false, error: 'Invoice not found' }); return; }
    const data = await prisma.legalInvoice.update({ where: { id }, data: { status } });
    await writeAuditLog({ action: 'invoice.status_changed', entityType: 'invoice', entityId: id, metadata: { newStatus: status } });
    res.status(200).json({ ok: true, data });
  } catch (err) { next(err); }
});

legalRouter.get('/audit', async (_req, res, next) => {
  try {
    const data = await prisma.legalAuditLog.findMany({
      include: { performer: true, document: true }, orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ ok: true, data });
  } catch (err) { next(err); }
});

legalRouter.get('/settings', async (_req, res, next) => {
  try {
    res.status(200).json({
      ok: true,
      data: {
        version: '1.0.0',
        features: { templates: true, blocks: true, partners: true, documents: true, invoices: true, ai: true, audit: true },
        defaults: { currency: 'USD', locale: 'en', pageSize: 20 },
        retentionDays: 365,
      },
    });
  } catch (err) { next(err); }
});

legalRouter.post('/ai/explain', validate(explainSchema), async (req, res, next) => {
  try {
    const { documentId, versionId } = req.body;
    res.status(200).json({ ok: true, data: await explainDocument(documentId, versionId) });
  } catch (err) { next(err); }
});

legalRouter.post('/ai/diff', validate(diffSchema), async (req, res, next) => {
  try {
    const { documentId, fromVersionId, toVersionId } = req.body;
    res.status(200).json({ ok: true, data: await diffVersions(documentId, fromVersionId, toVersionId) });
  } catch (err) { next(err); }
});

legalRouter.post('/ai/check', validate(checkSchema), async (req, res, next) => {
  try {
    const { documentId, versionId } = req.body;
    res.status(200).json({ ok: true, data: await checkConflicts(documentId, versionId) });
  } catch (err) { next(err); }
});

export { legalRouter };
