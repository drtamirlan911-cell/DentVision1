import React, { useCallback, useEffect, useState } from 'react'
import {
  BarChart3, TrendingUp, TrendingDown, Users, Building2, GraduationCap,
  Store, RefreshCw, ShieldCheck, Lock, Zap, AlertTriangle, CheckCircle2,
  Ban, CalendarPlus, DollarSign, Target, Activity, Brain,
} from 'lucide-react'
import { useAuth } from '@/store/auth.store'
import { Button } from '@/components/ui/ds/Button'
import { Input } from '@/components/ui/ds/Input'
import { Card, CardContent } from '@/components/ui/ds/Card'
import { Badge } from '@/components/ui/ds/Badge'
import { StatCard, PageHeader } from '@/components/ui/ds/StatCard'
import { GlassCard } from '@/components/ui/ds/GlassCard'
import { useToast } from '@/components/ui/ds/Toast'
import * as api from '@/utils/api'

function isSuperAdminUser(user: { role?: string; platformRole?: string } | null | undefined): boolean {
  return String(user?.role || user?.platformRole || '').toLowerCase() === 'superadmin'
}

function fmtMoney(n: number | string | undefined): string {
  return Number(n || 0).toLocaleString('ru-RU') + ' ₸'
}

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—'
  return String(d).slice(0, 10)
}

function fmtPct(n: number | undefined): string {
  const v = Number(n || 0)
  return (v > 0 ? '+' : '') + v.toFixed(1) + '%'
}

type Tab = 'dashboard' | 'cfo' | 'command'

const OPS_KEY_SESSION = 'dv_ops_key'

// ─── Command Center constants (moved from HiddenSupplierOps) ───

const SUPPLIER_FLOW: Record<string, string[]> = {
  PENDING: ['DOCUMENTS_REVIEW', 'SUSPENDED'],
  DOCUMENTS_REVIEW: ['VERIFIED', 'PENDING', 'SUSPENDED'],
  VERIFIED: ['OFFICIAL_PARTNER', 'SUSPENDED'],
  OFFICIAL_PARTNER: ['SUSPENDED'],
  SUSPENDED: ['VERIFIED', 'PENDING'],
}
const SUPPLIER_LABEL: Record<string, string> = {
  PENDING: 'Ожидает', DOCUMENTS_REVIEW: 'Документы', VERIFIED: 'Подтверждён',
  OFFICIAL_PARTNER: 'Партнёр', SUSPENDED: 'Стоп',
}
const LEVEL_FLOW: Record<string, string[]> = {
  NEW: ['VERIFIED'], VERIFIED: ['EXPERT', 'NEW'], EXPERT: ['INTERNATIONAL_SPEAKER', 'VERIFIED'],
  INTERNATIONAL_SPEAKER: ['EXPERT'],
}
const LEVEL_LABEL: Record<string, string> = {
  NEW: 'Новый', VERIFIED: 'Проверен', EXPERT: 'Эксперт', INTERNATIONAL_SPEAKER: 'Международный',
}
const PLANS = ['demo', 'starter', 'pro', 'enterprise'] as const

type CommandTab = 'overview' | 'clinics' | 'school' | 'suppliers'

/**
 * Business Intelligence Hub — unified financial center.
 * Integrates BI Dashboard + AI CFO + Command Center (superadmin only).
 */
