import prisma from '../../lib/prisma.js';
import { generateDocumentNumber, nextSequenceFromDb } from './legal.number.js';
import { writeAuditLog } from './legal.audit.js';
import { buildPlatformVars } from './legal.constants.js';
import { getPlatformSettings } from './legal.platform-settings.js';

export async function getDashboardStats() {
  const [documents, partners, templates, expiringSoon] = await Promise.all([
    prisma.legalDocument.findMany({ select: { status: true, id: true } }),
    prisma.legalPartner.count(),
    prisma.legalTemplate.count({ where: { versions: { some: { status: 'PUBLISHED' } } } }),
    prisma.legalDocument.count({ where: { expirationDate: { lte: new Date(Date.now() + 30 * 86400000), gte: new Date() } } }),
  ]);
  const byStatus: Record<string, number> = {};
  documents.forEach(d => { byStatus[d.status] = (byStatus[d.status] || 0) + 1; });
  return { totalDocuments: documents.length, byStatus, totalPartners: partners, totalTemplates: templates, expiringSoon };
}

const RE_ANY = /\{\{(\w+)\}\}/g;

export function substituteVariables(content: string, variables: Record<string, any>): string {
  return content.replace(RE_ANY, (_, name) => {
    const val = variables[name];
    return val !== null && val !== undefined ? String(val) : '—';
  });
}

export async function buildDocumentContent(templateId: string, variables: Record<string, any>): Promise<string> {
  const template = await prisma.legalTemplate.findUnique({
    where: { id: templateId },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
  });
  if (!template) throw new Error('Template not found');
  const versionContent = template.versions[0]?.content;
  if (!versionContent) throw new Error('Template has no published version');
  const dbSettings = await getPlatformSettings().catch(() => ({}));
  const merged = { ...buildPlatformVars(), ...dbSettings, ...(template.variables as any), ...variables };
  return substituteVariables(versionContent, merged);
}

export async function createDocumentFromTemplate(templateId: string, partnerId: string, variables: Record<string, any>, createdBy: string, options?: { effectiveDate?: string; expirationDate?: string; linkedDocs?: string[] }) {
  const template = await prisma.legalTemplate.findUnique({ where: { id: templateId } });
  if (!template) throw new Error('Template not found');
  const docNumber = generateDocumentNumber(template.type, await nextSequenceFromDb());
  const content = await buildDocumentContent(templateId, { ...variables, ContractNumber: docNumber, DocumentNumber: docNumber });
  const doc = await prisma.legalDocument.create({
    data: {
      documentNumber: docNumber,
      templateId,
      partnerId,
      content,
      variables,
      effectiveDate: options?.effectiveDate ? new Date(options.effectiveDate) : undefined,
      expirationDate: options?.expirationDate ? new Date(options.expirationDate) : undefined,
      linkedDocs: options?.linkedDocs ?? [],
      createdBy,
    },
  });
  await prisma.legalDocumentVersion.create({
    data: { documentId: doc.id, version: 1, content, status: 'DRAFT', createdBy },
  });
  await writeAuditLog({ documentId: doc.id, action: 'CREATED', toStatus: 'DRAFT', toVersion: 1, performedBy: createdBy });
    return doc;
}

const FORWARD_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['REVIEW'],
  REVIEW: ['APPROVED', 'CANCELLED'],
  APPROVED: ['PUBLISHED'],
  PUBLISHED: ['ARCHIVED', 'EXPIRED'],
  ARCHIVED: [],
  EXPIRED: [],
  CANCELLED: [],
};

