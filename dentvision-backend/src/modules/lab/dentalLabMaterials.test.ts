import { describe, expect, it } from 'vitest';
import {
  calculateMaterialCostMinor,
  materialConsumptionFingerprint,
  parseDentalLabMaterialDraft,
  parseMaterialQuantityMilli,
} from './dentalLabMaterials.js';

describe('dental-lab material quantity and cost', () => {
  it('parses exact thousandth quantities without floating-point arithmetic', () => {
    expect(parseMaterialQuantityMilli('1')).toBe(1000n);
    expect(parseMaterialQuantityMilli('0.125')).toBe(125n);
    expect(parseMaterialQuantityMilli('12.5')).toBe(12500n);
    expect(parseMaterialQuantityMilli('0.001')).toBe(1n);
  });

  it('rejects zero, negative, excess precision, scientific notation and unsafe input', () => {
    expect(parseMaterialQuantityMilli('0')).toBeNull();
    expect(parseMaterialQuantityMilli('-1')).toBeNull();
    expect(parseMaterialQuantityMilli('1.0001')).toBeNull();
    expect(parseMaterialQuantityMilli('1e3')).toBeNull();
    expect(parseMaterialQuantityMilli(' 1 ')).toBe(1000n);
    expect(parseMaterialQuantityMilli('1,5')).toBeNull();
    expect(parseMaterialQuantityMilli('')).toBeNull();
    expect(parseMaterialQuantityMilli('1000000000')).toBeNull();
    expect(parseMaterialQuantityMilli('0', true)).toBe(0n);
  });

  it('uses integer minor-unit math and rounds half-up', () => {
    expect(calculateMaterialCostMinor(1000n, 1250n)).toBe(1250n);
    expect(calculateMaterialCostMinor(125n, 1000n)).toBe(125n);
    expect(calculateMaterialCostMinor(1n, 500n)).toBe(1n);
    expect(calculateMaterialCostMinor(1n, 499n)).toBe(0n);
    expect(() => calculateMaterialCostMinor(0n, 10n)).toThrow();
    expect(() => calculateMaterialCostMinor(1000n, -1n)).toThrow();
  });

  it('validates laboratory material identity, category, unit and minimum stock', () => {
    expect(parseDentalLabMaterialDraft({
      code: ' zr-01 ', name: 'Zirconia blank', category: 'zirconia', unit: 'pcs', minimumStock: '2',
    })).toMatchObject({ code: 'ZR-01', name: 'Zirconia blank', unit: 'pcs', minimumStockMilli: 2000n });
    expect(parseDentalLabMaterialDraft({
      code: 'x', name: 'A', category: 'zirconia', unit: 'pcs', minimumStock: '0',
    })).toBeNull();
    expect(parseDentalLabMaterialDraft({
      code: 'ZR-01', name: 'Zirconia blank', category: 'unknown', unit: 'pcs',
    })).toBeNull();
    expect(parseDentalLabMaterialDraft({
      code: 'ZR-01', name: 'Zirconia blank', category: 'zirconia', unit: 'box',
    })).toBeNull();
  });

  it('creates stable idempotency fingerprints without storing source note text', () => {
    const input = { labOrderId: 'order-1', materialId: 'material-1', lotId: 'lot-1', quantityMilli: 125n, note: '  shade A2  ' };
    expect(materialConsumptionFingerprint(input)).toBe(materialConsumptionFingerprint({ ...input, note: 'shade A2' }));
    expect(materialConsumptionFingerprint(input)).not.toContain('shade A2');
    expect(materialConsumptionFingerprint(input)).not.toBe(materialConsumptionFingerprint({ ...input, quantityMilli: 126n }));
  });
});
