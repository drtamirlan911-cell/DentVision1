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
  it('finance wallet reads are authenticated and owner-scoped, with SUPERADMIN as the explicit bypass', () => {
    expect(FINANCE).toContain('financeRouter.use(authenticate);');
    expect(FINANCE).toContain('function walletOwnershipGuard');
    expect(FINANCE).toContain("if (req.user?.role === 'SUPERADMIN') return true;");
    expect(FINANCE).toContain("ownerType === 'CLINIC' && req.user?.clinicId === ownerId");
    expect(FINANCE).toContain('req.user?.supplierId === ownerId');
    expect(FINANCE).toContain('if (!walletOwnershipGuard(req, ownerType, ownerId))');
  });

  it('finance transaction listing is constrained through ledger-entry wallet ownership', () => {
    expect(FINANCE).toContain("financeRouter.get('/transactions', requirePermission('finance.manage')");
    expect(FINANCE).toContain('ownerFilter.ledgerEntries =');
    expect(FINANCE).toContain('wallet:');
    expect(FINANCE).toContain('ownerId: { in: [...new Set(ids)] }');
  });

  it('files list and document writes enforce clinic scope before exposing patient documents', () => {
    expect(FILES).toContain("filesRouter.get('/', requirePermission('patient.read')");
    expect(FILES).toContain('const clinicId = requireClinicScope(req, res);');
    expect(FILES).toContain('if (!assertSameClinic(req, res, patient.clinicId)) return;');
    expect(FILES).toContain("filesRouter.post('/documents', requirePermission('patient.write')");
    expect(FILES).toContain("filesRouter.post('/documents/:id/send-signature', requirePermission('patient.write')");
    expect(FILES).toContain("filesRouter.post('/upload', upload.single('file'), requirePermission('patient.write')");
  });

  it('AI staff tools establish clinic context and route by-id access through scopedId', () => {
    expect(AI_TOOLS).toContain('function requireClinic(ctx: ToolContext): string');
    expect(AI_TOOLS).toContain('function scopedId(clinicId: string, id: string)');
    expect(AI_TOOLS).toContain('where: scopedId(clinicId,');
  });
});
