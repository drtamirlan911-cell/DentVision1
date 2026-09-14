import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('appointment inventory deduction branch isolation', () => {
  const file = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/modules/inventory/deductionRules.ts'), 'utf8');
  it('checks appointment and inventory item branch before movement', () => {
    expect(file).toContain('FROM appointments'); expect(file).toContain('FROM inventory_items');
    expect(file).toContain('appointmentBranchId'); expect(file).toContain('item.branch_id !== appointmentBranchId');
    expect(file).toContain("reason: 'appointment_close'");
  });
  it('keeps clinic boundary in the same check', () => {
    expect(file).toContain('appointmentClinicId !== args.clinicId');
    expect(file).toContain('clinic_id = ${args.clinicId}');
  });
});
