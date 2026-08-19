/**
 * The clinic's own settings for the concierge, read defensively.
 *
 * The one that carries risk is the financing figure. "From ~104 000 ₸ a month"
 * is a statement about consumer credit, so this computes **nothing** beyond
 * `total / N`, where `N` is a number the clinic typed in itself: no rate, no
 * schedule, no implied interest. It is shown only when the clinic has entered a
 * term, always alongside "exact terms at the clinic" and a route to a human.
 * Anything more than that needs a licensed partner and a lawyer, not a helper.
 *
 * Lives in `Clinic.settings` JSON rather than in columns — same convention as
 * the rest of `clinicSettings.ts`, and no migration for a per-clinic toggle.
 */

import type { PresentationLocale } from './beats.js';
import { PRESENTATION_LOCALES } from './beats.js';

/** A term nobody would type on purpose is a typo, not a 40-year plan. */
export const MAX_FINANCING_MONTHS = 36;
export const MIN_FINANCING_MONTHS = 2;

export interface ConciergeSettings {
  /** Months the clinic offers interest-free, or `null` when not configured. */
  financingMonths: number | null;
  /** Optional clinic-written line shown next to the figure. */
  financingNote: string | null;
  personaName: string | null;
  defaultLocale: PresentationLocale | null;
}

export const CONCIERGE_DEFAULTS: ConciergeSettings = {
  financingMonths: null,
  financingNote: null,
  personaName: null,
  defaultLocale: null,
};

export const MAX_FINANCING_NOTE_CHARS = 160;

/**
 * Read the `concierge` block out of a clinic's settings JSON.
 *
 * Every field falls back to "not configured" rather than to a default value:
 * an accidental `financingMonths: 0` must not become a division by zero on a
 * price the patient is reading, and a missing block must not invent a
 * financing offer the clinic never made.
 */
export function readConciergeSettings(raw: unknown): ConciergeSettings {
  if (!raw || typeof raw !== 'object') return { ...CONCIERGE_DEFAULTS };
  const block = (raw as Record<string, unknown>).concierge;
  if (!block || typeof block !== 'object') return { ...CONCIERGE_DEFAULTS };
  const cfg = block as Record<string, unknown>;

  const months = Number(cfg.financingMonths);
  const financingMonths =
    Number.isInteger(months) && months >= MIN_FINANCING_MONTHS && months <= MAX_FINANCING_MONTHS
      ? months
      : null;

  const note = typeof cfg.financingNote === 'string' ? cfg.financingNote.trim() : '';
  const persona = typeof cfg.personaName === 'string' ? cfg.personaName.trim() : '';
  const locale = String(cfg.defaultLocale || '');

  return {
    financingMonths,
    // A note without a term would sit next to no figure at all.
    financingNote: financingMonths && note ? note.slice(0, MAX_FINANCING_NOTE_CHARS) : null,
    personaName: persona ? persona.slice(0, 40) : null,
    defaultLocale: (PRESENTATION_LOCALES as readonly string[]).includes(locale)
      ? (locale as PresentationLocale)
      : null,
  };
}

/**
 * The monthly figure, rounded **up**.
 *
 * Up, not down: rounding down would quote a number that does not add back up to
 * the total, and the patient would be right to call that misleading.
 */
export function monthlyFigure(total: number, months: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  if (!Number.isInteger(months) || months < MIN_FINANCING_MONTHS) return 0;
  return Math.ceil(total / months);
}
