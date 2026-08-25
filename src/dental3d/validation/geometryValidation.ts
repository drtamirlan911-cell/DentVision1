// Automated geometry sanity checks: NaN/degenerate vertices, degenerate
// triangles, non-manifold edges, and boundary-loop topology. A crown mesh
// is expected to have exactly one open boundary loop (the cervical line —
// crown and root are separate meshes, not boolean-unioned, see
// docs/DENTAL_3D_ENGINE.md) and a root mesh exactly one (its origin ring;
// the apex is capped). More than one loop, or a loop with irregular
// vertex degree, signals a real stitching bug, not the intentional opening.
//
// Not implemented: true self-intersection testing (would need a BVH —
// three-mesh-bvh or similar — wired in as its own pass). Left as an
// explicit `info` finding rather than silently assumed clean.

import * as THREE from 'three'

export interface GeometryValidationIssue {
  code: string
  severity: 'error' | 'warning' | 'info'
  message: string
}

export interface GeometryValidationReport {
  meshName: string
  vertexCount: number
  triangleCount: number
  boundaryLoopCount: number
  boundingBox: { size: [number, number, number] }
  issues: GeometryValidationIssue[]
  passed: boolean
}

export function validateGeometry(geometry: THREE.BufferGeometry, meshName: string): GeometryValidationReport {
  const issues: GeometryValidationIssue[] = []
  const position = geometry.getAttribute('position')
  const index = geometry.getIndex()

  if (!position || !index) {
    issues.push({ code: 'missing-attribute', severity: 'error', message: 'Geometry is missing position or index data' })
    return { meshName, vertexCount: 0, triangleCount: 0, boundaryLoopCount: 0, boundingBox: { size: [0, 0, 0] }, issues, passed: false }
  }

  const vertexCount = position.count
  const px = position.array as ArrayLike<number>
  let nonFiniteCount = 0
  for (let i = 0; i < px.length; i++) if (!Number.isFinite(px[i])) nonFiniteCount++
  if (nonFiniteCount > 0) {
    issues.push({ code: 'non-finite-vertex', severity: 'error', message: `${nonFiniteCount} non-finite vertex components` })
  }

  const triangleCount = index.count / 3
  const edgeTriCount = new Map<string, number>()
  const edgeVerts = new Map<string, [number, number]>()
  let degenerateCount = 0

  const va = new THREE.Vector3()
  const vb = new THREE.Vector3()
  const vc = new THREE.Vector3()
  for (let t = 0; t < triangleCount; t++) {
    const a = index.getX(t * 3)
    const b = index.getX(t * 3 + 1)
    const c = index.getX(t * 3 + 2)
    va.set(px[a * 3], px[a * 3 + 1], px[a * 3 + 2])
    vb.set(px[b * 3], px[b * 3 + 1], px[b * 3 + 2])
    vc.set(px[c * 3], px[c * 3 + 1], px[c * 3 + 2])
    const area = new THREE.Vector3().subVectors(vb, va).cross(new THREE.Vector3().subVectors(vc, va)).length() / 2
    if (area < 1e-9) degenerateCount++

    for (const [u, w] of [[a, b], [b, c], [c, a]] as const) {
      const key = u < w ? `${u}_${w}` : `${w}_${u}`
      edgeTriCount.set(key, (edgeTriCount.get(key) || 0) + 1)
      edgeVerts.set(key, [u, w])
    }
  }
  if (degenerateCount > 0) {
    issues.push({ code: 'degenerate-triangle', severity: 'warning', message: `${degenerateCount} near-zero-area triangles` })
  }

  let nonManifoldEdges = 0
  const boundaryAdjacency = new Map<number, number[]>()
  for (const [key, count] of edgeTriCount) {
    if (count > 2) nonManifoldEdges++
    if (count === 1) {
      const [u, w] = edgeVerts.get(key)!
      boundaryAdjacency.set(u, [...(boundaryAdjacency.get(u) || []), w])
      boundaryAdjacency.set(w, [...(boundaryAdjacency.get(w) || []), u])
    }
  }
  if (nonManifoldEdges > 0) {
    issues.push({ code: 'non-manifold-edge', severity: 'error', message: `${nonManifoldEdges} edges shared by more than 2 triangles` })
  }

  let irregularBoundaryVertices = 0
  for (const neighbors of boundaryAdjacency.values()) if (neighbors.length !== 2) irregularBoundaryVertices++
  if (irregularBoundaryVertices > 0) {
    issues.push({ code: 'irregular-boundary-vertex', severity: 'error', message: `${irregularBoundaryVertices} boundary vertices do not have exactly 2 boundary-edge neighbours` })
  }

  const visited = new Set<number>()
  let boundaryLoopCount = 0
  for (const start of boundaryAdjacency.keys()) {
    if (visited.has(start)) continue
    boundaryLoopCount++
    let current = start
    let prev = -1
    while (!visited.has(current)) {
      visited.add(current)
      const neighbors = boundaryAdjacency.get(current) || []
      const next = neighbors.find((n) => n !== prev)
      if (next === undefined) break
      prev = current
      current = next
    }
  }
  if (boundaryLoopCount > 1) {
    issues.push({ code: 'multiple-boundary-loops', severity: 'error', message: `${boundaryLoopCount} separate open-boundary loops found — expected exactly 1 (the cervical/root-origin opening); extra loops indicate an unintended hole` })
  } else if (boundaryLoopCount === 1) {
    issues.push({ code: 'expected-open-boundary', severity: 'info', message: 'One open boundary loop found — this is the intentional cervical line (crown) / root-origin ring (root), not a defect: crown and roots are separate, non-boolean-unioned meshes.' })
  }

  if (!geometry.getAttribute('normal')) {
    issues.push({ code: 'no-normals', severity: 'warning', message: 'Normals not computed' })
  }

  geometry.computeBoundingBox()
  const bb = geometry.boundingBox!
  const size: [number, number, number] = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z]
  if (size[0] <= 0 || size[1] <= 0 || size[2] <= 0) {
    issues.push({ code: 'degenerate-bbox', severity: 'error', message: 'Bounding box has a zero or negative dimension' })
  }

  issues.push({
    code: 'self-intersection-not-checked',
    severity: 'info',
    message: 'Automated self-intersection testing is not implemented in this pass (would require a BVH pass) — checked only by visual inspection from the 6 standard views.',
  })

  const passed = !issues.some((i) => i.severity === 'error')
  return { meshName, vertexCount, triangleCount, boundaryLoopCount, boundingBox: { size }, issues, passed }
}
