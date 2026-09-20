import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import type { AuthRequest } from '../../types/index.js';
import { uid } from '../../lib/helpers.js';
import { authorizeBranchScope } from '../../lib/branchAuthorization.js';
import type { RoleScope } from '../../lib/roleAccessRegistry.js';
import { resolveOrganizationIdForClinic } from '../../lib/orgContext.js';
import { canCreateClinicBranch, isBranchBillingOrganizationType, quoteBranchSubscription } from '../finance/branchBillingPolicy.js';
import { auditFromReq } from '../compliance/audit.service.js';

export const branchesRouter = Router();
branchesRouter.use(authenticate);

type BranchRow = {
  id: string; organization_id: string | null; clinic_id: string | null; code: string; name: string;
  city: string | null; address: string | null; phone: string | null; active: boolean; is_default: boolean;
  settings: unknown; created_at: Date; updated_at: Date;
};
type MemberScopeRow = { role: string; branch_id: string | null };
type OrganizationRoleRow = { role_key: string };

function serialize(row: BranchRow) {
  return { id: row.id, organizationId: row.organization_id, clinicId: row.clinic_id, code: row.code, name: row.name, city: row.city, address: row.address, phone: row.phone, active: row.active, isDefault: row.is_default, settings: row.settings, createdAt: row.created_at, updatedAt: row.updated_at };
}
function roleScope(role: string): RoleScope {
  switch (role) {
    case 'OWNER': case 'ADMIN': case 'ORG_OWNER': case 'ORG_ADMIN': return 'ORGANIZATION';
    case 'MANAGER': return 'BRANCH';
    case 'DOCTOR': case 'ASSISTANT': case 'RECEPTIONIST': case 'CASHIER': return 'ASSIGNED';
    default: return 'OWN';
  }
}
async function membership(userId: string, clinicId: string): Promise<MemberScopeRow | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role === 'SUPERADMIN') return { role: 'OWNER', branch_id: null };
  const rows = await prisma.$queryRaw<MemberScopeRow[]>`
    SELECT "role", "branch_id" FROM "clinic_members" WHERE "userId" = ${userId} AND "clinicId" = ${clinicId} LIMIT 1
  `;
  return rows[0] ?? null;
}
async function organizationMembership(userId: string, organizationId: string): Promise<OrganizationRoleRow | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role === 'SUPERADMIN') return { role_key: 'owner' };
  const rows = await prisma.$queryRaw<OrganizationRoleRow[]>`
    SELECT r."key" AS role_key
    FROM "persons" p
    JOIN "person_roles" pr ON pr."personId" = p."id"
    JOIN "roles" r ON r."id" = pr."roleId"
    WHERE p."userId" = ${userId}
      AND p."organization_id" = ${organizationId}
      AND (pr."scopeId" = ${organizationId} OR pr."scopeId" IS NULL)
      AND COALESCE(pr."scopeType", 'organization') IN ('organization', 'platform')
    ORDER BY CASE WHEN LOWER(r."key") IN ('owner', 'org_owner') THEN 0 WHEN LOWER(r."key") IN ('admin', 'org_admin') THEN 1 ELSE 2 END
    LIMIT 1
  `;
  return rows[0] ?? null;
}
async function loadBranch(branchId: string) {
  const rows = await prisma.$queryRaw<BranchRow[]>`
    SELECT "id", "organization_id", "clinic_id", "code", "name", "city", "address", "phone", "active",
      "isDefault" AS is_default, "settings", "createdAt" AS created_at, "updatedAt" AS updated_at
    FROM "branches" WHERE "id" = ${branchId} LIMIT 1
  `;
  return rows[0] ?? null;
}
async function authorizeOrganizationBranch(userId: string, organizationId: string, branch: BranchRow, mutation = false) {
  if (branch.organization_id && branch.organization_id !== organizationId) return { allowed: false as const, status: 403, error: 'Филиал принадлежит другой организации' };
  const member = await organizationMembership(userId, organizationId);
  if (!member) return { allowed: false as const, status: 403, error: 'Вы не являетесь участником этой организации' };
  const role = String(member.role_key || '').toLowerCase();
  if (!['owner', 'org_owner', 'admin', 'org_admin'].includes(role)) {
    return { allowed: false as const, status: 403, error: 'Только Руководитель или Администратор может управлять филиалами' };
  }
  if (mutation && !['owner', 'org_owner', 'admin', 'org_admin'].includes(role)) {
    return { allowed: false as const, status: 403, error: 'Недостаточно прав для изменения филиала' };
  }
  return { allowed: true as const, member };
}
async function organizationPerson(userId: string, organizationId: string) {
  return prisma.person.findFirst({ where: { userId, organizationId }, select: { id: true } });
}
async function authorizeMemberBranch(userId: string, clinicId: string, branch: BranchRow, mutation = false) {
  const member = await membership(userId, clinicId);
  if (!member) return { allowed: false as const, status: 403, error: 'Вы не являетесь участником этой клиники' };
  const clinicOrganizationId = await resolveOrganizationIdForClinic(clinicId);
  const expectedOrganizationId = clinicOrganizationId ?? `legacy:${clinicId}`;
  if (branch.organization_id && branch.organization_id !== expectedOrganizationId) return { allowed: false as const, status: 403, error: 'Филиал принадлежит другой организации' };
  const result = authorizeBranchScope(
    { organizationId: expectedOrganizationId, roleScope: roleScope(member.role), branchIds: member.branch_id ? [member.branch_id] : [], assignedBranchId: member.branch_id, userId },
    { organizationId: branch.organization_id ?? expectedOrganizationId, branchId: branch.id },
  );
  if (!result.allowed) return { allowed: false as const, status: 403, error: 'Доступ к этому филиалу запрещён' };
  if (mutation && !['OWNER', 'ADMIN'].includes(member.role)) return { allowed: false as const, status: 403, error: 'Только Руководитель или Администратор может изменять филиалы' };
  return { allowed: true as const, member };
}

