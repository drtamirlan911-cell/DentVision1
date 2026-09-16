import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requireSuperadmin } from '../../middleware/rbac.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { uid, paginate, paginatedResponse } from '../../lib/helpers.js';
import branchesRouter from '../branches/branches.routes.js';

export const organizationsRouter = Router();

organizationsRouter.use(authenticate);
organizationsRouter.use('/branches', branchesRouter);

/** Universal self-service onboarding for every organization type already supported by the backend. */
const SELF_SERVICE_TYPES = {
  clinic: { orgType: 'CLINIC', nextPath: '/crm' },
  dental_lab: { orgType: 'LABORATORY', nextPath: '/diagnostics/laboratory-dashboard' },
  medical_lab: { orgType: 'LABORATORY', nextPath: '/diagnostics/laboratory-dashboard' },
  diagnostic_center: { orgType: 'DIAGNOSTIC_CENTER', nextPath: '/diagnostics/center-dashboard' },
  academy: { orgType: 'ACADEMY', nextPath: '/school' },
  supplier: { orgType: 'SUPPLIER_COMPANY', nextPath: '/supplier' },
} as const;

type SelfServiceType = keyof typeof SELF_SERVICE_TYPES;

function selfServiceType(value: unknown): SelfServiceType | null {
  const key = String(value || '').trim().toLowerCase() as SelfServiceType;
  return key in SELF_SERVICE_TYPES ? key : null;
}

async function ensurePersonRole(userId: string, organizationId: string, roleKey: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, firstName: true, lastName: true, email: true, phone: true } });
  if (!user) throw new Error('Пользователь не найден');
  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true } });
  if (!organization) throw new Error('Организация не найдена');
  const person = await prisma.person.upsert({
    where: { originalType_originalId: { originalType: 'SelfServiceOwner', originalId: `${organizationId}:${userId}` } },
    update: { fullName: `${user.firstName} ${user.lastName}`.trim() || organization.name, organizationId, userId: user.id, email: user.email, phone: user.phone || undefined },
    create: { id: uid(), fullName: `${user.firstName} ${user.lastName}`.trim() || organization.name, personType: 'STAFF', organizationId, userId: user.id, email: user.email, phone: user.phone || undefined, originalType: 'SelfServiceOwner', originalId: `${organizationId}:${userId}` },
  });
  const role = await prisma.role.findUnique({ where: { key: roleKey } });
  if (role) await prisma.personRole.upsert({
    where: { personId_roleId: { personId: person.id, roleId: role.id } },
    update: { scopeType: 'organization', scopeId: organizationId },
    create: { personId: person.id, roleId: role.id, scopeType: 'organization', scopeId: organizationId },
  });
  return person.id;
}

// POST /api/organizations/self-service
// Creates the real domain entity plus its canonical Organization record and owner membership.
organizationsRouter.post('/self-service', async (req: AuthRequest, res) => {
  try {
    const type = selfServiceType(req.body?.type);
    if (!type) return res.status(400).json({ ok: false, error: `Неподдерживаемый тип. Доступно: ${Object.keys(SELF_SERVICE_TYPES).join(', ')}` } satisfies ApiResponse);
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ ok: false, error: 'Название обязательно' } satisfies ApiResponse);

    const city = req.body?.city ? String(req.body.city).trim() : null;
    const address = req.body?.address ? String(req.body.address).trim() : null;
    const phone = req.body?.phone ? String(req.body.phone).trim() : req.user?.phone || null;
    const email = req.body?.email ? String(req.body.email).trim().toLowerCase() : req.user?.email || null;
    const taxId = req.body?.taxId ? String(req.body.taxId).trim() : null;

    let entityId: string;
    let organizationId: string;
    let entity: unknown;

    if (type === 'clinic') {
      entityId = uid();
      entity = await prisma.clinic.create({ data: { id: entityId, name, city, address, phone, plan: 'DEMO', active: true } });
      organizationId = uid();
      await prisma.organization.create({ data: { id: organizationId, name, type: 'CLINIC' as any, taxId, address, phone, email, originalType: 'Clinic', originalId: entityId, settings: { verification: 'PENDING' } as any } });
      await prisma.clinicMember.create({ data: { userId: req.user!.id, clinicId: entityId, role: 'OWNER' } });
    } else if (type === 'diagnostic_center') {
      entityId = uid();
      entity = await prisma.diagnosticCenter.create({ data: { id: entityId, name, city: city || undefined, address: address || undefined, phone: phone || undefined, email: email || undefined, active: true } });
      organizationId = entityId;
      await prisma.organization.upsert({ where: { originalType_originalId: { originalType: 'DiagnosticCenter', originalId: entityId } }, update: { name, address, phone, email, taxId, settings: { verification: 'PENDING' } as any }, create: { id: entityId, name, type: 'DIAGNOSTIC_CENTER' as any, address, phone, email, taxId, contacts: city ? { city } : undefined, originalType: 'DiagnosticCenter', originalId: entityId, settings: { verification: 'PENDING' } as any } });
      await prisma.diagnosticCenterMember.create({ data: { id: uid(), centerId: entityId, userId: req.user!.id, role: 'owner' } });
    } else if (type === 'dental_lab' || type === 'medical_lab') {
      entityId = uid();
      entity = await prisma.laboratory.create({ data: { id: entityId, name, city: city || undefined, address: address || undefined, phone: phone || undefined, email: email || undefined, active: true } });
      organizationId = entityId;
      await prisma.organization.upsert({ where: { originalType_originalId: { originalType: 'Laboratory', originalId: entityId } }, update: { name, address, phone, email, taxId, settings: { verification: 'PENDING', laboratoryType: type === 'dental_lab' ? 'DENTAL_LAB' : 'MEDICAL_LAB' } as any }, create: { id: entityId, name, type: 'LABORATORY' as any, address, phone, email, taxId, originalType: 'Laboratory', originalId: entityId, settings: { verification: 'PENDING', laboratoryType: type === 'dental_lab' ? 'DENTAL_LAB' : 'MEDICAL_LAB' } as any } });
      await prisma.laboratoryMember.create({ data: { id: uid(), labId: entityId, userId: req.user!.id, role: 'owner' } });
    } else if (type === 'supplier') {
      entityId = uid();
      entity = await prisma.supplier.create({ data: { id: entityId, name, kind: 'SUPPLIER', bin: taxId, legalAddress: address, contactPerson: `${req.user!.firstName} ${req.user!.lastName}`.trim() || null, phone, email, status: 'pending', commissionRate: 1000, members: { create: { userId: req.user!.id, role: 'owner' } } } });
      organizationId = uid();
      await prisma.organization.create({ data: { id: organizationId, name, type: 'SUPPLIER_COMPANY' as any, taxId, address, phone, email, originalType: 'Supplier', originalId: entityId, settings: { verification: 'PENDING' } as any } });
    } else {
      entityId = uid();
      entity = await prisma.academy.create({ data: { id: entityId, name, city: city || null, ownerId: req.user!.id } });
      organizationId = uid();
      await prisma.organization.create({ data: { id: organizationId, name, type: 'ACADEMY' as any, taxId, address, phone, email, originalType: 'Academy', originalId: entityId, settings: { verification: 'PENDING' } as any } });
    }

    await prisma.user.update({ where: { id: req.user!.id }, data: { role: 'OWNER' } });
    const personId = await ensurePersonRole(req.user!.id, organizationId, type === 'supplier' ? 'seller' : 'owner');
    return res.status(201).json({ ok: true, data: { entityId, organizationId, entity, personId, type, verification: 'PENDING', nextPath: SELF_SERVICE_TYPES[type].nextPath } } satisfies ApiResponse);
  } catch (error) {
    console.error('[organizations] self-service onboarding error:', error);
    return res.status(400).json({ ok: false, error: error instanceof Error ? error.message : 'Не удалось создать организацию' } satisfies ApiResponse);
  }
});

