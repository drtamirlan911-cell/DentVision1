import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import prisma from '../../lib/prisma.js';
import { writeAuditLog } from './legal.audit.js';
import { onboardPartner, buildDocumentContent } from './legal.service.js';

const router = Router();

router.use(authenticate);

router.post('/onboard', async (req: any, res, next) => {
  try {
    const existing = await prisma.legalPartner.findUnique({ where: { userId: req.user.id } });
    if (existing) return res.json({ ok: true, data: existing });

    const member = await prisma.clinicMember.findFirst({ where: { userId: req.user.id } });
    if (!member) return res.status(400).json({ ok: false, error: 'У вас нет клиники. Создайте клинику в панели управления.' });

    const clinic = await prisma.clinic.findUnique({ where: { id: member.clinicId } });
    const defaultName = clinic?.name || `${req.user.firstName} ${req.user.lastName}`;
    const partner = await onboardPartner({
      userId: req.user.id,
      type: 'CLINIC',
      legalName: req.body.legalName || defaultName,
      bin: req.body.bin || '',
      director: req.body.director || '',
      address: req.body.address || '',
      iban: req.body.iban || '',
      phone: req.body.phone || '',
      email: req.body.email || req.user.email,
    }, req.user.id);
    res.json({ ok: true, data: partner });
  } catch (err) { next(err); }
});

router.use(async (req: any, res, next) => {
  try {
    const partner = await prisma.legalPartner.findUnique({ where: { userId: req.user?.id } });
    if (!partner) {
      return res.status(403).json({ ok: false, error: 'Доступ только для партнёров платформы' });
    }
    req.partner = partner;
    next();
  } catch (err) { next(err); }
});

