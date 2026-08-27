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
 * Compact-support radial falloff curve, parametrized by t = distance/radius:
 * 1 at t=0, smoothly reaching 0 at t=1. Split out from `radialBump` so the
 * same curve shape can be reused with a non-circular (elliptical/anisotropic)
 * distance normalization — see `anisotropicCuspBump`.
 */
export function radialBumpCurve(t: number): number {
  if (t >= 1) return 0
  return Math.exp(-3 * t * t) * (1 - smoothstep(0.7, 1, t))
}

/**
 * Compact-support radial falloff: 1 at the center, smoothly reaching 0 at `radius`.
 * Used for cusp bumps and fossa depressions — a true Gaussian never reaches zero,
 * which would make every cusp influence the whole occlusal table.
 */
export function radialBump(distance: number, radius: number): number {
  if (radius <= 0) return 0
  return radialBumpCurve(distance / radius)
}

/**
 * Anisotropic compact-support bump around a cusp tip: stretched toward the
 * crown center (radialInwardMm) so the cusp's slope reaches far enough to
 * meet its neighbors and form a natural saddle line there — the ridge/groove
 * emerges from where two broad cusp masses meet, per real wax-carving
 * technique ("cusps are defined as the result of moving masses closer
 * together" — see docs/DENTAL_3D_ENGINE.md references), rather than being a
 * separately-authored connecting bump — and compressed toward the crown's
 * outer wall (radialOutwardMm) so the silhouette doesn't balloon past the
 * bbox-proportion tolerance. tangentialMm controls the reach sideways, along
 * the arch, toward the adjacent cusps.
 * dx,dz: point minus cusp-tip, crown-local mm. inwardX,inwardZ: unit vector
 * from the cusp tip toward the crown center (0,0).
 */
export function anisotropicCuspBump(
  dx: number,
  dz: number,
  inwardX: number,
  inwardZ: number,
  radialInwardMm: number,
  radialOutwardMm: number,
  tangentialMm: number,
): number {
  const radial = dx * inwardX + dz * inwardZ
  const tangential = dx * -inwardZ + dz * inwardX
  const rRadial = radial >= 0 ? radialInwardMm : radialOutwardMm
  const t = Math.hypot(radial / rRadial, tangential / tangentialMm)
  return radialBumpCurve(t)
}

/**
 * Smooth maximum (C¹) of two heights — replaces a bare Math.max() wherever
 * two convex bumps are meant to merge into one continuous surface. A bare
 * Math.max() has a visible C⁰ crease exactly where a and b are equal; once
 * cusps are wide enough to actually reach their neighbors (the point of
 * `anisotropicCuspBump`), that crease sits right where two cusps meet and
 * reads as a visible seam. Quadratic-polynomial smin/smax, k = blend radius
 * in the same units as a/b's underlying distance (mm here). k<=0 degrades to
 * a bare Math.max. Source: Inigo Quilez, "Smooth Minimum Function"
 * (iquilezles.org/articles/smin) — smoothMax(a,b,k) = -smin(-a,-b,k).
 */
export function smoothMax(a: number, b: number, k: number): number {
  if (k <= 0) return Math.max(a, b)
  const kk = k * 4
  const h = Math.max(kk - Math.abs(a - b), 0) / kk
  return Math.max(a, b) + h * h * kk * 0.25
}

/**
 * `smoothMax`, but only blends when BOTH inputs are meaningfully non-zero —
 * i.e. where two genuine compact-support bumps actually overlap. Plain
 * `smoothMax` has no notion of "this side doesn't apply here": even
 * `smoothMax(0, 0, k)` returns `k/4`, not 0. That's correct for its intended
 * use (two SDFs that are both defined everywhere), but wrong for folding a
 * running accumulator across N compact-support bumps starting from a `0`
 * "nothing here yet" baseline — every fold against a cusp that's out of
 * range at that point (contributing exactly/nearly 0) would inflate the
 * accumulator, compounding with every additional cusp, and lifting flat
 * "no landmark here" regions of the table off zero. Falling back to a plain
 * Math.max whenever either side is below `eps` keeps the true zero baseline
 * exact and restricts smoothing to the actual overlap region between two
 * real bumps — exactly the seam this technique is meant to soften.
 */
export function smoothMaxCompact(a: number, b: number, k: number, eps = 1e-6): number {
  if (a <= eps || b <= eps) return Math.max(a, b)
  return smoothMax(a, b, k)
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
