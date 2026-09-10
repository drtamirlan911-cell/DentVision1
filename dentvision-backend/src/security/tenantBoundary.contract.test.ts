import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const read = (relative: string) => readFileSync(join(ROOT, relative), 'utf8');
const FINANCE = read('modules/finance/finance.routes.ts');
const FILES = read('modules/files/files.routes.ts');
const AI_TOOLS = read('modules/ai/os/tools.ts');
describe('tenant-boundary contracts', () => {
  it('finance wallet reads require typed owner identity, with SUPERADMIN as the only bypass', () => {
    expect(FINANCE).toContain('function walletOwnershipGuard');
    expect(FINANCE).toContain("if (req.user?.role === 'SUPERADMIN') return true;");
    expect(FINANCE).toContain("if (ownerType === 'CLINIC') return req.user?.clinicId === ownerId;");
    expect(FINANCE).toContain("if (ownerType === 'SUPPLIER') return req.user?.supplierId === ownerId;");
    expect(FINANCE).toContain('if (!walletOwnershipGuard(req, ownerType, ownerId))');
  });
  it('finance transaction listing is constrained through ledger-entry wallet ownership', () => {
    expect(FINANCE).toContain("financeRouter.get('/transactions', requirePermission('finance.manage')");
    expect(FINANCE).toContain('ownerFilter.ledgerEntries =');
    expect(FINANCE).toContain('wallet: {');
    expect(FINANCE).toContain('OR: typedOwners');
    expect(FINANCE).toContain("if (req.user?.clinicId) typedOwners.push({ ownerType: 'CLINIC', ownerId: req.user.clinicId });");
    expect(FINANCE).toContain("if (req.user?.supplierId) typedOwners.push({ ownerType: 'SUPPLIER', ownerId: req.user.supplierId });");
  });
  it('platform finance mutations remain SUPERADMIN-only', () => {
    expect(FINANCE).toContain("financeRouter.post('/sales', requireSuperadmin");
    expect(FINANCE).toContain("financeRouter.post('/transactions/manual', requireSuperadmin");
    expect(FINANCE).toContain("financeRouter.post('/commission-rules', requireSuperadmin");
    expect(FINANCE).toContain("financeRouter.get('/commission-rules', requireSuperadmin");
  });
  it('files list/download/write routes enforce clinic scope before exposing patient documents', () => {
    expect(FILES).toContain("filesRouter.get('/', requirePermission('patient.read')");
    expect(FILES).toContain('const clinicId = requireClinicScope(req, res);');
    expect(FILES).toContain('if (!assertSameClinic(req, res, patient.clinicId)) return;');
    expect(FILES).toContain('{ clinicId: scopedClinic! }');
    expect(FILES).toContain("filesRouter.post('/documents', requirePermission('patient.write')");
    expect(FILES).toContain("filesRouter.post('/documents/:id/send-signature', requirePermission('patient.write')");
    expect(FILES).toContain("filesRouter.post('/upload', upload.single('file'), requirePermission('patient.write')");
    expect(FILES).toContain('const storageKey = `clinics/${scopedClinic}/${fileId}${safeExt}`;');
  });
  it('AI staff tools establish clinic context and route by-id access through scopedId', () => {
    expect(AI_TOOLS).toContain('function requireClinic(ctx: ToolContext): string');
    expect(AI_TOOLS).toContain('function scopedId(clinicId: string, id: string)');
    expect(AI_TOOLS).toContain('where: scopedId(clinicId,');
    expect(AI_TOOLS).not.toMatch(/where:\s*\{\s*id:\s*[^,}]+,\s*clinicId\s*\}/);
  });
});
