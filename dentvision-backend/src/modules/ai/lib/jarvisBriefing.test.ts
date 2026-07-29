import { describe, expect, it } from 'vitest';
import { alertCategoriesForRole, filterAlertsForRole } from '../core/jarvisBriefing.js';

describe('jarvisBriefing role filters', () => {
  it('owner sees finance + stock', () => {
    const cats = alertCategoriesForRole('OWNER');
    expect(cats?.has('billing')).toBe(true);
    expect(cats?.has('stock')).toBe(true);
  });

  it('doctor does not see stock/billing noise', () => {
    const alerts = [
      { category: 'appointments', text: 'soon' },
      { category: 'billing', text: 'debt' },
      { category: 'stock', text: 'low' },
      { category: 'school', text: 'course' },
      { category: 'load', text: 'recall' },
    ];
    const filtered = filterAlertsForRole(alerts, 'DOCTOR');
    expect(filtered.map((a) => a.category)).toEqual(['appointments', 'school', 'load']);
  });

  it('admin focuses on appointments, cashier and load', () => {
    const filtered = filterAlertsForRole(
      [
        { category: 'appointments' },
        { category: 'billing' },
        { category: 'stock' },
        { category: 'load' },
      ],
      'admin',
    );
    expect(filtered.map((a) => a.category)).toEqual(['appointments', 'billing', 'load']);
  });

  it('owner sees load category', () => {
    expect(alertCategoriesForRole('OWNER')?.has('load')).toBe(true);
  });
});
