import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AUTOSAVE_PREFIX,
  UI_PREFS_KEY,
  clearPatientSensitiveLocalStorage,
  loadAutosaveDraft,
  saveAutosaveDraft,
} from './uiPrefs';

describe('uiPrefs patient-data persistence guard', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify({ autoSave: true }));
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('does not save patient-scoped drafts', () => {
    saveAutosaveDraft('patient-intake', { firstName: 'NAME_PLACEHOLDER' });
    expect(localStorage.getItem(AUTOSAVE_PREFIX + 'patient-intake')).toBeNull();
  });

  it('does not save drafts containing patient phone, IIN or medical-card fields', () => {
    saveAutosaveDraft('generic-form', {
      label: 'ordinary form',
      patientPhone: 'PHONE_PLACEHOLDER',
      medicalCard: 'MEDICAL_CARD_PLACEHOLDER',
    });
    expect(localStorage.getItem(AUTOSAVE_PREFIX + 'generic-form')).toBeNull();
  });

  it('deletes an existing sensitive draft instead of restoring it', () => {
    localStorage.setItem(AUTOSAVE_PREFIX + 'patient-record', JSON.stringify({ medicalHistory: 'HISTORY_PLACEHOLDER' }));
    expect(loadAutosaveDraft('patient-record')).toBeNull();
    expect(localStorage.getItem(AUTOSAVE_PREFIX + 'patient-record')).toBeNull();
  });

  it('clears autosaves and schedule caches on logout without clearing interface preferences', () => {
    localStorage.setItem(AUTOSAVE_PREFIX + 'settings', JSON.stringify({ theme: 'dark' }));
    localStorage.setItem('dv_schedule_sync_queue_v1', '[]');
    localStorage.setItem('dv_schedule_day_clinic-date', '{}');
    clearPatientSensitiveLocalStorage();
    expect(localStorage.getItem(AUTOSAVE_PREFIX + 'settings')).toBeNull();
    expect(localStorage.getItem('dv_schedule_sync_queue_v1')).toBeNull();
    expect(localStorage.getItem('dv_schedule_day_clinic-date')).toBeNull();
    expect(localStorage.getItem(UI_PREFS_KEY)).not.toBeNull();
  });
});
