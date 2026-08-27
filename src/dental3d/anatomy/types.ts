// ═══════════════════════════════════════════════════════════════════
// DENTAL 3D — anatomical data model
//
// Every field here is a real morphometric quantity (millimetres, degrees)
// grounded in published dental-anatomy sources, not an arbitrary shader
// parameter — see ToothDefinition.references and docs/DENTAL_3D_ENGINE.md
// for what was used to derive each tooth's numbers.
//
// Local coordinate system (per tooth, origin at the crown/root junction —
// the cervical line — on the tooth's long axis):
//   +Y  occlusal/incisal direction (up), -Y apical direction (down, roots)
//   +X  buccal,  -X  lingual/palatal        ("buccolingual" axis)
//   +Z  mesial,  -Z  distal                 ("mesiodistal" axis)
// Cusp/groove/fossa angles are measured in the XZ plane from +Z (mesial),
// sweeping toward +X (buccal) — so mesiobuccal sits near 45°, distobuccal
// near 135°, distolingual near 225°, mesiolingual near 315°.
// ═══════════════════════════════════════════════════════════════════

export type ToothClass = 'incisor' | 'canine' | 'premolar' | 'molar'
export type DentalArch = 'maxillary' | 'mandibular'
export type ToothSide = 'left' | 'right' | 'midline'

export interface CuspDefinition {
  /** Anatomical name, e.g. 'mesiobuccal', 'mesiolingual' */
  name: string
  /** Degrees in the crown-local XZ plane, 0° = mesial, 90° = buccal (see file header) */
  angleDeg: number
  /** Distance from crown center to cusp tip, 0 (center) – 1 (crown periphery) */
  radialPosition: number
  /** Cusp tip height above the occlusal reference plane, mm */
  heightMm: number
  /** Gaussian falloff radius controlling cusp footprint width, mm. Isotropic
   *  fallback used whenever `slopeRadiiMm` is absent — e.g. for the optional
   *  Cusp of Carabelli, deliberately left isotropic in Phase 1. */
  radiusMm: number
  /** Anisotropic falloff radii (mm), replacing the isotropic `radiusMm` when
   *  present. A real cusp's shape is closer to a pyramid with 4 inclined
   *  planes than an isotropic dome (see references) — `radialInwardMm` lets
   *  the cusp's slope reach far enough toward the crown center to meet its
   *  neighbors and form a natural saddle line there (the ridge/groove
   *  emerges from where two cusp masses meet, not from a separately-authored
   *  connecting bump), `radialOutwardMm` keeps the outer silhouette crisp,
   *  `tangentialMm` controls the reach sideways along the arch toward
   *  adjacent cusps. See engine/mathUtils.ts `anisotropicCuspBump`. */
  slopeRadiiMm?: { radialInwardMm: number; radialOutwardMm: number; tangentialMm: number }
  /** 0–1 relative prominence, for documentation/validation only (not fed into geometry) */
  prominence: number
  /** True for accessory/non-obligate cusps (e.g. Cusp of Carabelli) absent in some individuals */
  optional?: boolean
}

export interface GrooveDefinition {
  name: string
  /** Polyline in crown-local (x,z) mm, defines the groove path across the occlusal table */
  path: Array<[number, number]>
  depthMm: number
  widthMm: number
}

export interface RidgeDefinition {
  name: string
  kind: 'marginal' | 'triangular' | 'oblique' | 'transverse'
  /** Named cusps/landmarks this ridge connects — documentation + validation, not geometry input directly */
  connects: [string, string]
  /** Polyline in crown-local (x,z) mm the ridge crest follows */
  path: Array<[number, number]>
  heightMm: number
  widthMm: number
}

export interface FossaDefinition {
  name: string
  /** Center in crown-local (x,z) mm */
  center: [number, number]
  depthMm: number
  radiusMm: number
}

export interface CrownDefinition {
  heightMm: number
  mesiodistalWidthMm: number
  buccolingualWidthMm: number
  /** Occlusal-view outline family used to shape the crown blank */
  outline: 'rhomboid' | 'ellipsoid' | 'trapezoid' | 'triangular' | 'incisal-blade'
  cusps: CuspDefinition[]
  grooves: GrooveDefinition[]
  ridges: RidgeDefinition[]
  fossae: FossaDefinition[]
}

export interface RootDefinition {
  /** Anatomical name, e.g. 'mesiobuccal', 'distobuccal', 'palatal' */
  name: string
  /** Origin offset from crown center at the cervical line, mm in crown-local (x,z) */
  originOffsetMm: [number, number]
  lengthMm: number
  baseDiameterMm: number
  apexDiameterMm: number
  /** Tilt of the root's long axis off vertical, degrees, toward buccal(+)/lingual(-) */
  buccolingualTiltDeg: number
  /** Tilt off vertical, degrees, toward mesial(+)/distal(-) */
  mesiodistalTiltDeg: number
  /** Apical third curvature (0 = straight taper, positive = curves distally near the apex), degrees */
  apicalCurvatureDeg: number
  /** Ratio of buccolingual to mesiodistal cross-section radius (1 = circular). Several
   *  roots are flattened mesiodistally (e.g. the mesiobuccal root of a maxillary molar
   *  is broad buccopalatally, narrow mesiodistally) — see references. */
  crossSectionAspect: number
}

export type ReferenceType =
  | 'peer_reviewed'
  | 'university_course'
  | 'systematic_review'
  | 'encyclopedic_crossref'
  | 'cbct_study'
  /** A dental-technology / lab-technique text (wax-carving, CAD modeling) —
   *  describes HOW real cusps/ridges are built, not just their proportions. */
  | 'technique_description'
  /** Continuing-education course material for practicing clinicians. */
  | 'clinical_ce_course'
  /** Glossary/terminology cross-reference — corroborating only, not primary;
   *  never the sole source for a claim. */
  | 'glossary_crossref'

export interface AnatomicalReference {
  source: string
  url?: string
  type: ReferenceType
  /** True when this source's content is known only from a search-result
   *  snippet, not a fully fetched/read page (e.g. the page blocked direct
   *  fetching) — flagged so the confidence gap is visible, not hidden. */
  snippetOnly?: boolean
  /** Which features this source was used to confirm/derive */
  confirmedFeatures: string[]
}

export interface ToothDefinition {
  fdi: number
  commonName: string
  toothClass: ToothClass
  arch: DentalArch
  side: ToothSide
  crown: CrownDefinition
  roots: RootDefinition[]
  /** References used to derive this tooth's numbers — auditability, not decoration */
  references: AnatomicalReference[]
  /** Known limitations / simplifications versus the cited anatomy — never omit known gaps */
  knownLimitations: string[]
}
