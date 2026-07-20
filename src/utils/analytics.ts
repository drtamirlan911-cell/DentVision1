type ProductEvent =
  | 'first_run_started'
  | 'ai_greeting_rendered'
  | 'chat_ready'
  | 'sidebar_docked'
  | 'sidebar_auto_collapsed'
  | 'sidebar_user_expanded'
  | 'first_user_message_sent'
  | 'first_navigation'
  | 'ai_action_confirmed'
  | 'ai_action_cancelled';

type EventPayload = Record<string, string | number | boolean | null | undefined>;

const buffer: Array<{ event: ProductEvent; payload: EventPayload; t: number }> = [];

export function trackProductEvent(event: ProductEvent, payload: EventPayload = {}) {
  const entry = { event, payload, t: Date.now() };
  buffer.push(entry);
  if (buffer.length > 200) buffer.shift();

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dv:product', { detail: entry }));
  }

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[dv:product]', event, payload);
  }
}

export function getProductEventBuffer() {
  return [...buffer];
}
