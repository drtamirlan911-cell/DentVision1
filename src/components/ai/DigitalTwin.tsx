import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Brain, Target, BookOpen, TrendingUp, Lightbulb, BarChart3, RefreshCw,
  Sparkles, FlaskConical, LogIn,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/ui/ds/GlassCard'
import { Badge } from '@/components/ui/ds/Badge'
import { Button } from '@/components/ui/ds/Button'
import { useAuth } from '@/store/auth.store'
import { useGuestStore } from '@/store/guest.store'
import * as api from '@/utils/api'

type Twin = {
  name?: string
  specialty?: string
  title?: string
  role?: string
  roleLabel?: string
  profileKind?: 'doctor' | 'ops' | 'staff' | 'platform' | string
  clinic?: { name?: string } | null
  skills?: Array<{ name: string; level: number }>
  completedCourses?: number
  inProgressCourses?: number
  equipment?: string[]
  learningPath?: string[]
  recommendations?: string[]
  activityLevel?: string
  kpis?: Array<{ label: string; value: string; change?: string }>
  aiAdvice?: string
  recentCourses?: Array<{ title: string; progress: number; completed: boolean }>
}

const GUEST_PLATFORM_TWIN: Twin = {
  role: 'GUEST',
  roleLabel: 'Гость',
  profileKind: 'platform',
  name: 'Гость',
  title: 'Гид по DentVision',
  specialty: 'Платформенный гид',
  clinic: null,
  activityLevel: 'exploring',
  skills: [
    { name: 'CRM клиники', level: 72 },
    { name: 'Маркетплейс', level: 68 },
    { name: 'Academy OS', level: 65 },
    { name: 'ИИ-ассистент', level: 80 },
  ],
  kpis: [
    { label: 'Модули', value: 'CRM · Shop · School', change: '' },
    { label: 'ИИ', value: 'Гид', change: '' },
    { label: 'Демо', value: 'Доступно', change: '' },
    { label: 'Старт', value: 'Бесплатно', change: '' },
  ],
  learningPath: [
    'Открыть демо-клинику и посмотреть CRM',
    'Заглянуть в Academy OS',
    'Зарегистрироваться и подключить клинику',
  ],
  recommendations: [
    'Спросите ИИ: «Чем полезен DentVision?»',
    'Откройте демо — расписание и касса вживую',
    'После входа двойник станет профилем вашей роли',
  ],
  aiAdvice:
    'Я гид по DentVision: CRM, маркетплейс и Academy. Данные клиники появятся после входа.',
  completedCourses: 0,
  inProgressCourses: 0,
  recentCourses: [],
  equipment: [],
}

const ACTIVITY_LABEL: Record<string, string> = {
  very_active: 'Очень высокая',
  active: 'Высокая',
  moderate: 'Средняя',
  low: 'Низкая',
  exploring: 'Знакомство',
}

const ROLE_LABEL_FALLBACK: Record<string, string> = {
  OWNER: 'Руководитель',
  DIRECTOR: 'Руководитель',
  ADMIN: 'Администратор',
  DOCTOR: 'Врач',
  ASSISTANT: 'Ассистент',
  MANAGER: 'Менеджер',
  LAB: 'Лаборатория',
  STUDENT: 'Студент',
  SUPERADMIN: 'Платформа',
  CASHIER: 'Администратор',
  GUEST: 'Гость',
}

function looksMojibake(value?: string | null): boolean {
  if (!value) return true
  return /Р.|Рѕ|С.|Ð.|Ñ./.test(value) || !/[А-Яа-яA-Za-zЁё]/.test(value)
}

function sanitizeDisplayName(raw?: string | null, fallback = 'Гость'): string {
  const v = String(raw || '').trim()
  if (looksMojibake(v) || /^gost/i.test(v)) return fallback
  return v
}

function roleLabelOf(twin: Twin): string {
  if (twin.roleLabel) return twin.roleLabel
  const key = String(twin.role || '').toUpperCase()
  return ROLE_LABEL_FALLBACK[key] || twin.role || 'Сотрудник'
}

function introBody(twin: Twin): string {
  if (twin.profileKind === 'platform' || String(twin.role || '').toUpperCase() === 'GUEST') {
    return 'гид по платформе DentVision: CRM, маркетплейс, Academy и ИИ. После входа станет живым профилем вашей роли.'
  }
  if (twin.profileKind === 'ops' || ['OWNER', 'ADMIN', 'MANAGER', 'SUPERADMIN'].includes(String(twin.role || '').toUpperCase())) {
    return 'живой AI-профиль администратора клиники: операционные навыки, обучение и KPI. Обновляется по вашим данным.'
  }
  if (twin.profileKind === 'doctor' || String(twin.role || '').toUpperCase() === 'DOCTOR') {
    return 'живой AI-профиль врача: навыки, обучение и KPI клиники. Обновляется по вашим данным.'
  }
  return 'живой AI-профиль сотрудника: навыки, обучение и KPI. Обновляется по вашим данным.'
}

