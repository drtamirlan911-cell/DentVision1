import { randomUUID } from 'node:crypto';

// Payment provider abstraction (Phase 5). Real providers (Kaspi QR, cards)
// implement the same interface; this mock lets the full flow run in dev/sandbox.
export interface PaymentProvider {
  name: string;
  createPayment(input: { amountMinor: bigint; refId?: string | null }): Promise<{
    externalId: string;
    qr: string;
  }>;
}

export const kaspiProvider: PaymentProvider = {
  name: 'kaspi_qr',
  async createPayment({ refId }) {
    const externalId = `kaspi_${randomUUID()}`;
    // In production this would call Kaspi to obtain a real QR/deeplink.
    const qr = `https://kaspi.kz/pay/${externalId}${refId ? `?ref=${encodeURIComponent(refId)}` : ''}`;
    return { externalId, qr };
  },
};

export const providers: Record<string, PaymentProvider> = {
  kaspi_qr: kaspiProvider,
};
