import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { parseTengeToMinor, serializeBigInt } from '../../lib/money.js';
import { getOrCreateWallet } from '../finance/finance.service.js';
import { availableBalanceMinor, requestPayout, PayoutError } from '../finance/payout.service.js';
import { getPartnerEconomicsTransparency } from '../finance/partner-economics.service.js';
import { publish } from '../../lib/events.js';
import { assertClinicOrgAccess } from '../../lib/orgContext.js';
import { resolveClinicAccess as resolveClinicSubscriptionAccess } from '../billing/planEntitlements.js';
import { uid } from '../../lib/helpers.js';
import { ensureDentalLabOrderEventsTable } from './dentalLabOrderEvents.js';
import { hasAcceptedLatestDentalLabDelivery } from './dentalLabAcceptance.js';
import { createNotificationForClinic } from '../../services/notification.service.js';
import { writeAuditLog } from '../compliance/audit.service.js';
import { safeErrorKind } from '../../lib/safeError.js';
import { canLabManageFinance, canLabManageShipment, canLabMemberChangeStatus, canLabMemberReadOrders, isLabLogisticsRole, isLabManagerRole, isLabQualityRole, labMemberOrderReadScope, validateLabQualityControl, validateLabRemakeDecision } from './labPlatform.authorization.js';
import { isLabCoordinatorRole, isLabTechnicianRole } from './labPlatform.authorization.js';
import { calculateMaterialCostMinor, materialConsumptionFingerprint, parseDentalLabMaterialDraft, parseMaterialQuantityMilli } from './dentalLabMaterials.js';

export const labPlatformRouter = Router();
labPlatformRouter.use(authenticate);

type LabMeta = {
  laboratoryId?: string;
  technicianId?: string;
  patientName?: string;
  material?: string;
  toothNumber?: string | number;
  shade?: string;
  remakeOfId?: string;
  appointmentId?: string;
  tryInDate?: string;
  qualityControl?: { checks: Record<string, boolean>; passed: boolean; note: string | null; checkedByUserId: string; checkedAt: string };
  remakeRequest?: { id: string; status: 'requested' | 'accepted' | 'rejected'; reason: string; requestedByUserId: string; requestedAt: string; laboratoryId: string; decidedByUserId?: string; decidedAt?: string; responseNote?: string | null };
  clinicAcceptance?: { status: 'accepted'; acceptedAt: string; shipmentId: string; remakeRequestId?: string | null; note?: string | null } | null;
  clinicAcceptanceHistory?: Array<{ status: 'accepted'; acceptedAt: string; shipmentId: string; remakeRequestId?: string | null; note?: string | null }>;
  payment?: Prisma.InputJsonValue;
};

const STATUS_FLOW: Record<string, string[]> = {
  pending: ['sent', 'cancelled'],
  sent: ['in_progress', 'delayed', 'cancelled'],
  in_progress: ['try_in', 'adjustment', 'qc', 'remake', 'delayed', 'cancelled'],
  try_in: ['adjustment', 'qc', 'remake'],
  adjustment: ['try_in', 'qc', 'remake'],
  // QC outcome must be recorded only through the manager-only /qc endpoint.
  qc: [],
  ready: [],
  delivered: [],
  remake: ['in_progress', 'delayed', 'cancelled'],
  delayed: ['in_progress', 'cancelled'],
  cancelled: [],
};

async function requireClinicAssignmentWritable(req: AuthRequest, res: any, clinicId: string): Promise<boolean> {
  if (!req.user?.id || !(await assertClinicOrgAccess(req.user, clinicId))) {
    res.status(403).json({ ok: false, error: 'Нет доступа к этой клинике' });
    return false;
  }
  try {
    const access = await resolveClinicSubscriptionAccess(clinicId);
    if (!access) {
      res.status(404).json({ ok: false, error: 'Клиника не найдена', code: 'CLINIC_ACCESS_UNVERIFIED' });
      return false;
    }
    if (access.writeBlocked) {
      res.status(402).json({
        ok: false,
        error: 'Срок подписки клиники завершён. Передача новых заказов в лабораторию доступна после продления.',
        code: 'SUBSCRIPTION_EXPIRED',
        data: { upgradePath: '/crm/billing' },
      });
      return false;
    }
    return true;
  } catch (error) {
    console.error('[LabPlatform] clinic assignment subscription guard failed:', safeErrorKind(error));
    res.status(503).json({
      ok: false,
      error: 'Не удалось проверить подписку клиники',
      code: 'CLINIC_ACCESS_UNVERIFIED',
    });
    return false;
  }
}

function branchScopedClinicLabOrder(req: AuthRequest): Record<string, unknown> {
  const role = String(req.user?.role || '').toUpperCase();
  if (['SUPERADMIN', 'OWNER', 'ADMIN'].includes(role)) return {};
  const branchIds = (req.user?.branchIds ?? []).filter(Boolean);
  return branchIds.length > 0
    ? { patient: { branchId: { in: branchIds } } }
    : { patient: { branchId: '__NO_BRANCH_ACCESS__' } };
}

async function resolveLab(req: AuthRequest) {
  const user = req.user;
  const labId = user?.organizationOriginalId || user?.organizationId;
  if (!user?.id || user.organizationType !== 'LABORATORY' || !labId) return null;
  const membership = await prisma.laboratoryMember.findFirst({ where: { labId, userId: user.id }, include: { lab: true } });
  return membership || null;
}

function metaOf(files: unknown): LabMeta {
  const raw = files as { meta?: LabMeta } | null;
  return raw?.meta && typeof raw.meta === 'object' ? raw.meta : {};
}

function isVerifiedDentalLabSettings(value: unknown): boolean {
  const settings = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const legal = settings.legal && typeof settings.legal === 'object' && !Array.isArray(settings.legal)
    ? settings.legal as Record<string, unknown>
    : {};
  return settings.laboratoryType === 'DENTAL_LAB'
    && settings.selfServiceType === 'dental_lab'
    && settings.lifecycle === 'ACTIVE'
    && settings.verification === 'VERIFIED'
    && settings.ecosystemVisible === true
    && legal.status === 'READY';
}

async function appendEventInTransaction(
  tx: Prisma.TransactionClient,
  order: { id: string; clinicId: string },
  fromStatus: string | null,
  toStatus: string,
  actorUserId: string,
  note?: string,
) {
  await tx.$executeRawUnsafe(
    `INSERT INTO "dental_lab_order_events" ("id","labOrderId","clinicId","fromStatus","toStatus","note","actorUserId","createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_TIMESTAMP)`,
    uid(), order.id, order.clinicId, fromStatus, toStatus, note ?? null, actorUserId,
  );
}

function serialize(order: any, options: { includeClinicAcceptanceNote?: boolean } = {}) {
  const meta = metaOf(order.files);
  const clinicAcceptance = meta.clinicAcceptance && typeof meta.clinicAcceptance === 'object'
    ? {
        status: meta.clinicAcceptance.status,
        acceptedAt: meta.clinicAcceptance.acceptedAt,
        shipmentId: meta.clinicAcceptance.shipmentId,
        remakeRequestId: meta.clinicAcceptance.remakeRequestId || null,
        ...(options.includeClinicAcceptanceNote ? { note: meta.clinicAcceptance.note || null } : {}),
      }
    : null;
  const clinicAcceptanceHistory = Array.isArray(meta.clinicAcceptanceHistory)
    ? meta.clinicAcceptanceHistory.map((entry) => ({
        status: entry.status,
        acceptedAt: entry.acceptedAt,
        shipmentId: entry.shipmentId,
        remakeRequestId: entry.remakeRequestId || null,
        ...(options.includeClinicAcceptanceNote ? { note: entry.note || null } : {}),
      }))
    : [];
  return {
    id: order.id, clinicId: order.clinicId, clinicName: order.clinic?.name || '', patientId: order.patientId,
    patientName: order.patient?.firstName ? `${order.patient.firstName} ${order.patient.lastName}`.trim() : (meta.patientName || ''),
    doctorId: order.doctorId || null, type: order.type || '', material: meta.material || '', toothNumber: meta.toothNumber || '',
    shade: meta.shade || '', notes: order.notes || '', deadline: order.deadline, price: order.price, status: order.status,
    technicianId: meta.technicianId || null, remakeOfId: meta.remakeOfId || null, appointmentId: meta.appointmentId || null,
    qualityControl: meta.qualityControl || null,
    remakeRequest: meta.remakeRequest || null,
    clinicAcceptance,
    clinicAcceptanceHistory,
    payment: meta.payment || null,
    invoice: order.dentalLabInvoice ? {
      id: order.dentalLabInvoice.id,
      invoiceNumber: order.dentalLabInvoice.invoiceNumber,
      amountMinor: order.dentalLabInvoice.amountMinor.toString(),
      refundedMinor: order.dentalLabInvoice.refundedMinor.toString(),
      currency: order.dentalLabInvoice.currency,
      status: order.dentalLabInvoice.status,
      issuedAt: order.dentalLabInvoice.issuedAt,
      paidAt: order.dentalLabInvoice.paidAt,
      paymentId: order.dentalLabInvoice.paymentId,
    } : null,
    serviceId: order.serviceId || null,
    serviceName: order.serviceNameSnapshot || null,
    servicePriceSnapshot: order.servicePriceSnapshot ?? null,
    shipment: Array.isArray(order.dentalLabShipments) ? order.dentalLabShipments[0] ?? null : null,
    treatmentCaseId: (order as any).treatmentCaseId ?? null,
    createdAt: order.createdAt, updatedAt: order.updatedAt,
  };
}

async function caseIdOf(orderId: string): Promise<string | null> {
  const rows = await prisma.$queryRawUnsafe<{ treatmentCaseId: string | null }[]>(`SELECT "treatmentCaseId" FROM "lab_orders" WHERE "id"=$1 LIMIT 1`, orderId);
  return rows[0]?.treatmentCaseId ?? null;
}

async function ordersForLab(labId: string, role: string, userId: string, status?: string, branchIds: readonly string[] = []) {
  const logisticsOnly = isLabLogisticsRole(role);
  const readScope = logisticsOnly
    ? { files: { path: ['meta', 'laboratoryId'], equals: labId } }
    : labMemberOrderReadScope({ role, userId, labId, branchIds });
  if (!readScope) return null;
  const logisticsStatuses = ['ready', 'delivered'];
  if (logisticsOnly && status && !logisticsStatuses.includes(status)) return [];
  const rows = await prisma.labOrder.findMany({
    where: {
      ...(status ? { status: status as any } : logisticsOnly ? { status: { in: logisticsStatuses as any } } : {}),
      ...readScope,
    },
    include: { patient: { select: { firstName: true, lastName: true, branchId: true } }, clinic: { select: { id: true, name: true } }, dentalLabShipments: { orderBy: { createdAt: 'desc' }, take: 1 }, dentalLabInvoice: true },
    orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }], take: 500,
  });
  return Promise.all(rows.map(async (order) => {
    const result = serialize(
      { ...order, treatmentCaseId: await caseIdOf(order.id) },
      { includeClinicAcceptanceNote: !logisticsOnly },
    );
    if (!logisticsOnly) return result;
    // A courier needs the handoff and recipient context, not clinical identifiers or treatment details.
    return {
      ...result,
      patientId: null,
      patientName: '',
      doctorId: null,
      type: 'Заказ лаборатории',
      material: '',
      serviceId: null,
      serviceName: null,
      toothNumber: '',
      shade: '',
      notes: '',
      technicianId: null,
      qualityControl: null,
      remakeRequest: null,
      payment: null,
      invoice: null,
      servicePriceSnapshot: null,
      price: null,
    };
  }));
}

