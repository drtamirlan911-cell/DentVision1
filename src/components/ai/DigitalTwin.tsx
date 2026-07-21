import { motion } from 'framer-motion'
import {
  Brain, Target, BookOpen, TrendingUp, AlertCircle,
  Wrench, Star, Award, Lightbulb, BarChart3
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/ui/ds/GlassCard'
import { Badge } from '@/components/ui/ds/Badge'

const MOCK_TWIN = {
  specialty: 'Стоматолог-терапевт',
  expertiseLevel: 'Middle',
  activityLevel: 'Высокая',
  skills: [
    { name: 'Терапия', level: 85 },
    { name: 'Эндодонтия', level: 72 },
    { name: 'Диагностика', level: 90 },
    { name: 'Хирургия', level: 45 },
    { name: 'Ортопедия', level: 30 },
  ],
  equipment: ['Микроскоп Carl Zeiss', 'Радиовизиограф', 'Апекслокатор', 'Ультразвуковой скейлер', 'Лазерный диод'],
  completedCourses: 12,
  inProgressCourses: 2,
  weakAreas: ['Хирургические вмешательства', 'Работа с ортопедическими конструкциями'],
  recommendations: [
    'Курс "Хирургическая стоматология для терапевтов"',
    'Вебинар "Современные методы протезирования"',
  ],
  kpis: [
    { label: 'Принято пациентов', value: '127', change: '+12%' },
    { label: 'Выручка', value: '3.2M ₸', change: '+8%' },
    { label: 'Конверсия', value: '73%', change: '+5%' },
    { label: 'Повторные визиты', value: '62%', change: '+3%' },
  ],
  aiAdvice: 'Рекомендуем обратить внимание на эндодонтические случаи. Ваш показатель успешного лечения корневых каналов на 12% выше среднего по клинике. Рассмотрите углубленный курс по микроскопной эндодонтии.',
}

export function DigitalTwin() {
  return (
    <div className="space-y-3 p-3">
      <GlassCard padding="md">
        <p className="text-[11px] text-txt-muted leading-relaxed mb-3">
          <strong className="text-txt-secondary">Двойник</strong> — профиль врача для AI:
          навыки, курсы и рекомендации. Ниже демо-данные; живая аналитика подключится к вашей практике.
        </p>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-dv-gold/20 to-dv-gold/5">
            <Brain size={24} className="text-dv-gold" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-txt-primary">Цифровой двойник</h3>
            <p className="text-xs text-txt-muted mt-0.5">
              {MOCK_TWIN.specialty} &middot; {MOCK_TWIN.expertiseLevel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="gold" size="xs">{MOCK_TWIN.expertiseLevel}</Badge>
          <Badge variant="info" size="xs">Демо</Badge>
        </div>
      </GlassCard>

      <GlassCard padding="md">
        <div className="flex items-center gap-1.5 mb-3">
          <Target size={14} className="text-dv-gold" />
          <h4 className="text-sm font-semibold text-txt-primary">Навыки</h4>
        </div>
        <div className="space-y-2.5">
          {MOCK_TWIN.skills.map((skill) => (
            <div key={skill.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-txt-secondary">{skill.name}</span>
                <span className="text-2xs text-txt-muted">{skill.level}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${skill.level}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                  className={cn(
                    'h-full rounded-full',
                    skill.level >= 80 ? 'bg-green-400' : skill.level >= 60 ? 'bg-dv-gold' : 'bg-amber-400'
                  )}
                />
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard padding="md">
        <div className="flex items-center gap-1.5 mb-3">
          <Wrench size={14} className="text-dv-gold" />
          <h4 className="text-sm font-semibold text-txt-primary">Оборудование</h4>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {MOCK_TWIN.equipment.map((item) => (
            <Badge key={item} variant="outline" size="xs">{item}</Badge>
          ))}
        </div>
      </GlassCard>

      <GlassCard padding="md">
        <div className="flex items-center gap-1.5 mb-3">
          <BookOpen size={14} className="text-dv-gold" />
          <h4 className="text-sm font-semibold text-txt-primary">Обучение</h4>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-txt-secondary">
            <span>Пройдено курсов</span>
            <span className="font-semibold text-txt-primary">{MOCK_TWIN.completedCourses}</span>
          </div>
          <div className="flex justify-between text-txt-secondary">
            <span>В процессе</span>
            <span className="font-semibold text-txt-primary">{MOCK_TWIN.inProgressCourses}</span>
          </div>
        </div>
      </GlassCard>

      <GlassCard padding="md">
        <div className="flex items-center gap-1.5 mb-3">
          <AlertCircle size={14} className="text-amber-400" />
          <h4 className="text-sm font-semibold text-txt-primary">Слабые места</h4>
        </div>
        <div className="space-y-2">
          {MOCK_TWIN.weakAreas.map((area) => (
            <div key={area} className="flex items-center gap-2 text-xs text-txt-secondary">
              <div className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
              {area}
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard padding="md">
        <div className="flex items-center gap-1.5 mb-3">
          <Star size={14} className="text-dv-gold" />
          <h4 className="text-sm font-semibold text-txt-primary">Рекомендованные курсы</h4>
        </div>
        <div className="space-y-2">
          {MOCK_TWIN.recommendations.map((rec) => (
            <div key={rec} className="flex items-start gap-2 rounded-xl bg-surface-2 p-2.5">
              <Lightbulb size={14} className="text-dv-gold mt-0.5 shrink-0" />
              <span className="text-xs text-txt-secondary">{rec}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard padding="md">
        <div className="flex items-center gap-1.5 mb-3">
          <BarChart3 size={14} className="text-dv-gold" />
          <h4 className="text-sm font-semibold text-txt-primary">KPI</h4>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {MOCK_TWIN.kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-xl bg-surface-2 p-3">
              <p className="text-2xs text-txt-muted">{kpi.label}</p>
              <p className="text-sm font-bold text-txt-primary mt-1">{kpi.value}</p>
              <p className="text-2xs text-green-400 mt-0.5">{kpi.change}</p>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard padding="md">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-dv-gold/10">
            <Brain size={16} className="text-dv-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-txt-primary mb-1">Совет AI</h4>
            <p className="text-xs text-txt-secondary leading-relaxed">{MOCK_TWIN.aiAdvice}</p>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
