/**
 * Журнал склада — единственный путь, которым меняется остаток.
 *
 * До него остаток правили из трёх мест напрямую (`quantity: { decrement: 1 }`
 * при закрытии приёма, ручное редактирование позиции, ничего при доставке
 * заказа), и на вопрос «куда делись перчатки» ответить было нечем.
 *
 * Каждое изменение пишется строкой `InventoryMovement`. Уникальный ключ
 * (refType, refId, itemId) делает операцию идемпотентной: сколько бы раз
 * ни повторился вызов для одного заказа или приёма, остаток сдвинется один раз.
 */

import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { uid } from '../../lib/helpers.js';

export type MovementReason =
  /** Приход из доставленного заказа маркетплейса. */
  | 'order_delivery'
  /** Списание расходников по правилам после закрытия приёма. */
  | 'appointment_close'
  /** Ручной приход или списание кладовщиком. */
  | 'manual'
  /** Правка остатка при инвентаризации. */
  | 'correction';

export interface MovementInput {
  clinicId: string;
  itemId: string;
  /** Со знаком: плюс — приход, минус — списание. */
  delta: number;
  reason: MovementReason;
  refType?: string | null;
  refId?: string | null;
  note?: string | null;
  userId?: string | null;
}

export interface MovementApplied {
  applied: true;
  movementId: string;
  /** Сколько единиц реально прошло по складу (может быть меньше запрошенного). */
  delta: number;
  quantityAfter: number;
  /** Сколько не хватило на складе — 0, если списалось полностью. */
  shortfall: number;
}

export interface MovementSkipped {
  applied: false;
  /**
   * duplicate — это движение уже проводили (повторный вызов);
   * empty      — позиции нет или остаток нулевой, списывать нечего;
   * noop       — нулевая дельта.
   */
  reason: 'duplicate' | 'empty' | 'noop';
}

export type MovementOutcome = MovementApplied | MovementSkipped;

/**
 * Явный предикат, а не сужение по `applied`.
 *
 * Бэкенд собирается без `strictNullChecks`, и там сужение
 * дискриминированного объединения по булеву полю не срабатывает —
 * `if (!out.applied)` не даёт компилятору ветку `MovementSkipped`.
 */
export function isMovementApplied(out: MovementOutcome): out is MovementApplied {
  return out.applied === true;
}

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Провести движение и сдвинуть остаток.
 *
 * Списание урезается по остатку, а не отбрасывается целиком: расходники в
 * клинике кончаются, и правило, которое в такой момент не делает ничего,
 * оставляет склад врать до следующей инвентаризации. В журнал попадает то,
 * что реально произошло, а нехватка возвращается вызывающему — её есть смысл
 * показать («перчаток списано 2 из 3»).
 *
 * Вызывать внутри транзакции: между вставкой движения и правкой остатка
 * не должно быть окна, в котором одно есть, а другого нет.
 */
export async function recordMovement(tx: Tx, input: MovementInput): Promise<MovementOutcome> {
  const requested = Math.trunc(Number(input.delta) || 0);
  if (requested === 0) return { applied: false, reason: 'noop' };

  const item = await tx.inventoryItem.findFirst({
    where: { id: input.itemId, clinicId: input.clinicId },
    select: { id: true, quantity: true },
  });
  if (!item) return { applied: false, reason: 'empty' };

  const available = Number(item.quantity) || 0;
  const wanted = Math.abs(requested);
  const taken = requested < 0 ? Math.min(wanted, available) : wanted;
  const delta = requested < 0 ? -taken : taken;
  const shortfall = wanted - taken;
  if (delta === 0) return { applied: false, reason: 'empty' };

  const refType = input.refType || null;
  const refId = input.refId || null;

  let movementId: string;
  try {
    const movement = await tx.inventoryMovement.create({
      data: {
        id: uid(),
        clinicId: input.clinicId,
        itemId: input.itemId,
        delta,
        reason: input.reason,
        refType,
        refId,
        note: input.note || null,
        userId: input.userId || null,
      },
      select: { id: true },
    });
    movementId = movement.id;
  } catch (error) {
    // P2002 на (refType, refId, itemId) — это движение уже проводили.
    // Единственный признак повтора, который не зависит от того, дошёл ли
    // вызывающий до конца в прошлый раз.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { applied: false, reason: 'duplicate' };
    }
    throw error;
  }

  // Сторож на остатке — на случай, если между чтением и правкой позицию
  // тронула соседняя транзакция.
  const guard = delta < 0
    ? { id: input.itemId, clinicId: input.clinicId, quantity: { gte: -delta } }
    : { id: input.itemId, clinicId: input.clinicId };
  const changed = await tx.inventoryItem.updateMany({
    where: guard,
    data: { quantity: delta < 0 ? { decrement: -delta } : { increment: delta } },
  });
  if (changed.count !== 1) {
    // Остаток увели из-под нас: движение, которое ничего не сдвинуло,
    // в журнале лгало бы — убираем его вместе с заявкой на идемпотентность.
    await tx.inventoryMovement.delete({ where: { id: movementId } });
    return { applied: false, reason: 'empty' };
  }

  return {
    applied: true,
    movementId,
    delta,
    quantityAfter: available + delta,
    shortfall,
  };
}
