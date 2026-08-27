// ═══════════════════════════════════════════════════════════════════
// ROOT GEOMETRY BUILDER
//
// Each root is a tapered tube swept along a curved centerline: a straight
// tilt from the cervical line (buccolingual/mesiodistal, per root) blending
// into extra apical-third curvature (most maxillary molar roots curve
// distally near the apex — see docs/DENTAL_3D_ENGINE.md references).
//
// The cross-section is also dented inward on the side facing the furcation
// (the tooth's central axis) — `furcationConcavityMm` — strongest near the
// cervical line and fading out by mid-root, per documented furcation-groove
// anatomy. Without this a root reads as a perfectly smooth cone, which is
// not what a real root surface looks like (see references).
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

const DEFAULT_FURCATION_FADE_FRACTION = 0.45

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

  // Furcation-facing concavity: dents the cross-section on the side facing
  // the tooth's central axis (the root's own origin offset, negated, is
  // that direction at the cervical line — a reasonable fixed approximation
  // rather than re-deriving it per ring, since the roots' XZ divergence
  // over their length is modest relative to the fade zone near the cervical
  // line where the dent actually applies — see file header).
  const concavityDepth = root.furcationConcavityMm ?? 0
  const concavityFade = root.furcationFadeFraction ?? DEFAULT_FURCATION_FADE_FRACTION
  const originLen = Math.hypot(root.originOffsetMm[0], root.originOffsetMm[1]) || 1
  const inwardAngle = Math.atan2(-root.originOffsetMm[0] / originLen, -root.originOffsetMm[1] / originLen)

  for (let i = 0; i <= LENGTH_SEGMENTS; i++) {
    const t = i / LENGTH_SEGMENTS
    const blHalf = lerp(blHalf0, blHalf1, t)
    const mdHalf = lerp(mdHalf0, mdHalf1, t)
    const lengthFadeWeight = 1 - smoothstep(0, concavityFade, t)
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
