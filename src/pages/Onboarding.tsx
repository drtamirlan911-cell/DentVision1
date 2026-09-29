import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Building2, FlaskConical, Factory, Store, GraduationCap, Stethoscope, Users, ArrowRight, BriefcaseBusiness, UserRound } from 'lucide-react'
import { Card } from '@/components/ui/ds/Card'
import { Button } from '@/components/ui/ds/Button'
import { Input } from '@/components/ui/ds/Input'
import { useToast } from '@/components/ui/ds/Toast'
import { useAuth } from '@/store/auth.store'
import * as api from '@/utils/api'

type Kind = 'clinic' | 'diagnostic_center' | 'medical_lab' | 'dental_lab' | 'supplier' | 'academy'
type Mode = 'intent' | 'create' | 'join'

const TYPES: Array<{ id: Kind; label: string; description: string; icon: typeof Building2; nextPath: string }> = [
  { id: 'clinic', label: 'Стоматологическая клиника', description: 'Пациенты, команда, расписание и лечение', icon: Stethoscope, nextPath: '/crm/schedule' },
  { id: 'diagnostic_center', label: 'Диагностический центр', description: 'Направления, исследования и заключения', icon: Building2, nextPath: '/diagnostics/center' },
  { id: 'medical_lab', label: 'Медицинская лаборатория', description: 'Заказы, образцы, анализы и результаты', icon: FlaskConical, nextPath: '/diagnostics/lab?workspace=medical-lab' },
  { id: 'dental_lab', label: 'Зуботехническая лаборатория', description: 'Кейсы, производство, QC и доставка', icon: Factory, nextPath: '/diagnostics/lab' },
  { id: 'supplier', label: 'Поставщик / производитель', description: 'Каталог, заказы, fulfillment и выплаты', icon: Store, nextPath: '/supplier' },
  { id: 'academy', label: 'Академия / образовательный центр', description: 'Курсы, студенты, преподаватели и сертификаты', icon: GraduationCap, nextPath: '/school' },
]

const PERSONAL_INTENTS = [
  { id: 'professional', label: 'Профессионал / врач', description: 'Профиль, портфолио, credentials и профессиональные возможности', icon: Stethoscope, nextPath: '/profile' },
  { id: 'patient', label: 'Пациент / покупатель', description: 'Запись, лечение, документы и покупки без создания организации', icon: UserRound, nextPath: '/patient-portal' },
  { id: 'jobs', label: 'Работа / найм', description: 'Вакансии, кандидаты и профессиональные возможности', icon: BriefcaseBusiness, nextPath: '/jobs' },
  { id: 'student', label: 'Студент / обучение', description: 'Курсы, обучение, прогресс и сертификаты', icon: GraduationCap, nextPath: '/school' },
  { id: 'employer', label: 'Работодатель', description: 'Вакансии, кандидаты и найм специалистов', icon: BriefcaseBusiness, nextPath: '/jobs' },
]

