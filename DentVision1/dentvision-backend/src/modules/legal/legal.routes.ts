import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireSuperadmin } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import prisma from '../../lib/prisma.js';
import { getDashboardStats, createDocumentFromTemplate, changeDocumentStatus, onboardPartner } from './legal.service.js';
import { writeAuditLog } from './legal.audit.js';
import { exportDocument } from './legal.export.js';
import { explainDocument, diffVersions, checkConflicts } from './legal.ai.js';
import { getPlatformSettings, updatePlatformSettings } from './legal.platform-settings.js';
import {
  createBlockSchema, updateBlockSchema, createTemplateSchema, updateTemplateSchema,
  createPartnerSchema, createDocumentSchema, updateDocumentStatusSchema,
  createDocumentVersionSchema, createInvoiceSchema, updateInvoiceStatusSchema,
  aiExplainSchema, aiDiffSchema, aiCheckSchema,
} from './legal.schemas.js';

const router = Router();

router.use(authenticate);
router.use(requireSuperadmin);

function uid(req: any): string { return req.user?.id || 'unknown'; }
function qs(req: any, key: string): string | undefined { return req.query[key] as string | undefined; }

router.get('/dashboard', async (_req, res, next) => {
  try { res.json({ ok: true, data: await getDashboardStats() }); }
  catch (err) { next(err); }
});

router.get('/templates', async (_req, res, next) => {
  try {
    const templates = await prisma.legalTemplate.findMany({
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ ok: true, data: templates });
  } catch (err) { next(err); }
});

router.post('/templates', validate(createTemplateSchema), async (req, res, next) => {
  try {
    const { type, name, description, blocks, variables } = req.body;
    const template = await prisma.legalTemplate.create({
      data: { type, name, description, blocks, variables, createdBy: uid(req) },
    });
    await prisma.legalTemplateVersion.create({
      data: { templateId: template.id, version: 1, content: '', createdBy: uid(req) },
    });
    res.status(201).json({ ok: true, data: template });
  } catch (err) { next(err); }
});

router.get('/templates/:id', async (req, res, next) => {
  try {
    const template = await prisma.legalTemplate.findUnique({
      where: { id: req.params.id as string },
      include: { versions: { orderBy: { version: 'desc' } } },
    });
    if (!template) return res.status(404).json({ ok: false, error: 'Template not found' });
    res.json({ ok: true, data: template });
  } catch (err) { next(err); }
});

router.put('/templates/:id', validate(updateTemplateSchema), async (req, res, next) => {
  try {
    const existing = await prisma.legalTemplate.findUnique({ where: { id: req.params.id as string } });
    if (!existing) return res.status(404).json({ ok: false, error: 'Template not found' });
    const { name, description, blocks, variables } = req.body;
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (blocks !== undefined) updateData.blocks = blocks;
    if (variables !== undefined) updateData.variables = variables;
    const newVersion = existing.currentVersion + 1;
    const updated = await prisma.legalTemplate.update({
      where: { id: req.params.id as string },
      data: { ...updateData, currentVersion: newVersion },
    });
    await prisma.legalTemplateVersion.create({
      data: { templateId: updated.id, version: newVersion, content: '', changelog: `Version ${newVersion}`, createdBy: uid(req) },
    });
    res.json({ ok: true, data: updated });
  } catch (err) { next(err); }
});

router.post('/templates/:id/publish', async (req, res, next) => {
  try {
    const versionId = req.body.versionId;
    if (!versionId) return res.status(400).json({ ok: false, error: 'versionId required' });
    const version = await prisma.legalTemplateVersion.findUnique({ where: { id: versionId } });
    if (!version) return res.status(404).json({ ok: false, error: 'Version not found' });
    const updated = await prisma.legalTemplateVersion.update({
      where: { id: versionId },
      data: { status: 'PUBLISHED', publishedAt: new Date(), approvedBy: uid(req) },
    });
    res.json({ ok: true, data: updated });
  } catch (err) { next(err); }
});

