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
      // slopeRadiiMm: real cusps are closer to a 4-inclined-plane pyramid than an
      // isotropic dome (see references) — radialInwardMm lets the cusp's slope
      // reach far enough toward the crown center to meet its neighbors and form a
      // natural saddle line there, instead of a separately-authored ridge bump
      // patching the gap. radialOutwardMm stays tighter than radiusMm so the
      // silhouette doesn't balloon past the crown's defined width.
      { name: 'mesiolingual', angleDeg: 315, radialPosition: 0.8, heightMm: 2.0, radiusMm: 2.4, prominence: 1.0, slopeRadiiMm: { radialInwardMm: 3.8, radialOutwardMm: 1.8, tangentialMm: 2.4 } },
      { name: 'mesiobuccal', angleDeg: 45, radialPosition: 0.75, heightMm: 1.8, radiusMm: 2.2, prominence: 0.85, slopeRadiiMm: { radialInwardMm: 3.5, radialOutwardMm: 1.65, tangentialMm: 2.2 } },
      { name: 'distobuccal', angleDeg: 135, radialPosition: 0.7, heightMm: 1.5, radiusMm: 1.9, prominence: 0.65, slopeRadiiMm: { radialInwardMm: 3.0, radialOutwardMm: 1.43, tangentialMm: 1.9 } },
      // Distolingual — smallest of the four main cusps.
      { name: 'distolingual', angleDeg: 225, radialPosition: 0.65, heightMm: 1.3, radiusMm: 1.7, prominence: 0.5, slopeRadiiMm: { radialInwardMm: 2.7, radialOutwardMm: 1.28, tangentialMm: 1.7 } },
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
      furcationConcavityMm: 0.45, // "prominent concavities" on the MB root, per references
      furcationFadeFraction: 0.35,
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
      furcationConcavityMm: 0.3, // shallower than MB/palatal, still present
      furcationFadeFraction: 0.3,
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
      furcationConcavityMm: 0.4, // "more frequently" the deeper of the two concave roots, per references
      furcationFadeFraction: 0.4,
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
      source: 'Remembering Your Roots (Dimensions of Dental Hygiene)',
      url: 'https://dimensionsofdentalhygiene.com/article/remembering-your-roots/',
      type: 'clinical_ce_course',
      confirmedFeatures: [
        'deeper root-surface concavities on the mesiobuccal and (more frequently) the palatal root',
        'furcation entrance distances from the CEJ: ~3mm mesial, ~4mm buccal, ~5mm distal — used to size the furcation-concavity fade-out zone',
      ],
    },
    {
      source: 'Hand Instrumentation of First Molar Teeth (Dimensions of Dental Hygiene)',
      url: 'https://dimensionsofdentalhygiene.com/article/hand-instrumentation-of-first-molar-teeth/',
      type: 'clinical_ce_course',
      confirmedFeatures: [
        'mesial surface concavity leading into the furcation',
        'distobuccal root concavity present but shallower/less prominent than mesiobuccal or palatal',
        'a groove can exist within the concavity, and a longitudinal groove runs the length of the palatal root',
      ],
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
    // Added for the anisotropic-cusp redesign (see engine/mathUtils.ts
    // `anisotropicCuspBump`/`smoothMax`, docs/DENTAL_3D_ENGINE.md): sources
    // on HOW cusps/ridges are actually shaped and built, not just their
    // proportions — the gap the first pass at this tooth was missing.
    {
      source: 'Dental Anatomy and Morphology of Permanent Teeth (ch. 86255)',
      url: 'https://www.intechopen.com/chapters/86255',
      type: 'peer_reviewed',
      confirmedFeatures: [
        'cusp described as pyramidal geometry with a quadrangular base (4 inclined planes, not an isotropic dome)',
        'triangular ridges start from cusp tips toward the occlusal center',
        'central fossa forms where ridges and grooves converge',
      ],
    },
    {
      source: 'Anatomical Knowledge for Modeling (dental-technology / CAD modeling chapter)',
      url: 'https://pocketdentistry.com/anatomical-knowledge-for-modeling/',
      type: 'technique_description',
      confirmedFeatures: [
        'in additive (wax) technique, cusps are built as broad masses moved closer together until their slopes meet — the meeting point is the ridge/groove, not a separately authored connecting bump',
        'a ridge is defined as a cusp crest formed by two slopes, each ending in a groove',
      ],
    },
    {
      source: 'Anatomical and Functional Characteristics of Teeth (CE course 5157)',
      url: 'https://cdeworld.com/courses/5157-anatomical-and-functional-characteristics-of-teeth',
      type: 'clinical_ce_course',
      confirmedFeatures: ['stamping (supporting) vs shearing (guiding) cusp roles', 'triangular ridges run from cusp tips to the central sulcus groove'],
    },
    {
      source: 'Essential Shape — The key to a tooth-like restoration',
      url: 'https://www.styleitaliano.org/essential-shape-tooth-like-restoration/',
      type: 'technique_description',
      confirmedFeatures: ['primary (macro-form) / secondary (macro-texture) / tertiary (micro-texture) anatomy framing, used to prioritize which layer this phase targets'],
    },
    {
      source: 'Posterior tooth anatomy: wax carving, Parts 1–2',
      url: 'https://www.aesthetic-update.co.uk/content/aesthetic-dentistry/posterior-tooth-anatomy-wax-carving-part-1',
      type: 'technique_description',
      snippetOnly: true, // direct fetch returned HTTP 403 — known only via search-result snippets, not the full article
      confirmedFeatures: ['carving order: primary anatomy (main cusp inclines, primary fossae, silhouette) first, secondary anatomy (accessory fissures) carved in afterward'],
    },
    {
      source: 'Cuspal ridge / triangular ridge terminology cross-references (hellopearl.com glossary + aggregated dental-anatomy course results)',
      type: 'glossary_crossref',
      confirmedFeatures: ['each cusp has 4 named slopes (mesial, distal, facial/buccal, lingual cuspal ridges) meeting at an apex — corroborates the pyramidal, not isotropic, cusp shape from the IntechOpen source above'],
    },
  ],

  knownLimitations: [
    "crown.outline is set to 'rhomboid' but crownGeometry.ts does not yet read it — the wall/table footprint is currently always a plain ellipse, not the characteristic rhomboidal occlusal outline of a maxillary molar. Known dead field, not yet wired up.",
    'Occlusal relief was redesigned from isotropic per-cusp bumps combined via max()/sum to anisotropic bumps (engine/mathUtils.ts `anisotropicCuspBump`) combined via smooth-max (`smoothMaxCompact`, a compact-support-aware wrapper around the standard quadratic smin/smax — Inigo Quilez, "Smooth Minimum Function") — grounded in dental wax-carving/modeling sources documented in `references` above showing real cusps are closer to a 4-inclined-plane pyramid than an isotropic dome, and are built as broad masses that meet at a natural saddle line, not narrow bumps patched together with a separate ridge feature. This fixed two confirmed, measured defects: (1) cusp apex heights no longer overshoot `heightMm` (verified numerically — every apex now samples to exactly its defined height, not +0.2-0.3mm as an earlier smoothMax-based attempt produced); (2) the buccal-view silhouette now reads as two clearly separate, smoothly rounded buccal cusp domes rather than several small jagged spikes (confirmed by live render). The top-down occlusal view is measurably smoother in the underlying height field (verified by sampling — no more flat near-zero "gap" between adjacent cusps) but STILL visually reads as one dome dominated by the central developmental groove cross rather than 4 distinctly separate mounds when viewed straight down — improved, not resolved. A further redesign iteration (e.g. widening the cusps\' tangential reach further, or reworking how the central developmental groove\'s width/depth reads from directly above) would be needed to close that gap; not attempted this pass.',
    'Mesial marginal ridge still appears as a visible V-shaped notch between the mesiobuccal and mesiolingual cusps from the mesial view, rather than the fairly continuous, gently undulating ridge line real molars show — unchanged by the anisotropic-cusp redesign above (effort went to the primary occlusal-table shape, not this specific ridge). Found via live WebGL render, not yet fixed.',
    'Crown and roots are separate manifold meshes sharing one local origin, not a single boolean-unioned watertight body — see docs/DENTAL_3D_ENGINE.md.',
    'Root cross-section rings are axis-aligned in the crown-local XZ plane rather than fully perpendicular to the (mildly curving) centerline tangent — negligible at these tilt/curvature magnitudes but not physically exact.',
    'Root divergence angles were tuned to approximate the literature mean (DB-palatal ≈44.9°) rather than reproducing one measured specimen.',
    'Roots now carve a furcation-facing surface concavity (`furcationConcavityMm`/`furcationFadeFraction`, engine/rootGeometry.ts `furcationDent`) instead of being a perfectly smooth tapered cone — the earlier version had none, which read as artificial "hot dog" fingers, confirmed by live render and fixed by adding this. The concavity direction is approximated as fixed (the root\'s cervical-line origin offset, negated) rather than recomputed per ring along the true centerline — reasonable given the fade zone is concentrated near the cervical line where the roots have barely diverged, but not exact for the (small) remaining length where it\'s still partially active. The palatal root\'s separately-documented longitudinal groove (distinct from the furcation concavity, running the root\'s full length) is not modelled — only the furcation-facing concavity is. Root taper remains strictly linear (base diameter to apex diameter) rather than the non-linear, faster-tapering-in-the-apical-third profile real roots often show; not addressed this pass.',
    'Internal anatomy (pulp chamber, root canals, dentin) is not modelled — exterior surface only.',
    'One representative instance derived from published ranges, not a segmentation of an actual CT/intraoral scan — real teeth show more individual variation than any single model can capture.',
    'Cusp of Carabelli is included but marked optional (~52-68% population prevalence, not universal) — callers should default it off unless explicitly enabling the variant. It also has no `slopeRadiiMm` — deliberately left on the old isotropic bump in this pass (smaller diff, and it is a minor accessory cusp, not one of the 4 primary cusps the anisotropic redesign targeted).',
  ],
}
