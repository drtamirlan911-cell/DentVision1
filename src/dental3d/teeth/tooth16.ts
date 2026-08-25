// ═══════════════════════════════════════════════════════════════════
// TOOTH 16 — permanent maxillary right first molar (FDI 16)
//
// Numbers below are derived from published morphometric ranges and
// landmark relationships, cross-checked across independent sources (see
// `references`) — not measured off one CT scan of one specimen. Real teeth
// vary; this is one anatomically defensible instance, not a population
// average flattened into "the" correct shape.
// ═══════════════════════════════════════════════════════════════════

import type { ToothDefinition } from '../anatomy/types'

export const TOOTH_16: ToothDefinition = {
  fdi: 16,
  commonName: 'Верхний правый первый моляр',
  toothClass: 'molar',
  arch: 'maxillary',
  side: 'right',

  crown: {
    heightMm: 7.5,
    mesiodistalWidthMm: 10.5,
    buccolingualWidthMm: 11.5,
    outline: 'rhomboid',

    cusps: [
      // Mesiolingual (mesiopalatal) — largest and most prominent cusp of the tooth.
      { name: 'mesiolingual', angleDeg: 315, radialPosition: 0.8, heightMm: 2.0, radiusMm: 2.4, prominence: 1.0 },
      { name: 'mesiobuccal', angleDeg: 45, radialPosition: 0.75, heightMm: 1.8, radiusMm: 2.2, prominence: 0.85 },
      { name: 'distobuccal', angleDeg: 135, radialPosition: 0.7, heightMm: 1.5, radiusMm: 1.9, prominence: 0.65 },
      // Distolingual — smallest of the four main cusps.
      { name: 'distolingual', angleDeg: 225, radialPosition: 0.65, heightMm: 1.3, radiusMm: 1.7, prominence: 0.5 },
      // Cusp of Carabelli — present in ~52-68% of individuals (see references); modelled
      // but flagged optional so callers can render the more common plain-mesiolingual form.
      { name: 'carabelli', angleDeg: 330, radialPosition: 0.55, heightMm: 0.4, radiusMm: 1.0, prominence: 0.15, optional: true },
    ],

    grooves: [
      // Depths increased relative to the ridges they cross (see roots/knownLimitations
      // history): the central groove and the two triangular ridges converge on almost
      // the same spot near true center, and a groove has to out-depth what it crosses
      // there or the crossing reads as a bump instead of a valley.
      { name: 'central_developmental_groove', path: [[0, 3.0], [0, 0.5], [0.2, -2.0]], depthMm: 0.85, widthMm: 0.7 },
      { name: 'buccal_developmental_groove', path: [[0, 0.5], [2.0, 0.3], [3.3, 0.2]], depthMm: 0.6, widthMm: 0.6 },
      { name: 'lingual_developmental_groove', path: [[0, -1.0], [-1.8, -1.2], [-3.0, -1.4]], depthMm: 0.6, widthMm: 0.6 },
      { name: 'mesial_triangular_groove', path: [[0, 3.0], [-1.0, 3.3]], depthMm: 0.4, widthMm: 0.5 },
      { name: 'distal_triangular_groove', path: [[0.2, -2.0], [1.0, -2.6]], depthMm: 0.4, widthMm: 0.5 },
    ],

    ridges: [
      { name: 'mesial_marginal_ridge', kind: 'marginal', connects: ['mesiobuccal', 'mesiolingual'], path: [[-2.2, 3.6], [0, 3.9], [2.4, 3.7]], heightMm: 0.5, widthMm: 1.1 },
      { name: 'distal_marginal_ridge', kind: 'marginal', connects: ['distobuccal', 'distolingual'], path: [[-2.0, -3.3], [0, -3.6], [2.0, -3.3]], heightMm: 0.4, widthMm: 1.0 },
      // Corrected against source disagreement: the oblique ridge connects the distobuccal
      // cusp's triangular ridge to the mesiolingual cusp's distal ridge — the majority/
      // standard reference relationship, not the mesiobuccal-distolingual pairing one
      // secondary source implied. See references / docs for the resolved conflict.
      // Height/width reduced from the first pass: at full height/width the ridge's own
      // path midpoint sits almost on top of the central fossa and out-competed its
      // depth (see docs/DENTAL_3D_ENGINE.md validation log) — real oblique ridges are a
      // lower, narrower connecting rise, not a second cusp-height spine.
      { name: 'oblique_ridge', kind: 'oblique', connects: ['distobuccal', 'mesiolingual'], path: [[2.85, -2.6], [0, 0.3], [-2.97, 3.25]], heightMm: 0.45, widthMm: 0.95 },
      { name: 'mesiobuccal_triangular_ridge', kind: 'triangular', connects: ['mesiobuccal', 'central_developmental_groove'], path: [[3.0, 2.1], [0.6, 0.5]], heightMm: 0.22, widthMm: 0.6 },
      { name: 'mesiolingual_triangular_ridge', kind: 'triangular', connects: ['mesiolingual', 'central_developmental_groove'], path: [[-2.97, 3.25], [-0.5, 0.3]], heightMm: 0.22, widthMm: 0.6 },
    ],

    fossae: [
      // Depth/radius increased from the first pass: the oblique ridge and both
      // triangular ridges converge right where this pit belongs, and the fossa
      // needs to out-depth that crossing (not just the cusps) to read as a true
      // pit instead of a raised "knot" at the tooth's geometric center.
      { name: 'central_fossa', center: [0, 0.8], depthMm: 1.15, radiusMm: 1.5 },
      { name: 'distal_fossa', center: [0.4, -2.3], depthMm: 0.55, radiusMm: 1.0 },
      { name: 'mesial_triangular_fossa', center: [-0.3, 3.2], depthMm: 0.4, radiusMm: 0.7 },
      { name: 'distal_triangular_fossa', center: [0.5, -3.0], depthMm: 0.35, radiusMm: 0.6 },
    ],
  },

  roots: [
    {
      name: 'mesiobuccal',
      originOffsetMm: [2.5, 1.8],
      lengthMm: 12.0,
      baseDiameterMm: 4.0,
      apexDiameterMm: 1.2,
      buccolingualTiltDeg: 9,
      mesiodistalTiltDeg: 4,
      apicalCurvatureDeg: 14, // distal apical curvature — literature-confirmed as the majority pattern
      crossSectionAspect: 1.35, // broad buccopalatally, narrow mesiodistally
    },
    {
      name: 'distobuccal',
      originOffsetMm: [2.3, -1.9],
      lengthMm: 10.5, // shortest of the three — "distobuccal root is the smallest"
      baseDiameterMm: 3.2,
      apexDiameterMm: 1.0,
      buccolingualTiltDeg: 12,
      mesiodistalTiltDeg: -3,
      apicalCurvatureDeg: 8,
      crossSectionAspect: 1.1,
    },
    {
      name: 'palatal',
      originOffsetMm: [-2.8, 0.3],
      lengthMm: 13.5, // "the palatal root is the largest and longest of all roots"
      baseDiameterMm: 4.5,
      apexDiameterMm: 1.4,
      buccolingualTiltDeg: -28, // diverges lingually/palatally — MB↔palatal / DB↔palatal are the widest divergences
      mesiodistalTiltDeg: 1,
      apicalCurvatureDeg: 5,
      crossSectionAspect: 1.0,
    },
  ],

  references: [
    {
      source: "External and Internal Anatomy of Maxillary Permanent First Molars",
      url: 'https://www.intechopen.com/chapters/65711',
      type: 'peer_reviewed',
      confirmedFeatures: ['4-lobe cusp arrangement', 'central groove pattern', 'crown broader buccolingually than mesiodistally'],
    },
    {
      source: 'Maxillary first molar — Wikipedia (cross-reference only, not primary)',
      url: 'https://en.wikipedia.org/wiki/Maxillary_first_molar',
      type: 'encyclopedic_crossref',
      confirmedFeatures: ['4 lobes named mesiobuccal/distobuccal/mesiolingual/distolingual', 'optional Cusp of Carabelli', 'central developmental groove'],
    },
    {
      source: 'Root and Root Canal Morphology of the Human Permanent Maxillary First Molar: A Literature Review, J. Endodontics',
      url: 'https://www.jendodon.com/article/S0099-2399(06)00412-2/abstract',
      type: 'systematic_review',
      confirmedFeatures: ['3 separate roots (MB/DB/palatal) in ~96% of teeth', 'MB root distal curvature ~52% of cases'],
    },
    {
      source: 'Root Morphology of First Permanent Molars, Dar-Es-Salaam population study',
      url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11986916/',
      type: 'cbct_study',
      confirmedFeatures: ['three-root pattern prevalence', 'root fusion incidence ~5%'],
    },
    {
      source: 'Vertical relationships between the divergence angle of maxillary molar roots and the maxillary sinus floor (CBCT study)',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8665178/',
      type: 'cbct_study',
      confirmedFeatures: ['distobuccal-palatal root divergence angle (mean 44.9°)', 'mesiobuccal root broad buccopalatally, narrow mesiodistally', 'distobuccal root is the smallest root'],
    },
    {
      source: 'Buccolingual and Mesiodistal Dimensions of the Permanent Teeth — Rakhshan, BioMed Research International',
      url: 'https://onlinelibrary.wiley.com/doi/10.1155/2022/8381436',
      type: 'peer_reviewed',
      confirmedFeatures: ['MD crown width ~10.6-11.3mm', 'BL crown width ~11.7-11.8mm', 'crown height ~7.3-8.4mm'],
    },
    {
      source: 'Tooth Morphology — Permanent Posterior Teeth, Oral Facial Anatomy Online (eCampusOntario open textbook)',
      url: 'https://ecampusontario.pressbooks.pub/oralfacialonline/chapter/tooth-morphology-part-a/',
      type: 'university_course',
      confirmedFeatures: ['central/distal/mesial-triangular/distal-triangular fossae layout', '6 developmental grooves', 'oblique ridge separates central and distal fossae'],
    },
    {
      source: 'Cusp of Carabelli — Wikipedia / PMC case reports on Carabelli trait prevalence',
      url: 'https://en.wikipedia.org/wiki/Cusp_of_Carabelli',
      type: 'encyclopedic_crossref',
      confirmedFeatures: ['Carabelli cusp on mesiolingual cusp, ~52-68% prevalence, non-functional accessory cusp'],
    },
  ],

  knownLimitations: [
    "crown.outline is set to 'rhomboid' but crownGeometry.ts does not yet read it — the wall/table footprint is currently always a plain ellipse, not the characteristic rhomboidal occlusal outline of a maxillary molar. Known dead field, not yet wired up.",
    'Occlusal surface still reads as "crumpled/faceted" rather than smoothly rounded when viewed straight down or from the buccal aspect — a real, user-reported defect, only partially addressed. Root cause identified: the height field is authored as a stack of many independently-centered compact-support radial bumps (cusps, ridges, grooves, fossae combined via max()/subtraction); each bump is individually smooth, but several closely-spaced bumps combined create local curvature changes too complex for mesh-level blurring or added tessellation to fully smooth out. A prior version had a worse defect where the oblique ridge and both triangular ridges converged near true center and out-competed the central fossa depth, producing a raised "knot" where the deepest pit should be — that specific bug is fixed (fossa depth/radius increased, ridge height/width reduced, blur upgraded from a 4-tap axis-aligned to an 8-tap radial kernel) and confirmed both by direct height-field sampling and live render. The remaining "crumpled" character was NOT fixed by widening the blur radius (tried 0.35mm through 0.75mm) or by doubling mesh resolution (tried 96 angular segments / 30 table rings, reverted — no visible improvement, not worth the extra triangle count) — a genuinely smooth, natural result likely needs a different height-field authoring technique (e.g. fewer/broader primary landmarks with lower-amplitude secondary detail, or a properly G2-continuous blended surface) rather than further parameter tuning of the current approach.',
    'Mesial marginal ridge still appears as a visible V-shaped notch between the mesiobuccal and mesiolingual cusps from the mesial view, rather than the fairly continuous, gently undulating ridge line real molars show — not addressed in this pass (effort went to the higher-priority central-fossa bug and the general faceting issue above). Found via live WebGL render.',
    'Crown and roots are separate manifold meshes sharing one local origin, not a single boolean-unioned watertight body — see docs/DENTAL_3D_ENGINE.md.',
    'Root cross-section rings are axis-aligned in the crown-local XZ plane rather than fully perpendicular to the (mildly curving) centerline tangent — negligible at these tilt/curvature magnitudes but not physically exact.',
    'Root divergence angles were tuned to approximate the literature mean (DB-palatal ≈44.9°) rather than reproducing one measured specimen.',
    'Internal anatomy (pulp chamber, root canals, dentin) is not modelled — exterior surface only.',
    'One representative instance derived from published ranges, not a segmentation of an actual CT/intraoral scan — real teeth show more individual variation than any single model can capture.',
    'Cusp of Carabelli is included but marked optional (~52-68% population prevalence, not universal) — callers should default it off unless explicitly enabling the variant.',
  ],
}
