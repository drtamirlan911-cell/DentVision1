/** FDI permanent dentition morphology for textbook odontogram. */

export type RootPattern = 'incisor' | 'canine' | 'premolar1' | 'premolar2' | 'molarUpper' | 'molarLower'

export interface ToothMorphology {
  /** Anatomical family for SVG silhouette */
  pattern: RootPattern
  /** Typical root count (textbook) */
  roots: 1 | 2 | 3
  /** Short RU label */
  label: string
}

const INC = (label: string): ToothMorphology => ({ pattern: 'incisor', roots: 1, label })
const CAN = (label: string): ToothMorphology => ({ pattern: 'canine', roots: 1, label })
const PM1 = (label: string): ToothMorphology => ({ pattern: 'premolar1', roots: 2, label }) // верхний 1-й премоляр — часто 2 корня
const PM2 = (label: string): ToothMorphology => ({ pattern: 'premolar2', roots: 1, label })
const MU = (label: string): ToothMorphology => ({ pattern: 'molarUpper', roots: 3, label })
const ML = (label: string): ToothMorphology => ({ pattern: 'molarLower', roots: 2, label })

/** Permanent teeth 11–48 */
export const TOOTH_MORPHOLOGY: Record<number, ToothMorphology> = {
  18: MU('Зуб мудрости'), 17: MU('2 моляр'), 16: MU('1 моляр'),
  15: PM2('2 премоляр'), 14: PM1('1 премоляр'), 13: CAN('Клык'),
  12: INC('2 резец'), 11: INC('1 резец'),
  21: INC('1 резец'), 22: INC('2 резец'), 23: CAN('Клык'),
  24: PM1('1 премоляр'), 25: PM2('2 премоляр'),
  26: MU('1 моляр'), 27: MU('2 моляр'), 28: MU('Зуб мудрости'),

  48: ML('Зуб мудрости'), 47: ML('2 моляр'), 46: ML('1 моляр'),
  45: PM2('2 премоляр'), 44: PM2('1 премоляр'), 43: CAN('Клык'),
  42: INC('2 резец'), 41: INC('1 резец'),
  31: INC('1 резец'), 32: INC('2 резец'), 33: CAN('Клык'),
  34: PM2('1 премоляр'), 35: PM2('2 премоляр'),
  36: ML('1 моляр'), 37: ML('2 моляр'), 38: ML('Зуб мудрости'),
}

export function getToothMorphology(fdi: number): ToothMorphology {
  return TOOTH_MORPHOLOGY[fdi] || INC('Зуб')
}

/** Quadrant from FDI: 1 UR, 2 UL, 3 LL, 4 LR */
export function fdiQuadrant(fdi: number): 1 | 2 | 3 | 4 {
  return Math.floor(fdi / 10) as 1 | 2 | 3 | 4
}

export function isUpperArch(fdi: number): boolean {
  const q = fdiQuadrant(fdi)
  return q === 1 || q === 2
}
