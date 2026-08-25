// Small numeric helpers shared by the crown/root geometry builders.
// Kept dependency-free (only THREE.MathUtils.clamp) so they're trivially unit-testable.

import * as THREE from 'three'

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Compact-support radial falloff: 1 at the center, smoothly reaching 0 at `radius`.
 * Used for cusp bumps and fossa depressions — a true Gaussian never reaches zero,
 * which would make every cusp influence the whole occlusal table.
 */
export function radialBump(distance: number, radius: number): number {
  if (radius <= 0 || distance >= radius) return 0
  const t = distance / radius
  return Math.exp(-3 * t * t) * (1 - smoothstep(0.7, 1, t))
}

/** Shortest distance from point (px,pz) to a polyline, in the same units as the path. */
export function distanceToPolyline(px: number, pz: number, path: ReadonlyArray<readonly [number, number]>): number {
  if (path.length === 0) return Infinity
  if (path.length === 1) return Math.hypot(px - path[0][0], pz - path[0][1])
  let min = Infinity
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i]
    const [bx, bz] = path[i + 1]
    const abx = bx - ax
    const abz = bz - az
    const apx = px - ax
    const apz = pz - az
    const abLenSq = abx * abx + abz * abz
    let t = abLenSq > 0 ? (apx * abx + apz * abz) / abLenSq : 0
    t = THREE.MathUtils.clamp(t, 0, 1)
    const cx = ax + abx * t
    const cz = az + abz * t
    const d = Math.hypot(px - cx, pz - cz)
    if (d < min) min = d
  }
  return min
}

/**
 * Crown-local (x,z) footprint point for a given angle and ellipse half-widths.
 * angleRad = 0 -> +Z (mesial), angleRad = PI/2 -> +X (buccal). See anatomy/types.ts header.
 */
export function footprintXZ(angleRad: number, mesiodistalHalfMm: number, buccolingualHalfMm: number): [number, number] {
  return [Math.sin(angleRad) * buccolingualHalfMm, Math.cos(angleRad) * mesiodistalHalfMm]
}
