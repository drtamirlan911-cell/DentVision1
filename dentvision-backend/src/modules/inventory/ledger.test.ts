import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { recordMovement, isMovementApplied } from './ledger.js';

/**
 * Подставной клиент вместо мока модуля: `recordMovement` принимает клиент
 * параметром именно затем, чтобы его можно было вызвать внутри чужой
 * транзакции — и заодно проверить без базы.
 */
function fakeTx(opts: {
  quantity?: number | null;
  createThrows?: unknown;
  updateCount?: number;
}) {
  const created: any[] = [];
  const deleted: any[] = [];
  const updates: any[] = [];
  return {
    calls: { created, deleted, updates },
    inventoryItem: {
      findFirst: vi.fn(async () =>
        opts.quantity === null || opts.quantity === undefined
          ? null
          : { id: 'item-1', quantity: opts.quantity }),
      updateMany: vi.fn(async (args: any) => {
        updates.push(args);
        return { count: opts.updateCount ?? 1 };
      }),
    },
    inventoryMovement: {
      create: vi.fn(async (args: any) => {
        if (opts.createThrows) throw opts.createThrows;
        created.push(args.data);
        return { id: 'mv-1' };
      }),
      delete: vi.fn(async (args: any) => { deleted.push(args.where.id); return {}; }),
    },
  } as any;
}

const base = { clinicId: 'c1', itemId: 'item-1', reason: 'manual' as const };

describe('recordMovement', () => {
  it('приходует и двигает остаток вверх', async () => {
    const tx = fakeTx({ quantity: 5 });
    const out = await recordMovement(tx, { ...base, delta: 3 });

    expect(isMovementApplied(out)).toBe(true);
    if (!isMovementApplied(out)) return;
    expect(out.delta).toBe(3);
    expect(out.quantityAfter).toBe(8);
    expect(out.shortfall).toBe(0);
    expect(tx.calls.updates[0].data.quantity).toEqual({ increment: 3 });
  });

  it('списывает в пределах остатка', async () => {
    const tx = fakeTx({ quantity: 5 });
    const out = await recordMovement(tx, { ...base, delta: -2 });

    expect(isMovementApplied(out)).toBe(true);
    if (!isMovementApplied(out)) return;
    expect(out.delta).toBe(-2);
    expect(out.quantityAfter).toBe(3);
    expect(tx.calls.updates[0].data.quantity).toEqual({ decrement: 2 });
  });

  it('урезает списание по остатку и сообщает нехватку', async () => {
    // Расходники кончаются. Правило, которое в такой момент не делает
    // ничего, оставило бы склад врать до инвентаризации.
    const tx = fakeTx({ quantity: 2 });
    const out = await recordMovement(tx, { ...base, delta: -5 });

    expect(isMovementApplied(out)).toBe(true);
    if (!isMovementApplied(out)) return;
    expect(out.delta).toBe(-2);
    expect(out.quantityAfter).toBe(0);
    expect(out.shortfall).toBe(3);
    // В журнал попало то, что реально произошло, а не то, что просили.
    expect(tx.calls.created[0].delta).toBe(-2);
  });

  it('не проводит движение, когда списывать нечего', async () => {
    const tx = fakeTx({ quantity: 0 });
    const out = await recordMovement(tx, { ...base, delta: -1 });

    expect(out).toEqual({ applied: false, reason: 'empty' });
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it('не трогает склад на нулевой дельте', async () => {
    const tx = fakeTx({ quantity: 5 });
    expect(await recordMovement(tx, { ...base, delta: 0 })).toEqual({ applied: false, reason: 'noop' });
    expect(tx.inventoryItem.findFirst).not.toHaveBeenCalled();
  });

  it('молчит на позиции чужой клиники', async () => {
    const tx = fakeTx({ quantity: null });
    expect(await recordMovement(tx, { ...base, delta: 4 })).toEqual({ applied: false, reason: 'empty' });
  });

  it('повторный вызов по той же ссылке ничего не проводит', async () => {
    // Ровно то, ради чего в журнале уникальный ключ (refType, refId, itemId):
    // повторный переход заказа в «доставлен» не должен задваивать приход.
    const duplicate = new Prisma.PrismaClientKnownRequestError('unique', {
      code: 'P2002', clientVersion: 'test',
    });
    const tx = fakeTx({ quantity: 5, createThrows: duplicate });
    const out = await recordMovement(tx, {
      ...base, delta: 10, refType: 'order', refId: 'order-1',
    });

    expect(out).toEqual({ applied: false, reason: 'duplicate' });
    expect(tx.inventoryItem.updateMany).not.toHaveBeenCalled();
  });

  it('прокидывает наверх ошибку, которая не про дубликат', async () => {
    const boom = new Error('соединение потеряно');
    const tx = fakeTx({ quantity: 5, createThrows: boom });
    await expect(recordMovement(tx, { ...base, delta: 1 })).rejects.toThrow('соединение потеряно');
  });

  it('убирает движение, если остаток увели из-под нас', async () => {
    // Сторож на updateMany не сработал: между чтением и правкой позицию
    // тронула соседняя транзакция. Движение, которое ничего не сдвинуло,
    // в журнале лгало бы.
    const tx = fakeTx({ quantity: 5, updateCount: 0 });
    const out = await recordMovement(tx, { ...base, delta: -2 });

    expect(out).toEqual({ applied: false, reason: 'empty' });
    expect(tx.calls.deleted).toEqual(['mv-1']);
  });

  it('округляет дробную дельту к целому', async () => {
    const tx = fakeTx({ quantity: 5 });
    const out = await recordMovement(tx, { ...base, delta: 2.7 });
    expect(isMovementApplied(out) && out.delta).toBe(2);
  });
});
