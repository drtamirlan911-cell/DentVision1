import { describe, expect, it } from 'vitest';
import { hasAcceptedLatestDentalLabDelivery } from './dentalLabAcceptance.js';

const shipment = {
  id: 'shipment-latest',
  laboratoryId: 'lab-1',
  status: 'delivered',
  deliveredAt: new Date('2026-11-24T10:00:00.000Z'),
  proofUrl: 'https://proof.example/receipt',
  recipientName: 'Clinic Reception',
};

describe('dental laboratory acceptance gate', () => {
  it('accepts only the latest shipment with durable delivery evidence and matching lab', () => {
    expect(hasAcceptedLatestDentalLabDelivery(
      { status: 'accepted', shipmentId: shipment.id },
      shipment,
      'lab-1',
    )).toBe(true);
  });

  it('rejects missing acceptance and stale acceptance for an earlier shipment', () => {
    expect(hasAcceptedLatestDentalLabDelivery(null, shipment, 'lab-1')).toBe(false);
    expect(hasAcceptedLatestDentalLabDelivery(
      { status: 'accepted', shipmentId: 'shipment-previous' },
      shipment,
      'lab-1',
    )).toBe(false);
  });

  it('rejects deliveries without proof, recipient, delivery timestamp or delivered state', () => {
    const accepted = { status: 'accepted', shipmentId: shipment.id };
    expect(hasAcceptedLatestDentalLabDelivery(accepted, { ...shipment, proofUrl: null }, 'lab-1')).toBe(false);
    expect(hasAcceptedLatestDentalLabDelivery(accepted, { ...shipment, recipientName: ' ' }, 'lab-1')).toBe(false);
    expect(hasAcceptedLatestDentalLabDelivery(accepted, { ...shipment, deliveredAt: null }, 'lab-1')).toBe(false);
    expect(hasAcceptedLatestDentalLabDelivery(accepted, { ...shipment, status: 'dispatched' }, 'lab-1')).toBe(false);
  });

  it('rejects proof belonging to another laboratory', () => {
    expect(hasAcceptedLatestDentalLabDelivery(
      { status: 'accepted', shipmentId: shipment.id },
      shipment,
      'another-lab',
    )).toBe(false);
  });
});
