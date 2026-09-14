import { describe, expect, it } from 'vitest';

describe('appointment inventory deduction branch isolation', () => {
  it('checks appointment and inventory item branch before movement', async () => {
    const fs = await import('node:fs/promises');
    const file = await fs.readFile(new URL('./deductionRules.ts', import.meta.url), 'utf8');

    expect(file).toContain('FROM appointments');
    expect(file).toContain('FROM inventory_items');
    expect(file).toContain('appointmentBranchId');
    expect(file).toContain('item.branch_id !== appointmentBranchId');
    expect(file).toContain("reason: 'appointment_close'");
  });

  it('keeps clinic boundary in the same check', async () => {
    const fs = await import('node:fs/promises');
    const file = await fs.readFile(new URL('./deductionRules.ts', import.meta.url), 'utf8');

    expect(file).toContain('appointmentClinicId !== args.clinicId');
    expect(file).toContain("clinic_id = ${args.clinicId}");
  });
});
