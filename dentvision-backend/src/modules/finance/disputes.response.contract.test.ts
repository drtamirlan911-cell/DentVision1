import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const routes = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/modules/finance/disputes.routes.ts'), 'utf8');

describe('platform dispute adjudication response visibility', () => {
  it('keeps dispute review superadmin-only and returns supplier response evidence', () => {
    const list = routes.slice(
      routes.indexOf("disputesRouter.get('/', requireSuperadmin"),
      routes.indexOf("disputesRouter.post('/:id/status'"),
    );
    expect(list).toContain('requireSuperadmin');
    expect(list).toContain('supplierResponses');
    expect(list).toContain('orderBy: { createdAt: \'asc\' }');
    expect(list).toContain('supplier: { select: { id: true, name: true, status: true } }');
  });

  it('provides the seller evidence in the superadmin finance review UI', () => {
    const financeUi = readFileSync(resolve(process.cwd(), 'src/pages/superadmin/FinanceTab.tsx'), 'utf8');
    expect(financeUi).toContain('Ответы поставщиков');
    expect(financeUi).toContain('disputeDetail.supplierResponses.map');
    expect(financeUi).toContain('response.supplier?.name');
    expect(financeUi).toContain('сами по себе не выполняют возврат');
  });
});
