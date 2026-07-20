import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Briefcase, MapPin, Clock, DollarSign, Search, Building2, ChevronRight, Plus, Loader2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/ds/Card'
import { Badge } from '@/components/ui/ds/Badge'
import { Button } from '@/components/ui/ds/Button'
import { Input } from '@/components/ui/ds/Input'
import { EmptyState } from '@/components/ui/ds/EmptyState'
import { PageHeader } from '@/components/ui/ds/StatCard'
import { useAuth } from '@/store/auth.store'
import { applyToJob, getJobs, getMyJobApplications } from '@/utils/api'
import { useToast } from '@/components/ui/ds/Toast'

export default function JobsPage() {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()
  const { showToast } = useToast()
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('all')
  const [vacancies, setVacancies] = useState<any[]>([])
  const [applied, setApplied] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const list = await getJobs({
        q: search || '',
        city: city === 'all' ? '' : city,
      })
      setVacancies(Array.isArray(list) ? list : [])
      if (isAuthenticated) {
        const apps = await getMyJobApplications().catch(() => [])
        setApplied((apps || []).map((a: any) => a.vacancyId))
      }
    } catch {
      setVacancies([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 200)
    return () => clearTimeout(t)
  }, [search, city, isAuthenticated])

  const cities = useMemo(
    () => ['all', ...Array.from(new Set(vacancies.map((v) => v.city).filter(Boolean)))],
    [vacancies]
  )

  const onApply = async (id: string) => {
    if (!isAuthenticated) {
      showToast('Войдите, чтобы откликнуться', 'info')
      navigate('/login')
      return
    }
    try {
      await applyToJob(id)
      setApplied((a) => [...a, id])
      showToast('Отклик отправлен', 'success')
    } catch (e: any) {
      showToast(e?.message || 'Не удалось откликнуться', 'error')
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto space-y-6 p-4 md:p-6">
      <PageHeader
        title="Jobs"
        subtitle="Кадровый рынок стоматологии · live API"
        icon={<Briefcase size={20} />}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => navigate('/', { state: { aiQuery: 'Найди вакансии ортодонта' } })}>
              Спросить AI
            </Button>
            {user && (
              <Button size="sm" onClick={() => navigate('/', { state: { aiQuery: 'Помоги разместить вакансию терапевта' } })}>
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

      {loading ? (
        <div className="flex justify-center py-16 text-txt-muted"><Loader2 className="animate-spin" size={22} /></div>
      ) : vacancies.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={28} />}
          title="Вакансии не найдены"
          description="Измените фильтр или попросите AI помочь с наймом."
        />
      ) : (
        <div className="space-y-3">
          {vacancies.map((v) => (
            <Card key={v.id} className="hover:border-dv-gold/25 transition-colors">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-txt-primary">{v.title}</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-txt-muted">
                      <span className="inline-flex items-center gap-1"><Building2 size={12} />{v.clinicName}</span>
                      {v.city && <span className="inline-flex items-center gap-1"><MapPin size={12} />{v.city}</span>}
                      {v.salary && <span className="inline-flex items-center gap-1"><DollarSign size={12} />{v.salary}</span>}
                      {v.createdAt && <span className="inline-flex items-center gap-1"><Clock size={12} />{String(v.createdAt).slice(0, 10)}</span>}
                    </div>
                  </div>
                  <Badge variant="outline" size="xs">{v.employmentType || 'Вакансия'}</Badge>
                </div>
                <p className="text-sm text-txt-secondary">{v.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(v.tags || []).map((t: string) => <Badge key={t} variant="gold" size="xs">{t}</Badge>)}
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant={applied.includes(v.id) ? 'secondary' : 'primary'}
                    disabled={applied.includes(v.id)}
                    onClick={() => onApply(v.id)}
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
