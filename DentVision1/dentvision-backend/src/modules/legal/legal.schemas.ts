import { z } from 'zod';

const templateTypeEnum = z.enum(['CLINIC_AGREEMENT','DIAGNOSTICS_AGREEMENT','LABORATORY_AGREEMENT','MARKETPLACE_AGREEMENT','SUPPLIER_AGREEMENT','LECTURER_AGREEMENT','ACADEMY_AGREEMENT','NDA','PRIVACY_POLICY','TERMS_OF_SERVICE','AI_POLICY','COOKIE_POLICY','DPA','SLA','API_AGREEMENT','REFERRAL_AGREEMENT']);

const partnerTypeEnum = z.enum(['CLINIC','DIAGNOSTIC_CENTER','LABORATORY','SUPPLIER','LECTURER','EDUCATION_CENTER','RESELLER','CORPORATE','MANUFACTURER','DISTRIBUTOR','ACADEMY','OFFICIAL_PARTNER']);

const documentStatusEnum = z.enum(['DRAFT','REVIEW','APPROVED','PUBLISHED','ARCHIVED','EXPIRED','CANCELLED']);

const invoiceStatusEnum = z.enum(['paid','unpaid','partial','refund','pending','overdue']);

export const createBlockSchema = z.object({
  name: z.string().min(2).max(100),
  category: z.string().min(2).max(50),
  content: z.string().min(10),
  variables: z.array(z.string()).default([]),
});

export const updateBlockSchema = createBlockSchema.partial();

export const createTemplateSchema = z.object({
  type: templateTypeEnum,
  name: z.string().min(2).max(200),
  description: z.string().optional(),
  blocks: z.array(z.string()).default([]),
  variables: z.record(z.string()).default({}),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  description: z.string().optional(),
  blocks: z.array(z.string()).optional(),
  variables: z.record(z.string()).optional(),
});

export const createPartnerSchema = z.object({
  userId: z.string().optional(),
  type: partnerTypeEnum,
  legalName: z.string().min(2).max(200),
  bin: z.string().optional(),
  director: z.string().optional(),
  address: z.string().optional(),
  iban: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  commission: z.number().min(0).max(100).optional(),
  plan: z.string().optional(),
  subscriptionId: z.string().optional(),
});

export const createDocumentSchema = z.object({
  templateId: z.string().uuid(),
  partnerId: z.string().uuid(),
  variables: z.record(z.any()).default({}),
  effectiveDate: z.string().optional(),
  expirationDate: z.string().optional(),
  linkedDocs: z.array(z.string()).default([]),
});

export const updateDocumentStatusSchema = z.object({
  status: documentStatusEnum,
  changelog: z.string().optional(),
});

export const createDocumentVersionSchema = z.object({
  content: z.string().min(10),
  changelog: z.string().optional(),
});

export const createInvoiceSchema = z.object({
  partnerId: z.string().uuid(),
  documentId: z.string().uuid().optional(),
  amountKzt: z.string(),
  dueAt: z.string().optional(),
  description: z.string().optional(),
});

export const updateInvoiceStatusSchema = z.object({
  status: invoiceStatusEnum,
});

export const aiExplainSchema = z.object({
  content: z.string().min(10),
  language: z.enum(['ru', 'kz', 'en']).default('ru'),
});

export const aiDiffSchema = z.object({
  v1: z.string().min(10),
  v2: z.string().min(10),
});

export const aiGenerateSchema = z.object({
  type: z.enum(['CLINIC_AGREEMENT','NDA','SLA']),
  partnerName: z.string(),
  partnerType: z.string(),
});

export const aiCheckSchema = z.object({
  content: z.string().min(10),
});