function GuestTwinView({ twin }: { twin: Twin }) {
  const navigate = useNavigate()
  const setRegistrationModal = useGuestStore((s) => s.setRegistrationModal)
  const skills = twin.skills || []
  const steps = twin.learningPath || []
  const tips = twin.recommendations || []

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-dv-gold/25 bg-gradient-to-br from-dv-gold/15 via-surface-2/80 to-surface-1 p-4">
        <div className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-dv-gold/20 blur-2xl" />
        <div className="relative flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-dv-gold/20 ring-1 ring-dv-gold/30">
            <Sparkles size={22} className="text-dv-gold" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <Badge variant="gold" size="xs">Гость</Badge>
              <Badge variant="outline" size="xs">Знакомство</Badge>
            </div>
            <h3 className="text-base font-semibold text-txt-primary tracking-tight">
              {sanitizeDisplayName(twin.name)}
            </h3>
            <p className="text-xs text-txt-muted mt-0.5 leading-relaxed">
              {twin.title || 'Гид по DentVision'}
            </p>
          </div>
        </div>
        <p className="relative mt-3 text-xs text-txt-secondary leading-relaxed">
          {twin.aiAdvice ||
            'CRM, маркетплейс и Academy в одной SuperApp. Спросите ИИ или откройте демо.'}
        </p>
        <div className="relative mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => navigate('/demo')}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-dv-gold px-3 py-2 text-xs font-semibold text-surface-0 hover:bg-dv-gold/90 transition-colors"
          >
            <FlaskConical size={13} />
            Демо
          </button>
          <button
            type="button"
            onClick={() => setRegistrationModal(true)}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-dv-gold/30 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-dv-gold hover:bg-dv-gold/10 transition-colors"
          >
            <LogIn size={13} />
            Войти
          </button>
        </div>
      </div>

      {skills.length > 0 && (
        <section>
          <div className="flex items-center gap-1.5 mb-2.5 px-0.5">
            <Target size={13} className="text-dv-gold" />
            <h4 className="text-xs font-semibold text-txt-primary uppercase tracking-wider">Возможности</h4>
          </div>
          <div className="space-y-2.5">
            {skills.map((skill) => (
              <div key={skill.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-txt-secondary">{skill.name}</span>
                  <span className="text-2xs text-txt-muted">{skill.level}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, skill.level)}%` }}
                    transition={{ duration: 0.55, ease: 'easeOut' }}
                    className="h-full rounded-full bg-gradient-to-r from-dv-gold/80 to-dv-gold"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {steps.length > 0 && (
        <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <BookOpen size={13} className="text-dv-gold" />
            <h4 className="text-xs font-semibold text-txt-primary">С чего начать</h4>
          </div>
          <ol className="space-y-2">
            {steps.slice(0, 4).map((step, i) => (
              <li key={step} className="flex gap-2 text-xs text-txt-secondary leading-snug">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-dv-gold/15 text-[10px] font-bold text-dv-gold">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </section>
      )}

      {tips.length > 0 && (
        <section>
          <div className="flex items-center gap-1.5 mb-2 px-0.5">
            <Lightbulb size={13} className="text-dv-gold" />
            <h4 className="text-xs font-semibold text-txt-primary">Подсказки</h4>
          </div>
          <ul className="space-y-1.5">
            {tips.slice(0, 3).map((tip) => (
              <li
                key={tip}
                className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-2.5 py-2 text-xs text-txt-secondary leading-relaxed"
              >
                {tip}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

export function DigitalTwin() {
  const { user } = useAuth()
  const isGuest = useGuestStore((s) => s.isGuest) || !user
  const [twin, setTwin] = useState<Twin | null>(isGuest ? GUEST_PLATFORM_TWIN : null)
  const [loading, setLoading] = useState(!isGuest)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      if (isGuest) {
        const res = await api.aiDigitalTwin().catch(() => null)
        const data = res?.twin || res
        if (data?.profileKind === 'platform' || String(data?.role || '').toUpperCase() === 'GUEST') {
          setTwin({
            ...GUEST_PLATFORM_TWIN,
            ...data,
            name: sanitizeDisplayName(data?.name, 'Гость'),
            roleLabel: 'Гость',
            profileKind: 'platform',
          })
        } else {
          setTwin(GUEST_PLATFORM_TWIN)
        }
        return
      }
      const res = await api.aiDigitalTwin()
      const data = res?.twin || res
      if (data) {
        setTwin({
          ...data,
          name: sanitizeDisplayName(data.name, data.roleLabel || 'Профиль'),
        })
      } else {
        setTwin(null)
      }
    } catch (e: any) {
      if (isGuest) {
        setTwin(GUEST_PLATFORM_TWIN)
        setError(null)
      } else {
        setError(e?.message || 'Не удалось загрузить двойник')
        setTwin(null)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [isGuest])

  if (loading) {
    return <p className="text-xs text-txt-muted py-6 text-center">Загрузка цифрового двойника…</p>
  }

  if (error || !twin) {
    return (
      <div className="py-6 text-center space-y-3">
        <p className="text-xs text-txt-muted">{error || 'Нет данных профиля'}</p>
        <Button size="sm" variant="secondary" icon={<RefreshCw size={14} />} onClick={load}>Повторить</Button>
      </div>
    )
  }

  const isPlatform = twin.profileKind === 'platform' || String(twin.role || '').toUpperCase() === 'GUEST' || isGuest
  if (isPlatform) {
    return <GuestTwinView twin={twin} />
  }

  const skills = twin.skills || []
  const kpis = twin.kpis || []
  const recommendations = twin.recommendations || twin.learningPath || []
  const roleLabel = roleLabelOf(twin)
  const title = twin.title || twin.specialty || roleLabel
  const displayName = sanitizeDisplayName(twin.name, roleLabel)

  return (
    <div className="space-y-3">
      <GlassCard padding="md">
        <p className="text-[11px] text-txt-muted leading-relaxed mb-3">
          <strong className="text-txt-secondary">Двойник</strong>
          {' — '}
          {introBody(twin)}
        </p>
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-dv-gold/20 to-dv-gold/5">
            <Brain size={24} className="text-dv-gold" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-txt-primary truncate">{displayName}</h3>
            <p className="text-xs text-txt-muted mt-0.5 truncate">
              {title}
              {twin.clinic?.name ? ` · ${twin.clinic.name}` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" size="xs">{roleLabel}</Badge>
          {twin.activityLevel && (
            <Badge variant="gold" size="xs">
              Активность: {ACTIVITY_LABEL[twin.activityLevel] || twin.activityLevel}
            </Badge>
          )}
          <Button size="sm" variant="ghost" icon={<RefreshCw size={12} />} onClick={load} className="ml-auto h-7 px-2 text-[10px]">
            Обновить
          </Button>
        </div>
      </GlassCard>

      {skills.length > 0 && (
        <GlassCard padding="md">
          <div className="flex items-center gap-1.5 mb-3">
            <Target size={14} className="text-dv-gold" />
            <h4 className="text-sm font-semibold text-txt-primary">Навыки</h4>
          </div>
          <div className="space-y-2.5">
            {skills.map((skill) => (
              <div key={skill.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-txt-secondary">{skill.name}</span>
                  <span className="text-2xs text-txt-muted">{skill.level}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, skill.level)}%` }}
                    transition={{ duration: 0.6 }}
                    className={cn(
                      'h-full rounded-full',
                      skill.level >= 80 ? 'bg-green-400' : skill.level >= 60 ? 'bg-dv-gold' : 'bg-amber-400',
                    )}
                  />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {kpis.length > 0 && (
        <GlassCard padding="md">
          <div className="flex items-center gap-1.5 mb-3">
            <BarChart3 size={14} className="text-dv-gold" />
            <h4 className="text-sm font-semibold text-txt-primary">KPI</h4>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-lg bg-white/[0.03] p-2.5">
                <p className="text-[10px] text-txt-muted leading-tight">{k.label}</p>
                <p className="text-sm font-semibold text-txt-primary mt-0.5">{k.value}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <GlassCard padding="md">
        <div className="flex items-center gap-1.5 mb-2">
          <BookOpen size={14} className="text-dv-gold" />
          <h4 className="text-sm font-semibold text-txt-primary">Обучение</h4>
        </div>
        <p className="text-xs text-txt-muted">
          Пройдено: <span className="text-txt-primary">{twin.completedCourses || 0}</span>
          {' · '}в процессе: <span className="text-txt-primary">{twin.inProgressCourses || 0}</span>
        </p>
        {(twin.recentCourses || []).slice(0, 3).map((c) => (
          <div key={c.title} className="mt-2 text-[11px] flex justify-between gap-2">
            <span className="text-txt-secondary truncate">{c.title}</span>
            <span className="text-txt-muted shrink-0">{c.completed ? '✓' : `${c.progress}%`}</span>
          </div>
        ))}
      </GlassCard>

      {recommendations.length > 0 && (
        <GlassCard padding="md">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp size={14} className="text-dv-gold" />
            <h4 className="text-sm font-semibold text-txt-primary">Рекомендации</h4>
          </div>
          <ul className="space-y-1.5">
            {recommendations.slice(0, 4).map((r) => (
              <li key={r} className="text-xs text-txt-secondary flex gap-1.5">
                <Lightbulb size={12} className="text-dv-gold shrink-0 mt-0.5" />
                {r}
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      {twin.aiAdvice && (
        <GlassCard padding="md">
          <p className="text-xs text-txt-secondary leading-relaxed">{twin.aiAdvice}</p>
        </GlassCard>
      )}

      {!!twin.equipment?.length && (
        <GlassCard padding="md">
          <h4 className="text-sm font-semibold text-txt-primary mb-2">Оборудование</h4>
          <div className="flex flex-wrap gap-1.5">
            {twin.equipment.map((e) => (
              <Badge key={e} variant="outline" size="xs">{e}</Badge>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  )
}