labPlatformRouter.get('/available-laboratories', requirePermission('appointment.write'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId || !(await assertClinicOrgAccess(req.user!, clinicId))) {
      return res.status(403).json({ ok: false, error: 'Нет доступа к выбранной клинике' } satisfies ApiResponse);
    }
    const organizations = await prisma.organization.findMany({
      where: { type: 'LABORATORY', originalType: 'Laboratory', archivedAt: null },
      select: { originalId: true, settings: true },
    });
    const eligibleIds = organizations
      .filter((organization) => organization.originalId && isVerifiedDentalLabSettings(organization.settings))
      .map((organization) => organization.originalId as string);
    if (eligibleIds.length === 0) return res.json({ ok: true, data: [] } satisfies ApiResponse);
    const laboratories = await prisma.laboratory.findMany({
      where: { id: { in: eligibleIds }, active: true },
      select: { id: true, name: true, city: true, address: true, phone: true, rating: true },
      orderBy: [{ rating: 'desc' }, { name: 'asc' }],
    });
    return res.json({ ok: true, data: laboratories } satisfies ApiResponse);
  } catch (error) {
    console.error('[LabPlatform] available laboratories error:', safeErrorKind(error));
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить список зуботехнических лабораторий' } satisfies ApiResponse);
  }
});


const DENTAL_LAB_SERVICE_CATEGORIES = new Set(['crown', 'bridge', 'veneer', 'implant', 'denture', 'nightguard', 'wax', 'other']);
function parseDentalLabService(input: any, partial = false): Record<string, unknown> | null {
  const value: Record<string, unknown> = {};
  if (!partial || 'code' in (input || {})) {
    const code = String(input?.code || '').trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(code)) return null;
    value.code = code;
  }
  if (!partial || 'name' in (input || {})) {
    const name = String(input?.name || '').trim();
    if (name.length < 2 || name.length > 120) return null;
    value.name = name;
  }
  if (!partial || 'category' in (input || {})) {
    const category = String(input?.category || '').trim().toLowerCase();
    if (!DENTAL_LAB_SERVICE_CATEGORIES.has(category)) return null;
    value.category = category;
  }
  if ('description' in (input || {})) {
    const description = String(input?.description || '').trim();
    if (description.length > 1500) return null;
    value.description = description || null;
  }
  if ('material' in (input || {})) {
    const material = String(input?.material || '').trim();
    if (material.length > 80) return null;
    value.material = material || null;
  }
  if (!partial || 'defaultPrice' in (input || {})) {
    const price = Number(input?.defaultPrice);
    if (!Number.isSafeInteger(price) || price <= 0 || price > 100_000_000) return null;
    value.defaultPrice = price;
  }
  if ('turnaroundDays' in (input || {}) || !partial) {
    const days = input?.turnaroundDays === undefined ? 5 : Number(input.turnaroundDays);
    if (!Number.isInteger(days) || days < 1 || days > 365) return null;
    value.turnaroundDays = days;
  }
  if ('active' in (input || {})) {
    if (typeof input.active !== 'boolean') return null;
    value.active = input.active;
  }
  return value;
}

