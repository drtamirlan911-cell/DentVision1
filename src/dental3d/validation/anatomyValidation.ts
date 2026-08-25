// Validates a ToothDefinition's numbers against dental-anatomy sanity
// ranges and structural completeness (references, known limitations) —
// catches typos/nonsense parameters before they ever reach the geometry
// engine, and enforces that a definition can't ship without documenting
// what it's grounded in and where it simplifies.

import type { ToothDefinition } from '../anatomy/types'

export interface AnatomyValidationIssue {
  code: string
  severity: 'error' | 'warning'
  message: string
}

export interface AnatomyValidationReport {
  fdi: number
  issues: AnatomyValidationIssue[]
  passed: boolean
}

const MOLAR_EXPECTED_CUSPS = [4, 5]
const MOLAR_EXPECTED_ROOTS: Record<'maxillary' | 'mandibular', number> = { maxillary: 3, mandibular: 2 }

export function validateToothAnatomy(tooth: ToothDefinition): AnatomyValidationReport {
  const issues: AnatomyValidationIssue[] = []
  const { crown, roots } = tooth

  // Crown proportion sanity (permanent-dentition ranges, generously bounded)
  if (crown.heightMm < 4 || crown.heightMm > 10) {
    issues.push({ code: 'crown-height-out-of-range', severity: 'warning', message: `Crown height ${crown.heightMm}mm is outside the typical 4-10mm range` })
  }
  if (crown.mesiodistalWidthMm < 4 || crown.mesiodistalWidthMm > 13) {
    issues.push({ code: 'md-width-out-of-range', severity: 'warning', message: `Mesiodistal width ${crown.mesiodistalWidthMm}mm is outside the typical 4-13mm range` })
  }
  if (crown.buccolingualWidthMm < 4 || crown.buccolingualWidthMm > 14) {
    issues.push({ code: 'bl-width-out-of-range', severity: 'warning', message: `Buccolingual width ${crown.buccolingualWidthMm}mm is outside the typical 4-14mm range` })
  }

  if (tooth.toothClass === 'molar' && tooth.arch === 'maxillary' && crown.buccolingualWidthMm <= crown.mesiodistalWidthMm) {
    issues.push({ code: 'maxillary-molar-bl-not-greater', severity: 'error', message: 'Maxillary molars are characteristically broader buccolingually than mesiodistally — this definition is not' })
  }

  // Cusp count for the tooth class. Optional accessory cusps (e.g. Carabelli)
  // don't count toward the required baseline of 4-5 obligate cusps.
  const nonOptionalCusps = crown.cusps.filter((c) => !c.optional).length
  if (tooth.toothClass === 'molar' && !MOLAR_EXPECTED_CUSPS.includes(nonOptionalCusps)) {
    issues.push({ code: 'molar-cusp-count', severity: 'error', message: `Molar has ${nonOptionalCusps} non-optional cusps, expected 4 or 5` })
  }
  for (const cusp of crown.cusps) {
    if (cusp.heightMm <= 0) issues.push({ code: 'non-positive-cusp-height', severity: 'error', message: `Cusp '${cusp.name}' has non-positive height` })
    if (cusp.radialPosition < 0 || cusp.radialPosition > 1) issues.push({ code: 'cusp-radial-out-of-range', severity: 'error', message: `Cusp '${cusp.name}' radialPosition ${cusp.radialPosition} is outside [0,1]` })
  }

  // Root count for arch + class
  if (tooth.toothClass === 'molar') {
    const expected = MOLAR_EXPECTED_ROOTS[tooth.arch]
    if (roots.length !== expected) {
      issues.push({ code: 'molar-root-count', severity: 'error', message: `${tooth.arch} molar has ${roots.length} roots, expected ${expected}` })
    }
  }
  for (const root of roots) {
    if (root.lengthMm < 6 || root.lengthMm > 18) {
      issues.push({ code: 'root-length-out-of-range', severity: 'warning', message: `Root '${root.name}' length ${root.lengthMm}mm is outside the typical 6-18mm range` })
    }
    if (root.apexDiameterMm >= root.baseDiameterMm) {
      issues.push({ code: 'root-not-tapering', severity: 'error', message: `Root '${root.name}' apex diameter is not smaller than its base diameter — roots taper` })
    }
    if (root.crossSectionAspect <= 0) {
      issues.push({ code: 'invalid-cross-section-aspect', severity: 'error', message: `Root '${root.name}' has a non-positive crossSectionAspect` })
    }
  }

  // Total tooth length (crown + average root length) sanity vs published ~19-21mm for this tooth class
  if (roots.length > 0) {
    const avgRootLength = roots.reduce((s, r) => s + r.lengthMm, 0) / roots.length
    const totalLength = crown.heightMm + avgRootLength
    if (tooth.toothClass === 'molar' && (totalLength < 15 || totalLength > 24)) {
      issues.push({ code: 'total-length-out-of-range', severity: 'warning', message: `Crown + average root length ${totalLength.toFixed(1)}mm is outside the typical 15-24mm range for a molar` })
    }
  }

  // Ridge/groove connects reference real cusp names (catches typos)
  const cuspNames = new Set(crown.cusps.map((c) => c.name))
  for (const ridge of crown.ridges) {
    for (const name of ridge.connects) {
      if (!cuspNames.has(name) && !name.includes('groove') && !name.includes('fossa')) {
        issues.push({ code: 'ridge-unknown-connection', severity: 'warning', message: `Ridge '${ridge.name}' references unknown landmark '${name}'` })
      }
    }
  }

  // Structural completeness — a definition must be auditable, not just plausible-looking.
  if (tooth.references.length < 3) {
    issues.push({ code: 'insufficient-references', severity: 'error', message: `Only ${tooth.references.length} references recorded; expected at least 3 independent sources` })
  }
  if (tooth.knownLimitations.length === 0) {
    issues.push({ code: 'no-limitations-documented', severity: 'error', message: 'No known limitations documented — every procedurally generated tooth has at least one simplification versus real anatomy' })
  }

  const passed = !issues.some((i) => i.severity === 'error')
  return { fdi: tooth.fdi, issues, passed }
}
