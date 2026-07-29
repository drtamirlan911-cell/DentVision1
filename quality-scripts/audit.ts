/**
 * Quality Center — Automated Audit Script
 * Usage: npx tsx quality-scripts/audit.ts
 *
 * Проверяет:
 * - TypeScript errors (tsc --noEmit)
 * - Unused imports (ts-prune or manual grep)
 * - Missing aria-label on icon-only buttons
 * - Large components (>400 lines)
 * - ESLint errors if available
 */

import { execSync } from 'child_process'
import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const SRC_DIR = join(__dirname, '..', 'src')
const RESULTS: { category: string; severity: string; message: string; file?: string }[] = []
let passed = 0
let failed = 0

function pass(msg: string) { passed++; RESULTS.push({ category: 'PASS', severity: 'info', message: msg }) }
function fail(msg: string, severity: string = 'error', file?: string) { failed++; RESULTS.push({ category: 'FAIL', severity, message: msg, file }) }

function getAllFiles(dir: string, ext: string): string[] {
  const files: string[] = []
  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      const p = join(dir, e.name)
      if (e.isDirectory() && !e.name.startsWith('node_modules') && !e.name.startsWith('.')) files.push(...getAllFiles(p, ext))
      else if (e.name.endsWith(ext)) files.push(p)
    }
  } catch { /* skip */ }
  return files
}

// ─── 1. TypeScript Compilation ───
try {
  console.log('⏳ Checking TypeScript...')
  const rootDir = join(__dirname, '..')
  execSync('npx tsc --noEmit', { cwd: rootDir, stdio: 'pipe', timeout: 60000 })
  pass('TypeScript: no errors')
} catch (e: any) {
  const out = e.stdout?.toString() || ''
  const lines = out.split('\n').filter((l: string) => l.includes('error TS'))
  fail(`TypeScript: ${lines.length} error(s) — run \`npx tsc --noEmit\``, 'critical')
  lines.slice(0, 5).forEach((l: string) => fail(`  ${l.trim()}`, 'critical'))
}

// ─── 2. Large Components (>400 lines) ───
console.log('⏳ Checking component sizes...')
const tsxFiles = getAllFiles(SRC_DIR, '.tsx')
for (const file of tsxFiles) {
  const content = readFileSync(file, 'utf8')
  const lines = content.split('\n').length
  if (lines > 400) {
    const rel = file.replace(SRC_DIR, 'src')
    fail(`${rel}: ${lines} lines (limit: 400)`, 'warning', rel)
  }
}
if (failed === 0 || RESULTS.filter(r => r.message.includes('lines (limit:')).length === 0) {
  pass('Component sizes: all under 400 lines')
}

// ─── 3. Missing aria-label on icon-only buttons ───
console.log('⏳ Checking aria-labels...')
for (const file of tsxFiles) {
  const content = readFileSync(file, 'utf8')
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    // Icon buttons without aria-label
    if (trimmed.includes('size="icon"') || trimmed.includes("size='icon'") || trimmed.includes('size="icon-sm"') || trimmed.includes("size='icon-sm'")) {
      let context = ''
      for (let j = Math.max(0, i - 3); j <= Math.min(lines.length - 1, i + 3); j++) context += lines[j] + '\n'
      if (!context.includes('aria-label')) {
        const rel = file.replace(SRC_DIR, 'src')
        fail(`${rel}:${i + 1} — icon button without aria-label`, 'critical', `${rel}:${i + 1}`)
      }
    }
  }
}

// ─── 4. Unused imports (grep for unused lucide icons) ───
console.log('⏳ Checking unused imports...')
try {
  execSync('npx ts-prune --error', { cwd: join(__dirname, '..'), stdio: 'pipe', timeout: 30000 })
  pass('ts-prune: no unused exports')
} catch {
  fail('Unused exports found — run `npx ts-prune`', 'warning')
}

// ─── 5. Console.log / debugger statements ───
console.log('⏳ Checking debug statements...')
for (const file of tsxFiles) {
  const content = readFileSync(file, 'utf8')
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    if (t.includes('console.log(') && !t.includes('//') && !t.includes('*')) {
      const rel = file.replace(SRC_DIR, 'src')
      fail(`${rel}:${i + 1} — console.log in production code`, 'warning', `${rel}:${i + 1}`)
    }
    if (t === 'debugger;' || t === 'debugger') {
      const rel = file.replace(SRC_DIR, 'src')
      fail(`${rel}:${i + 1} — debugger statement`, 'critical', `${rel}:${i + 1}`)
    }
  }
}

// ─── 6. Backend TS check ───
try {
  const backendDir = join(__dirname, '..', 'dentvision-backend')
  execSync('npx tsc --noEmit', { cwd: backendDir, stdio: 'pipe', timeout: 60000 })
  pass('Backend TypeScript: no errors')
} catch (e: any) {
  const out = e.stdout?.toString() || ''
  const lines = out.split('\n').filter((l: string) => l.includes('error TS'))
  fail(`Backend TypeScript: ${lines.length} error(s)`, 'critical')
}

// ─── Summary ───
console.log('\n' + '='.repeat(60))
console.log('QUALITY AUDIT RESULTS')
console.log('='.repeat(60))
console.log(`  Passed: ${passed}`)
console.log(`  Failed: ${failed}`)
console.log(`  Score:  ${Math.round((passed / (passed + failed || 1)) * 100)}%`)
console.log('')

const critical = RESULTS.filter(r => r.severity === 'critical')
const warnings = RESULTS.filter(r => r.severity === 'warning')
if (critical.length) {
  console.log(`❌ ${critical.length} CRITICAL ISSUES:`)
  critical.forEach(r => console.log(`   ${r.message}`))
}
if (warnings.length) {
  console.log(`\n⚠️  ${warnings.length} WARNINGS:`)
  warnings.forEach(r => console.log(`   ${r.message}`))
}
console.log('\n' + '='.repeat(60))

// Exit with error code if critical issues found
process.exit(critical.length > 0 ? 1 : 0)
