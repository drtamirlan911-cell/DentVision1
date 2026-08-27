// ═══════════════════════════════════════════════════════════════════
// CROWN GEOMETRY BUILDER
//
// The crown is built as two stitched surfaces sharing one ring of vertices
// (no seam, no weld step needed):
//   1. a revolved "wall" from the cervical line up to the occlusal edge,
//      whose radius varies with height (cervical taper → anatomical
//      equator bulge → convergence toward the occlusal table) AND with
//      direction — the equator's height differs per surface (buccal low,
//      lingual mid, mesial/distal higher still, see `blendByDirection`),
//      not one uniform bulge height all the way around — plus small
//      per-direction convexity lobes so it isn't a perfect ellipse at
//      every height;
//   2. a disc-shaped occlusal table capping the wall, whose height field
//      is the sum of cusp bumps, ridge bumps, and groove/fossa troughs —
//      i.e. real anatomical landmarks, not surface noise.
// ═══════════════════════════════════════════════════════════════════

import * as THREE from 'three'
import type { CrownDefinition } from '../anatomy/types'
import { anisotropicCuspBump, distanceToPolyline, footprintXZ, lerp, radialBump, smoothMaxCompact, smoothstep } from './mathUtils'

const ANGULAR_SEGMENTS = 72
/** Raised from 16 to 24: with a single uniform equator height, 16 rings was
 *  enough — the taper curve was identical (and gently curved) at every
 *  angle. Once the equator height became direction-dependent (buccal peaks
 *  early, mesial peaks late — a real difference spanning over half the
 *  crown's height), the wall's radius profile genuinely varies faster with
 *  height in the transition zone between two differing cardinal targets.
 *  `wallTaper` itself is provably C¹-continuous in both hFrac and angle (see
 *  `blendByDirection`), so this was never a math discontinuity — but 16
 *  linearly-interpolated samples were too coarse to render that curvier,
 *  still-smooth transition without visible faceting (a real, confirmed
 *  regression: "не плавно" after the per-direction equator fix). Confirmed
 *  by re-rendering at 16/24/40 rings — 16 showed a visible kink on the
 *  mesial-facing silhouette around 60-70% crown height, 24 and 40 did not;
 *  24 was kept as the smaller sufficient bump (triangle budget has large
 *  headroom regardless — see "Performance baseline" in
 *  docs/DENTAL_3D_ENGINE.md). */
const WALL_RINGS = 24
const TABLE_RINGS = 20
/** Radius (mm) for the small-kernel blur applied to the occlusal height field —
 *  smooths the faceted, spiky look narrow Gaussian falloffs produce at this mesh
 *  density into rounder cusp domes, without erasing the landmark positions.
 *  Kept small and low-weight (see `smoothedOcclusalRelief`) — an earlier, wider
 *  pass smoothed the crossing ridges/fossa at the tooth's center into a single
 *  raised "knot" instead of a pit, flattening it into a hard-to-read swirl. */
const RELIEF_SMOOTH_RADIUS_MM = 0.75
/** Blend radius (mm) for smoothMax between adjacent cusps — see occlusalRelief.
 *  Wide enough to remove the visible C0 seam a bare Math.max() leaves where two
 *  cusps meet, narrow enough not to wash out the saddle line itself. */
const CUSP_BLEND_MM = 0.45
/** Blend radius (mm) for smoothMax between ridges, and between the ridge nudge
 *  and the primary cusp shape — narrower than CUSP_BLEND_MM since ridges are a
 *  thinner secondary feature, not a second primary mass. */
const RIDGE_BLEND_MM = 0.25
/** Hard ceiling (mm) on how much the ridge network may add on top of the
 *  cusp-driven primary shape — ridges are a small crispening refinement now,
 *  not a competing height source (see occlusalRelief). */
const RIDGE_NUDGE_CAP_MM = 0.22

function deg2rad(d: number): number {
  return (d * Math.PI) / 180
}

/** Height (0 = cervical line, 1 = occlusal edge) of the wall's widest point
 *  ("height of contour" / crown equator), per direction. This is NOT the
 *  same all the way around a real crown: the buccal height of contour sits
 *  low, in the cervical third, close to the gumline (it helps deflect food
 *  and shelters the gingiva); the palatal/lingual height of contour sits
 *  higher, in the middle third; and the two proximal contact areas sit
 *  higher still and at DIFFERENT heights from each other — mesial at the
 *  junction of the middle and occlusal thirds, distal at the middle of the
 *  middle third (see references). A single uniform equator height put the
 *  bulge in the same place on every surface — anatomically wrong on 3 of
 *  its 4 cardinal directions. */
