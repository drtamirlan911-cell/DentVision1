# Dental Geometry Engine — Tooth 16 master model (Phase 1)

Status: **gate not yet passed** — three known visual-quality limitations are
documented and unresolved (see "Known limitations" below). Per the agreed
scope, this phase stops at one reference tooth (FDI 16) and does not expand
to the other 31 teeth, a full arch, LOD, or clinical odontogram integration
until those are resolved and a human has signed off on the render.

## Scope of this phase

Built (`do_only`):
- Procedural geometry engine (crown + root builders), not a static mesh import.
- Anatomical data model (`anatomy/types.ts`) with per-tooth cusps, grooves,
  ridges, fossae, roots, cited references, and known limitations.
- One fully parametrized, reference-grounded tooth: FDI 16 (`teeth/tooth16.ts`).
- Two differentiated PBR materials (enamel vs. root/cementum surface).
- An interactive React Three Fiber viewer with 6 standard clinical views.
- Automated geometry (topology) and anatomy (metadata) validation, run as a
  real vitest suite.

Explicitly **not** built this phase: the other 31 teeth, an LOD pipeline, the
full dental arch, clinical pathology rendering, or any change to the existing
Odontogram / business logic. Nothing outside `src/dental3d/**` and the one new
preview route was touched.

## Architecture

```
src/dental3d/
  anatomy/types.ts        — data model (ToothDefinition and its parts)
  engine/
    mathUtils.ts           — smoothstep, lerp, radialBump, distanceToPolyline, footprintXZ
    crownGeometry.ts        — procedural crown mesh builder
    rootGeometry.ts          — procedural root mesh builder
    toothGeometry.ts          — combines crown + roots for one tooth
  teeth/tooth16.ts          — the one reference tooth definition
  materials/dentalMaterials.ts — enamel / root-surface PBR materials
  viewer/
    ToothMesh.tsx            — R3F component rendering one ToothDefinition
    cameraPresets.ts           — the 6 standard clinical views
    DentalViewer3D.tsx          — interactive <Canvas> viewer
  validation/
    geometryValidation.ts       — topology/manifold checks on a built mesh
    anatomyValidation.ts          — metadata/proportion checks on a ToothDefinition
    tooth16.validation.test.ts      — vitest suite over both
    printReport.mjs                  — manual full-report dump (not run in CI)
```

Preview route: `/dental3d-preview` → `src/pages/dev/Dental3DPreview.tsx`. A
standalone page with no app chrome (same pattern as `/sign`), not linked from
any in-app navigation — it exists for engineering/clinical review only.

Stack: Three.js `0.169.0` + `@react-three/fiber` `8.17.10` (v8, not v9 —
the project is on React `^18.2.0` and R3F v9 requires React 19) +
`@react-three/drei` `9.114.3`.

## Coordinate system

Documented in full in the `anatomy/types.ts` header. Per-tooth local frame,
origin at the cervical line:
- `+Y` = occlusal/incisal, `-Y` = apical (root direction)
- `+X` = buccal, `-X` = lingual/palatal
- `+Z` = mesial, `-Z` = distal
- Cusp/landmark angles are measured in the XZ plane from `+Z` (mesial) = 0°,
  sweeping toward `+X` (buccal) = 90°.

## Geometry construction

**Crown** (`crownGeometry.ts`): a revolved, tapered "wall" from the cervical
line to the occlusal edge, stitched (shared vertex ring, no weld pass needed)
to a disc-shaped "occlusal table" cap. The wall taper follows the real
posterior-crown silhouette (narrower at the neck → widest at the anatomical
equator ≈35% up → narrowing again toward the table), plus small asymmetric
convexity lobes (buccal more convex than lingual, a mild mesial contact
bulge) so the wall isn't a perfect ellipse of revolution at every height.

The table's height field combines, per point:
- **cusps** — radial bumps (`radialBump`, compact-support falloff) at each
  cusp's polar position, scaled by its own height/radius/prominence;
