import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8')
const index = read('src/index.tsx')
const sidebar = read('src/layouts/SuperAppSidebar.tsx')
const bottomNav = read('src/layouts/BottomNav.tsx')
const dashboard = read('src/pages/Dashboard.tsx')
const palette = read('src/components/CommandPalette.tsx')
const failures: string[] = []

const routes = [
  '/crm/schedule','/crm/patients','/crm/medical-card','/crm/dental-chart','/crm/treatment-plans','/crm/visits','/crm/lab',
  '/crm/inventory','/crm/documents','/crm/staff','/crm/reminders','/crm/promotions','/crm/workflow','/crm/cashier',
  '/crm/pricelist','/crm/patient-inbox','/crm/clinic-settings','/crm/billing','/analytics','/shop','/shop/orders','/school',
  '/school/workspace','/diagnostics','/jobs','/community','/settings','/profile','/ai'
]

for (const route of routes) {
  if (!index.includes(`path="${route.replace(/^\//, '')}"`)) failures.push(`Missing route: ${route}`)
}

for (const route of [
  '/crm/schedule','/crm/patients','/crm/medical-card','/crm/dental-chart','/crm/treatment-plans','/crm/visits','/crm/lab',
  '/crm/inventory','/crm/documents','/crm/staff','/crm/reminders','/crm/promotions','/crm/workflow','/crm/cashier',
  '/crm/pricelist','/crm/patient-inbox','/analytics','/shop','/school','/diagnostics','/jobs','/community','/settings','/profile','/ai'
]) {
  if (!sidebar.includes(`path: '${route}'`)) failures.push(`Sidebar missing route: ${route}`)
}

// A single destination must not appear twice in the primary sidebar.
const sidebarPaths = [...sidebar.matchAll(/path: '([^']+)'/g)].map((m) => m[1])
const duplicatePaths = [...new Set(sidebarPaths.filter((p, i) => sidebarPaths.indexOf(p) !== i))]
if (duplicatePaths.length) failures.push(`Duplicate sidebar destinations: ${duplicatePaths.join(', ')}`)

// Finance is a compatibility alias only; the visible/canonical destination is cashier.
if (sidebar.includes("path: '/crm/finance'")) failures.push('Stale /crm/finance sidebar destination remains')
if (!index.includes('path="crm/finance"') || !index.includes('Navigate to="/crm/cashier"')) {
  failures.push('Legacy finance route is not a canonical redirect')
}

// AI must be a real workspace route, not the dashboard root.
if (sidebar.includes("id: 'ai',") && !sidebar.includes("path: '/ai'")) failures.push('Sidebar AI item points to dashboard root')
if (bottomNav.includes("id: 'ai'") && !bottomNav.includes("path: '/ai'")) failures.push('Mobile AI item points to dashboard root')

// Labels must be locale-driven, not hardcoded English UI copy.
if (!sidebar.includes('useTranslation') || !sidebar.includes('labelKey')) failures.push('Sidebar labels are not locale-driven')
if (bottomNav.includes("label: 'Academy'") || bottomNav.includes("label: 'Community'")) failures.push('Mobile navigation contains hardcoded English labels')

if (!dashboard.includes("navigate('/ai')")) failures.push('Dashboard AI actions not wired')
if (!sidebar.includes('useCommandPalette')) failures.push('Command palette integration missing')
if (!palette.includes('onAIQuery?.(query)')) failures.push('AI fallback missing')

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(`Command Center audit passed: ${routes.length} critical routes, navigation uniqueness, AI routing, and localization checks.`)
