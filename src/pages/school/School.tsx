import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GraduationCap, Search, Star, Users, Clock, BookOpen, Play, Brain,
  Stethoscope, Award, Building2, Radio, Briefcase, Sparkles, CheckCircle2,
  Microscope, FileText, ArrowRight, MapPin, Calendar,
} from 'lucide-react'
import * as api from '@/utils/api'
import { useAuth } from '@/store/auth.store'
import { Card, CardContent } from '@/components/ui/ds/Card'
import { Input } from '@/components/ui/ds/Input'
import { Badge } from '@/components/ui/ds/Badge'
import { Button } from '@/components/ui/ds/Button'
import { EmptyState } from '@/components/ui/ds/EmptyState'
import { PageHeader, StatCard } from '@/components/ui/ds/StatCard'
import { Modal } from '@/components/ui/ds/Modal'
import { useToast } from '@/components/ui/ds/Toast'

type TabId = 'overview' | 'webinars' | 'office' | 'courses' | 'teachers' | 'academies' | 'cases' | 'certs' | 'portfolio' | 'homework'

const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: 'overview', label: 'Обзор', icon: <Sparkles size={14} /> },
  { id: 'webinars', label: 'Вебинары', icon: <Radio size={14} /> },
  { id: 'office', label: 'Офис-курсы', icon: <MapPin size={14} /> },
  { id: 'courses', label: 'Онлайн-треки', icon: <BookOpen size={14} /> },
  { id: 'teachers', label: 'Преподаватели', icon: <Users size={14} /> },
  { id: 'academies', label: 'Академии', icon: <Building2 size={14} /> },
  { id: 'cases', label: 'Кейсы', icon: <Stethoscope size={14} /> },
  { id: 'certs', label: 'Сертификация', icon: <Award size={14} /> },
  { id: 'portfolio', label: 'Портфолио', icon: <Briefcase size={14} /> },
  { id: 'homework', label: 'AI-проверка', icon: <Brain size={14} /> },
]

const LEVEL_LABEL: Record<string, string> = {
  NEW: 'Новый',
  VERIFIED: 'Проверен',
  EXPERT: 'Эксперт',
  INTERNATIONAL_SPEAKER: 'International',
}

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }

function fmtPrice(price?: number, currency = 'KZT') {
  if (price == null) return '—'
  return `${Number(price).toLocaleString('ru-RU')} ${currency === 'KZT' ? '₸' : currency}`
}

