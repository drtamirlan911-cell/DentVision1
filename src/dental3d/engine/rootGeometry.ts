// ═══════════════════════════════════════════════════════════════════
// ROOT GEOMETRY BUILDER
//
// Each root is a tapered tube swept along a curved centerline: a straight
// tilt from the cervical line (buccolingual/mesiodistal, per root) blending
// into extra apical-third curvature (most maxillary molar roots curve
// distally near the apex — see docs/DENTAL_3D_ENGINE.md references).
//
// Near the cervical line, each root is also widened (`rootTrunkWidenFactor`)
// and dented inward on the side facing the furcation (`furcationConcavityMm`)
// — both fading out over `rootTrunkFraction`. Real multi-rooted teeth don't
// have individual roots starting right at the cervical line: below the
// crown the roots stay fused as one wider "root trunk" down to the furcation
// entrance (documented as ~3-6mm for a maxillary first molar — see
// references) before actually separating. Without the widening, 3
// already-separated, already-narrow root tubes meet the much wider crown in
// an abrupt step, not the smooth, gradually-narrowing transition real teeth
// show. Without the concavity dent, a root reads as a perfectly smooth
// cone, which is not what a real root surface looks like either.
//
// Known simplification: cross-section rings stay axis-aligned in the
// crown-local XZ plane rather than fully perpendicular to the (slightly
// curving) tangent. For the tilt/curvature magnitudes real roots have this
// is visually and dimensionally negligible; documented in the validation
// report rather than silently assumed away.
// ═══════════════════════════════════════════════════════════════════

import * as THREE from 'three'
import type { RootDefinition } from '../anatomy/types'
import { lerp, smoothstep } from './mathUtils'

const DEFAULT_ROOT_TRUNK_FRACTION = 0.45

/** Inward radial dent (mm) at a given cross-section angle, strongest when
 *  the angle faces the furcation direction and fading to 0 at +-90 degrees
 *  from it, so it only carves the one side of the tube that's anatomically
 *  concave — not the whole circumference. */
function furcationDent(angle: number, inwardAngle: number, depthMm: number, lengthFadeWeight: number): number {
  if (depthMm <= 0 || lengthFadeWeight <= 0) return 0
  const diff = angle - inwardAngle
  const wrapped = Math.atan2(Math.sin(diff), Math.cos(diff))
  const facing = Math.max(0, Math.cos(wrapped))
  return depthMm * facing * facing * lengthFadeWeight
}

/**
 * Root-trunk cross-section half-width at length fraction `t`, tangent-
 * matched to the crown wall at the seam (t=0) instead of just
 * width-matched. The crown's cervical taper (`wallTaper` in
 * crownGeometry.ts) is built from `smoothstep`, which has zero slope
 * exactly at the cervical edge — a rounded, flattening-out silhouette
 * right where the crown ends. A plain `lerp(base0, base1, t) * widen`
 * root taper has a large, constant, widen-amplified NEGATIVE slope right
 * from t=0, so even when the two meshes' widths happen to line up at the
 * seam, the silhouette still shows a visible crease there — a real
 * geometric tangent mismatch, not a rendering artifact (confirmed by
 * sampling both curves' derivatives, not just eyeballing a screenshot).
 * This eases the widened trunk phase in with the same zero-derivative-at-0
 * smoothstep shape the crown uses, then blends into the normal linear taper
 * by `trunkFraction`. */
function trunkTaperedHalfWidth(base0: number, base1: number, trunkWiden: number, trunkFraction: number, t: number): number {
  const normalWidth = lerp(base0, base1, t)
  if (trunkWiden <= 1 || trunkFraction <= 0 || t >= trunkFraction) return normalWidth
  const widenedStart = base0 * trunkWiden
  const widthAtFractionEnd = lerp(base0, base1, trunkFraction)
  const easedT = smoothstep(0, trunkFraction, t)
  return lerp(widenedStart, widthAtFractionEnd, easedT)
}

const ANGULAR_SEGMENTS = 20
const LENGTH_SEGMENTS = 18
const X_AXIS = new THREE.Vector3(1, 0, 0)
const Z_AXIS = new THREE.Vector3(0, 0, 1)

function deg2rad(d: number): number {
  return (d * Math.PI) / 180
}

export interface RootGeometryResult {
  geometry: THREE.BufferGeometry
  apex: THREE.Vector3
}

