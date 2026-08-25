// Combines the crown and root builders into one tooth. Crown and roots are
// kept as separate meshes sharing one local origin (the cervical line) — see
// docs/DENTAL_3D_ENGINE.md for why this, not a single boolean-unioned body,
// is this generation's documented simplification.

import * as THREE from 'three'
import type { ToothDefinition } from '../anatomy/types'
import { buildCrownGeometry } from './crownGeometry'
import { buildRootGeometry } from './rootGeometry'

export interface ToothGeometryResult {
  crown: THREE.BufferGeometry
  roots: Array<{ name: string; geometry: THREE.BufferGeometry; apex: THREE.Vector3 }>
  occlusalBaseY: number
}

export function buildToothGeometry(tooth: ToothDefinition): ToothGeometryResult {
  const { geometry: crown, occlusalBaseY } = buildCrownGeometry(tooth.crown)
  const roots = tooth.roots.map((root) => {
    const { geometry, apex } = buildRootGeometry(root)
    return { name: root.name, geometry, apex }
  })
  return { crown, roots, occlusalBaseY }
}