- **ridges** — bumps along a path (`distanceToPolyline`) connecting two
  cusps or a cusp and the central groove;
- **grooves** — troughs along a path;
- **fossae** — circular troughs at a point.

Cusp and ridge contributions are combined with `Math.max()`, not summed —
ridge paths intentionally terminate at their connected cusps' own peak
positions, so summing would double-count height there (this was a real bug,
see "Bugs found and fixed"). Groove/fossa troughs subtract afterward. A
5-tap blur (`smoothedOcclusalRelief`) softens the faceted look the analytic
falloffs produce at this mesh density, without moving or erasing landmark
positions.

**Root** (`rootGeometry.ts`): a tapered tube swept along a centerline that
blends a straight cervical tilt (buccolingual + mesiodistal) into extra
apical-third curvature via directional lerp — not compounded per-step
rotation, which would produce an unrealistic spiral. Cross-sections are
elliptical, not circular (`crossSectionAspect`), to capture real root
flattening, e.g. the mesiobuccal root is "broad buccopalatally, narrow
mesiodistally" per the CBCT literature cited in `tooth16.ts`.

Crown and the 3 roots are separate manifold meshes sharing one local origin —
not boolean-unioned into a single watertight body. This is a documented,
intentional limitation (see below), not an oversight.

## Materials

Deliberately two different `THREE.MeshPhysicalMaterial`s (`dentalMaterials.ts`),
not one uniform "plastic tooth" material:
- **Enamel**: `#f2ede2`, roughness 0.32, slight clearcoat, `ior 1.63` (enamel's
  real refractive index, vs. ~1.49 for the acrylic generic tooth assets often
  default to), faint sheen. **No `transmission`** — an earlier version set
  `transmission: 0.06` for subtle translucency, but with no environment/
  background scene for the renderer to sample, transmission reads the dark
  canvas behind the mesh, so the crown looked partially see-through/glass
  instead of opaque enamel (reported directly by a human reviewer, confirmed
  by inspecting the material params — this was a real defect, not a rendering
  illusion). Real enamel translucency needs an IBL probe to look right, which
  this app doesn't have; an opaque-but-glossy material is the honest choice
  until one is added.
- **Root/cementum surface**: `#e0c9a0`, roughness 0.58, no clearcoat — duller,
  warmer, matte, matching how real root surfaces read next to enamel.

## Validation

Real automated checks, run as a vitest suite (`tooth16.validation.test.ts`,
7 tests, all passing), not just visual inspection:

**Geometry (topology)** — `geometryValidation.ts`: manifold check via
boundary-loop analysis (every boundary vertex must have degree 2), degenerate
triangle detection, non-finite-vertex detection. For an intentionally
non-boolean-unioned mesh (crown alone, or one root alone), the correct
manifold criterion is *exactly one open boundary loop* — the cervical line
for the crown, the root-origin ring for a root — not "zero open edges,"
which would incorrectly flag the deliberate design choice as a defect.

Current numbers (via `printReport.mjs`):

| mesh | vertices | triangles | boundary loops | bbox (mm, X×Y×Z) | topology errors |
|---|---|---|---|---|---|
| crown | 2521 | 4968 | 1 | 11.77 × 7.23 × 10.64 | 0 |
| root — mesiobuccal | 381 | 740 | 1 | 4.48 × 11.70 × 3.47 | 0 |
| root — distobuccal | 381 | 740 | 1 | 4.28 × 10.26 × 2.91 | 0 |
| root — palatal | 381 | 740 | 1 | 9.29 × 11.90 × 4.50 | 0 |

Total per tooth: **3664 vertices / 7188 triangles**, 0 topology errors.
Self-intersection is explicitly *not* automated this pass (would need a BVH
pass) — flagged as an `info`-level finding, checked only by visual inspection
from the 6 standard views.

