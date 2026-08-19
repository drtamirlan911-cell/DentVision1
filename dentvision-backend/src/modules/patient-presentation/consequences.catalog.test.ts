import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { PRESENTATION_LOCALES } from './beats.js';
import {
  CONSEQUENCE_DISCLAIMER,
  FORBIDDEN_FEAR_PATTERNS,
  FORBIDDEN_PROMISE_PATTERNS,
  allConsequences,
  consequenceKey,
  lookupConsequence,
} from './consequences.catalog.js';

/**
 * This catalogue is the one place in the presentation where a clinical
 * statement is written down, so the tests treat it as a document under review
 * rather than as code: every entry must exist in every language, must not
 * frighten, must not promise, and must not be reachable for a finding that is
 * not in the plan.
 */

describe('the catalogue is complete and unambiguous', () => {
  const entries = allConsequences();

  it('has at least one entry, or the whole act is dead code', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it('has no duplicate keys — a duplicate would silently shadow one entry', () => {
    const keys = entries.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keys agree with the status and urgency they claim', () => {
    for (const entry of entries) {
      expect(entry.key).toBe(consequenceKey(entry.status, entry.urgency));
    }
  });

  it('carries all three locales, non-empty', () => {
    for (const entry of entries) {
      for (const locale of PRESENTATION_LOCALES) {
        expect(entry.text[locale]?.trim(), `${entry.key}/${locale}`).toBeTruthy();
      }
    }
  });

  it('carries a version, so an edit cannot silently rewrite what a patient was shown', () => {
    for (const entry of entries) {
      expect(entry.version, entry.key).toMatch(/^\d+$/);
    }
  });

  it('has a disclaimer in every locale', () => {
    for (const locale of PRESENTATION_LOCALES) {
      expect(CONSEQUENCE_DISCLAIMER[locale]?.trim(), locale).toBeTruthy();
    }
  });
});

describe('nothing here frightens or promises', () => {
  const texts = allConsequences().flatMap((e) =>
    PRESENTATION_LOCALES.map((l) => ({ where: `${e.key}/${l}`, text: e.text[l] })),
  );
  const all = [
    ...texts,
    ...PRESENTATION_LOCALES.map((l) => ({ where: `disclaimer/${l}`, text: CONSEQUENCE_DISCLAIMER[l] })),
  ];

  it('contains no fear language', () => {
    for (const { where, text } of all) {
      for (const pattern of FORBIDDEN_FEAR_PATTERNS) {
        expect(pattern.test(text), `${where} matched ${pattern}`).toBe(false);
      }
    }
  });

  it('contains no promise language', () => {
    for (const { where, text } of all) {
      for (const pattern of FORBIDDEN_PROMISE_PATTERNS) {
        expect(pattern.test(text), `${where} matched ${pattern}`).toBe(false);
      }
    }
  });

  it('stays within one screen — these are spoken lines, not leaflets', () => {
    for (const { where, text } of all) {
      expect(text.length, where).toBeLessThanOrEqual(320);
    }
  });
});

describe('lookup refuses to improvise', () => {
  it('finds an entry that exists', () => {
    expect(lookupConsequence('caries', 'medium')?.key).toBe('caries:medium');
  });

  it('returns null for a status nobody has written about', () => {
    expect(lookupConsequence('implant', 'low')).toBeNull();
  });

  it('returns null when the urgency does not match the entry', () => {
    // 'missing' is written for 'low' only; a 'high' variant must not be
    // borrowed from it, because urgency is part of the clinical claim.
    expect(lookupConsequence('missing', 'low')).not.toBeNull();
    expect(lookupConsequence('missing', 'high')).toBeNull();
  });
});

/**
 * The structural half: it is not enough that today's entries are hand-written,
 * the file must stay a data file. If someone ever wires a model into it, this
 * fails.
 */
describe('the catalogue stays hand-written', () => {
  const source = readFileSync(resolve(__dirname, 'consequences.catalog.ts'), 'utf8');

  it('imports no LLM client, no network and no database', () => {
    for (const forbidden of ['chatWithTools', 'openai', 'OpenAI', 'fetch(', 'prisma']) {
      expect(source.includes(forbidden), `found ${forbidden}`).toBe(false);
    }
  });
});