export async function changeDocumentStatus(documentId: string, newStatus: string, performedBy: string, changelog?: string) {
  const doc = await prisma.legalDocument.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error('Document not found');
  const allowed = FORWARD_TRANSITIONS[doc.status] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Cannot transition from ${doc.status} to ${newStatus}. Allowed: ${allowed.join(', ')}`);
  }
  const updated = await prisma.legalDocument.update({
    where: { id: documentId },
    data: { status: newStatus as any, approvedBy: ['APPROVED', 'PUBLISHED'].includes(newStatus) ? performedBy : undefined },
  });
  await prisma.legalDocumentVersion.create({
    data: { documentId, version: doc.version + 1, content: doc.content, status: newStatus as any, changelog, createdBy: performedBy },
  });
  await writeAuditLog({ documentId, action: 'STATUS_CHANGED', fromStatus: doc.status, toStatus: newStatus, fromVersion: doc.version, toVersion: doc.version + 1, diff: { status: { from: doc.status, to: newStatus } }, performedBy });
  return updated;
}

const DOCUMENTS_PER_TYPE: Record<string, string[]> = {
  CLINIC: ['CLINIC_AGREEMENT', 'NDA', 'DPA'],
  DIAGNOSTIC_CENTER: ['DIAGNOSTICS_AGREEMENT', 'NDA'],
  LABORATORY: ['LABORATORY_AGREEMENT', 'NDA'],
  SUPPLIER: ['SUPPLIER_AGREEMENT', 'NDA'],
  LECTURER: ['LECTURER_AGREEMENT', 'NDA'],
  EDUCATION_CENTER: ['ACADEMY_AGREEMENT', 'NDA'],
  RESELLER: ['SUPPLIER_AGREEMENT', 'NDA'],
  CORPORATE: ['CLINIC_AGREEMENT', 'NDA'],
};

export async function onboardPartner(data: any, createdBy: string) {
  const partner = await prisma.legalPartner.create({
    data: { ...data, createdBy },
  });
  const prefix = data.type === 'CLINIC' || data.type === 'CORPORATE' ? 'Clinic'
    : data.type === 'SUPPLIER' || data.type === 'RESELLER' ? 'Supplier'
    : data.type === 'DIAGNOSTIC_CENTER' ? 'Diagnostics'
    : data.type === 'LABORATORY' ? 'Laboratory'
    : data.type === 'LECTURER' ? 'Lecturer'
    : 'Partner';
  const vars: Record<string, any> = {
    [`${prefix}Name`]: data.legalName || '',
    [`${prefix}BIN`]: data.bin || '',
    [`${prefix}Director`]: data.director || '',
    [`${prefix}Address`]: data.address || '',
    [`${prefix}IBAN`]: data.iban || '',
    [`${prefix}Phone`]: data.phone || '',
    [`${prefix}Email`]: data.email || '',
    PartnerName: data.legalName || '',
    PartnerBIN: data.bin || '',
    PartnerDirector: data.director || '',
    PartnerAddress: data.address || '',
    PartnerIBAN: data.iban || '',
    PartnerPhone: data.phone || '',
    PartnerEmail: data.email || '',
  };
  if (data.type === 'SUPPLIER' || data.type === 'RESELLER') {
    vars.SupplierDirectorDoc = data.directorDoc || 'Устава';
    vars.SupplierDirectorTitle = data.directorTitle || 'Директор';
    vars.SupplierBank = data.bank || '';
    vars.SupplierBIC = data.bic || '';
    vars.SupplierKBE = data.kbe || '';
  }
  if (data.type === 'CLINIC' || data.type === 'CORPORATE' || data.type === 'DIAGNOSTIC_CENTER') {
    vars.ClinicBank = data.bank || '';
    vars.ClinicBIC = data.bic || '';
    vars.ClinicIBAN = data.iban || '';
    vars.ClinicDirectorTitle = data.directorTitle || 'Директор';
    vars.ClinicLicense = data.license || '';
  }
  vars.Subscription = data.subscription || '';
  vars.CommissionRate = data.commission != null ? Number(data.commission) : 10;
  const types = DOCUMENTS_PER_TYPE[data.type] || [];
  const documents: any[] = [];
  for (const tplType of types) {
    const template = await prisma.legalTemplate.findFirst({
      where: { type: tplType as any },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });
    if (template) {
      const doc = await createDocumentFromTemplate(template.id, partner.id, vars, createdBy);
      documents.push(doc);
    }
  }
  return { partner, documents };
}
