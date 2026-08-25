import { useMemo } from 'react'
import * as THREE from 'three'
import type { ToothDefinition } from '../anatomy/types'
import { buildToothGeometry } from '../engine/toothGeometry'
import { createEnamelMaterial, createRootSurfaceMaterial } from '../materials/dentalMaterials'

export interface ToothMeshProps {
  tooth: ToothDefinition
  wireframe?: boolean
  showCarabelli?: boolean
}

/** Renders one tooth's crown + roots. Geometry is rebuilt only when the
 *  definition or the Carabelli toggle changes — not every render. */
export function ToothMesh({ tooth, wireframe = false, showCarabelli = false }: ToothMeshProps) {
  const effectiveTooth = useMemo<ToothDefinition>(() => {
    if (showCarabelli) return tooth
    return { ...tooth, crown: { ...tooth.crown, cusps: tooth.crown.cusps.filter((c) => c.name !== 'carabelli') } }
  }, [tooth, showCarabelli])

  const { crown, roots } = useMemo(() => buildToothGeometry(effectiveTooth), [effectiveTooth])

  const enamel = useMemo(() => createEnamelMaterial(), [])
  const rootSurface = useMemo(() => createRootSurfaceMaterial(), [])

  return (
    <group>
      <mesh geometry={crown} material={enamel}>
        {wireframe && <meshBasicMaterial attach="material" wireframe color="#c9a96e" />}
      </mesh>
      {roots.map((r) => (
        <mesh key={r.name} geometry={r.geometry} material={rootSurface}>
          {wireframe && <meshBasicMaterial attach="material" wireframe color="#8a6d3b" />}
        </mesh>
      ))}
    </group>
  )
}

export function disposeToothMaterials(materials: THREE.Material[]): void {
  materials.forEach((m) => m.dispose())
}
