import { describe, expect, it } from 'vitest';
import {
  formatPartnerBranchMoney,
  formatPartnerBranchUnitPrice,
  isPartnerBranchInvoicePayable,
  partnerBranchInvoiceStatusLabel,
  partnerBranchInvoiceStatusTone,
  partnerBranchVerticalLabel,
} from './partnerBranchBilling';

describe('partner branch invoice presentation', () => {
  it('formats minor currency units without converting large ledger values to Number', () => {
    expect(formatPartnerBranchMoney('1990000').replace(/\s/g, '')).toBe('19900,00₸');
    expect(formatPartnerBranchMoney('9007199254740993').replace(/\s/g, '')).toBe('90071992547409,93₸');
    expect(formatPartnerBranchMoney('bad')).toBe('—');
  });

  it('formats tariff price and identifies the three approved partner verticals', () => {
    expect(formatPartnerBranchUnitPrice(49900).replace(/\s/g, '')).toBe('49900₸');
    expect(partnerBranchVerticalLabel('DIAGNOSTIC_3D')).toBe('Диагностический центр');
    expect(partnerBranchVerticalLabel('MEDICAL_ANALYSIS')).toBe('Медицинская лаборатория');
    expect(partnerBranchVerticalLabel('DENTAL_LAB')).toBe('Зуботехническая лаборатория');
  });

  it('only makes issued invoices payable and keeps payment states distinct', () => {
    expect(isPartnerBranchInvoicePayable('issued')).toBe(true);
    expect(isPartnerBranchInvoicePayable('payment_pending')).toBe(false);
    expect(isPartnerBranchInvoicePayable('paid')).toBe(false);
    expect(partnerBranchInvoiceStatusLabel('payment_pending')).toBe('Ожидает подтверждения');
    expect(partnerBranchInvoiceStatusTone('paid')).toBe('success');
    expect(partnerBranchInvoiceStatusTone('void')).toBe('error');
  });
});
