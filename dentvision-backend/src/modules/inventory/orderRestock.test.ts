import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  orderFindUnique: vi.fn(),
  productFindMany: vi.fn(),
  itemFindMany: vi.fn(),
  itemCreate: vi.fn(),
  itemUpdate: vi.fn(),
  itemFindFirst: vi.fn(),
  itemUpdateMany: vi.fn(),
  movementCreate: vi.fn(),
  movementDelete: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => {
  const client = {
    order: { findUnique: db.orderFindUnique },
    product: { findMany: db.productFindMany },
    inventoryItem: {
      findMany: db.itemFindMany,
      create: db.itemCreate,
      update: db.itemUpdate,
      findFirst: db.itemFindFirst,
      updateMany: db.itemUpdateMany,
    },
    inventoryMovement: { create: db.movementCreate, delete: db.movementDelete },
    // Транзакция здесь — просто вызов колбэка с тем же клиентом: проверяем
    // логику сопоставления, а не поведение Postgres.
    $transaction: (fn: any) => fn(client),
  };
  return { default: client };
});

import { restockFromOrder, normalizeItemName } from './orderRestock.js';

describe('normalizeItemName', () => {
  it('снимает регистр, пунктуацию и лишние пробелы', () => {
    expect(normalizeItemName('Перчатки  нитриловые, M')).toBe('перчатки нитриловые m');
    expect(normalizeItemName('Коффердам (латекс)')).toBe('коффердам латекс');
  });

  it('не выкидывает кириллицу', () => {
    // Тот самый случай, ради которого здесь \p{L}, а не \w: латинский
    // класс молча оставил бы от русского названия пустую строку.
    expect(normalizeItemName('Слюноотсос')).toBe('слюноотсос');
  });

  it('переживает пустое значение', () => {
    expect(normalizeItemName(null)).toBe('');
    expect(normalizeItemName('   ')).toBe('');
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  db.productFindMany.mockResolvedValue([]);
  db.itemFindMany.mockResolvedValue([]);
  db.movementCreate.mockResolvedValue({ id: 'mv-1' });
  db.itemUpdateMany.mockResolvedValue({ count: 1 });
});

function order(items: unknown[], clinicId: string | null = 'c1') {
  return { id: 'order-1', clinicId, items };
}

describe('restockFromOrder', () => {
  it('ничего не делает для заказа без клиники', async () => {
    // Покупка пользователя маркетплейса, а не клиники: приходовать некуда.
    db.orderFindUnique.mockResolvedValue(order([{ product_id: 'p1', quantity: 2 }], null));

    const out = await restockFromOrder('order-1');

    expect(out.received).toEqual([]);
    expect(db.itemCreate).not.toHaveBeenCalled();
  });

  it('заводит позицию и проводит приход движением', async () => {
    db.orderFindUnique.mockResolvedValue(order([{ product_id: 'p1', name: 'Перчатки M', quantity: 5 }]));
    db.productFindMany.mockResolvedValue([{
      id: 'p1', name: 'Перчатки M', sku: 'GL-M', unit: 'уп', price: 4500,
      category: 'Расходники', shopCategory: null, supplier: { name: 'ДентТорг' },
    }]);
    db.itemCreate.mockResolvedValue({ id: 'i1', name: 'Перчатки M', sku: 'GL-M', productId: 'p1', autoRestock: true });
    db.itemFindFirst.mockResolvedValue({ id: 'i1', quantity: 0 });

    const out = await restockFromOrder('order-1');

    // Позиция создаётся пустой, а остаток даёт движение — иначе в журнале
    // была бы дыра: количество есть, объяснения нет.
    expect(db.itemCreate.mock.calls[0][0].data).toMatchObject({
      quantity: 0, sku: 'GL-M', productId: 'p1', supplier: 'ДентТорг', unit: 'уп',
    });
    expect(out.received).toEqual([{ itemId: 'i1', name: 'Перчатки M', quantity: 5, created: true }]);
  });

  it('находит позицию по товару, а не заводит вторую', async () => {
    db.orderFindUnique.mockResolvedValue(order([{ product_id: 'p1', name: 'Перчатки M', quantity: 3 }]));
    db.itemFindMany.mockResolvedValue([
      { id: 'i1', name: 'Перчатки нитриловые', sku: null, productId: 'p1', autoRestock: true },
    ]);
    db.itemFindFirst.mockResolvedValue({ id: 'i1', quantity: 10 });

    const out = await restockFromOrder('order-1');

    expect(db.itemCreate).not.toHaveBeenCalled();
    expect(out.received[0]).toMatchObject({ itemId: 'i1', quantity: 3, created: false });
  });

  it('сопоставляет по названию и закрепляет связь с товаром', async () => {
    db.orderFindUnique.mockResolvedValue(order([{ product_id: 'p1', name: 'Перчатки  M', quantity: 1 }]));
    db.productFindMany.mockResolvedValue([{
      id: 'p1', name: 'Перчатки M', sku: 'GL-M', unit: 'уп', price: 4500,
      category: null, shopCategory: null, supplier: null,
    }]);
    db.itemFindMany.mockResolvedValue([
      { id: 'i1', name: 'перчатки m', sku: null, productId: null, autoRestock: true },
    ]);
    db.itemFindFirst.mockResolvedValue({ id: 'i1', quantity: 4 });

    await restockFromOrder('order-1');

    // Следующий заказ найдёт позицию сразу и точно, без разбора названий.
    expect(db.itemUpdate.mock.calls[0][0].data).toMatchObject({ productId: 'p1', sku: 'GL-M' });
  });

  it('обходит позиции, которые клиника ведёт вручную', async () => {
    db.orderFindUnique.mockResolvedValue(order([{ product_id: 'p1', name: 'Импланты', quantity: 2 }]));
    db.itemFindMany.mockResolvedValue([
      { id: 'i1', name: 'Импланты', sku: null, productId: 'p1', autoRestock: false },
    ]);

    const out = await restockFromOrder('order-1');

    expect(out.received).toEqual([]);
    expect(out.skippedManual).toEqual(['Импланты']);
    expect(db.movementCreate).not.toHaveBeenCalled();
  });

  it('складывает две строки заказа на один товар', async () => {
    // Ключ идемпотентности — (заказ, позиция), поэтому вторая строка была бы
    // отклонена, а её количество потерялось.
    db.orderFindUnique.mockResolvedValue(order([
      { product_id: 'p1', name: 'Маска', quantity: 2 },
      { product_id: 'p1', name: 'Маска', quantity: 3 },
    ]));
    db.itemFindMany.mockResolvedValue([
      { id: 'i1', name: 'Маска', sku: null, productId: 'p1', autoRestock: true },
    ]);
    db.itemFindFirst.mockResolvedValue({ id: 'i1', quantity: 0 });

    const out = await restockFromOrder('order-1');

    expect(db.movementCreate).toHaveBeenCalledTimes(1);
    expect(out.received[0].quantity).toBe(5);
  });

  it('помечает повторный приход как уже проведённый', async () => {
    const { Prisma } = await import('@prisma/client');
    db.orderFindUnique.mockResolvedValue(order([{ product_id: 'p1', name: 'Маска', quantity: 2 }]));
    db.itemFindMany.mockResolvedValue([
      { id: 'i1', name: 'Маска', sku: null, productId: 'p1', autoRestock: true },
    ]);
    db.itemFindFirst.mockResolvedValue({ id: 'i1', quantity: 7 });
    db.movementCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' }),
    );

    const out = await restockFromOrder('order-1');

    expect(out.received).toEqual([]);
    expect(out.alreadyApplied).toBe(true);
    expect(db.itemUpdateMany).not.toHaveBeenCalled();
  });

  it('пропускает строки без количества и без названия', async () => {
    db.orderFindUnique.mockResolvedValue(order([
      { product_id: 'p1', name: 'Маска', quantity: 0 },
      { product_id: '', name: '', quantity: 5 },
    ]));

    const out = await restockFromOrder('order-1');

    expect(out.received).toEqual([]);
    expect(db.movementCreate).not.toHaveBeenCalled();
  });
});
