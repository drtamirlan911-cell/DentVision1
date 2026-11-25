/**
 * Read-only operations for an active dental-laboratory workspace.
 *
 * The Organization id and original Laboratory id arrive from the governance
 * kernel after DB membership resolution. This module rechecks the organization,
 * dental-lab type, active Laboratory and LaboratoryMember.
 * It reuses the same production read-scope predicate as the REST cabinet:
 * managers see this lab's queue; technicians see only assigned cases.
 *
 * The model receives process metadata only — never patient identifiers,
 * names, medical notes, appointment ids, QC free text or attachment payloads.
 */
import type { Prisma } from '@prisma/client';
import prisma from '../../../lib/prisma.js';
import { isLabTechnicianRole, labMemberOrderReadScope } from '../../lab/labPlatform.authorization.js';

export interface DentalLabWorkQueueContext {
  userId: string;
  organizationId: string | null;
  organizationType: string | null;
  organizationOriginalId: string | null;
  role: string;
}

const DENTAL_LAB_AI_ORG_ROLES = new Set(['DENTAL_LAB_OWNER', 'DENTAL_LAB_ADMIN']);
const DENTAL_LAB_AI_ASSIGNED_ROLES = new Set([
  'DENTAL_TECHNICIAN', 'CAD_DESIGNER', 'CERAMIST', 'ORTHODONTIC_TECHNICIAN',
]);

export interface DentalLabWorkQueueResult {
  ok: boolean;
  data?: {
    laboratory: { id: string; name: string };
    visibility: 'laboratory_queue' | 'assigned_to_me';
    total: number;
    returned: number;
    hasMore: boolean;
    byStatusReturned: Record<string, number>;
    orders: Array<{
      id: string;
      type: string;
      status: string;
      deadline: Date | null;
      material: string | null;
      updatedAt: Date;
    }>;
  };
  error?: string;
}

function dentalLabSettingsReady(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const settings = value as Record<string, unknown>;
  return settings.laboratoryType === 'DENTAL_LAB'
    && settings.selfServiceType === 'dental_lab';
}

function metaOf(files: unknown): Record<string, unknown> {
  if (!files || typeof files !== 'object' || Array.isArray(files)) return {};
  const meta = (files as Record<string, unknown>).meta;
  return meta && typeof meta === 'object' && !Array.isArray(meta)
    ? meta as Record<string, unknown>
    : {};
}

function safeText(value: unknown, max = 100): string | null {
  if (typeof value !== 'string') return null;
  let sanitized = '';
  for (const character of value) {
    const code = character.charCodeAt(0);
    sanitized += code <= 0x1f || code === 0x7f ? ' ' : character;
  }
  const text = sanitized.trim();
  return text ? text.slice(0, max) : null;
}


/**
 * Read-only diagnostic-center worklist. The assistant receives operational
 * metadata only; patient identity, clinical notes, report text and file URLs
 * stay inside the clinical source of truth.
 */
export interface DiagnosticCenterWorkQueueContext {
  userId: string;
  organizationId: string | null;
  organizationType: string | null;
  organizationOriginalId: string | null;
  role: string;
}

// Whole-center queue visibility is limited to roles whose canonical registry
// declares ORGANIZATION scope. Branch/assigned roles remain closed until their
// exact row scope can be enforced.
const DIAGNOSTIC_CENTER_AI_ROLES = new Set([
  'DIAGNOSTIC_OWNER', 'DIAGNOSTIC_ADMIN', 'DIAGNOSTIC_QUALITY',
]);
const DIAGNOSTIC_CENTER_MEMBER_ROLES = new Set(['owner', 'admin', 'quality']);