export function buildRootGeometry(root: RootDefinition): RootGeometryResult {
  const baseDir = new THREE.Vector3(0, -1, 0)
    .applyAxisAngle(Z_AXIS, deg2rad(root.buccolingualTiltDeg))
    .applyAxisAngle(X_AXIS, deg2rad(-root.mesiodistalTiltDeg))
    .normalize()
  const apexDir = baseDir.clone().applyAxisAngle(X_AXIS, deg2rad(-root.apicalCurvatureDeg)).normalize()

  const stepLen = root.lengthMm / LENGTH_SEGMENTS
  const origin = new THREE.Vector3(root.originOffsetMm[0], 0, root.originOffsetMm[1])
  const centerline: THREE.Vector3[] = [origin.clone()]
  let cursor = origin.clone()
  for (let i = 1; i <= LENGTH_SEGMENTS; i++) {
    const t = i / LENGTH_SEGMENTS
    const curveT = smoothstep(0.55, 1, t)
    const dir = baseDir.clone().lerp(apexDir, curveT).normalize()
    cursor = cursor.clone().addScaledVector(dir, stepLen)
    centerline.push(cursor)
  }

  const positions: number[] = []
  const indices: number[] = []
  const blHalf0 = root.baseDiameterMm / 2
  const mdHalf0 = blHalf0 / root.crossSectionAspect
  const blHalf1 = root.apexDiameterMm / 2
  const mdHalf1 = blHalf1 / root.crossSectionAspect

  // Furcation-facing concavity + root-trunk widening: both fade over the
  // same `rootTrunkFraction` — the root's own origin offset, negated, is
  // taken as the furcation-facing direction at the cervical line (a
  // reasonable fixed approximation rather than re-deriving it per ring,
  // since the roots' XZ divergence over their length is modest relative to
  // the fade zone near the cervical line where both effects apply — see
  // file header).
  const concavityDepth = root.furcationConcavityMm ?? 0
  const trunkWiden = root.rootTrunkWidenFactor ?? 1
  const trunkFraction = root.rootTrunkFraction ?? DEFAULT_ROOT_TRUNK_FRACTION
  const originLen = Math.hypot(root.originOffsetMm[0], root.originOffsetMm[1]) || 1
  const inwardAngle = Math.atan2(-root.originOffsetMm[0] / originLen, -root.originOffsetMm[1] / originLen)

  for (let i = 0; i <= LENGTH_SEGMENTS; i++) {
    const t = i / LENGTH_SEGMENTS
    const lengthFadeWeight = 1 - smoothstep(0, trunkFraction, t)
    const blHalf = trunkTaperedHalfWidth(blHalf0, blHalf1, trunkWiden, trunkFraction, t)
    const mdHalf = trunkTaperedHalfWidth(mdHalf0, mdHalf1, trunkWiden, trunkFraction, t)
    const c = centerline[i]
    for (let j = 0; j < ANGULAR_SEGMENTS; j++) {
      const angle = (j / ANGULAR_SEGMENTS) * Math.PI * 2
      const dent = furcationDent(angle, inwardAngle, concavityDepth, lengthFadeWeight)
      const rx = Math.sin(angle) * (blHalf - dent)
      const rz = Math.cos(angle) * (mdHalf - dent)
      positions.push(c.x + rx, c.y, c.z + rz)
    }
  }
  for (let i = 0; i < LENGTH_SEGMENTS; i++) {
    for (let j = 0; j < ANGULAR_SEGMENTS; j++) {
      const jNext = (j + 1) % ANGULAR_SEGMENTS
      const a = i * ANGULAR_SEGMENTS + j
      const b = i * ANGULAR_SEGMENTS + jNext
      const c = (i + 1) * ANGULAR_SEGMENTS + j
      const d = (i + 1) * ANGULAR_SEGMENTS + jNext
      indices.push(a, c, b, b, c, d)
    }
  }

  // Apex cap: a small pole so the root ends in a closed point, not an open tube.
  const apexCenterIdx = positions.length / 3
  const apex = centerline[LENGTH_SEGMENTS]
  positions.push(apex.x, apex.y, apex.z)
  const lastRingStart = LENGTH_SEGMENTS * ANGULAR_SEGMENTS
  for (let j = 0; j < ANGULAR_SEGMENTS; j++) {
    const jNext = (j + 1) % ANGULAR_SEGMENTS
    indices.push(lastRingStart + j, apexCenterIdx, lastRingStart + jNext)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()

  return { geometry, apex }
}
