import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requireSuperadmin } from '../../middleware/rbac.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';
import { uid, paginate, paginatedResponse } from '../../lib/helpers.js';
import branchesRouter from '../branches/branches.routes.js';
import { generateTokens } from '../../lib/jwt.js';
import { resolveAuthContext } from '../../lib/authContext.js';
import { auditFromReq } from '../compliance/audit.service.js';

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

async function ensurePersonRole(
  tx: Prisma.TransactionClient,
  userId: string,
  organizationId: string,
  roleKey: string,
) {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, firstName: true, lastName: true, email: true } });
  if (!user) throw new Error('Пользователь не найден');
  const organization = await tx.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true } });
  if (!organization) throw new Error('Организация не найдена');
  const person = await tx.person.upsert({
    where: { originalType_originalId: { originalType: 'SelfServiceOwner', originalId: `${organizationId}:${userId}` } },
    update: { fullName: `${user.firstName} ${user.lastName}`.trim() || organization.name, organizationId, userId: user.id, email: user.email },
    create: { id: uid(), fullName: `${user.firstName} ${user.lastName}`.trim() || organization.name, personType: 'STAFF', organizationId, userId: user.id, email: user.email, originalType: 'SelfServiceOwner', originalId: `${organizationId}:${userId}` },
  });
  const role = await tx.role.findUnique({ where: { key: roleKey } });
  if (!role) throw new Error(`Роль ${roleKey} не найдена`);
  await tx.personRole.upsert({
    where: { personId_roleId: { personId: person.id, roleId: role.id } },
    update: { scopeType: 'organization', scopeId: organizationId },
    create: { personId: person.id, roleId: role.id, scopeType: 'organization', scopeId: organizationId },
  });
  return person.id;
}

