import React, { useCallback, useEffect, useState } from 'react'
import {
  ShieldCheck, Lock, RefreshCw, Building2, GraduationCap, Store,
  Zap, AlertTriangle, CheckCircle2, Ban, CalendarPlus,
} from 'lucide-react'
import { useAuth } from '@/store/auth.store'
import { Button } from '@/components/ui/ds/Button'
import { Input } from '@/components/ui/ds/Input'
import { Card, CardContent } from '@/components/ui/ds/Card'
import { Badge } from '@/components/ui/ds/Badge'
import { useToast } from '@/components/ui/ds/Toast'
import * as api from '@/utils/api'

const OPS_KEY_SESSION = 'dv_ops_key'

type Tab = 'overview' | 'clinics' | 'school' | 'suppliers'

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

/**
 * Platform Ops Command Center — Kaspi/Apple-style inbox + domain control.
 * Hidden URL /x-ops/sg · SUPERADMIN + PLATFORM_OPS_SECRET
 */
export default function PlatformOpsCommandCenter() {
  const { user } = useAuth()
  const toast = useToast()
  const isSuper = isSuperAdminUser(user)

  const [gateKey, setGateKey] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const [overview, setOverview] = useState<any>(null)
  const [clinics, setClinics] = useState<any[]>([])
  const [school, setSchool] = useState<any>(null)
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [memberEmail, setMemberEmail] = useState<Record<string, string>>({})

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

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      if (tab === 'overview') await loadOverview()
      else if (tab === 'clinics') await loadClinics()
      else if (tab === 'school') await loadSchool()
      else await loadSuppliers()
    } catch {
      toast.error('Нет доступа')
      lock()
    } finally {
      setLoading(false)
    }
  }, [tab, loadOverview, loadClinics, loadSchool, loadSuppliers, toast, lock])

  useEffect(() => {
    try {
      const existing = sessionStorage.getItem(OPS_KEY_SESSION)
      if (existing) { setUnlocked(true); setGateKey(existing) }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (isSuper && unlocked) void refresh()
  }, [isSuper, unlocked, tab, refresh])

  if (!isSuper) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-8">
        <p className="text-sm text-txt-muted">Страница не найдена</p>
      </div>
    )
  }

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
      await refresh()
      if (tab !== 'overview') await loadOverview().catch(() => null)
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка')
    } finally {
      setBusy(null)
    }
  }

  if (!unlocked) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-txt-primary">
              <Lock size={18} className="text-dv-gold" />
              <h1 className="text-sm font-semibold">Platform Ops</h1>
            </div>
            <Input type="password" autoComplete="off" spellCheck={false} label="Access key"
              value={gateKey} onChange={(e) => setGateKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && unlock()} />
            <Button className="w-full" onClick={unlock}>Continue</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const stats = overview?.stats || {}
  const queues = overview?.queues || {}
  const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: 'overview', label: 'Command', icon: <Zap size={14} />, badge: overview?.attentionCount || 0 },
    { id: 'clinics', label: 'Клиники', icon: <Building2 size={14} /> },
    { id: 'school', label: 'School', icon: <GraduationCap size={14} /> },
    { id: 'suppliers', label: 'Поставщики', icon: <Store size={14} /> },
  ]

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-dv-gold" />
          <div>
            <h1 className="text-sm font-semibold text-txt-primary">Platform Ops Command Center</h1>
            <p className="text-xs text-txt-muted">Скрытый контур · подписки · school · поставщики · автоочереди</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" icon={<RefreshCw size={14} />} onClick={refresh} disabled={loading}>Refresh</Button>
          <Button size="sm" variant="danger" onClick={lock}>Lock</Button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-white/[0.06]">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id ? 'border-[#C9A96E] text-[#C9A96E]' : 'border-transparent text-[#7A8899] hover:text-white'
            }`}>
            {t.icon}{t.label}
            {!!t.badge && t.badge > 0 && (
              <span className="ml-1 rounded-full bg-red-500/20 text-red-300 px-1.5 text-[10px]">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {loading && !overview && !clinics.length && !school && !suppliers.length ? (
        <p className="text-sm text-txt-muted py-16 text-center">Loading…</p>
      ) : null}

      {/* ─── OVERVIEW ─── */}
      {tab === 'overview' && overview && (
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
              onOpen={() => setTab('suppliers')}
              items={(queues.suppliersPending || []).map((s: any) => ({
                id: s.id, title: s.name, meta: `${s.status} · docs ${s._count?.documents || 0}`,
              }))} />
            <QueueCard title="Новые лекторы" icon={<GraduationCap size={14} />}
              onOpen={() => setTab('school')}
              items={(queues.lecturersNew || []).map((l: any) => ({
                id: l.id, title: l.academy?.name || l.id.slice(0, 8),
                meta: `verifications ${l._count?.verifications || 0} · courses ${l._count?.courses || 0}`,
              }))} />
            <QueueCard title="Подписки истекают" icon={<AlertTriangle size={14} />}
              onOpen={() => setTab('clinics')}
              items={(queues.clinicsExpiring || []).map((s: any) => ({
                id: s.id, title: s.clinic?.name || s.ownerId.slice(0, 8),
                meta: `до ${fmtDate(s.periodEnd)} · ${s.plan}`,
              }))} />
          </div>
        </div>
      )}

      {/* ─── CLINICS ─── */}
      {tab === 'clinics' && (
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
                    className="h-8 rounded-lg border border-bdr-subtle bg-white/[0.03] px-2 text-xs text-txt-primary"
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

      {/* ─── SCHOOL ─── */}
      {tab === 'school' && school && (
        <div className="space-y-4">
          <p className="text-xs text-txt-muted">Академий: {school.academies?.length || 0} · Лекторов: {school.lecturers?.length || 0} · Курсов: {school.courseCount || 0}</p>
          {(school.academies || []).length > 0 && (
            <div className="grid sm:grid-cols-2 gap-2">
              {(school.academies || []).slice(0, 8).map((a: any) => (
                <Card key={a.id}>
                  <CardContent className="p-3">
                    <p className="text-sm font-medium text-txt-primary truncate">{a.name}</p>
                    <p className="text-[11px] text-txt-muted mt-0.5">
                      {a.city || '—'} · lecturers {a._count?.lecturers || 0} · courses {a._count?.courses || 0}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          <div className="space-y-3">
            {(school.lecturers || []).map((l: any) => (
              <Card key={l.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-txt-primary">{l.academy?.name || 'Без академии'}</p>
                      <p className="text-xs text-txt-muted">courses {l._count?.courses || 0} · docs {l._count?.verifications || 0}</p>
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
        </div>
      )}

      {/* ─── SUPPLIERS ─── */}
      {tab === 'suppliers' && (
        <div className="space-y-3">
          {suppliers.length === 0 ? (
            <p className="text-sm text-txt-muted py-10 text-center">No suppliers</p>
          ) : suppliers.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-txt-primary truncate">{s.name}</p>
                    <p className="text-xs text-txt-muted mt-0.5">
                      {s.email || '—'} · members {s._count?.members ?? s.members?.length ?? 0}
                    </p>
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
    </div>
  )
}

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
