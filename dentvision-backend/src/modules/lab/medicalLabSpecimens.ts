export type MedicalLabSpecimenStatus = 'collected' | 'received' | 'processing' | 'rejected' | 'consumed';

export function normalizeMedicalLabBarcode(value: unknown): string | null {
  const barcode = String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');
  return /^[A-Z0-9][A-Z0-9-]{5,39}$/.test(barcode) ? barcode : null;
}

export function buildMedicalLabBarcode(id: string): string {
  const token = String(id || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  if (token.length < 12) throw new Error('A unique specimen id is required to generate an accession barcode');
  return 'DVL-' + token.slice(0, 16);
}

const TRANSITIONS: Record<MedicalLabSpecimenStatus, readonly MedicalLabSpecimenStatus[]> = {
  collected: ['received', 'rejected'],
  received: ['processing', 'rejected'],
  processing: ['consumed', 'rejected'],
  rejected: [],
  consumed: [],
};

export function isMedicalLabSpecimenTransitionAllowed(from: string, to: MedicalLabSpecimenStatus): boolean {
  return (TRANSITIONS[from as MedicalLabSpecimenStatus] || []).includes(to);
}