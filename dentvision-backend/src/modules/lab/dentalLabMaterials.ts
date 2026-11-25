import { createHash } from 'node:crypto';

export const DENTAL_LAB_MATERIAL_CATEGORIES = [
  'zirconia', 'ceramic', 'metal', 'alloy', 'resin', 'polymer', 'wax', 'consumable', 'other',
] as const;

export const DENTAL_LAB_MATERIAL_UNITS = ['g', 'ml', 'pcs'] as const;

export type DentalLabMaterialUnit = typeof DENTAL_LAB_MATERIAL_UNITS[number];

export interface DentalLabMaterialDraft {
  code: string;
  name: string;
  category: typeof DENTAL_LAB_MATERIAL_CATEGORIES[number];
  unit: DentalLabMaterialUnit;
  minimumStockMilli: bigint;
}

/** Parses a positive quantity into thousandths without floating point. */
export function parseMaterialQuantityMilli(value: unknown, allowZero = false): bigint | null {
  if (typeof value !== 'string') return null;
  const match = /^(0|[1-9]\d{0,8})(?:\.(\d{1,3}))?$/.exec(value.trim());
  if (!match) return null;
  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] || '').padEnd(3, '0'));
  const milli = whole * 1000n + fraction;
  if ((!allowZero && milli <= 0n) || milli > 999_999_999_999n) return null;
  return milli;
}

export function parseDentalLabMaterialDraft(value: unknown): DentalLabMaterialDraft | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const code = String(input.code || '').trim().toUpperCase();
  const name = String(input.name || '').trim();
  const category = String(input.category || '').trim().toLowerCase();
  const unit = String(input.unit || '').trim().toLowerCase();
  const minimumStockMilli = parseMaterialQuantityMilli(
    typeof input.minimumStock === 'string' ? input.minimumStock : '0',
    true,
  );
  if (!/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(code)) return null;
  if (name.length < 2 || name.length > 120) return null;
  if (!DENTAL_LAB_MATERIAL_CATEGORIES.includes(category as any)) return null;
  if (!DENTAL_LAB_MATERIAL_UNITS.includes(unit as any)) return null;
  if (minimumStockMilli === null) return null;
  return {
    code,
    name,
    category: category as DentalLabMaterialDraft['category'],
    unit: unit as DentalLabMaterialUnit,
    minimumStockMilli,
  };
}

export function calculateMaterialCostMinor(quantityMilli: bigint, unitCostMinor: bigint): bigint {
  if (quantityMilli <= 0n || unitCostMinor < 0n) {
    throw new Error('Некорректное количество или стоимость материала');
  }
  // quantity is stored in thousandths of a base unit; round half-up once.
  return (quantityMilli * unitCostMinor + 500n) / 1000n;
}

export function materialConsumptionFingerprint(input: {
  labOrderId: string;
  materialId: string;
  lotId: string;
  quantityMilli: bigint;
  note?: string | null;
}): string {
  return createHash('sha256').update(JSON.stringify({
    labOrderId: input.labOrderId,
    materialId: input.materialId,
    lotId: input.lotId,
    quantityMilli: input.quantityMilli.toString(),
    note: input.note?.trim() || null,
  })).digest('hex');
}