function setAuthCookies(res: any, accessToken: string, refreshToken: string) {
  res.cookie('accessToken', accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', maxAge: 24 * 60 * 60 * 1000, path: '/' });
  res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' });
}

organizationsRouter.post('/self-service', async (req: AuthRequest, res) => {
  try {
    const type = selfServiceType(req.body?.type);
    if (!type) return res.status(400).json({ ok: false, error: `Неподдерживаемый тип. Доступно: ${Object.keys(SELF_SERVICE_TYPES).join(', ')}` } satisfies ApiResponse);
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ ok: false, error: 'Название обязательно' } satisfies ApiResponse);

    const city = req.body?.city ? String(req.body.city).trim() : null;
    const address = req.body?.address ? String(req.body.address).trim() : null;
    const phone = req.body?.phone ? String(req.body.phone).trim() : null;
    const email = req.body?.email ? String(req.body.email).trim().toLowerCase() : req.user?.email || null;
    const taxId = req.body?.taxId ? String(req.body.taxId).trim() : null;

    const result = await prisma.$transaction(async (tx) => {
      let entityId: string;
      let organizationId: string;
      let entity: unknown;

      if (type === 'clinic') {
        entityId = uid();
        entity = await tx.clinic.create({ data: { id: entityId, name, city, address, phone, plan: 'DEMO', active: true } });
        organizationId = uid();
        await tx.organization.create({ data: { id: organizationId, name, type: 'CLINIC' as any, taxId, address, phone, email, originalType: 'Clinic', originalId: entityId, settings: { verification: 'PENDING' } as any } });
        await tx.clinicMember.create({ data: { userId: req.user!.id, clinicId: entityId, role: 'OWNER' } });
      } else if (type === 'diagnostic_center') {
        entityId = uid();
        entity = await tx.diagnosticCenter.create({ data: { id: entityId, name, city: city || undefined, address: address || undefined, phone: phone || undefined, email: email || undefined, active: true } });
        organizationId = entityId;
        await tx.organization.upsert({ where: { originalType_originalId: { originalType: 'DiagnosticCenter', originalId: entityId } }, update: { name, address, phone, email, taxId, settings: { verification: 'PENDING' } as any }, create: { id: entityId, name, type: 'DIAGNOSTIC_CENTER' as any, address, phone, email, taxId, contacts: city ? { city } : undefined, originalType: 'DiagnosticCenter', originalId: entityId, settings: { verification: 'PENDING' } as any } });
        await tx.diagnosticCenterMember.create({ data: { id: uid(), centerId: entityId, userId: req.user!.id, role: 'owner' } });
      } else if (type === 'dental_lab' || type === 'medical_lab') {
        entityId = uid();
        entity = await tx.laboratory.create({ data: { id: entityId, name, city: city || undefined, address: address || undefined, phone: phone || undefined, email: email || undefined, active: true } });
        organizationId = entityId;
        await tx.organization.upsert({ where: { originalType_originalId: { originalType: 'Laboratory', originalId: entityId } }, update: { name, address, phone, email, taxId, settings: { verification: 'PENDING', laboratoryType: type === 'dental_lab' ? 'DENTAL_LAB' : 'MEDICAL_LAB' } as any }, create: { id: entityId, name, type: 'LABORATORY' as any, address, phone, email, taxId, originalType: 'Laboratory', originalId: entityId, settings: { verification: 'PENDING', laboratoryType: type === 'dental_lab' ? 'DENTAL_LAB' : 'MEDICAL_LAB' } as any } });
        await tx.laboratoryMember.create({ data: { id: uid(), labId: entityId, userId: req.user!.id, role: 'owner' } });
      } else if (type === 'supplier') {
        entityId = uid();
        entity = await tx.supplier.create({ data: { id: entityId, name, kind: 'SUPPLIER', bin: taxId, legalAddress: address, contactPerson: `${req.user!.firstName} ${req.user!.lastName}`.trim() || null, phone, email, status: 'pending', commissionRate: 1000, members: { create: { userId: req.user!.id, role: 'owner' } } } });
        organizationId = uid();
        await tx.organization.create({ data: { id: organizationId, name, type: 'SUPPLIER_COMPANY' as any, taxId, address, phone, email, originalType: 'Supplier', originalId: entityId, settings: { verification: 'PENDING' } as any } });
      } else {
        entityId = uid();
        entity = await tx.academy.create({ data: { id: entityId, name, city: city || null, ownerId: req.user!.id } });
        organizationId = uid();
        await tx.organization.create({ data: { id: organizationId, name, type: 'ACADEMY' as any, taxId, address, phone, email, originalType: 'Academy', originalId: entityId, settings: { verification: 'PENDING' } as any } });
      }

      const personId = await ensurePersonRole(tx, req.user!.id, organizationId, type === 'supplier' ? 'seller' : 'owner');

      // Every self-service organization starts with one real operational branch.
      // This is the canonical Organization → Branch scope; it is persisted and
      // immediately manageable after refresh rather than being UI-only state.
      const branchId = uid();
      const branchCode = (name.trim().toUpperCase().replace(/[^A-ZА-Я0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 32) || 'MAIN');
      await tx.$executeRaw`
        INSERT INTO "branches"
          ("id", "organization_id", "clinic_id", "code", "name", "city", "address", "phone", "active", "isDefault", "createdAt", "updatedAt", "settings")
        VALUES
          (${branchId}, ${organizationId}, ${type === 'clinic' ? entityId : null}, ${branchCode}, ${name.trim()}, ${city}, ${address}, ${phone}, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
      `;
      await tx.branchMember.upsert({
        where: { personId_branchId: { personId, branchId } },
        update: {},
        create: { id: uid(), personId, branchId },
      });

      await tx.user.update({ where: { id: req.user!.id }, data: { role: 'OWNER' } });
      return { entityId, organizationId, entity, personId, branchId };
    });

    // The database role is now OWNER, but authorization is organization-scoped.
    // Issue a fresh context-bound token immediately so the client does not spend
    // the remainder of the old session in an unscoped OWNER fallback context.
    const authContext = await resolveAuthContext(req.user!.id, { organizationId: result.organizationId });
    if (authContext.organizationId !== result.organizationId) {
      throw new Error('Не удалось установить контекст созданной организации');
    }
    const tokens = generateTokens({
      sub: req.user!.id,
      email: req.user!.email,
      role: 'OWNER',
      ...authContext,
      branchId: result.branchId,
      sessionId: req.user!.sessionId,
    });
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    return res.status(201).json({ ok: true, data: { ...result, type, verification: 'PENDING', nextPath: SELF_SERVICE_TYPES[type].nextPath, ...tokens } } satisfies ApiResponse);
  } catch (error) {
    console.error('[organizations] self-service onboarding error:', error);
    return res.status(400).json({ ok: false, error: error instanceof Error ? error.message : 'Не удалось создать организацию' } satisfies ApiResponse);
  }
});


// Owner-facing organization control center. These routes deliberately live
// before the SuperAdmin-only management surface below.
organizationsRouter.get('/me', async (req: AuthRequest, res) => {
  try {
    const person = await prisma.person.findFirst({
      where: { userId: req.user!.id, organizationId: { not: null } },
      orderBy: { createdAt: 'asc' },
      include: { organization: true },
    });
    if (!person?.organization) return res.status(404).json({ ok: false, error: 'У вас нет организации' } satisfies ApiResponse);

    const org = person.organization;
    const branches = await prisma.$queryRaw<Array<{
      id: string; code: string; name: string; city: string | null; address: string | null;
      phone: string | null; active: boolean; is_default: boolean;
    }>>`
      SELECT "id","code","name","city","address","phone","active","isDefault" AS is_default
      FROM "branches" WHERE "organization_id" = ${org.id}
      ORDER BY "isDefault" DESC, "createdAt" ASC
    `;
    return res.json({ ok: true, data: { organization: org, person, branches } } satisfies ApiResponse);
  } catch (error) {
    console.error('[organizations] me error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить организацию' } satisfies ApiResponse);
  }
});