/** Public to an authenticated clinic that may assign a verified lab partner. */
labPlatformRouter.get('/available-laboratories/:id/services', requirePermission('appointment.write'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId || !(await assertClinicOrgAccess(req.user!, clinicId))) {
      return res.status(403).json({ ok: false, error: 'Нет доступа к выбранной клинике' } satisfies ApiResponse);
    }
    const labId = String(req.params.id);
    const lab = await prisma.laboratory.findFirst({ where: { id: labId, active: true }, select: { id: true } });
    if (!lab) return res.status(404).json({ ok: false, error: 'Зуботехническая лаборатория не найдена' } satisfies ApiResponse);
    const organization = await prisma.organization.findFirst({
      where: { type: 'LABORATORY', originalType: 'Laboratory', originalId: lab.id, archivedAt: null },
      select: { settings: true },
    });
    if (!organization || !isVerifiedDentalLabSettings(organization.settings)) {
      return res.status(404).json({ ok: false, error: 'Каталог доступен только проверенным опубликованным лабораториям' } satisfies ApiResponse);
    }
    const services = await prisma.dentalLabService.findMany({
      where: { labId, active: true },
      select: { id: true, code: true, name: true, category: true, description: true, material: true, defaultPrice: true, turnaroundDays: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    return res.json({ ok: true, data: services } satisfies ApiResponse);
  } catch {
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить каталог услуг лаборатории' } satisfies ApiResponse);
  }
});

labPlatformRouter.get('/services', async (req: AuthRequest, res) => {
  try {
    const membership = await resolveLab(req);
    if (!membership || !canLabMemberReadOrders(membership.role) || isLabLogisticsRole(membership.role)) {
      return res.status(403).json({ ok: false, error: 'Каталог услуг доступен производственным и управляющим ролям лаборатории' } satisfies ApiResponse);
    }
    const services = await prisma.dentalLabService.findMany({
      where: { labId: membership.labId, ...(isLabManagerRole(membership.role) ? {} : { active: true }) },
      orderBy: [{ active: 'desc' }, { category: 'asc' }, { name: 'asc' }],
    });
    return res.json({ ok: true, data: services } satisfies ApiResponse);
  } catch {
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить каталог услуг' } satisfies ApiResponse);
  }
});

labPlatformRouter.post('/services', async (req: AuthRequest, res) => {
  try {
    const membership = await resolveLab(req);
    if (!membership || !isLabManagerRole(membership.role)) {
      return res.status(403).json({ ok: false, error: 'Каталог услуг управляется владельцем или менеджером лаборатории' } satisfies ApiResponse);
    }
    const data = parseDentalLabService(req.body);
    if (!data) return res.status(400).json({ ok: false, error: 'Проверьте код, название, категорию, цену и срок выполнения услуги' } satisfies ApiResponse);
    const service = await prisma.dentalLabService.create({
      data: { id: uid(), labId: membership.labId, ...(data as any) },
    });
    return res.status(201).json({ ok: true, data: service } satisfies ApiResponse);
  } catch (error: any) {
    if (String(error?.code || '') === 'P2002') return res.status(409).json({ ok: false, error: 'Код услуги уже используется в этой лаборатории' } satisfies ApiResponse);
    return res.status(400).json({ ok: false, error: 'Не удалось создать услугу' } satisfies ApiResponse);
  }
});

labPlatformRouter.patch('/services/:id', async (req: AuthRequest, res) => {
  try {
    const membership = await resolveLab(req);
    if (!membership || !isLabManagerRole(membership.role)) {
      return res.status(403).json({ ok: false, error: 'Изменять цены может только владелец или менеджер лаборатории' } satisfies ApiResponse);
    }
    const patch = parseDentalLabService(req.body, true);
    if (!patch || Object.keys(patch).length === 0) {
      return res.status(400).json({ ok: false, error: 'Нет допустимых полей для изменения услуги' } satisfies ApiResponse);
    }
    const existing = await prisma.dentalLabService.findFirst({
      where: { id: String(req.params.id), labId: membership.labId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ ok: false, error: 'Услуга не найдена в этой лаборатории' } satisfies ApiResponse);
    const service = await prisma.dentalLabService.update({ where: { id: existing.id }, data: patch as any });
    return res.json({ ok: true, data: service } satisfies ApiResponse);
  } catch (error: any) {
    if (String(error?.code || '') === 'P2002') return res.status(409).json({ ok: false, error: 'Код услуги уже используется в этой лаборатории' } satisfies ApiResponse);
    return res.status(400).json({ ok: false, error: 'Не удалось изменить услугу' } satisfies ApiResponse);
  }
});

const MATERIAL_LOT_NUMBER = /^[A-Za-z0-9][A-Za-z0-9._/-]{1,79}$/;

function canReadDentalLabMaterials(role: unknown): boolean {
  return isLabManagerRole(role)
    || isLabTechnicianRole(role)
    || isLabCoordinatorRole(role)
    || isLabQualityRole(role);
}

function validMaterialNote(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > 500) return null;
  return value.trim() || null;
}

labPlatformRouter.get('/materials', async (req: AuthRequest, res) => {
  try {
    const membership = await resolveLab(req);
    if (!membership || !canReadDentalLabMaterials(membership.role) || isLabLogisticsRole(membership.role)) {
      return res.status(403).json({ ok: false, error: 'Материалы доступны производственным и управляющим ролям лаборатории' } satisfies ApiResponse);
    }
    const manager = isLabManagerRole(membership.role);
    const materials = await prisma.dentalLabMaterial.findMany({
      where: { labId: membership.labId, ...(manager ? {} : { active: true }) },
      include: {
        lots: {
          where: { remainingQuantityMilli: { gt: 0n } },
          orderBy: [{ expiresAt: 'asc' }, { receivedAt: 'asc' }],
          take: 200,
        },
      },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
    const now = Date.now();
    const data = materials.map((material) => {
      const availableLots = material.lots.filter((lot) => !lot.expiresAt || lot.expiresAt.getTime() > now);
      const availableStockMilli = availableLots.reduce((total, lot) => total + lot.remainingQuantityMilli, 0n);
      return {
        id: material.id,
        code: material.code,
        name: material.name,
        category: material.category,
        unit: material.unit,
        minimumStockMilli: material.minimumStockMilli.toString(),
        availableStockMilli: availableStockMilli.toString(),
        active: material.active,
        lots: material.lots.map((lot) => ({
          id: lot.id,
          lotNumber: lot.lotNumber,
          supplierName: lot.supplierName,
          supplierLotNumber: lot.supplierLotNumber,
          remainingQuantityMilli: lot.remainingQuantityMilli.toString(),
          receivedQuantityMilli: lot.receivedQuantityMilli.toString(),
          ...(manager ? { unitCostMinor: lot.unitCostMinor.toString(), currency: lot.currency } : {}),
          receivedAt: lot.receivedAt,
          expiresAt: lot.expiresAt,
          expired: Boolean(lot.expiresAt && lot.expiresAt.getTime() <= now),
        })),
        createdAt: material.createdAt,
        updatedAt: material.updatedAt,
      };
    });
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (error) {
    console.error('[LabPlatform] material catalogue read error:', safeErrorKind(error));
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить материалы лаборатории' } satisfies ApiResponse);
  }
});

labPlatformRouter.post('/materials', async (req: AuthRequest, res) => {
  try {
    const membership = await resolveLab(req);
    if (!membership || !isLabManagerRole(membership.role)) {
      return res.status(403).json({ ok: false, error: 'Каталог материалов управляется владельцем или менеджером лаборатории' } satisfies ApiResponse);
    }
    const draft = parseDentalLabMaterialDraft(req.body);
    if (!draft) return res.status(400).json({ ok: false, error: 'Проверьте код, название, категорию, единицу и минимальный остаток материала' } satisfies ApiResponse);
    const material = await prisma.dentalLabMaterial.create({
      data: { id: uid(), labId: membership.labId, ...draft },
    });
    await writeAuditLog({
      action: 'DENTAL_LAB_MATERIAL_CREATED',
      entity: 'dental_lab_material',
      entityId: material.id,
      details: { laboratoryId: membership.labId, code: material.code, unit: material.unit },
      userId: req.user!.id,
    });
    return res.status(201).json({ ok: true, data: serializeBigInt(material) } satisfies ApiResponse);
  } catch (error: any) {
    if (String(error?.code || '') === 'P2002') return res.status(409).json({ ok: false, error: 'Код материала уже используется в этой лаборатории' } satisfies ApiResponse);
    console.error('[LabPlatform] material create error:', safeErrorKind(error));
    return res.status(400).json({ ok: false, error: 'Не удалось создать материал' } satisfies ApiResponse);
  }
});

labPlatformRouter.post('/materials/:id/lots', async (req: AuthRequest, res) => {
  try {
    const membership = await resolveLab(req);
    if (!membership || !isLabManagerRole(membership.role)) {
      return res.status(403).json({ ok: false, error: 'Приход материалов доступен владельцу или менеджеру лаборатории' } satisfies ApiResponse);
    }
    const materialId = String(req.params.id || '');
    const lotNumber = String(req.body?.lotNumber || '').trim();
    const receivedQuantityMilli = parseMaterialQuantityMilli(req.body?.quantity);
    const rawUnitCost = req.body?.unitCost;
    const supplierName = typeof req.body?.supplierName === 'string' ? req.body.supplierName.trim() : '';
    const supplierLotNumber = typeof req.body?.supplierLotNumber === 'string' ? req.body.supplierLotNumber.trim() : '';
    const note = validMaterialNote(req.body?.note);
    let unitCostMinor: bigint;
    try {
      unitCostMinor = parseTengeToMinor(rawUnitCost);
    } catch {
      return res.status(400).json({ ok: false, error: 'Укажите закупочную стоимость за базовую единицу в тенге' } satisfies ApiResponse);
    }
    if (!MATERIAL_LOT_NUMBER.test(lotNumber)
      || receivedQuantityMilli === null
      || unitCostMinor < 0n
      || (req.body?.supplierName !== undefined && supplierName.length > 120)
      || (req.body?.supplierLotNumber !== undefined && supplierLotNumber.length > 120)
      || (req.body?.note !== undefined && req.body?.note !== null && req.body?.note !== '' && note === null)) {
      return res.status(400).json({ ok: false, error: 'Проверьте номер партии, количество, закупочную цену и данные поставщика' } satisfies ApiResponse);
    }
    let expiresAt: Date | null = null;
    if (req.body?.expiresAt !== undefined && req.body?.expiresAt !== null && req.body?.expiresAt !== '') {
      const expiryDateInput = String(req.body.expiresAt).trim();
      const validDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(expiryDateInput);
      expiresAt = validDateOnly ? new Date(`${expiryDateInput}T23:59:59.999Z`) : new Date(Number.NaN);
      if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
        return res.status(400).json({ ok: false, error: 'Срок годности партии должен быть корректной будущей датой' } satisfies ApiResponse);
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const material = await tx.dentalLabMaterial.findFirst({
        where: { id: materialId, labId: membership.labId, active: true },
        select: { id: true },
      });
      if (!material) return null;
      return tx.dentalLabMaterialLot.create({
        data: {
          id: uid(),
          labId: membership.labId,
          materialId: material.id,
          lotNumber,
          supplierName: supplierName || null,
          supplierLotNumber: supplierLotNumber || null,
          receivedQuantityMilli,
          remainingQuantityMilli: receivedQuantityMilli,
          unitCostMinor,
          currency: 'KZT',
          receivedAt: new Date(),
          expiresAt,
          receivedByUserId: req.user!.id,
          note,
        },
      });
    });
    if (!created) return res.status(404).json({ ok: false, error: 'Активный материал не найден в этой лаборатории' } satisfies ApiResponse);
    await writeAuditLog({
      action: 'DENTAL_LAB_MATERIAL_LOT_RECEIVED',
      entity: 'dental_lab_material_lot',
      entityId: created.id,
      details: { laboratoryId: membership.labId, materialId, lotNumber, receivedQuantityMilli: receivedQuantityMilli.toString() },
      userId: req.user!.id,
    });
    return res.status(201).json({ ok: true, data: serializeBigInt(created) } satisfies ApiResponse);
  } catch (error: any) {
    if (String(error?.code || '') === 'P2002') return res.status(409).json({ ok: false, error: 'Такая партия уже зарегистрирована для этого материала' } satisfies ApiResponse);
    console.error('[LabPlatform] material lot receipt error:', safeErrorKind(error));
    return res.status(400).json({ ok: false, error: 'Не удалось зарегистрировать приход партии' } satisfies ApiResponse);
  }
});

labPlatformRouter.get('/orders/:id/material-consumptions', async (req: AuthRequest, res) => {
  try {
    const membership = await resolveLab(req);
    if (!membership || !canReadDentalLabMaterials(membership.role) || isLabLogisticsRole(membership.role)) {
      return res.status(403).json({ ok: false, error: 'Нет доступа к учёту материалов заказа' } satisfies ApiResponse);
    }
    const readScope = labMemberOrderReadScope({
      role: membership.role,
      userId: req.user!.id,
      labId: membership.labId,
      branchIds: req.user?.branchIds || [],
    });
    if (!readScope) return res.status(403).json({ ok: false, error: 'Нет доступа к этому заказу' } satisfies ApiResponse);
    const order = await prisma.labOrder.findFirst({
      where: { id: String(req.params.id), ...readScope },
      select: { id: true, files: true },
    });
    if (!order || metaOf(order.files).laboratoryId !== membership.labId) {
      return res.status(404).json({ ok: false, error: 'Заказ не найден в этой лаборатории' } satisfies ApiResponse);
    }
    const rows = await prisma.dentalLabCaseMaterial.findMany({
      where: { labId: membership.labId, labOrderId: order.id },
      include: {
        material: { select: { code: true, name: true, unit: true } },
        lot: { select: { lotNumber: true, supplierName: true, expiresAt: true } },
      },
      orderBy: { consumedAt: 'asc' },
    });
    const manager = isLabManagerRole(membership.role);
    const data = rows.map((row) => ({
      id: row.id,
      material: row.material,
      lot: row.lot,
      quantityMilli: row.quantityMilli.toString(),
      ...(manager ? {
        unitCostMinorSnapshot: row.unitCostMinorSnapshot.toString(),
        totalCostMinorSnapshot: row.totalCostMinorSnapshot.toString(),
      } : {}),
      consumedByUserId: row.consumedByUserId,
      consumedAt: row.consumedAt,
      note: row.note,
      reversedAt: row.reversedAt,
      reversedByUserId: row.reversedByUserId,
      reversalReason: row.reversalReason,
    }));
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (error) {
    console.error('[LabPlatform] material consumption history error:', safeErrorKind(error));
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить историю материалов заказа' } satisfies ApiResponse);
  }
});

labPlatformRouter.post('/orders/:id/material-consumptions', async (req: AuthRequest, res) => {
  try {
    const membership = await resolveLab(req);
    if (!membership || (!isLabManagerRole(membership.role) && !isLabTechnicianRole(membership.role))) {
      return res.status(403).json({ ok: false, error: 'Списание материалов доступно менеджеру или производственному технику лаборатории' } satisfies ApiResponse);
    }
    const orderId = String(req.params.id || '');
    const materialId = String(req.body?.materialId || '');
    const lotId = String(req.body?.lotId || '');
    const idempotencyKey = String(req.body?.idempotencyKey || '').trim();
    const quantityMilli = parseMaterialQuantityMilli(req.body?.quantity);
    const note = validMaterialNote(req.body?.note);
    if (!orderId || !materialId || !lotId || idempotencyKey.length < 8 || idempotencyKey.length > 120
      || quantityMilli === null
      || (req.body?.note !== undefined && req.body?.note !== null && req.body?.note !== '' && note === null)) {
      return res.status(400).json({ ok: false, error: 'Укажите заказ, материал, партию, положительное количество и ключ операции' } satisfies ApiResponse);
    }
    const readScope = labMemberOrderReadScope({
      role: membership.role,
      userId: req.user!.id,
      labId: membership.labId,
      branchIds: req.user?.branchIds || [],
    });
    if (!readScope) return res.status(403).json({ ok: false, error: 'Нет доступа к этому заказу' } satisfies ApiResponse);
    const fingerprint = materialConsumptionFingerprint({ labOrderId: orderId, materialId, lotId, quantityMilli, note });
    const outcome = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "lab_orders" WHERE "id"=${orderId} FOR UPDATE`;
      const order = await tx.labOrder.findFirst({
        where: { id: orderId, ...readScope },
        select: { id: true, clinicId: true, status: true, files: true },
      });
      if (!order || metaOf(order.files).laboratoryId !== membership.labId) return { kind: 'not_found' as const };
      if (!['in_progress', 'try_in', 'adjustment', 'remake'].includes(order.status)) return { kind: 'invalid_status' as const };
      const meta = metaOf(order.files);
      if (isLabTechnicianRole(membership.role) && meta.technicianId !== req.user!.id) return { kind: 'not_found' as const };

      const prior = await tx.dentalLabCaseMaterial.findUnique({
        where: { labId_idempotencyKey: { labId: membership.labId, idempotencyKey } },
      });
      if (prior) {
        return prior.payloadFingerprint === fingerprint
          ? { kind: 'idempotent' as const, consumption: prior }
          : { kind: 'idempotency_conflict' as const };
      }

      const lots = await tx.$queryRaw<Array<{
        id: string;
        materialId: string;
        remainingQuantityMilli: bigint;
        unitCostMinor: bigint;
        expiresAt: Date | null;
      }>>`SELECT "id", "materialId", "remainingQuantityMilli", "unitCostMinor", "expiresAt"
        FROM "dental_lab_material_lots"
        WHERE "id"=${lotId} AND "labId"=${membership.labId} AND "materialId"=${materialId}
        FOR UPDATE`;
      const lot = lots[0];
      if (!lot) return { kind: 'lot_not_found' as const };
      if (lot.expiresAt && lot.expiresAt.getTime() <= Date.now()) return { kind: 'lot_expired' as const };
      if (lot.remainingQuantityMilli < quantityMilli) return { kind: 'insufficient_stock' as const };
      const material = await tx.dentalLabMaterial.findFirst({
        where: { id: materialId, labId: membership.labId, active: true },
        select: { id: true, name: true, unit: true },
      });
      if (!material) return { kind: 'material_not_found' as const };

      const decremented = await tx.dentalLabMaterialLot.updateMany({
        where: {
          id: lot.id,
          labId: membership.labId,
          materialId,
          remainingQuantityMilli: { gte: quantityMilli },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        data: { remainingQuantityMilli: { decrement: quantityMilli } },
      });
      if (decremented.count !== 1) return { kind: 'insufficient_stock' as const };

      const totalCostMinorSnapshot = calculateMaterialCostMinor(quantityMilli, lot.unitCostMinor);
      const consumption = await tx.dentalLabCaseMaterial.create({
        data: {
          id: uid(),
          labId: membership.labId,
          labOrderId: order.id,
          materialId,
          lotId,
          quantityMilli,
          unitCostMinorSnapshot: lot.unitCostMinor,
          totalCostMinorSnapshot,
          idempotencyKey,
          payloadFingerprint: fingerprint,
          consumedByUserId: req.user!.id,
          note,
        },
        include: { material: { select: { name: true, unit: true } }, lot: { select: { lotNumber: true } } },
      });
      await appendEventInTransaction(tx, order, order.status, order.status, req.user!.id, `Материал ${material.name}: ${quantityMilli.toString()} milliunit списано из партии ${lotId.slice(0, 8)}`);
      await writeAuditLog({
        action: 'DENTAL_LAB_MATERIAL_CONSUMED',
        entity: 'dental_lab_case_material',
        entityId: consumption.id,
        details: { laboratoryId: membership.labId, labOrderId: order.id, materialId, lotId, quantityMilli: quantityMilli.toString(), totalCostMinorSnapshot: totalCostMinorSnapshot.toString() },
        userId: req.user!.id,
        clinicId: order.clinicId,
      }, tx);
      return { kind: 'created' as const, consumption };
    }, { isolationLevel: 'Serializable' });

    if (outcome.kind === 'not_found' || outcome.kind === 'lot_not_found' || outcome.kind === 'material_not_found') {
      return res.status(404).json({ ok: false, error: 'Материал, партия или заказ не найдены в этой лаборатории' } satisfies ApiResponse);
    }
    if (outcome.kind === 'invalid_status') return res.status(409).json({ ok: false, error: 'Списание возможно только во время производства или переделки', code: 'LAB_MATERIAL_ORDER_NOT_IN_PRODUCTION' } satisfies ApiResponse);
    if (outcome.kind === 'lot_expired') return res.status(409).json({ ok: false, error: 'Срок годности партии истёк', code: 'LAB_MATERIAL_LOT_EXPIRED' } satisfies ApiResponse);
    if (outcome.kind === 'insufficient_stock') return res.status(409).json({ ok: false, error: 'Недостаточно остатка в выбранной партии', code: 'LAB_MATERIAL_INSUFFICIENT_STOCK' } satisfies ApiResponse);
    if (outcome.kind === 'idempotency_conflict') return res.status(409).json({ ok: false, error: 'Ключ операции уже использован для другого списания', code: 'LAB_MATERIAL_IDEMPOTENCY_CONFLICT' } satisfies ApiResponse);
    if (outcome.kind === 'idempotent') return res.json({ ok: true, data: serializeBigInt(outcome.consumption), idempotent: true } satisfies ApiResponse);
    return res.status(201).json({ ok: true, data: serializeBigInt(outcome.consumption) } satisfies ApiResponse);
  } catch (error: any) {
    if (String(error?.code || '') === 'P2002') {
      const membership = await resolveLab(req);
      const key = String(req.body?.idempotencyKey || '').trim();
      if (membership && key) {
        const existing = await prisma.dentalLabCaseMaterial.findUnique({
          where: { labId_idempotencyKey: { labId: membership.labId, idempotencyKey: key } },
        }).catch(() => null);
        const quantityMilli = parseMaterialQuantityMilli(req.body?.quantity);
        const fingerprint = quantityMilli === null ? '' : materialConsumptionFingerprint({
          labOrderId: String(req.params.id || ''),
          materialId: String(req.body?.materialId || ''),
          lotId: String(req.body?.lotId || ''),
          quantityMilli,
          note: validMaterialNote(req.body?.note),
        });
        if (existing && existing.payloadFingerprint === fingerprint) {
          return res.json({ ok: true, data: serializeBigInt(existing), idempotent: true } satisfies ApiResponse);
        }
        if (existing) return res.status(409).json({ ok: false, error: 'Ключ операции уже использован для другого списания', code: 'LAB_MATERIAL_IDEMPOTENCY_CONFLICT' } satisfies ApiResponse);
      }
    }
    console.error('[LabPlatform] material consumption error:', safeErrorKind(error));
    return res.status(500).json({ ok: false, error: 'Не удалось списать материал на заказ' } satisfies ApiResponse);
  }
});

labPlatformRouter.post('/orders/:id/material-consumptions/:consumptionId/reversal', async (req: AuthRequest, res) => {
  try {
    const membership = await resolveLab(req);
    if (!membership || !isLabManagerRole(membership.role)) {
      return res.status(403).json({ ok: false, error: 'Возврат списанного материала доступен владельцу или менеджеру лаборатории' } satisfies ApiResponse);
    }
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (reason.length < 10 || reason.length > 2000) {
      return res.status(400).json({ ok: false, error: 'Причина возврата материала должна содержать от 10 до 2000 символов' } satisfies ApiResponse);
    }
    const outcome = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{
        id: string;
        labOrderId: string;
        lotId: string;
        quantityMilli: bigint;
        reversedAt: Date | null;
        reversalReason: string | null;
      }>>`SELECT "id", "labOrderId", "lotId", "quantityMilli", "reversedAt", "reversalReason"
        FROM "dental_lab_case_materials"
        WHERE "id"=${String(req.params.consumptionId)} AND "labId"=${membership.labId}
        FOR UPDATE`;
      const row = rows[0];
      if (!row || row.labOrderId !== String(req.params.id)) return { kind: 'not_found' as const };
      if (row.reversedAt) return { kind: row.reversalReason === reason ? 'idempotent' as const : 'already_reversed' as const };
      const lotRows = await tx.$queryRaw<Array<{ id: string; remainingQuantityMilli: bigint; receivedQuantityMilli: bigint }>>`SELECT "id", "remainingQuantityMilli", "receivedQuantityMilli"
        FROM "dental_lab_material_lots"
        WHERE "id"=${row.lotId} AND "labId"=${membership.labId}
        FOR UPDATE`;
      const lot = lotRows[0];
      if (!lot) return { kind: 'lot_not_found' as const };
      if (lot.remainingQuantityMilli + row.quantityMilli > lot.receivedQuantityMilli) {
        return { kind: 'stock_integrity_error' as const };
      }
      await tx.dentalLabMaterialLot.update({
        where: { id: lot.id },
        data: { remainingQuantityMilli: { increment: row.quantityMilli } },
      });
      const updated = await tx.dentalLabCaseMaterial.update({
        where: { id: row.id },
        data: { reversedAt: new Date(), reversedByUserId: req.user!.id, reversalReason: reason },
      });
      const order = await tx.labOrder.findUnique({ where: { id: row.labOrderId }, select: { id: true, clinicId: true, status: true } });
      if (order) {
        await appendEventInTransaction(tx, order, order.status, order.status, req.user!.id, 'Менеджер отменил списание материала: возврат в исходную партию');
        await writeAuditLog({
          action: 'DENTAL_LAB_MATERIAL_CONSUMPTION_REVERSED',
          entity: 'dental_lab_case_material',
          entityId: updated.id,
          details: { laboratoryId: membership.labId, labOrderId: order.id, lotId: lot.id, quantityMilli: row.quantityMilli.toString(), reason },
          userId: req.user!.id,
          clinicId: order.clinicId,
        }, tx);
      }
      return { kind: 'reversed' as const, record: updated };
    });
    if (outcome.kind === 'not_found' || outcome.kind === 'lot_not_found') return res.status(404).json({ ok: false, error: 'Списание или партия не найдены в этой лаборатории' } satisfies ApiResponse);
    if (outcome.kind === 'stock_integrity_error') return res.status(409).json({ ok: false, error: 'Возврат превысит исходное количество партии', code: 'LAB_MATERIAL_STOCK_INTEGRITY' } satisfies ApiResponse);
    if (outcome.kind === 'already_reversed') return res.status(409).json({ ok: false, error: 'Списание уже отменено с другой причиной', code: 'LAB_MATERIAL_ALREADY_REVERSED' } satisfies ApiResponse);
    return res.json({ ok: true, data: outcome.kind === 'reversed' ? serializeBigInt(outcome.record) : null, idempotent: outcome.kind === 'idempotent' } satisfies ApiResponse);
  } catch (error) {
    console.error('[LabPlatform] material consumption reversal error:', safeErrorKind(error));
    return res.status(500).json({ ok: false, error: 'Не удалось вернуть материал в партию' } satisfies ApiResponse);
  }
});

labPlatformRouter.get('/dashboard', async (req: AuthRequest, res) => {
  try {
    const membership = await resolveLab(req);
    if (!membership || (!canLabMemberReadOrders(membership.role) && !canLabManageFinance(membership.role))) return res.status(403).json({ ok: false, error: 'Нет доступа к кабинету лаборатории' } satisfies ApiResponse);
    if (!canLabMemberReadOrders(membership.role)) {
      return res.json({ ok: true, data: { lab: membership.lab, membershipRole: membership.role, totals: { all: 0, active: 0, dueSoon: 0, overdue: 0 }, byStatus: {}, priority: [] } } satisfies ApiResponse);
    }
    const orders = await ordersForLab(membership.labId, membership.role, req.user!.id, undefined, req.user?.branchIds || []);
    if (!orders) return res.status(403).json({ ok: false, error: 'Нет доступа к производственной очереди' } satisfies ApiResponse);
    const now = Date.now();
    const active = orders.filter((o) => !['delivered', 'cancelled'].includes(o.status));
    const dueSoon = active.filter((o) => o.deadline && new Date(o.deadline).getTime() <= now + 48 * 60 * 60 * 1000);
    const overdue = active.filter((o) => o.deadline && new Date(o.deadline).getTime() < now);
    const byStatus = orders.reduce<Record<string, number>>((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {});
    return res.json({ ok: true, data: { lab: membership.lab, membershipRole: membership.role, totals: { all: orders.length, active: active.length, dueSoon: dueSoon.length, overdue: overdue.length }, byStatus, priority: [...overdue, ...dueSoon.filter((o) => !overdue.includes(o))].slice(0, 8) } } satisfies ApiResponse);
  } catch (error) { console.error('[LabPlatform] dashboard error:', safeErrorKind(error)); return res.status(500).json({ ok: false, error: 'Не удалось загрузить кабинет лаборатории' } satisfies ApiResponse); }
});

labPlatformRouter.get('/finance', async (req: AuthRequest, res) => {
  try {
    const membership = await resolveLab(req);
    if (!membership || !canLabManageFinance(membership.role)) {
      return res.status(403).json({ ok: false, error: 'Финансовый раздел доступен владельцу, менеджеру и назначенной финансовой роли лаборатории' } satisfies ApiResponse);
    }
    const wallet = await getOrCreateWallet('PARTNER', membership.labId);
    const [available, payouts, economics] = await Promise.all([
      availableBalanceMinor(wallet.id),
      prisma.payout.findMany({
        where: { walletId: wallet.id },
        select: { id: true, amount: true, status: true, createdAt: true, updatedAt: true },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      getPartnerEconomicsTransparency({ vertical: 'DENTAL_LAB', partnerId: membership.labId }),
    ]);
    return res.json({
      ok: true,
      data: serializeBigInt({
        wallet,
        availableBalanceMinor: available,
        payouts,
        economics: {
          period: economics.period,
          totals: economics.totals,
          rows: economics.rows.slice(0, 50),
          discrepancies: economics.discrepancies,
        },
      }),
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[LabPlatform] finance read error:', safeErrorKind(error));
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить финансы лаборатории' } satisfies ApiResponse);
  }
});

labPlatformRouter.post('/payouts', async (req: AuthRequest, res) => {
  try {
    const membership = await resolveLab(req);
    if (!membership || !canLabManageFinance(membership.role)) {
      return res.status(403).json({ ok: false, error: 'Запрос выплаты доступен владельцу, менеджеру и назначенной финансовой роли лаборатории' } satisfies ApiResponse);
    }
    const rawAmount = req.body?.amount;
    if (typeof rawAmount !== 'string' && typeof rawAmount !== 'number') {
      return res.status(400).json({ ok: false, error: 'Укажите сумму выплаты в тенге' } satisfies ApiResponse);
    }
    let amountMinor: bigint;
    try {
      amountMinor = parseTengeToMinor(rawAmount);
    } catch {
      return res.status(400).json({ ok: false, error: 'Некорректная сумма выплаты' } satisfies ApiResponse);
    }
    try {
      const payout = await prisma.$transaction(async (tx) => {
        const created = await requestPayout({ ownerType: 'PARTNER', ownerId: membership.labId, amountMinor }, tx);
        await writeAuditLog({
          action: 'DENTAL_LAB_PAYOUT_REQUESTED',
          entity: 'payout',
          entityId: created.id,
          details: { laboratoryId: membership.labId, amountMinor: created.amount.toString() },
          userId: req.user!.id,
        }, tx);
        return created;
      });
      return res.status(201).json({ ok: true, data: serializeBigInt(payout) } satisfies ApiResponse);
    } catch (error) {
      if (error instanceof PayoutError) {
        return res.status(error.code === 'INSUFFICIENT_FUNDS' ? 409 : 400).json({ ok: false, error: error.message, code: error.code } satisfies ApiResponse);
      }
      throw error;
    }
  } catch (error) {
    console.error('[LabPlatform] payout request error:', safeErrorKind(error));
    return res.status(500).json({ ok: false, error: 'Не удалось создать запрос на выплату' } satisfies ApiResponse);
  }
});

labPlatformRouter.get('/orders', async (req: AuthRequest, res) => {
  try {
    const membership = await resolveLab(req);
    if (!membership || !canLabMemberReadOrders(membership.role)) return res.status(403).json({ ok: false, error: 'Нет доступа к кабинету лаборатории' } satisfies ApiResponse);
    const status = req.query.status ? String(req.query.status) : undefined;
    const orders = await ordersForLab(membership.labId, membership.role, req.user!.id, status, req.user?.branchIds || []);
    if (!orders) return res.status(403).json({ ok: false, error: 'Нет доступа к производственной очереди' } satisfies ApiResponse);
    return res.json({ ok: true, data: orders } satisfies ApiResponse);
  } catch (error) { console.error('[LabPlatform] orders error:', safeErrorKind(error)); return res.status(500).json({ ok: false, error: 'Не удалось загрузить заказы лаборатории' } satisfies ApiResponse); }
});

labPlatformRouter.get('/orders/:id/lifecycle', async (req: AuthRequest, res) => {
  try {
    const membership = await resolveLab(req);
    if (!membership || !canLabMemberReadOrders(membership.role)) return res.status(403).json({ ok: false, error: 'Нет доступа к кабинету лаборатории' } satisfies ApiResponse);
    const readScope = labMemberOrderReadScope({ role: membership.role, userId: req.user!.id, labId: membership.labId, branchIds: req.user?.branchIds || [] });
    if (!readScope) return res.status(403).json({ ok: false, error: 'Нет доступа к истории производственных работ' } satisfies ApiResponse);
    const existing = await prisma.labOrder.findFirst({
      where: { id: req.params.id, ...readScope },
      include: { dentalLabShipments: { orderBy: { createdAt: 'asc' }, include: { events: { orderBy: { createdAt: 'asc' } } } } },
    });
    if (!existing) return res.status(404).json({ ok: false, error: 'Заказ не найден в этой лаборатории' } satisfies ApiResponse);
    const [events] = await Promise.all([
      prisma.$queryRawUnsafe(`SELECT * FROM "dental_lab_order_events" WHERE "labOrderId"=$1 ORDER BY "createdAt" ASC`, existing.id),
    ]);
    const shipmentEvents = existing.dentalLabShipments.flatMap((shipment) => shipment.events);
    const latestFirst = [...existing.dentalLabShipments].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return res.json({ ok: true, data: { order: serialize(
      { ...existing, dentalLabShipments: latestFirst, treatmentCaseId: await caseIdOf(existing.id) },
      { includeClinicAcceptanceNote: !isLabLogisticsRole(membership.role) },
    ), events, shipments: existing.dentalLabShipments, shipmentEvents } } satisfies ApiResponse);
  } catch (error) { console.error('[LabPlatform] lifecycle error:', safeErrorKind(error)); return res.status(500).json({ ok: false, error: 'Не удалось загрузить историю заказа' } satisfies ApiResponse); }
});

labPlatformRouter.patch('/orders/:id/status', async (req: AuthRequest, res) => {
  try {
    const membership = await resolveLab(req);
    if (!membership) return res.status(403).json({ ok: false, error: 'Нет доступа к кабинету лаборатории' } satisfies ApiResponse);
    const next = String(req.body?.status || '');
    await ensureDentalLabOrderEventsTable();
    const outcome = await prisma.$transaction(async (tx) => {
      const orderId = String(req.params.id);
      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "lab_orders" WHERE "id"=${orderId} FOR UPDATE`;
      const existing = await tx.labOrder.findFirst({ where: { id: orderId, files: { path: ['meta', 'laboratoryId'], equals: membership.labId } } });
      if (!existing) return { kind: 'not_found' as const };
      const existingMeta = metaOf(existing.files);
      // Authorization is evaluated before workflow prerequisites: technicians
      // must receive 403 for a forbidden delivery action, not a 409 that leaks
      // delivery state. Authorized managers/logistics then receive the shipment
      // prerequisite conflict when attempting to skip the shipment workflow.
      if (!canLabMemberChangeStatus({ role: membership.role, userId: req.user!.id, assignedTechnicianId: existingMeta.technicianId, nextStatus: next })) {
        return { kind: 'forbidden' as const };
      }
      if (next === 'delivered') return { kind: 'shipment_required' as const };
      if (!STATUS_FLOW[existing.status]?.includes(next)) return { kind: 'invalid_transition' as const, fromStatus: existing.status };
      const order = await tx.labOrder.update({ where: { id: existing.id }, data: { status: next as any } });
      await appendEventInTransaction(tx, order, existing.status, order.status, req.user!.id, req.body?.note ? String(req.body.note) : undefined);
      return { kind: 'updated' as const, order, previousStatus: existing.status };
    });
    if (outcome.kind === 'not_found') return res.status(404).json({ ok: false, error: 'Заказ не найден в этой лаборатории' } satisfies ApiResponse);
    if (outcome.kind === 'shipment_required') return res.status(409).json({ ok: false, error: 'Сначала зарегистрируйте отгрузку и подтвердите вручение получателю.', code: 'LAB_SHIPMENT_REQUIRED' } satisfies ApiResponse);
    if (outcome.kind === 'forbidden') return res.status(403).json({ ok: false, error: 'Это действие недоступно вашей роли лаборатории' } satisfies ApiResponse);
    if (outcome.kind === 'invalid_transition') return res.status(409).json({ ok: false, error: `Переход ${outcome.fromStatus} → ${next} недоступен` } satisfies ApiResponse);
    const order = outcome.order;
    const treatmentCaseId = await caseIdOf(order.id) || undefined;
    publish('labOrder.status_changed', { clinicId: order.clinicId, labOrderId: order.id, patientId: order.patientId || undefined, doctorId: order.doctorId || undefined, treatmentCaseId, status: order.status, previousStatus: outcome.previousStatus, userId: req.user?.id });
    return res.json({ ok: true, data: serialize({ ...order, treatmentCaseId }) } satisfies ApiResponse);
  } catch (error) { console.error('[LabPlatform] status error:', safeErrorKind(error)); return res.status(500).json({ ok: false, error: 'Не удалось изменить статус заказа' } satisfies ApiResponse); }
});

function isSecureLabEvidenceUrl(value: unknown): boolean {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (raw.length < 8 || raw.length > 2048) return false;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

labPlatformRouter.post('/orders/:id/shipment', async (req: AuthRequest, res) => {
  try {
    const membership = await resolveLab(req);
    if (!membership || !canLabManageShipment(membership.role)) {
      return res.status(403).json({ ok: false, error: 'Регистрировать отгрузку могут владелец, менеджер или сотрудник логистики лаборатории' } satisfies ApiResponse);
    }
    const method = String(req.body?.method || 'COURIER').trim().toUpperCase();
    const carrier = String(req.body?.carrier || '').trim();
    const trackingNumber = String(req.body?.trackingNumber || '').trim();
    const trackingUrl = req.body?.trackingUrl ? String(req.body.trackingUrl).trim() : null;
    const note = String(req.body?.note || '').trim().slice(0, 500) || null;
    if (!['COURIER', 'PICKUP'].includes(method)) {
      return res.status(400).json({ ok: false, error: 'Способ выдачи должен быть COURIER или PICKUP' } satisfies ApiResponse);
    }
    if (method === 'COURIER' && (carrier.length < 2 || carrier.length > 100 || trackingNumber.length < 4 || trackingNumber.length > 120)) {
      return res.status(400).json({ ok: false, error: 'Для курьерской отправки укажите перевозчика и трек-номер' } satisfies ApiResponse);
    }
    if (method === 'PICKUP' && (carrier || trackingNumber || trackingUrl)) {
      return res.status(400).json({ ok: false, error: 'Для самовывоза данные перевозчика и трек-номер не требуются' } satisfies ApiResponse);
    }
    if (trackingUrl && !isSecureLabEvidenceUrl(trackingUrl)) {
      return res.status(400).json({ ok: false, error: 'Ссылка отслеживания должна быть корректным HTTPS-адресом' } satisfies ApiResponse);
    }

    await ensureDentalLabOrderEventsTable();
    const outcome = await prisma.$transaction(async (tx) => {
      const orderId = String(req.params.id);
      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "lab_orders" WHERE "id"=${orderId} FOR UPDATE`;
      const existing = await tx.labOrder.findFirst({
        where: { id: orderId, files: { path: ['meta', 'laboratoryId'], equals: membership.labId } },
      });
      if (!existing) return { kind: 'not_found' as const };
      if (existing.status !== 'ready') return { kind: 'invalid_status' as const };
      const current = await tx.dentalLabShipment.findFirst({ where: { labOrderId: existing.id }, orderBy: { createdAt: 'desc' } });
      if (current && current.status !== 'delivered') {
        const same = current.method === method && current.carrier === (method === 'COURIER' ? carrier : null)
          && current.trackingNumber === (method === 'COURIER' ? trackingNumber : null)
          && current.trackingUrl === trackingUrl;
        return same ? { kind: 'idempotent' as const, order: existing, shipment: current } : { kind: 'already_exists' as const };
      }
      const shipment = await tx.dentalLabShipment.create({
        data: {
          id: uid(), labOrderId: existing.id, laboratoryId: membership.labId, method,
          carrier: method === 'COURIER' ? carrier : null,
          trackingNumber: method === 'COURIER' ? trackingNumber : null,
          trackingUrl, status: method === 'COURIER' ? 'dispatched' : 'ready_for_pickup',
          createdByUserId: req.user!.id,
        },
      });
      await tx.dentalLabShipmentEvent.create({
        data: {
          id: uid(), shipmentId: shipment.id,
          eventType: method === 'COURIER' ? 'DISPATCHED' : 'READY_FOR_PICKUP',
          toStatus: shipment.status, note: note || (method === 'COURIER' ? 'Заказ передан перевозчику.' : 'Заказ подготовлен к самовывозу.'),
          actorUserId: req.user!.id,
          metadata: { method, carrier: shipment.carrier, trackingNumber: shipment.trackingNumber },
        },
      });
      await appendEventInTransaction(
        tx, existing, existing.status, existing.status, req.user!.id,
        note || (method === 'COURIER' ? 'Отгрузка зарегистрирована.' : 'Заказ подготовлен к самовывозу.'),
      );
      return { kind: 'created' as const, order: existing, shipment };
    });

    if (outcome.kind === 'not_found') return res.status(404).json({ ok: false, error: 'Заказ не найден в этой лаборатории' } satisfies ApiResponse);
    if (outcome.kind === 'invalid_status') return res.status(409).json({ ok: false, error: 'Отгрузка доступна только после успешного контроля качества и статуса «Готово»' , code: 'LAB_ORDER_NOT_READY' } satisfies ApiResponse);
    if (outcome.kind === 'already_exists') return res.status(409).json({ ok: false, error: 'Для этого заказа отгрузка уже зарегистрирована', code: 'LAB_SHIPMENT_ALREADY_EXISTS' } satisfies ApiResponse);
    const shipment = outcome.shipment;
    if (outcome.kind === 'created') {
      await writeAuditLog({ action: 'DENTAL_LAB_SHIPMENT_CREATED', entity: 'dental_lab_shipment', entityId: shipment.id, details: { labOrderId: outcome.order.id, laboratoryId: membership.labId, method }, userId: req.user!.id, clinicId: outcome.order.clinicId });
      await createNotificationForClinic(outcome.order.clinicId, {
        type: 'lab.shipment.dispatched',
        title: method === 'COURIER' ? 'Заказ лаборатории отправлен' : 'Заказ готов к самовывозу',
        message: method === 'COURIER' ? 'Лаборатория зарегистрировала отправку и данные отслеживания.' : 'Лаборатория подготовила заказ к самовывозу.',
        link: '/crm/lab',
      });
      publish('labOrder.shipment_created', { clinicId: outcome.order.clinicId, labOrderId: outcome.order.id, laboratoryId: membership.labId, shipmentId: shipment.id, method, userId: req.user!.id });
    }
    return res.status(outcome.kind === 'created' ? 201 : 200).json({
      ok: true, data: { shipment, order: serialize({ ...outcome.order, dentalLabShipments: [shipment] }), idempotent: outcome.kind === 'idempotent' },
    } satisfies ApiResponse);
  } catch (error: any) {
    if (String(error?.code || '') === 'P2002') return res.status(409).json({ ok: false, error: 'Отгрузка для этого заказа уже зарегистрирована', code: 'LAB_SHIPMENT_ALREADY_EXISTS' } satisfies ApiResponse);
    console.error('[LabPlatform] shipment create error:', safeErrorKind(error));
    return res.status(500).json({ ok: false, error: 'Не удалось зарегистрировать отгрузку' } satisfies ApiResponse);
  }
});

labPlatformRouter.post('/orders/:id/shipment/delivery-confirmation', async (req: AuthRequest, res) => {
  try {
    const membership = await resolveLab(req);
    if (!membership || !canLabManageShipment(membership.role)) {
      return res.status(403).json({ ok: false, error: 'Подтверждать вручение может владелец, менеджер или сотрудник логистики лаборатории' } satisfies ApiResponse);
    }
    const proofUrl = String(req.body?.proofUrl || '').trim();
    const recipientName = String(req.body?.recipientName || '').trim().slice(0, 120);
    const note = String(req.body?.note || '').trim().slice(0, 500) || null;
    if (!isSecureLabEvidenceUrl(proofUrl)) {
      return res.status(400).json({ ok: false, error: 'Для подтверждения вручения нужна корректная HTTPS-ссылка на доказательство доставки' } satisfies ApiResponse);
    }
    if (recipientName.length < 2) {
      return res.status(400).json({ ok: false, error: 'Укажите имя получателя' } satisfies ApiResponse);
    }

    await ensureDentalLabOrderEventsTable();
    const outcome = await prisma.$transaction(async (tx) => {
      const orderId = String(req.params.id);
      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "lab_orders" WHERE "id"=${orderId} FOR UPDATE`;
      const existing = await tx.labOrder.findFirst({
        where: { id: orderId, files: { path: ['meta', 'laboratoryId'], equals: membership.labId } },
      });
      if (!existing) return { kind: 'not_found' as const };
      const shipment = await tx.dentalLabShipment.findFirst({
        where: { labOrderId: existing.id, laboratoryId: membership.labId },
        orderBy: { createdAt: 'desc' },
      });
      if (!shipment) return { kind: 'shipment_required' as const };
      if (shipment.status === 'delivered' && existing.status === 'delivered') {
        const same = shipment.proofUrl === proofUrl && shipment.recipientName === recipientName;
        return same ? { kind: 'idempotent' as const, order: existing, shipment } : { kind: 'already_delivered' as const };
      }
      if (existing.status !== 'ready' || !['dispatched', 'ready_for_pickup'].includes(shipment.status)) {
        return { kind: 'invalid_status' as const };
      }
      const deliveredAt = new Date();
      const updatedShipment = await tx.dentalLabShipment.update({
        where: { id: shipment.id },
        data: { status: 'delivered', deliveredAt, proofUrl, recipientName, deliveryNote: note, deliveredByUserId: req.user!.id },
      });
      await tx.dentalLabShipmentEvent.create({
        data: {
          id: uid(), shipmentId: shipment.id, eventType: 'DELIVERED',
          fromStatus: shipment.status, toStatus: 'delivered',
          note: note || 'Получение заказа подтверждено.',
          actorUserId: req.user!.id,
          metadata: { proofUrl, recipientName, method: shipment.method },
        },
      });
      const order = await tx.labOrder.update({ where: { id: existing.id }, data: { status: 'delivered' as any } });
      await appendEventInTransaction(tx, order, existing.status, 'delivered', req.user!.id, note || 'Вручение заказа подтверждено.');
      return { kind: 'delivered' as const, order, shipment: updatedShipment };
    });

    if (outcome.kind === 'not_found') return res.status(404).json({ ok: false, error: 'Заказ не найден в этой лаборатории' } satisfies ApiResponse);
    if (outcome.kind === 'shipment_required') return res.status(409).json({ ok: false, error: 'Сначала зарегистрируйте курьерскую отправку или подготовьте заказ к самовывозу', code: 'LAB_SHIPMENT_REQUIRED' } satisfies ApiResponse);
    if (outcome.kind === 'invalid_status') return res.status(409).json({ ok: false, error: 'Заказ должен быть готов и ожидать вручения', code: 'LAB_SHIPMENT_NOT_DELIVERABLE' } satisfies ApiResponse);
    if (outcome.kind === 'already_delivered') return res.status(409).json({ ok: false, error: 'Вручение уже подтверждено с другими данными', code: 'LAB_DELIVERY_ALREADY_CONFIRMED' } satisfies ApiResponse);

    if (outcome.kind === 'delivered') {
      await writeAuditLog({ action: 'DENTAL_LAB_DELIVERY_CONFIRMED', entity: 'dental_lab_shipment', entityId: outcome.shipment.id, details: { labOrderId: outcome.order.id, laboratoryId: membership.labId, method: outcome.shipment.method, recipientName }, userId: req.user!.id, clinicId: outcome.order.clinicId });
      await createNotificationForClinic(outcome.order.clinicId, {
        type: 'lab.shipment.delivered',
        title: 'Заказ лаборатории доставлен',
        message: `Лаборатория подтвердила вручение заказа. Получатель: ${recipientName}.`,
        link: '/crm/lab',
      });
      const treatmentCaseId = await caseIdOf(outcome.order.id) || undefined;
      publish('labOrder.status_changed', { clinicId: outcome.order.clinicId, labOrderId: outcome.order.id, patientId: outcome.order.patientId || undefined, doctorId: outcome.order.doctorId || undefined, treatmentCaseId, status: 'delivered', previousStatus: 'ready', userId: req.user!.id });
      publish('labOrder.delivery_confirmed', { clinicId: outcome.order.clinicId, labOrderId: outcome.order.id, laboratoryId: membership.labId, shipmentId: outcome.shipment.id, method: outcome.shipment.method, userId: req.user!.id });
      return res.json({ ok: true, data: { order: serialize({ ...outcome.order, dentalLabShipments: [outcome.shipment], treatmentCaseId }), shipment: outcome.shipment } } satisfies ApiResponse);
    }
    return res.json({ ok: true, data: { order: serialize({ ...outcome.order, dentalLabShipments: [outcome.shipment] }), shipment: outcome.shipment, idempotent: true } } satisfies ApiResponse);
  } catch (error) {
    console.error('[LabPlatform] delivery confirmation error:', safeErrorKind(error));
    return res.status(500).json({ ok: false, error: 'Не удалось подтвердить вручение заказа' } satisfies ApiResponse);
  }
});

labPlatformRouter.patch('/orders/:id/technician', async (req: AuthRequest, res) => {
  try {
    const membership = await resolveLab(req);
    if (!membership) return res.status(403).json({ ok: false, error: 'Нет доступа к кабинету лаборатории' } satisfies ApiResponse);
    if (!isLabManagerRole(membership.role)) return res.status(403).json({ ok: false, error: 'Назначать техников может только владелец или менеджер лаборатории' } satisfies ApiResponse);
    const technicianId = req.body?.technicianId ? String(req.body.technicianId) : null;
    await ensureDentalLabOrderEventsTable();
    const outcome = await prisma.$transaction(async (tx) => {
      const orderId = String(req.params.id);
      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "lab_orders" WHERE "id"=${orderId} FOR UPDATE`;
      const existing = await tx.labOrder.findFirst({ where: { id: orderId, files: { path: ['meta', 'laboratoryId'], equals: membership.labId } } });
      if (!existing) return { kind: 'not_found' as const };
      if (technicianId) {
        const technician = await tx.laboratoryMember.findFirst({ where: { labId: membership.labId, userId: technicianId } });
        if (!technician) return { kind: 'invalid_technician' as const };
      }
      const meta = metaOf(existing.files);
      if ((meta.technicianId || null) === technicianId) return { kind: 'unchanged' as const, order: existing };
      const currentFiles = existing.files && typeof existing.files === 'object' && !Array.isArray(existing.files)
        ? existing.files as Record<string, unknown>
        : {};
      const order = await tx.labOrder.update({
        where: { id: existing.id },
        data: { files: { ...currentFiles, meta: { ...meta, technicianId: technicianId || undefined } } },
      });
      const eventNote = technicianId ? 'Назначен ответственный зубной техник' : 'Ответственный зубной техник снят с заказа';
      await appendEventInTransaction(tx, order, existing.status, existing.status, req.user!.id, eventNote);
      return { kind: 'updated' as const, order };
    });
    if (outcome.kind === 'not_found') return res.status(404).json({ ok: false, error: 'Заказ не найден в этой лаборатории' } satisfies ApiResponse);
    if (outcome.kind === 'invalid_technician') return res.status(400).json({ ok: false, error: 'Сотрудник не состоит в этой лаборатории' } satisfies ApiResponse);
    const order = outcome.order;
    return res.json({ ok: true, data: serialize({ ...order, treatmentCaseId: await caseIdOf(order.id) }) } satisfies ApiResponse);
  } catch (error) { console.error('[LabPlatform] technician error:', safeErrorKind(error)); return res.status(500).json({ ok: false, error: 'Не удалось назначить техника' } satisfies ApiResponse); }
});

labPlatformRouter.patch('/orders/:id/qc', async (req: AuthRequest, res) => {
  try {
    const membership = await resolveLab(req);
    if (!membership) return res.status(403).json({ ok: false, error: 'Нет доступа к кабинету лаборатории' } satisfies ApiResponse);
    if (!isLabManagerRole(membership.role) && !isLabQualityRole(membership.role)) return res.status(403).json({ ok: false, error: 'Подтверждать QC может только владелец, менеджер или специалист качества лаборатории' } satisfies ApiResponse);
    const submission = validateLabQualityControl(req.body?.checks, req.body?.note);
    if (!submission) return res.status(400).json({ ok: false, error: 'Заполните все пункты QC; при несоответствии укажите замечание' } satisfies ApiResponse);
    const nextStatus = submission.passed ? 'ready' : 'remake';
    const qualityControl = { ...submission, checkedByUserId: req.user!.id, checkedAt: new Date().toISOString() };
    const eventNote = submission.passed ? 'QC подтверждён владельцем лаборатории' : `QC не пройден: ${submission.note}`;

    await ensureDentalLabOrderEventsTable();
    const outcome = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "lab_orders" WHERE "id"=${req.params.id} FOR UPDATE`;
      const existing = await tx.labOrder.findFirst({ where: { id: req.params.id, files: { path: ['meta', 'laboratoryId'], equals: membership.labId } } });
      if (!existing) return { kind: 'not_found' as const };
      if (existing.status !== 'qc') return { kind: 'invalid_status' as const };
      const meta = metaOf(existing.files);
      const currentFiles = existing.files && typeof existing.files === 'object' && !Array.isArray(existing.files)
        ? existing.files as Record<string, unknown>
        : {};
      const order = await tx.labOrder.update({
        where: { id: existing.id },
        data: { status: nextStatus as any, files: { ...currentFiles, meta: { ...meta, qualityControl } } },
      });
      await appendEventInTransaction(tx, order, existing.status, nextStatus, req.user!.id, eventNote);
      return { kind: 'updated' as const, order, previousStatus: existing.status };
    });
    if (outcome.kind === 'not_found') return res.status(404).json({ ok: false, error: 'Заказ не найден в этой лаборатории' } satisfies ApiResponse);
    if (outcome.kind === 'invalid_status') return res.status(409).json({ ok: false, error: 'Заказ должен находиться на этапе контроля качества' } satisfies ApiResponse);

    const order = outcome.order;
    const treatmentCaseId = await caseIdOf(order.id) || undefined;
    // Publish the canonical transition as well as the QC-specific event. The
    // shared bridge persists the clinic's notification and AI workflow signal.
    publish('labOrder.status_changed', {
      clinicId: order.clinicId,
      labOrderId: order.id,
      patientId: order.patientId || undefined,
      doctorId: order.doctorId || undefined,
      treatmentCaseId,
      status: nextStatus,
      previousStatus: outcome.previousStatus,
      userId: req.user?.id,
    });
    publish(submission.passed ? 'labOrder.qc_passed' : 'labOrder.qc_failed', {
      clinicId: order.clinicId, labOrderId: order.id, status: nextStatus,
      previousStatus: outcome.previousStatus, userId: req.user?.id, laboratoryId: membership.labId,
    });
    return res.json({ ok: true, data: serialize({ ...order, treatmentCaseId }) } satisfies ApiResponse);
  } catch (error) { console.error('[LabPlatform] QC error:', safeErrorKind(error)); return res.status(500).json({ ok: false, error: 'Не удалось сохранить результат контроля качества' } satisfies ApiResponse); }
});

labPlatformRouter.patch('/orders/:id/remake-request', async (req: AuthRequest, res) => {
  try {
    const membership = await resolveLab(req);
    if (!membership) return res.status(403).json({ ok: false, error: 'Нет доступа к кабинету лаборатории' } satisfies ApiResponse);
    if (!isLabManagerRole(membership.role)) return res.status(403).json({ ok: false, error: 'Решать запросы переделки может только владелец или менеджер лаборатории' } satisfies ApiResponse);
    const decision = validateLabRemakeDecision(req.body?.decision, req.body?.note);
    if (!decision) return res.status(400).json({ ok: false, error: 'Выберите решение; при отклонении укажите причину от 5 до 2000 символов' } satisfies ApiResponse);

    await ensureDentalLabOrderEventsTable();
    const outcome = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "lab_orders" WHERE "id"=${req.params.id} FOR UPDATE`;
      const existing = await tx.labOrder.findFirst({
        where: { id: req.params.id, files: { path: ['meta', 'laboratoryId'], equals: membership.labId } },
      });
      if (!existing) return { kind: 'not_found' as const };
      if (existing.status !== 'delivered') return { kind: 'invalid_status' as const };
      const meta = metaOf(existing.files);
      const request = meta.remakeRequest;
      if (!request || request.status !== 'requested' || request.laboratoryId !== membership.labId) {
        return { kind: 'no_request' as const };
      }
      const nextStatus = decision.decision === 'accept' ? 'remake' : 'delivered';
      const remakeRequest = {
        ...request,
        status: decision.decision === 'accept' ? 'accepted' as const : 'rejected' as const,
        decidedByUserId: req.user!.id,
        decidedAt: new Date().toISOString(),
        responseNote: decision.note,
      };
      const currentFiles = existing.files && typeof existing.files === 'object' && !Array.isArray(existing.files)
        ? existing.files as Record<string, unknown>
        : {};
      const order = await tx.labOrder.update({
        where: { id: existing.id },
        data: { status: nextStatus as any, files: { ...currentFiles, meta: { ...meta, remakeRequest } } },
      });
      const eventNote = decision.decision === 'accept'
        ? `Лаборатория приняла запрос на переделку. ${decision.note || ''}`.trim()
        : `Лаборатория отклонила запрос на переделку: ${decision.note}`;
      await appendEventInTransaction(tx, order, existing.status, nextStatus, req.user!.id, eventNote);
      return { kind: 'updated' as const, order, previousStatus: existing.status, nextStatus, remakeRequest };
    });

    if (outcome.kind === 'not_found') return res.status(404).json({ ok: false, error: 'Запрос переделки не найден в этой лаборатории' } satisfies ApiResponse);
    if (outcome.kind === 'invalid_status') return res.status(409).json({ ok: false, error: 'Решение доступно только для доставленного заказа' } satisfies ApiResponse);
    if (outcome.kind === 'no_request') return res.status(409).json({ ok: false, error: 'Нет ожидающего решения запроса на переделку' } satisfies ApiResponse);

    await createNotificationForClinic(outcome.order.clinicId, {
      type: 'lab.remake.decision',
      title: decision.decision === 'accept' ? 'Лаборатория приняла переделку' : 'Лаборатория отклонила переделку',
      message: decision.decision === 'accept'
        ? 'Лаборатория приняла запрос. Заказ возвращён в производственный цикл.'
        : `Лаборатория отклонила запрос: ${decision.note}`,
      link: '/crm/lab',
    });
    await writeAuditLog({
      action: decision.decision === 'accept' ? 'LAB_ORDER_REMAKE_ACCEPTED' : 'LAB_ORDER_REMAKE_REJECTED',
      entity: 'lab_order', entityId: outcome.order.id,
      details: { requestId: outcome.remakeRequest.id, decision: decision.decision, responseNoteLength: decision.note?.length || 0 },
      userId: req.user!.id, clinicId: outcome.order.clinicId,
    });
    publish('labOrder.remake_response', {
      clinicId: outcome.order.clinicId, labOrderId: outcome.order.id, laboratoryId: membership.labId,
      requestId: outcome.remakeRequest.id, decision: decision.decision, userId: req.user!.id,
    });
    if (decision.decision === 'accept') {
      publish('labOrder.status_changed', {
        clinicId: outcome.order.clinicId, labOrderId: outcome.order.id, patientId: outcome.order.patientId || undefined,
        doctorId: outcome.order.doctorId || undefined, status: outcome.nextStatus, previousStatus: outcome.previousStatus, userId: req.user!.id,
      });
    }
    const treatmentCaseId = await caseIdOf(outcome.order.id) || undefined;
    return res.json({ ok: true, data: serialize({ ...outcome.order, treatmentCaseId }) } satisfies ApiResponse);
  } catch (error) {
    console.error('[LabPlatform] remake response error:', safeErrorKind(error));
    return res.status(500).json({ ok: false, error: 'Не удалось сохранить решение по переделке' } satisfies ApiResponse);
  }
});

labPlatformRouter.post('/orders/:id/invoice', async (req: AuthRequest, res) => {
  try {
    const membership = await resolveLab(req);
    if (!membership) return res.status(403).json({ ok: false, error: 'Нет доступа к кабинету лаборатории' } satisfies ApiResponse);
    if (!canLabManageFinance(membership.role)) return res.status(403).json({ ok: false, error: 'Выставлять счета может только владелец, менеджер или финансовый сотрудник лаборатории' } satisfies ApiResponse);
    await ensureDentalLabOrderEventsTable();

    const outcome = await prisma.$transaction(async (tx) => {
      const orderId = String(req.params.id);
      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "lab_orders" WHERE "id"=${orderId} FOR UPDATE`;
      const order = await tx.labOrder.findFirst({
        where: { id: orderId, files: { path: ['meta', 'laboratoryId'], equals: membership.labId } },
        include: {
          patient: { select: { branchId: true } },
          dentalLabInvoice: true,
          dentalLabShipments: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true, laboratoryId: true, status: true, deliveredAt: true, proofUrl: true, recipientName: true },
          },
        },
      });
      if (!order) return { kind: 'not_found' as const };
      if (order.status !== 'delivered') return { kind: 'not_delivered' as const };
      if (!order.serviceId || !order.serviceNameSnapshot || !Number.isSafeInteger(order.servicePriceSnapshot) || Number(order.servicePriceSnapshot) <= 0) {
        return { kind: 'price_snapshot_missing' as const };
      }
      const meta = metaOf(order.files);
      if (meta.remakeRequest?.status === 'requested') return { kind: 'remake_pending' as const };
      const latestShipment = order.dentalLabShipments[0] ?? null;
      if (!hasAcceptedLatestDentalLabDelivery(meta.clinicAcceptance, latestShipment, membership.labId)) {
        return { kind: 'clinic_acceptance_required' as const };
      }
      if (order.dentalLabInvoice) return { kind: 'existing' as const, invoice: order.dentalLabInvoice };

      const invoice = await tx.dentalLabInvoice.create({
        data: {
          id: uid(),
          invoiceNumber: `DL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${uid().slice(-6).toUpperCase()}`,
          labOrderId: order.id,
          laboratoryId: membership.labId,
          clinicId: order.clinicId,
          branchId: order.patient?.branchId ?? null,
          serviceId: order.serviceId,
          serviceNameSnapshot: order.serviceNameSnapshot,
          amountMinor: parseTengeToMinor(String(order.servicePriceSnapshot)),
          status: 'issued',
          issuedByUserId: req.user!.id,
          notes: typeof req.body?.notes === 'string' ? req.body.notes.trim().slice(0, 1000) || null : null,
        },
      });
      await appendEventInTransaction(tx, order, order.status, order.status, req.user!.id, `Выставлен счёт ${invoice.invoiceNumber}`);
      return { kind: 'created' as const, invoice, order };
    });

    if (outcome.kind === 'not_found') return res.status(404).json({ ok: false, error: 'Заказ не найден в этой лаборатории' } satisfies ApiResponse);
    if (outcome.kind === 'not_delivered') return res.status(409).json({ ok: false, error: 'Счёт можно выставить только после подтверждённого вручения заказа' } satisfies ApiResponse);
    if (outcome.kind === 'price_snapshot_missing') return res.status(409).json({ ok: false, error: 'Для счёта нужна опубликованная услуга и зафиксированная цена заказа' } satisfies ApiResponse);
    if (outcome.kind === 'remake_pending') return res.status(409).json({ ok: false, error: 'Сначала завершите ожидающий запрос переделки' } satisfies ApiResponse);
    if (outcome.kind === 'clinic_acceptance_required') {
      return res.status(409).json({
        ok: false,
        error: 'Клиника должна подтвердить приёмку последней поставки до выставления счёта.',
        code: 'LAB_CLINIC_ACCEPTANCE_REQUIRED',
      } satisfies ApiResponse);
    }

    if (outcome.kind === 'created') {
      await writeAuditLog({
        action: 'DENTAL_LAB_INVOICE_ISSUED', entity: 'dental_lab_invoice', entityId: outcome.invoice.id,
        details: { invoiceNumber: outcome.invoice.invoiceNumber, labOrderId: outcome.invoice.labOrderId, amountMinor: outcome.invoice.amountMinor.toString() },
        userId: req.user!.id, clinicId: outcome.order.clinicId,
      });
      await createNotificationForClinic(outcome.order.clinicId, {
        type: 'lab.invoice.issued',
        title: 'Зуботехническая лаборатория выставила счёт',
        message: `Счёт ${outcome.invoice.invoiceNumber} готов к оплате по заказу лаборатории.`,
        link: '/crm/lab',
      });
      publish('labOrder.invoice_issued', {
        clinicId: outcome.order.clinicId,
        labOrderId: outcome.order.id,
        laboratoryId: membership.labId,
        invoiceId: outcome.invoice.id,
        userId: req.user!.id,
      });
    }
    return res.status(outcome.kind === 'created' ? 201 : 200).json({
      ok: true,
      data: serializeBigInt(outcome.invoice),
      idempotent: outcome.kind === 'existing',
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[LabPlatform] invoice issue error:', safeErrorKind(error));
    return res.status(500).json({ ok: false, error: 'Не удалось выставить счёт лаборатории' } satisfies ApiResponse);
  }
});

labPlatformRouter.get('/team', async (req: AuthRequest, res) => {
  try {
    const membership = await resolveLab(req);
    if (!membership || !isLabManagerRole(membership.role)) return res.status(403).json({ ok: false, error: 'Список сотрудников доступен только владельцу или менеджеру лаборатории' } satisfies ApiResponse);
    const members = await prisma.laboratoryMember.findMany({ where: { labId: membership.labId }, include: { user: true } });
    return res.json({ ok: true, data: members.map((m: any) => ({ id: m.userId, role: m.role, firstName: m.user.firstName, lastName: m.user.lastName, email: m.user.email, avatar: m.user.avatar })) } satisfies ApiResponse);
  } catch (error) { console.error('[LabPlatform] team error:', safeErrorKind(error)); return res.status(500).json({ ok: false, error: 'Не удалось загрузить команду' } satisfies ApiResponse); }
});

labPlatformRouter.post('/assign', requirePermission('appointment.write'), async (req: AuthRequest, res) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(403).json({ ok: false, error: 'Действие доступно из клиники' } satisfies ApiResponse);
    if (!(await requireClinicAssignmentWritable(req, res, clinicId))) return;
    const orderId = String(req.body?.orderId || ''), laboratoryId = String(req.body?.laboratoryId || '');
    const serviceId = req.body?.serviceId ? String(req.body.serviceId) : null;
    if (!orderId || !laboratoryId) return res.status(400).json({ ok: false, error: 'orderId и laboratoryId обязательны' } satisfies ApiResponse);
    const lab = await prisma.laboratory.findUnique({ where: { id: laboratoryId }, select: { id: true, name: true, active: true } });
    if (!lab || !lab.active) return res.status(404).json({ ok: false, error: 'Активная зуботехническая лаборатория не найдена', code: 'LAB_PARTNER_NOT_AVAILABLE' } satisfies ApiResponse);
    const organization = await prisma.organization.findFirst({
      where: { type: 'LABORATORY', originalType: 'Laboratory', originalId: lab.id, archivedAt: null },
      select: { settings: true },
    });
    if (!organization || !isVerifiedDentalLabSettings(organization.settings)) {
      return res.status(404).json({ ok: false, error: 'Лаборатория не прошла проверку или не опубликована как зуботехнический партнёр.', code: 'LAB_PARTNER_NOT_AVAILABLE' } satisfies ApiResponse);
    }

    await ensureDentalLabOrderEventsTable();
    const outcome = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "lab_orders" WHERE "id"=${orderId} AND "clinicId"=${clinicId} FOR UPDATE`;
      const existing = await tx.labOrder.findFirst({ where: { id: orderId, clinicId, ...branchScopedClinicLabOrder(req) } });
      if (!existing) return { kind: 'not_found' as const };
      const meta = metaOf(existing.files);
      if (meta.laboratoryId === lab.id) return { kind: 'idempotent' as const, order: existing };
      if (meta.laboratoryId) return { kind: 'already_assigned' as const };
      if (existing.status !== 'pending') return { kind: 'invalid_status' as const };

      const selectedService = serviceId
        ? await tx.dentalLabService.findFirst({ where: { id: serviceId, labId: lab.id, active: true } })
        : null;
      if (serviceId && !selectedService) return { kind: 'invalid_service' as const };
      const currentFiles = existing.files && typeof existing.files === 'object' && !Array.isArray(existing.files)
        ? existing.files as Record<string, unknown>
        : {};
      const order = await tx.labOrder.update({
        where: { id: existing.id },
        data: {
          labName: lab.name,
          ...(selectedService ? {
            serviceId: selectedService.id,
            serviceNameSnapshot: selectedService.name,
            servicePriceSnapshot: selectedService.defaultPrice,
            price: selectedService.defaultPrice,
          } : {}),
          files: { ...currentFiles, meta: { ...meta, laboratoryId: lab.id } },
        },
      });
      await appendEventInTransaction(tx, order, null, order.status, req.user!.id, `Передан в лабораторию: ${lab.name}`);
      return { kind: 'assigned' as const, order };
    });

    if (outcome.kind === 'not_found') return res.status(404).json({ ok: false, error: 'Заказ не найден в вашей клинике' } satisfies ApiResponse);
    if (outcome.kind === 'already_assigned') return res.status(409).json({ ok: false, error: 'Заказ уже передан другой лаборатории. Переназначение без закрытия текущего цикла запрещено.', code: 'LAB_ORDER_ALREADY_ASSIGNED' } satisfies ApiResponse);
    if (outcome.kind === 'invalid_status') return res.status(409).json({ ok: false, error: 'Передать можно только новый заказ со статусом «Ожидает».', code: 'LAB_ORDER_NOT_ASSIGNABLE' } satisfies ApiResponse);
    if (outcome.kind === 'invalid_service') return res.status(400).json({ ok: false, error: 'Выбранная услуга отсутствует, отключена или принадлежит другой лаборатории.', code: 'LAB_SERVICE_NOT_AVAILABLE' } satisfies ApiResponse);

    const order = outcome.order;
    if (outcome.kind === 'assigned') {
      publish('labOrder.assigned', { clinicId, labOrderId: order.id, laboratoryId: lab.id, laboratoryName: lab.name, patientId: order.patientId || undefined, doctorId: order.doctorId || undefined, treatmentCaseId: await caseIdOf(order.id) || undefined, userId: req.user?.id });
    }
    return res.json({ ok: true, data: { ...serialize({ ...order, treatmentCaseId: await caseIdOf(order.id) }), assignmentIdempotent: outcome.kind === 'idempotent' } } satisfies ApiResponse);
  } catch (error) { console.error('[LabPlatform] assign error:', safeErrorKind(error)); return res.status(500).json({ ok: false, error: 'Не удалось передать заказ лаборатории' } satisfies ApiResponse); }
});
