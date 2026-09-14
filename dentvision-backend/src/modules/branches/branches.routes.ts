import { Router } from 'express';
import prisma from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import type { AuthRequest } from '../../types/index.js';
import { uid } from '../../lib/helpers.js';
import { authorizeBranchScope } from '../../lib/branchAuthorization.js';
import type { RoleScope } from '../../lib/roleAccessRegistry.js';

export const branchesRouter = Router();
branchesRouter.use(authenticate);

type BranchRow = {
  id: string;
  organization_id: string | null;
  clinic_id: string | null;
  code: string;
  name: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  active: boolean;
  is_default: boolean;
  settings: unknown;
  created_at: Date;
  updated_at: Date;
};

type MemberScopeRow = { role: string; branch_id: string | null };

function serialize(row: BranchRow) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    clinicId: row.clinic_id,
    code: row.code,
    name: row.name,
    city: row.city,
    address: row.address,
    phone: row.phone,
    active: row.active,
    isDefault: row.is_default,
    settings: row.settings,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function roleScope(role: string): RoleScope {
  switch (role) {
    case 'OWNER':
    case 'ADMIN':
      return 'ORGANIZATION';
    case 'MANAGER':
      return 'BRANCH';
    case 'DOCTOR':
    case 'ASSISTANT':
    case 'RECEPTIONIST':
    case 'CASHIER':
      return 'ASSIGNED';
    default:
      return 'OWN';
  }
}

async function membership(userId: string, clinicId: string): Promise<MemberScopeRow | { role: 'OWNER'; branchId: null } | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role === 'SUPERADMIN') return { role: 'OWNER', branchId: null };
  const rows = await prisma.$queryRaw<MemberScopeRow[]>`
    SELECT "role", "branch_id" FROM "clinic_members" WHERE "userId" = ${userId} AND "clinicId" = ${clinicId} LIMIT 1
  `;
  return rows[0] ?? null;
}

async function authorizeMemberBranch(userId: string, clinicId: string, branch: BranchRow, mutation = false) {
  const member = await membership(userId, clinicId);
  if (!member) return { allowed: false as const, status: 403, error: 'Вы не являетесь участником этой клиники' };

  const scope = roleScope(member.role);
  const result = authorizeBranchScope(
    {
      organizationId: branch.organization_id ?? `legacy:${clinicId}`,
      roleScope: scope,
      branchIds: member.branchId ? [member.branchId] : [],
      assignedBranchId: member.branchId,
      userId,
    },
    {
      organizationId: branch.organization_id ?? `legacy:${clinicId}`,
      branchId: branch.id,
    },
  );

  if (!result.allowed) return { allowed: false as const, status: 403, error: 'Доступ к этому филиалу запрещён' };
  if (mutation && !['OWNER', 'ADMIN'].includes(member.role)) {
    return { allowed: false as const, status: 403, error: 'Только Руководитель или Администратор может изменять филиалы' };
  }
  return { allowed: true as const, member };
}

branchesRouter.get('/', async (req: AuthRequest, res) => {
  const clinicId = String(req.query.clinicId || '');
  if (!clinicId) return res.status(400).json({ ok: false, error: 'clinicId обязателен' });
  try {
    const member = await membership(req.user!.id, clinicId);
    if (!member) return res.status(403).json({ ok: false, error: 'Вы не являетесь участником этой клиники' });

    const rows = await prisma.$queryRaw<BranchRow[]>`
      SELECT * FROM "branches"
      WHERE "clinic_id" = ${clinicId}
        AND (${member.role} IN ('OWNER', 'ADMIN') OR "id" = ${member.branchId ?? ''})
      ORDER BY "is_default" DESC, "name" ASC
    `;
    return res.json({ ok: true, data: rows.map(serialize) });
  } catch (error) {
    console.error('[branches] list', error);
    return res.status(500).json({ ok: false, error: 'Не удалось получить филиалы' });
  }
});

