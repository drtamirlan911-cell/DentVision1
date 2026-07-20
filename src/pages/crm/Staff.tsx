import React, { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Users, UserPlus, Shield, Stethoscope, Briefcase, Crown, Phone, Mail,
  Calendar, Lock, Edit, Eye, EyeOff, Clock, Award, Settings, Copy, Check, Link2,
} from 'lucide-react'
import { useAuth, ORG_ROLES, canManageClinicSettings } from '@/store/auth.store'
import { useDataQuery } from '@/queries/useDataQuery'
import { queryKeys } from '@/queries/keys'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/ds/Toast'
import * as api from '@/utils/api'
import { Button } from '../../components/ui/ds/Button'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/ds/Card'
import { Input, Textarea, Select } from '../../components/ui/ds/Input'
import { Badge } from '../../components/ui/ds/Badge'
import { Modal } from '../../components/ui/ds/Modal'
import { EmptyState } from '../../components/ui/ds/EmptyState'
import { PageHeader } from '../../components/ui/ds/StatCard'
import { Avatar } from '../../components/ui/ds/Avatar'
import { VISIBILITY_OPTIONS } from '../../utils/constants'
import { cn } from '../../lib/utils'
import type { User as UserType, Clinic, RoleInfo } from '../../types'

const ROLE_OPTIONS = [
  { value: 'doctor', label: 'Врач' },
  { value: 'assistant', label: 'Ассистент' },
  { value: 'admin', label: 'Администратор' },
  { value: 'director', label: 'Руководитель' },
]

const INVITE_ROLE_OPTIONS = [
  { value: 'doctor', label: 'Врач' },
  { value: 'assistant', label: 'Ассистент' },
  { value: 'admin', label: 'Администратор' },
  { value: 'director', label: 'Руководитель' },
]

const ROLE_ICON: Record<string, React.ReactNode> = {
  director: <Crown size={18} />,
  admin: <Briefcase size={18} />,
  doctor: <Stethoscope size={18} />,
  assistant: <Shield size={18} />,
}

const ROLE_BADGE: Record<string, string> = {
  director: 'gold',
  admin: 'info',
  doctor: 'success',
  assistant: 'default',
}

const ROLE_LABELS: Record<string, string> = {
  director: 'Руководитель',
  admin: 'Администратор',
  doctor: 'Врач',
  assistant: 'Ассистент',
}

const SPECS = [
  { value: '', label: '--- Без специализации ---' },
  { value: 'Терапевт', label: 'Терапевт' },
  { value: 'Ортопед', label: 'Ортопед' },
  { value: 'Хирург', label: 'Хирург' },
  { value: 'Ортодонт', label: 'Ортодонт' },
  { value: 'Пародонтолог', label: 'Пародонтолог' },
  { value: 'Детский стоматолог', label: 'Детский стоматолог' },
  { value: 'Имплантолог', label: 'Имплантолог' },
  { value: 'Ассистент', label: 'Ассистент' },
  { value: 'Администратор', label: 'Администратор' },
]

const PAGE_ICONS: Record<string, string> = {
  dashboard: 'Дашборд', schedule: 'Расписание', patients: 'Пациенты', 'medical-card': 'Карта',
  cashier: 'Финансы',
  finance: 'Финансы',
  'clinic-settings': 'Настройки клиники',
  pricelist: 'Прайс', lab: 'Лаборатория', ai: 'AI', staff: 'Сотрудники',
  promotions: 'Акции', inventory: 'Склад', shop: 'Магазин', school: 'Школа',
  analytics: 'Аналитика', settings: 'Настройки', reminders: 'Напоминания',
  admin: 'Админ', audit: 'Аудит', backup: 'Бэкап',
}

const ROLE_DESC: Record<string, string> = {
  director: 'Полный доступ: расписание, пациенты, финансы/касса, лаборатория, AI, персонал, настройки клиники.',
  admin: 'Администратор выполняет кассу и запись: расписание, пациенты, финансы, склад, персонал, настройки клиники.',
  doctor: 'Доступ: своё расписание, пациенты, лаборатория, AI. Видит только свои записи.',
  assistant: 'Ограниченный доступ: расписание (только просмотр), базовая информация о пациентах. Не может редактировать данные.',
}

