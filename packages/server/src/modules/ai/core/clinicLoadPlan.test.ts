import { describe, expect, it } from 'vitest';
import { isClinicLoadQuery } from './clinicLoadPlan.js';

describe('isClinicLoadQuery', () => {
  it('matches ops load intents', () => {
    expect(isClinicLoadQuery('Как заполнить клинику?')).toBe(true);
    expect(isClinicLoadQuery('план загрузки')).toBe(true);
    expect(isClinicLoadQuery('кого возвращать')).toBe(true);
    expect(isClinicLoadQuery('слабые окна')).toBe(true);
    expect(isClinicLoadQuery('пустые слоты на неделе')).toBe(true);
  });

  it('ignores unrelated chat', () => {
    expect(isClinicLoadQuery('открой прайс')).toBe(false);
    expect(isClinicLoadQuery('')).toBe(false);
    expect(isClinicLoadQuery('сколько пациентов сегодня')).toBe(false);
  });
});