branchesRouter.post('/', async (req: AuthRequest, res) => {
  const { clinicId, organizationId, code, name, city, address, phone, settings } = req.body as {
    clinicId?: string;
    organizationId?: string;
    code?: string;
    name?: string;
    city?: string;
    address?: string;
    phone?: string;
    settings?: unknown;
  };
  if (!clinicId || !name) return res.status(400).json({ ok: false, error: 'clinicId и name обязательны' });
  try {
    const member = await membership(req.user!.id, clinicId);
    if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
      return res.status(403).json({ ok: false, error: 'Только Руководитель или Администратор может управлять филиалами' });
    }

    const branchCode = String(code || name).trim().toUpperCase().replace(/[^A-ZА-Я0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 32) || `BRANCH-${Date.now()}`;
    const branchId = uid();
    const rows = await prisma.$queryRaw<BranchRow[]>`
      INSERT INTO "branches" ("id", "organization_id", "clinic_id", "code", "name", "city", "address", "phone", "active", "is_default", "settings")
      VALUES (${branchId}, ${organizationId || null}, ${clinicId}, ${branchCode}, ${name.trim()}, ${city || null}, ${address || null}, ${phone || null}, true,
        NOT EXISTS (SELECT 1 FROM "branches" WHERE "clinic_id" = ${clinicId}), ${settings ?? null})
      RETURNING *
    `;
    return res.status(201).json({ ok: true, data: serialize(rows[0]) });
  } catch (error: any) {
    if (String(error?.message || '').includes('branches_clinic_id_code_key') || String(error?.message || '').includes('branches_organization_id_code_key')) {
      return res.status(409).json({ ok: false, error: 'Филиал с таким кодом уже существует' });
    }
    console.error('[branches] create', error);
    return res.status(500).json({ ok: false, error: 'Не удалось создать филиал' });
  }
});

branchesRouter.patch('/:id', async (req: AuthRequest, res) => {
  const branchId = String(req.params.id);
  const { name, code, city, address, phone, active, settings } = req.body as {
    name?: string; code?: string; city?: string; address?: string; phone?: string; active?: boolean; settings?: unknown;
  };
  try {
    const rows = await prisma.$queryRaw<BranchRow[]>`SELECT * FROM "branches" WHERE "id" = ${branchId} LIMIT 1`;
    const branch = rows[0];
    if (!branch) return res.status(404).json({ ok: false, error: 'Филиал не найден' });
    if (!branch.clinic_id) return res.status(409).json({ ok: false, error: 'Филиал ещё не связан с клиникой' });

    const authz = await authorizeMemberBranch(req.user!.id, branch.clinic_id, branch, true);
    if (!authz.allowed) return res.status(authz.status).json({ ok: false, error: authz.error });

    if (active === false && branch.is_default) {
      const counts = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count FROM "branches" WHERE "clinic_id" = ${branch.clinic_id} AND "active" = true
      `;
      if (Number(counts[0]?.count ?? 0) <= 1) return res.status(409).json({ ok: false, error: 'Нельзя отключить единственный активный филиал' });
    }

    const nextCode = code === undefined ? branch.code : String(code).trim().toUpperCase().replace(/[^A-ZА-Я0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 32);
    const updated = await prisma.$queryRaw<BranchRow[]>`
      UPDATE "branches"
      SET "code" = ${nextCode},
          "name" = COALESCE(${name ?? null}, "name"),
          "city" = ${city === undefined ? branch.city : city || null},
          "address" = ${address === undefined ? branch.address : address || null},
          "phone" = ${phone === undefined ? branch.phone : phone || null},
          "active" = COALESCE(${active ?? null}, "active"),
          "settings" = ${settings === undefined ? branch.settings : settings},
          "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = ${branchId}
      RETURNING *
    `;
    return res.json({ ok: true, data: serialize(updated[0]) });
  } catch (error) {
    console.error('[branches] update', error);
    return res.status(500).json({ ok: false, error: 'Не удалось обновить филиал' });
  }
});

branchesRouter.post('/:id/members/:userId', async (req: AuthRequest, res) => {
  const branchId = String(req.params.id);
  const userId = String(req.params.userId);
  try {
    const rows = await prisma.$queryRaw<BranchRow[]>`SELECT * FROM "branches" WHERE "id" = ${branchId} LIMIT 1`;
    const branch = rows[0];
    if (!branch || !branch.clinic_id) return res.status(404).json({ ok: false, error: 'Филиал не найден' });

    const authz = await authorizeMemberBranch(req.user!.id, branch.clinic_id, branch, true);
    if (!authz.allowed) return res.status(authz.status).json({ ok: false, error: authz.error });
    if (!branch.active) return res.status(409).json({ ok: false, error: 'Нельзя назначить сотрудника в неактивный филиал' });

    const target = await prisma.clinicMember.findUnique({ where: { userId_clinicId: { userId, clinicId: branch.clinic_id } } });
    if (!target) return res.status(404).json({ ok: false, error: 'Сотрудник не является участником клиники' });

    await prisma.$executeRaw`
      UPDATE "clinic_members"
      SET "branch_id" = ${branchId}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = ${userId} AND "clinicId" = ${branch.clinic_id}
    `;
    return res.json({ ok: true, data: { userId, branchId } });
  } catch (error) {
    console.error('[branches] assign member', error);
    return res.status(500).json({ ok: false, error: 'Не удалось назначить сотрудника' });
  }
});

export default branchesRouter;
