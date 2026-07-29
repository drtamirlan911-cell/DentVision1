import { describe, expect, it } from 'vitest'
import { searchDentalCatalog, DENTAL_ICD10_SEED } from './icd10.catalog.js'

describe('icd10 catalog', () => {
  it('has dental codes seeded', () => {
    expect(DENTAL_ICD10_SEED.length).toBeGreaterThan(50)
    expect(DENTAL_ICD10_SEED[0]).toMatchObject({
      code: expect.any(String),
      description: expect.any(String),
      category: expect.any(String),
    })
  })

  it('lists all without query', () => {
    const rows = searchDentalCatalog(undefined, 300)
    expect(rows.length).toBe(DENTAL_ICD10_SEED.length)
    expect(rows[0].name).toBeTruthy()
  })

  it('filters by code and russian name', () => {
    const byCode = searchDentalCatalog('K02.1')
    expect(byCode.some((r) => r.code === 'K02.1')).toBe(true)

    const byName = searchDentalCatalog('кариес')
    expect(byName.length).toBeGreaterThan(0)
    expect(byName.every((r) => /кариес|K02/i.test(`${r.code} ${r.name}`))).toBe(true)
  })
})
