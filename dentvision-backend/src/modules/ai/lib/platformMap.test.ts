/**
 * Unit tests for AI platform map + deterministic shortcuts (no LLM).
 */
import { describe, expect, it } from 'vitest';
import {
  normalizeNavSection,
  resolveSection,
  sectionsForRole,
  stageFromPath,
  stageAwareSuggestions,
  platformMapPromptBlock,
} from './platformMap'
import { tryDeterministicNavigate, tryPlatformMapQuery } from './deterministicShortcuts'

describe('platformMap', () => {
  it('resolves Russian aliases to CRM sections', () => {
    expect(normalizeNavSection('Прайс')).toBe('pricelist');
    expect(normalizeNavSection('касса')).toBe('finance');
    expect(normalizeNavSection('МКБ-10')).toBe('icd10');
    expect(resolveSection('кабинет продавца')?.path).toBe('/supplier');
  });

  it('filters guest sections', () => {
    const guest = sectionsForRole('GUEST', true).map((s) => s.key);
    expect(guest).toContain('demo');
    expect(guest).toContain('shop');
    expect(guest).not.toContain('finance');
  });

  it('gives owner clinic billing and staff', () => {
    const keys = sectionsForRole('OWNER').map((s) => s.key);
    expect(keys).toContain('billing');
    expect(keys).toContain('staff');
    expect(keys).toContain('schedule');
  });

  it('infers stage from pathname', () => {
    expect(stageFromPath('/crm/inventory')).toBe('inventory');
    expect(stageFromPath('/shop/checkout')).toBe('shop');
  });

  it('returns stage-aware suggestions for doctor on schedule', () => {
    const s = stageAwareSuggestions({ role: 'DOCTOR', stage: 'schedule' });
    expect(s.some((x) => /расписан|записать|сегодня/i.test(x))).toBe(true);
  });

  it('builds a compact prompt map', () => {
    const block = platformMapPromptBlock('ADMIN');
    expect(block).toContain('Расписание');
    expect(block).toContain('КАРТА СЕРВИСОВ');
  });
});

describe('deterministicShortcuts', () => {
  it('opens sections without LLM', () => {
    const hit = tryDeterministicNavigate('открой склад', { role: 'ADMIN' });
    expect(hit?.intent).toBe('NAVIGATE');
    expect((hit?.action as any)?.payload?.path).toBe('/crm/inventory');
    expect(hit?.toolsUsed).toContain('navigate_fast');
  });

  it('returns platform map on «что умеешь»', () => {
    const hit = tryPlatformMapQuery('что ты умеешь?', { role: 'OWNER' });
    expect(hit?.intent).toBe('PLATFORM_MAP');
    expect(hit?.message).toMatch(/Расписание|Касса|Маркетплейс/);
  });

  it('does not steal revenue KPI into navigate', () => {
    expect(tryDeterministicNavigate('покажи выручку', { role: 'OWNER' })).toBeNull();
  });
});