const BUCCAL_EQUATOR_FRAC = 0.16
const LINGUAL_EQUATOR_FRAC = 0.5
const MESIAL_EQUATOR_FRAC = 0.67
const DISTAL_EQUATOR_FRAC = 0.5

/** Blends a per-direction curve's OUTPUT — not the target height parameter
 *  it branches on — across the 4 cardinal directions, weighted by angular
 *  proximity (squared-cosine lobe per direction, clamped to 0 on the far
 *  side, normalized). An earlier version blended the target HEIGHT itself
 *  and fed that single blended number into one piecewise curve — that
 *  creates a spurious exact-peak wherever the blended height crosses a
 *  ring's own hFrac (confirmed regression: extra ripples sweeping across
 *  the wall, reported as "не плавно"). Within any 90° quadrant only the two
 *  flanking directions have nonzero weight, and those weights are
 *  cos²θ/sin²θ (they sum to 1 exactly), so this reduces to a 2-term convex
 *  combination of two FIXED curve values there — provably monotonic between
 *  the two directions, no interior extremum. */
function blendByDirection(angleRad: number, curve: (target: number) => number): number {
  const wBuccal = Math.max(0, Math.cos(angleRad - Math.PI / 2)) ** 2
  const wLingual = Math.max(0, Math.cos(angleRad - (3 * Math.PI) / 2)) ** 2
  const wMesial = Math.max(0, Math.cos(angleRad)) ** 2
  const wDistal = Math.max(0, Math.cos(angleRad - Math.PI)) ** 2
  const sum = wBuccal + wLingual + wMesial + wDistal || 1
  return (
    (wBuccal * curve(BUCCAL_EQUATOR_FRAC) + wLingual * curve(LINGUAL_EQUATOR_FRAC) + wMesial * curve(MESIAL_EQUATOR_FRAC) + wDistal * curve(DISTAL_EQUATOR_FRAC)) / sum
  )
}

/** Cervical→occlusal-edge taper curve for one fixed equator height: narrower
 *  at the neck, widest at `equator`, narrowing again toward the occlusal
 *  table — the classic posterior-tooth crown silhouette. */
function taperAtEquator(hFrac: number, equator: number): number {
  if (hFrac < equator) return lerp(0.86, 1.0, smoothstep(0, equator, hFrac))
  return lerp(1.0, 0.8, smoothstep(equator, 1, hFrac))
}

/** Direction-dependent equivalent of `taperAtEquator`, per surface (see
 *  `blendByDirection`). */
function wallTaper(hFrac: number, angleRad: number): number {
  return blendByDirection(angleRad, (equator) => taperAtEquator(hFrac, equator))
}

/** Height-weight curve for `convexityLobeMm`, for one fixed equator height:
 *  0 at the cervical line and occlusal edge, 1 at `equator`. */
function heightWeightAtEquator(hFrac: number, equator: number): number {
  const remapped = hFrac < equator ? (hFrac / equator) * 0.5 : 0.5 + ((hFrac - equator) / (1 - equator)) * 0.5
  return Math.sin(Math.PI * THREE.MathUtils.clamp(remapped, 0, 1))
}

/** Small asymmetric bulges (buccal slightly more convex than lingual, a mild
 *  mesial contact bulge) so the wall isn't a mathematically perfect ellipse
 *  of revolution at every height — real crowns aren't. Peaks at the same
 *  per-direction equator height as `wallTaper` (not a fixed mid-height) so
 *  it reinforces the one true bulge on each surface instead of adding a
 *  second, mislocated one. Magnitude is a fraction of the local radius,
 *  applied additively in mm. */
function convexityLobeMm(angleRad: number, hFrac: number, mdHalf: number, blHalf: number): number {
  const buccalLobe = Math.max(0, Math.cos(angleRad - Math.PI / 2))
  const mesialLobe = Math.max(0, Math.cos(angleRad)) * 0.5
  const heightWeight = blendByDirection(angleRad, (equator) => heightWeightAtEquator(hFrac, equator))
  const scale = Math.min(mdHalf, blHalf) * 0.06
  return (buccalLobe + mesialLobe) * heightWeight * scale
}

function maxCuspHeightMm(crown: CrownDefinition): number {
  let max = 0
  for (const c of crown.cusps) if (!c.optional && c.heightMm > max) max = c.heightMm
  return max
}

