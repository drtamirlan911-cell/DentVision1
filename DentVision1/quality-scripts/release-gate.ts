#!/usr/bin/env node
import { execSync } from 'child_process'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname, relative } from 'path'
import { fileURLToPath } from 'url'
import { QC_CONFIG } from './config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const SRC = join(ROOT, 'src')

interface GateResult {
  name: string
  status: 'PASS' | 'FAIL' | 'SKIP'
  message: string
  details?: string[]
}

const results: GateResult[] = []

function pass(name: string, message: string) {
  results.push({ name, status: 'PASS', message })
}

function fail(name: string, message: string, details?: string[]) {
  results.push({ name, status: 'FAIL', message, details })
}

function skip(name: string, message: string) {
  results.push({ name, status: 'SKIP', message })
}

// ─── 1. TypeScript Check ───
console.log('🔍 Release Gate: TypeScript check...')
try {
  execSync('npx tsc --noEmit', { cwd: ROOT, stdio: 'pipe', timeout: 120000 })
  pass('TypeScript', 'No compilation errors')
} catch (e: any) {
  const out = e.stdout?.toString() || ''
  const lines = out.split('\n').filter((l: string) => l.includes('error TS'))
  fail('TypeScript', `${lines.length} compiler error(s)`, lines.slice(0, 10))
}

// ─── 2. ESLint Check ───
console.log('🔍 Release Gate: ESLint check...')
try {
  const lint = execSync('npx eslint src/ --max-warnings ' + QC_CONFIG.maxTsWarnings, { cwd: ROOT, stdio: 'pipe', timeout: 120000 }).toString()
  const match = lint.match(/(\d+) problems/)
  if (match) {
    const problems = parseInt(match[1])
    if (problems === 0) {
      pass('ESLint', 'No lint issues')
    } else {
      const errors = lint.match(/(\d+) errors?/)
      const warnings = lint.match(/(\d+) warnings?/)
      const errCount = errors ? parseInt(errors[1]) : 0
      const warnCount = warnings ? parseInt(warnings[1]) : 0
      if (errCount > 0) {
        fail('ESLint', `${errCount} error(s), ${warnCount} warning(s)`, [`${errCount} errors must be fixed before release`])
      } else {
        pass('ESLint', `${warnCount} warnings (all non-critical)`)
      }
    }
  }
} catch (e: any) {
  const out = e.stdout?.toString() || ''
  const err = e.stderr?.toString() || ''
  const lines = (out + err).split('\n').filter((l: string) => l.includes('error') && !l.includes('warning'))
  fail('ESLint', 'Lint check failed', lines.slice(0, 5))
}

// ─── 3. Component Size Check ───
console.log('🔍 Release Gate: Component size check...')
const largeFiles: string[] = []
function getAllFiles(dir: string): string[] {
  const files: string[] = []
  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      const p = join(dir, e.name)
      if (e.isDirectory() && !e.name.startsWith('node_modules') && !e.name.startsWith('.')) files.push(...getAllFiles(p))
      else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) files.push(p)
    }
  } catch { }
  return files
}
const allFiles = getAllFiles(SRC)
for (const file of allFiles) {
  const content = readFileSync(file, 'utf8')
  const lines = content.split('\n').length
  if (lines > QC_CONFIG.maxComponentLines) {
    const rel = relative(ROOT, file)
    largeFiles.push(`${rel}: ${lines} lines`)
  }
}
if (largeFiles.length > 0) {
  fail('Component Size', `${largeFiles.length} file(s) exceed ${QC_CONFIG.maxComponentLines}-line limit`, largeFiles)
} else {
  pass('Component Size', 'All files within limits')
}

// ─── 4. Debug Statements ───
console.log('🔍 Release Gate: Debug statement check...')
const debugStatements: string[] = []
for (const file of allFiles) {
  const content = readFileSync(file, 'utf8')
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    if (t.includes('console.log(') && !t.includes('//') && !t.includes('*') && !t.includes('console.error') && !t.includes('console.warn')) {
      const rel = relative(ROOT, file)
      debugStatements.push(`${rel}:${i + 1} — console.log`)
    }
    if (t === 'debugger;') {
      const rel = relative(ROOT, file)
      debugStatements.push(`${rel}:${i + 1} — debugger`)
    }
  }
}
if (debugStatements.length > 0) {
  fail('Debug Statements', `${debugStatements.length} debug statement(s) found`, debugStatements)
} else {
  pass('Debug Statements', 'No debug statements')
}

// ─── 5. Security Scan ───
console.log('🔍 Release Gate: Security scan...')
const securityIssues: string[] = []
for (const file of allFiles) {
  const content = readFileSync(file, 'utf8')
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    // Check for hardcoded secrets
    if (QC_CONFIG.securityPatterns.hardcodedSecrets.test(t) && !t.includes('example') && !t.includes('test')) {
      const rel = relative(ROOT, file)
      securityIssues.push(`${rel}:${i + 1} — possible hardcoded secret`)
    }
    // Check for mass assignment patterns
    if (QC_CONFIG.securityPatterns.massAssignment.test(t)) {
      const rel = relative(ROOT, file)
      securityIssues.push(`${rel}:${i + 1} — possible mass assignment`)
    }
  }
}
if (securityIssues.length > 0) {
  fail('Security', `${securityIssues.length} potential security issue(s)`, securityIssues)
} else {
  pass('Security', 'No security issues detected')
}

// ─── 6. Aria-label Check ───
console.log('🔍 Release Gate: Aria-label check...')
const missingAria: string[] = []
const tsxFiles = allFiles.filter(f => f.endsWith('.tsx'))
for (const file of tsxFiles) {
  const content = readFileSync(file, 'utf8')
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    // Skip native <button> without icon-only class patterns
    const isIconSize = trimmed.includes('size="icon"') || trimmed.includes("size='icon'") || trimmed.includes('size="icon-sm"') || trimmed.includes("size='icon-sm'")
    if (!isIconSize) continue
    // Check if it's a React Button with title prop (Button auto-generates aria-label from title)
    if (trimmed.includes('<Button') && trimmed.includes('title=')) continue
    // Check if aria-label is in context (2 lines before/after)
    let context = ''
    for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 2); j++) context += lines[j] + '\n'
    if (context.includes('aria-label')) continue
    const rel = relative(ROOT, file)
    missingAria.push(`${rel}:${i + 1} — icon button without aria-label`)
  }
}
if (missingAria.length > 0) {
  fail('Aria-labels', `${missingAria.length} icon button(s) missing aria-label`, missingAria)
} else {
  pass('Aria-labels', 'All icon buttons have aria-labels')
}

// ─── Summary ───
console.log('\n' + '═'.repeat(60))
console.log('  RELEASE GATE REPORT')
console.log('═'.repeat(60))
for (const r of results) {
  const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⏭️'
  console.log(`  ${icon} ${r.name}: ${r.message}`)
  if (r.details && r.details.length > 0) {
    r.details.slice(0, 5).forEach(d => console.log(`     ${d}`))
    if (r.details.length > 5) console.log(`     ... and ${r.details.length - 5} more`)
  }
}
console.log('═'.repeat(60))

const failedChecks = results.filter(r => r.status === 'FAIL')
const passedChecks = results.filter(r => r.status === 'PASS')
console.log(`\n  ${passedChecks.length} passed, ${failedChecks.length} failed`)
if (failedChecks.length > 0) {
  console.log('\n❌ RELEASE GATE BLOCKED — fix all failures before building\n')
  process.exit(1)
} else {
  console.log('\n✅ RELEASE GATE PASSED — ready to build\n')
  process.exit(0)
}
