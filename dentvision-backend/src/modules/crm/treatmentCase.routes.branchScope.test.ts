import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('treatment case branch isolation contract', () => {
  it('filters non-organization roles through authenticated branch assignments', () => {
    const source = readFileSync(resolve(process.cwd(), 'dentvision-backend/src/modules/crm/treatmentCase.routes.ts'), 'utf8')
    expect(source).toContain('req.user?.branchIds ?? []')
    expect(source).toContain('patient: { branchId: { in: branchIds } }')
    expect(source).toContain('SUPERADMIN')
    expect(source).toContain('OWNER')
    expect(source).toContain('ADMIN')
  })
})