/** Combined anatomical relief at a point on the occlusal table, in mm above
 *  the table's base plane.
 *
 *  Cusps are the primary shape: each is an anisotropic bump when
 *  `slopeRadiiMm` is set (stretched toward the crown center so it reaches
 *  its neighbors and forms a natural saddle line where they meet — real
 *  ridges/grooves emerge from that meeting, they aren't independently
 *  authored bumps stitched into the gap), isotropic otherwise. Cusps combine
 *  with `smoothMax`, not a bare Math.max() — once cusps are wide enough to
 *  actually reach each other, a bare max() leaves a visible C0 seam exactly
 *  where two cusps are equal in height, right where they meet.
 *
 *  Ridges are now a secondary refinement layered on top of that primary
 *  shape (also via smoothMax, then hard-capped) rather than an equal
 *  competitor via Math.max(cuspRelief, ridgeRelief) — see
 *  docs/DENTAL_3D_ENGINE.md for why the old equal-competitor design produced
 *  a "crumpled" look. Grooves/fossae subtract afterward, unchanged. */
function occlusalRelief(x: number, z: number, crown: CrownDefinition): number {
  let cuspRelief = 0
  for (const cusp of crown.cusps) {
    if (cusp.optional) continue
    const [cx, cz] = footprintXZ(
      deg2rad(cusp.angleDeg),
      (crown.mesiodistalWidthMm / 2) * cusp.radialPosition,
      (crown.buccolingualWidthMm / 2) * cusp.radialPosition,
    )
    const dx = x - cx
    const dz = z - cz
    let bump: number
    if (cusp.slopeRadiiMm) {
      const cLen = Math.hypot(cx, cz) || 1
      bump = anisotropicCuspBump(
        dx,
        dz,
        -cx / cLen,
        -cz / cLen,
        cusp.slopeRadiiMm.radialInwardMm,
        cusp.slopeRadiiMm.radialOutwardMm,
        cusp.slopeRadiiMm.tangentialMm,
      )
    } else {
      bump = radialBump(Math.hypot(dx, dz), cusp.radiusMm)
    }
    cuspRelief = smoothMaxCompact(cuspRelief, bump * cusp.heightMm, CUSP_BLEND_MM)
  }
  // Combined via max (smoothMaxCompact), not addition: a ridge path is
  // anatomically anchored at its connected cusps' own tips (by definition —
  // ridges run FROM cusp tips), so at a cusp's own apex the ridge nudge would
  // otherwise add on top of the cusp's already-maximal height, inflating the
  // peak past crown.heightMm — the same class of bug found and fixed for the
  // pre-anisotropic formula last session. Capping the ridge nudge to a small
  // ceiling and combining via max means it only shows up as a small raised
  // saddle in the valley between cusps (where cuspRelief is near 0), never
  // stacks on top of a peak (where cuspRelief already dominates the cap).
  let ridgeNudge = 0
  for (const ridge of crown.ridges) {
    const d = distanceToPolyline(x, z, ridge.path)
    ridgeNudge = smoothMaxCompact(ridgeNudge, radialBump(d, ridge.widthMm) * ridge.heightMm, RIDGE_BLEND_MM)
  }
  let y = smoothMaxCompact(cuspRelief, Math.min(ridgeNudge, RIDGE_NUDGE_CAP_MM), RIDGE_BLEND_MM)
  for (const groove of crown.grooves) {
    const d = distanceToPolyline(x, z, groove.path)
    y -= radialBump(d, groove.widthMm) * groove.depthMm
  }
  for (const fossa of crown.fossae) {
    const d = Math.hypot(x - fossa.center[0], z - fossa.center[1])
    y -= radialBump(d, fossa.radiusMm) * fossa.depthMm
  }
  return y
}

const BLUR_RING_SAMPLES = 8

/** 9-tap blur (center + 8 ring samples) over `occlusalRelief`. Landmark bumps
 *  and troughs are built from smooth analytic falloffs already, but at this
 *  mesh density adjacent bumps/troughs read as faceted and angular rather
 *  than rounded. An earlier 4-tap N/S/E/W version only samples along the
 *  axes, which reads fine along X/Z but leaves visible diagonal facets — a
 *  full 8-direction ring removes that directional bias without widening the
 *  kernel enough to blur the central fossa pit back into a bump (see
 *  docs/DENTAL_3D_ENGINE.md validation log). */
function smoothedOcclusalRelief(x: number, z: number, crown: CrownDefinition): number {
  const r = RELIEF_SMOOTH_RADIUS_MM
  const center = occlusalRelief(x, z, crown)
  let ringSum = 0
  for (let i = 0; i < BLUR_RING_SAMPLES; i++) {
    const angle = (i / BLUR_RING_SAMPLES) * Math.PI * 2
    ringSum += occlusalRelief(x + Math.cos(angle) * r, z + Math.sin(angle) * r, crown)
  }
  const centerWeight = 0.55
  return center * centerWeight + (ringSum / BLUR_RING_SAMPLES) * (1 - centerWeight)
}

