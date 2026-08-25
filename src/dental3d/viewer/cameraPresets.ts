import type { Vector3Tuple } from 'three'

export type ViewPreset = 'occlusal' | 'apical' | 'buccal' | 'palatal' | 'mesial' | 'distal'

const DISTANCE = 22
const TARGET_Y = 3

export const VIEW_TARGET: Vector3Tuple = [0, TARGET_Y, 0]

export const VIEW_PRESETS: Record<ViewPreset, { position: Vector3Tuple; up: Vector3Tuple; label: string }> = {
  occlusal: { position: [0, DISTANCE, 0.01], up: [0, 0, -1], label: 'Окклюзионный' },
  apical: { position: [0, -DISTANCE, 0.01], up: [0, 0, 1], label: 'Апикальный' },
  buccal: { position: [DISTANCE, TARGET_Y, 0], up: [0, 1, 0], label: 'Щёчный' },
  palatal: { position: [-DISTANCE, TARGET_Y, 0], up: [0, 1, 0], label: 'Нёбный' },
  mesial: { position: [0, TARGET_Y, DISTANCE], up: [0, 1, 0], label: 'Мезиальный' },
  distal: { position: [0, TARGET_Y, -DISTANCE], up: [0, 1, 0], label: 'Дистальный' },
}
