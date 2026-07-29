import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  Accessibility, Gauge, Shield, Code, Database, Search, Brain,
  FileText, DollarSign, Microscope, ShoppingCart, GraduationCap,
  CheckCircle, XCircle, AlertTriangle, RefreshCw, ExternalLink,
  Eye, EyeOff,
} from 'lucide-react'
import { Card } from '@/components/ui/ds/Card'
import { Button } from '@/components/ui/ds/Button'
import { Input } from '@/components/ui/ds/Input'
import { Badge } from '@/components/ui/ds/Badge'
import { StatCard, PageHeader } from '@/components/ui/ds/StatCard'
import { GlassCard } from '@/components/ui/ds/GlassCard'
import { Skeleton } from '@/components/ui/ds/Skeleton'
import { Modal } from '@/components/ui/ds/Modal'
import { Tabs, Separator, Switch } from '@/components/ui/ds/Misc'

type QCTab = 'accessibility' | 'performance' | 'security' | 'code-quality' | 'architecture' | 'diagnostics'

interface AuditItem {
  id: string
  label: string
  severity: 'critical' | 'serious' | 'moderate' | 'minor' | 'pass'
  category: string
  file?: string
  line?: number
  description: string
  fix?: string
}

const MOCK_AUDIT: AuditItem[] = [
  { id: 'a1', label: 'Missing aria-label on icon buttons', severity: 'critical', category: 'Accessibility', file: 'src/components/ui/ds/Modal.tsx', line: 127, description: 'Close button in Modal lacks aria-label', fix: 'Add aria-label="Закрыть" to the close button' },
  { id: 'a2', label: 'Missing role="navigation" on sidebar', severity: 'serious', category: 'Accessibility', file: 'src/layouts/Sidebar.tsx', line: 500, description: 'Sidebar nav element missing explicit aria-label', fix: 'Add aria-label="Главная навигация" to <motion.nav>' },
  { id: 'a3', label: 'Missing aria-current on active nav items', severity: 'serious', category: 'Accessibility', file: 'src/layouts/Sidebar.tsx', line: 200, description: 'Active nav item lacks aria-current="page"', fix: 'Add aria-current="page" to active items' },
  { id: 'a4', label: 'Dialogs missing aria-modal', severity: 'serious', category: 'Accessibility', file: 'src/components/ui/ds/Modal.tsx', line: 95, description: 'Modal dialog missing role="dialog" and aria-modal', fix: 'Add role="dialog" aria-modal="true"' },
  { id: 'a5', label: 'Bottom nav missing nav label', severity: 'moderate', category: 'Accessibility', file: 'src/layouts/BottomNav.tsx', line: 48, description: 'Bottom navigation has no distinguishing aria-label', fix: 'Add aria-label="Навигация по разделам"' },
  { id: 'a6', label: 'Drawer missing aria attributes', severity: 'moderate', category: 'Accessibility', file: 'src/components/ui/ds/Drawer.tsx', line: 76, description: 'Drawer close button has no aria-label', fix: 'Add aria-label="Закрыть"' },
  { id: 'a7', label: 'Color contrast: text-muted on surface-3', severity: 'serious', category: 'Accessibility', file: 'src/styles/global.css', line: 1, description: 'txt-muted on surface-3 may fail 4.5:1 contrast', fix: 'Darken txt-muted or lighten surface-3' },
  { id: 'a8', label: 'No focus trap in AlertDropdown', severity: 'moderate', category: 'Accessibility', file: 'src/layouts/AlertDropdown.tsx', line: 100, description: 'Open dropdown has no focus trapping', fix: 'Implement focus trapping with tab key listener' },
  { id: 'a9', label: 'Missing 404 page', severity: 'moderate', category: 'UX', file: 'src/index.tsx', line: 215, description: 'Unknown routes silently redirect to /', fix: 'Create a proper 404 page with navigation' },
  { id: 'p1', label: 'No lazy loading for login page', severity: 'minor', category: 'Performance', file: 'src/index.tsx', line: 13, description: 'Login and public pages are eagerly loaded', fix: 'Use React.lazy for all pages' },
  { id: 'c1', label: 'Unused import: Scale in Sidebar', severity: 'minor', category: 'Code Quality', file: 'src/layouts/Sidebar.tsx', line: 9, description: 'Scale icon imported but not used', fix: 'Remove unused import' },
  { id: 's1', label: 'Routes missing role guard', severity: 'critical', category: 'Security', file: 'src/index.tsx', line: 143, description: '/dashboard, /settings, /profile, /bi not wrapped in guarded()', fix: 'Wrap unprotected routes in RequirePage' },
]

