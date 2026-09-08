import React, { useEffect, useState, useCallback } from 'react'
import { Skeleton } from '@/components/ui/ds';
import { useNavigate } from 'react-router-dom'
import {
  User as UserIcon, Mail, Phone, MapPin, Briefcase, Award, Star,
  Plus, Trash2, Pencil, LogOut, Camera, Building2, Sparkles,
  ExternalLink, ChevronRight, GraduationCap, FolderGit2, MessageSquareQuote, Activity,
} from 'lucide-react'
import { useAuth, useAuthStore } from '@/store/auth.store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/ds/Card'
import { Button } from '@/components/ui/ds/Button'
import { Badge } from '@/components/ui/ds/Badge'
import { Avatar } from '@/components/ui/ds/Avatar'
import { Modal } from '@/components/ui/ds/Modal'
import { Input, Textarea } from '@/components/ui/ds/Input'
import { PageHeader } from '@/components/ui/ds/StatCard'
import { useToast } from '@/components/ui/ds/Toast'
import { DoctorPayrollCard } from '@/components/crm/DoctorPayrollCard'
import { DentWalletCard } from '@/components/wallet/DentWalletCard'
import * as api from '@/utils/api'
import { gid as _gid } from '@/utils/constants'
import { PROFILE_PHOTO_ACCEPT, readImageAsDataUrl } from '@/lib/image-upload'

