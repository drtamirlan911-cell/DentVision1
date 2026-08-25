import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  Accessibility, Gauge, Code, Database, Search,
  XCircle, AlertTriangle, RefreshCw,
} from 'lucide-react'
import { Card } from '@/components/ui/ds/Card'
import { Button } from '@/components/ui/ds/Button'
import { Input } from '@/components/ui/ds/Input'
import { Badge } from '@/components/ui/ds/Badge'
import { StatCard } from '@/components/ui/ds/StatCard'
import { Modal } from '@/components/ui/ds/Modal'
import { getSystemHealth, runQualityScan, type QualityIssue } from '@/utils/api'

type QCTab = 'accessibility' | 'performance' | 'code-quality' | 'architecture' | 'diagnostics'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    critical: { label: 'Critical', cls: 'bg-error/15 text-error border border-error/20' },
    serious: { label: 'Serious', cls: 'bg-warning/15 text-warning border border-warning/20' },
    moderate: { label: 'Moderate', cls: 'bg-dv-gold/15 text-dv-gold border border-dv-gold/20' },
    minor: { label: 'Minor', cls: 'bg-[#4e8cff]/15 text-[#4e8cff] border border-[#4e8cff]/20' },
  }
  const s = map[severity] || map.minor
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-bold', s.cls)}>{s.label}</span>
}

function StatusBadge({ status, okLabel, errorLabel, notConfiguredLabel }: { status: 'ok' | 'error' | 'not_configured'; okLabel: string; errorLabel: string; notConfiguredLabel?: string }) {
  if (status === 'ok') return <Badge variant="success" dot>{okLabel}</Badge>
  if (status === 'not_configured') return <Badge variant="warning" dot>{notConfiguredLabel || 'Не настроен'}</Badge>
  return <Badge variant="error" dot>{errorLabel}</Badge>
}

