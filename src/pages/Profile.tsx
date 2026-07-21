import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  User as UserIcon, Mail, Phone, MapPin, Briefcase, Award, Star,
  Plus, Trash2, Pencil, LogOut, Camera, Building2, Sparkles,
  ExternalLink, ChevronRight, GraduationCap, FolderGit2, MessageSquareQuote, Activity,
} from 'lucide-react'
import { useAuth } from '@/store/auth.store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/ds/Card'
import { Button } from '@/components/ui/ds/Button'
import { Badge } from '@/components/ui/ds/Badge'
import { Avatar } from '@/components/ui/ds/Avatar'
import { Modal } from '@/components/ui/ds/Modal'
import { Input, Textarea } from '@/components/ui/ds/Input'
import { PageHeader } from '@/components/ui/ds/StatCard'
import { useToast } from '@/components/ui/ds/Toast'
import * as api from '@/utils/api'
import { gid } from '@/utils/constants'

function Section({ icon, title, onAdd, children }: { icon: React.ReactNode; title: string; onAdd?: () => void; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="text-dv-gold">{icon}</span>
            {title}
          </span>
          {onAdd && (
            <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={onAdd}>
              Добавить
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-txt-muted py-4 text-center">{text}</p>
}

export default function Profile() {
  const { user, clinic, activeClinic, logout } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const [profile, setProfile] = useState<any>(null)
  const [skills, setSkills] = useState<any[]>([])
  const [certificates, setCertificates] = useState<any[]>([])
  const [achievements, setAchievements] = useState<any[]>([])
  const [portfolio, setPortfolio] = useState<any[]>([])
  const [cases, setCases] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<any>({})

  const [modal, setModal] = useState<null | 'skill' | 'cert' | 'ach' | 'port' | 'case'>(null)
  const [form, setForm] = useState<any>({})

  const load = useCallback(async () => {
    try {
      const data = await api.getMyProfile()
      setProfile(data.user || data)
      setSkills(data.skills || [])
      setCertificates(data.certificates || [])
      setAchievements(data.achievements || [])
      setPortfolio(data.portfolio || [])
      setCases(data.cases || [])
      setReviews(data.reviews || [])
      setActivities(data.activities || [])
    } catch {
      toast.error('Не удалось загрузить профиль')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { void load() }, [load])

  const openEdit = () => {
    setEditForm({
      firstName: profile?.firstName || '', lastName: profile?.lastName || '', username: profile?.username || '',
      headline: profile?.headline || '', bio: profile?.bio || '', city: profile?.city || '',
      country: profile?.country || '', spec: profile?.spec || '', experienceYears: profile?.experienceYears || 0,
      phone: profile?.phone || '', email: profile?.email || '', photoUrl: profile?.photoUrl || '',
      visibility: profile?.visibility || 'public',
    })
    setEditing(true)
  }

  const saveProfile = async () => {
    try {
      const updated = await api.updateMyProfile(editForm)
      setProfile((p: any) => ({ ...p, ...updated }))
      toast.success('Профиль обновлён')
      setEditing(false)
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка сохранения')
    }
  }

  const submitAdd = async () => {
    if (!modal) return
    try {
      if (modal === 'skill') {
        const r = await api.addSkill({ name: form.name, level: form.level || null })
        setSkills(s => [...s, r])
      } else if (modal === 'cert') {
        const r = await api.addCertificate({ title: form.title, issuer: form.issuer || null, year: form.year ? Number(form.year) : null, fileUrl: form.fileUrl || null })
        setCertificates(c => [r, ...c])
      } else if (modal === 'ach') {
        const r = await api.addAchievement({ title: form.title, description: form.description || null, date: form.date || null })
        setAchievements(c => [r, ...c])
      } else if (modal === 'port') {
        const r = await api.addPortfolioItem({ title: form.title, description: form.description || null, imageUrl: form.imageUrl || null, link: form.link || null })
        setPortfolio(c => [r, ...c])
      } else if (modal === 'case') {
        const r = await api.addCase({ title: form.title, description: form.description || null, beforeImage: form.beforeImage || null, afterImage: form.afterImage || null, tags: form.tags ? form.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [] })
        setCases(c => [r, ...c])
      }
      toast.success('Добавлено')
      setModal(null)
      setForm({})
    } catch {
      toast.error('Не удалось добавить')
    }
  }

  const remove = async (kind: string, id: string) => {
    try {
      if (kind === 'skill') { await api.deleteSkill(id); setSkills(s => s.filter(x => x.id !== id)) }
      if (kind === 'cert') { await api.deleteCertificate(id); setCertificates(c => c.filter(x => x.id !== id)) }
      if (kind === 'ach') { await api.deleteAchievement(id); setAchievements(c => c.filter(x => x.id !== id)) }
      if (kind === 'port') { await api.deletePortfolioItem(id); setPortfolio(c => c.filter(x => x.id !== id)) }
      if (kind === 'case') { await api.deleteCase(id); setCases(c => c.filter(x => x.id !== id)) }
    } catch {
      toast.error('Не удалось удалить')
    }
  }

  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || profile?.name || user?.name || ''

  const handleLogout = () => { logout(); navigate('/login') }

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-dv-gold/30 border-t-dv-gold" /></div>
  }

  return (
    <div className="fade-in space-y-5 max-w-3xl mx-auto pb-10">
      <PageHeader title="Мой профиль" subtitle="Ваша профессиональная визитная карточка" icon={<UserIcon size={22} className="text-dv-gold" />} />

      {/* ─── Header card ─── */}
      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-dv-gold/30 via-dv-gold/10 to-transparent" />
        <CardContent className="-mt-12 px-6 pb-6">
          <div className="flex items-end gap-4">
            <div className="relative">
              <Avatar name={fullName || '?'} size="xl" src={profile?.photoUrl} />
              <button
                type="button"
                onClick={() => {
                  openEdit()
                  // Focus photo URL field after modal opens
                  setTimeout(() => {
                    const el = document.querySelector<HTMLInputElement>('input[placeholder="https://..."]')
                    el?.focus()
                  }, 50)
                }}
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-dv-gold text-surface-0 shadow-lg hover:bg-dv-gold-light transition-colors"
                title="Сменить фото (URL)"
              >
                <Camera size={14} />
              </button>
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <h2 className="text-xl font-bold text-txt-primary truncate">{fullName}</h2>
              {profile?.headline && <p className="text-sm text-dv-gold truncate">{profile.headline}</p>}
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-txt-muted">
                {profile?.spec && <span className="flex items-center gap-1"><Briefcase size={12} /> {profile.spec}</span>}
                {(profile?.city || profile?.country) && <span className="flex items-center gap-1"><MapPin size={12} /> {[profile?.city, profile?.country].filter(Boolean).join(', ')}</span>}
                {profile?.experienceYears ? <span className="flex items-center gap-1"><Sparkles size={12} /> {profile.experienceYears} лет опыта</span> : null}
              </div>
            </div>
            <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={openEdit}>Редактировать</Button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {clinic && <Badge variant="gold" size="sm"><Building2 size={12} className="mr-1" /> {clinic.name}</Badge>}
            {activeClinic && activeClinic.id !== clinic?.id && <Badge variant="sky" size="sm"><Building2 size={12} className="mr-1" /> {activeClinic.name}</Badge>}
            {profile?.visibility === 'private' && <Badge variant="slate" size="sm">Профиль скрыт</Badge>}
            {profile?.username && <Badge variant="outline" size="sm">@{profile.username}</Badge>}
          </div>
        </CardContent>
      </Card>

      {/* ─── About ─── */}
      <Section icon={<UserIcon size={16} />} title="О себе">
        {profile?.bio ? <p className="text-sm text-txt-secondary leading-relaxed whitespace-pre-line">{profile.bio}</p> : <Empty text="Добавьте информацию о себе — нажмите «Редактировать»" />}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm text-txt-secondary"><Mail size={14} className="text-txt-muted" /> {profile?.email || '—'}</div>
          <div className="flex items-center gap-2 text-sm text-txt-secondary"><Phone size={14} className="text-txt-muted" /> {profile?.phone || '—'}</div>
        </div>
      </Section>

      {/* ─── Skills ─── */}
      <Section icon={<Sparkles size={16} />} title="Навыки" onAdd={() => { setForm({}); setModal('skill') }}>
        {skills.length ? (
          <div className="flex flex-wrap gap-2">
            {skills.map(s => (
              <span key={s.id} className="group inline-flex items-center gap-1.5 rounded-full border border-bdr-subtle bg-white/[0.03] px-3 py-1 text-sm text-txt-secondary">
                {s.name}{s.level && <span className="text-txt-muted text-xs">· {s.level}</span>}
                <button onClick={() => remove('skill', s.id)} className="opacity-0 group-hover:opacity-100 text-txt-muted hover:text-error transition-opacity"><Trash2 size={12} /></button>
              </span>
            ))}
          </div>
        ) : <Empty text="Пока нет навыков" />}
      </Section>

      {/* ─── Experience / Achievements ─── */}
      <Section icon={<Award size={16} />} title="Достижения" onAdd={() => { setForm({}); setModal('ach') }}>
        {achievements.length ? (
          <div className="space-y-3">
            {achievements.map(a => (
              <div key={a.id} className="group flex items-start gap-3 rounded-lg border border-bdr-subtle bg-white/[0.02] p-3">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-dv-gold/10 text-dv-gold"><Award size={16} /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-txt-primary">{a.title}</p>
                  {a.description && <p className="text-xs text-txt-secondary mt-0.5">{a.description}</p>}
                  {a.date && <p className="text-xs text-txt-muted mt-1">{new Date(a.date).toLocaleDateString('ru-RU')}</p>}
                </div>
                <button onClick={() => remove('ach', a.id)} className="opacity-0 group-hover:opacity-100 text-txt-muted hover:text-error transition-opacity"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        ) : <Empty text="Добавьте свои достижения" />}
      </Section>

      {/* ─── Certificates ─── */}
      <Section icon={<GraduationCap size={16} />} title="Сертификаты и обучение" onAdd={() => { setForm({}); setModal('cert') }}>
        {certificates.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {certificates.map(c => (
              <div key={c.id} className="group relative rounded-lg border border-bdr-subtle bg-white/[0.02] p-3">
                <p className="text-sm font-semibold text-txt-primary pr-6">{c.title}</p>
                <p className="text-xs text-txt-secondary mt-0.5">{[c.issuer, c.year].filter(Boolean).join(' · ')}</p>
                {c.fileUrl && <a href={c.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-dv-gold inline-flex items-center gap-1 mt-1 hover:underline"><ExternalLink size={12} /> Файл</a>}
                <button onClick={() => remove('cert', c.id)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-txt-muted hover:text-error transition-opacity"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        ) : <Empty text="Сертификаты не добавлены" />}
      </Section>

      {/* ─── Portfolio ─── */}
      <Section icon={<FolderGit2 size={16} />} title="Портфолио" onAdd={() => { setForm({}); setModal('port') }}>
        {portfolio.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {portfolio.map(p => (
              <div key={p.id} className="group relative rounded-lg border border-bdr-subtle bg-white/[0.02] p-3">
                {p.imageUrl && <img src={p.imageUrl} alt={p.title} className="h-32 w-full object-cover rounded-md mb-2" />}
                <p className="text-sm font-semibold text-txt-primary">{p.title}</p>
                {p.description && <p className="text-xs text-txt-secondary mt-0.5 line-clamp-2">{p.description}</p>}
                {p.link && <a href={p.link} target="_blank" rel="noreferrer" className="text-xs text-dv-gold inline-flex items-center gap-1 mt-1 hover:underline"><ExternalLink size={12} /> Открыть</a>}
                <button onClick={() => remove('port', p.id)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-txt-muted hover:text-error transition-opacity"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        ) : <Empty text="Добавьте работы в портфолио" />}
      </Section>

      {/* ─── Clinical Cases (before/after) ─── */}
      <Section icon={<Activity size={16} />} title="Клинические кейсы" onAdd={() => { setForm({}); setModal('case') }}>
        {cases.length ? (
          <div className="space-y-3">
            {cases.map(k => (
              <div key={k.id} className="group rounded-lg border border-bdr-subtle bg-white/[0.02] p-3">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-semibold text-txt-primary">{k.title}</p>
                  <button onClick={() => remove('case', k.id)} className="opacity-0 group-hover:opacity-100 text-txt-muted hover:text-error transition-opacity"><Trash2 size={14} /></button>
                </div>
                {k.description && <p className="text-xs text-txt-secondary mt-1">{k.description}</p>}
                <div className="mt-2 flex gap-2">
                  {k.beforeImage && <div className="flex-1"><p className="text-[10px] text-txt-muted mb-1">До</p><img src={k.beforeImage} className="h-24 w-full object-cover rounded" /></div>}
                  {k.afterImage && <div className="flex-1"><p className="text-[10px] text-txt-muted mb-1">После</p><img src={k.afterImage} className="h-24 w-full object-cover rounded" /></div>}
                </div>
                {k.tags?.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{k.tags.map((t: string) => <Badge key={t} variant="slate" size="xs">{t}</Badge>)}</div>}
              </div>
            ))}
          </div>
        ) : <Empty text="Покажите свои кейсы (до / после)" />}
      </Section>

      {/* ─── Reviews ─── */}
      {reviews.length > 0 && (
        <Section icon={<MessageSquareQuote size={16} />} title="Отзывы">
          <div className="space-y-3">
            {reviews.map(r => (
              <div key={r.id} className="rounded-lg border border-bdr-subtle bg-white/[0.02] p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-txt-primary">{r.authorName || 'Аноним'}</p>
                  <div className="flex gap-0.5 text-dv-gold">{Array.from({ length: r.rating || 5 }).map((_, i) => <Star key={i} size={12} fill="currentColor" />)}</div>
                </div>
                {r.comment && <p className="text-xs text-txt-secondary mt-1">{r.comment}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ─── Activity ─── */}
      {activities.length > 0 && (
        <Section icon={<Activity size={16} />} title="Активность">
          <div className="space-y-2">
            {activities.map(a => (
              <div key={a.id} className="flex items-center gap-2 text-sm text-txt-secondary">
                <ChevronRight size={14} className="text-dv-gold" />
                <span className="flex-1">{a.title}</span>
                <span className="text-xs text-txt-muted">{new Date(a.createdAt).toLocaleDateString('ru-RU')}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ─── Security ─── */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><LogOut size={16} className="text-dv-gold" /> Безопасность</CardTitle></CardHeader>
        <CardContent>
          <Button variant="danger" icon={<LogOut size={16} />} onClick={handleLogout} className="w-full md:w-auto">Выйти из системы</Button>
        </CardContent>
      </Card>

      {/* ─── Edit modal ─── */}
      <Modal open={editing} onClose={() => setEditing(false)} title="Редактировать профиль" size="lg">
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Имя" value={editForm.firstName} onChange={e => setEditForm({ ...editForm, firstName: e.target.value })} />
            <Input label="Фамилия" value={editForm.lastName} onChange={e => setEditForm({ ...editForm, lastName: e.target.value })} />
            <Input label="Username (для публичной ссылки)" value={editForm.username} onChange={e => setEditForm({ ...editForm, username: e.target.value.replace(/\s/g, '') })} />
            <Input label="Специализация" value={editForm.spec} onChange={e => setEditForm({ ...editForm, spec: e.target.value })} />
            <Input label="Город" value={editForm.city} onChange={e => setEditForm({ ...editForm, city: e.target.value })} />
            <Input label="Страна" value={editForm.country} onChange={e => setEditForm({ ...editForm, country: e.target.value })} />
            <Input label="Телефон" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
            <Input label="Email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
            <Input label="URL фото" value={editForm.photoUrl} onChange={e => setEditForm({ ...editForm, photoUrl: e.target.value })} placeholder="https://..." />
            <Input label="Опыт (лет)" type="number" value={editForm.experienceYears} onChange={e => setEditForm({ ...editForm, experienceYears: Number(e.target.value) })} />
          </div>
          <Input label="Заголовок (headline)" value={editForm.headline} onChange={e => setEditForm({ ...editForm, headline: e.target.value })} placeholder="Напр.: Врач-ортопед, имплантолог" />
          <Textarea label="О себе" value={editForm.bio} onChange={e => setEditForm({ ...editForm, bio: e.target.value })} />
          <div>
            <label className="block text-xs font-medium text-txt-secondary mb-1.5">Видимость профиля</label>
            <select value={editForm.visibility} onChange={e => setEditForm({ ...editForm, visibility: e.target.value })} className="flex h-9 w-full rounded-lg border border-bdr-subtle bg-white/[0.03] px-3 py-2 text-sm text-txt-primary">
              <option value="public">Публичный</option>
              <option value="private">Скрытый</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setEditing(false)}>Отмена</Button>
            <Button variant="primary" icon={<Pencil size={14} />} onClick={saveProfile}>Сохранить</Button>
          </div>
        </div>
      </Modal>

      {/* ─── Add modals ─── */}
      <Modal open={modal === 'skill'} onClose={() => setModal(null)} title="Добавить навык">
        <div className="space-y-3">
          <Input label="Название" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Напр.: Эстетическая реставрация" />
          <Input label="Уровень (необязательно)" value={form.level || ''} onChange={e => setForm({ ...form, level: e.target.value })} placeholder="Напр.: Продвинутый" />
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setModal(null)}>Отмена</Button><Button variant="primary" icon={<Plus size={14} />} onClick={submitAdd}>Добавить</Button></div>
        </div>
      </Modal>

      <Modal open={modal === 'cert'} onClose={() => setModal(null)} title="Добавить сертификат">
        <div className="space-y-3">
          <Input label="Название" value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} />
          <Input label="Кто выдал" value={form.issuer || ''} onChange={e => setForm({ ...form, issuer: e.target.value })} />
          <Input label="Год" type="number" value={form.year || ''} onChange={e => setForm({ ...form, year: e.target.value })} />
          <Input label="URL файла (необязательно)" value={form.fileUrl || ''} onChange={e => setForm({ ...form, fileUrl: e.target.value })} />
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setModal(null)}>Отмена</Button><Button variant="primary" icon={<Plus size={14} />} onClick={submitAdd}>Добавить</Button></div>
        </div>
      </Modal>

      <Modal open={modal === 'ach'} onClose={() => setModal(null)} title="Добавить достижение">
        <div className="space-y-3">
          <Input label="Название" value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} />
          <Textarea label="Описание" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />
          <Input label="Дата" type="date" value={form.date || ''} onChange={e => setForm({ ...form, date: e.target.value })} />
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setModal(null)}>Отмена</Button><Button variant="primary" icon={<Plus size={14} />} onClick={submitAdd}>Добавить</Button></div>
        </div>
      </Modal>

      <Modal open={modal === 'port'} onClose={() => setModal(null)} title="Добавить работу в портфолио">
        <div className="space-y-3">
          <Input label="Название" value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} />
          <Textarea label="Описание" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />
          <Input label="URL изображения" value={form.imageUrl || ''} onChange={e => setForm({ ...form, imageUrl: e.target.value })} />
          <Input label="Ссылка" value={form.link || ''} onChange={e => setForm({ ...form, link: e.target.value })} />
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setModal(null)}>Отмена</Button><Button variant="primary" icon={<Plus size={14} />} onClick={submitAdd}>Добавить</Button></div>
        </div>
      </Modal>

      <Modal open={modal === 'case'} onClose={() => setModal(null)} title="Добавить клинический кейс">
        <div className="space-y-3">
          <Input label="Название" value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} />
          <Textarea label="Описание" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />
          <Input label="Фото «До» (URL)" value={form.beforeImage || ''} onChange={e => setForm({ ...form, beforeImage: e.target.value })} />
          <Input label="Фото «После» (URL)" value={form.afterImage || ''} onChange={e => setForm({ ...form, afterImage: e.target.value })} />
          <Input label="Теги (через запятую)" value={form.tags || ''} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="имплантация, эстетика" />
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setModal(null)}>Отмена</Button><Button variant="primary" icon={<Plus size={14} />} onClick={submitAdd}>Добавить</Button></div>
        </div>
      </Modal>
    </div>
  )
}
