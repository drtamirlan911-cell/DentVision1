import prisma from '../../lib/prisma.js';
import { tengeToMinor } from '../../lib/money.js';
import {
  PARTNER_VERTICALS,
  recordPartnerEconomics,
} from './partner-economics.service.js';

/**
 * Creates the immutable platform-economics snapshot for a dental-lab order.
 *
 * A dental-lab order becomes an economic operation only when it reaches
 * `delivered`: before delivery the clinic may still cancel, remake, or adjust
 * the order, so recording platform revenue earlier would overstate GMV.
 * `recordPartnerEconomics` provides the operation-id idempotency guard.
 */
export async function recordDentalLabOrderEconomics(labOrderId: string) {
  const order = await prisma.labOrder.findUnique({
    where: { id: labOrderId },
    select: { id: true, status: true, price: true, files: true },
  });

  if (!order || order.status !== 'delivered' || order.price == null) return null;

  const meta = (order.files as { meta?: { laboratoryId?: string } } | null)?.meta;
  const laboratoryId = meta?.laboratoryId;
  if (!laboratoryId) return null;

  const grossMinor = tengeToMinor(Number(order.price) || 0);
  if (grossMinor <= 0n) return null;

  return recordPartnerEconomics({
    vertical: PARTNER_VERTICALS.DENTAL_LAB,
    partnerId: laboratoryId,
    grossMinor,
    operationId: order.id,
  });
}
