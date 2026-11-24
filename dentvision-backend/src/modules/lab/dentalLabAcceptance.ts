type RecordLike = Record<string, unknown>;

function isRecord(value: unknown): value is RecordLike {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * A dental-lab invoice/payment is commercially eligible only after the clinic
 * has accepted the exact latest delivery backed by durable delivery evidence.
 * This is deliberately separate from the production status: delivered is an
 * operational event, while acceptance is the clinic's commercial sign-off.
 */
export function hasAcceptedLatestDentalLabDelivery(
  acceptance: unknown,
  latestShipment: unknown,
  expectedLaboratoryId?: string,
): boolean {
  if (!isRecord(acceptance) || !isRecord(latestShipment)) return false;
  if (acceptance.status !== 'accepted') return false;
  if (typeof acceptance.shipmentId !== 'string' || !acceptance.shipmentId) return false;
  if (latestShipment.id !== acceptance.shipmentId || latestShipment.status !== 'delivered') return false;
  if (!latestShipment.deliveredAt) return false;
  if (typeof latestShipment.proofUrl !== 'string' || !latestShipment.proofUrl.trim()) return false;
  if (typeof latestShipment.recipientName !== 'string' || !latestShipment.recipientName.trim()) return false;
  if (expectedLaboratoryId && latestShipment.laboratoryId !== expectedLaboratoryId) return false;
  return true;
}
