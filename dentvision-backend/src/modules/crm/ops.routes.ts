/**
 * CRM operational resources — waiting list, expenses, promotions, price list.
 * Spec §05 mandatory finance/schedule/inventory adjacent flows.
 */
import { Router } from 'express';
import { createHash } from 'crypto';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { uid } from '../../lib/helpers.js';
import { publish } from '../../lib/events.js';
import { reserveIdempotencyKey, completeIdempotencyKey, deleteIdempotencyKey } from '../../lib/idempotency.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { WaitingListStatus } from '@prisma/client';
import { loadClinicAccess, blockClinicWrites } from '../../middleware/planGate.js';

import { splitPatientName } from '../public/bookingSlots.js';
import { resolveClinicBranchAccess } from '../../lib/clinicBranchAccess.js';
import { getPatientIdsForBranchScope } from '../../lib/patientBranchScope.js';

export const crmOpsRouter = Router();
crmOpsRouter.use(authenticate);
crmOpsRouter.use(loadClinicAccess);
crmOpsRouter.use(blockClinicWrites);

function requireClinic(req: AuthRequest, res: any): string | null {
  const clinicId = req.user?.clinicId;
  if (!clinicId) {
    res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    return null;
  }
  return clinicId;
}

interface OpsBranchContext {
  organizationWide: boolean;
  branchId: string | null;
  branchIds: string[];
  /** null means unrestricted organization context; [] means no visible patients. */
  patientIds: string[] | null;
}

async function resolveOpsBranchContext(
  req: AuthRequest,
  clinicId: string,
  requestedBranchId?: string | null,
): Promise<OpsBranchContext | null> {
  if (String(req.user?.role || '').toUpperCase() === 'SUPERADMIN') {
    return { organizationWide: true, branchId: null, branchIds: [], patientIds: null };
  }
  const access = await resolveClinicBranchAccess({
    userId: req.user?.id || '',
    clinicId,
    organizationId: req.user?.organizationId,
    role: String(req.user?.role || ''),
    requestedBranchId: requestedBranchId ?? req.user?.branchId,
  });
  if (!access) return null;
  const organizationWide = access.roleScope === 'ORGANIZATION' && access.branchId === null;
  const branchId = access.branchId;
  const branchIds = branchId ? [branchId] : access.allowedBranchIds;
  return {
    organizationWide,
    branchId,
    branchIds,
    patientIds: organizationWide ? null : await getPatientIdsForBranchScope(clinicId, branchIds),
  };
}

function expenseScopeWhere(context: OpsBranchContext, clinicId: string): Record<string, unknown> {
  return context.organizationWide ? { clinicId } : { clinicId, branchId: context.branchId };
}

function waitingListScopeWhere(context: OpsBranchContext, clinicId: string): Record<string, unknown> {
  return context.organizationWide
    ? { clinicId }
    : { clinicId, branchId: context.branchId };
}

function canManageWaitingListPatient(context: OpsBranchContext, patientId: string | null | undefined): boolean {
  return context.organizationWide || !patientId || Boolean(context.patientIds?.includes(patientId));
}

type BookingBranchContext = OpsBranchContext;

function bookingScopeWhere(context: BookingBranchContext, clinicId: string): Record<string, unknown> {
  return context.organizationWide ? { clinicId } : { clinicId, branchId: context.branchId };
}

async function resolveBookingBranchId(
  req: AuthRequest,
  clinicId: string,
  context: BookingBranchContext,
  doctorId: string | null | undefined,
  requestedBranchId?: string | null,
): Promise<string | null | undefined> {
  if (!doctorId) return context.organizationWide ? (context.branchId || null) : undefined;
  const access = await resolveClinicBranchAccess({
    userId: doctorId,
    clinicId,
    organizationId: req.user?.organizationId,
    role: 'DOCTOR',
    requestedBranchId: requestedBranchId ?? context.branchId ?? req.user?.branchId,
  });
  if (!access) return undefined;
  const branchId = access.branchId
    || (access.allowedBranchIds.length === 1 ? access.allowedBranchIds[0] : null);
  if (!branchId) return undefined;
  if (!context.organizationWide && context.branchId !== branchId) return undefined;
  return branchId;
}