export default function Onboarding() {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const toast = useToast()
  const initialMode = new URLSearchParams(window.location.search).get('mode')
  const [mode, setMode] = useState<Mode>(initialMode === 'join' || initialMode === 'create' ? initialMode : 'intent')
  const [kind, setKind] = useState<Kind | null>(null)
  const [form, setForm] = useState({ name: '', city: '', address: '', phone: '', email: '', taxId: '' })
  const [inviteCode, setInviteCode] = useState('')
  const [invitePreview, setInvitePreview] = useState<{ name?: string; role?: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const selected = useMemo(() => TYPES.find(t => t.id === kind) || null, [kind])

  if (authLoading) return <div className="min-h-screen bg-surface-0 flex items-center justify-center text-sm text-txt-muted">Загружаем рабочую среду…</div>
  if (!isAuthenticated) return <Navigate to="/login?returnUrl=%2Fonboarding" replace />

  const create = async () => {
    if (!kind || !selected) return
    if (!form.name.trim()) { toast.error('Укажите название организации'); return }
    if (!form.city.trim()) { toast.error('Укажите город'); return }
    setSaving(true)
    try {
      const result = await api.createSelfServiceOrganization({
        type: kind,
        name: form.name.trim(),
        city: form.city.trim(),
        address: form.address.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        taxId: form.taxId.trim() || undefined,
      })
      if (result?.accessToken) api.setTokens(result.accessToken, result.refreshToken || null)
      window.location.assign(result?.nextPath || selected.nextPath)
    } catch (e: any) {
      toast.error(e?.message || 'Не удалось создать организацию')
    } finally {
      setSaving(false)
    }
  }

  const lookupInvite = async () => {
    const code = inviteCode.trim()
    if (!code) return
    try {
      const data = await api.lookupOrganizationInvite(code)
      setInvitePreview({ name: data?.organization?.name || data?.organizationName, role: data?.role })
    } catch (e: any) {
      setInvitePreview(null)
      toast.error(e?.message || 'Приглашение не найдено')
    }
  }

  const join = async () => {
    const code = inviteCode.trim()
    if (!code) { toast.error('Введите код приглашения'); return }
    setSaving(true)
    try {
      const result = await api.joinOrganizationByInvite(code)
      toast.success(`Вы присоединились: ${result?.organizationName || 'организация'}`)
      window.location.assign(result?.nextPath || '/')
    } catch (e: any) {
      toast.error(e?.message || 'Не удалось принять приглашение')
    } finally {
      setSaving(false)
    }
  }

  if (mode === 'intent') return (
    <main className="min-h-screen bg-surface-0 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-dv-gold">DentVision</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-txt-primary">Что вы хотите делать в DentVision?</h1>
          <p className="mt-2 text-sm leading-6 text-txt-muted">Выберите рабочий контекст. Организация, роль, филиал и права будут созданы через единую модель DentVision.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TYPES.map(type => { const Icon = type.icon; return (
            <button key={type.id} type="button" onClick={() => { setKind(type.id); setMode('create') }} className="group min-h-36 rounded-2xl border border-bdr-subtle bg-surface-raised p-5 text-left transition hover:border-dv-gold/40 hover:bg-dv-gold/[0.03]">
              <div className="flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-dv-gold/10 text-dv-gold"><Icon size={19} /></span><ArrowRight size={16} className="text-txt-ghost transition-transform group-hover:translate-x-1" /></div>
              <h2 className="mt-4 text-sm font-semibold text-txt-primary">{type.label}</h2>
              <p className="mt-1 text-xs leading-5 text-txt-muted">{type.description}</p>
            </button>
          )})}
        </div>
        <section className="mt-6">
          <div className="mb-3 px-1">
            <p className="text-xs font-semibold text-txt-primary">Без организации</p>
            <p className="mt-1 text-xs leading-5 text-txt-muted">Не нужно создавать клинику или другую организацию, если ваша задача — личный профессиональный, пациентский или job-контекст.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {PERSONAL_INTENTS.map(intent => { const Icon = intent.icon; return (
              <button key={intent.id} type="button" onClick={() => window.location.assign(intent.nextPath)} className="group min-h-32 rounded-2xl border border-bdr-subtle bg-surface-1 p-4 text-left transition hover:border-dv-gold/40 hover:bg-dv-gold/[0.03]">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-dv-gold"><Icon size={17} /></span>
                <span className="mt-3 block text-sm font-semibold text-txt-primary">{intent.label}</span>
                <span className="mt-1 block text-xs leading-5 text-txt-muted">{intent.description}</span>
              </button>
            )})}
          </div>
        </section>
        <div className="mt-6 flex flex-col items-start gap-3 rounded-2xl border border-bdr-subtle bg-surface-1 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-semibold text-txt-primary">У вас уже есть приглашение?</p><p className="mt-1 text-xs text-txt-muted">Присоединитесь к организации без создания новой.</p></div>
          <Button variant="secondary" className="min-h-11" onClick={() => setMode('join')}><Users size={15} /> Войти по приглашению</Button>
        </div>
      </div>
    </main>
  )

  if (mode === 'join') return (
    <main className="min-h-screen bg-surface-0 flex items-center justify-center p-4">
      <Card padding="lg" className="w-full max-w-lg">
        <button type="button" onClick={() => setMode('intent')} className="mb-5 min-h-11 text-xs text-txt-muted hover:text-txt-primary">← Назад</button>
        <h1 className="text-xl font-semibold text-txt-primary">Присоединиться к организации</h1>
        <p className="mt-2 text-sm text-txt-muted">Введите код приглашения. Перед принятием можно проверить организацию и роль.</p>
        <div className="mt-5 space-y-4">
          <Input label="Код приглашения" value={inviteCode} onChange={e => { setInviteCode(e.target.value.toUpperCase()); setInvitePreview(null) }} onBlur={lookupInvite} placeholder="4F2A9C1B" />
          {invitePreview && <div className="rounded-xl border border-bdr-subtle bg-surface-1 p-4"><p className="text-sm font-medium text-txt-primary">{invitePreview.name || 'Организация'}</p>{invitePreview.role && <p className="mt-1 text-xs text-txt-muted">Роль: {invitePreview.role}</p>}</div>}
          <Button className="w-full min-h-11" loading={saving} onClick={join}>Присоединиться</Button>
        </div>
      </Card>
    </main>
  )

  return (
    <main className="min-h-screen bg-surface-0 flex items-center justify-center p-4">
      <Card padding="lg" className="w-full max-w-lg">
        <button type="button" onClick={() => setMode('intent')} className="mb-5 min-h-11 text-xs text-txt-muted hover:text-txt-primary">← Назад</button>
        <div className="flex items-start gap-3">
          {selected && <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dv-gold/10 text-dv-gold">{(() => { const Icon = selected.icon; return <Icon size={18} /> })()}</span>}
          <div><h1 className="text-xl font-semibold text-txt-primary">{selected?.label}</h1><p className="mt-1 text-sm text-txt-muted">Создание организации и первого рабочего контекста</p></div>
        </div>
        <div className="mt-5 space-y-3">
          <Input label="Название *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <Input label="Город *" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
          <Input label="Адрес" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
          <Input label="Телефон" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <Input label="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <Input label="БИН / ИИН" value={form.taxId} onChange={e => setForm({ ...form, taxId: e.target.value })} />
          <Button className="w-full min-h-11" loading={saving} onClick={create}>Создать и открыть workspace</Button>
        </div>
      </Card>
    </main>
  )
}