organizationsRouter.patch('/me', async (req: AuthRequest, res) => {
  try {
    const person = await prisma.person.findFirst({ where: { userId: req.user!.id, organizationId: { not: null } }, include: { organization: true } });
    if (!person?.organization) return res.status(404).json({ ok: false, error: 'У вас нет организации' });
    const current = person.organization;
    const body = req.body || {};
    const data = {
      name: body.name === undefined ? current.name : String(body.name).trim(),
      taxId: body.taxId === undefined ? current.taxId : (body.taxId ? String(body.taxId).trim() : null),
      address: body.address === undefined ? current.address : (body.address ? String(body.address).trim() : null),
      phone: body.phone === undefined ? current.phone : (body.phone ? String(body.phone).trim() : null),
      email: body.email === undefined ? current.email : (body.email ? String(body.email).trim().toLowerCase() : null),
      logo: body.logo === undefined ? current.logo : (body.logo ? String(body.logo).trim() : null),
      contacts: body.contacts === undefined ? current.contacts : body.contacts,
    };
    if (!data.name) return res.status(400).json({ ok: false, error: 'Название организации обязательно' });
    const updated = await prisma.organization.update({ where: { id: current.id }, data });
    await auditFromReq(req, { action: 'organization.profile_updated', entity: 'organization', entityId: current.id });
    return res.json({ ok: true, data: updated } satisfies ApiResponse);
  } catch (error) {
    console.error('[organizations] me update error:', error);
    return res.status(400).json({ ok: false, error: 'Не удалось сохранить профиль организации' } satisfies ApiResponse);
  }
});

organizationsRouter.post('/me/verification', async (req: AuthRequest, res) => {
  try {
    const person = await prisma.person.findFirst({ where: { userId: req.user!.id, organizationId: { not: null } }, include: { organization: true } });
    if (!person?.organization) return res.status(404).json({ ok: false, error: 'У вас нет организации' });
    const org = person.organization;
    const settings = (org.settings && typeof org.settings === 'object' && !Array.isArray(org.settings)) ? org.settings as Record<string, unknown> : {};
    const current = String(settings.verification || 'PENDING').toUpperCase();
    if (current === 'APPROVED') return res.status(409).json({ ok: false, error: 'Организация уже подтверждена' });
    const updated = await prisma.organization.update({
      where: { id: org.id },
      data: { settings: { ...settings, verification: 'SUBMITTED', verificationSubmittedAt: new Date().toISOString() } },
    });
    await auditFromReq(req, { action: 'organization.verification_submitted', entity: 'organization', entityId: org.id });
    return res.json({ ok: true, data: { organizationId: org.id, verification: 'SUBMITTED', organization: updated } } satisfies ApiResponse);
  } catch (error) {
    console.error('[organizations] verification submit error:', error);
    return res.status(400).json({ ok: false, error: 'Не удалось отправить организацию на проверку' } satisfies ApiResponse);
  }
});

organizationsRouter.use(requireSuperadmin);

organizationsRouter.get('/verification/queue', async (req: AuthRequest, res) => {
  try {
    const organizations = await prisma.organization.findMany({ orderBy: { updatedAt: 'asc' } });
    const data = organizations
      .map((org) => {
        const settings = (org.settings && typeof org.settings === 'object' && !Array.isArray(org.settings)) ? org.settings as Record<string, unknown> : {};
        return { ...org, verification: String(settings.verification || 'PENDING').toUpperCase() };
      })
      .filter((org) => org.verification === 'SUBMITTED' || org.verification === 'PENDING');
    return res.json({ ok: true, data } satisfies ApiResponse);
  } catch (error) {
    console.error('[organizations] verification queue error:', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить очередь проверки' } satisfies ApiResponse);
  }
});

organizationsRouter.post('/:id/verification', async (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id);
    const status = String(req.body?.status || '').toUpperCase();
    if (!['APPROVED', 'REJECTED', 'PENDING'].includes(status)) return res.status(400).json({ ok: false, error: 'Статус должен быть APPROVED, REJECTED или PENDING' });
    const org = await prisma.organization.findUnique({ where: { id } });
    if (!org) return res.status(404).json({ ok: false, error: 'Организация не найдена' });
    const settings = (org.settings && typeof org.settings === 'object' && !Array.isArray(org.settings)) ? org.settings as Record<string, unknown> : {};
    const reason = req.body?.reason ? String(req.body.reason).trim() : null;
    const updated = await prisma.organization.update({
      where: { id },
      data: { settings: { ...settings, verification: status, ...(reason ? { verificationReason: reason } : {}), verificationReviewedAt: new Date().toISOString(), verificationReviewedBy: req.user!.id } },
    });
    await auditFromReq(req, { action: 'organization.verification_reviewed', entity: 'organization', entityId: id, details: { status, reason } });
    return res.json({ ok: true, data: { organization: updated, verification: status } } satisfies ApiResponse);
  } catch (error) {
    console.error('[organizations] verification review error:', error);
    return res.status(400).json({ ok: false, error: 'Не удалось изменить статус проверки' } satisfies ApiResponse);
  }
});

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
