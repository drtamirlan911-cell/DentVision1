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
import { canLabMemberReadOrders, isLabManagerRole, labMemberOrderReadScope } from '../../lab/labPlatform.authorization.js';

export interface DentalLabWorkQueueContext {
  userId: string;
  organizationId: string | null;
  organizationType: string | null;
  organizationOriginalId: string | null;
}

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
}

const DIAGNOSTIC_QUEUE_ROLES = new Set([
  'owner', 'admin', 'manager', 'radiologist', 'operator', 'reception', 'quality',
]);

export async function getDiagnosticCenterWorkQueue(context: DiagnosticCenterWorkQueueContext) {
  if (!context.userId || !context.organizationId || context.organizationType !== 'DIAGNOSTIC_CENTER' || !context.organizationOriginalId) {
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
    if (!membership?.center?.active || !DIAGNOSTIC_QUEUE_ROLES.has(String(membership.role || '').trim().toLowerCase())) {
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

export async function getDentalLabWorkQueue(
  context: DentalLabWorkQueueContext,
): Promise<DentalLabWorkQueueResult> {
  if (
    !context.userId
    || !context.organizationId
    || context.organizationType !== 'LABORATORY'
    || !context.organizationOriginalId
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
    if (!membership?.lab?.active || !canLabMemberReadOrders(membership.role)) {
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
        visibility: isLabManagerRole(membership.role) ? 'laboratory_queue' : 'assigned_to_me',
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
