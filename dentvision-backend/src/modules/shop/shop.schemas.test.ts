import { describe, expect, it } from 'vitest';
import { productCreateSchema, productUpdateSchema, productDataFromBody } from './shop.schemas.js';

describe('productCreateSchema — mass-assignment whitelist', () => {
  it('strips fields no supplier should ever set directly', () => {
    const parsed = productCreateSchema.parse({
      name: 'X-ray sensor',
      price: 150000,
      // None of these are declared on the schema — zod's default "strip" mode
      // drops unrecognized keys, which is exactly what stops a supplier from
      // attributing a listing to another supplier or forging server-owned fields.
      id: 'attacker-chosen-id',
      supplierId: 'someone-elses-supplier-id',
      sharedProductId: 'forged-shared-id',
      rating: 5,
      reviewCount: 999,
      createdAt: '2020-01-01',
    } as any);

    expect(parsed).not.toHaveProperty('id');
    expect(parsed).not.toHaveProperty('supplierId');
    expect(parsed).not.toHaveProperty('sharedProductId');
    expect(parsed).not.toHaveProperty('rating');
    expect(parsed).not.toHaveProperty('reviewCount');
    expect(parsed).not.toHaveProperty('createdAt');
    expect(parsed.name).toBe('X-ray sensor');
  });

  it('rejects a missing required name/price', () => {
    expect(productCreateSchema.safeParse({}).success).toBe(false);
    expect(productCreateSchema.safeParse({ name: 'X' }).success).toBe(false);
  });
});

describe('productUpdateSchema', () => {
  it('makes every field optional (partial update)', () => {
    expect(productUpdateSchema.safeParse({}).success).toBe(true);
    expect(productUpdateSchema.safeParse({ price: 100 }).success).toBe(true);
  });

  it('still strips id/supplierId on update', () => {
    const parsed = productUpdateSchema.parse({
      price: 200,
      id: 'attacker-chosen-id',
      supplierId: 'someone-elses-supplier-id',
    } as any);
    expect(parsed).not.toHaveProperty('id');
    expect(parsed).not.toHaveProperty('supplierId');
  });
});

describe('productDataFromBody', () => {
  it('only reads the fields it explicitly names, never spreads unknown keys through', () => {
    const data = productDataFromBody({
      name: 'Test',
      price: '199.5' as any,
      // Even if something upstream slipped an extra key onto the object, the
      // builder does not spread — it reads named properties only.
      supplierId: 'should-be-ignored',
    } as any);
    expect(data).not.toHaveProperty('supplierId');
    expect(data.price).toBe(199.5);
  });

  it('converts price/oldPrice to numbers and leaves undefined fields undefined', () => {
    const data = productDataFromBody({ name: 'Test', price: 100 });
    expect(data.price).toBe(100);
    expect(data.oldPrice).toBeUndefined();
    expect(data.stock).toBeUndefined();
  });

  it('supports explicitly clearing oldPrice with null', () => {
    const data = productDataFromBody({ name: 'Test', price: 100, oldPrice: null });
    expect(data.oldPrice).toBeNull();
  });
});