const MOCK_PERFORMANCE = {
  lighthouse: { performance: 72, accessibility: 68, bestPractices: 81, seo: 89 },
  lastRun: '2026-07-29T10:30:00Z',
  bundleSize: '1.8 MB',
  firstPaint: '1.8s',
  interactivity: '3.2s',
}

const MOCK_SECURITY = {
  jwt: { status: 'pass', detail: 'JWT with refresh rotation' },
  rbac: { status: 'pass', detail: 'Role-based access control active' },
  xss: { status: 'warning', detail: 'Some inputs not sanitized' },
  rateLimit: { status: 'fail', detail: 'No rate limiting on auth endpoints' },
  csp: { status: 'pass', detail: 'Content-Security-Policy header set' },
  auditLog: { status: 'pass', detail: 'Audit logging active' },
}

const MOCK_CODE_QUALITY = {
  eslint: { errors: 3, warnings: 12 },
  typescript: { errors: 0, warnings: 5 },
  unusedImports: 8,
  largeComponents: ['IntelligenceLayout (575 lines)', 'Sidebar (561 lines)', 'SuperAdmin (533 lines)'],
  cyclomaticComplexity: ['Sidebar.renderNavSection: 8', 'App.renderTab: separate into components'],
}

function ScoreCircle({ value, max = 100, label, color }: { value: number; max?: number; label: string; color: string }) {
  const pct = Math.round((value / max) * 100)
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex items-center justify-center w-16 h-16">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" className="text-white/5" />
          <circle cx="32" cy="32" r="28" fill="none" stroke={color} strokeWidth="4" strokeDasharray={`${pct * 1.76} 176`} strokeLinecap="round" transform="rotate(-90 32 32)" />
        </svg>
        <span className="text-lg font-bold" style={{ color }}>{pct}</span>
      </div>
      <span className="text-2xs text-txt-muted font-medium uppercase tracking-wider">{label}</span>
    </div>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    critical: { label: 'Critical', cls: 'bg-error/15 text-error border border-error/20' },
    serious: { label: 'Serious', cls: 'bg-warning/15 text-warning border border-warning/20' },
    moderate: { label: 'Moderate', cls: 'bg-dv-gold/15 text-dv-gold border border-dv-gold/20' },
    minor: { label: 'Minor', cls: 'bg-[#4e8cff]/15 text-[#4e8cff] border border-[#4e8cff]/20' },
    pass: { label: 'Pass', cls: 'bg-success/15 text-success border border-success/20' },
  }
  const s = map[severity] || map.minor
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-bold', s.cls)}>{s.label}</span>
}

