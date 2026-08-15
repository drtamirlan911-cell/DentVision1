#!/usr/bin/env npx tsx
// DentVision Automated QA Runner
// Runs all test suites in sequence and generates reports

import { execSync } from 'child_process'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..')
const REPORT_FILE = join(ROOT, 'QA_REPORT.md')
const GATE_FILE = join(ROOT, 'DENTVISION_RELEASE_GATE.md')

interface TestResult {
  suite: string
  total: number
  passed: number
  failed: number
  skipped: number
  duration: string
  status: 'PASS' | 'FAIL' | 'SKIP'
}

const results: TestResult[] = []
let hasP0 = false
let hasP1 = false

function runSuite(name: string, command: string): TestResult {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Running: ${name}`)
  console.log(`${'='.repeat(60)}`)
  
  try {
    const output = execSync(command, { 
      cwd: ROOT, 
      encoding: 'utf-8', 
      timeout: 300000,
      stdio: 'pipe'
    })
    
    // Parse vitest output
    const totalMatch = output.match(/Tests\s+(\d+)\s+passed/)
    const failMatch = output.match(/(\d+)\s+failed/)
    const total = totalMatch ? parseInt(totalMatch[1]) : 0
    const failed = failMatch ? parseInt(failMatch[1]) : 0
    
    return {
      suite: name,
      total: total || (total - failed),
      passed: total || 0,
      failed,
      skipped: 0,
      duration: '',
      status: failed > 0 ? 'FAIL' : 'PASS'
    }
  } catch (e: any) {
    const output = e.stdout || e.stderr || ''
    const totalMatch = output.match(/Tests\s+(\d+)/)
    const failMatch = output.match(/(\d+)\s+failed/)
    
    return {
      suite: name,
      total: totalMatch ? parseInt(totalMatch[1]) : 0,
      passed: 0,
      failed: failMatch ? parseInt(failMatch[1]) : 1,
      skipped: 0,
      duration: '',
      status: 'FAIL'
    }
  }
}

// Main execution
console.log('DentVision Automated QA Pipeline')
console.log(`Started at: ${new Date().toISOString()}`)

// Phase 1: Build check
console.log('\n--- Phase 1: Build ---')
const buildResult = runSuite('BUILD', 'npm run build')
results.push(buildResult)

// Phase 2: Typecheck
console.log('\n--- Phase 2: Typecheck ---')
const tscResult = runSuite('TYPECHECK', 'npm run typecheck')
results.push(tscResult)

// Phase 3: Lint
console.log('\n--- Phase 3: Lint ---')
const lintResult = runSuite('LINT', 'npm run lint')
results.push(lintResult)

// Phase 4: Unit tests
console.log('\n--- Phase 4: Unit Tests ---')
const unitResult = runSuite('UNIT TESTS', 'npx vitest run')
results.push(unitResult)

// Phase 5: API integration tests
console.log('\n--- Phase 5: API Tests ---')
const apiResult = runSuite('API TESTS', 'npx playwright test --project=chromium e2e/tests/auth.spec.ts e2e/tests/rbac.spec.ts e2e/tests/tenant-isolation.spec.ts e2e/tests/idor.spec.ts')
results.push(apiResult)

// Phase 6: Workflow tests
console.log('\n--- Phase 6: Workflow Tests ---')
const workflowResult = runSuite('WORKFLOW TESTS', 'npx playwright test --project=chromium e2e/tests/patient-workflow.spec.ts e2e/tests/appointment.spec.ts e2e/tests/diagnosis.spec.ts e2e/tests/treatment-plan.spec.ts')
results.push(workflowResult)

// Phase 7: Business tests
console.log('\n--- Phase 7: Business Tests ---')
const bizResult = runSuite('BUSINESS TESTS', 'npx playwright test --project=chromium e2e/tests/marketplace.spec.ts e2e/tests/payment.spec.ts e2e/tests/academy.spec.ts e2e/tests/ai.spec.ts')
results.push(bizResult)

// Phase 8: Security tests
console.log('\n--- Phase 8: Security Tests ---')
const secResult = runSuite('SECURITY TESTS', 'npx playwright test --project=chromium e2e/tests/error-injection.spec.ts e2e/tests/double-submit.spec.ts e2e/tests/api-contract.spec.ts')
results.push(secResult)

// Calculate totals
const totals = results.reduce((acc, r) => ({
  total: acc.total + r.total,
  passed: acc.passed + r.passed,
  failed: acc.failed + r.failed,
  skipped: acc.skipped + r.skipped
}), { total: 0, passed: 0, failed: 0, skipped: 0 })

const finalStatus = totals.failed === 0 ? 'READY' : 'NOT READY'
hasP0 = results.some(r => r.status === 'FAIL' && ['BUILD', 'TYPECHECK', 'AUTH', 'TENANT ISOLATION', 'PAYMENT'].includes(r.suite))
hasP1 = results.some(r => r.status === 'FAIL' && ['RBAC', 'IDOR', 'UNIT TESTS'].includes(r.suite))

// Generate QA_REPORT.md
const report = `# DentVision Automated QA Report

Generated: ${new Date().toISOString()}

## Test Summary

| Suite | Total | Passed | Failed | Status |
|-------|-------|--------|--------|--------|
${results.map(r => `| ${r.suite} | ${r.total} | ${r.passed} | ${r.failed} | ${r.status} |`).join('\n')}
| **TOTAL** | **${totals.total}** | **${totals.passed}** | **${totals.failed}** | **${finalStatus}** |

## Final Result
- **STATUS: ${finalStatus}**
- P0 Issues: ${hasP0 ? 'YES' : '0'}
- P1 Issues: ${hasP1 ? 'YES' : '0'}
`

writeFileSync(REPORT_FILE, report)

// Generate DENTVISION_RELEASE_GATE.md
const gate = `# DentVision Release Gate

Generated: ${new Date().toISOString()}

| Check | Status |
|-------|--------|
| BUILD | ${buildResult.status} |
| TYPECHECK | ${tscResult.status} |
| LINT | ${lintResult.status} |
| UNIT TESTS | ${unitResult.status} |
| AUTH | ${apiResult.status} |
| RBAC | ${apiResult.status} |
| TENANT ISOLATION | ${apiResult.status} |
| IDOR | ${apiResult.status} |
| PATIENT | ${workflowResult.status} |
| APPOINTMENT | ${workflowResult.status} |
| DIAGNOSIS | ${workflowResult.status} |
| TREATMENT PLAN | ${workflowResult.status} |
| MARKETPLACE | ${bizResult.status} |
| PAYMENTS | ${bizResult.status} |
| AI | ${bizResult.status} |
| ACADEMY | ${bizResult.status} |
| SECURITY | ${secResult.status} |

## Final Status: ${finalStatus}
`

writeFileSync(GATE_FILE, gate)

console.log('\n' + '='.repeat(60))
console.log('QA PIPELINE COMPLETE')
console.log('='.repeat(60))
console.log(`Total: ${totals.total} | Passed: ${totals.passed} | Failed: ${totals.failed}`)
console.log(`Status: ${finalStatus}`)
console.log(`Reports: QA_REPORT.md, DENTVISION_RELEASE_GATE.md`)

process.exit(totals.failed > 0 ? 1 : 0)