export default function School() {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState<TabId>('overview')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [hub, setHub] = useState<any>(null)
  const [certs, setCerts] = useState<any[]>([])
  const [portfolio, setPortfolio] = useState<any>(null)
  const [buyingId, setBuyingId] = useState<string | null>(null)

  const [hwOpen, setHwOpen] = useState(false)
  const [hwForm, setHwForm] = useState({ title: '', notes: '', category: 'Эндодонтия', imageCount: '3' })
  const [hwResult, setHwResult] = useState<any>(null)
  const [hwSaving, setHwSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const hubData = await api.getAcademyHub()
      setHub(hubData)
      if (isAuthenticated) {
        const [c, p] = await Promise.all([
          api.getSchoolCertificates(user?.id || '').catch(() => []),
          api.getMyProfile().catch(() => null),
        ])
        setCerts(Array.isArray(c) ? c : (c?.data || []))
        setPortfolio(p)
      }
    } catch {
      try {
        const [webinars, officeCourses, courses] = await Promise.all([
          api.getSchoolWebinars().catch(() => []),
          api.getSchoolOfficeCourses().catch(() => []),
          api.getSchoolCourses().catch(() => []),
        ])
        setHub({
          kpis: {
            webinars: webinars.length,
            officeCourses: officeCourses.length,
            courses: courses.length,
            academies: 0,
            lecturers: 0,
            cases: 0,
            certificates: 0,
          },
          webinars,
          officeCourses,
          courses: Array.isArray(courses) ? courses : [],
          academies: [],
          lecturers: [],
          cases: [],
          library: [],
          live: webinars,
          certificates: [],
        })
      } catch {
        setHub(null)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [isAuthenticated]) // eslint-disable-line react-hooks/exhaustive-deps

  const courses = hub?.courses || []
  const lecturers = hub?.lecturers || []
  const academies = hub?.academies || []
  const cases = hub?.cases || []
  const webinars = hub?.webinars || hub?.live || []
  const officeCourses = hub?.officeCourses || []
  const kpis = hub?.kpis || {}

  const filteredCourses = useMemo(() => {
    if (!search) return courses
    const q = search.toLowerCase()
    return courses.filter((c: any) =>
      c.title?.toLowerCase().includes(q)
      || c.description?.toLowerCase().includes(q)
      || c.instructor?.toLowerCase().includes(q)
      || c.category?.toLowerCase().includes(q),
    )
  }, [courses, search])

  const filteredWebinars = useMemo(() => {
    if (!search) return webinars
    const q = search.toLowerCase()
    return webinars.filter((w: any) =>
      w.title?.toLowerCase().includes(q)
      || w.lecturer?.toLowerCase().includes(q)
      || w.category?.toLowerCase().includes(q)
      || w.city?.toLowerCase().includes(q),
    )
  }, [webinars, search])

  const filteredOffice = useMemo(() => {
    if (!search) return officeCourses
    const q = search.toLowerCase()
    return officeCourses.filter((o: any) =>
      o.title?.toLowerCase().includes(q)
      || o.lecturer?.toLowerCase().includes(q)
      || o.category?.toLowerCase().includes(q)
      || o.city?.toLowerCase().includes(q),
    )
  }, [officeCourses, search])

  const buy = async (productId: string, format: 'webinar' | 'office') => {
    if (!isAuthenticated) {
      toast.error('Войдите, чтобы купить место')
      navigate('/login')
      return
    }
    setBuyingId(productId)
    try {
      const res = await api.registerAcademyProduct({ productId, format })
      toast.success(res.message || 'Место забронировано')
    } catch (e: any) {
      toast.error(e?.message || 'Не удалось забронировать')
    } finally {
      setBuyingId(null)
    }
  }

  const submitHomework = async () => {
    if (!hwForm.notes.trim()) { toast.error('Опишите кейс'); return }
    setHwSaving(true)
    try {
      const result = await api.reviewSchoolHomework({
        title: hwForm.title,
        notes: hwForm.notes,
        category: hwForm.category,
        imageCount: Number(hwForm.imageCount) || 0,
      })
      setHwResult(result)
      toast.success(result.verdict || 'Проверка завершена')
    } catch (e: any) {
      toast.error(e?.message || 'Не удалось проверить')
    } finally {
      setHwSaving(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-[1100px] mx-auto space-y-5">
      <PageHeader
        title="Academy OS"
        subtitle="Вебинары и офис-курсы · сертификация · портфолио врача"
        icon={<GraduationCap size={22} />}
        actions={
          <div className="flex gap-2 flex-wrap justify-end">
            <Button size="sm" variant="secondary" onClick={() => navigate('/school-workspace')}>
              Кабинет лектора
            </Button>
            <Button size="sm" onClick={() => setTab('webinars')} icon={<Radio size={14} />}>
              Купить вебинар
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setTab('office')} icon={<MapPin size={14} />}>
              Офис-курсы
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Вебинары" value={kpis.webinars || webinars.length} icon={<Radio size={16} />} />
        <StatCard label="Офис-курсы" value={kpis.officeCourses || officeCourses.length} icon={<MapPin size={16} />} />
        <StatCard label="Преподаватели" value={kpis.lecturers || lecturers.length} icon={<Users size={16} />} />
        <StatCard label="Академии" value={kpis.academies || academies.length} icon={<Building2 size={16} />} />
        <StatCard label="Онлайн-треки" value={kpis.courses || courses.length} icon={<BookOpen size={16} />} />
        <StatCard label="Сертификаты" value={certs.length || kpis.certificates || 0} icon={<Award size={16} />} />
      </div>

      <div className="relative max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск вебинаров, офис-курсов, городов…" className="pl-9" />
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-white/[0.06]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === t.id ? 'border-[#C9A96E] text-[#C9A96E]' : 'border-transparent text-[#7A8899] hover:text-white'
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-9 w-9 rounded-full border-[3px] border-[#C9A96E]/30 border-t-[#C9A96E] animate-spin" />
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {tab === 'overview' && (
              <>
                <Card className="border-[#C9A96E]/20 bg-gradient-to-br from-[#C9A96E]/10 to-transparent">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start gap-3">
                      <Radio className="text-[#C9A96E] shrink-0" size={20} />
                      <div>
                        <p className="text-sm font-semibold text-white">Главный продукт — вебинары и офис-курсы</p>
                        <p className="text-sm text-[#A8B4C0] mt-1">
                          Онлайн-треки и кейсы поддерживают обучение. Деньги и спрос — в вебинарах и очных hands-on.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => setTab('webinars')}>Вебинары</Button>
                      <Button size="sm" variant="secondary" onClick={() => setTab('office')}>Офис-курсы</Button>
                      <Button size="sm" variant="secondary" onClick={() => { setTab('homework'); setHwOpen(true) }}>AI-проверка ДЗ</Button>
                    </div>
                  </CardContent>
                </Card>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-white">Ближайшие вебинары</p>
                    <button className="text-xs text-[#C9A96E] bg-transparent border-none cursor-pointer" onClick={() => setTab('webinars')}>
                      Все <ArrowRight size={10} className="inline" />
                    </button>
                  </div>
                  <div className="space-y-3">
                    {webinars.slice(0, 3).map((w: any) => (
                      <CommerceCard
                        key={w.id}
                        item={w}
                        kind="webinar"
                        buying={buyingId === w.id}
                        onBuy={() => buy(w.id, 'webinar')}
                      />
                    ))}
                    {webinars.length === 0 && <p className="text-sm text-[#7A8899]">Вебинары появятся здесь</p>}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-white">Офис-курсы (hands-on)</p>
                    <button className="text-xs text-[#C9A96E] bg-transparent border-none cursor-pointer" onClick={() => setTab('office')}>
                      Все <ArrowRight size={10} className="inline" />
                    </button>
                  </div>
                  <div className="space-y-3">
                    {officeCourses.slice(0, 3).map((o: any) => (
                      <CommerceCard
                        key={o.id}
                        item={o}
                        kind="office"
                        buying={buyingId === o.id}
                        onBuy={() => buy(o.id, 'office')}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}

            {tab === 'webinars' && (
              <div className="space-y-3">
                <p className="text-sm text-[#7A8899]">Платные live-вебинары с записью и материалами. Основной онлайн-формат продаж.</p>
                {filteredWebinars.map((w: any) => (
                  <CommerceCard key={w.id} item={w} kind="webinar" buying={buyingId === w.id} onBuy={() => buy(w.id, 'webinar')} />
                ))}
                {filteredWebinars.length === 0 && (
                  <EmptyState icon={<Radio size={28} />} title="Вебинаров не найдено" description="Измените поиск или дату." />
                )}
              </div>
            )}

            {tab === 'office' && (
              <div className="space-y-3">
                <p className="text-sm text-[#7A8899]">Очные hands-on: место, материалы, сертификат. Основной офлайн-формат продаж.</p>
                {filteredOffice.map((o: any) => (
                  <CommerceCard key={o.id} item={o} kind="office" buying={buyingId === o.id} onBuy={() => buy(o.id, 'office')} />
                ))}
                {filteredOffice.length === 0 && (
                  <EmptyState icon={<MapPin size={28} />} title="Офис-курсов не найдено" description="Попробуйте другой город или категорию." />
                )}
              </div>
            )}

            {tab === 'courses' && (
              <div className="space-y-3">
                <p className="text-sm text-[#7A8899]">Онлайн-треки дополняют вебинары и офис-курсы: модули, экзамен, сертификат.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredCourses.map((c: any) => (
                    <CourseCard key={c.id} course={c} onOpen={() => navigate(`/school/${c.id}`)} />
                  ))}
                </div>
                {filteredCourses.length === 0 && (
                  <EmptyState icon={<BookOpen size={28} />} title="Треков пока нет" description="Преподаватели добавят программы в кабинете лектора." />
                )}
              </div>
            )}

            {tab === 'teachers' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {lecturers.length === 0 ? (
                  <div className="col-span-full">
                    <EmptyState
                      icon={<Users size={28} />}
                      title="Преподаватели подключаются"
                      description="Лекторы продают вебинары и офис-курсы через кабинет."
                      action={<Button size="sm" onClick={() => navigate('/school-workspace')}>Кабинет лектора</Button>}
                    />
                  </div>
                ) : lecturers.map((l: any) => (
                  <Card key={l.id}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-white">{l.name}</p>
                          <p className="text-xs text-[#7A8899]">{l.academyName || 'Независимый лектор'}</p>
                        </div>
                        <Badge size="xs" variant="gold">{LEVEL_LABEL[l.level] || l.level}</Badge>
                      </div>
                      {l.bio && <p className="text-xs text-[#A8B4C0] line-clamp-3">{l.bio}</p>}
                      <p className="text-xs text-[#7A8899]">{l.courses} программ</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {tab === 'academies' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {academies.length === 0 ? (
                  <div className="col-span-full">
                    <EmptyState icon={<Building2 size={28} />} title="Академии скоро появятся" description="Учебные центры публикуют офис-курсы и вебинары." />
                  </div>
                ) : academies.map((a: any) => (
                  <Card key={a.id}>
                    <CardContent className="p-4">
                      <p className="text-sm font-semibold text-white">{a.name}</p>
                      <p className="text-xs text-[#7A8899] mt-1">{a.city || 'Онлайн'} · {a.lecturers} лекторов · {a.courses} программ</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {tab === 'cases' && (
              <div className="space-y-3">
                {cases.map((c: any) => (
                  <Card key={c.id}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-white">{c.title}</p>
                        <Badge size="xs">{c.category}</Badge>
                        {c.difficulty && <Badge size="xs" variant="gold">{c.difficulty}</Badge>}
                      </div>
                      <p className="text-sm text-[#A8B4C0]">{c.description}</p>
                      <p className="text-xs text-[#7A8899]">Диагноз: {c.diagnosis} · {c.author}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {tab === 'certs' && (
              <div className="space-y-3">
                <p className="text-sm text-[#7A8899]">
                  Сертификат — после офис-курса или экзамена трека. Попадает в портфолио врача.
                </p>
                {(certs.length ? certs : hub?.certificates || []).length === 0 ? (
                  <EmptyState
                    icon={<Award size={28} />}
                    title="Сертификатов пока нет"
                    description="Пройдите офис-курс или сдайте экзамен онлайн-трека."
                    action={<Button size="sm" onClick={() => setTab('office')}>К офис-курсам</Button>}
                  />
                ) : (certs.length ? certs : hub.certificates).map((c: any) => (
                  <Card key={c.id}>
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="text-emerald-400" size={18} />
                        <div>
                          <p className="text-sm font-semibold text-white">{c.title || c.courseTitle}</p>
                          <p className="text-xs text-[#7A8899]">
                            {c.category || 'Курс'} · {c.issuedAt ? new Date(c.issuedAt).toLocaleDateString('ru-RU') : 'выдан'}
                          </p>
                        </div>
                      </div>
                      <Badge size="xs" variant="success">Сертифицирован</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {tab === 'portfolio' && (
              <div className="space-y-4">
                <Card>
                  <CardContent className="p-5 space-y-3">
                    <p className="text-sm font-semibold text-white">Портфолио врача</p>
                    <p className="text-sm text-[#A8B4C0]">
                      Сертификаты с офис-курсов и экзаменов собираются в профиль — его видят клиники и Вакансии.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <MiniStat icon={<Award size={14} />} label="Сертификаты" value={String(certs.length)} />
                      <MiniStat icon={<Radio size={14} />} label="Вебинары" value={String(webinars.length)} />
                      <MiniStat icon={<MapPin size={14} />} label="Офис" value={String(officeCourses.length)} />
                      <MiniStat icon={<Microscope size={14} />} label="Навыки" value={String(portfolio?.skills?.length || '—')} />
                    </div>
                    <Button onClick={() => navigate('/profile')} icon={<Briefcase size={14} />}>
                      Открыть полный профиль
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {tab === 'homework' && (
              <div className="max-w-xl space-y-4">
                <Card>
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <Brain className="text-[#C9A96E]" size={18} />
                      <p className="text-sm font-semibold text-white">AI-проверка домашних работ</p>
                    </div>
                    <p className="text-sm text-[#A8B4C0]">
                      После вебинара или офис-курса опишите кейс — AI оценит протокол и фотопротокол.
                    </p>
                    <Input label="Название работы" value={hwForm.title} onChange={(e) => setHwForm({ ...hwForm, title: e.target.value })} placeholder="Ревизия 16 зуба" />
                    <Input label="Категория" value={hwForm.category} onChange={(e) => setHwForm({ ...hwForm, category: e.target.value })} />
                    <Input label="Число фото" type="number" value={hwForm.imageCount} onChange={(e) => setHwForm({ ...hwForm, imageCount: e.target.value })} />
                    <label className="text-xs text-[#7A8899] block">Описание кейса</label>
                    <textarea
                      value={hwForm.notes}
                      onChange={(e) => setHwForm({ ...hwForm, notes: e.target.value })}
                      rows={5}
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white"
                      placeholder="Жалобы, диагноз (МКБ), протокол, материалы…"
                    />
                    <Button loading={hwSaving} onClick={submitHomework} icon={<Sparkles size={14} />}>
                      Проверить работу
                    </Button>
                  </CardContent>
                </Card>

                {hwResult && (
                  <Card className="border-emerald-500/20">
                    <CardContent className="p-5 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-white">{hwResult.verdict}</p>
                        <Badge variant="gold" size="xs">{hwResult.score}/100</Badge>
                      </div>
                      {(hwResult.feedback || []).map((f: string, i: number) => (
                        <p key={i} className="text-sm text-emerald-100/90">✓ {f}</p>
                      ))}
                      {(hwResult.suggestions || []).map((s: string, i: number) => (
                        <p key={i} className="text-sm text-amber-100/90">→ {s}</p>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      <Modal open={hwOpen} onClose={() => setHwOpen(false)} title="AI-проверка ДЗ">
        <p className="text-sm text-txt-secondary mb-3">Перейдите во вкладку «AI-проверка» для полного разбора.</p>
        <Button onClick={() => { setHwOpen(false); setTab('homework') }}>Открыть</Button>
      </Modal>
    </div>
  )
}

function CommerceCard({
  item,
  kind,
  buying,
  onBuy,
}: {
  item: any
  kind: 'webinar' | 'office'
  buying?: boolean
  onBuy: () => void
}) {
  const seatsLeft = Math.max(0, (item.seats || 0) - (item.enrolled || 0))
  return (
    <Card>
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {kind === 'webinar' ? (
              <Badge size="xs" variant="gold">Вебинар</Badge>
            ) : (
              <Badge size="xs" variant="gold">Офис-курс</Badge>
            )}
            <Badge size="xs">{item.category}</Badge>
            {item.certificate && <Badge size="xs" variant="success">Сертификат</Badge>}
          </div>
          <p className="text-sm font-semibold text-white">{item.title}</p>
          <p className="text-xs text-[#7A8899]">
            {item.lecturer}
            {item.academy ? ` · ${item.academy}` : ''}
          </p>
          <div className="flex flex-wrap gap-3 text-[11px] text-[#7A8899]">
            <span className="flex items-center gap-1">
              <Calendar size={11} />
              {new Date(item.startsAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
            {kind === 'webinar' ? (
              <span className="flex items-center gap-1"><Clock size={11} /> {item.durationMin} мин</span>
            ) : (
              <>
                <span className="flex items-center gap-1"><MapPin size={11} /> {item.city}</span>
                <span className="flex items-center gap-1"><Clock size={11} /> {item.durationDays} дн.</span>
              </>
            )}
            <span>{item.enrolled}/{item.seats} мест · осталось {seatsLeft}</span>
          </div>
          {kind === 'office' && item.venue && (
            <p className="text-[11px] text-[#7A8899] truncate">{item.venue}</p>
          )}
          {Array.isArray(item.includes) && item.includes.length > 0 && (
            <p className="text-[11px] text-[#A8B4C0]">{item.includes.slice(0, 3).join(' · ')}</p>
          )}
        </div>
        <div className="shrink-0 text-left sm:text-right space-y-2">
          <p className="text-lg font-bold text-[#C9A96E]">{fmtPrice(item.price, item.currency)}</p>
          <Button size="sm" loading={buying} disabled={seatsLeft <= 0} onClick={onBuy}>
            {seatsLeft <= 0 ? 'Нет мест' : kind === 'office' ? 'Забронировать' : 'Купить место'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function CourseCard({ course, onOpen }: { course: any; onOpen: () => void }) {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show">
      <Card className="cursor-pointer hover:border-[#C9A96E]/30 transition-colors" onClick={onOpen}>
        <CardContent className="p-4 space-y-2">
          <div className="h-24 rounded-lg bg-gradient-to-br from-[#C9A96E]/20 to-[#1a2a40] flex items-center justify-center">
            <Play size={22} className="text-[#C9A96E]/70" />
          </div>
          <Badge size="xs">{course.category || 'Трек'}</Badge>
          <p className="text-sm font-semibold text-white line-clamp-2">{course.title}</p>
          <p className="text-xs text-[#7A8899] truncate">{course.instructor || course.academyName || 'Academy OS'}</p>
          <div className="flex items-center gap-3 text-[11px] text-[#7A8899]">
            <span className="flex items-center gap-1"><Star size={11} className="text-[#C9A96E]" /> {course.rating || 4.8}</span>
            <span className="flex items-center gap-1"><Clock size={11} /> {course.duration_hours || course.lesson_count || 0} ч</span>
            <span className="flex items-center gap-1"><FileText size={11} /> {course.lesson_count || 0} ур.</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-[#C9A96E] mb-1">{icon}</div>
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-[11px] text-[#7A8899]">{label}</p>
    </div>
  )
}
