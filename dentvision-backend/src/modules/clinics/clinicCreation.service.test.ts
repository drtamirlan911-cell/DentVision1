import { describe, expect, it } from 'vitest';
import { normalizeClinicInput } from './clinicCreation.service.js';

describe('clinic creation input contract', () => {
  it('keeps only supported profile fields and trims whitespace', () => {
    expect(normalizeClinicInput({ name: ' DentVision ', city: ' Taraz ', address: ' Main 1 ', phone: ' +7 777 ', plan: 'ENTERPRISE', role: 'SUPERADMIN', active: true }))
      .toEqual({ name: 'DentVision', city: 'Taraz', address: 'Main 1', phone: '+7 777' });
  });
  it('rejects a missing or oversized clinic name', () => {
    expect(normalizeClinicInput({ city: 'Taraz' })).toBeNull();
    expect(normalizeClinicInput({ name: 'x'.repeat(121) })).toBeNull();
  });
  it('rejects incorrectly typed or oversized optional fields', () => {
    expect(normalizeClinicInput({ name: 'Clinic', city: 123 })).toBeNull();
    expect(normalizeClinicInput({ name: 'Clinic', address: 'x'.repeat(301) })).toBeNull();
    expect(normalizeClinicInput({ name: 'Clinic', phone: 'x'.repeat(41) })).toBeNull();
  });
  it('uses a fixed demo name and does not accept a client subscription plan', () => {
    expect(normalizeClinicInput({ plan: 'ENTERPRISE' }, 'Моя демо-клиника')).toEqual({ name: 'Моя демо-клиника' });
    expect(normalizeClinicInput({ name: ' ', plan: 'PRO' }, 'Моя демо-клиника')?.name).toBe('Моя демо-клиника');
  });
});