export async function getDiagnosticCenterWorkQueue(context: DiagnosticCenterWorkQueueContext) {
  if (
    !context.userId
    || !context.organizationId
    || context.organizationType !== 'DIAGNOSTIC_CENTER'
    || !context.organizationOriginalId
    || !DIAGNOSTIC_CENTER_AI_ROLES.has(String(context.role || '').trim().toUpperCase())
  ) {
    return { ok: false as const, error: 'Нет подтверждённого рабочего пространства диагностического центра' };
  }
  try {
    const organization = await prisma.organization.findUnique({
      where: { id: context.organizationId },
      select: { id: true, type: true, originalType: true, originalId: true, archivedAt: true },
    });
    if (!organization || organization.archivedAt || organization.type !== 'DIAGNOSTIC_CENTER'
      || organization.originalType !== 'DiagnosticCenter' || organization.originalId !== context.organizationOriginalId) {
      return { ok: false as const, error: 'Текущее рабочее пространство не является активным диагностическим центром' };
    }
    const membership = await prisma.diagnosticCenterMember.findFirst({
      where: { centerId: context.organizationOriginalId, userId: context.userId },
      select: { role: true, center: { select: { id: true, name: true, active: true } } },
    });
    if (!membership?.center?.active || !DIAGNOSTIC_CENTER_MEMBER_ROLES.has(String(membership.role || '').trim().toLowerCase())) {
      return { ok: false as const, error: 'У вас нет доступа к очереди диагностического центра' };
    }
    const where = { centerId: context.organizationOriginalId };
    const [total, rows, grouped] = await Promise.all([
      prisma.referral.count({ where }),
      prisma.referral.findMany({
        where,
        select: { id: true, category: true, studyType: true, priority: true, status: true, scheduledDate: true, createdAt: true, updatedAt: true },
        orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'desc' }],
        take: 51,
      }),
      prisma.referral.groupBy({ by: ['status'], where, _count: { _all: true } }),
    ]);
    const items = rows.slice(0, 50).map((row) => ({
      id: row.id,
      category: String(row.category),
      studyType: safeText(row.studyType, 100) || 'Исследование',
      priority: String(row.priority),
      status: String(row.status),
      scheduledDate: row.scheduledDate,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
    const byStatus = grouped.reduce<Record<string, number>>((result, item) => {
      result[String(item.status)] = item._count._all;
      return result;
    }, {});
    return { ok: true as const, data: {
      center: { id: membership.center.id, name: safeText(membership.center.name, 120) || 'Диагностический центр' },
      total, returned: items.length, hasMore: total > items.length, byStatus, referrals: items,
    } };
  } catch {
    return { ok: false as const, error: 'Не удалось безопасно загрузить очередь диагностического центра' };
  }
}


export interface SupplierInventoryOverviewContext {
  userId: string;
  organizationId: string | null;
  organizationType: string | null;
  supplierId: string | null;
  role: string;
}

const SUPPLIER_INVENTORY_ROLES = new Set(['SUPPLIER', 'SELLER']);

/**
 * Read-only view of a supplier's own catalogue and stock.
 * Organization identity and membership are rechecked before querying products.
 * Buyer, clinic, delivery, payout, order-note and patient data are never selected.
 */
export async function getSupplierInventoryOverview(context: SupplierInventoryOverviewContext) {
  const role = String(context.role || '').trim().toUpperCase();
  if (!context.userId || !context.supplierId || !SUPPLIER_INVENTORY_ROLES.has(role)) {
    return { ok: false as const, error: 'Нет подтверждённого рабочего пространства поставщика' };
  }

  try {
    if (context.organizationId) {
      if (!['SUPPLIER_COMPANY', 'SUPPLIER'].includes(String(context.organizationType || '').toUpperCase())) {
        return { ok: false as const, error: 'Текущее рабочее пространство не является кабинетом поставщика' };
      }
      const organization = await prisma.organization.findUnique({
        where: { id: context.organizationId },
        select: { id: true, type: true, originalType: true, originalId: true, archivedAt: true },
      });
      if (
        !organization
        || organization.archivedAt
        || !['SUPPLIER_COMPANY', 'SUPPLIER'].includes(String(organization.type || '').toUpperCase())
        || organization.originalType !== 'Supplier'
        || organization.originalId !== context.supplierId
      ) {
        return { ok: false as const, error: 'Текущее рабочее пространство не связано с этим поставщиком' };
      }
    } else if (context.organizationType) {
      return { ok: false as const, error: 'Не удалось подтвердить организацию поставщика' };
    }

    const [supplier, legacyMembership, canonicalPerson] = await Promise.all([
      prisma.supplier.findUnique({
        where: { id: context.supplierId },
        select: { id: true, name: true, status: true, isActive: true },
      }),
      prisma.supplierMember.findUnique({
        where: { userId_supplierId: { userId: context.userId, supplierId: context.supplierId } },
        select: { role: true },
      }),
      context.organizationId
        ? prisma.person.findFirst({
            where: {
              userId: context.userId,
              organizationId: context.organizationId,
              personType: 'SUPPLIER_REP',
            },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (!supplier || !supplier.isActive || String(supplier.status).toLowerCase() === 'suspended') {
      return { ok: false as const, error: 'Поставщик неактивен или недоступен' };
    }
    if (!legacyMembership && !canonicalPerson) {
      return { ok: false as const, error: 'Нет подтверждённого членства в этом кабинете поставщика' };
    }

    const statsSql = [
      'SELECT',
      'COUNT(*)::int AS "totalProducts",',
      'COUNT(*) FILTER (WHERE "isActive" = TRUE)::int AS "activeProducts",',
      'COUNT(*) FILTER (WHERE "isActive" = TRUE AND "stock" <= "minStock")::int AS "lowStockProducts",',
      'COUNT(*) FILTER (WHERE "isActive" = FALSE)::int AS "inactiveProducts"',
      'FROM "products" WHERE "supplierId" = $1'
    ].join(' ');
    const [statsRows, rows] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{
        totalProducts: number;
        activeProducts: number;
        lowStockProducts: number;
        inactiveProducts: number;
      }>>(statsSql, context.supplierId),
      prisma.product.findMany({
        where: { supplierId: context.supplierId },
        select: {
          id: true,
          name: true,
          sku: true,
          category: true,
          price: true,
          currency: true,
          stock: true,
          minStock: true,
          isActive: true,
          updatedAt: true,
        },
        orderBy: [{ isActive: 'desc' }, { stock: 'asc' }, { updatedAt: 'desc' }],
        take: 51,
      }),
    ]);

    const stats = statsRows[0] || {
      totalProducts: 0, activeProducts: 0, lowStockProducts: 0, inactiveProducts: 0,
    };
    const products = rows.slice(0, 50).map((product) => ({
      id: product.id,
      name: safeText(product.name, 120) || 'Товар без названия',
      sku: safeText(product.sku, 80),
      category: safeText(product.category, 80),
      price: product.price,
      currency: safeText(product.currency, 8) || 'KZT',
      stock: product.stock,
      minStock: product.minStock,
      lowStock: product.isActive && product.stock <= product.minStock,
      isActive: product.isActive,
      updatedAt: product.updatedAt,
    }));

    return {
      ok: true as const,
      data: {
        supplier: {
          id: supplier.id,
          name: safeText(supplier.name, 120) || 'Поставщик',
          status: safeText(supplier.status, 40) || 'unknown',
        },
        summary: {
          totalProducts: Number(stats.totalProducts) || 0,
          activeProducts: Number(stats.activeProducts) || 0,
          lowStockProducts: Number(stats.lowStockProducts) || 0,
          inactiveProducts: Number(stats.inactiveProducts) || 0,
        },
        returned: products.length,
        hasMore: Number(stats.totalProducts) > products.length,
        products,
      },
    };
  } catch {
    return { ok: false as const, error: 'Не удалось безопасно загрузить ассортимент и остатки поставщика' };
  }
}

export async function getDentalLabWorkQueue(
  context: DentalLabWorkQueueContext,
): Promise<DentalLabWorkQueueResult> {
  if (
    !context.userId
    || !context.organizationId
    || context.organizationType !== 'LABORATORY'
    || !context.organizationOriginalId
    || (!DENTAL_LAB_AI_ORG_ROLES.has(String(context.role || '').trim().toUpperCase())
      && !DENTAL_LAB_AI_ASSIGNED_ROLES.has(String(context.role || '').trim().toUpperCase()))
  ) {
    return { ok: false, error: 'Нет подтверждённого рабочего пространства зуботехнической лаборатории' };
  }

  try {
    const organization = await prisma.organization.findUnique({
      where: { id: context.organizationId },
      select: { id: true, type: true, originalType: true, originalId: true, archivedAt: true, settings: true },
    });
    if (
      !organization
      || organization.archivedAt
      || organization.type !== 'LABORATORY'
      || organization.originalType !== 'Laboratory'
      || organization.originalId !== context.organizationOriginalId
      || !dentalLabSettingsReady(organization.settings)
    ) {
      return { ok: false, error: 'Текущее рабочее пространство не является зуботехнической лабораторией' };
    }

    const membership = await prisma.laboratoryMember.findFirst({
      where: { labId: context.organizationOriginalId, userId: context.userId },
      select: {
        role: true,
        lab: { select: { id: true, name: true, active: true } },
      },
    });
    const memberRole = String(membership?.role || '').trim().toLowerCase();
    const isOrganizationQueueRole = DENTAL_LAB_AI_ORG_ROLES.has(String(context.role || '').trim().toUpperCase());
    const hasOrganizationMembership = ['owner', 'admin'].includes(memberRole);
    const hasAssignedProductionMembership = isLabTechnicianRole(memberRole);
    if (
      !membership?.lab?.active
      || (isOrganizationQueueRole && !hasOrganizationMembership)
      || (!isOrganizationQueueRole && !hasAssignedProductionMembership)
    ) {
      return { ok: false, error: 'У вас нет доступа к производственной очереди этой лаборатории' };
    }

    const readScope = labMemberOrderReadScope({
      role: membership.role,
      userId: context.userId,
      labId: context.organizationOriginalId,
    });
    if (!readScope) return { ok: false, error: 'Нет разрешённой области чтения заказов' };

    const where = { ...readScope } as Prisma.LabOrderWhereInput;
    const [total, rows] = await Promise.all([
      prisma.labOrder.count({ where }),
      prisma.labOrder.findMany({
        where,
        select: { id: true, type: true, status: true, deadline: true, updatedAt: true, files: true },
        orderBy: [{ deadline: 'asc' }, { updatedAt: 'desc' }],
        take: 51,
      }),
    ]);

    const orders = rows.slice(0, 50).map((order) => {
      const meta = metaOf(order.files);
      return {
        id: order.id,
        type: safeText(order.type, 80) || 'Лабораторная работа',
        status: String(order.status),
        deadline: order.deadline,
        material: safeText(meta.material, 100),
        updatedAt: order.updatedAt,
      };
    });
    const byStatusReturned = orders.reduce<Record<string, number>>((counts, order) => {
      counts[order.status] = (counts[order.status] || 0) + 1;
      return counts;
    }, {});

    return {
      ok: true,
      data: {
        laboratory: { id: membership.lab.id, name: safeText(membership.lab.name, 120) || 'Зуботехническая лаборатория' },
        visibility: isOrganizationQueueRole ? 'laboratory_queue' : 'assigned_to_me',
        total,
        returned: orders.length,
        hasMore: total > orders.length,
        byStatusReturned,
        orders,
      },
    };
  } catch {
    // Keep errors free of patient identifiers, query values and database details.
    return { ok: false, error: 'Не удалось безопасно загрузить производственную очередь лаборатории' };
  }
}


/**
 * Read-only referral queue for an active medical-laboratory workspace.
 * Referral rows contain patient identity, IIN, contacts, symptoms, diagnoses,
 * instructions and result payloads. This projection selects only enum workflow
 * metadata and dates.
 */
export interface MedicalLabReferralQueueContext {
  userId: string;
  organizationId: string | null;
  organizationType: string | null;
  organizationOriginalId: string | null;
  role: string;
}

const MEDICAL_LAB_AI_ROLES = new Set([
  'MEDICAL_LAB_OWNER',
  'MEDICAL_LAB_ADMIN',
  'MEDICAL_LAB_QUALITY',
]);
const MEDICAL_LAB_MEMBER_ROLES = new Set([
  'owner', 'admin', 'quality',
  'medical_lab_owner', 'medical_lab_admin', 'medical_lab_quality',
]);

function medicalLabSettingsReady(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const settings = value as Record<string, unknown>;
  return settings.laboratoryType === 'MEDICAL_LAB'
    && settings.selfServiceType === 'medical_lab';
}

export async function getMedicalLabReferralQueue(context: MedicalLabReferralQueueContext) {
  const role = String(context.role || '').trim().toUpperCase();
  if (
    !context.userId
    || !context.organizationId
    || context.organizationType !== 'LABORATORY'
    || !context.organizationOriginalId
    || !MEDICAL_LAB_AI_ROLES.has(role)
  ) {
    return { ok: false as const, error: 'Нет подтверждённого рабочего пространства медицинской лаборатории' };
  }

  try {
    const organization = await prisma.organization.findUnique({
      where: { id: context.organizationId },
      select: { id: true, type: true, originalType: true, originalId: true, archivedAt: true, settings: true },
    });
    if (
      !organization
      || organization.archivedAt
      || organization.type !== 'LABORATORY'
      || organization.originalType !== 'Laboratory'
      || organization.originalId !== context.organizationOriginalId
      || !medicalLabSettingsReady(organization.settings)
    ) {
      return { ok: false as const, error: 'Текущее рабочее пространство не является активной медицинской лабораторией' };
    }

    const membership = await prisma.laboratoryMember.findFirst({
      where: { labId: context.organizationOriginalId, userId: context.userId },
      select: { role: true, lab: { select: { id: true, name: true, active: true } } },
    });
    const memberRole = String(membership?.role || '').trim().toLowerCase();
    if (!membership?.lab?.active || !MEDICAL_LAB_MEMBER_ROLES.has(memberRole)) {
      return { ok: false as const, error: 'У вас нет доступа к очереди медицинской лаборатории' };
    }

    const where = { labId: context.organizationOriginalId };
    const [total, rows, grouped] = await Promise.all([
      prisma.referral.count({ where }),
      prisma.referral.findMany({
        where,
        select: {
          id: true,
          category: true,
          priority: true,
          status: true,
          scheduledDate: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'desc' }],
        take: 51,
      }),
      prisma.referral.groupBy({ by: ['status'], where, _count: { _all: true } }),
    ]);

    const referrals = rows.slice(0, 50).map((row) => ({
      id: row.id,
      category: String(row.category),
      priority: String(row.priority),
      status: String(row.status),
      scheduledDate: row.scheduledDate,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
    const byStatus = grouped.reduce<Record<string, number>>((result, item) => {
      result[String(item.status)] = Number(item._count._all) || 0;
      return result;
    }, {});

    return {
      ok: true as const,
      data: {
        laboratory: {
          id: membership.lab.id,
          name: safeText(membership.lab.name, 120) || 'Медицинская лаборатория',
        },
        total,
        returned: referrals.length,
        hasMore: total > referrals.length,
        byStatus,
        referrals,
      },
    };
  } catch {
    return { ok: false as const, error: 'Не удалось безопасно загрузить очередь медицинской лаборатории' };
  }
}