export interface CrownGeometryResult {
  geometry: THREE.BufferGeometry
  /** World-space y of the occlusal table's flat base plane, before cusp relief */
  occlusalBaseY: number
  /** World-space y of the cervical line (always 0 — the tooth-local origin) */
  cervicalY: number
}

export function buildCrownGeometry(crown: CrownDefinition): CrownGeometryResult {
  const mdHalf = crown.mesiodistalWidthMm / 2
  const blHalf = crown.buccolingualWidthMm / 2
  const occlusalBaseY = crown.heightMm - maxCuspHeightMm(crown)

  const positions: number[] = []
  const indices: number[] = []

  // ── Wall: rings 0 (cervical) .. WALL_RINGS-1 (occlusal edge) ──
  // vertex index for wall ring r, angular segment i: r * ANGULAR_SEGMENTS + i
  for (let r = 0; r < WALL_RINGS; r++) {
    const hFrac = r / (WALL_RINGS - 1)
    const y = hFrac * occlusalBaseY
    for (let i = 0; i < ANGULAR_SEGMENTS; i++) {
      const angle = (i / ANGULAR_SEGMENTS) * Math.PI * 2
      const taper = wallTaper(hFrac, angle)
      const [bx, bz] = footprintXZ(angle, mdHalf * taper, blHalf * taper)
      const lobe = convexityLobeMm(angle, hFrac, mdHalf, blHalf)
      const [lx, lz] = footprintXZ(angle, 1, 1)
      positions.push(bx + lx * lobe, y, bz + lz * lobe)
    }
  }
  const wallVertexCount = WALL_RINGS * ANGULAR_SEGMENTS
  for (let r = 0; r < WALL_RINGS - 1; r++) {
    for (let i = 0; i < ANGULAR_SEGMENTS; i++) {
      const iNext = (i + 1) % ANGULAR_SEGMENTS
      const a = r * ANGULAR_SEGMENTS + i
      const b = r * ANGULAR_SEGMENTS + iNext
      const c = (r + 1) * ANGULAR_SEGMENTS + i
      const d = (r + 1) * ANGULAR_SEGMENTS + iNext
      indices.push(a, c, b, b, c, d)
    }
  }

  // ── Occlusal table: outer ring (shared with wall's top ring) → center pole ──
  // Table ring t (t=0 is the wall's top ring, reused; t=TABLE_RINGS is the center pole).
  const topWallRingStart = (WALL_RINGS - 1) * ANGULAR_SEGMENTS
  const tableRingStart: number[] = [topWallRingStart]
  for (let t = 1; t < TABLE_RINGS; t++) {
    const rFrac = 1 - t / TABLE_RINGS
    tableRingStart.push(positions.length / 3)
    for (let i = 0; i < ANGULAR_SEGMENTS; i++) {
      const angle = (i / ANGULAR_SEGMENTS) * Math.PI * 2
      // wallTaper(1, angle) is angle-independent — hFrac=1 is always past every
      // direction's equator (max 0.67), so it always lands on the flat 0.8 tail.
      const [bx, bz] = footprintXZ(angle, mdHalf * wallTaper(1, 0) * rFrac, blHalf * wallTaper(1, 0) * rFrac)
      const relief = smoothedOcclusalRelief(bx, bz, crown)
      positions.push(bx, occlusalBaseY + relief, bz)
    }
  }
  const centerIndex = positions.length / 3
  positions.push(0, occlusalBaseY + smoothedOcclusalRelief(0, 0, crown), 0)

  // Opposite winding from the wall quads above: the table is a horizontal
  // cap, and this index pattern needs the reverse order to face upward
  // (outward) instead of down into the crown — verified against a real
  // WebGL render, not assumed (see docs/DENTAL_3D_ENGINE.md validation log).
  for (let t = 0; t < TABLE_RINGS - 1; t++) {
    const ringA = tableRingStart[t]
    const ringB = tableRingStart[t + 1]
    for (let i = 0; i < ANGULAR_SEGMENTS; i++) {
      const iNext = (i + 1) % ANGULAR_SEGMENTS
      const a = ringA + i
      const b = ringA + iNext
      const c = ringB + i
      const d = ringB + iNext
      indices.push(a, b, c, b, d, c)
    }
  }
  const lastRing = tableRingStart[TABLE_RINGS - 1]
  for (let i = 0; i < ANGULAR_SEGMENTS; i++) {
    const iNext = (i + 1) % ANGULAR_SEGMENTS
    indices.push(lastRing + i, lastRing + iNext, centerIndex)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()

  void wallVertexCount
  return { geometry, occlusalBaseY, cervicalY: 0 }
}