function IssueTable({ items, filter, onSelect }: { items: QualityIssue[]; filter: string; onSelect: (i: QualityIssue) => void }) {
  const filtered = items.filter(i => !filter || i.label.toLowerCase().includes(filter.toLowerCase()) || i.file.toLowerCase().includes(filter.toLowerCase()))
  return (
    <Card padding="none">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-bdr-subtle">
              {['Проблема', 'Severity', 'Файл'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold text-txt-muted uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => (
              <tr key={item.id} className="border-b border-bdr-subtle/50 cursor-pointer hover:bg-surface-1" onClick={() => onSelect(item)}>
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-txt-primary">{item.label}</div>
                  <div className="text-xs text-txt-muted mt-0.5">{item.description}</div>
                </td>
                <td className="px-4 py-3"><SeverityBadge severity={item.severity} /></td>
                <td className="px-4 py-3 text-xs font-mono text-txt-muted">{item.file}{item.line ? `:${item.line}` : ''}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-12 text-center text-txt-muted text-sm">Ничего не найдено</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export default function QualityCenterTab() {
  const [tab, setTab] = useState<QCTab>('accessibility')
  const [filter, setFilter] = useState('')
  const [selectedItem, setSelectedItem] = useState<QualityIssue | null>(null)

  const scan = useMutation({ mutationFn: () => runQualityScan() })
  const health = useQuery({
    queryKey: ['quality', 'health'],
    queryFn: () => getSystemHealth(),
    staleTime: 15_000,
    refetchInterval: 30_000,
  })

  const items = scan.data?.items || []
  const a11yItems = items.filter(i => i.category === 'Accessibility')
  const codeItems = items.filter(i => i.category === 'Code Quality')

  const countBy = (list: QualityIssue[], sev: string) => list.filter(i => i.severity === sev).length

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-txt-primary">Quality Center</h2>
          <p className="text-sm text-txt-muted">Контроль качества, доступности и состояния системы на реальных данных</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {scan.data && (
            <span className="text-xs text-txt-muted">Проверено: {new Date(scan.data.scannedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
          )}
          <Button icon={<RefreshCw size={16} className={scan.isPending ? 'animate-spin' : undefined} />} variant="secondary" loading={scan.isPending} onClick={() => scan.mutate()} className="min-h-11">
            {scan.isPending ? 'Проверка…' : 'Запустить проверку'}
          </Button>
        </div>
      </div>

      <div className="flex gap-1 bg-surface-2 rounded-lg p-1 overflow-x-auto">
        {([{ id: 'accessibility', label: 'Accessibility', icon: <Accessibility size={15} /> },
          { id: 'performance', label: 'Performance', icon: <Gauge size={15} /> },
          { id: 'code-quality', label: 'Code Quality', icon: <Code size={15} /> },
          { id: 'architecture', label: 'Architecture', icon: <Database size={15} /> },
          { id: 'diagnostics', label: 'Diagnostics', icon: <Search size={15} /> },
        ] as { id: QCTab; label: string; icon: React.ReactNode }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 min-h-11 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${tab === t.id ? 'bg-surface-1 text-txt-primary shadow-sm' : 'text-txt-muted hover:text-txt-secondary'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'accessibility' && (
          <motion.div key="a11y" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
            {!scan.data && !scan.isPending ? (
              <Card><p className="text-sm text-txt-muted text-center py-8">Нажмите «Запустить проверку», чтобы просканировать доступность интерфейса</p></Card>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <StatCard label="Critical" value={countBy(a11yItems, 'critical')} icon={<XCircle size={18} />} />
                  <StatCard label="Serious" value={countBy(a11yItems, 'serious')} icon={<AlertTriangle size={18} />} />
                  <StatCard label="Moderate" value={countBy(a11yItems, 'moderate')} icon={<AlertTriangle size={18} />} />
                </div>
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <p className="text-xs text-txt-muted">Найдено проблем: {a11yItems.length}</p>
                  <Input placeholder="Поиск..." value={filter} onChange={e => setFilter(e.target.value)} className="w-full sm:max-w-xs min-h-11" clearable />
                </div>
                <IssueTable items={a11yItems} filter={filter} onSelect={setSelectedItem} />
              </>
            )}
            <Modal open={!!selectedItem} onClose={() => setSelectedItem(null)} title={selectedItem?.label || ''} size="lg">
              {selectedItem && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2"><SeverityBadge severity={selectedItem.severity} /><Badge>{selectedItem.category}</Badge></div>
                  <p className="text-sm text-txt-secondary">{selectedItem.description}</p>
                  <div className="bg-surface-2 rounded-lg p-3 text-xs font-mono text-txt-muted">
                    {selectedItem.file}{selectedItem.line ? `:${selectedItem.line}` : ''}
                  </div>
                </div>
              )}
            </Modal>
          </motion.div>
        )}

        {tab === 'performance' && (
          <motion.div key="perf" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <StatCard
                label="Размер сборки (dist/)"
                value={scan.data ? (scan.data.bundleSizeBytes !== null ? formatBytes(scan.data.bundleSizeBytes) : 'Нет сборки') : '—'}
                icon={<Code size={18} />}
              />
              <StatCard label="Последняя проверка" value={scan.data ? new Date(scan.data.scannedAt).toLocaleString('ru-RU') : '—'} icon={<RefreshCw size={18} />} />
            </div>
            <Card title="Lighthouse-метрики">
              <p className="text-sm text-txt-muted">
                Недоступно — требуется настройка Lighthouse CI в пайплайне сборки. Показатели Performance/Accessibility/Best Practices/SEO,
                First Paint и Time to Interactive не измеряются на бэкенде и не могут быть честно посчитаны без реального прогона.
              </p>
            </Card>
          </motion.div>
        )}

        {tab === 'code-quality' && (
          <motion.div key="cq" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-6">
            {!scan.data && !scan.isPending ? (
              <Card><p className="text-sm text-txt-muted text-center py-8">Нажмите «Запустить проверку», чтобы просканировать код</p></Card>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <StatCard label="Critical" value={countBy(codeItems, 'critical')} icon={<XCircle size={18} />} />
                  <StatCard label="Крупные компоненты" value={codeItems.filter(i => i.id.startsWith('size:')).length} icon={<Code size={18} />} />
                  <StatCard label="console.log в коде" value={codeItems.filter(i => i.id.startsWith('console:')).length} icon={<AlertTriangle size={18} />} />
                </div>
                <p className="text-xs text-txt-muted">
                  Быстрая файловая проверка (крупные компоненты, отладочный вывод). TypeScript/ESLint-проверки не запускаются здесь — они слишком медленные для запроса из UI; используйте `npx tsc --noEmit` / `npx eslint` в CI.
                </p>
                <IssueTable items={codeItems} filter={filter} onSelect={setSelectedItem} />
              </>
            )}
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
              {health.isLoading && <p className="text-sm text-txt-muted">Проверка...</p>}
              {health.isError && <p className="text-sm text-error">Не удалось получить статус сервера</p>}
              {health.data && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-txt-primary">Подключение к БД{health.data.checks.database.latencyMs !== undefined ? ` (${health.data.checks.database.latencyMs} мс)` : ''}</span>
                    <StatusBadge status={health.data.checks.database.status} okLabel="Connected" errorLabel="Error" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-txt-primary">API сервер</span>
                    <Badge variant="success" dot>Online</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-txt-primary">Realtime (SSE), активных подключений: {health.data.checks.realtime.activeConnections}</span>
                    <Badge variant="success" dot>Active</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-txt-primary">Redis кэш{health.data.checks.redis.latencyMs !== undefined ? ` (${health.data.checks.redis.latencyMs} мс)` : ''}</span>
                    <StatusBadge status={health.data.checks.redis.status} okLabel="Connected" errorLabel="Error" notConfiguredLabel="Не настроен" />
                  </div>
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