router.post('/templates/:id/archive', async (req, res, next) => {
  try {
    await prisma.legalTemplate.update({
      where: { id: req.params.id as string },
      data: { versions: { updateMany: { where: { status: 'PUBLISHED' }, data: { status: 'ARCHIVED' } } } },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.get('/blocks', async (_req, res, next) => {
  try {
    const blocks = await prisma.legalBlock.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    res.json({ ok: true, data: blocks });
  } catch (err) { next(err); }
});

router.post('/blocks', validate(createBlockSchema), async (req, res, next) => {
  try {
    const { name, category, content, variables } = req.body;
    const block = await prisma.legalBlock.create({ data: { name, category, content, variables, createdBy: uid(req) } });
    res.status(201).json({ ok: true, data: block });
  } catch (err) { next(err); }
});

router.put('/blocks/:id', validate(updateBlockSchema), async (req, res, next) => {
  try {
    const { name, category, content, variables } = req.body;
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (category !== undefined) updateData.category = category;
    if (content !== undefined) updateData.content = content;
    if (variables !== undefined) updateData.variables = variables;
    const block = await prisma.legalBlock.update({ where: { id: req.params.id as string }, data: updateData });
    res.json({ ok: true, data: block });
  } catch (err) { next(err); }
});

router.delete('/blocks/:id', async (req, res, next) => {
  try {
    await prisma.legalBlock.update({ where: { id: req.params.id as string }, data: { isActive: false } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.get('/partners', async (_req, res, next) => {
  try {
    const partners = await prisma.legalPartner.findMany({
      include: { _count: { select: { documents: true, invoices: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ ok: true, data: partners });
  } catch (err) { next(err); }
});

router.post('/partners', validate(createPartnerSchema), async (req, res, next) => {
  try {
    const result = await onboardPartner(req.body, uid(req));
    res.status(201).json({ ok: true, data: result });
  } catch (err) { next(err); }
});

router.get('/partners/:id', async (req, res, next) => {
  try {
    const partner = await prisma.legalPartner.findUnique({
      where: { id: req.params.id as string },
      include: { documents: { include: { template: true }, orderBy: { createdAt: 'desc' } }, invoices: { orderBy: { createdAt: 'desc' } } },
    });
    if (!partner) return res.status(404).json({ ok: false, error: 'Partner not found' });
    res.json({ ok: true, data: partner });
  } catch (err) { next(err); }
});

router.get('/documents', async (req, res, next) => {
  try {
    const where: any = {};
    const status = qs(req, 'status');
    const templateId = qs(req, 'templateId');
    const partnerId = qs(req, 'partnerId');
    const search = qs(req, 'search');
    if (status) where.status = status;
    if (templateId) where.templateId = templateId;
    if (partnerId) where.partnerId = partnerId;
    if (search) {
      where.OR = [
        { documentNumber: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }
    const docs = await prisma.legalDocument.findMany({
      where,
      include: { template: true, partner: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ ok: true, data: docs });
  } catch (err) { next(err); }
});

router.post('/documents', validate(createDocumentSchema), async (req, res, next) => {
  try {
    const { templateId, partnerId, variables, effectiveDate, expirationDate, linkedDocs } = req.body;
    const doc = await createDocumentFromTemplate(templateId, partnerId, variables, uid(req), { effectiveDate, expirationDate, linkedDocs });
    res.status(201).json({ ok: true, data: doc });
  } catch (err) { next(err); }
});

router.get('/documents/:id', async (req, res, next) => {
  try {
    const doc = await prisma.legalDocument.findUnique({
      where: { id: req.params.id as string },
      include: { template: true, partner: true, versions: { orderBy: { version: 'desc' } }, auditLogs: { include: { performer: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' } } },
    });
    if (!doc) return res.status(404).json({ ok: false, error: 'Document not found' });
    res.json({ ok: true, data: doc });
  } catch (err) { next(err); }
});

router.put('/documents/:id/status', validate(updateDocumentStatusSchema), async (req, res, next) => {
  try {
    const doc = await changeDocumentStatus(req.params.id as string, req.body.status, uid(req), req.body.changelog);
    res.json({ ok: true, data: doc });
  } catch (err) { next(err); }
});

router.post('/documents/:id/version', validate(createDocumentVersionSchema), async (req, res, next) => {
  try {
    const doc = await prisma.legalDocument.findUnique({ where: { id: req.params.id as string } });
    if (!doc) return res.status(404).json({ ok: false, error: 'Document not found' });
    const newVersion = doc.version + 1;
    const version = await prisma.legalDocumentVersion.create({
      data: { documentId: doc.id, version: newVersion, content: req.body.content, status: doc.status as any, changelog: req.body.changelog, createdBy: uid(req) },
    });
    await prisma.legalDocument.update({ where: { id: doc.id }, data: { version: newVersion, content: req.body.content } });
    await writeAuditLog({ documentId: doc.id, action: 'VERSION_ADDED', fromVersion: doc.version, toVersion: newVersion, diff: { changelog: req.body.changelog }, performedBy: uid(req) });
    res.status(201).json({ ok: true, data: version });
  } catch (err) { next(err); }
});

router.get('/documents/:id/versions', async (req, res, next) => {
  try {
    const versions = await prisma.legalDocumentVersion.findMany({
      where: { documentId: req.params.id as string },
      orderBy: { version: 'desc' },
    });
    res.json({ ok: true, data: versions });
  } catch (err) { next(err); }
});

router.get('/documents/:id/audit', async (req, res, next) => {
  try {
    const logs = await prisma.legalAuditLog.findMany({
      where: { documentId: req.params.id as string },
      include: { performer: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ ok: true, data: logs });
  } catch (err) { next(err); }
});

router.get('/documents/:id/export', async (req, res, next) => {
  try {
    const format = qs(req, 'format') || 'html';
    const result = await exportDocument(req.params.id as string, format, uid(req));
    if (format === 'html') { res.setHeader('Content-Type', 'text/html'); res.send(result.content); }
    else if (format === 'json') res.json(result);
    else res.status(400).json({ ok: false, error: result.content as string });
  } catch (err) { next(err); }
});

router.get('/invoices', async (_req, res, next) => {
  try {
    const invoices = await prisma.legalInvoice.findMany({
      include: { partner: true, document: { select: { documentNumber: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ ok: true, data: invoices });
  } catch (err) { next(err); }
});

router.post('/invoices', validate(createInvoiceSchema), async (req, res, next) => {
  try {
    const { partnerId, documentId, amountKzt, dueAt, description } = req.body;
    const count = await prisma.legalInvoice.count();
    const invoiceNumber = `DV-INV-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
    const invoice = await prisma.legalInvoice.create({
      data: { invoiceNumber, partnerId, documentId, amountKzt: BigInt(amountKzt), dueAt: dueAt ? new Date(dueAt) : undefined, description, createdBy: uid(req) },
    });
    res.status(201).json({ ok: true, data: invoice });
  } catch (err) { next(err); }
});

router.get('/invoices/:id', async (req, res, next) => {
  try {
    const invoice = await prisma.legalInvoice.findUnique({
      where: { id: req.params.id as string },
      include: { partner: true, document: { select: { documentNumber: true } } },
    });
    if (!invoice) return res.status(404).json({ ok: false, error: 'Invoice not found' });
    res.json({ ok: true, data: invoice });
  } catch (err) { next(err); }
});

router.put('/invoices/:id/status', validate(updateInvoiceStatusSchema), async (req, res, next) => {
  try {
    const invoice = await prisma.legalInvoice.findUnique({ where: { id: req.params.id as string } });
    if (!invoice) return res.status(404).json({ ok: false, error: 'Invoice not found' });
    const updateData: any = { status: req.body.status };
    if (req.body.status === 'paid') updateData.paidAt = new Date();
    const updated = await prisma.legalInvoice.update({ where: { id: req.params.id as string }, data: updateData });
    await writeAuditLog({ documentId: invoice.documentId || 'none', action: 'INVOICE_STATUS_CHANGED', diff: { invoiceId: invoice.id, from: invoice.status, to: req.body.status }, performedBy: uid(req) });
    res.json({ ok: true, data: updated });
  } catch (err) { next(err); }
});

router.get('/audit', async (_req, res, next) => {
  try {
    const logs = await prisma.legalAuditLog.findMany({
      include: { performer: { select: { firstName: true, lastName: true } }, document: { select: { documentNumber: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ ok: true, data: logs });
  } catch (err) { next(err); }
});

router.get('/settings', async (_req, res) => {
  res.json({ ok: true, data: { platformName: 'DentVision', legalVersion: '1.0', supportedLanguages: ['ru', 'kz', 'en'], defaultLanguage: 'ru', ecpEnabled: false } });
});

router.post('/ai/explain', validate(aiExplainSchema), async (req, res, next) => {
  try {
    const result = await explainDocument(req.body.content, req.body.language, 'ai', uid(req));
    res.json({ ok: true, data: result });
  } catch (err) { next(err); }
});

router.post('/ai/diff', validate(aiDiffSchema), async (req, res, next) => {
  try {
    const result = await diffVersions(req.body.v1, req.body.v2, 'ai', uid(req));
    res.json({ ok: true, data: result });
  } catch (err) { next(err); }
});

router.post('/ai/check', validate(aiCheckSchema), async (req, res, next) => {
  try {
    const result = await checkConflicts(req.body.content, 'ai', uid(req));
    res.json({ ok: true, data: result });
  } catch (err) { next(err); }
});

router.get('/platform-settings', async (_req, res, next) => {
  try {
    const settings = await getPlatformSettings();
    res.json({ ok: true, data: settings });
  } catch (err) { next(err); }
});

router.put('/platform-settings', async (req, res, next) => {
  try {
    const settings = await updatePlatformSettings(req.body);
    res.json({ ok: true, data: settings });
  } catch (err) { next(err); }
});

export { router as legalRouter };