branchesRouter.get('/billing-quote', async (req: AuthRequest, res) => {
  const organizationId = String(req.query.organizationId || req.user?.organizationId || '');
  const clinicId = String(req.query.clinicId || req.user?.clinicId || '');
  if (!organizationId && !clinicId) return res.status(400).json({ ok: false, error: 'organizationId или clinicId обязателен' });
  try {
    const effectiveOrganizationId = organizationId || await resolveOrganizationIdForClinic(clinicId);
    if (!effectiveOrganizationId) return res.status(400).json({ ok: false, error: 'Организация не найдена' });
    const authz = await organizationMembership(req.user!.id, effectiveOrganizationId);
    if (!authz) return res.status(403).json({ ok: false, error: 'Вы не являетесь участником этой организации' });
    const role = String(authz.role_key || '').toLowerCase();
    if (!['owner', 'org_owner', 'admin', 'org_admin'].includes(role)) return res.status(403).json({ ok: false, error: 'Недостаточно прав для просмотра биллинга филиалов' });
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM "branches"
      WHERE "organization_id" = ${effectiveOrganizationId} AND "active" = true
    `;
    const activeBranches = Number(rows[0]?.count ?? 0);
    const organizationType = String(req.user?.organizationType || '').toUpperCase();
    const supported = isBranchBillingOrganizationType(organizationType);
    let plan: string | undefined;
    if (organizationType === 'CLINIC' && clinicId) {
      const subscription = await prisma.subscription.findUnique({ where: { ownerType_ownerId: { ownerType: 'CLINIC', ownerId: clinicId } }, select: { plan: true } });
      plan = subscription?.plan;
    }
    if (!supported) {
      return res.json({ ok: true, data: { organizationId: effectiveOrganizationId, organizationType, activeBranches, enabled: false, monthlyAmountTenge: 0, reason: 'Для этого типа организации отдельная цена филиала ещё не утверждена' } });
    }
    const quote = quoteBranchSubscription(organizationType, activeBranches, plan);
    return res.json({ ok: true, data: { organizationId: effectiveOrganizationId, ...quote } });
  } catch (error) {
    console.error('[branches] billing quote', error);
    return res.status(500).json({ ok: false, error: 'Не удалось рассчитать стоимость филиалов' });
  }
});

branchesRouter.get('/', async (req: AuthRequest, res) => {
  const clinicId = String(req.query.clinicId || '');
  // An explicit clinicId is a legacy clinic-scope request and must not be
  // hijacked by the caller's active organization context. Otherwise a user
  // who has both clinic and universal organization context can receive the
  // organization branch query instead of the requested clinic branch list.
  const organizationId = String(req.query.organizationId || (clinicId ? '' : req.user?.organizationId || ''));
  try {
    if (organizationId) {
      const member = await organizationMembership(req.user!.id, organizationId);
      if (!member) return res.status(403).json({ ok: false, error: 'Вы не являетесь участником этой организации' });
      const rows = await prisma.$queryRaw<BranchRow[]>`
        SELECT "id", "organization_id", "clinic_id", "code", "name", "city", "address", "phone", "active",
          "isDefault" AS is_default, "settings", "createdAt" AS created_at, "updatedAt" AS updated_at
        FROM "branches"
        WHERE "organization_id" = ${organizationId}
          AND (LOWER(${String(member.role_key)}) IN ('owner','org_owner','admin','org_admin') OR "id" = ANY(${(req.user?.branchIds ?? []).filter(Boolean)}::text[]))
        ORDER BY "isDefault" DESC, "createdAt" ASC
      `;
      return res.json({ ok: true, data: rows.map(serialize) });
    }
    if (!clinicId) return res.status(400).json({ ok: false, error: 'clinicId или organizationId обязателен' });
    const member = await membership(req.user!.id, clinicId);
    if (!member) return res.status(403).json({ ok: false, error: 'Вы не являетесь участником этой клиники' });
    const resolvedOrganizationId = await resolveOrganizationIdForClinic(clinicId);
    const rows = await prisma.$queryRaw<BranchRow[]>`
      SELECT "id", "organization_id", "clinic_id", "code", "name", "city", "address", "phone", "active",
        "isDefault" AS is_default, "settings", "createdAt" AS created_at, "updatedAt" AS updated_at
      FROM "branches"
      WHERE "clinic_id" = ${clinicId}
        AND (${member.role} IN ('OWNER', 'ADMIN') OR "id" = ${member.branch_id ?? ''})
        AND (${resolvedOrganizationId ?? `legacy:${clinicId}`} = COALESCE("organization_id", ${resolvedOrganizationId ?? `legacy:${clinicId}`}))
      ORDER BY "isDefault" DESC, "createdAt" ASC
    `;
    return res.json({ ok: true, data: rows.map(serialize) });
  } catch (error) { console.error('[branches] list', error); return res.status(500).json({ ok: false, error: 'Не удалось получить филиалы' }); }
});

branchesRouter.post('/', async (req: AuthRequest, res) => {
  const { clinicId, organizationId, code, name, city, address, phone, settings } = req.body as { clinicId?: string; organizationId?: string; code?: string; name?: string; city?: string; address?: string; phone?: string; settings?: unknown };
  if (!name) return res.status(400).json({ ok: false, error: 'name обязателен' });
  try {
    if (organizationId) {
      const authz = await authorizeOrganizationBranch(req.user!.id, organizationId, { id: '', organization_id: organizationId, clinic_id: clinicId ?? null, code: '', name: '', city: null, address: null, phone: null, active: true, is_default: false, settings: null, created_at: new Date(), updated_at: new Date() }, true);
      if (!authz.allowed) return res.status(authz.status).json({ ok: false, error: authz.error });
      const organizationType = String(req.user?.organizationType || '').toUpperCase();
      if (organizationType === 'CLINIC') {
        const activeRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS count FROM "branches"
          WHERE "organization_id" = ${organizationId} AND "active" = true
        `;
        const activeBranches = Number(activeRows[0]?.count ?? 0);
        let plan: string | undefined;
        if (clinicId) {
          const subscription = await prisma.subscription.findUnique({
            where: { ownerType_ownerId: { ownerType: 'CLINIC', ownerId: clinicId } },
            select: { plan: true },
          });
          plan = subscription?.plan;
        }
        if (!canCreateClinicBranch(activeBranches, plan)) {
          return res.status(409).json({
            ok: false,
            error: 'Для создания дополнительного филиала клиники требуется тариф NETWORK',
            code: 'BRANCH_PLAN_REQUIRED',
            data: { organizationId, organizationType, activeBranches, plan: plan || null, requiredPlan: 'NETWORK' },
          });
        }
      } else if (isBranchBillingOrganizationType(organizationType)) {
        const activeRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS count FROM "branches"
          WHERE "organization_id" = ${organizationId} AND "active" = true
        `;
        const activeBranches = Number(activeRows[0]?.count ?? 0);
        const quote = quoteBranchSubscription(organizationType, activeBranches + 1);
        if (!quote.enabled) {
          return res.status(409).json({
            ok: false,
            error: quote.reason || 'Филиальная подписка недоступна для этой организации',
            code: 'BRANCH_PLAN_REQUIRED',
            data: { organizationId, organizationType, activeBranches, prospectiveBranches: activeBranches + 1, monthlyAmountTenge: quote.monthlyAmountTenge },
          });
        }
      }
      const branchCode = String(code || name).trim().toUpperCase().replace(/[^A-ZА-Я0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 32) || `BRANCH-${Date.now()}`;
      const branchId = uid();
      const rows = await prisma.$queryRaw<BranchRow[]>`
        INSERT INTO "branches"
          ("id", "organization_id", "clinic_id", "code", "name", "city", "address", "phone", "active", "isDefault", "createdAt", "updatedAt", "settings")
        VALUES
          (${branchId}, ${organizationId}, ${clinicId || null}, ${branchCode}, ${name.trim()}, ${city || null}, ${address || null}, ${phone || null}, true,
            NOT EXISTS (SELECT 1 FROM "branches" WHERE "organization_id" = ${organizationId}), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ${settings ?? null})
        RETURNING "id", "organization_id", "clinic_id", "code", "name", "city", "address", "phone", "active", "isDefault" AS is_default, "settings", "createdAt" AS created_at, "updatedAt" AS updated_at
      `;
      await auditFromReq(req, { action: 'branch.created', entity: 'branch', entityId: branchId, details: { organizationId, code: branchCode } });
      return res.status(201).json({ ok: true, data: serialize(rows[0]) });
    }
    if (!clinicId) return res.status(400).json({ ok: false, error: 'organizationId или clinicId обязателен' });
    const member = await membership(req.user!.id, clinicId);
    if (!member || !['OWNER', 'ADMIN'].includes(member.role)) return res.status(403).json({ ok: false, error: 'Только Руководитель или Администратор может управлять филиалами' });
    const clinicOrganizationId = await resolveOrganizationIdForClinic(clinicId);
    const activeRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM "branches"
      WHERE "clinic_id" = ${clinicId} AND "active" = true
    `;
    const activeBranches = Number(activeRows[0]?.count ?? 0);
    const subscription = await prisma.subscription.findUnique({
      where: { ownerType_ownerId: { ownerType: 'CLINIC', ownerId: clinicId } },
      select: { plan: true },
    });
    if (!canCreateClinicBranch(activeBranches, subscription?.plan)) {
      return res.status(409).json({
        ok: false,
        error: 'Для создания дополнительного филиала клиники требуется тариф NETWORK',
        code: 'BRANCH_PLAN_REQUIRED',
        data: { clinicId, activeBranches, plan: subscription?.plan || null, requiredPlan: 'NETWORK' },
      });
    }
    const branchCode = String(code || name).trim().toUpperCase().replace(/[^A-ZА-Я0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 32) || `BRANCH-${Date.now()}`;
    const branchId = uid();
    const rows = await prisma.$queryRaw<BranchRow[]>`
      INSERT INTO "branches"
        ("id", "organization_id", "clinic_id", "code", "name", "city", "address", "phone", "active", "isDefault", "createdAt", "updatedAt", "settings")
      VALUES
        (${branchId}, ${clinicOrganizationId}, ${clinicId}, ${branchCode}, ${name.trim()}, ${city || null}, ${address || null}, ${phone || null}, true,
          NOT EXISTS (SELECT 1 FROM "branches" WHERE "clinic_id" = ${clinicId}), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ${settings ?? null})
      RETURNING "id", "organization_id", "clinic_id", "code", "name", "city", "address", "phone", "active", "isDefault" AS is_default, "settings", "createdAt" AS created_at, "updatedAt" AS updated_at
    `;
    return res.status(201).json({ ok: true, data: serialize(rows[0]) });
  } catch (error: any) {
    if (String(error?.message || '').includes('branches_clinic_id_code_key') || String(error?.message || '').includes('branches_organization_id_code_key')) return res.status(409).json({ ok: false, error: 'Филиал с таким кодом уже существует' });
    console.error('[branches] create', error); return res.status(500).json({ ok: false, error: 'Не удалось создать филиал' });
  }
});

branchesRouter.patch('/:id', async (req: AuthRequest, res) => {
  const branchId = String(req.params.id);
  const { name, code, city, address, phone, active, settings } = req.body as { name?: string; code?: string; city?: string; address?: string; phone?: string; active?: boolean; settings?: unknown };
  try {
    const branch = await loadBranch(branchId);
    if (!branch) return res.status(404).json({ ok: false, error: 'Филиал не найден' });
    if (branch.organization_id && !branch.clinic_id) {
      const authz = await authorizeOrganizationBranch(req.user!.id, branch.organization_id, branch, true);
      if (!authz.allowed) return res.status(authz.status).json({ ok: false, error: authz.error });
    } else if (branch.clinic_id) {
      const authz = await authorizeMemberBranch(req.user!.id, branch.clinic_id, branch, true);
      if (!authz.allowed) return res.status(authz.status).json({ ok: false, error: authz.error });
    } else {
      return res.status(409).json({ ok: false, error: 'Филиал не связан с организацией' });
    }
    if (active === false && branch.is_default) {
      const counts = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM "branches" WHERE "organization_id" = ${branch.organization_id} AND "active" = true`;
      if (Number(counts[0]?.count ?? 0) <= 1) return res.status(409).json({ ok: false, error: 'Нельзя отключить единственный активный филиал' });
    }
    const nextCode = code === undefined ? branch.code : String(code).trim().toUpperCase().replace(/[^A-ZА-Я0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 32);
    const updated = await prisma.$queryRaw<BranchRow[]>`
      UPDATE "branches" SET "code" = ${nextCode}, "name" = COALESCE(${name ?? null}, "name"), "city" = ${city === undefined ? branch.city : city || null}, "address" = ${address === undefined ? branch.address : address || null}, "phone" = ${phone === undefined ? branch.phone : phone || null}, "active" = COALESCE(${active ?? null}, "active"), "settings" = ${settings === undefined ? branch.settings : settings}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${branchId}
      RETURNING "id", "organization_id", "clinic_id", "code", "name", "city", "address", "phone", "active", "isDefault" AS is_default, "settings", "createdAt" AS created_at, "updatedAt" AS updated_at
    `;
    await auditFromReq(req, { action: active === false ? 'branch.archived' : 'branch.updated', entity: 'branch', entityId: branchId, details: { active, code: nextCode } });
    return res.json({ ok: true, data: serialize(updated[0]) });
  } catch (error) { console.error('[branches] update', error); return res.status(500).json({ ok: false, error: 'Не удалось изменить филиал' }); }
});

branchesRouter.get('/:id/members', async (req: AuthRequest, res) => {
  const branchId = String(req.params.id);
  try {
    const branch = await loadBranch(branchId);
    if (!branch) return res.status(404).json({ ok: false, error: 'Филиал не найден' });
    if (branch.clinic_id) {
      const authz = await authorizeMemberBranch(req.user!.id, branch.clinic_id, branch);
      if (!authz.allowed) return res.status(authz.status).json({ ok: false, error: authz.error });
      const rows = await prisma.$queryRaw<Array<{ id:string; first_name:string|null; last_name:string|null; email:string|null; role:string; branch_id:string|null }>>`
        SELECT u."id", u."firstName" AS first_name, u."lastName" AS last_name, u."email", cm."role", cm."branch_id"
        FROM "clinic_members" cm JOIN "users" u ON u."id"=cm."userId"
        WHERE cm."clinicId"=${branch.clinic_id} AND cm."branch_id"=${branchId}
        ORDER BY u."firstName", u."lastName"`;
      return res.json({ok:true,data:rows.map(r=>({id:r.id,name:[r.first_name,r.last_name].filter(Boolean).join(' ')||r.email||'Сотрудник',email:r.email,role:r.role,branchId:r.branch_id}))});
    }
    if (!branch.organization_id) return res.status(404).json({ok:false,error:'Филиал не найден'});
    const authz = await authorizeOrganizationBranch(req.user!.id, branch.organization_id, branch);
    if (!authz.allowed) return res.status(authz.status).json({ok:false,error:authz.error});
    const rows = await prisma.$queryRaw<Array<{id:string;full_name:string;email:string|null;person_type:string}>>`
      SELECT p."id", p."fullName" AS full_name, COALESCE(u."email",p."email") AS email, p."personType" AS person_type
      FROM "branch_members" bm JOIN "persons" p ON p."id"=bm."personId"
      LEFT JOIN "users" u ON u."id"=p."userId"
      WHERE bm."branchId"=${branchId} ORDER BY p."fullName"`;
    return res.json({ok:true,data:rows.map(r=>({id:r.id,name:r.full_name,email:r.email,role:r.person_type,branchId}))});
  } catch(error){console.error('[branches] members list',error);return res.status(500).json({ok:false,error:'Не удалось получить сотрудников филиала'});}
});

branchesRouter.post('/:id/members/:userId', async (req: AuthRequest, res) => {
  const branchId=String(req.params.id), userId=String(req.params.userId);
  try {
    const branch=await loadBranch(branchId);
    if(!branch)return res.status(404).json({ok:false,error:'Филиал не найден'});
    if(branch.clinic_id){
      const authz=await authorizeMemberBranch(req.user!.id,branch.clinic_id,branch,true);
      if(!authz.allowed)return res.status(authz.status).json({ok:false,error:authz.error});
      const target=await prisma.clinicMember.findUnique({where:{userId_clinicId:{userId,clinicId:branch.clinic_id}}});
      if(!target)return res.status(404).json({ok:false,error:'Сотрудник не является участником клиники'});
      await prisma.$executeRaw`UPDATE "clinic_members" SET "branch_id"=${branchId},"updatedAt"=CURRENT_TIMESTAMP WHERE "userId"=${userId} AND "clinicId"=${branch.clinic_id}`;
      await auditFromReq(req, { action: 'branch.member_assigned', entity: 'branch', entityId: branchId, details: { userId } });
    return res.json({ok:true,data:{userId,branchId}});
    }
    if(!branch.organization_id)return res.status(404).json({ok:false,error:'Филиал не найден'});
    const authz=await authorizeOrganizationBranch(req.user!.id,branch.organization_id,branch,true);
    if(!authz.allowed)return res.status(authz.status).json({ok:false,error:authz.error});
    const person=await organizationPerson(userId,branch.organization_id);
    if(!person)return res.status(404).json({ok:false,error:'Пользователь не является участником этой организации'});
    await prisma.branchMember.upsert({where:{personId_branchId:{personId:person.id,branchId}},create:{personId:person.id,branchId},update:{}});
    return res.json({ok:true,data:{userId,branchId}});
  }catch(error){console.error('[branches] assign member',error);return res.status(500).json({ok:false,error:'Не удалось назначить сотрудника'});}
});

branchesRouter.delete('/:id/members/:userId', async (req: AuthRequest, res) => {
  const branchId=String(req.params.id), userId=String(req.params.userId);
  try {
    const branch=await loadBranch(branchId);
    if(!branch)return res.status(404).json({ok:false,error:'Филиал не найден'});
    if(branch.clinic_id){
      const authz=await authorizeMemberBranch(req.user!.id,branch.clinic_id,branch,true);
      if(!authz.allowed)return res.status(authz.status).json({ok:false,error:authz.error});
      await prisma.$executeRaw`UPDATE "clinic_members" SET "branch_id"=NULL,"updatedAt"=CURRENT_TIMESTAMP WHERE "userId"=${userId} AND "clinicId"=${branch.clinic_id} AND "branch_id"=${branchId}`;
      await auditFromReq(req, { action: 'branch.member_unassigned', entity: 'branch', entityId: branchId, details: { userId } });
    return res.json({ok:true,data:{userId,branchId:null}});
    }
    if(!branch.organization_id)return res.status(404).json({ok:false,error:'Филиал не найден'});
    const authz=await authorizeOrganizationBranch(req.user!.id,branch.organization_id,branch,true);
    if(!authz.allowed)return res.status(authz.status).json({ok:false,error:authz.error});
    const person=await organizationPerson(userId,branch.organization_id);
    if(!person)return res.status(404).json({ok:false,error:'Пользователь не является участником этой организации'});
    await prisma.branchMember.deleteMany({where:{personId:person.id,branchId}});
    return res.json({ok:true,data:{userId,branchId:null}});
  }catch(error){console.error('[branches] unassign member',error);return res.status(500).json({ok:false,error:'Не удалось убрать сотрудника из филиала'});}
});

branchesRouter.post('/:id/default', async (req: AuthRequest, res) => {
  const branchId = String(req.params.id);
  try {
    const branch = await loadBranch(branchId);
    if (!branch) return res.status(404).json({ ok: false, error: 'Филиал не найден' });
    if (branch.organization_id && !branch.clinic_id) {
      const authz = await authorizeOrganizationBranch(req.user!.id, branch.organization_id, branch, true);
      if (!authz.allowed) return res.status(authz.status).json({ ok: false, error: authz.error });
      await prisma.$transaction(async tx => {
        await tx.$executeRaw`UPDATE "branches" SET "isDefault" = false, "updatedAt" = CURRENT_TIMESTAMP WHERE "organization_id" = ${branch.organization_id}`;
        await tx.$executeRaw`UPDATE "branches" SET "isDefault" = true, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${branchId}`;
      });
    } else if (branch.clinic_id) {
      const authz = await authorizeMemberBranch(req.user!.id, branch.clinic_id, branch, true);
      if (!authz.allowed) return res.status(authz.status).json({ ok: false, error: authz.error });
      await prisma.$transaction(async tx => {
        await tx.$executeRaw`UPDATE "branches" SET "isDefault" = false, "updatedAt" = CURRENT_TIMESTAMP WHERE "clinic_id" = ${branch.clinic_id}`;
        await tx.$executeRaw`UPDATE "branches" SET "isDefault" = true, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${branchId}`;
      });
    } else return res.status(409).json({ ok: false, error: 'Филиал не связан с организацией' });
    const updated = await loadBranch(branchId);
    return res.json({ ok: true, data: updated ? serialize(updated) : null });
  } catch (error) { console.error('[branches] default', error); return res.status(500).json({ ok: false, error: 'Не удалось назначить основной филиал' }); }
});

export default branchesRouter;
