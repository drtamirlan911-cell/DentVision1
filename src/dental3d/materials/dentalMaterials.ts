// Enamel and root-surface materials. Deliberately not glossy plastic: enamel
// has a translucent, faintly bluish-white sheen with moderate (not mirror)
// specular response; the root surface (cementum) is duller, warmer, and
// rougher — real root surfaces are matte compared to enamel, and giving both
// the same finish is one of the give-away signs of a generic tooth asset.

import * as THREE from 'three'

export function createEnamelMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#f2ede2'),
    roughness: 0.3,
    metalness: 0,
    clearcoat: 0.18,
    clearcoatRoughness: 0.25,
    transmission: 0.06,
    thickness: 1.2,
    ior: 1.63, // enamel refractive index is close to this, unlike acrylic (~1.49)
    sheen: 0.15,
    sheenColor: new THREE.Color('#e8e2d4'),
  })
}

export function createRootSurfaceMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#e0c9a0'),
    roughness: 0.58,
    metalness: 0,
    clearcoat: 0,
    sheen: 0.05,
  })
}
