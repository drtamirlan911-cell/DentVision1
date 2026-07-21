import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Brain, Target, BookOpen, TrendingUp, Lightbulb, BarChart3, RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/ui/ds/GlassCard'
import { Badge } from '@/components/ui/ds/Badge'
import { Button } from '@/components/ui/ds/Button'
import * as api from '@/utils/api'

type Twin = {
  name?: string
  specialty?: string
  title?: string
  role?: string
  roleLabel?: string
  profileKind?: 'doctor' | 'ops' | 'staff' | string
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

const ACTIVITY_LABEL: Record<string, string> = {
  very_active: 'Очень высокая',
  active: 'Высокая',
  moderate: 'Средняя',
  low: 'Низкая',
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
}

function roleLabelOf(twin: Twin): string {
  if (twin.roleLabel) return twin.roleLabel
  const key = String(twin.role || '').toUpperCase()
  return ROLE_LABEL_FALLBACK[key] || twin.role || 'Сотрудник'
}

function introBody(twin: Twin): string {
  if (twin.profileKind === 'ops' || ['OWNER', 'ADMIN', 'MANAGER', 'SUPERADMIN'].includes(String(twin.role || '').toUpperCase())) {
    return 'живой AI-профиль администратора клиники: операционные навыки, обучение и KPI. Обновляется по вашим данным.'
  }
  if (twin.profileKind === 'doctor' || String(twin.role || '').toUpperCase() === 'DOCTOR') {
    return 'живой AI-профиль врача: навыки, обучение и KPI клиники. Обновляется по вашим данным.'
  }
  return 'живой AI-профиль сотрудника: навыки, обучение и KPI. Обновляется по вашим данным.'
}

export function DigitalTwin() {
  const [twin, setTwin] = useState<Twin | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.aiDigitalTwin()
      const data = res?.twin || res
      setTwin(data || null)
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить двойник')
      setTwin(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  if (loading) {
    return <p className="text-xs text-txt-muted p-6 text-center">Загрузка цифрового двойника…</p>
  }

  if (error || !twin) {
    return (
      <div className="p-6 text-center space-y-3">
        <p className="text-xs text-txt-muted">{error || 'Нет данных профиля'}</p>
        <Button size="sm" variant="secondary" icon={<RefreshCw size={14} />} onClick={load}>Повторить</Button>
      </div>
    )
  }

  const skills = twin.skills || []
  const kpis = twin.kpis || []
  const recommendations = twin.recommendations || twin.learningPath || []
  const roleLabel = roleLabelOf(twin)
  const title = twin.title || twin.specialty || roleLabel

  return (
    <div className="space-y-3 p-3">
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
            <h3 className="text-sm font-semibold text-txt-primary truncate">{twin.name || roleLabel}</h3>
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
