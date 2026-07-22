import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Briefcase, MapPin, Clock, DollarSign, Search, Building2, ChevronRight, Plus, Loader2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/ds/Card'
import { Badge } from '@/components/ui/ds/Badge'
import { Button } from '@/components/ui/ds/Button'
import { Input, Textarea } from '@/components/ui/ds/Input'
import { EmptyState } from '@/components/ui/ds/EmptyState'
import { PageHeader } from '@/components/ui/ds/StatCard'
import { Modal } from '@/components/ui/ds/Modal'
import { useAuth } from '@/store/auth.store'
import { applyToJob, createJob, getJobs, getMyJobApplications } from '@/utils/api'
import { useToast } from '@/components/ui/ds/Toast'

type PostKind = 'vacancy' | 'resume'

const EMPTY_FORM = {
  title: '',
  clinicName: '',
  city: '',
  salary: '',
  employmentType: 'Полная занятость',
  description: '',
  tags: '',
}

export default function JobsPage() {
  const navigate = useNavigate()
  const { user, clinic, isAuthenticated } = useAuth()
  const { showToast } = useToast()
  const [search, setSearch] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('q') || ''
    } catch {
      return ''
    }
  })
  const [city, setCity] = useState('all')
  const [vacancies, setVacancies] = useState<any[]>([])
  const [applied, setApplied] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const [postOpen, setPostOpen] = useState(false)
  const [postKind, setPostKind] = useState<PostKind>('vacancy')
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('q')
      if (q != null) setSearch(q)
    } catch { /* ignore */ }
  }, [])

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

  const openPost = (kind: PostKind = 'vacancy') => {
    if (!isAuthenticated) {
      showToast('Войдите, чтобы разместить объявление', 'info')
      navigate('/login')
      return
    }
    setPostKind(kind)
    setForm({
      ...EMPTY_FORM,
      clinicName: kind === 'vacancy' ? (clinic?.name || '') : ([user?.firstName, user?.lastName].filter(Boolean).join(' ') || ''),
      employmentType: kind === 'resume' ? 'Ищу работу' : 'Полная занятость',
    })
    setPostOpen(true)
  }

  const submitPost = async () => {
    if (!form.title.trim()) {
      showToast('Укажите должность / заголовок', 'error')
      return
    }
    setSaving(true)
    try {
      await createJob({
        title: form.title.trim(),
        clinicName: form.clinicName.trim() || undefined,
        city: form.city.trim() || undefined,
        salary: form.salary.trim() || undefined,
        employmentType: form.employmentType,
        description: form.description.trim() || undefined,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        kind: postKind,
      })
      showToast(postKind === 'resume' ? 'Резюме опубликовано' : 'Вакансия размещена', 'success')
      setPostOpen(false)
      setForm({ ...EMPTY_FORM })
      await load()
    } catch (e: any) {
      showToast(e?.message || 'Не удалось разместить', 'error')
    } finally {
      setSaving(false)
    }
  }

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
              <Button size="sm" onClick={() => openPost('vacancy')}>
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
          description="Измените фильтр или разместите своё объявление."
          action={user ? <Button size="sm" onClick={() => openPost('vacancy')}>Разместить</Button> : undefined}
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
                  <Badge variant="outline" size="xs">
                    {v.kind === 'resume' ? 'Ищу работу' : (v.employmentType || 'Вакансия')}
                  </Badge>
                </div>
                <p className="text-sm text-txt-secondary">{v.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(v.tags || []).map((t: string) => <Badge key={t} variant="gold" size="xs">{t}</Badge>)}
                </div>
                {v.kind !== 'resume' && (
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
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={postOpen}
        onClose={() => setPostOpen(false)}
        title={postKind === 'resume' ? 'Объявление о поиске работы' : 'Разместить вакансию'}
        size="lg"
      >
        <div className="space-y-3">
          <div className="flex gap-2 mb-1">
            <Button size="sm" variant={postKind === 'vacancy' ? 'primary' : 'secondary'} onClick={() => setPostKind('vacancy')}>
              Вакансия
            </Button>
            <Button size="sm" variant={postKind === 'resume' ? 'primary' : 'secondary'} onClick={() => setPostKind('resume')}>
              Ищу работу
            </Button>
          </div>
          <Input
            label={postKind === 'resume' ? 'Желаемая должность' : 'Должность'}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Напр.: Врач-терапевт"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={postKind === 'resume' ? 'Ваше имя / клиника' : 'Клиника / компания'}
              value={form.clinicName}
              onChange={(e) => setForm({ ...form, clinicName: e.target.value })}
            />
            <Input label="Город" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Алматы" />
            <Input label="Зарплата" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} placeholder="450 000 — 700 000 ₸" />
            <Input
              label="Тип занятости"
              value={form.employmentType}
              onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
            />
          </div>
          <Textarea
            label="Описание"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder={postKind === 'resume' ? 'Опыт, специализация, что ищете…' : 'Требования, условия, оборудование…'}
          />
          <Input
            label="Теги (через запятую)"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            placeholder="Терапия, Эндодонтия"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setPostOpen(false)}>Отмена</Button>
            <Button onClick={submitPost} disabled={saving}>
              {saving ? 'Публикация…' : 'Опубликовать'}
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  )
}
