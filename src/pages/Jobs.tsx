import React, { useEffect, useState } from 'react'
import { ListSkeleton } from '@/components/ui/ds';
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
import { CityFilter } from '@/components/ui/CityFilter'
import { useAuth } from '@/store/auth.store'
import { applyToJob, createJob, createEmployerVacancy, getJobs, getMyJobApplications, getMyJobResumes, updateMyJobResumeStatus } from '@/utils/api'
import { useToast } from '@/components/ui/ds/Toast'

type PostKind = 'vacancy' | 'resume'
type JobApplicationSummary = {
  id: string;
  vacancyId: string;
  coverNote?: string;
  status: string;
  createdAt?: string;
  vacancy?: {
    id: string;
    title: string;
    clinicName?: string;
    city?: string;
    salary?: string;
    employmentType?: string;
    status?: string;
  };
}
const APPLICATION_STATUS_LABEL: Record<string, string> = {
  new: 'Новый',
  reviewing: 'На рассмотрении',
  interview: 'Собеседование',
  offer: 'Предложение',
  hired: 'Принят',
  rejected: 'Отклонён',
}
type JobResume = {
  id: string;
  title: string;
  city: string;
  salary?: string;
  employmentType?: string;
  description?: string;
  tags?: string[];
  status: 'open' | 'closed' | string;
  createdAt?: string;
}

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
  const { user, clinic, isAuthenticated, activeWorkspace } = useAuth()
  const { showToast } = useToast()
  const [search, setSearch] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('q') || ''
    } catch {
      return ''
    }
  })
  const [city, setCity] = useState('')
  const [vacancies, setVacancies] = useState<any[]>([])
  const [applied, setApplied] = useState<string[]>([])
  const [myApplications, setMyApplications] = useState<JobApplicationSummary[]>([])
  const [myResumes, setMyResumes] = useState<JobResume[]>([])
  const [resumeBusyId, setResumeBusyId] = useState<string | null>(null)
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
        city: city || '',
      })
      setVacancies(Array.isArray(list) ? list : [])
      if (isAuthenticated) {
        const [apps, resumes] = await Promise.all([
          getMyJobApplications().catch(() => []),
          getMyJobResumes().catch(() => []),
        ])
        setApplied((apps || []).map((a: any) => a.vacancyId))
        setMyApplications(Array.isArray(apps) ? apps as JobApplicationSummary[] : [])
        setMyResumes(Array.isArray(resumes) ? resumes : [])
      } else {
        setApplied([])
        setMyApplications([])
        setMyResumes([])
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, city, isAuthenticated])

  const openPost = (kind: PostKind = 'vacancy') => {
    if (!isAuthenticated) {
      showToast('Войдите, чтобы разместить объявление', 'info')
      navigate('/login')
      return
    }
    if (kind === 'vacancy') {
      const hasEmployerContext = activeWorkspace?.scopeType === 'EMPLOYER';
      const hasClinicContext = activeWorkspace?.scopeType === 'CLINIC' || !!clinic?.id;
      if (!hasEmployerContext && !hasClinicContext) {
        navigate('/onboarding?mode=create&kind=employer')
        return
      }
      navigate('/employer')
      return
    }
    setPostKind(kind)
    setForm({
      ...EMPTY_FORM,
      clinicName: user?.name || '',
      city: city || clinic?.city || '',
      employmentType: kind === 'resume' ? 'Ищу работу' : 'Полная занятость',
    })
    setPostOpen(true)
  }

  const submitPost = async () => {
    if (!form.title.trim()) {
      showToast('Укажите должность / заголовок', 'error')
      return
    }
    if (!form.city.trim()) {
      showToast('Выберите город', 'error')
      return
    }
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        city: form.city.trim(),
        salary: form.salary.trim() || undefined,
        employmentType: postKind === 'resume' ? 'Ищу работу' : form.employmentType,
        description: form.description.trim() || undefined,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      }
      if (postKind === 'resume') await createJob({ ...payload, kind: 'resume' })
      else await createEmployerVacancy(payload)
      showToast(postKind === 'resume' ? 'Резюме опубликовано' : 'Вакансия размещена', 'success')
      setPostOpen(false)
      setForm({ ...EMPTY_FORM })
      setCity(form.city.trim())
      await load()
    } catch (e: any) {
      showToast(e?.message || 'Не удалось разместить', 'error')
    } finally {
      setSaving(false)
    }
  }

  const changeResumeVisibility = async (resume: JobResume) => {
    const nextStatus = resume.status === 'open' ? 'closed' : 'open'
    setResumeBusyId(resume.id)
    try {
      await updateMyJobResumeStatus(resume.id, nextStatus)
      setMyResumes((current) => current.map((item) => item.id === resume.id ? { ...item, status: nextStatus } : item))
      showToast(nextStatus === 'open' ? 'Резюме снова видно работодателям' : 'Резюме снято с публикации', 'success')
    } catch (e: any) {
      showToast(e?.message || 'Не удалось изменить видимость резюме', 'error')
    } finally {
      setResumeBusyId(null)
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
      const applications = await getMyJobApplications().catch(() => [])
      setMyApplications(Array.isArray(applications) ? applications as JobApplicationSummary[] : [])
      showToast('Отклик отправлен', 'success')
    } catch (e: any) {
      showToast(e?.message || 'Не удалось откликнуться', 'error')
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-full md:max-w-5xl mx-auto space-y-6 p-4 md:p-6 overflow-x-hidden">
      <PageHeader
        title="Jobs"
        subtitle="Кадровый рынок стоматологии · live API"
        icon={<Briefcase size={20} />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11" size="sm" variant="secondary" onClick={() => navigate('/career')}>
              Мой карьерный кабинет
            </Button>
            <Button className="min-h-11" size="sm" variant="secondary" onClick={() => navigate('/', { state: { aiQuery: 'Найди вакансии ортодонта' } })}>
              Спросить AI
            </Button>
            {(activeWorkspace?.scopeType === 'EMPLOYER' || activeWorkspace?.scopeType === 'CLINIC') && (
              <Button className="min-h-11" size="sm" variant="secondary" onClick={() => navigate('/employer')}>
                Кабинет работодателя
              </Button>
            )}
            {user && (
              <>
                <Button className="min-h-11" size="sm" variant="secondary" onClick={() => openPost('resume')}>
                  <Plus size={14} className="mr-1.5" />
                  Опубликовать резюме
                </Button>
                <Button className="min-h-11" size="sm" onClick={() => openPost('vacancy')}>
                  <Plus size={14} className="mr-1.5" />
                  Разместить вакансию
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Должность, клиника…" className="pl-9" />
        </div>
        <div className="rounded-xl border border-bdr-subtle bg-white/[0.02] p-3">
          <CityFilter
            label="Город"
            value={city}
            onChange={setCity}
            showPopularChips
          />
        </div>
      </div>

      {loading ? (
        <ListSkeleton count={5} />
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
                      className="min-h-11"
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

      {isAuthenticated && (
        <Card className="border border-bdr-subtle">
          <CardContent className="p-4 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-txt-primary">Мои отклики</h2>
              <p className="text-xs text-txt-muted">Актуальные этапы рассмотрения от работодателей</p>
            </div>
            {myApplications.length === 0 ? (
              <p className="text-sm text-txt-muted">Вы ещё не откликались на вакансии.</p>
            ) : (
              <div className="space-y-2">
                {myApplications.map((application) => (
                  <div key={application.id} className="rounded-xl border border-bdr-subtle p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-txt-primary">
                          {application.vacancy?.title || 'Вакансия'}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-txt-muted">
                          {application.vacancy?.clinicName && <span>{application.vacancy.clinicName}</span>}
                          {application.vacancy?.city && <span>{application.vacancy.city}</span>}
                          {application.createdAt && <span>{String(application.createdAt).slice(0, 10)}</span>}
                        </div>
                      </div>
                      <Badge variant="outline" size="xs">
                        {APPLICATION_STATUS_LABEL[application.status] || application.status}
                      </Badge>
                    </div>
                    {application.coverNote && (
                      <p className="mt-2 whitespace-pre-wrap text-xs text-txt-secondary">{application.coverNote}</p>
                    )}
                    {application.vacancy?.status === 'closed' && (
                      <p className="mt-2 text-xs text-txt-muted">Вакансия закрыта</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isAuthenticated && (
        <Card className="border border-bdr-subtle">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-txt-primary">Мои резюме</h2>
                <p className="text-xs text-txt-muted">Управляйте видимостью резюме для работодателей</p>
              </div>
              <Button className="min-h-11" size="sm" variant="secondary" onClick={() => openPost('resume')}>
                <Plus size={14} className="mr-1.5" /> Новое резюме
              </Button>
            </div>
            {myResumes.length === 0 ? (
              <p className="text-sm text-txt-muted">Вы ещё не публиковали резюме.</p>
            ) : (
              <div className="space-y-2">
                {myResumes.map((resume) => (
                  <div key={resume.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bdr-subtle p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-txt-primary">{resume.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-txt-muted">
                        {resume.city && <span>{resume.city}</span>}
                        {resume.salary && <span>{resume.salary}</span>}
                        <Badge variant="outline" size="xs">
                          {resume.status === 'open' ? 'Опубликовано' : 'Скрыто'}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      className="min-h-11"
                      size="sm"
                      variant="secondary"
                      loading={resumeBusyId === resume.id}
                      disabled={!!resumeBusyId}
                      onClick={() => void changeResumeVisibility(resume)}
                    >
                      {resume.status === 'open' ? 'Снять с публикации' : 'Опубликовать'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-txt-muted">Скрытые резюме остаются в вашем аккаунте, но не показываются работодателям.</p>
          </CardContent>
        </Card>
      )}

      <Modal
        open={postOpen}
        onClose={() => setPostOpen(false)}
        title={postKind === 'resume' ? 'Объявление о поиске работы' : 'Разместить вакансию'}
        size="lg"
        className="lg:max-w-xl xl:max-w-2xl"
      >
        <div className="space-y-3">
          <div className="flex gap-2 mb-1">
            <Button className="min-h-11" size="sm" variant={postKind === 'vacancy' ? 'primary' : 'secondary'} onClick={() => { setPostOpen(false); openPost('vacancy') }}>
              Вакансия
            </Button>
            <Button className="min-h-11" size="sm" variant={postKind === 'resume' ? 'primary' : 'secondary'} onClick={() => setPostKind('resume')}>
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
            <div className="sm:col-span-1">
              <CityFilter
                label="Город *"
                value={form.city}
                onChange={(c) => setForm({ ...form, city: c })}
                required
                showPopularChips={false}
              />
            </div>
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
            <Button className="min-h-11" variant="secondary" onClick={() => setPostOpen(false)}>Отмена</Button>
            <Button className="min-h-11" onClick={submitPost} disabled={saving}>
              {saving ? 'Публикация…' : 'Опубликовать'}
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  )
}
