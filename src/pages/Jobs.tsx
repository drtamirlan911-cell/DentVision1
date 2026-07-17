import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Briefcase, MapPin, Clock, DollarSign, Users, Search,
  Building2, Star, ChevronRight, Filter,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/ds/Card'
import { Badge } from '@/components/ui/ds/Badge'
import { Button } from '@/components/ui/ds/Button'
import { Input } from '@/components/ui/ds/Input'
import { Avatar } from '@/components/ui/ds/Avatar'
import { PageHeader } from '@/components/ui/ds/StatCard'
import { useAuth } from '@/store/auth.store'

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

const MOCK_VACANCIES = [
  {
    id: '1', title: 'Врач-стоматолог-терапевт', clinic: 'KazDent',
    city: 'Алматы', salary: '450 000 — 700 000 ₸',
    type: 'Полная занятость', posted: '2 дня назад',
    description: 'Требуется опытный стоматолог-терапевт. Современное оборудование, цифровая рентгенография.',
    tags: ['Терапия', 'Эндодонтия', 'Цифровой рентген'],
  },
  {
    id: '2', title: 'Дентальный гигиенист', clinic: 'Smile Clinic',
    city: 'Астана', salary: '300 000 — 450 000 ₸',
    type: 'Полная занятость', posted: '5 дней назад',
    description: 'Ищем гигиениста для профилактических процедур и чистки.',
    tags: ['Профилактика', 'Чистка', 'Отбеливание'],
  },
  {
    id: '3', title: 'Врач-ортодонт', clinic: 'Dental Premium',
    city: 'Алматы', salary: '600 000 — 900 000 ₸',
    type: 'Полная занятость', posted: '1 неделю назад',
    description: 'Ортодонт с опытом работы с элайнерами и брекетами.',
    tags: ['Ортодонтия', 'Элайнеры', 'Брекеты'],
  },
  {
    id: '4', title: 'Ассистент стоматолога', clinic: 'MedDent',
    city: 'Шымкент', salary: '200 000 — 300 000 ₸',
    type: 'Полная занятость', posted: '3 дня назад',
    description: 'Ассистент врача с опытом работы в стоматологии.',
    tags: ['Ассистент', 'Стерилизация', 'Подготовка'],
  },
  {
    id: '5', title: 'Врач-хирург-имплантолог', clinic: 'Implant Center',
    city: 'Алматы', salary: '800 000 — 1 200 000 ₸',
    type: 'Частичная занятость', posted: '1 день назад',
    description: 'Хирург-имплантолог для проведения операций по установке имплантов.',
    tags: ['Хирургия', 'Имплантация', 'Синус-лифтинг'],
  },
]

const TAG_COLORS: Record<string, string> = {
  'Терапия': 'gold', 'Эндодонтия': 'info', 'Цифровой рентген': 'info',
  'Профилактика': 'success', 'Чистка': 'success', 'Отбеливание': 'success',
  'Ортодонтия': 'warning', 'Элайнеры': 'warning', 'Брекеты': 'warning',
  'Ассистент': 'default', 'Стерилизация': 'default', 'Подготовка': 'default',
  'Хирургия': 'error', 'Имплантация': 'gold', 'Синус-лифтинг': 'error',
}

export default function JobsPage() {
  const { user } = useAuth()
  const [search, setSearch] = useState('')

  const filtered = MOCK_VACANCIES.filter(v =>
    !search || v.title.toLowerCase().includes(search.toLowerCase()) ||
    v.clinic.toLowerCase().includes(search.toLowerCase()) ||
    v.city.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="max-w-4xl mx-auto space-y-6">
      <motion.div variants={item}>
        <PageHeader
          title="Вакансии"
          subtitle="Поиск сотрудников в стоматологии"
          icon={<Briefcase size={20} className="text-dv-gold" />}
        />
      </motion.div>

      {/* Search & Filters */}
      <motion.div variants={item} className="flex gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск вакансий..."
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-white/[0.03] border border-bdr-subtle text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:border-dv-gold/50 transition-colors"
          />
        </div>
        <Button variant="secondary" size="sm" icon={<Filter size={14} />}>Фильтры</Button>
      </motion.div>

      {/* Stats */}
      <motion.div variants={item} className="grid grid-cols-3 gap-3">
        {[
          { label: 'Вакансий', value: filtered.length, icon: <Briefcase size={16} /> },
          { label: 'Клиник', value: '4', icon: <Building2 size={16} /> },
          { label: 'Городов', value: '3', icon: <MapPin size={16} /> },
        ].map(stat => (
          <Card key={stat.label} className="p-3">
            <div className="flex items-center gap-2">
              <span className="text-dv-gold">{stat.icon}</span>
              <div>
                <p className="text-lg font-bold text-txt-primary">{stat.value}</p>
                <p className="text-2xs text-txt-muted">{stat.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </motion.div>

      {/* Vacancy list */}
      <div className="space-y-3">
        {filtered.map((vacancy, i) => (
          <motion.div key={vacancy.id} variants={item}>
            <Card className="hover:border-dv-gold/20 transition-colors group cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-semibold text-txt-primary group-hover:text-dv-gold transition-colors">
                        {vacancy.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-txt-muted mb-2">
                      <span className="flex items-center gap-1"><Building2 size={12} /> {vacancy.clinic}</span>
                      <span className="flex items-center gap-1"><MapPin size={12} /> {vacancy.city}</span>
                      <span className="flex items-center gap-1"><Clock size={12} /> {vacancy.posted}</span>
                    </div>
                    <p className="text-sm text-txt-secondary mb-2 line-clamp-2">{vacancy.description}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="gold" size="xs"><DollarSign size={10} className="mr-0.5" /> {vacancy.salary}</Badge>
                      <Badge variant="outline" size="xs">{vacancy.type}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {vacancy.tags.map(tag => (
                        <Badge key={tag} variant={(TAG_COLORS[tag] || 'default') as any} size="xs">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-txt-muted group-hover:text-dv-gold transition-colors mt-1 shrink-0" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-txt-muted text-sm">Вакансии не найдены</p>
        </Card>
      )}
    </motion.div>
  )
}