export default function QualityCenterTab() {
  const [tab, setTab] = useState<QCTab>('accessibility')
  const [filter, setFilter] = useState('')
  const [selectedItem, setSelectedItem] = useState<AuditItem | null>(null)

  const filteredItems = MOCK_AUDIT.filter(i => !filter || i.label.toLowerCase().includes(filter.toLowerCase()) || i.category.toLowerCase().includes(filter.toLowerCase()))

  const critical = MOCK_AUDIT.filter(i => i.severity === 'critical').length
  const serious = MOCK_AUDIT.filter(i => i.severity === 'serious').length
  const moderate = MOCK_AUDIT.filter(i => i.severity === 'moderate').length
  const minor = MOCK_AUDIT.filter(i => i.severity === 'minor').length
  const passes = MOCK_AUDIT.filter(i => i.severity === 'pass').length

  const totalIssues = critical + serious + moderate + minor

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-txt-primary">Quality Center</h2>
          <p className="text-sm text-txt-muted">Автоматический контроль качества, безопасности и производительности</p>
        </div>
        <Button icon={<RefreshCw size={16} />} variant="secondary" onClick={() => {}}>Запустить проверку</Button>
      </div>

      <div className="flex gap-1 bg-surface-2 rounded-lg p-1 overflow-x-auto">
        {([{ id: 'accessibility', label: 'Accessibility', icon: <Accessibility size={15} /> },
          { id: 'performance', label: 'Performance', icon: <Gauge size={15} /> },
          { id: 'security', label: 'Security', icon: <Shield size={15} /> },
          { id: 'code-quality', label: 'Code Quality', icon: <Code size={15} /> },
          { id: 'architecture', label: 'Architecture', icon: <Database size={15} /> },
          { id: 'diagnostics', label: 'Diagnostics', icon: <Search size={15} /> },
        ] as { id: QCTab; label: string; icon: React.ReactNode }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${tab === t.id ? 'bg-surface-1 text-txt-primary shadow-sm' : 'text-txt-muted hover:text-txt-secondary'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'accessibility' && (
          <motion.div key="a11y" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <GlassCard padding="md" className="flex items-center justify-center">
                <ScoreCircle value={70} label="Accessibility" color="#C9A96E" />
              </GlassCard>
              <StatCard label="Critical" value={critical} icon={<XCircle size={18} />} />
              <StatCard label="Serious" value={serious} icon={<AlertTriangle size={18} />} />
              <StatCard label="Moderate" value={moderate} icon={<AlertTriangle size={18} />} />
            </div>
            <div className="flex justify-between items-center">
              <p className="text-xs text-txt-muted">Всего проблем: {totalIssues} · Исправлено: {passes}</p>
              <Input placeholder="Поиск..." value={filter} onChange={e => setFilter(e.target.value)} className="max-w-xs" clearable />
            </div>
            <Card padding="none">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-bdr-subtle">
                      {['Проблема', 'Категория', 'Severity', 'Файл', 'Статус'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-txt-muted uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map(item => (
                      <tr key={item.id} className="border-b border-bdr-subtle/50 cursor-pointer hover:bg-white/[0.02]" onClick={() => setSelectedItem(item)}>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-txt-primary">{item.label}</div>
                          <div className="text-xs text-txt-muted mt-0.5">{item.description}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-txt-muted">{item.category}</td>
                        <td className="px-4 py-3"><SeverityBadge severity={item.severity} /></td>
                        <td className="px-4 py-3 text-xs font-mono text-txt-muted">{item.file}{item.line ? `:${item.line}` : ''}</td>
                        <td className="px-4 py-3">
                          {item.severity === 'pass'
                            ? <CheckCircle size={16} className="text-success" />
                            : <XCircle size={16} className="text-error/60" />}
                        </td>
                      </tr>
                    ))}
                    {filteredItems.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-12 text-center text-txt-muted text-sm">Ничего не найдено</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
            <Modal open={!!selectedItem} onClose={() => setSelectedItem(null)} title={selectedItem?.label || ''} size="lg">
              {selectedItem && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2"><SeverityBadge severity={selectedItem.severity} /><Badge>{selectedItem.category}</Badge></div>
                  <p className="text-sm text-txt-secondary">{selectedItem.description}</p>
                  {selectedItem.file && (
                    <div className="bg-surface-2 rounded-lg p-3 text-xs font-mono text-txt-muted">
                      {selectedItem.file}{selectedItem.line ? `:${selectedItem.line}` : ''}
                    </div>
                  )}
                  {selectedItem.fix && (
                    <div className="bg-success/5 border border-success/20 rounded-lg p-3">
                      <p className="text-xs font-semibold text-success mb-1">Рекомендация по исправлению</p>
                      <p className="text-sm text-txt-primary">{selectedItem.fix}</p>
                    </div>
                  )}
                </div>
              )}
            </Modal>
          </motion.div>
        )}

        {tab === 'performance' && (
          <motion.div key="perf" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <GlassCard padding="md" className="flex items-center justify-center">
                <ScoreCircle value={72} label="Performance" color="#4e8cff" />
              </GlassCard>
              <GlassCard padding="md" className="flex items-center justify-center">
                <ScoreCircle value={68} label="Accessibility" color="#C9A96E" />
              </GlassCard>
              <GlassCard padding="md" className="flex items-center justify-center">
                <ScoreCircle value={81} label="Best Practices" color="#10B981" />
              </GlassCard>
              <GlassCard padding="md" className="flex items-center justify-center">
                <ScoreCircle value={89} label="SEO" color="#A78BFA" />
              </GlassCard>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Bundle Size" value="1.8 MB" icon={<Code size={18} />} />
              <StatCard label="First Paint" value="1.8s" icon={<Gauge size={18} />} />
              <StatCard label="TTI" value="3.2s" icon={<Gauge size={18} />} />
              <StatCard label="Last Check" value="29.07.2026" icon={<RefreshCw size={18} />} />
            </div>
          </motion.div>
        )}

        {tab === 'security' && (
          <motion.div key="sec" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <Card>
              <div className="space-y-4">
                {Object.entries(MOCK_SECURITY).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between py-2 border-b border-bdr-subtle/50 last:border-0">
                    <div>
                      <span className="text-sm font-medium text-txt-primary capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                      <p className="text-xs text-txt-muted mt-0.5">{val.detail}</p>
                    </div>
                    <SeverityBadge severity={val.status} />
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {tab === 'code-quality' && (
          <motion.div key="cq" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="ESLint Errors" value={MOCK_CODE_QUALITY.eslint.errors} icon={<XCircle size={18} />} />
              <StatCard label="ESLint Warnings" value={MOCK_CODE_QUALITY.eslint.warnings} icon={<AlertTriangle size={18} />} />
              <StatCard label="TS Errors" value={MOCK_CODE_QUALITY.typescript.errors} icon={<XCircle size={18} />} />
              <StatCard label="Unused Imports" value={MOCK_CODE_QUALITY.unusedImports} icon={<Code size={18} />} />
            </div>
            <Card title="Крупные компоненты (>300 строк)">
              <ul className="space-y-2">
                {MOCK_CODE_QUALITY.largeComponents.map((c, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-txt-muted"><AlertTriangle size={14} className="text-warning shrink-0" />{c}</li>
                ))}
              </ul>
            </Card>
          </motion.div>
        )}

        {tab === 'architecture' && (
          <motion.div key="arch" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <Card title="Архитектурный анализ">
              <div className="space-y-4 text-sm text-txt-secondary">
                <div className="flex items-start gap-3">
                  <Badge variant="success" dot>OK</Badge>
                  <div><span className="text-txt-primary font-medium">Модульная структура</span><p className="text-xs text-txt-muted">CRM, Shop, School, Diagnostics выделены в под-приложения</p></div>
                </div>
                <div className="flex items-start gap-3">
                  <Badge variant="warning" dot>Review</Badge>
                  <div><span className="text-txt-primary font-medium">Единый index.tsx</span><p className="text-xs text-txt-muted">233 строки — вынести в отдельный файл роутинга</p></div>
                </div>
                <div className="flex items-start gap-3">
                  <Badge variant="warning" dot>Review</Badge>
                  <div><span className="text-txt-primary font-medium">IntelligenceLayout</span><p className="text-xs text-txt-muted">575 строк — разбить на хуки и под-компоненты</p></div>
                </div>
                <div className="flex items-start gap-3">
                  <Badge variant="success" dot>OK</Badge>
                  <div><span className="text-txt-primary font-medium">Zustand store</span><p className="text-xs text-txt-muted">Глобальное состояние через store, нет prop drilling</p></div>
                </div>
                <div className="flex items-start gap-3">
                  <Badge variant="success" dot>OK</Badge>
                  <div><span className="text-txt-primary font-medium">API абстракция</span><p className="text-xs text-txt-muted">Единый apiRequest с авто-refresh токенов</p></div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {tab === 'diagnostics' && (
          <motion.div key="diag" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <Card title="Диагностика системы">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-txt-primary">Подключение к БД</span>
                  <Badge variant="success" dot>Connected</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-txt-primary">API сервер</span>
                  <Badge variant="success" dot>Online</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-txt-primary">WebSocket</span>
                  <Badge variant="success" dot>Active</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-txt-primary">Redis кэш</span>
                  <Badge variant="warning" dot>Not configured</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-txt-primary">CDN</span>
                  <Badge variant="success" dot>Active</Badge>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
