import { useRef, useState, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import type { ToothDefinition } from '../anatomy/types'
import { ToothMesh } from './ToothMesh'
import { VIEW_PRESETS, type ViewPreset } from './cameraPresets'

function Lights() {
  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight position={[10, 14, 8]} intensity={1.1} />
      <directionalLight position={[-8, 6, -6]} intensity={0.35} color="#cfe0ff" />
      <directionalLight position={[0, -6, 10]} intensity={0.2} color="#fff2df" />
    </>
  )
}

interface SceneProps {
  tooth: ToothDefinition
  wireframe: boolean
  showCarabelli: boolean
  controlsRef: React.RefObject<OrbitControlsImpl>
}

function Scene({ tooth, wireframe, showCarabelli, controlsRef }: SceneProps) {
  return (
    <>
      <Lights />
      <group position={[0, -3, 0]}>
        <ToothMesh tooth={tooth} wireframe={wireframe} showCarabelli={showCarabelli} />
      </group>
      <OrbitControls ref={controlsRef} target={VIEW_PRESETS.buccal.target} minDistance={8} maxDistance={60} />
    </>
  )
}

export interface DentalViewer3DProps {
  tooth: ToothDefinition
  className?: string
}

/** Self-contained interactive viewer: orbit/zoom, preset anatomical views,
 *  wireframe toggle (useful for a quick topology sanity check), and an
 *  optional Cusp-of-Carabelli toggle since it's a non-obligate accessory cusp. */
export function DentalViewer3D({ tooth, className }: DentalViewer3DProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const [wireframe, setWireframe] = useState(false)
  const [showCarabelli, setShowCarabelli] = useState(false)
  const [activePreset, setActivePreset] = useState<ViewPreset | null>(null)

  const goToPreset = useCallback((preset: ViewPreset) => {
    const controls = controlsRef.current
    if (!controls) return
    const { position, up, target } = VIEW_PRESETS[preset]
    const camera = controls.object as THREE.PerspectiveCamera
    camera.position.set(...position)
    camera.up.set(...up)
    controls.target.set(...target)
    camera.lookAt(new THREE.Vector3(...target))
    controls.update()
    setActivePreset(preset)
  }, [])

  const resetCamera = useCallback(() => goToPreset('buccal'), [goToPreset])

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 320, borderRadius: 12, overflow: 'hidden', background: '#0c0f14' }}>
        <Canvas camera={{ position: VIEW_PRESETS.buccal.position, fov: 35, near: 0.1, far: 200 }} onCreated={() => setActivePreset('buccal')}>
          <Scene tooth={tooth} wireframe={wireframe} showCarabelli={showCarabelli} controlsRef={controlsRef} />
        </Canvas>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {(Object.keys(VIEW_PRESETS) as ViewPreset[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => goToPreset(p)}
            aria-pressed={activePreset === p}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              fontSize: 12,
              border: '1px solid rgba(201,169,110,0.35)',
              background: activePreset === p ? 'rgba(201,169,110,0.18)' : 'transparent',
              color: activePreset === p ? '#c9a96e' : '#a9a49a',
              cursor: 'pointer',
            }}
          >
            {VIEW_PRESETS[p].label}
          </button>
        ))}
        <span style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.1)' }} />
        <button type="button" onClick={resetCamera} style={{ padding: '6px 10px', borderRadius: 8, fontSize: 12, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#a9a49a', cursor: 'pointer' }}>
          Сброс камеры
        </button>
        <button
          type="button"
          onClick={() => setWireframe((v) => !v)}
          aria-pressed={wireframe}
          style={{ padding: '6px 10px', borderRadius: 8, fontSize: 12, border: '1px solid rgba(255,255,255,0.15)', background: wireframe ? 'rgba(255,255,255,0.08)' : 'transparent', color: '#a9a49a', cursor: 'pointer' }}
        >
          Каркас
        </button>
        <button
          type="button"
          onClick={() => setShowCarabelli((v) => !v)}
          aria-pressed={showCarabelli}
          style={{ padding: '6px 10px', borderRadius: 8, fontSize: 12, border: '1px solid rgba(255,255,255,0.15)', background: showCarabelli ? 'rgba(255,255,255,0.08)' : 'transparent', color: '#a9a49a', cursor: 'pointer' }}
        >
          Бугорок Карабелли
        </button>
      </div>
    </div>
  )
}