**Anatomy metadata** — `anatomyValidation.ts`: proportion checks (crown
height/width ratios), molar cusp-count check (4 non-optional cusps expected),
root-count check, taper sanity, and two checks that are hard *errors*, not
just documentation gaps: fewer than 3 `references` entries, or an empty
`knownLimitations` array. `TOOTH_16` currently has 8 references and 9
documented limitations — 0 anatomy errors.

## Performance baseline

One tooth (crown + 3 roots): 3664 vertices / 7188 triangles. Linearly scaled
to a full 32-tooth arch (this phase does not build that, but the estimate is
worth recording for the next phase's LOD-pipeline planning): **≈117k
vertices / ≈230k triangles**, well within a real-time WebGL budget (typical
budgets run from several hundred thousand to a few million triangles) even
with zero LOD reduction. This suggests the next phase should prioritize
correctness/naturalism per-tooth over an aggressive LOD scheme, though an LOD
pass is still worth having for mobile targets.

## Reference sources (Tooth 16)

8 sources cross-checked in `tooth16.ts`'s `references` field: 2 peer-reviewed
papers, 2 CBCT studies, 1 systematic review, 1 open university course text,
and 2 encyclopedic cross-references (used only to corroborate, never as a
primary source). One genuine cross-source conflict was found and resolved:
one secondary source implied the oblique ridge connects the mesiobuccal and
distolingual cusps; every majority/standard source (including the systematic
review) has it connecting **distobuccal → mesiolingual**. The model uses the
majority relationship; the resolution is documented inline in `tooth16.ts`
next to the `oblique_ridge` definition.

## Bugs found and fixed (this phase)

1. **Ridge/cusp height stacking.** `occlusalRelief` originally summed cusp
   bumps and ridge bumps unconditionally. Because ridge paths (by anatomical
   definition) terminate exactly at their connected cusps' tip positions, the
   ridge's height stacked on top of the cusp's own peak there, inflating
   crown height past `crown.heightMm` (measured 8.20mm vs. an intended
   7.5mm — the 0.70mm excess matched `oblique_ridge.heightMm` exactly, which
   is what identified the cause). Fixed by combining cusp and ridge relief
   with `Math.max()` instead of addition.

2. **Occlusal table backface culling.** The top-down (occlusal) view
   rendered the crown as a hollow black "donut" — the table cap was
   invisible from directly above. Cause: the table's triangle winding reused
   the cylindrical wall's index pattern, which produces outward-facing
   normals for a vertical wall but does not generalize to a horizontal disc
   cap — the table's normals pointed downward instead of up. Fixed by
   reversing the winding order for both the table's ring quads and its
   center-pole fan. Verified by re-render: the occlusal view then showed a
   solid, correctly lit table.

Both were found via live WebGL screenshots + numeric/geometric reasoning,
not guessed at.

3. **Crown material read as transparent.** A human reviewer looking at the
   live render reported the crown looked glassy/see-through. Cause:
   `createEnamelMaterial()` set `transmission: 0.06` for subtle translucency,
   but the scene has no environment/background map for the renderer to
   sample during transmission — against the dark canvas this reads as
   "seeing through to black," i.e. looks like glass. Fixed by removing
   `transmission` entirely (see "Materials" above). Confirmed by live
   re-render: the crown now reads as solid opaque enamel.

4. **Central fossa read as a raised "knot" instead of a pit.** Same reviewer
   flagged the cusps as generally "unnatural." Sampling the actual height
   field (not just eyeballing the render) showed why: the oblique ridge and
   both triangular ridges converge right where the central fossa — the
   deepest pit on a real molar — belongs, and their combined height there
   (~0.95mm) exceeded the fossa's depth (0.6mm), leaving a net +0.35mm bump
   at the tooth's geometric center instead of a dip. This produced the
   pinwheel/"knot" pattern visible in a wireframe capture. Fixed by
   increasing `central_fossa` depth/radius (0.6→1.15mm / 1.3→1.5mm),
   reducing `oblique_ridge` and both triangular ridges' height/width so they
   no longer out-compete the fossa, and increasing all groove depths
   proportionally. Confirmed two ways: direct height-field sampling (center
   now dips to −0.99mm, a genuine pit) and live re-render (wireframe capture
   after the fix shows a real depression, not a knot, at center).

Both new bugs were found from a live human review of the rendered model —
exactly the kind of check this phase's `honesty_requirement` and validation
gate exist for — not from the automated test suite, which only checks
topology and metadata and has no way to catch "looks unnatural."

## Known limitations (honest, unresolved)

These are recorded verbatim in `TOOTH_16.knownLimitations` as well, so the
data and the documentation cannot drift apart:

1. `crown.outline: 'rhomboid'` is a **dead field** — `crownGeometry.ts` does
   not yet read it; the wall/table footprint is currently always a plain
   ellipse, not the characteristic rhomboidal occlusal outline of a
   maxillary molar.
2. **Occlusal surface still reads as "crumpled/faceted," not smoothly
   natural — the main unresolved item.** The central-fossa bug above (bug 4)
   is fixed and confirmed, but the broader complaint it was found alongside
   — that the cusps don't look naturally rounded — is only partially
   addressed. Root cause: the height field stacks many independently
   centered compact-support radial bumps (cusps/ridges/grooves/fossae
   combined via `max()`/subtraction); each bump alone is smooth, but several
   closely-spaced bumps together create local curvature too complex for
   mesh-level blurring or added tessellation to fully iron out. Tried and
   confirmed *not* to fix it: widening the blur radius from 0.35mm to
   0.75mm (helped a little, plateaued), and doubling mesh resolution to 96
   angular segments / 30 table rings (no visible difference, reverted — not
   worth the extra ~1800 triangles). A genuinely smooth, natural result
   likely needs a different height-field authoring technique — fewer/
   broader primary landmarks with lower-amplitude secondary detail, or a
   properly curvature-continuous blended surface — rather than more
   parameter tuning of the current approach.
3. **Mesial marginal ridge notch**, unchanged by this pass: from the mesial
   view, the ridge between the mesiobuccal and mesiolingual cusps still
   reads as a visible V-shaped notch rather than the fairly continuous,
   gently undulating line real molars show. Not addressed this round —
   effort went to the higher-priority central-fossa bug and item 2 above.
4. Crown and roots are separate manifold meshes sharing one local origin,
   not a single boolean-unioned watertight body.
5. Root cross-section rings are axis-aligned in the crown-local XZ plane
   rather than fully perpendicular to the (mildly curving) centerline
   tangent — negligible at these tilt/curvature magnitudes, not physically
   exact.
6. Root divergence angles approximate the literature mean (DB–palatal
   ≈44.9°), not a measured specimen.
7. Internal anatomy (pulp chamber, root canals, dentin) is not modelled —
   exterior surface only.
8. One representative instance derived from published ranges, not a
   segmentation of an actual CT/intraoral scan — real teeth vary more than
   any single model can capture.
9. Cusp of Carabelli is included but marked `optional` (~52–68% population
   prevalence) — callers should default it off unless explicitly enabling
   the variant.

Item 2 is the one most likely to matter for the "does this look anatomically
natural, not generic-AI" bar the spec set — it should be resolved (via a
different height-field technique, not more tuning of this one) or a
conscious decision made to accept it before treating this phase's gate as
passed.

## Next steps (blocked on the gate)

Per the agreed `next_phase_gate`, do not scale to the remaining 31 teeth, an
LOD pipeline, the full arch, or odontogram integration until:
1. A human has reviewed the live render against the 6 standard views, and
2. Limitation #2 above (the general "crumpled" cusp character) is either
   fixed — likely requiring a different height-field technique, see above —
   or explicitly accepted as good enough for this phase.

If accepted, the next phase should build out the remaining tooth classes
(incisor, canine, premolar per FDI numbering) reusing this same engine, wire
`crown.outline` into `crownGeometry.ts`, and only then plan the LOD pipeline
using the per-tooth triangle counts recorded above as the baseline.
