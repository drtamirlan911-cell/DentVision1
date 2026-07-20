import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Briefcase, MapPin, Clock, DollarSign, Search, Building2, ChevronRight, Plus,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/ds/Card'
import { Badge } from '@/components/ui/ds/Badge'
import { Button } from '@/components/ui/ds/Button'
import { Input } from '@/components/ui/ds/Input'
import { EmptyState } from '@/components/ui/ds/EmptyState'
import { PageHeader } from '@/components/ui/ds/StatCard'
import { useAuth } from '@/store/auth.store'

/** Seed catalog — HH.kz-class UX shell until Jobs API ships */
const SEED_VACANCIES = [
  {
    id: '1', title: 'Врач-стоматолог-терапевт', clinic: 'KazDent',
    city: 'Алматы', salary: '450 000 — 700 000 ₸',
    type: 'Полная занятость', posted: '2 дня назад',
    description: 'Требуется опытный стоматолог-терапевт. Современное оборудование, цифровая рентгенография.',
    tags: ['Терапия', 'Эндодонтия'],
  },
  {
    id: '2', title: 'Дентальный гигиенист', clinic: 'Smile Clinic',
    city: 'Астана', salary: '300 000 — 450 000 ₸',
    type: 'Полная занятость', posted: '5 дней назад',
    description: 'Ищем гигиениста для профилактических процедур и чистки.',
    tags: ['Профилактика'],
  },
  {
    id: '3', title: 'Врач-ортодонт', clinic: 'Dental Premium',
    city: 'Алматы', salary: '600 000 — 900 000 ₸',
    type: 'Полная занятость', posted: '1 неделю назад',
    description: 'Ортодонт с опытом работы с элайнерами и брекетами.',
    tags: ['Ортодонтия', 'Элайнеры'],
  },
  {
    id: '4', title: 'Ассистент стоматолога', clinic: 'MedDent',
    city: 'Шымкент', salary: '200 000 — 300 000 ₸',
    type: 'Полная занятость', posted: '3 дня назад',
    description: 'Ассистент врача с опытом работы в стоматологии.',
    tags: ['Ассистент'],
  },
  {
    id: '5', title: 'Врач-хирург-имплантолог', clinic: 'Implant Center',
    city: 'Алматы', salary: '800 000 — 1 200 000 ₸',
    type: 'Частичная занятость', posted: '1 день назад',
    description: 'Хирург-имплантолог для проведения операций по установке имплантов.',
    tags: ['Хирургия', 'Имплантация'],
  },
]

export default function JobsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('all')
  const [applied, setApplied] = useState<string[]>([])

  const cities = useMemo(
    () => ['all', ...Array.from(new Set(SEED_VACANCIES.map((v) => v.city)))],
    []
  )

  const filtered = SEED_VACANCIES.filter((v) => {
    const q = search.toLowerCase()
    const matchQ = !q || v.title.toLowerCase().includes(q) || v.clinic.toLowerCase().includes(q)
    const matchCity = city === 'all' || v.city === city
    return matchQ && matchCity
  })

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto space-y-6 p-4 md:p-6">
      <PageHeader
        title="Jobs"
        subtitle="Кадровый рынок стоматологии · поиск, фильтры, отклик"
        icon={<Briefcase size={20} />}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => navigate('/', { state: { aiQuery: 'Найди вакансии ортодонта в Алматы' } })}>
              Спросить AI
            </Button>
            {user && (
              <Button size="sm">
                <Plus size={14} className="mr-1.5" />
                Разместить
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Должность, клиника…" className="pl-9" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {cities.map((c) => (
            <button
              key={c}
              onClick={() => setCity(c)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                city === c ? 'bg-dv-gold/15 border-dv-gold/30 text-dv-gold' : 'border-bdr-subtle text-txt-muted hover:text-txt-primary'
              }`}
            >
              {c === 'all' ? 'Все города' : c}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={28} />}
          title="Вакансии не найдены"
          description="Измените фильтр или попросите Reception/Marketing AI помочь с наймом."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((v) => (
            <Card key={v.id} className="hover:border-dv-gold/25 transition-colors">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-txt-primary">{v.title}</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-txt-muted">
                      <span className="inline-flex items-center gap-1"><Building2 size={12} />{v.clinic}</span>
                      <span className="inline-flex items-center gap-1"><MapPin size={12} />{v.city}</span>
                      <span className="inline-flex items-center gap-1"><DollarSign size={12} />{v.salary}</span>
                      <span className="inline-flex items-center gap-1"><Clock size={12} />{v.posted}</span>
                    </div>
                  </div>
                  <Badge variant="outline" size="xs">{v.type}</Badge>
                </div>
                <p className="text-sm text-txt-secondary">{v.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {v.tags.map((t) => <Badge key={t} variant="gold" size="xs">{t}</Badge>)}
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant={applied.includes(v.id) ? 'secondary' : 'primary'}
                    disabled={applied.includes(v.id)}
                    onClick={() => setApplied((a) => [...a, v.id])}
                  >
                    {applied.includes(v.id) ? 'Отклик отправлен' : 'Откликнуться'}
                    {!applied.includes(v.id) && <ChevronRight size={14} className="ml-1" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  )
}
