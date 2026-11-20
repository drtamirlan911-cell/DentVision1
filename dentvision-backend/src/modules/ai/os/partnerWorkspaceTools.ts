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
