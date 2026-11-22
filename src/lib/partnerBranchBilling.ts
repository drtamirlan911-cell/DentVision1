export function formatPartnerBranchMoney(value: string | number | bigint | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  let minor: bigint;
  try {
    minor = typeof value === 'bigint' ? value : BigInt(String(value));
  } catch {
    return '—';
  }
  const negative = minor < 0n;
  const absolute = negative ? -minor : minor;
  const whole = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${whole.toLocaleString('ru-RU')},${fraction} ₸`;
}

export function formatPartnerBranchUnitPrice(value: number | string | null | undefined): string {
  if (value === null || value === undefined || !Number.isSafeInteger(Number(value)) || Number(value) < 0) return '—';
  return `${Number(value).toLocaleString('ru-RU')} ₸`;
}

export function partnerBranchVerticalLabel(vertical: string): string {
  return ({
    DIAGNOSTIC_3D: 'Диагностический центр',
    MEDICAL_ANALYSIS: 'Медицинская лаборатория',
    DENTAL_LAB: 'Зуботехническая лаборатория',
  } as Record<string, string>)[String(vertical || '').toUpperCase()] || 'Партнёрская организация';
}

export function partnerBranchInvoiceStatusLabel(status: string): string {
  return ({
    issued: 'К оплате',
    payment_pending: 'Ожидает подтверждения',
    paid: 'Оплачен',
    void: 'Аннулирован',
  } as Record<string, string>)[String(status || '').toLowerCase()] || 'Требует сверки';
}

export function partnerBranchInvoiceStatusTone(status: string): 'success' | 'warning' | 'error' | 'outline' {
  const value = String(status || '').toLowerCase();
  if (value === 'paid') return 'success';
  if (value === 'issued') return 'warning';
  if (value === 'void') return 'error';
  return 'outline';
}

export function isPartnerBranchInvoicePayable(status: string): boolean {
  return String(status || '').toLowerCase() === 'issued';
}
