/** FDI permanent dentition morphology for textbook odontogram. */

export type RootPattern = 'incisor' | 'canine' | 'premolar1' | 'premolar2' | 'molarUpper' | 'molarLower'
export type ToothVariant = 'centralIncisor' | 'lateralIncisor' | 'canine' | 'upperPremolar1' | 'upperPremolar2' | 'lowerPremolar' | 'upperMolar1' | 'upperMolar2' | 'upperMolar3' | 'lowerMolar1' | 'lowerMolar2' | 'lowerMolar3' | 'primaryIncisor' | 'primaryCanine' | 'primaryMolar'

export interface ToothMorphology {
  /** Anatomical family for SVG silhouette */
  pattern: RootPattern
  /** Typical root count (textbook) */
  roots: 1 | 2 | 3
  /** Short RU label */
  label: string
  variant: ToothVariant
}

const INC = (label: string): ToothMorphology => ({ pattern: 'incisor', roots: 1, label, variant: 'centralIncisor' })
const LAT = (label: string): ToothMorphology => ({ pattern: 'incisor', roots: 1, label, variant: 'lateralIncisor' })
const CAN = (label: string): ToothMorphology => ({ pattern: 'canine', roots: 1, label, variant: 'canine' })
const PM1 = (label: string): ToothMorphology => ({ pattern: 'premolar1', roots: 2, label, variant: 'upperPremolar1' })
const PM2 = (label: string): ToothMorphology => ({ pattern: 'premolar2', roots: 1, label, variant: 'upperPremolar2' })
const MU = (label: string): ToothMorphology => ({ pattern: 'molarUpper', roots: 3, label, variant: 'upperMolar1' })
const ML = (label: string): ToothMorphology => ({ pattern: 'molarLower', roots: 2, label, variant: 'lowerMolar1' })

/** Permanent teeth 11–48 */
export const TOOTH_MORPHOLOGY: Record<number, ToothMorphology> = {
  18: MU('Зуб мудрости'), 17: MU('2 моляр'), 16: MU('1 моляр'),
  15: PM2('2 премоляр'), 14: PM1('1 премоляр'), 13: CAN('Клык'),
  12: LAT('2 резец'), 11: INC('1 резец'),
  21: INC('1 резец'), 22: LAT('2 резец'), 23: CAN('Клык'),
  24: PM1('1 премоляр'), 25: PM2('2 премоляр'),
  26: MU('1 моляр'), 27: MU('2 моляр'), 28: MU('Зуб мудрости'),

  48: ML('Зуб мудрости'), 47: ML('2 моляр'), 46: ML('1 моляр'),
  45: { pattern: 'premolar2', roots: 1, label: '2 премоляр', variant: 'lowerPremolar' }, 44: { pattern: 'premolar2', roots: 1, label: '1 премоляр', variant: 'lowerPremolar' }, 43: CAN('Клык'),
  42: LAT('2 резец'), 41: INC('1 резец'),
  31: INC('1 резец'), 32: LAT('2 резец'), 33: CAN('Клык'),
  34: { pattern: 'premolar2', roots: 1, label: '1 премоляр', variant: 'lowerPremolar' }, 35: { pattern: 'premolar2', roots: 1, label: '2 премоляр', variant: 'lowerPremolar' },
  36: ML('1 моляр'), 37: ML('2 моляр'), 38: ML('Зуб мудрости'),
}

/**
 * Primary (deciduous) teeth 51–85.
 *
 * Same five silhouettes as the permanent set — a milk molar is still a molar —
 * but the labels say so, because "1 моляр" on a chart switched to milk teeth
 * would be the wrong tooth entirely.
 */
export const PRIMARY_TOOTH_MORPHOLOGY: Record<number, ToothMorphology> = {
  55: MU('2 молочный моляр'), 54: MU('1 молочный моляр'), 53: CAN('Молочный клык'),
  52: INC('2 молочный резец'), 51: INC('1 молочный резец'),
  61: INC('1 молочный резец'), 62: INC('2 молочный резец'), 63: CAN('Молочный клык'),
  64: MU('1 молочный моляр'), 65: MU('2 молочный моляр'),

  85: ML('2 молочный моляр'), 84: ML('1 молочный моляр'), 83: CAN('Молочный клык'),
  82: INC('2 молочный резец'), 81: INC('1 молочный резец'),
  71: INC('1 молочный резец'), 72: INC('2 молочный резец'), 73: CAN('Молочный клык'),
  74: ML('1 молочный моляр'), 75: ML('2 молочный моляр'),
}

export function getToothMorphology(fdi: number): ToothMorphology {
  return TOOTH_MORPHOLOGY[fdi] || PRIMARY_TOOTH_MORPHOLOGY[fdi] || INC('Зуб')
}

/** Quadrant from FDI: 1 UR, 2 UL, 3 LL, 4 LR — 5–8 are the primary mirror. */
export function fdiQuadrant(fdi: number): 1 | 2 | 3 | 4 {
  const q = Math.floor(fdi / 10)
  return (q > 4 ? q - 4 : q) as 1 | 2 | 3 | 4
}

export function isUpperArch(fdi: number): boolean {
  const q = fdiQuadrant(fdi)
  return q === 1 || q === 2
}

/** True for 51–85 — a deciduous tooth, drawn slightly smaller and rounder. */
export function isPrimaryTooth(fdi: number): boolean {
  return fdi >= 51 && fdi <= 85 && Math.floor(fdi / 10) >= 5
}
