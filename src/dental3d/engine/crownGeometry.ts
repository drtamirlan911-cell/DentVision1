// ═══════════════════════════════════════════════════════════════════
// CROWN GEOMETRY BUILDER
//
// The crown is built as two stitched surfaces sharing one ring of vertices
// (no seam, no weld step needed):
//   1. a revolved "wall" from the cervical line up to the occlusal edge,
//      whose radius varies with height (cervical taper → anatomical
//      equator bulge → convergence toward the occlusal table), plus small
//      per-direction convexity lobes so it isn't a perfect ellipse at
//      every height;
//   2. a disc-shaped occlusal table capping the wall, whose height field
//      is the sum of cusp bumps, ridge bumps, and groove/fossa troughs —
//      i.e. real anatomical landmarks, not surface noise.
// ═══════════════════════════════════════════════════════════════════

import * as THREE from 'three'
import type { CrownDefinition } from '../anatomy/types'
import { distanceToPolyline, footprintXZ, lerp, radialBump, smoothstep } from './mathUtils'

const ANGULAR_SEGMENTS = 72
const WALL_RINGS = 16
const TABLE_RINGS = 20
/** Radius (mm) for the small-kernel blur applied to the occlusal height field —
 *  smooths the faceted, spiky look narrow Gaussian falloffs produce at this mesh
 *  density into rounder cusp domes, without erasing the landmark positions. */
const RELIEF_SMOOTH_RADIUS_MM = 0.55

function deg2rad(d: number): number {
  return (d * Math.PI) / 180
}

/** Cervical→occlusal-edge taper: narrower at the neck, widest at the anatomical
 *  equator (~35% up the crown), narrowing again as the wall approaches the
 *  occlusal table — the classic posterior-tooth crown silhouette. */
function wallTaper(hFrac: number): number {
  if (hFrac < 0.35) return lerp(0.86, 1.0, smoothstep(0, 0.35, hFrac))
  return lerp(1.0, 0.8, smoothstep(0.35, 1.0, hFrac))
}

/** Small asymmetric bulges (buccal slightly more convex than lingual, a mild
 *  mesial contact bulge) so the wall isn't a mathematically perfect ellipse
 *  of revolution at every height — real crowns aren't. Magnitude is a
 *  fraction of the local radius, applied additively in mm. */
function convexityLobeMm(angleRad: number, hFrac: number, mdHalf: number, blHalf: number): number {
  const buccalLobe = Math.max(0, Math.cos(angleRad - Math.PI / 2))
  const mesialLobe = Math.max(0, Math.cos(angleRad)) * 0.5
  const heightWeight = Math.sin(Math.PI * THREE.MathUtils.clamp(hFrac, 0, 1))
  const scale = Math.min(mdHalf, blHalf) * 0.06
  return (buccalLobe + mesialLobe) * heightWeight * scale
}

function maxCuspHeightMm(crown: CrownDefinition): number {
  let max = 0
  for (const c of crown.cusps) if (!c.optional && c.heightMm > max) max = c.heightMm
  return max
}

/** Combined anatomical relief at a point on the occlusal table, in mm above
 *  the table's base plane. Cusps raise it, grooves/fossae lower it, ridges
 *  raise connecting strips between cusps. */
function occlusalRelief(x: number, z: number, crown: CrownDefinition): number {
  // Cusps and ridges both raise the surface, but a ridge is the extended
  // slope of the cusp(s) it connects, not an independent second bump — where
  // a ridge path runs through a cusp's own footprint (as oblique/triangular
  // ridges do, by definition, at their endpoints) it must not stack on top
  // of the cusp's peak. Combine same-sign contributions with max(), not sum.
  let cuspRelief = 0
  for (const cusp of crown.cusps) {
    if (cusp.optional) continue
    const [cx, cz] = footprintXZ(
      deg2rad(cusp.angleDeg),
      (crown.mesiodistalWidthMm / 2) * cusp.radialPosition,
      (crown.buccolingualWidthMm / 2) * cusp.radialPosition,
    )
    const d = Math.hypot(x - cx, z - cz)
    cuspRelief += radialBump(d, cusp.radiusMm) * cusp.heightMm
  }
  let ridgeRelief = 0
  for (const ridge of crown.ridges) {
    const d = distanceToPolyline(x, z, ridge.path)
    ridgeRelief += radialBump(d, ridge.widthMm) * ridge.heightMm
  }
  let y = Math.max(cuspRelief, ridgeRelief)
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

/** 5-tap blur (center + 4 offsets) over `occlusalRelief`. Landmark bumps and
 *  troughs are built from smooth analytic falloffs already, but at this mesh
 *  density adjacent bumps/troughs read as faceted and angular rather than
 *  rounded — this softens that without moving or erasing any landmark. */
function smoothedOcclusalRelief(x: number, z: number, crown: CrownDefinition): number {
  const r = RELIEF_SMOOTH_RADIUS_MM
  const center = occlusalRelief(x, z, crown)
  const n = occlusalRelief(x, z + r, crown)
  const s = occlusalRelief(x, z - r, crown)
  const e = occlusalRelief(x + r, z, crown)
  const w = occlusalRelief(x - r, z, crown)
  return center * 0.4 + (n + s + e + w) * 0.15
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
    const taper = wallTaper(hFrac)
    for (let i = 0; i < ANGULAR_SEGMENTS; i++) {
      const angle = (i / ANGULAR_SEGMENTS) * Math.PI * 2
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
      const [bx, bz] = footprintXZ(angle, mdHalf * wallTaper(1) * rFrac, blHalf * wallTaper(1) * rFrac)
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