interface OutletContext {
  clinic: Clinic & { id: string; name: string }
  user: UserType
  roleInfo?: RoleInfo
}

interface StaffForm {
  name: string
  login: string
  password: string
  role: string
  spec: string
  phone: string
  email: string
  bio: string
  photoUrl: string
  visibility: string
  experienceYears: number | string
  workSchedule?: {
    start: string
    end: string
    workDays: string[]
  }
}

const EMPTY_FORM: StaffForm = {
  name: '', login: '', password: '', role: 'doctor', spec: '', phone: '',
  email: '', bio: '', photoUrl: '', visibility: 'public', experienceYears: 0,
}

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.03 } } }
const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }

export default function Staff() {
  const { clinic, user } = useOutletContext<OutletContext>()
  const { roleInfo, role, activeMembership } = useAuth()
  const queryClient = useQueryClient()
  const clinicId = clinic?.id || user?.clinicId || ''
  const { users: staff } = useDataQuery(clinicId)
  const { toast, showToast, clearToast } = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'doctor', expiresInDays: 7 })
  const [inviteResult, setInviteResult] = useState<{ code: string; email?: string | null; role?: string } | null>(null)
  const [inviteSaving, setInviteSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [profileModal, setProfileModal] = useState<UserType | null>(null)
  const [form, setForm] = useState<StaffForm>(EMPTY_FORM)
  const [filter, setFilter] = useState('all')
  const [editingStaff, setEditingStaff] = useState<UserType | null>(null)
  const filtered = filter === 'all' ? staff : staff.filter(s => s.role === filter)

  const canManage =
    !!roleInfo?.canAddStaff ||
    canManageClinicSettings(role) ||
    canManageClinicSettings(activeMembership?.role)

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    const clinicId = clinic?.id || user?.clinicId
    if (!clinicId) {
      showToast('Выберите клинику', 'warning')
      return
    }
    setInviteSaving(true)
    try {
      const inv = await api.createInvitation({
        clinicId,
        email: inviteForm.email.trim() || undefined,
        role: inviteForm.role,
        expiresInDays: Number(inviteForm.expiresInDays) || 7,
      })
      const code = inv?.code
      if (!code) throw new Error('Сервер не вернул код приглашения')
      setInviteResult({ code, email: inv.email, role: inv.role })
      showToast('Приглашение создано', 'success')
    } catch (err: any) {
      showToast(err?.message || 'Не удалось создать приглашение', 'error')
    } finally {
      setInviteSaving(false)
    }
  }

  const copyInviteCode = async () => {
    if (!inviteResult?.code) return
    try {
      await navigator.clipboard.writeText(inviteResult.code)
      setCopied(true)
      showToast('Код скопирован', 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast('Не удалось скопировать', 'warning')
    }
  }

  const openInvite = () => {
    setInviteForm({ email: '', role: 'doctor', expiresInDays: 7 })
    setInviteResult(null)
    setCopied(false)
    setInviteOpen(true)
  }

  const refreshStaff = () => {
    queryClient.invalidateQueries({ queryKey: [...queryKeys.users, clinicId] })
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!clinicId) {
      showToast('Выберите клинику', 'warning')
      return
    }

    if (editingStaff) {
      if (!form.name.trim()) {
        showToast('Укажите ФИО', 'warning')
        return
      }
      try {
        await api.updateClinicStaff(clinicId, editingStaff.id, {
          name: form.name.trim(),
          phone: form.phone || undefined,
          role: form.role,
          spec: form.spec || undefined,
          password: form.password && form.password.length >= 6 ? form.password : undefined,
        })
        showToast('Сотрудник обновлён', 'success')
        setModalOpen(false)
        setForm(EMPTY_FORM)
        setEditingStaff(null)
        refreshStaff()
      } catch (err: any) {
        showToast(err?.message || 'Не удалось сохранить', 'error')
      }
      return
    }

    if (!form.name || !form.login || !form.password) {
      showToast('Заполните все обязательные поля', 'warning')
      return
    }
    if (form.password.length < 6) {
      showToast('Пароль должен быть не менее 6 символов', 'warning')
      return
    }
    try {
      const email = form.email?.trim() || `${form.login.trim().toLowerCase()}@dentvision.local`
      await api.upsertClinicStaff(clinicId, {
        email,
        password: form.password,
        name: form.name.trim(),
        phone: form.phone || undefined,
        role: form.role,
        spec: form.spec || undefined,
      })
      showToast(`${ROLE_LABELS[form.role] || 'Сотрудник'} добавлен`, 'success')
      setModalOpen(false)
      setForm(EMPTY_FORM)
      setEditingStaff(null)
      refreshStaff()
    } catch (err: any) {
      showToast(err?.message || 'Не удалось добавить сотрудника', 'error')
    }
  }

  const openEditStaff = (member: UserType) => {
    setEditingStaff(member)
    setForm({
      name: member.name || '',
      login: member.login || '',
      password: '',
      role: member.role || 'doctor',
      spec: member.spec || '',
      phone: member.phone || '',
      email: member.email || '',
      bio: (member as any).bio || '',
      photoUrl: member.photoUrl || '',
      visibility: member.visibility || 'public',
      experienceYears: member.experienceYears || 0,
      workSchedule: (member as any).workSchedule || { start: '09:00', end: '18:00', workDays: ['пн', 'вт', 'ср', 'чт', 'пт'] },
    })
    setModalOpen(true)
  }

  const inviteModal = (
    <Modal
      open={inviteOpen}
      onClose={() => setInviteOpen(false)}
      title="Пригласить сотрудника"
      size="md"
    >
      {inviteResult ? (
        <div className="space-y-4">
          <p className="text-sm text-txt-secondary">
            Отправьте код сотруднику. Он войдёт в аккаунт и введёт код в разделе «Мои клиники» → «Вступить по коду».
          </p>
          <div className="p-4 rounded-xl border border-dv-gold/30 bg-dv-gold/5 text-center space-y-2">
            <p className="text-2xs uppercase tracking-wider text-txt-muted">Код приглашения</p>
            <p className="text-2xl font-bold tracking-[0.2em] text-dv-gold font-mono">{inviteResult.code}</p>
            {inviteResult.email && (
              <p className="text-xs text-txt-muted">для {inviteResult.email}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" icon={copied ? <Check size={16} /> : <Copy size={16} />} onClick={copyInviteCode}>
              {copied ? 'Скопировано' : 'Скопировать код'}
            </Button>
            <Button variant="ghost" onClick={() => { setInviteResult(null); setInviteForm({ email: '', role: 'doctor', expiresInDays: 7 }) }}>
              Ещё приглашение
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleInvite} className="space-y-4">
          <Input
            label="Email (необязательно)"
            type="email"
            value={inviteForm.email}
            onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
            placeholder="doctor@example.com"
            icon={<Mail size={16} />}
          />
          <p className="text-2xs text-txt-muted -mt-2">
            Если указать email, код сможет использовать только этот адрес.
          </p>
          <Select
            label="Роль *"
            value={inviteForm.role}
            onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })}
            options={INVITE_ROLE_OPTIONS}
          />
          <div className={cn(
            'p-3 rounded-lg border text-xs text-txt-secondary',
            'bg-white/[0.02] border-bdr-subtle',
          )}>
            {ROLE_DESC[inviteForm.role] || 'Доступ определяется выбранной ролью.'}
          </div>
          <Input
            label="Срок действия (дней)"
            type="number"
            value={inviteForm.expiresInDays}
            onChange={e => setInviteForm({ ...inviteForm, expiresInDays: Number(e.target.value) || 7 })}
            min={1}
            max={90}
          />
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" disabled={inviteSaving} icon={<Link2 size={16} />}>
              {inviteSaving ? 'Создание…' : 'Создать приглашение'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setInviteOpen(false)}>Отмена</Button>
          </div>
        </form>
      )}
    </Modal>
  )

  const staffFormModal = (
    <Modal
      open={modalOpen}
      onClose={() => setModalOpen(false)}
      title={editingStaff ? 'Редактировать сотрудника' : 'Добавить сотрудника'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="ФИО *"
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          placeholder="Иванова Мария Сергеевна"
          required
          icon={<Users size={16} />}
        />

        <Select
          label="Роль *"
          value={form.role}
          onChange={e => setForm({ ...form, role: e.target.value })}
          options={ROLE_OPTIONS}
        />

        <div className={cn(
          'p-3 rounded-lg border text-xs text-txt-secondary',
          'bg-white/[0.02] border-bdr-subtle',
        )}>
          {ROLE_DESC[form.role]}
        </div>

        {(form.role === 'doctor' || form.role === 'assistant') && (
          <Select
            label="Специализация"
            value={form.spec}
            onChange={e => setForm({ ...form, spec: e.target.value })}
            options={SPECS}
          />
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Телефон"
            value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })}
            placeholder="+7 777 000 00 00"
            icon={<Phone size={16} />}
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            placeholder="doctor@clinic.kz"
            icon={<Mail size={16} />}
          />
        </div>

        {form.role === 'doctor' && (
          <Input
            label="Стаж (лет)"
            type="number"
            min="0"
            max="60"
            value={form.experienceYears}
            onChange={e => setForm({ ...form, experienceYears: e.target.value })}
            icon={<Award size={16} />}
          />
        )}

        {form.role === 'doctor' && (
          <Textarea
            label="О себе (био)"
            value={form.bio}
            onChange={e => setForm({ ...form, bio: e.target.value })}
            placeholder="Расскажите о себе, образовании, опыте работы..."
            rows={3}
          />
        )}

        {form.role === 'doctor' && (
          <Select
            label="Видимость профиля"
            value={form.visibility}
            onChange={e => setForm({ ...form, visibility: e.target.value })}
            options={VISIBILITY_OPTIONS}
          />
        )}

        {form.role === 'doctor' && (
          <Input
            label="Фото URL"
            value={form.photoUrl}
            onChange={e => setForm({ ...form, photoUrl: e.target.value })}
            placeholder="https://example.com/photo.jpg"
          />
        )}

        {form.role === 'doctor' && (
          <div className="p-3 rounded-lg border border-bdr-subtle bg-white/[0.02]">
            <p className="text-xs font-semibold text-txt-secondary mb-3 flex items-center gap-1.5">
              <Calendar size={14} /> График работы врача
            </p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Input
                label="Начало рабочего дня"
                type="time"
                value={form.workSchedule?.start || '09:00'}
                onChange={e => setForm({ ...form, workSchedule: { ...form.workSchedule!, start: e.target.value } })}
              />
              <Input
                label="Конец рабочего дня"
                type="time"
                value={form.workSchedule?.end || '18:00'}
                onChange={e => setForm({ ...form, workSchedule: { ...form.workSchedule!, end: e.target.value } })}
              />
            </div>
            <p className="text-xs text-txt-muted mb-2">Рабочие дни:</p>
            <div className="flex gap-1.5 flex-wrap">
              {['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map(day => {
                const isSelected = (form.workSchedule?.workDays || ['пн', 'вт', 'ср', 'чт', 'пт']).includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      const current = form.workSchedule?.workDays || ['пн', 'вт', 'ср', 'чт', 'пт']
                      const updated = isSelected ? current.filter(d => d !== day) : [...current, day]
                      setForm({ ...form, workSchedule: { ...form.workSchedule!, workDays: updated } })
                    }}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-md border transition-colors',
                      isSelected
                        ? 'border-dv-gold/50 bg-dv-gold/10 text-dv-gold'
                        : 'border-bdr-subtle bg-transparent text-txt-muted hover:text-txt-secondary'
                    )}
                  >
                    {day.toUpperCase()}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="border-t border-bdr-subtle pt-4">
          <p className="text-xs font-bold text-txt-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Settings size={14} /> Данные для входа
          </p>
          {!editingStaff && (
            <Input
              label="Логин *"
              value={form.login}
              onChange={e => setForm({ ...form, login: e.target.value.toLowerCase().replace(/\s/g, '_') })}
              placeholder="doctor_name"
              required
              icon={<Lock size={16} />}
            />
          )}
          {!editingStaff && (
            <Input
              label="Пароль *"
              type="password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="Минимум 6 символов"
              required
              icon={<Lock size={16} />}
            />
          )}
          {editingStaff && (
            <Input
              label="Новый пароль (необязательно)"
              type="password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="Оставьте пустым, чтобы не менять"
              icon={<Lock size={16} />}
            />
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="submit" className="flex-1">{editingStaff ? 'Сохранить' : 'Добавить сотрудника'}</Button>
          <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Отмена</Button>
        </div>
      </form>
    </Modal>
  )

  const profileDetailModal = (
    <Modal
      open={!!profileModal}
      onClose={() => setProfileModal(null)}
      title="Профиль сотрудника"
      size="md"
    >
      {profileModal && (
        <>
          <div className="flex items-center gap-4 mb-5">
            <Avatar
              name={profileModal.name}
              src={profileModal.photoUrl}
              size="xl"
            />
            <div>
              <p className="text-lg font-bold text-txt-primary">{profileModal.name}</p>
              <div className="flex gap-2 mt-1">
                <Badge variant={ROLE_BADGE[profileModal.role] as any || 'default'}>{ROLE_LABELS[profileModal.role]}</Badge>
                {profileModal.spec && <Badge variant="info">{profileModal.spec}</Badge>}
              </div>
            </div>
          </div>

          <div className="space-y-2.5 text-sm text-txt-secondary">
            {profileModal.phone && (
              <div className="flex items-center gap-2.5">
                <Phone size={14} className="text-txt-muted shrink-0" />
                <span>{profileModal.phone}</span>
              </div>
            )}
            {profileModal.email && (
              <div className="flex items-center gap-2.5">
                <Mail size={14} className="text-txt-muted shrink-0" />
                <span>{profileModal.email}</span>
              </div>
            )}
            {profileModal.experienceYears! > 0 && (
              <div className="flex items-center gap-2.5">
                <Award size={14} className="text-txt-muted shrink-0" />
                <span>Стаж: {profileModal.experienceYears} лет</span>
              </div>
            )}
            {(profileModal as any).bio && (
              <div className="mt-3 p-3 rounded-lg bg-white/[0.02] border border-bdr-subtle text-sm leading-relaxed">
                {(profileModal as any).bio}
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-5">
            {canManage && (
              <Button className="flex-1" icon={<Edit size={16} />} onClick={() => { setProfileModal(null); openEditStaff(profileModal) }}>
                Редактировать
              </Button>
            )}
            <Button variant="ghost" onClick={() => setProfileModal(null)}>Закрыть</Button>
          </div>
        </>
      )}
    </Modal>
  )

  return (
    <div className="p-6">
      <PageHeader
        title="Сотрудники"
        subtitle={`${clinic?.name} · ${staff.length} чел.`}
        icon={<Users size={20} />}
        actions={
          canManage ? (
            <div className="flex gap-2 flex-wrap">
              <Button icon={<Link2 size={16} />} onClick={openInvite}>
                Пригласить
              </Button>
              <Button variant="secondary" icon={<UserPlus size={16} />} onClick={() => { setForm(EMPTY_FORM); setEditingStaff(null); setModalOpen(true) }}>
                Добавить вручную
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* Role count cards */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {Object.entries(ROLE_LABELS).map(([role, label]) => {
          const count = staff.filter(s => s.role === role).length
          return (
            <motion.div key={role} variants={fadeUp}>
              <button
                onClick={() => setFilter(filter === role ? 'all' : role)}
                className={cn(
                  'w-full p-4 rounded-xl border text-center transition-all duration-200',
                  filter === role
                    ? 'border-dv-gold/50 bg-dv-gold/5'
                    : 'border-bdr-subtle bg-surface-raised hover:bg-surface-raised-hover hover:border-bdr/50'
                )}
              >
                <div className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-xl mx-auto mb-2',
                  'bg-white/[0.05]',
                )}>
                  {ROLE_ICON[role]}
                </div>
                <p className="text-2xl font-bold text-txt-primary">{count}</p>
                <p className="text-xs text-txt-muted mt-0.5">{label}</p>
              </button>
            </motion.div>
          )
        })}
      </motion.div>

      {/* Staff grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users size={32} />}
          title="Нет сотрудников"
          description={canManage ? 'Добавьте первого сотрудника' : 'Нет данных'}
          action={
            canManage ? (
              <Button icon={<Link2 size={16} />} onClick={openInvite}>
                Пригласить
              </Button>
            ) : undefined
          }
        />
      ) : (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          {filtered.map(member => {
            const isCurrentUser = member.id === user?.id
            return (
              <motion.div key={member.id} variants={fadeUp}>
                <Card
                  hover
                  padding="none"
                  className="overflow-hidden cursor-pointer group"
                  onClick={() => setProfileModal(member)}
                >
                  <div className="p-4">
                    {/* Top row */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={member.name}
                          src={member.photoUrl}
                          size="lg"
                          status="online"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-txt-primary group-hover:text-dv-gold transition-colors truncate">
                            {member.name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Badge variant={ROLE_BADGE[member.role] as any || 'default'} size="sm">
                              {ROLE_LABELS[member.role] || member.role}
                            </Badge>
                            {member.visibility === 'private' && (
                              <Badge variant="warning" size="sm">
                                <Lock size={10} /> Приватный
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      {isCurrentUser && (
                        <Badge variant="gold" size="xs">Вы</Badge>
                      )}
                    </div>

                    {/* Details */}
                    <div className="space-y-1.5 text-xs text-txt-secondary">
                      {member.spec && (
                        <div className="flex items-center gap-2">
                          <Stethoscope size={12} className="text-txt-muted shrink-0" />
                          <span>{member.spec}</span>
                        </div>
                      )}
                      {member.email && (
                        <div className="flex items-center gap-2">
                          <Mail size={12} className="text-txt-muted shrink-0" />
                          <span className="truncate">{member.email}</span>
                        </div>
                      )}
                      {member.experienceYears! > 0 && (
                        <div className="flex items-center gap-2">
                          <Award size={12} className="text-txt-muted shrink-0" />
                          <span>Стаж: {member.experienceYears} {member.experienceYears === 1 ? 'год' : member.experienceYears! < 5 ? 'года' : 'лет'}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Lock size={12} className="text-txt-muted shrink-0" />
                        <span className="font-mono text-txt-secondary">{member.login}</span>
                      </div>
                      {member.phone && (
                        <div className="flex items-center gap-2">
                          <Phone size={12} className="text-txt-muted shrink-0" />
                          <span>{member.phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Bio preview */}
                    {(member as any).bio && (
                      <div className="mt-3 p-2.5 text-xs text-txt-secondary leading-relaxed rounded-lg bg-white/[0.02] border border-bdr-subtle line-clamp-2">
                        {(member as any).bio.length > 120 ? (member as any).bio.slice(0, 120) + '...' : (member as any).bio}
                      </div>
                    )}

                    {/* Access summary */}
                    <div className="mt-3 p-2.5 rounded-lg bg-white/[0.02] border border-bdr-subtle">
                      <p className="text-2xs font-bold text-txt-muted uppercase tracking-wider mb-2">Доступ</p>
                      <div className="flex gap-1 flex-wrap">
                        {(ORG_ROLES[member.role]?.pages || []).slice(0, 8).map(p => (
                          <Badge key={p} variant="default" size="xs">{PAGE_ICONS[p] || p}</Badge>
                        ))}
                        {(ORG_ROLES[member.role]?.pages || []).length > 8 && (
                          <Badge variant="default" size="xs">+{ORG_ROLES[member.role]!.pages.length - 8}</Badge>
                        )}
                      </div>
                    </div>

                    {/* Edit button */}
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full mt-3"
                        icon={<Edit size={14} />}
                        onClick={(e) => { e.stopPropagation(); openEditStaff(member) }}
                      >
                        Редактировать
                      </Button>
                    )}
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {inviteModal}
      {staffFormModal}
      {profileDetailModal}
    </div>
  )
}