// Platform-wide entity CRUD spans every clinic/supplier/academy/center/lab — only superadmin.
organizationsRouter.use(requireSuperadmin);

organizationsRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const type = req.query.type as string | undefined;
    const search = (req.query.search as string) || '';
    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (search) where.name = { contains: search, mode: 'insensitive' };
    const { skip, take } = paginate(page, limit);
    const [data, total] = await Promise.all([
      prisma.organization.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
      prisma.organization.count({ where }),
    ]);
    return res.json({ ok: true, ...paginatedResponse(data, total, page, limit) } satisfies ApiResponse);
  } catch (error) {
    console.error('[organizations] list error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить список организаций' } satisfies ApiResponse);
  }
});

organizationsRouter.get('/:id', async (req: AuthRequest, res) => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: String(req.params.id) } });
    if (!org) return res.status(404).json({ ok: false, error: 'Организация не найдена' } satisfies ApiResponse);
    return res.json({ ok: true, data: org } satisfies ApiResponse);
  } catch (error) {
    console.error('[organizations] get error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить организацию' } satisfies ApiResponse);
  }
});

organizationsRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, type, taxId, address, phone, email, logo, contacts, settings } = req.body as {
      name: string; type: string; taxId?: string; address?: string; phone?: string;
      email?: string; logo?: string; contacts?: Prisma.InputJsonValue; settings?: Prisma.InputJsonValue;
    };
    if (!name || !type) return res.status(400).json({ ok: false, error: 'name и type обязательны' } satisfies ApiResponse);
    const org = await prisma.organization.create({ data: { id: uid(), name, type, taxId, address, phone, email, logo, contacts, settings } });
    return res.status(201).json({ ok: true, data: org } satisfies ApiResponse);
  } catch (error) {
    console.error('[organizations] create error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось создать организацию' } satisfies ApiResponse);
  }
});

organizationsRouter.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const { name, type, taxId, address, phone, email, logo, contacts, settings } = req.body as {
      name?: string; type?: string; taxId?: string; address?: string; phone?: string;
      email?: string; logo?: string; contacts?: Prisma.InputJsonValue; settings?: Prisma.InputJsonValue;
    };
    const existing = await prisma.organization.findUnique({ where: { id: String(req.params.id) } });
    if (!existing) return res.status(404).json({ ok: false, error: 'Организация не найдена' } satisfies ApiResponse);
    const org = await prisma.organization.update({ where: { id: String(req.params.id) }, data: { name, type, taxId, address, phone, email, logo, contacts, settings } });
    return res.json({ ok: true, data: org } satisfies ApiResponse);
  } catch (error) {
    console.error('[organizations] update error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось обновить организацию' } satisfies ApiResponse);
  }
});

organizationsRouter.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.organization.findUnique({ where: { id: String(req.params.id) } });
    if (!existing) return res.status(404).json({ ok: false, error: 'Организация не найдена' } satisfies ApiResponse);
    await prisma.organization.delete({ where: { id: String(req.params.id) } });
    return res.json({ ok: true, data: null } satisfies ApiResponse);
  } catch (error) {
    console.error('[organizations] delete error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось удалить организацию' } satisfies ApiResponse);
  }
});
