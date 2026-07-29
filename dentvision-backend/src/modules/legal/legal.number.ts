const prefixMap: Record<string, string> = {
  CLINIC_AGREEMENT: 'CLN',
  DIAGNOSTICS_AGREEMENT: 'DGN',
  LABORATORY_AGREEMENT: 'LAB',
  MARKETPLACE_AGREEMENT: 'MKT',
  SUPPLIER_AGREEMENT: 'SUP',
  LECTURER_AGREEMENT: 'LEC',
  ACADEMY_AGREEMENT: 'ACD',
  NDA: 'NDA',
  PRIVACY_POLICY: 'PRV',
  TERMS_OF_SERVICE: 'TOS',
  AI_POLICY: 'AIP',
  COOKIE_POLICY: 'COK',
  DPA: 'DPA',
  SLA: 'SLA',
  API_AGREEMENT: 'API',
  REFERRAL_AGREEMENT: 'REF',
};

export function generateDocumentNumber(type: string, sequence: number): string {
  const year = new Date().getFullYear();
  const prefix = prefixMap[type] ?? 'DOC';
  return `DV-${prefix}-${year}-${String(sequence).padStart(4, '0')}`;
}

let _counter = 0;

export function nextSequence(): number {
  _counter += 1;
  return _counter;
}

export function resetSequence(val = 0): void {
  _counter = val;
}
