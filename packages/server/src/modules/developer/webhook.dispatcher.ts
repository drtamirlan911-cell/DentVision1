import { createHmac } from 'node:crypto';
import prisma from '../../lib/prisma.js';
import { subscribe, type DomainEventName } from '../../lib/events.js';

// Webhook dispatcher (Phase 8). Subscribes to domain events and delivers them to
// registered webhooks with an HMAC signature, recording each attempt. Uses the
// Event Bus (Phase 0), so no domain code needs to know about webhooks.
const WEBHOOK_EVENTS: DomainEventName[] = [
  'patient.created',
  'patient.deleted',
  'appointment.created',
  'supplier.status_changed',
  'lecturer.level_changed',
];

const MAX_ATTEMPTS = 3;

function sign(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

async function attemptDelivery(
  hook: { id: string; url: string; secret: string },
  deliveryId: string,
  event: string,
  payload: unknown,
): Promise<void> {
  const body = JSON.stringify({ event, data: payload, deliveryId });
  const signature = sign(hook.secret, body);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const resp = await fetch(hook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-DentVision-Event': event,
          'X-DentVision-Signature': signature,
          'X-DentVision-Delivery': deliveryId,
        },
        body,
      });
      if (resp.ok) {
        await prisma.webhookDelivery.update({
          where: { id: deliveryId },
          data: { status: 'delivered', attempts: attempt, lastError: null },
        });
        return;
      }
      if (attempt === MAX_ATTEMPTS) {
        await prisma.webhookDelivery.update({
          where: { id: deliveryId },
          data: { status: 'failed', attempts: attempt, lastError: `HTTP ${resp.status}` },
        });
      }
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) {
        await prisma.webhookDelivery.update({
          where: { id: deliveryId },
          data: { status: 'failed', attempts: attempt, lastError: (err as Error).message },
        });
      }
    }
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, 200 * attempt));
    }
  }
}

async function deliver(event: string, payload: unknown): Promise<void> {
  const hooks = await prisma.webhook.findMany({
    where: { active: true, events: { has: event } },
  });
  for (const hook of hooks) {
    const delivery = await prisma.webhookDelivery.create({
      data: { webhookId: hook.id, event, payload: payload as object, status: 'pending' },
    });
    await attemptDelivery(hook, delivery.id, event, payload);
  }
}

let registered = false;

export function registerWebhookDispatcher(): void {
  if (registered) return;
  registered = true;
  for (const event of WEBHOOK_EVENTS) {
    subscribe(event as DomainEventName, (payload) => deliver(event, payload));
  }
  console.log('[webhooks] dispatcher registered');
}
