import { describe, expect, it } from 'vitest'
import { TOOTH_16 } from '../teeth/tooth16'
import { buildToothGeometry } from '../engine/toothGeometry'
import { validateGeometry } from './geometryValidation'
import { validateToothAnatomy } from './anatomyValidation'

describe('Tooth 16 — anatomy metadata validation', () => {
  const report = validateToothAnatomy(TOOTH_16)

  it('has no anatomy errors', () => {
    const errors = report.issues.filter((i) => i.severity === 'error')
    expect(errors, JSON.stringify(errors, null, 2)).toHaveLength(0)
  })

  it('documents at least 3 independent references', () => {
    expect(TOOTH_16.references.length).toBeGreaterThanOrEqual(3)
  })

  it('documents at least one known limitation', () => {
    expect(TOOTH_16.knownLimitations.length).toBeGreaterThan(0)
  })
})

describe('Tooth 16 — geometry validation', () => {
  const { crown, roots } = buildToothGeometry(TOOTH_16)

  it('crown geometry has no manifold/topology errors', () => {
    const report = validateGeometry(crown, 'tooth16-crown')
    const errors = report.issues.filter((i) => i.severity === 'error')
    expect(errors, JSON.stringify(errors, null, 2)).toHaveLength(0)
    // Exactly one open boundary loop is expected — the cervical line.
    expect(report.boundaryLoopCount).toBe(1)
  })

  it('every root geometry has no manifold/topology errors', () => {
    for (const root of roots) {
      const report = validateGeometry(root.geometry, `tooth16-root-${root.name}`)
      const errors = report.issues.filter((i) => i.severity === 'error')
      expect(errors, `${root.name}: ${JSON.stringify(errors, null, 2)}`).toHaveLength(0)
      expect(report.boundaryLoopCount, `${root.name} boundary loops`).toBe(1)
    }
  })

  it('has 3 roots (maxillary molar)', () => {
    expect(roots.map((r) => r.name).sort()).toEqual(['distobuccal', 'mesiobuccal', 'palatal'])
  })

  it('crown bounding box roughly matches the defined proportions', () => {
    const report = validateGeometry(crown, 'tooth16-crown')
    const [sizeX, sizeY, sizeZ] = report.boundingBox.size
    // sizeX = buccolingual span, sizeZ = mesiodistal span, sizeY = crown height
    expect(sizeX).toBeGreaterThan(TOOTH_16.crown.buccolingualWidthMm * 0.6)
    expect(sizeX).toBeLessThan(TOOTH_16.crown.buccolingualWidthMm * 1.05)
    expect(sizeZ).toBeGreaterThan(TOOTH_16.crown.mesiodistalWidthMm * 0.6)
    expect(sizeZ).toBeLessThan(TOOTH_16.crown.mesiodistalWidthMm * 1.05)
    expect(sizeY).toBeGreaterThan(TOOTH_16.crown.heightMm * 0.8)
  })
})
