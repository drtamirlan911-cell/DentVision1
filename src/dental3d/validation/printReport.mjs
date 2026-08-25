// One-off script: prints the full Tooth 16 validation report (all severities)
// for manual review. Not part of the build — run with `node --loader` isn't
// needed since we transpile via tsx.
/* eslint-disable no-console */
import { TOOTH_16 } from '../teeth/tooth16.ts'
import { buildToothGeometry } from '../engine/toothGeometry.ts'
import { validateGeometry } from './geometryValidation.ts'
import { validateToothAnatomy } from './anatomyValidation.ts'

const anatomyReport = validateToothAnatomy(TOOTH_16)
console.log('=== ANATOMY VALIDATION — Tooth', TOOTH_16.fdi, '===')
console.log('passed:', anatomyReport.passed)
for (const issue of anatomyReport.issues) console.log(` [${issue.severity}] ${issue.code}: ${issue.message}`)

const { crown, roots } = buildToothGeometry(TOOTH_16)
console.log('\n=== GEOMETRY VALIDATION ===')
for (const [name, geom] of [['crown', crown], ...roots.map((r) => [`root-${r.name}`, r.geometry])]) {
  const report = validateGeometry(geom, name)
  console.log(`\n-- ${name} --`)
  console.log(' vertices:', report.vertexCount, 'triangles:', report.triangleCount, 'boundaryLoops:', report.boundaryLoopCount)
  console.log(' bbox size (mm):', report.boundingBox.size.map((n) => n.toFixed(2)))
  console.log(' passed:', report.passed)
  for (const issue of report.issues) console.log(`  [${issue.severity}] ${issue.code}: ${issue.message}`)
}
