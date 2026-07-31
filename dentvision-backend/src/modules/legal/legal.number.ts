import prisma from '../../lib/prisma.js';

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

/**
 * Derive the sequence from the DB so numbers stay unique across restarts
 * (documentNumber is unique). Falls back to the in-process counter.
 */
export async function nextSequenceFromDb(): Promise<number> {
  try {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT count(*)::int AS c FROM "legal_documents"`,
    );
    return (rows?.[0]?.c || 0) + 1;
  } catch {
    _counter += 1;
    return _counter;
  }
}

export function resetSequence(val = 0): void {
  _counter = val;
}