router.get('/documents', async (req: any, res, next) => {
  try {
    let docs = await prisma.legalDocument.findMany({
      where: { partnerId: req.partner.id },
      include: { template: true, versions: { orderBy: { version: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });
    // Auto-regenerate documents that still have raw variables
    const hasRaw = (c: string) => /\{\{\w+\}\}/.test(c);
    const partner = req.partner;
    for (const doc of docs) {
      if (hasRaw(doc.content)) {
        const vars: Record<string, any> = {
          PartnerName: partner.legalName || '',
          PartnerBIN: partner.bin || '',
          PartnerDirector: partner.director || '',
          PartnerAddress: partner.address || '',
          PartnerIBAN: partner.iban || '',
          PartnerPhone: partner.phone || '',
          PartnerEmail: partner.email || '',
          ContractNumber: doc.documentNumber,
          DocumentNumber: doc.documentNumber,
        };
        const type = partner.type;
        const prefix = type === 'CLINIC' || type === 'CORPORATE' ? 'Clinic' : 'Partner';
        vars[`${prefix}Name`] = partner.legalName || '';
        vars[`${prefix}BIN`] = partner.bin || '';
        vars[`${prefix}Director`] = partner.director || '';
        vars[`${prefix}Address`] = partner.address || '';
        vars[`${prefix}IBAN`] = partner.iban || '';
        vars[`${prefix}Phone`] = partner.phone || '';
        vars[`${prefix}Email`] = partner.email || '';
        vars.ClinicIBAN = partner.iban || '';
        vars.ClinicDirectorTitle = 'Директор';
        const content = await buildDocumentContent(doc.templateId, vars);
        await prisma.legalDocument.update({ where: { id: doc.id }, data: { content } });
        await prisma.legalDocumentVersion.create({
          data: { documentId: doc.id, version: doc.version + 1, content, status: 'DRAFT', changelog: 'Auto-regenerated', createdBy: req.user.id },
        });
      }
    }
    // Re-fetch after regeneration
    docs = await prisma.legalDocument.findMany({
      where: { partnerId: req.partner.id },
      include: { template: true, versions: { orderBy: { version: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ ok: true, data: docs });
  } catch (err) { next(err); }
});

router.post('/documents/regenerate', async (req: any, res, next) => {
  try {
    const partner = await prisma.legalPartner.findUnique({ where: { id: req.partner.id } });
    if (!partner) return res.status(404).json({ ok: false, error: 'Partner not found' });
    const docs = await prisma.legalDocument.findMany({ where: { partnerId: req.partner.id } });
    const updated: any[] = [];
    for (const doc of docs) {
      const vars: Record<string, any> = {
        PartnerName: partner.legalName || '',
        PartnerBIN: partner.bin || '',
        PartnerDirector: partner.director || '',
        PartnerAddress: partner.address || '',
        PartnerIBAN: partner.iban || '',
        PartnerPhone: partner.phone || '',
        PartnerEmail: partner.email || '',
      };
      const type = partner.type;
      const prefix = type === 'CLINIC' || type === 'CORPORATE' ? 'Clinic'
        : type === 'DIAGNOSTIC_CENTER' ? 'Diagnostics'
        : type === 'LABORATORY' ? 'Laboratory'
        : type === 'LECTURER' ? 'Lecturer'
        : 'Partner';
      vars[`${prefix}Name`] = partner.legalName || '';
      vars[`${prefix}BIN`] = partner.bin || '';
      vars[`${prefix}Director`] = partner.director || '';
      vars[`${prefix}Address`] = partner.address || '';
      vars[`${prefix}IBAN`] = partner.iban || '';
      vars[`${prefix}Phone`] = partner.phone || '';
      vars[`${prefix}Email`] = partner.email || '';
      vars.ClinicIBAN = partner.iban || '';
      vars.ClinicBank = '';
      vars.ClinicBIC = '';
      vars.ContractNumber = doc.documentNumber;
      vars.DocumentNumber = doc.documentNumber;
      vars.Subscription = '';
      vars.ClinicLicense = '';
      vars.ClinicDirectorTitle = 'Директор';
      const content = await buildDocumentContent(doc.templateId, vars);
      await prisma.legalDocument.update({ where: { id: doc.id }, data: { content } });
      await prisma.legalDocumentVersion.create({
        data: { documentId: doc.id, version: doc.version + 1, content, status: 'DRAFT', changelog: 'Content regenerated with partner data', createdBy: req.user.id },
      });
      updated.push({ id: doc.id, documentNumber: doc.documentNumber });
    }
    res.json({ ok: true, data: updated });
  } catch (err) { next(err); }
});

router.get('/documents/:id', async (req: any, res, next) => {
  try {
    const doc = await prisma.legalDocument.findFirst({
      where: { id: req.params.id, partnerId: req.partner.id },
      include: { template: true, versions: { orderBy: { version: 'desc' } }, auditLogs: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
    if (!doc) return res.status(404).json({ ok: false, error: 'Document not found' });
    res.json({ ok: true, data: doc });
  } catch (err) { next(err); }
});

router.post('/documents/:id/sign', async (req: any, res, next) => {
  try {
    const doc = await prisma.legalDocument.findFirst({
      where: { id: req.params.id, partnerId: req.partner.id },
    });
    if (!doc) return res.status(404).json({ ok: false, error: 'Document not found' });
    if (doc.status !== 'DRAFT' && doc.status !== 'REVIEW') {
      return res.status(400).json({ ok: false, error: 'Document already signed or cancelled' });
    }
    const partner = await prisma.legalPartner.findUnique({ where: { id: req.partner.id } });
    const required = ['legalName', 'bin', 'director', 'address', 'iban'] as const;
    const missing = required.filter(k => !(partner as any)?.[k]);
    if (missing.length) {
      const labels: Record<string, string> = { legalName: 'Наименование юрлица', bin: 'БИН/ИИН', director: 'ФИО руководителя', address: 'Юридический адрес', iban: 'IBAN счёт' };
      return res.status(400).json({ ok: false, error: `Заполните реквизиты: ${missing.map(k => labels[k] || k).join(', ')}` });
    }
    const updated = await prisma.legalDocument.update({
      where: { id: doc.id },
      data: { status: 'PUBLISHED', approvedBy: req.user?.id, ecpSignedAt: new Date(), ecpStatus: 'signed' },
    });
    await prisma.legalDocumentVersion.create({
      data: { documentId: doc.id, version: doc.version + 1, content: doc.content, status: 'PUBLISHED', changelog: 'Подписан партнёром', createdBy: req.user?.id },
    });
    await writeAuditLog({ documentId: doc.id, action: 'STATUS_CHANGED', fromStatus: doc.status, toStatus: 'PUBLISHED', fromVersion: doc.version, toVersion: doc.version + 1, diff: { signed: true }, performedBy: req.user?.id });
    res.json({ ok: true, data: updated });
  } catch (err) { next(err); }
});

router.get('/partner', async (req: any, res, next) => {
  try {
    const partner = await prisma.legalPartner.findUnique({
      where: { id: req.partner.id },
      select: { id: true, legalName: true, bin: true, director: true, address: true, iban: true, phone: true, email: true, type: true, plan: true },
    });
    res.json({ ok: true, data: partner });
  } catch (err) { next(err); }
});

router.put('/partner', async (req: any, res, next) => {
  try {
    const allowed = ['legalName', 'bin', 'director', 'address', 'iban', 'phone', 'email'];
    const updates: Record<string, any> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    const partner = await prisma.legalPartner.update({ where: { id: req.partner.id }, data: updates });
    res.json({ ok: true, data: partner });
  } catch (err) { next(err); }
});

router.get('/invoices', async (req: any, res, next) => {
  try {
    const invoices = await prisma.legalInvoice.findMany({
      where: { partnerId: req.partner.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ ok: true, data: invoices });
  } catch (err) { next(err); }
});

router.get('/documents/:id/export', async (req: any, res, next) => {
  try {
    const doc = await prisma.legalDocument.findFirst({
      where: { id: req.params.id, partnerId: req.partner.id },
    });
    if (!doc) return res.status(404).json({ ok: false, error: 'Document not found' });
    const format = (req.query.format as string) || 'html';
    if (format === 'html') { res.setHeader('Content-Type', 'text/html'); res.send(doc.content); }
    else if (format === 'json') res.json({ ok: true, data: { templateId: doc.templateId, variables: doc.variables, version: doc.version, exportedAt: new Date().toISOString(), content: doc.content } });
    else res.status(400).json({ ok: false, error: 'Unsupported format' });
  } catch (err) { next(err); }
});

router.get('/history', async (req: any, res, next) => {
  try {
    const logs = await prisma.legalAuditLog.findMany({
      where: { document: { partnerId: req.partner.id } },
      include: { document: { select: { documentNumber: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ ok: true, data: logs });
  } catch (err) { next(err); }
});

export { router as legalPartnerRouter };