export default function BIWorkspace() {
  const { user } = useAuth()
  const toast = useToast()
  const isSuper = isSuperAdminUser(user)

  const [tab, setTab] = useState<Tab>('dashboard')
  const [loading, setLoading] = useState(false)

  // ─── BI Data ───
  const [dashboard, setDashboard] = useState<any>(null)

  // ─── Command Center Data ───
  const [gateKey, setGateKey] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [commandTab, setCommandTab] = useState<CommandTab>('overview')
  const [overview, setOverview] = useState<any>(null)
  const [clinics, setClinics] = useState<any[]>([])
  const [school, setSchool] = useState<any>(null)
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [memberEmail, setMemberEmail] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  // ─── AI CFO Chat ───
  const [cfoMessages, setCfoMessages] = useState<Array<{ role: 'user' | 'cfo'; text: string }>>([])
  const [cfoInput, setCfoInput] = useState('')
  const [cfoLoading, setCfoLoading] = useState(false)

  // ─── Loaders ───

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.biDashboard()
      setDashboard(data)
    } catch {
      toast.error('Ошибка загрузки BI данных')
    } finally {
      setLoading(false)
    }
  }, [toast])

  const lock = useCallback(() => {
    try { sessionStorage.removeItem(OPS_KEY_SESSION) } catch { /* ignore */ }
    setUnlocked(false)
    setOverview(null)
    setClinics([])
    setSchool(null)
    setSuppliers([])
    setGateKey('')
  }, [])

  const loadOverview = useCallback(async () => {
    const data = await api.opsOverview()
    setOverview(data)
  }, [])

  const loadClinics = useCallback(async () => {
    const data = await api.opsListClinics()
    setClinics(Array.isArray(data) ? data : [])
  }, [])

  const loadSchool = useCallback(async () => {
    setSchool(await api.opsSchool())
  }, [])

  const loadSuppliers = useCallback(async () => {
    const data = await api.opsListSuppliers()
    const list = Array.isArray(data) ? data : (data?.data || [])
    setSuppliers(Array.isArray(list) ? list : [])
  }, [])

  const refreshCommand = useCallback(async () => {
    setLoading(true)
    try {
      if (commandTab === 'overview') await loadOverview()
      else if (commandTab === 'clinics') await loadClinics()
      else if (commandTab === 'school') await loadSchool()
      else await loadSuppliers()
    } catch {
      toast.error('Нет доступа')
      lock()
    } finally {
      setLoading(false)
    }
  }, [commandTab, loadOverview, loadClinics, loadSchool, loadSuppliers, toast, lock])

  // ─── Effects ───

  useEffect(() => {
    if (tab === 'dashboard' && !dashboard) loadDashboard()
  }, [tab, dashboard, loadDashboard])

  useEffect(() => {
    try {
      const existing = sessionStorage.getItem(OPS_KEY_SESSION)
      if (existing) { setUnlocked(true); setGateKey(existing) }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (isSuper && unlocked && tab === 'command') void refreshCommand()
  }, [isSuper, unlocked, tab, commandTab, refreshCommand])

  // ─── Command Center helpers ───

  const unlock = () => {
    const key = gateKey.trim()
    if (key.length < 24) { toast.error('Неверный ключ'); return }
    try { sessionStorage.setItem(OPS_KEY_SESSION, key) } catch { /* ignore */ }
    setUnlocked(true)
  }

  const run = async (id: string, fn: () => Promise<void>, okMsg: string) => {
    setBusy(id)
    try {
      await fn()
      toast.success(okMsg)
      await refreshCommand()
      if (commandTab !== 'overview') await loadOverview().catch(() => null)
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка')
    } finally {
      setBusy(null)
    }
  }

  // ─── AI CFO ───

  const sendCfoMessage = async () => {
    const text = cfoInput.trim()
    if (!text) return
    setCfoInput('')
    setCfoMessages((m) => [...m, { role: 'user', text }])
    setCfoLoading(true)
    try {
      const data = await api.aiChat(text)
      setCfoMessages((m) => [...m, { role: 'cfo', text: data.reply || 'Нет ответа' }])
    } catch {
      setCfoMessages((m) => [...m, { role: 'cfo', text: 'Ошибка связи с AI CFO' }])
    } finally {
      setCfoLoading(false)
    }
  }

  // ─── Render ───

  const d = dashboard
  const stats = overview?.stats || {}
  const queues = overview?.queues || {}

  const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode; superOnly?: boolean }> = [
    { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 size={16} /> },
    { id: 'cfo', label: 'AI CFO', icon: <Brain size={16} /> },
    ...(isSuper ? [{ id: 'command' as Tab, label: 'Command Center', icon: <ShieldCheck size={16} />, superOnly: true }] : []),
  ]

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
      <PageHeader
        title="Business Intelligence"
        subtitle="Финансовая аналитика · Unit Economics · AI CFO · Command Center"
        icon={<BarChart3 size={20} />}
        actions={
          <Button size="sm" variant="secondary" icon={<RefreshCw size={14} />}
            onClick={tab === 'dashboard' ? loadDashboard : refreshCommand}
            disabled={loading}>
            Обновить
          </Button>
        }
      />

      {/* ─── Tab Bar ─── */}
      <div className="flex gap-1 border-b border-white/[0.06]">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id ? 'border-[#C9A96E] text-[#C9A96E]' : 'border-transparent text-[#7A8899] hover:text-white'
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ─── DASHBOARD TAB ─── */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {tab === 'dashboard' && (
        <div className="space-y-4">
          {loading && !d ? (
            <p className="text-sm text-txt-muted py-16 text-center">Загрузка…</p>
          ) : d ? (
            <>
              {/* SaaS Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="MRR" value={fmtMoney(d.mrr?.mrr)} icon={<DollarSign size={18} />}
                  change={d.mrr?.mrrGrowthPct ? { value: d.mrr.mrrGrowthPct, positive: d.mrr.mrrGrowthPct > 0 } : undefined} />
                <StatCard label="ARR" value={fmtMoney(d.mrr?.arr)} icon={<TrendingUp size={18} />} />
                <StatCard label="Churn Rate" value={`${d.churn?.churnRate?.toFixed(1) || 0}%`} icon={<Activity size={18} />}
                  change={d.churn?.netGrowth !== undefined ? { value: d.churn.netGrowth, positive: d.churn.netGrowth > 0 } : undefined} />
                <StatCard label="LTV / CAC" value={`${d.ltv?.ltvCacRatio?.toFixed(1) || 0}x`} icon={<Target size={18} />} />
              </div>

              {/* Unit Economics */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-txt-primary mb-3">Unit Economics (30 дней)</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      ['Выручка/клиника', fmtMoney(d.unitEconomics?.revenuePerClinic)],
                      ['Выручка/доктор', fmtMoney(d.unitEconomics?.revenuePerDoctor)],
                      ['Выручка/пациент', fmtMoney(d.unitEconomics?.revenuePerPatient)],
                      ['Выручка/AI запрос', fmtMoney(d.unitEconomics?.revenuePerAiRequest)],
                    ].map(([label, value]) => (
                      <div key={label} className="text-center">
                        <p className="text-lg font-bold text-txt-primary">{value}</p>
                        <p className="text-[10px] text-txt-muted">{label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <p className={`text-lg font-bold ${d.unitEconomics?.grossMargin >= 50 ? 'text-green-400' : 'text-yellow-400'}`}>
                        {d.unitEconomics?.grossMargin || 0}%
                      </p>
                      <p className="text-[10px] text-txt-muted">Валовая маржа</p>
                    </div>
                    <div className="text-center">
                      <p className={`text-lg font-bold ${(d.unitEconomics?.netMargin || 0) >= 20 ? 'text-green-400' : 'text-red-400'}`}>
                        {d.unitEconomics?.netMargin || 0}%
                      </p>
                      <p className="text-[10px] text-txt-muted">Чистая маржа</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-txt-primary">{fmtMoney(d.unitEconomics?.netProfit)}</p>
                      <p className="text-[10px] text-txt-muted">Чистая прибыль</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* SaaS Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xl font-bold text-txt-primary">{d.mrr?.activeClinics || 0}</p>
                    <p className="text-[10px] text-txt-muted">Активные клиники</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xl font-bold text-txt-primary">{d.mrr?.activeDoctors || 0}</p>
                    <p className="text-[10px] text-txt-muted">Доктора</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xl font-bold text-txt-primary">{d.mrr?.payingUsers || 0}</p>
                    <p className="text-[10px] text-txt-muted">Платящие</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-xl font-bold text-txt-primary">{d.mrr?.conversionRate?.toFixed(1) || 0}%</p>
                    <p className="text-[10px] text-txt-muted">Конверсия</p>
                  </CardContent>
                </Card>
              </div>

              {/* Cash Flow */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-txt-primary mb-3">Cash Flow — 12 месяцев</h3>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="text-center">
                      <p className="text-lg font-bold text-green-400">{fmtMoney(d.cashFlow?.totalRevenue)}</p>
                      <p className="text-[10px] text-txt-muted">Общая выручка</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-red-400">{fmtMoney(d.cashFlow?.totalCosts)}</p>
                      <p className="text-[10px] text-txt-muted">Общие затраты</p>
                    </div>
                    <div className="text-center">
                      <p className={`text-lg font-bold ${(d.cashFlow?.totalProfit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {fmtMoney(d.cashFlow?.totalProfit)}
                      </p>
                      <p className="text-[10px] text-txt-muted">Итого прибыль</p>
                    </div>
                  </div>
                  {d.cashFlow?.breakEvenMonth && (
                    <p className="text-xs text-txt-muted text-center">
                      Точка безубыточности: <span className="text-dv-gold font-medium">{d.cashFlow.breakEvenMonth}</span>
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Scenarios */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-txt-primary mb-3">Прогноз — 3 сценария</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      ['Оптимистичный', d.scenarios?.optimistic?.[11]?.cumulative, 'green', d.scenarios?.breakEven?.optimistic],
                      ['Базовый', d.scenarios?.base?.[11]?.cumulative, 'blue', d.scenarios?.breakEven?.base],
                      ['Пессимистичный', d.scenarios?.worst?.[11]?.cumulative, 'red', d.scenarios?.breakEven?.worst],
                    ].map(([label, val, color, breakEven]) => (
                      <div key={String(label)} className="text-center">
                        <p className={`text-lg font-bold ${color === 'green' ? 'text-green-400' : color === 'red' ? 'text-red-400' : 'text-blue-400'}`}>
                          {fmtMoney(val)}
                        </p>
                        <p className="text-[10px] text-txt-muted">{String(label)}</p>
                        {breakEven && <p className="text-[9px] text-txt-muted">Безубыточность: {String(breakEven)}</p>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Partner ROI */}
              {d.partnerROI && d.partnerROI.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold text-txt-primary mb-3">Partner ROI</h3>
                    <div className="space-y-2">
                      {d.partnerROI.map((p: any) => (
                        <div key={p.partnerId} className="flex items-center justify-between text-xs border border-white/[0.05] rounded-lg px-3 py-2">
                          <div>
                            <span className="text-txt-primary font-medium">{p.partnerType}</span>
                            <span className="text-txt-muted ml-2">{p.sales} продаж</span>
                          </div>
                          <div className="text-right">
                            <span className={`font-medium ${p.roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              ROI {p.roi.toFixed(1)}%
                            </span>
                            <span className="text-txt-muted ml-2">{fmtMoney(p.turnover)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ─── AI CFO TAB ─── */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {tab === 'cfo' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Brain size={16} className="text-dv-gold" />
                <h3 className="text-sm font-semibold text-txt-primary">AI CFO Agent</h3>
              </div>
              <p className="text-xs text-txt-muted mb-4">
                Задайте вопрос по финансам или получите ежедневный брифинг
              </p>
              <div className="flex gap-2 mb-4">
                <Button size="sm" onClick={() => { setCfoInput('Дай ежедневный брифинг'); }}
                  disabled={cfoLoading}>
                  Ежедневный брифинг
                </Button>
                <Button size="sm" variant="secondary" onClick={() => { setCfoInput('Проанализируй MRR и churn'); }}
                  disabled={cfoLoading}>
                  Анализ MRR
                </Button>
                <Button size="sm" variant="secondary" onClick={() => { setCfoInput('Прогноз на 12 месяцев'); }}
                  disabled={cfoLoading}>
                  Прогноз
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="max-h-[400px] overflow-auto space-y-2">
                {cfoMessages.length === 0 && (
                  <p className="text-xs text-txt-muted text-center py-8">Начните диалог с AI CFO</p>
                )}
                {cfoMessages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-dv-gold/20 text-txt-primary'
                        : 'bg-white/[0.06] text-txt-primary'
                    }`}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {cfoLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white/[0.06] rounded-xl px-3 py-2 text-xs text-txt-muted">
                      AI CFO думает…
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Input value={cfoInput} onChange={(e) => setCfoInput(e.target.value)}
                  placeholder="Вопрос AI CFO…"
                  onKeyDown={(e) => e.key === 'Enter' && sendCfoMessage()}
                  className="flex-1" />
                <Button onClick={sendCfoMessage} disabled={cfoLoading || !cfoInput.trim()}>Отправить</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ─── COMMAND CENTER TAB (superadmin only) ─── */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {tab === 'command' && isSuper && (
        <div className="space-y-4">
          {!unlocked ? (
            <Card className="max-w-md mx-auto">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2 text-txt-primary">
                  <Lock size={18} className="text-dv-gold" />
                  <h2 className="text-sm font-semibold">Platform Ops — Access Key</h2>
                </div>
                <Input type="password" autoComplete="off" spellCheck={false} label="Access key"
                  value={gateKey} onChange={(e) => setGateKey(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && unlock()} />
                <Button className="w-full" onClick={unlock}>Continue</Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-dv-gold" />
                  <div>
                    <h2 className="text-sm font-semibold text-txt-primary">Platform Ops Command Center</h2>
                    <p className="text-xs text-txt-muted">Скрытый контур · подписки · school · поставщики</p>
                  </div>
                </div>
                <Button size="sm" variant="danger" onClick={lock}>Lock</Button>
              </div>

              <div className="flex gap-1 border-b border-white/[0.06]">
                {([
                  { id: 'overview' as CommandTab, label: 'Command', icon: <Zap size={14} />, badge: overview?.attentionCount || 0 },
                  { id: 'clinics' as CommandTab, label: 'Клиники', icon: <Building2 size={14} /> },
                  { id: 'school' as CommandTab, label: 'School', icon: <GraduationCap size={14} /> },
                  { id: 'suppliers' as CommandTab, label: 'Поставщики', icon: <Store size={14} /> },
                ]).map((t) => (
                  <button key={t.id} onClick={() => setCommandTab(t.id)}
                    className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
                      commandTab === t.id ? 'border-[#C9A96E] text-[#C9A96E]' : 'border-transparent text-[#7A8899] hover:text-white'
                    }`}>
                    {t.icon}{t.label}
                    {!!t.badge && t.badge > 0 && (
                      <span className="ml-1 rounded-full bg-red-500/20 text-red-300 px-1.5 text-[10px]">{t.badge}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Command Overview */}
              {commandTab === 'overview' && overview && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {[
                      ['Клиники', stats.activeClinics, `${stats.blockedClinics || 0} блок.`],
                      ['MRR', fmtMoney(stats.mrr), 'подписки'],
                      ['Юзеры', stats.users, ''],
                      ['Поставщики', `${stats.verifiedSuppliers}/${stats.suppliers}`, 'verified'],
                      ['Лекторы', stats.lecturers, ''],
                      ['Курсы', stats.courses, ''],
                    ].map(([label, value, sub]) => (
                      <Card key={String(label)}>
                        <CardContent className="p-3">
                          <p className="text-[10px] uppercase tracking-wide text-txt-muted">{label}</p>
                          <p className="text-lg font-semibold text-txt-primary mt-0.5">{value as any}</p>
                          {sub ? <p className="text-[10px] text-txt-muted">{sub}</p> : null}
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Zap size={16} className="text-dv-gold" />
                        <p className="text-sm font-semibold text-txt-primary">Автоматизации (one-click)</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" disabled={!!busy}
                          onClick={() => run('auto-sup', async () => { await api.opsAutoAdvanceSuppliers(false) }, 'Поставщики с документами → на проверку')}>
                          Поставщики: в ревью
                        </Button>
                        <Button size="sm" variant="primary" disabled={!!busy}
                          onClick={() => run('auto-sup-v', async () => { await api.opsAutoAdvanceSuppliers(true) }, 'Поставщики в ревью → VERIFIED')}>
                          Поставщики: подтвердить ревью
                        </Button>
                        <Button size="sm" disabled={!!busy}
                          onClick={() => run('auto-lec', async () => { await api.opsAutoVerifyLecturers() }, 'Лекторы с документами → VERIFIED')}>
                          School: верифицировать NEW
                        </Button>
                        <Button size="sm" disabled={!!busy}
                          onClick={() => run('auto-ext', async () => { await api.opsAutoExtendClinics(1) }, 'Истекающие клиники +1 мес')}>
                          Клиники: продлить истекающие +1м
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid md:grid-cols-3 gap-3">
                    <QueueCard title="Поставщики на проверке" icon={<Store size={14} />}
                      onOpen={() => setCommandTab('suppliers')}
                      items={(queues.suppliersPending || []).map((s: any) => ({
                        id: s.id, title: s.name, meta: `${s.status} · docs ${s._count?.documents || 0}`,
                      }))} />
                    <QueueCard title="Новые лекторы" icon={<GraduationCap size={14} />}
                      onOpen={() => setCommandTab('school')}
                      items={(queues.lecturersNew || []).map((l: any) => ({
                        id: l.id,
                        title: l.name || 'Лектор',
                        meta: `${l.academy?.name || 'Без академии'} · docs ${l._count?.verifications || 0} · courses ${l._count?.courses || 0}`,
                      }))} />
                    <QueueCard title="Подписки истекают" icon={<AlertTriangle size={14} />}
                      onOpen={() => setCommandTab('clinics')}
                      items={(queues.clinicsExpiring || []).map((s: any) => ({
                        id: s.id, title: s.clinic?.name || s.ownerId.slice(0, 8),
                        meta: `до ${fmtDate(s.periodEnd)} · ${s.plan}`,
                      }))} />
                  </div>
                </div>
              )}

              {/* Command Clinics */}
              {commandTab === 'clinics' && (
                <div className="space-y-3">
                  {clinics.length === 0 ? (
                    <p className="text-sm text-txt-muted py-10 text-center">Нет клиник</p>
                  ) : clinics.map((c) => (
                    <Card key={c.id}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-txt-primary">{c.name}</p>
                            <p className="text-xs text-txt-muted mt-0.5">
                              {c.city || '—'} · {c.members} staff · {c.patients} patients · до {fmtDate(c.subscription?.periodEnd)}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant={c.active ? 'success' : 'outline'}>{c.active ? 'Active' : 'Suspended'}</Badge>
                            <Badge variant="gold">{c.plan}</Badge>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 items-center">
                          <select
                            className="dv-select !w-auto h-8 px-2 text-xs"
                            value={String(c.plan || 'DEMO').toLowerCase() === 'standard' ? 'starter' : String(c.plan || 'demo').toLowerCase()}
                            onChange={(e) => run(`plan-${c.id}`, async () => { await api.opsClinicPlan(c.id, e.target.value) }, 'План обновлён')}
                          >
                            {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                          </select>
                          <Button size="sm" variant="secondary" icon={<CalendarPlus size={13} />} disabled={busy === `ext-${c.id}`}
                            onClick={() => run(`ext-${c.id}`, async () => { await api.opsClinicExtend(c.id, 1) }, '+1 месяц')}>+1м</Button>
                          <Button size="sm" variant="secondary" disabled={busy === `ext3-${c.id}`}
                            onClick={() => run(`ext3-${c.id}`, async () => { await api.opsClinicExtend(c.id, 3) }, '+3 месяца')}>+3м</Button>
                          {c.active ? (
                            <Button size="sm" variant="danger" icon={<Ban size={13} />} disabled={busy === `sus-${c.id}`}
                              onClick={() => run(`sus-${c.id}`, async () => { await api.opsClinicSuspend(c.id) }, 'Клиника приостановлена')}>Suspend</Button>
                          ) : (
                            <Button size="sm" variant="primary" icon={<CheckCircle2 size={13} />} disabled={busy === `act-${c.id}`}
                              onClick={() => run(`act-${c.id}`, async () => { await api.opsClinicActivate(c.id) }, 'Клиника активирована')}>Activate</Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Command School */}
              {commandTab === 'school' && school && (
                <div className="space-y-4">
                  <p className="text-xs text-txt-muted">Академий: {school.academies?.length || 0} · Лекторов: {school.lecturers?.length || 0} · Курсов: {school.courseCount || 0}</p>
                  {(school.lecturers || []).map((l: any) => (
                    <Card key={l.id}>
                      <CardContent className="p-4 space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-txt-primary">{l.name || 'Лектор'}</p>
                            <p className="text-xs text-txt-muted">{l.email || '—'} · {l.academy?.name || 'Без академии'}</p>
                          </div>
                          <Badge variant={l.level === 'NEW' ? 'gold' : 'success'}>{LEVEL_LABEL[l.level] || l.level}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(LEVEL_FLOW[l.level] || []).map((next) => (
                            <Button key={next} size="sm" variant={next === 'VERIFIED' || next === 'EXPERT' ? 'primary' : 'secondary'}
                              disabled={busy === `lvl-${l.id}-${next}`}
                              onClick={() => run(`lvl-${l.id}-${next}`, async () => { await api.opsLecturerLevel(l.id, next) }, `Level → ${LEVEL_LABEL[next]}`)}>
                              → {LEVEL_LABEL[next] || next}
                            </Button>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Command Suppliers */}
              {commandTab === 'suppliers' && (
                <div className="space-y-3">
                  {suppliers.length === 0 ? (
                    <p className="text-sm text-txt-muted py-10 text-center">No suppliers</p>
                  ) : suppliers.map((s) => (
                    <Card key={s.id}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-txt-primary truncate">{s.name}</p>
                            <p className="text-xs text-txt-muted mt-0.5">{s.email || '—'}</p>
                          </div>
                          <Badge variant={s.status === 'VERIFIED' || s.status === 'OFFICIAL_PARTNER' ? 'success' : 'gold'}>
                            {SUPPLIER_LABEL[s.status] || s.status}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(SUPPLIER_FLOW[s.status] || []).map((next) => (
                            <Button key={next} size="sm"
                              variant={next === 'VERIFIED' || next === 'OFFICIAL_PARTNER' ? 'primary' : 'secondary'}
                              disabled={busy === `st-${s.id}-${next}`}
                              onClick={() => run(`st-${s.id}-${next}`, async () => { await api.opsSetSupplierStatus(s.id, next) }, `Статус → ${SUPPLIER_LABEL[next]}`)}>
                              → {SUPPLIER_LABEL[next] || next}
                            </Button>
                          ))}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 items-end">
                          <div className="flex-1 w-full">
                            <Input label="Привязать пользователя (email)" value={memberEmail[s.id] || ''}
                              onChange={(e) => setMemberEmail((m) => ({ ...m, [s.id]: e.target.value }))}
                              placeholder="seller@example.com" />
                          </div>
                          <Button size="sm" disabled={busy === `mem-${s.id}`}
                            onClick={() => run(`mem-${s.id}`, async () => {
                              const email = (memberEmail[s.id] || '').trim()
                              if (!email) throw new Error('Email обязателен')
                              await api.opsAddSupplierMember(s.id, { email, role: 'owner' })
                              setMemberEmail((m) => ({ ...m, [s.id]: '' }))
                            }, 'Пользователь привязан')}>
                            Привязать
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Queue Card (shared component) ───

function QueueCard({ title, icon, items, onOpen }: {
  title: string
  icon: React.ReactNode
  items: Array<{ id: string; title: string; meta: string }>
  onOpen?: () => void
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <button type="button" onClick={onOpen}
          className="w-full flex items-center gap-2 text-txt-primary text-left hover:opacity-90">
          {icon}
          <p className="text-xs font-semibold flex-1">{title}</p>
          <Badge size="xs" variant="outline">{items.length}</Badge>
        </button>
        {items.length === 0 ? (
          <p className="text-xs text-txt-muted py-2">Пусто</p>
        ) : (
          <ul className="space-y-2 max-h-56 overflow-auto">
            {items.map((it) => (
              <li key={it.id} className="text-xs border border-white/[0.05] rounded-lg px-2 py-1.5 cursor-pointer hover:bg-white/[0.03]"
                onClick={onOpen}>
                <p className="text-txt-primary font-medium truncate">{it.title}</p>
                <p className="text-txt-muted">{it.meta}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
