// ═══════════════════════════════════════════════════════════════════
// ROOT GEOMETRY BUILDER
//
// Each root is a tapered tube swept along a curved centerline: a straight
// tilt from the cervical line (buccolingual/mesiodistal, per root) blending
// into extra apical-third curvature (most maxillary molar roots curve
// distally near the apex — see docs/DENTAL_3D_ENGINE.md references).
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

  for (let i = 0; i <= LENGTH_SEGMENTS; i++) {
    const t = i / LENGTH_SEGMENTS
    const blHalf = lerp(blHalf0, blHalf1, t)
    const mdHalf = lerp(mdHalf0, mdHalf1, t)
    const c = centerline[i]
    for (let j = 0; j < ANGULAR_SEGMENTS; j++) {
      const angle = (j / ANGULAR_SEGMENTS) * Math.PI * 2
      positions.push(c.x + Math.sin(angle) * blHalf, c.y, c.z + Math.cos(angle) * mdHalf)
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