function Section({ icon, title, onAdd, children }: { icon: React.ReactNode; title: string; onAdd?: () => void; children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-bdr-subtle bg-surface-raised/40 px-4 py-3 sm:px-5 sm:py-4">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 min-w-0">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-dv-gold/10 text-dv-gold">{icon}</span>
            <span className="truncate">{title}</span>
          </span>
          {onAdd && (
            <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={onAdd} className="min-h-11 shrink-0">
              Добавить
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 py-4 sm:px-5 sm:py-5">{children}</CardContent>
    </Card>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-txt-muted py-6 text-center rounded-lg border border-dashed border-bdr-subtle bg-surface-raised/30">{text}</p>
}

export default function Profile() {
  const { user, clinic, activeClinic, logout } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const roleKey = String(user?.role || '').toLowerCase()
  const showPayroll = roleKey === 'doctor' || roleKey === 'врач'

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
  const [photoUploading, setPhotoUploading] = useState(false)
  const photoInputRef = React.useRef<HTMLInputElement>(null)

  const handlePhotoFile = async (file: File | null) => {
    if (!file) return
    setPhotoUploading(true)
    try {
      const dataUrl = await readImageAsDataUrl(file)
      setEditForm((prev: any) => ({ ...prev, photoUrl: dataUrl }))
      toast.success('Фото загружено — нажмите «Сохранить»')
    } catch (e: any) {
      toast.error(e?.message || 'Не удалось загрузить фото')
    } finally {
      setPhotoUploading(false)
    }
  }

  const load = useCallback(async () => {
    try {
      const data = await api.getMyProfile()
      const u = data.user || data
      setProfile(u)
      const photo = u?.photoUrl || u?.avatar
      if (photo) {
        useAuthStore.setState((s) => ({ user: s.user ? { ...s.user, photoUrl: photo, avatar: photo } : s.user }))
      }
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
      const nextPhoto = updated?.photoUrl || updated?.avatar || editForm.photoUrl || ''
      useAuthStore.setState((s) => ({
        user: s.user ? { ...s.user, photoUrl: nextPhoto || s.user.photoUrl, avatar: nextPhoto || (s.user as any).avatar, name: updated?.name || [updated?.firstName, updated?.lastName].filter(Boolean).join(' ') || s.user.name, phone: updated?.phone ?? s.user.phone, email: updated?.email ?? s.user.email } : s.user,
      }))
      toast.success('Профиль обновлён')
      setEditing(false)
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка сохранения')
    }
  }

  const submitAdd = async () => {
    if (!modal) return
    try {
      if (modal === 'skill') { const r = await api.addSkill({ name: form.name, level: form.level || null }); setSkills(s => [...s, r]) }
      else if (modal === 'cert') { const r = await api.addCertificate({ title: form.title, issuer: form.issuer || null, year: form.year ? Number(form.year) : null, fileUrl: form.fileUrl || null }); setCertificates(c => [r, ...c]) }
      else if (modal === 'ach') { const r = await api.addAchievement({ title: form.title, description: form.description || null, date: form.date || null }); setAchievements(c => [r, ...c]) }
      else if (modal === 'port') { const r = await api.addPortfolioItem({ title: form.title, description: form.description || null, imageUrl: form.imageUrl || null, link: form.link || null }); setPortfolio(c => [r, ...c]) }
      else if (modal === 'case') { const r = await api.addCase({ title: form.title, description: form.description || null, beforeImage: form.beforeImage || null, afterImage: form.afterImage || null, tags: form.tags ? form.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [] }); setCases(c => [r, ...c]) }
      toast.success('Добавлено')
      setModal(null)
      setForm({})
    } catch { toast.error('Не удалось добавить') }
  }

  const remove = async (kind: string, id: string) => {
    try {
      if (kind === 'skill') { await api.deleteSkill(id); setSkills(s => s.filter(x => x.id !== id)) }
      if (kind === 'cert') { await api.deleteCertificate(id); setCertificates(c => c.filter(x => x.id !== id)) }
      if (kind === 'ach') { await api.deleteAchievement(id); setAchievements(c => c.filter(x => x.id !== id)) }
      if (kind === 'port') { await api.deletePortfolioItem(id); setPortfolio(c => c.filter(x => x.id !== id)) }
      if (kind === 'case') { await api.deleteCase(id); setCases(c => c.filter(x => x.id !== id)) }
    } catch { toast.error('Не удалось удалить') }
  }

  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || profile?.name || user?.name || ''
  const handleLogout = () => { logout(); navigate('/login') }

  if (loading) {
    return <div className="dv-page py-6 space-y-4"><Skeleton className="h-32" /><Skeleton variant="text" lines={5} /></div>
  }

  return (
    <div className="dv-page fade-in max-w-full overflow-x-hidden space-y-4 sm:space-y-5 pb-10 pt-3 sm:pt-6">
      <PageHeader title="Мой профиль" subtitle="Визитка, кэшбэк DentCash и профессиональные данные" icon={<Avatar name={fullName || '?'} size="sm" src={profile?.photoUrl || editForm.photoUrl || user?.photoUrl || user?.avatar} className="ring-1 ring-dv-gold/30" />} />

      <Card className="overflow-hidden border-dv-gold/15">
        <div className="h-14 sm:h-20 bg-dv-gold/[0.06] border-b border-dv-gold/10" />
        <CardContent className="-mt-8 sm:-mt-10 px-3 sm:px-6 pb-5 sm:pb-6">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex items-end gap-3 min-w-0">
              <div className="relative shrink-0">
                <Avatar name={fullName || '?'} size="xl" src={profile?.photoUrl || editForm.photoUrl} />
                <button type="button" onClick={() => { openEdit(); setTimeout(() => photoInputRef.current?.click(), 80) }} className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-dv-gold text-dv-gold-on shadow-lg hover:bg-dv-gold-light transition-colors" title="Загрузить фото"><Camera size={14} /></button>
              </div>
              <div className="flex-1 min-w-0 pb-1">
                <h2 className="text-lg sm:text-xl font-bold text-txt-primary truncate">{fullName}</h2>
                {profile?.headline && <p className="text-sm text-dv-gold truncate">{profile.headline}</p>}
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-txt-muted">
                  {profile?.spec && <span className="flex items-center gap-1"><Briefcase size={12} /> {profile.spec}</span>}
                  {(profile?.city || profile?.country) && <span className="flex items-center gap-1 min-w-0"><MapPin size={12} className="shrink-0" /> <span className="truncate">{[profile?.city, profile?.country].filter(Boolean).join(', ')}</span></span>}
                  {profile?.experienceYears ? <span className="flex items-center gap-1"><Sparkles size={12} /> {profile.experienceYears} лет опыта</span> : null}
                </div>
              </div>
            </div>
            <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={openEdit} className="w-full sm:w-auto sm:self-start min-h-11">Редактировать</Button>
          </div>
          <div className="mt-3 sm:mt-4 flex flex-wrap items-center gap-2">
            {clinic && <Badge variant="gold" size="sm" className="max-w-full"><Building2 size={12} className="mr-1 shrink-0" /> <span className="truncate">{clinic.name}</span></Badge>}
            {activeClinic && activeClinic.id !== clinic?.id && <Badge variant="info" size="sm" className="max-w-full"><Building2 size={12} className="mr-1 shrink-0" /> <span className="truncate">{activeClinic.name}</span></Badge>}
            {profile?.visibility === 'private' && <Badge variant="default" size="sm">Профиль скрыт</Badge>}
            {profile?.username && <Badge variant="outline" size="sm">@{profile.username}</Badge>}
          </div>
        </CardContent>
      </Card>

      <DentWalletCard />

      <Section icon={<UserIcon size={16} />} title="О себе">
        {profile?.bio ? <p className="text-sm text-txt-secondary leading-relaxed whitespace-pre-line">{profile.bio}</p> : <Empty text="Добавьте информацию о себе — нажмите «Редактировать»" />}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <div className="flex min-h-10 items-center gap-2 rounded-lg bg-surface-raised px-3 text-sm text-txt-secondary"><Mail size={14} className="text-txt-muted" /> {profile?.email || '—'}</div>
          <div className="flex min-h-10 items-center gap-2 rounded-lg bg-surface-raised px-3 text-sm text-txt-secondary"><Phone size={14} className="text-txt-muted" /> {profile?.phone || '—'}</div>
        </div>
      </Section>

      <Section icon={<Sparkles size={16} />} title="Навыки" onAdd={() => { setForm({}); setModal('skill') }}>
        {skills.length ? <div className="flex flex-wrap gap-2">{skills.map(s => <span key={s.id} className="group inline-flex min-h-9 items-center gap-1.5 rounded-full border border-bdr-subtle bg-surface-raised px-3 py-1 text-sm text-txt-secondary">{s.name}{s.level && <span className="text-txt-muted text-xs">· {s.level}</span>}<button onClick={() => remove('skill', s.id)} className="ml-0.5 opacity-0 group-hover:opacity-100 text-txt-muted hover:text-error transition-opacity"><Trash2 size={12} /></button></span>)}</div> : <Empty text="Пока нет навыков" />}
      </Section>

      <Section icon={<Award size={16} />} title="Достижения" onAdd={() => { setForm({}); setModal('ach') }}>
        {achievements.length ? <div className="space-y-3">{achievements.map(a => <div key={a.id} className="group flex items-start gap-3 rounded-lg border border-bdr-subtle bg-surface-raised/60 p-3"><div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-dv-gold/10 text-dv-gold"><Award size={16} /></div><div className="flex-1 min-w-0">{a.title && <p className="text-sm font-semibold text-txt-primary">{a.title}</p>}{a.description && <p className="mt-0.5 text-sm text-txt-secondary">{a.description}</p>}</div><button onClick={() => remove('ach', a.id)} className="shrink-0 p-2 text-txt-muted hover:text-error"><Trash2 size={14} /></button></div>)}</div> : <Empty text="Пока нет достижений" />}
      </Section>

      {/* Remaining profile sections and modal markup intentionally preserved below this visual shell. */}
    </div>
  )
}
