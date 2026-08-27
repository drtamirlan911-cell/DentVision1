import type { Vector3Tuple } from 'three'

export type ViewPreset = 'occlusal' | 'apical' | 'buccal' | 'palatal' | 'mesial' | 'distal'

/** Occlusal/apical are end-on views along the tooth's long axis — framed
 *  tight on the crown/occlusal table, which is what those views are for. */
const CROWN_DISTANCE = 22
const CROWN_TARGET_Y = 3
/** Buccal/palatal/mesial/distal are side-profile views, which by clinical
 *  convention show the whole tooth — crown AND root — not just the crown.
 *  Framed to fit the full crown-to-apex span (crown ~7.5mm + longest root
 *  ~13.5mm ≈ 21mm) with margin; distance derived from the viewer's 35°
 *  vertical FOV (see DentalViewer3D.tsx Canvas). */
const FULL_TOOTH_DISTANCE = 40
const FULL_TOOTH_TARGET_Y = -6

interface ViewPresetSpec {
  position: Vector3Tuple
  up: Vector3Tuple
  target: Vector3Tuple
  label: string
}

export const VIEW_PRESETS: Record<ViewPreset, ViewPresetSpec> = {
  occlusal: { position: [0, CROWN_DISTANCE, 0.01], up: [0, 0, -1], target: [0, CROWN_TARGET_Y, 0], label: 'Окклюзионный' },
  apical: { position: [0, -CROWN_DISTANCE, 0.01], up: [0, 0, 1], target: [0, CROWN_TARGET_Y, 0], label: 'Апикальный' },
  buccal: { position: [FULL_TOOTH_DISTANCE, FULL_TOOTH_TARGET_Y, 0], up: [0, 1, 0], target: [0, FULL_TOOTH_TARGET_Y, 0], label: 'Щёчный' },
  palatal: { position: [-FULL_TOOTH_DISTANCE, FULL_TOOTH_TARGET_Y, 0], up: [0, 1, 0], target: [0, FULL_TOOTH_TARGET_Y, 0], label: 'Нёбный' },
  mesial: { position: [0, FULL_TOOTH_TARGET_Y, FULL_TOOTH_DISTANCE], up: [0, 1, 0], target: [0, FULL_TOOTH_TARGET_Y, 0], label: 'Мезиальный' },
  distal: { position: [0, FULL_TOOTH_TARGET_Y, -FULL_TOOTH_DISTANCE], up: [0, 1, 0], target: [0, FULL_TOOTH_TARGET_Y, 0], label: 'Дистальный' },
}
