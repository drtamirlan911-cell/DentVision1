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
- **cusps** — the primary shape. Each cusp is an **anisotropic** compact-
  support bump (`anisotropicCuspBump`) when it defines `slopeRadiiMm`
  (all 4 non-optional cusps of tooth 16 do; the optional Cusp of Carabelli
  doesn't, see "Known limitations"), falling back to the older isotropic
  `radialBump` otherwise. The bump is stretched toward the crown center
  (`radialInwardMm`) so a cusp's slope reaches far enough to meet its
  neighbors and form a natural saddle line where they meet, and compressed
  toward the crown's outer wall (`radialOutwardMm`) so the silhouette stays
  inside the bbox-proportion test's tolerance. This is grounded in real
  dental technique, not invented: a cusp's true shape is closer to a
  4-inclined-plane pyramid than an isotropic dome, and wax-carving technique
  builds cusps as broad masses moved toward each other until their slopes
  meet — the meeting point *is* the ridge/groove line, not a separately
  authored connecting bump (see `references` in `tooth16.ts` for the
  sources). Cusps combine with **`smoothMaxCompact`**, a compact-support-
  aware wrapper around the standard quadratic smooth-max (Inigo Quilez,
  "Smooth Minimum Function") — see "Bugs found and fixed" for why a bare
  `Math.max()`, and even a naive `smoothMax` fold from a `0` baseline, both
  produce real, measured defects here.
- **ridges** — now a small, capped secondary refinement layered on top of
  the cusp-driven primary shape (also via `smoothMaxCompact`, combined with
  the primary shape via max so it can never stack additively on top of a
  cusp's own peak), not an equal competitor to cusps as in the first pass.
- **grooves** — troughs along a path (`distanceToPolyline`);
- **fossae** — circular troughs at a point.

Groove/fossa troughs subtract afterward, unchanged by the anisotropic
redesign. A 9-tap blur (`smoothedOcclusalRelief`, center + 8-direction ring)
softens residual faceting from the analytic falloffs at this mesh density,
without moving or erasing landmark positions.

**Root** (`rootGeometry.ts`): a tapered tube swept along a centerline that
blends a straight cervical tilt (buccolingual + mesiodistal) into extra
apical-third curvature via directional lerp — not compounded per-step
rotation, which would produce an unrealistic spiral. Cross-sections are
elliptical, not circular (`crossSectionAspect`), to capture real root
flattening, e.g. the mesiobuccal root is "broad buccopalatally, narrow
mesiodistally" per the CBCT literature cited in `tooth16.ts`.

Each cross-section ring is also dented inward on the side facing the
furcation (`furcationDent`, driven by `furcationConcavityMm`) — strongest at
the cervical line and fading out over `rootTrunkFraction`. Without this a
root is a perfectly smooth cone, which reads as an artificial "hot dog
finger," not a real root surface — real molar roots have a documented
concavity leading into the furcation, most pronounced on the mesiobuccal
and palatal roots (see `references` in `tooth16.ts`). The "inward"
direction is approximated as fixed per root (the negated cervical-line
origin offset) rather than recomputed per ring along the true centerline —
reasonable since the fade zone is concentrated near the cervical line,
where the roots have barely diverged from that direction yet.

Over that same `rootTrunkFraction` zone, each root's cross-section is also
*widened* (`rootTrunkWidenFactor`) rather than starting at its full-length
taper's base diameter right at the cervical line. This approximates the
real **root trunk**: below the crown, a multi-rooted tooth's roots stay
fused as one wider mass down to the furcation entrance (documented as
~3-6mm for a maxillary first molar, varying by aspect — buccal shortest,
distal longest) before actually separating — they don't begin as 3 already-
separated, already-narrow tubes right at the CEJ. Without this widening,
the crown's wide cervical wall met 3 narrow root tubes in an abrupt step;
each root here is still an independent, non-boolean-unioned mesh (see
below) — the widening makes neighboring roots' bases overlap generously
under the crown, reading as a merged trunk without actually merging the
meshes.

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

18 sources cross-checked in `tooth16.ts`'s `references` field. The first 8
(proportions/prevalence-focused): 2 peer-reviewed papers, 2 CBCT studies, 1
systematic review, 1 open university course text, and 2 encyclopedic
cross-references (used only to corroborate, never as a primary source). One
genuine cross-source conflict was found and resolved among these: one
secondary source implied the oblique ridge connects the mesiobuccal and
distolingual cusps; every majority/standard source (including the systematic
review) has it connecting **distobuccal → mesiolingual**. The model uses the
majority relationship; the resolution is documented inline in `tooth16.ts`
next to the `oblique_ridge` definition.

6 more were added for the anisotropic-cusp redesign (see "Bugs found and
fixed" #6 below) — these are about *technique* (how cusps/ridges are
actually shaped and built), not proportions: 1 more peer-reviewed source
(cusp described as a pyramidal, 4-inclined-plane form), 2 dental-technique/
CE-course sources on wax-carving and CAD-modeling order (primary masses
first, secondary fissures after), 1 restoration-technique framing source
(primary/secondary/tertiary anatomy), 1 terminology cross-reference
(corroborating the 4-inclined-plane cusp shape), and 1 wax-carving technique
source honestly flagged `snippetOnly: true` — its page returned HTTP 403 on
direct fetch, so it's known only from search-result snippets, not verified
full text, and is documented with that caveat rather than silently treated
as equally solid as the fully-fetched sources.

2 more were added for the root-surface work (see "Bugs found and fixed" #7
below): both clinical CE-course sources on root concavity/furcation
anatomy — which root surfaces concave and how deep, and furcation entrance
distances from the CEJ, used to size where the concavity fades out.

2 more were added for the root-trunk work (see "Bugs found and fixed" #8
below): 1 more clinical CE-course source establishing that the root trunk
extends from the cervical line to the furcation entrance — i.e. roots stay
fused below the crown rather than separating right at the CEJ — and 1 CBCT
study with actual maxillary-first-molar root-trunk length measurements per
aspect (buccal/mesial/distal), used to size `rootTrunkFraction` per root.

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

5. **`smoothMax` inflated apex heights when folded from a `0` baseline.**
   While redesigning the occlusal relief (see #6), an initial implementation
   replaced `Math.max()` across cusps with a naive running fold of the
   textbook `smoothMax(a, b, k)` (Inigo Quilez's quadratic smooth-max),
   starting the accumulator at `0`. Sampling the height field directly (not
   just eyeballing the render) showed cusp apexes overshooting their defined
   `heightMm` by up to +0.29mm. Cause: `smoothMax(0, 0, k)` is **not** `0` —
   it's `k/4` — because the formula has no notion of "this side doesn't
   apply here"; it always blends two competing surfaces, even when both are
   the "nothing contributes here" placeholder. Folding that across every
   cusp compounds the artifact. Fixed by adding `smoothMaxCompact(a, b, k)`,
   which falls back to a plain `Math.max` whenever either side is below a
   small epsilon, restoring an exact `0` baseline far from every cusp while
   still smoothing the real overlap region between two genuinely non-zero
   bumps. Confirmed by re-sampling: every cusp apex now returns exactly its
   defined `heightMm`.

6. **Ridge nudge stacked additively on top of a cusp's own peak.** After
   fixing #5, apex sampling still showed two cusps (mesiolingual,
   distobuccal) overshooting their height by exactly `RIDGE_NUDGE_CAP_MM`
   (0.22mm). Cause: ridge paths are anatomically anchored at their connected
   cusps' own tips (ridges run *from* cusp tips, by definition), so at a
   cusp's own apex the ridge's contribution is near its own maximum too —
   and the relief was computed as `cuspRelief + min(ridgeNudge, cap)`,
   i.e. addition, so the ridge nudge stacked on top of the cusp's own peak
   exactly where they anatomically coincide. This is the same class of bug
   as #1 above (ridge/cusp height stacking), reappearing in the new
   formula. Fixed by combining via `smoothMaxCompact(cuspRelief,
   min(ridgeNudge, cap), k)` — max, not addition — so the ridge nudge only
   shows up as a small raised saddle in the valley between cusps (where
   `cuspRelief` is near 0), never stacks on top of a peak (where
   `cuspRelief` already exceeds the small ridge cap). Confirmed by
   re-sampling: all 4 apexes now match their defined heights exactly.

Bugs #5 and #6 were found by the same discipline as #3 and #4: sampling the
actual height field numerically after every change, not trusting that new
math "looks right" from the formula alone — exactly what caught the
overshoot before it reached a screenshot.

7. **Roots read as smooth "hot dog" cones, and side views cropped them out
   of frame entirely.** Following a direct request to keep improving
   naturalism and specifically make the roots look natural, live screenshots
   showed two separate problems: (a) `VIEW_PRESETS` in `cameraPresets.ts`
   shared one target/distance across all 6 views, tuned for the crown —
   the 4 side-profile views (buccal/palatal/mesial/distal) cropped out
   everything below the cervical line, so the roots weren't even visible to
   evaluate; (b) once the camera framing was fixed (side views now use a
   lower target and greater distance sized to fit the full crown-to-apex
   span, occlusal/apical keep the original crown-tight framing), the roots
   were visibly perfect smooth tapered ellipses with no surface detail —
   real root surfaces aren't. Fixed by adding a furcation-facing surface
   concavity (`furcationDent` in `rootGeometry.ts`, driven by new
   `furcationConcavityMm`/`furcationFadeFraction` fields), grounded in
   documented root-concavity anatomy (deepest on the mesiobuccal and
   palatal roots, present but shallower on distobuccal, concentrated within
   the coronal ~30-40% of root length near the furcation entrance — see the
   2 new references). Confirmed two ways: numerically (sampling the
   cervical-ring cross-section shows the expected radius reduction on the
   furcation-facing side, topology still 0 errors / 1 boundary loop per
   root) and visually (a zoomed live render shows a real groove between the
   two buccal roots instead of two touching plain cylinders).

8. **Crown met the roots in an abrupt step, not a smooth transition.**
   Following a direct question — why do the roots start abruptly instead of
   transitioning smoothly — researched the cementoenamel junction / root
   trunk literature rather than guessing. Finding: below the crown, a
   multi-rooted tooth's roots stay fused as one wider "root trunk" all the
   way down to the furcation entrance (documented ~3-6mm for a maxillary
   first molar, varying by aspect) — they don't separate right at the
   cervical line. Our model had each of the 3 roots starting as its own
   already-separated, already-narrow tube at the cervical line, directly
   under the much wider crown wall — an anatomically real gap, not a
   rendering artifact. Fixed by widening each root's own cross-section near
   the cervical line (`rootTrunkWidenFactor`, same fade zone as the
   furcation concavity, renamed `rootTrunkFraction`), so neighboring roots'
   widened bases overlap generously under the crown — an approximation
   (each root stays its own independent mesh, not a true boolean-merged
   trunk) but a materially better one: confirmed both numerically (cervical
   radius increased as intended, topology still 0 errors / 1 boundary loop
   per root) and visually (a zoomed live render shows a continuous,
   gradually-narrowing transition from crown to root instead of a visible
   step, and the two buccal roots now read as diverging from one merged
   mass rather than as two separate cylinders that happen to touch).

## Known limitations (honest, unresolved)

These are recorded verbatim in `TOOTH_16.knownLimitations` as well, so the
data and the documentation cannot drift apart:

1. `crown.outline: 'rhomboid'` is a **dead field** — `crownGeometry.ts` does
   not yet read it; the wall/table footprint is currently always a plain
   ellipse, not the characteristic rhomboidal occlusal outline of a
   maxillary molar.
2. **Occlusal surface, viewed straight down, still reads as one dome
   dominated by the central developmental groove rather than 4 clearly
   separate mounds — improved, not resolved; the main remaining item.**
   The first pass's height-field technique (many small isotropic compact-
   support bumps summed/maxed together, with a separate ridge feature
   patching the gaps between them) has been replaced with an anisotropic-
   cusp + smooth-blend technique grounded in real dental wax-carving/
   modeling references (see "Bugs found and fixed" #5/#6 and `references`
   in `tooth16.ts`). That fixed two confirmed, measured problems: cusp apex
   heights no longer overshoot their defined value, and the **buccal-view**
   silhouette now shows two clearly separate, smoothly rounded cusp domes
   instead of several small jagged spikes (confirmed by live render — this
   was a real, visible improvement, not just a numeric one). The **top-down
   occlusal** view is measurably smoother in the underlying height field
   (no more flat near-zero gap between adjacent cusps, verified by
   sampling) but still doesn't clearly read as 4 separate mounds when
   viewed exactly from above — the central developmental groove's own
   width/depth visually dominates that particular viewing angle. Not
   pursued further this pass; would need either widening the cusps'
   tangential reach further or reworking the central-groove parameters
   specifically for the top-down read.
3. **Mesial marginal ridge notch**, unchanged by the anisotropic-cusp
   redesign: from the mesial view, the ridge between the mesiobuccal and
   mesiolingual cusps still reads as a visible V-shaped notch rather than
   the fairly continuous, gently undulating line real molars show. Not
   addressed this round — effort went to the primary occlusal-table shape
   (item 2), not this specific ridge.
4. Crown and roots are separate manifold meshes sharing one local origin,
   not a single boolean-unioned watertight body.
5. Root cross-section rings are axis-aligned in the crown-local XZ plane
   rather than fully perpendicular to the (mildly curving) centerline
   tangent — negligible at these tilt/curvature magnitudes, not physically
   exact.
6. Root divergence angles approximate the literature mean (DB–palatal
   ≈44.9°), not a measured specimen.
7. Roots now have a furcation-facing surface concavity and a widened
   cervical-line "root trunk" (see "Bugs found and fixed" #7-#8) instead of
   a perfectly smooth cone starting abruptly at the crown, but: the
   concavity/widening direction is a fixed approximation (the cervical-line
   origin offset, negated) rather than recomputed per ring along the true
   centerline; root taper is still strictly linear rather than the
   non-linear profile real roots often show; the trunk *widen* multiplier
   is a reasonable visual tuning, not itself a cited measurement (the trunk
   *length* fraction is cited); and — most importantly — the "trunk" is
   still 3 independent, non-boolean-unioned meshes with overlapping widened
   bases, not one actually-merged trunk mesh, so it's a strong visual
   approximation of the real anatomy, not a geometrically exact
   reconstruction of it. The palatal root's separately documented
   full-length longitudinal groove (distinct from the furcation concavity)
   is not modelled.
8. Internal anatomy (pulp chamber, root canals, dentin) is not modelled —
   exterior surface only.
9. One representative instance derived from published ranges, not a
   segmentation of an actual CT/intraoral scan — real teeth vary more than
   any single model can capture.
10. Cusp of Carabelli is included but marked `optional` (~52–68% population
   prevalence) — callers should default it off unless explicitly enabling
   the variant. It also has no `slopeRadiiMm` — deliberately left on the old
   isotropic bump in the anisotropic-cusp redesign (smaller diff, and it's a
   minor accessory cusp, not one of the 4 primary cusps that redesign
   targeted).

Item 2 is the one most likely to matter for the "does this look anatomically
natural, not generic-AI" bar the spec set. The anisotropic-cusp redesign
made real, measured progress on it (buccal-view cusps now clearly separate
and rounded) but the top-down occlusal read is improved, not resolved — it
should be finished or a conscious decision made to accept the current state
before treating this phase's gate as passed.

## Next steps (blocked on the gate)

Per the agreed `next_phase_gate`, do not scale to the remaining 31 teeth, an
LOD pipeline, the full arch, or odontogram integration until:
1. A human has reviewed the live render against the 6 standard views, and
2. Limitation #2 above (the top-down occlusal read) is either finished —
   likely by widening cusps' tangential reach further or reworking the
   central developmental groove's parameters, not by touching the material
   or the now-fixed smoothMax/anisotropic-cusp math — or explicitly accepted
   as good enough for this phase.

If accepted, the next phase should build out the remaining tooth classes
(incisor, canine, premolar per FDI numbering) reusing this same engine, wire
`crown.outline` into `crownGeometry.ts`, and only then plan the LOD pipeline
using the per-tooth triangle counts recorded above as the baseline.
