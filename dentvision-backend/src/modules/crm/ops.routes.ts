/**
 * CRM operational resources — waiting list, expenses, promotions, price list.
 * Spec §05 mandatory finance/schedule/inventory adjacent flows.
 */
import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { uid } from '../../lib/helpers.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';

export const crmOpsRouter = Router();
crmOpsRouter.use(authenticate);

function requireClinic(req: AuthRequest, res: any): string | null {
  const clinicId = req.user?.clinicId;
  if (!clinicId) {
    res.status(400).json({ ok: false, error: 'Клиника не указана' } satisfies ApiResponse);
    return null;
  }
  return clinicId;
}

// ─── Waiting list ───

crmOpsRouter.get('/waiting-list', async (req: AuthRequest, res) => {
  try {
    const clinicId = requireClinic(req, res);
    if (!clinicId) return;

    const rows = await prisma.waitingList.findMany({
      where: { clinicId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return res.json({
      ok: true,
      data: rows.map((r) => ({
        id: r.id,
        clinicId: r.clinicId,
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
        doctor_id: r.doctorId,
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

crmOpsRouter.post('/waiting-list', async (req: AuthRequest, res) => {
  try {
    const clinicId = requireClinic(req, res);
    if (!clinicId) return;

    const b = req.body || {};
    const id = b.id || uid();
    const data = {
      clinicId,
      patientId: b.patientId || b.patient_id || null,
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

    const existing = await prisma.waitingList.findFirst({ where: { id, clinicId } });
    const row = existing
      ? await prisma.waitingList.update({ where: { id }, data })
      : await prisma.waitingList.create({ data: { id, ...data } });

    return res.status(existing ? 200 : 201).json({ ok: true, data: row } satisfies ApiResponse);
  } catch (error) {
    console.error('[CRM ops] waiting-list upsert', error);
    return res.status(500).json({ ok: false, error: 'Не удалось сохранить лист ожидания' } satisfies ApiResponse);
  }
});

crmOpsRouter.delete('/waiting-list/:id', async (req: AuthRequest, res) => {
  try {
    const clinicId = requireClinic(req, res);
    if (!clinicId) return;
    const id = req.params.id as string;
    const existing = await prisma.waitingList.findFirst({ where: { id, clinicId } });
    if (!existing) return res.status(404).json({ ok: false, error: 'Не найдено' } satisfies ApiResponse);
    await prisma.waitingList.delete({ where: { id } });
    return res.json({ ok: true, data: { id } } satisfies ApiResponse);
  } catch (error) {
    console.error('[CRM ops] waiting-list delete', error);
    return res.status(500).json({ ok: false, error: 'Не удалось удалить' } satisfies ApiResponse);
  }
});

// ─── Expenses ───

crmOpsRouter.get('/expenses', async (req: AuthRequest, res) => {
  try {
    const clinicId = requireClinic(req, res);
    if (!clinicId) return;
    const rows = await prisma.expense.findMany({
      where: { clinicId },
      orderBy: { date: 'desc' },
      take: 300,
    });
    return res.json({
      ok: true,
      data: rows.map((r) => ({
        id: r.id,
        clinicId: r.clinicId,
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

crmOpsRouter.post('/expenses', async (req: AuthRequest, res) => {
  try {
    const clinicId = requireClinic(req, res);
    if (!clinicId) return;
    const b = req.body || {};
    const amount = Number(b.amount);
    if (!Number.isFinite(amount)) {
      return res.status(400).json({ ok: false, error: 'Сумма обязательна' } satisfies ApiResponse);
    }
    const id = b.id || uid();
    const data = {
      clinicId,
      category: b.category || b.categoryId || 'Прочее',
      amount,
      description: b.description || b.notes || null,
      notes: b.notes || null,
      date: b.date ? new Date(b.date) : new Date(),
    };
    const existing = await prisma.expense.findFirst({ where: { id, clinicId } });
    const row = existing
      ? await prisma.expense.update({ where: { id }, data })
      : await prisma.expense.create({ data: { id, ...data } });
    return res.status(existing ? 200 : 201).json({ ok: true, data: row } satisfies ApiResponse);
  } catch (error) {
    console.error('[CRM ops] expenses upsert', error);
    return res.status(500).json({ ok: false, error: 'Не удалось сохранить расход' } satisfies ApiResponse);
  }
});

crmOpsRouter.delete('/expenses/:id', async (req: AuthRequest, res) => {
  try {
    const clinicId = requireClinic(req, res);
    if (!clinicId) return;
    const id = req.params.id as string;
    const existing = await prisma.expense.findFirst({ where: { id, clinicId } });
    if (!existing) return res.status(404).json({ ok: false, error: 'Не найдено' } satisfies ApiResponse);
    await prisma.expense.delete({ where: { id } });
    return res.json({ ok: true, data: { id } } satisfies ApiResponse);
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Не удалось удалить расход' } satisfies ApiResponse);
  }
});

// ─── Promotions ───

crmOpsRouter.get('/promotions', async (req: AuthRequest, res) => {
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

crmOpsRouter.post('/promotions', async (req: AuthRequest, res) => {
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

crmOpsRouter.delete('/promotions/:id', async (req: AuthRequest, res) => {
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

crmOpsRouter.get('/price-list', async (req: AuthRequest, res) => {
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

crmOpsRouter.post('/price-list', async (req: AuthRequest, res) => {
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
        active: b.active !== false,
      },
      update: {
        name: b.name ?? undefined,
        price: Number(b.price),
        active: b.active !== false,
      },
    });
    return res.json({ ok: true, data: row } satisfies ApiResponse);
  } catch (error) {
    console.error('[CRM ops] price-list upsert', error);
    return res.status(500).json({ ok: false, error: 'Не удалось сохранить цену' } satisfies ApiResponse);
  }
});
