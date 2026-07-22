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
    ];
    const filtered = filterAlertsForRole(alerts, 'DOCTOR');
    expect(filtered.map((a) => a.category)).toEqual(['appointments', 'school']);
  });

  it('admin focuses on appointments and cashier', () => {
    const filtered = filterAlertsForRole(
      [
        { category: 'appointments' },
        { category: 'billing' },
        { category: 'stock' },
      ],
      'admin',
    );
    expect(filtered.map((a) => a.category)).toEqual(['appointments', 'billing']);
  });
});