// ─── Waiting list ───

crmOpsRouter.get('/waiting-list', requirePermission('patient.read'), async (req: AuthRequest, res) => {
  try {
    const clinicId = requireClinic(req, res);
    if (!clinicId) return;

    const branchContext = await resolveOpsBranchContext(req, clinicId);
    if (!branchContext) return res.status(403).json({ ok: false, error: 'Нет доступа к филиалу' } satisfies ApiResponse);
    const rows = await prisma.waitingList.findMany({
      where: waitingListScopeWhere(branchContext, clinicId),
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return res.json({
      ok: true,
      data: rows.map((r) => ({
        id: r.id,
        clinicId: r.clinicId,
        branchId: r.branchId,
        patientId: r.patientId,
        patientName: r.patientName,
        patientPhone: r.patientPhone,
        doctorId: r.doctorId,
        doctorName: r.doctorName,
        preferredDate: r.preferredDate ? r.preferredDate.toISOString().slice(0, 10) : null,
        preferredTime: r.preferredTime,
        preferredService: r.preferredService,
        notes: r.notes,
        status: r.status,
        // snake_case aliases for older Schedule.tsx handlers
        patient_id: r.patientId,
        patient_name: r.patientName,
        patient_phone: r.patientPhone,
        doctor_id: r.doctorId,
        doctor_name: r.doctorName,
        preferred_date: r.preferredDate ? r.preferredDate.toISOString().slice(0, 10) : null,
        preferred_time: r.preferredTime,
        preferred_service: r.preferredService,
      })),
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[CRM ops] waiting-list list', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить лист ожидания' } satisfies ApiResponse);
  }
});

crmOpsRouter.post('/waiting-list', requirePermission('patient.write'), async (req: AuthRequest, res) => {
  try {
    const clinicId = requireClinic(req, res);
    if (!clinicId) return;

    const b = req.body || {};
    const requestedBranchId = b.branchId ? String(b.branchId) : req.user?.branchId || null;
    const branchContext = await resolveOpsBranchContext(req, clinicId, requestedBranchId);
    if (!branchContext) return res.status(403).json({ ok: false, error: 'Нет доступа к филиалу' } satisfies ApiResponse);
    const patientId = b.patientId || b.patient_id || null;
    if (!canManageWaitingListPatient(branchContext, patientId)) {
      return res.status(403).json({ ok: false, error: 'Пациент не относится к текущему филиалу' } satisfies ApiResponse);
    }
    const id = b.id || uid();
    const existing = await prisma.waitingList.findFirst({
      where: { id, ...waitingListScopeWhere(branchContext, clinicId) },
    });
    const data = {
      clinicId,
      branchId: branchContext.organizationWide ? (existing?.branchId ?? null) : branchContext.branchId,
      patientId,
      patientName: b.patientName || b.patient_name || null,
      patientPhone: b.patientPhone || b.patient_phone || null,
      doctorId: b.doctorId || b.doctor_id || null,
      doctorName: b.doctorName || b.doctor_name || null,
      preferredDate: (b.preferredDate || b.preferred_date)
        ? new Date(b.preferredDate || b.preferred_date)
        : null,
      preferredTime: b.preferredTime || b.preferred_time || null,
      preferredService: b.preferredService || b.preferred_service || null,
      notes: b.notes || null,
      status: b.status || 'waiting',
    };

    const row = existing
      ? await prisma.waitingList.update({ where: { id }, data })
      : await prisma.waitingList.create({ data: { id, ...data } });

    return res.status(existing ? 200 : 201).json({ ok: true, data: row } satisfies ApiResponse);
  } catch (error) {
    console.error('[CRM ops] waiting-list upsert', error);
    return res.status(500).json({ ok: false, error: 'Не удалось сохранить лист ожидания' } satisfies ApiResponse);
  }
});

crmOpsRouter.patch('/waiting-list/:id', requirePermission('patient.write'), async (req: AuthRequest, res) => {
  try {
    const clinicId = requireClinic(req, res);
    if (!clinicId) return;
    const id = req.params.id as string;
    const initial = await prisma.waitingList.findFirst({ where: { id, clinicId } });
    if (!initial) return res.status(404).json({ ok: false, error: 'Не найдено' } satisfies ApiResponse);
    const b = req.body || {};
    const requestedBranchId = b.branchId ? String(b.branchId) : req.user?.branchId || initial.branchId || null;
    const branchContext = await resolveOpsBranchContext(req, clinicId, requestedBranchId);
    if (!branchContext) return res.status(403).json({ ok: false, error: 'Нет доступа к филиалу' } satisfies ApiResponse);
    const existing = await prisma.waitingList.findFirst({ where: { id, ...waitingListScopeWhere(branchContext, clinicId) } });
    if (!existing) return res.status(404).json({ ok: false, error: 'Не найдено' } satisfies ApiResponse);
    const nextPatientId = b.patientId ?? b.patient_id ?? existing.patientId;
    if (!canManageWaitingListPatient(branchContext, nextPatientId)) {
      return res.status(403).json({ ok: false, error: 'Для работы с листом ожидания нужен пациент из текущего филиала' } satisfies ApiResponse);
    }
    const data = {
      branchId: branchContext.organizationWide && b.branchId === undefined
        ? existing.branchId
        : branchContext.branchId,
      patientId: nextPatientId,
      patientName: b.patientName ?? b.patient_name ?? existing.patientName,
      patientPhone: b.patientPhone ?? b.patient_phone ?? existing.patientPhone,
      doctorId: b.doctorId ?? b.doctor_id ?? existing.doctorId,
      doctorName: b.doctorName ?? b.doctor_name ?? existing.doctorName,
      preferredDate: (b.preferredDate ?? b.preferred_date) !== undefined
        ? ((b.preferredDate ?? b.preferred_date) ? new Date(b.preferredDate ?? b.preferred_date) : null)
        : existing.preferredDate,
      preferredTime: b.preferredTime ?? b.preferred_time ?? existing.preferredTime,
      preferredService: b.preferredService ?? b.preferred_service ?? existing.preferredService,
      notes: b.notes ?? existing.notes,
      status: b.status !== undefined
        ? (Object.values(WaitingListStatus).includes(b.status) ? b.status : existing.status)
        : existing.status,
    };
    const row = await prisma.waitingList.update({ where: { id }, data });
    return res.json({ ok: true, data: row } satisfies ApiResponse);
  } catch (error) {
    console.error('[CRM ops] waiting-list update', error);
    return res.status(500).json({ ok: false, error: 'Не удалось обновить лист ожидания' } satisfies ApiResponse);
  }
});

crmOpsRouter.delete('/waiting-list/:id', requirePermission('patient.write'), async (req: AuthRequest, res) => {
  try {
    const clinicId = requireClinic(req, res);
    if (!clinicId) return;
    const id = req.params.id as string;
    const branchContext = await resolveOpsBranchContext(req, clinicId);
    if (!branchContext) return res.status(403).json({ ok: false, error: 'Нет доступа к филиалу' } satisfies ApiResponse);
    const existing = await prisma.waitingList.findFirst({ where: { id, ...waitingListScopeWhere(branchContext, clinicId) } });
    if (!existing) return res.status(404).json({ ok: false, error: 'Не найдено' } satisfies ApiResponse);
    await prisma.waitingList.deleteMany({ where: { id, ...waitingListScopeWhere(branchContext, clinicId) } });
    return res.json({ ok: true, data: { id } } satisfies ApiResponse);
  } catch (error) {
    console.error('[CRM ops] waiting-list delete', error);
    return res.status(500).json({ ok: false, error: 'Не удалось удалить' } satisfies ApiResponse);
  }
});

// ─── Expenses ───

crmOpsRouter.get('/expenses', requirePermission('finance.manage'), async (req: AuthRequest, res) => {
  try {
    const clinicId = requireClinic(req, res);
    if (!clinicId) return;
    const branchContext = await resolveOpsBranchContext(req, clinicId);
    if (!branchContext) return res.status(403).json({ ok: false, error: 'Нет доступа к филиалу расходов' } satisfies ApiResponse);
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    const rows = await prisma.expense.findMany({
      where: {
        ...expenseScopeWhere(branchContext, clinicId),
        ...(from || to
          ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
          : {}),
      },
      orderBy: { date: 'desc' },
      take: 300,
    });
    return res.json({
      ok: true,
      data: rows.map((r) => ({
        id: r.id,
        clinicId: r.clinicId,
        branchId: r.branchId,
        category: r.category || 'Прочее',
        amount: r.amount,
        notes: r.notes || r.description || '',
        date: r.date.toISOString().slice(0, 10),
        createdAt: r.createdAt,
      })),
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[CRM ops] expenses list', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить расходы' } satisfies ApiResponse);
  }
});

crmOpsRouter.post('/expenses', requirePermission('finance.manage'), async (req: AuthRequest, res) => {
  let idempotencyKey: string | undefined;
  let idempotencyKeyCompleted = false;
  try {
    const clinicId = requireClinic(req, res);
    if (!clinicId) return;
    const b = req.body || {};
    const amount = Number(b.amount);
    if (!Number.isFinite(amount)) {
      return res.status(400).json({ ok: false, error: 'Сумма обязательна' } satisfies ApiResponse);
    }

    // Guard the create path only, same as `billing.routes.ts` invoices:
    // `b.id` already makes an edit idempotent (upsert by id), but a *new*
    // expense's id is generated fresh per request, so a double-tap on
    // "Сохранить" had nothing stopping it from creating two expense rows.
    if (!b.id) {
      idempotencyKey = req.headers['idempotency-key'] as string | undefined;
      if (!idempotencyKey) {
        const hash = createHash('sha256')
          .update(`${req.user!.id}:${clinicId}:${JSON.stringify(b)}`)
          .digest('hex');
        idempotencyKey = `server-${hash.slice(0, 32)}`;
      }
      const reserved = await reserveIdempotencyKey(idempotencyKey);
      if (reserved.status === 'in_flight') {
        return res.status(409).json({ ok: false, error: 'Расход уже сохраняется, повторите позже' } satisfies ApiResponse);
      }
      if (reserved.status === 'exists') {
        const requestedBranchId = b.branchId ? String(b.branchId) : req.user?.branchId || null;
        const replayScope = await resolveOpsBranchContext(req, clinicId, requestedBranchId);
        if (!replayScope) return res.status(403).json({ ok: false, error: 'Нет доступа к филиалу расходов' } satisfies ApiResponse);
        const prior = await prisma.expense.findFirst({ where: { id: reserved.resultId, ...expenseScopeWhere(replayScope, clinicId) } });
        if (prior) {
          return res.status(200).json({ ok: true, data: prior } satisfies ApiResponse);
        }
        // IdempotencyRecord.key is global and shared by other modules. A result
        // outside this clinic/branch may belong to another resource; never
        // release that foreign key from the current request.
        return res.status(409).json({
          ok: false,
          error: 'Ключ идемпотентности уже использован. Повторите запрос с новым ключом.',
          code: 'IDEMPOTENCY_KEY_SCOPE_CONFLICT',
        } satisfies ApiResponse);
      }
    }

    const requestedBranchId = b.branchId ? String(b.branchId) : req.user?.branchId || null;
    const branchContext = await resolveOpsBranchContext(req, clinicId, requestedBranchId);
    if (!branchContext) return res.status(403).json({ ok: false, error: 'Нет доступа к филиалу расходов' } satisfies ApiResponse);

    const id = b.id || uid();
    const data = {
      clinicId,
      ...(branchContext.organizationWide && !requestedBranchId
        ? {}
        : { branchId: branchContext.branchId }),
      category: b.category || b.categoryId || 'Прочее',
      amount,
      description: b.description || b.notes || null,
      notes: b.notes || null,
      date: b.date ? new Date(b.date) : new Date(),
    };
    const existing = await prisma.expense.findFirst({ where: { id, ...expenseScopeWhere(branchContext, clinicId) } });
    const row = existing
      ? await prisma.expense.update({ where: { id }, data })
      : await prisma.expense.create({ data: { id, ...data } });

    if (idempotencyKey) {
      await completeIdempotencyKey(idempotencyKey, row.id);
      idempotencyKeyCompleted = true;
    }

    return res.status(existing ? 200 : 201).json({ ok: true, data: row } satisfies ApiResponse);
  } catch (error) {
    if (idempotencyKey && !idempotencyKeyCompleted) {
      await deleteIdempotencyKey(idempotencyKey);
    }
    console.error('[CRM ops] expenses upsert', error);
    return res.status(500).json({ ok: false, error: 'Не удалось сохранить расход' } satisfies ApiResponse);
  }
});

crmOpsRouter.delete('/expenses/:id', requirePermission('finance.manage'), async (req: AuthRequest, res) => {
  try {
    const clinicId = requireClinic(req, res);
    if (!clinicId) return;
    const id = req.params.id as string;
    const branchContext = await resolveOpsBranchContext(req, clinicId);
    if (!branchContext) return res.status(403).json({ ok: false, error: 'Нет доступа к филиалу расходов' } satisfies ApiResponse);
    const existing = await prisma.expense.findFirst({ where: { id, ...expenseScopeWhere(branchContext, clinicId) } });
    if (!existing) return res.status(404).json({ ok: false, error: 'Не найдено' } satisfies ApiResponse);
    await prisma.expense.deleteMany({ where: { id, ...expenseScopeWhere(branchContext, clinicId) } });
    return res.json({ ok: true, data: { id } } satisfies ApiResponse);
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Не удалось удалить расход' } satisfies ApiResponse);
  }
});

// ─── Promotions ───

crmOpsRouter.get('/promotions', requirePermission('patient.read'), async (req: AuthRequest, res) => {
  try {
    const clinicId = requireClinic(req, res);
    if (!clinicId) return;
    const rows = await prisma.promotion.findMany({
      where: { clinicId },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({
      ok: true,
      data: rows.map((r) => ({
        id: r.id,
        clinicId: r.clinicId,
        title: r.title,
        description: r.description,
        discountPercent: r.discountPercent ?? 0,
        serviceIds: Array.isArray(r.serviceIds) ? r.serviceIds : [],
        startDate: r.startDate ? r.startDate.toISOString().slice(0, 10) : null,
        endDate: r.endDate ? r.endDate.toISOString().slice(0, 10) : null,
        imageUrl: r.imageUrl,
        status: r.active ? 'active' : 'inactive',
        active: r.active,
      })),
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[CRM ops] promotions list', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить акции' } satisfies ApiResponse);
  }
});

crmOpsRouter.post('/promotions', requirePermission('patient.write'), async (req: AuthRequest, res) => {
  try {
    const clinicId = requireClinic(req, res);
    if (!clinicId) return;
    const b = req.body || {};
    if (!b.title) return res.status(400).json({ ok: false, error: 'Название обязательно' } satisfies ApiResponse);
    const id = b.id || uid();
    const active = b.active !== undefined
      ? !!b.active
      : b.status
        ? b.status === 'active'
        : true;
    const data = {
      clinicId,
      title: b.title,
      description: b.description || null,
      discountPercent: b.discountPercent != null ? Number(b.discountPercent) : 0,
      serviceIds: b.serviceIds || [],
      startDate: b.startDate ? new Date(b.startDate) : null,
      endDate: b.endDate ? new Date(b.endDate) : null,
      imageUrl: b.imageUrl || null,
      active,
    };
    const existing = await prisma.promotion.findFirst({ where: { id, clinicId } });
    const row = existing
      ? await prisma.promotion.update({ where: { id }, data })
      : await prisma.promotion.create({ data: { id, ...data } });
    return res.status(existing ? 200 : 201).json({ ok: true, data: row } satisfies ApiResponse);
  } catch (error) {
    console.error('[CRM ops] promotions upsert', error);
    return res.status(500).json({ ok: false, error: 'Не удалось сохранить акцию' } satisfies ApiResponse);
  }
});

crmOpsRouter.delete('/promotions/:id', requirePermission('patient.write'), async (req: AuthRequest, res) => {
  try {
    const clinicId = requireClinic(req, res);
    if (!clinicId) return;
    const id = req.params.id as string;
    const existing = await prisma.promotion.findFirst({ where: { id, clinicId } });
    if (!existing) return res.status(404).json({ ok: false, error: 'Не найдено' } satisfies ApiResponse);
    await prisma.promotion.delete({ where: { id } });
    return res.json({ ok: true, data: { id } } satisfies ApiResponse);
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Не удалось удалить акцию' } satisfies ApiResponse);
  }
});

// ─── Price list ───

crmOpsRouter.get('/price-list', requirePermission('patient.read'), async (req: AuthRequest, res) => {
  try {
    const clinicId = requireClinic(req, res);
    if (!clinicId) return;
    const rows = await prisma.priceListItem.findMany({
      where: { clinicId, active: true },
      orderBy: { serviceCode: 'asc' },
    });
    return res.json({ ok: true, data: rows } satisfies ApiResponse);
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить прайс' } satisfies ApiResponse);
  }
});

crmOpsRouter.post('/price-list', requirePermission('patient.write'), async (req: AuthRequest, res) => {
  try {
    const clinicId = requireClinic(req, res);
    if (!clinicId) return;
    const b = req.body || {};
    if (!b.serviceCode || b.price == null) {
      return res.status(400).json({ ok: false, error: 'serviceCode и price обязательны' } satisfies ApiResponse);
    }
    const row = await prisma.priceListItem.upsert({
      where: { clinicId_serviceCode: { clinicId, serviceCode: String(b.serviceCode) } },
      create: {
        id: uid(),
        clinicId,
        serviceCode: String(b.serviceCode),
        name: b.name || null,
        price: Number(b.price),
        matCost: Number(b.matCost || 0),
        active: b.active !== false,
      },
      update: {
        name: b.name ?? undefined,
        price: Number(b.price),
        matCost: b.matCost !== undefined ? Number(b.matCost) : undefined,
        active: b.active !== false,
      },
    });
    return res.json({ ok: true, data: row } satisfies ApiResponse);
  } catch (error) {
    console.error('[CRM ops] price-list upsert', error);
    return res.status(500).json({ ok: false, error: 'Не удалось сохранить цену' } satisfies ApiResponse);
  }
});

// ─── Online bookings ───

function mapBookingRow(r: {
  id: string;
  clinicId: string;
  branchId: string | null;
  patientName: string;
  phone: string;
  email: string | null;
  doctorId: string | null;
  doctorName: string | null;
  serviceName: string | null;
  date: Date;
  time: string;
  notes: string | null;
  status: string;
  source: string;
  createdAt: Date;
}) {
  return {
    id: r.id,
    clinicId: r.clinicId,
    branchId: r.branchId,
    patientName: r.patientName,
    patientPhone: r.phone,
    phone: r.phone,
    patientEmail: r.email,
    email: r.email,
    doctorId: r.doctorId,
    doctorName: r.doctorName,
    serviceName: r.serviceName,
    date: r.date.toISOString().slice(0, 10),
    time: r.time,
    notes: r.notes,
    status: r.status,
    source: r.source,
    createdAt: r.createdAt.toISOString(),
  };
}

crmOpsRouter.get('/bookings', requirePermission('appointment.read'), async (req: AuthRequest, res) => {
  try {
    const clinicId = requireClinic(req, res);
    if (!clinicId) return;
    const branchContext = await resolveOpsBranchContext(req, clinicId);
    if (!branchContext) return res.status(403).json({ ok: false, error: 'Нет доступа к филиалу заявок' } satisfies ApiResponse);
    const status = (req.query.status as string) || undefined;
    const rows = await prisma.booking.findMany({
      where: {
        ...bookingScopeWhere(branchContext, clinicId),
        ...(status ? { status: status as any } : {}),
      },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
      take: 300,
    });
    return res.json({ ok: true, data: rows.map(mapBookingRow) } satisfies ApiResponse);
  } catch (error) {
    console.error('[CRM ops] bookings list', error);
    return res.status(500).json({ ok: false, error: 'Не удалось загрузить заявки' } satisfies ApiResponse);
  }
});

crmOpsRouter.post('/bookings', requirePermission('appointment.write'), async (req: AuthRequest, res) => {
  try {
    const clinicId = requireClinic(req, res);
    if (!clinicId) return;
    const b = req.body || {};
    const id = b.id || uid();
    const initial = b.id
      ? await prisma.booking.findFirst({ where: { id, clinicId }, select: { id: true, branchId: true } })
      : null;
    const requestedBranchId = b.branchId
      ? String(b.branchId)
      : req.user?.branchId || initial?.branchId || null;
    const branchContext = await resolveOpsBranchContext(req, clinicId, requestedBranchId);
    if (!branchContext) return res.status(403).json({ ok: false, error: 'Нет доступа к филиалу заявок' } satisfies ApiResponse);

    const dateStr = b.date;
    if (!dateStr || !b.time || !b.patientName) {
      return res.status(400).json({ ok: false, error: 'Имя, дата и время обязательны' } satisfies ApiResponse);
    }
    const doctorId = b.doctorId
      ? String(b.doctorId)
      : String(req.user?.role || '').toUpperCase() === 'DOCTOR'
        ? req.user?.id || null
        : null;
    const bookingBranchId = await resolveBookingBranchId(
      req,
      clinicId,
      branchContext,
      doctorId,
      requestedBranchId,
    );
    if (bookingBranchId === undefined) {
      return res.status(403).json({
        ok: false,
        error: 'Для заявки выберите врача с активным доступом к филиалу',
      } satisfies ApiResponse);
    }

    const existing = initial
      ? await prisma.booking.findFirst({ where: { id, ...bookingScopeWhere(branchContext, clinicId) } })
      : null;
    if (initial && !existing) {
      return res.status(404).json({ ok: false, error: 'Заявка не найдена' } satisfies ApiResponse);
    }

    const data = {
      clinicId,
      branchId: bookingBranchId,
      patientName: String(b.patientName).trim(),
      phone: String(b.phone || b.patientPhone || '').replace(/\D/g, ''),
      email: b.email || b.patientEmail || null,
      doctorId,
      doctorName: b.doctorName || null,
      serviceName: b.serviceName || null,
      date: new Date(`${dateStr}T00:00:00.000Z`),
      time: String(b.time),
      notes: b.notes || null,
      status: b.status || 'pending',
      source: b.source || 'manual',
    };
    const row = existing
      ? await prisma.booking.update({ where: { id }, data })
      : await prisma.booking.create({ data: { id, ...data } });
    return res.status(existing ? 200 : 201).json({ ok: true, data: mapBookingRow(row) } satisfies ApiResponse);
  } catch (error) {
    console.error('[CRM ops] bookings upsert', error);
    return res.status(500).json({ ok: false, error: 'Не удалось сохранить заявку' } satisfies ApiResponse);
  }
});

crmOpsRouter.post('/bookings/:id/confirm', requirePermission('appointment.write'), async (req: AuthRequest, res) => {
  try {
    const clinicId = requireClinic(req, res);
    if (!clinicId) return;
    const id = req.params.id as string;
    const requestBody = req.body || {};
    const initial = await prisma.booking.findFirst({
      where: { id, clinicId },
      select: { id: true, branchId: true },
    });
    if (!initial) return res.status(404).json({ ok: false, error: 'Заявка не найдена' } satisfies ApiResponse);

    const requestedBranchId = requestBody.branchId
      ? String(requestBody.branchId)
      : req.user?.branchId || initial.branchId || null;
    const branchContext = await resolveOpsBranchContext(req, clinicId, requestedBranchId);
    if (!branchContext) return res.status(403).json({ ok: false, error: 'Нет доступа к филиалу заявки' } satisfies ApiResponse);
    const booking = await prisma.booking.findFirst({
      where: { id, ...bookingScopeWhere(branchContext, clinicId) },
    });
    if (!booking) return res.status(404).json({ ok: false, error: 'Заявка не найдена' } satisfies ApiResponse);
    if (booking.status === 'confirmed') {
      return res.json({ ok: true, data: mapBookingRow(booking), message: 'Уже подтверждена' } satisfies ApiResponse);
    }

    const doctorId = booking.doctorId
      || (requestBody.doctorId ? String(requestBody.doctorId) : null)
      || (String(req.user?.role || '').toUpperCase() === 'DOCTOR' ? req.user?.id || null : null);
    const appointmentBranchId = await resolveBookingBranchId(
      req,
      clinicId,
      branchContext,
      doctorId,
      requestBody.branchId ? String(requestBody.branchId) : booking.branchId || requestedBranchId,
    );
    if (!doctorId || !appointmentBranchId) {
      return res.status(400).json({
        ok: false,
        error: 'Перед подтверждением укажите врача и филиал, в котором он работает',
      } satisfies ApiResponse);
    }
    if (booking.branchId && booking.branchId !== appointmentBranchId) {
      return res.status(409).json({ ok: false, error: 'Филиал заявки не совпадает с филиалом врача' } satisfies ApiResponse);
    }

    const phone = booking.phone.replace(/\D/g, '');
    let patient = phone
      ? await prisma.patient.findFirst({
        where: { clinicId, branchId: appointmentBranchId, phone: { contains: phone.slice(-10) } },
      })
      : null;
    if (!patient && phone) {
      const elsewhere = await prisma.patient.findFirst({
        where: { clinicId, phone: { contains: phone.slice(-10) } },
        select: { id: true },
      });
      if (elsewhere) {
        return res.status(409).json({
          ok: false,
          error: 'Пациент уже зарегистрирован в другом филиале. Передайте заявку администратору клиники.',
        } satisfies ApiResponse);
      }
    }

    if (!patient) {
      const { firstName, lastName } = splitPatientName(booking.patientName);
      patient = await prisma.patient.create({
        data: {
          id: uid(),
          clinicId,
          branchId: appointmentBranchId,
          firstName,
          lastName,
          phone: booking.phone,
          email: booking.email,
          noIinReason: 'created_without_iin',
        },
      });
    }

    const dateStr = booking.date.toISOString().slice(0, 10);
    const appointment = await prisma.appointment.create({
      data: {
        id: uid(),
        clinicId,
        branchId: appointmentBranchId,
        patientId: patient.id,
        doctorId,
        date: new Date(`${dateStr}T12:00:00.000Z`),
        time: booking.time,
        status: 'confirmed',
        type: booking.serviceName || 'Приём',
        notes: booking.notes || `Онлайн-запись: ${booking.patientName}`,
        meta: {
          serviceName: booking.serviceName || undefined,
          reason: 'online_booking',
          bookingId: booking.id,
        },
      },
    });

    publish('appointment.created', {
      clinicId,
      appointmentId: appointment.id,
      patientId: patient.id,
      doctorId,
      userId: req.user?.id,
    });

    const updated = await prisma.booking.update({
      where: { id },
      data: { status: 'confirmed', branchId: appointmentBranchId },
    });

    return res.json({
      ok: true,
      data: {
        booking: mapBookingRow(updated),
        appointmentId: appointment.id,
        patientId: patient.id,
      },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[CRM ops] bookings confirm', error);
    return res.status(500).json({ ok: false, error: 'Не удалось подтвердить заявку' } satisfies ApiResponse);
  }
});

crmOpsRouter.delete('/bookings/:id', requirePermission('appointment.write'), async (req: AuthRequest, res) => {
  try {
    const clinicId = requireClinic(req, res);
    if (!clinicId) return;
    const id = req.params.id as string;
    const initial = await prisma.booking.findFirst({
      where: { id, clinicId },
      select: { id: true, branchId: true },
    });
    if (!initial) return res.status(404).json({ ok: false, error: 'Не найдено' } satisfies ApiResponse);
    const branchContext = await resolveOpsBranchContext(req, clinicId, req.user?.branchId || initial.branchId || null);
    if (!branchContext) return res.status(403).json({ ok: false, error: 'Нет доступа к филиалу заявки' } satisfies ApiResponse);
    const existing = await prisma.booking.findFirst({ where: { id, ...bookingScopeWhere(branchContext, clinicId) } });
    if (!existing) return res.status(404).json({ ok: false, error: 'Не найдено' } satisfies ApiResponse);
    await prisma.booking.updateMany({
      where: { id, ...bookingScopeWhere(branchContext, clinicId) },
      data: { status: 'cancelled' },
    });
    return res.json({ ok: true, data: { id } } satisfies ApiResponse);
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Не удалось отменить заявку' } satisfies ApiResponse);
  }
});
