import React, { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Users, UserPlus, Shield, Stethoscope, Briefcase, Crown, Phone, Mail,
  Calendar, Lock, Edit, Eye, EyeOff, Clock, Award, Settings,
} from 'lucide-react'
import { useAuth, ROLES } from '../../context/AuthContext'
import { useToast } from '../../hooks/useData'
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
  { value: 'doctor', label: '╨Т╤А╨░╤З' },
  { value: 'assistant', label: '╨Р╤Б╤Б╨╕╤Б╤В╨╡╨╜╤В' },
  { value: 'admin', label: '╨Р╨┤╨╝╨╕╨╜╨╕╤Б╤В╤А╨░╤В╨╛╤А' },
  { value: 'director', label: '╨а╤Г╨║╨╛╨▓╨╛╨┤╨╕╤В╨╡╨╗╤М' },
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
  director: '╨а╤Г╨║╨╛╨▓╨╛╨┤╨╕╤В╨╡╨╗╤М',
  admin: '╨Р╨┤╨╝╨╕╨╜╨╕╤Б╤В╤А╨░╤В╨╛╤А',
  doctor: '╨Т╤А╨░╤З',
  assistant: '╨Р╤Б╤Б╨╕╤Б╤В╨╡╨╜╤В',
}

const SPECS = [
  { value: '', label: '--- ╨С╨╡╨╖ ╤Б╨┐╨╡╤Ж╨╕╨░╨╗╨╕╨╖╨░╤Ж╨╕╨╕ ---' },
  { value: '╨в╨╡╤А╨░╨┐╨╡╨▓╤В', label: '╨в╨╡╤А╨░╨┐╨╡╨▓╤В' },
  { value: '╨Ю╤А╤В╨╛╨┐╨╡╨┤', label: '╨Ю╤А╤В╨╛╨┐╨╡╨┤' },
  { value: '╨е╨╕╤А╤Г╤А╨│', label: '╨е╨╕╤А╤Г╤А╨│' },
  { value: '╨Ю╤А╤В╨╛╨┤╨╛╨╜╤В', label: '╨Ю╤А╤В╨╛╨┤╨╛╨╜╤В' },
  { value: '╨Я╨░╤А╨╛╨┤╨╛╨╜╤В╨╛╨╗╨╛╨│', label: '╨Я╨░╤А╨╛╨┤╨╛╨╜╤В╨╛╨╗╨╛╨│' },
  { value: '╨Ф╨╡╤В╤Б╨║╨╕╨╣ ╤Б╤В╨╛╨╝╨░╤В╨╛╨╗╨╛╨│', label: '╨Ф╨╡╤В╤Б╨║╨╕╨╣ ╤Б╤В╨╛╨╝╨░╤В╨╛╨╗╨╛╨│' },
  { value: '╨Ш╨╝╨┐╨╗╨░╨╜╤В╨╛╨╗╨╛╨│', label: '╨Ш╨╝╨┐╨╗╨░╨╜╤В╨╛╨╗╨╛╨│' },
  { value: '╨Р╤Б╤Б╨╕╤Б╤В╨╡╨╜╤В', label: '╨Р╤Б╤Б╨╕╤Б╤В╨╡╨╜╤В' },
  { value: '╨Р╨┤╨╝╨╕╨╜╨╕╤Б╤В╤А╨░╤В╨╛╤А', label: '╨Р╨┤╨╝╨╕╨╜╨╕╤Б╤В╤А╨░╤В╨╛╤А' },
]

const PAGE_ICONS: Record<string, string> = {
  dashboard: '╨Ф╨░╤И╨▒╨╛╤А╨┤', schedule: '╨а╨░╤Б╨┐╨╕╤Б╨░╨╜╨╕╨╡', patients: '╨Я╨░╤Ж╨╕╨╡╨╜╤В╤Л', 'medical-card': '╨Ъ╨░╤А╤В╨░',
  visits: '╨Т╨╕╨╖╨╕╤В╤Л', icd10: '╨Ь╨Ъ╨С-10', documents: '╨Ф╨╛╨║╤Г╨╝╨╡╨╜╤В╤Л', cashier: '╨Ъ╨░╤Б╤Б╨░',
  pricelist: '╨Я╤А╨░╨╣╤Б', lab: '╨Ы╨░╨▒╨╛╤А╨░╤В╨╛╤А╨╕╤П', ai: 'AI', staff: '╨б╨╛╤В╤А╤Г╨┤╨╜╨╕╨║╨╕',
  promotions: '╨Р╨║╤Ж╨╕╨╕', inventory: '╨б╨║╨╗╨░╨┤', shop: '╨Ь╨░╨│╨░╨╖╨╕╨╜', school: '╨и╨║╨╛╨╗╨░',
  analytics: '╨Р╨╜╨░╨╗╨╕╤В╨╕╨║╨░', settings: '╨Э╨░╤Б╤В╤А╨╛╨╣╨║╨╕', reminders: '╨Э╨░╨┐╨╛╨╝╨╕╨╜╨░╨╜╨╕╤П',
  admin: '╨Р╨┤╨╝╨╕╨╜', audit: '╨Р╤Г╨┤╨╕╤В', backup: '╨С╤Н╨║╨░╨┐',
}

const ROLE_DESC: Record<string, string> = {
  director: '╨Я╨╛╨╗╨╜╤Л╨╣ ╨┤╨╛╤Б╤В╤Г╨┐: Dashboard, ╤А╨░╤Б╨┐╨╕╤Б╨░╨╜╨╕╨╡, ╨┐╨░╤Ж╨╕╨╡╨╜╤В╤Л, ╤Д╨╕╨╜╨░╨╜╤Б╤Л, ╨╗╨░╨▒╨╛╤А╨░╤В╨╛╤А╨╕╤П, AI, ╨┐╨╡╤А╤Б╨╛╨╜╨░╨╗. ╨Т╨╕╨┤╨╕╤В ╨╖╨░╤А╨┐╨╗╨░╤В╤Л ╨╕ ╤А╨░╤Б╤Е╨╛╨┤╤Л.',
  admin: '╨Ф╨╛╤Б╤В╤Г╨┐: ╤А╨░╤Б╨┐╨╕╤Б╨░╨╜╨╕╨╡, ╨┐╨░╤Ж╨╕╨╡╨╜╤В╤Л, ╨║╨░╤Б╤Б╨░, ╨╗╨░╨▒╨╛╤А╨░╤В╨╛╤А╨╕╤П. ╨Э╨╡ ╨▓╨╕╨┤╨╕╤В ╨╖╨░╤А╨┐╨╗╨░╤В╤Л ╨╕ ╨┐╨╛╨┤╤А╨╛╨▒╨╜╤Г╤О ╨░╨╜╨░╨╗╨╕╤В╨╕╨║╤Г.',
  doctor: '╨Ф╨╛╤Б╤В╤Г╨┐: ╤Б╨▓╨╛╤С ╤А╨░╤Б╨┐╨╕╤Б╨░╨╜╨╕╨╡, ╨┐╨░╤Ж╨╕╨╡╨╜╤В╤Л, ╨╗╨░╨▒╨╛╤А╨░╤В╨╛╤А╨╕╤П, AI. ╨Т╨╕╨┤╨╕╤В ╤В╨╛╨╗╤М╨║╨╛ ╤Б╨▓╨╛╨╕ ╨╖╨░╨┐╨╕╤Б╨╕.',
  assistant: '╨Ю╨│╤А╨░╨╜╨╕╤З╨╡╨╜╨╜╤Л╨╣ ╨┤╨╛╤Б╤В╤Г╨┐: ╤А╨░╤Б╨┐╨╕╤Б╨░╨╜╨╕╨╡ (╤В╨╛╨╗╤М╨║╨╛ ╨┐╤А╨╛╤Б╨╝╨╛╤В╤А), ╨▒╨░╨╖╨╛╨▓╨░╤П ╨╕╨╜╤Д╨╛╤А╨╝╨░╤Ж╨╕╤П ╨╛ ╨┐╨░╤Ж╨╕╨╡╨╜╤В╨░╤Е. ╨Э╨╡ ╨╝╨╛╨╢╨╡╤В ╤А╨╡╨┤╨░╨║╤В╨╕╤А╨╛╨▓╨░╤В╤М ╨┤╨░╨╜╨╜╤Л╨╡.',
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
  const { getClinicStaff, addStaffMember, roleInfo } = useAuth()
  const { toast, showToast, clearToast } = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [profileModal, setProfileModal] = useState<UserType | null>(null)
  const [form, setForm] = useState<StaffForm>(EMPTY_FORM)
  const [filter, setFilter] = useState('all')
  const [editingStaff, setEditingStaff] = useState<UserType | null>(null)

  const staff = getClinicStaff(clinic?.id || user?.clinicId)
  const filtered = filter === 'all' ? staff : staff.filter(s => s.role === filter)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form.name || !form.login || !form.password) {
      showToast('╨Ч╨░╨┐╨╛╨╗╨╜╨╕╤В╨╡ ╨▓╤Б╨╡ ╨╛╨▒╤П╨╖╨░╤В╨╡╨╗╤М╨╜╤Л╨╡ ╨┐╨╛╨╗╤П', 'warning')
      return
    }
    if (form.password.length < 6) {
      showToast('╨Я╨░╤А╨╛╨╗╤М ╨┤╨╛╨╗╨╢╨╡╨╜ ╨▒╤Л╤В╤М ╨╜╨╡ ╨╝╨╡╨╜╨╡╨╡ 6 ╤Б╨╕╨╝╨▓╨╛╨╗╨╛╨▓', 'warning')
      return
    }
    const result = addStaffMember({
      ...form,
      workSchedule: form.role === 'doctor' ? form.workSchedule : undefined,
      clinicId: clinic?.id || user?.clinicId,
      experienceYears: Number(form.experienceYears) || 0,
    } as any)
    if (result === false) {
      showToast('╨в╨░╨║╨╛╨╣ ╨╗╨╛╨│╨╕╨╜ ╤Г╨╢╨╡ ╨╖╨░╨╜╤П╤В', 'error')
      return
    }
    showToast(`${ROLE_LABELS[form.role] || '╨б╨╛╤В╤А╤Г╨┤╨╜╨╕╨║'} ╨┤╨╛╨▒╨░╨▓╨╗╨╡╨╜`, 'success')
    setModalOpen(false)
    setForm(EMPTY_FORM)
    setEditingStaff(null)
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
      workSchedule: (member as any).workSchedule || { start: '09:00', end: '18:00', workDays: ['╨┐╨╜', '╨▓╤В', '╤Б╤А', '╤З╤В', '╨┐╤В'] },
    })
    setModalOpen(true)
  }

  const canManage = roleInfo?.canAddStaff

  const staffFormModal = (
    <Modal
      open={modalOpen}
      onClose={() => setModalOpen(false)}
      title={editingStaff ? '╨а╨╡╨┤╨░╨║╤В╨╕╤А╨╛╨▓╨░╤В╤М ╤Б╨╛╤В╤А╤Г╨┤╨╜╨╕╨║╨░' : '╨Ф╨╛╨▒╨░╨▓╨╕╤В╤М ╤Б╨╛╤В╤А╤Г╨┤╨╜╨╕╨║╨░'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="╨д╨Ш╨Ю *"
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          placeholder="╨Ш╨▓╨░╨╜╨╛╨▓╨░ ╨Ь╨░╤А╨╕╤П ╨б╨╡╤А╨│╨╡╨╡╨▓╨╜╨░"
          required
          icon={<Users size={16} />}
        />

        <Select
          label="╨а╨╛╨╗╤М *"
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
            label="╨б╨┐╨╡╤Ж╨╕╨░╨╗╨╕╨╖╨░╤Ж╨╕╤П"
            value={form.spec}
            onChange={e => setForm({ ...form, spec: e.target.value })}
            options={SPECS}
          />
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="╨в╨╡╨╗╨╡╤Д╨╛╨╜"
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
            label="╨б╤В╨░╨╢ (╨╗╨╡╤В)"
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
            label="╨Ю ╤Б╨╡╨▒╨╡ (╨▒╨╕╨╛)"
            value={form.bio}
            onChange={e => setForm({ ...form, bio: e.target.value })}
            placeholder="╨а╨░╤Б╤Б╨║╨░╨╢╨╕╤В╨╡ ╨╛ ╤Б╨╡╨▒╨╡, ╨╛╨▒╤А╨░╨╖╨╛╨▓╨░╨╜╨╕╨╕, ╨╛╨┐╤Л╤В╨╡ ╤А╨░╨▒╨╛╤В╤Л..."
            rows={3}
          />
        )}

        {form.role === 'doctor' && (
          <Select
            label="╨Т╨╕╨┤╨╕╨╝╨╛╤Б╤В╤М ╨┐╤А╨╛╤Д╨╕╨╗╤П"
            value={form.visibility}
            onChange={e => setForm({ ...form, visibility: e.target.value })}
            options={VISIBILITY_OPTIONS}
          />
        )}

        {form.role === 'doctor' && (
          <Input
            label="╨д╨╛╤В╨╛ URL"
            value={form.photoUrl}
            onChange={e => setForm({ ...form, photoUrl: e.target.value })}
            placeholder="https://example.com/photo.jpg"
          />
        )}

        {form.role === 'doctor' && (
          <div className="p-3 rounded-lg border border-bdr-subtle bg-white/[0.02]">
            <p className="text-xs font-semibold text-txt-secondary mb-3 flex items-center gap-1.5">
              <Calendar size={14} /> ╨У╤А╨░╤Д╨╕╨║ ╤А╨░╨▒╨╛╤В╤Л ╨▓╤А╨░╤З╨░
            </p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Input
                label="╨Э╨░╤З╨░╨╗╨╛ ╤А╨░╨▒╨╛╤З╨╡╨│╨╛ ╨┤╨╜╤П"
                type="time"
                value={form.workSchedule?.start || '09:00'}
                onChange={e => setForm({ ...form, workSchedule: { ...form.workSchedule!, start: e.target.value } })}
              />
              <Input
                label="╨Ъ╨╛╨╜╨╡╤Ж ╤А╨░╨▒╨╛╤З╨╡╨│╨╛ ╨┤╨╜╤П"
                type="time"
                value={form.workSchedule?.end || '18:00'}
                onChange={e => setForm({ ...form, workSchedule: { ...form.workSchedule!, end: e.target.value } })}
              />
            </div>
            <p className="text-xs text-txt-muted mb-2">╨а╨░╨▒╨╛╤З╨╕╨╡ ╨┤╨╜╨╕:</p>
            <div className="flex gap-1.5 flex-wrap">
              {['╨┐╨╜', '╨▓╤В', '╤Б╤А', '╤З╤В', '╨┐╤В', '╤Б╨▒', '╨▓╤Б'].map(day => {
                const isSelected = (form.workSchedule?.workDays || ['╨┐╨╜', '╨▓╤В', '╤Б╤А', '╤З╤В', '╨┐╤В']).includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      const current = form.workSchedule?.workDays || ['╨┐╨╜', '╨▓╤В', '╤Б╤А', '╤З╤В', '╨┐╤В']
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
            <Settings size={14} /> ╨Ф╨░╨╜╨╜╤Л╨╡ ╨┤╨╗╤П ╨▓╤Е╨╛╨┤╨░
          </p>
          <Input
            label="╨Ы╨╛╨│╨╕╨╜ *"
            value={form.login}
            onChange={e => setForm({ ...form, login: e.target.value.toLowerCase().replace(/\s/g, '_') })}
            placeholder="doctor_name"
            required
            icon={<Lock size={16} />}
          />
          {!editingStaff && (
            <Input
              label="╨Я╨░╤А╨╛╨╗╤М *"
              type="password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="╨Ь╨╕╨╜╨╕╨╝╤Г╨╝ 6 ╤Б╨╕╨╝╨▓╨╛╨╗╨╛╨▓"
              required
              icon={<Lock size={16} />}
            />
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="submit" className="flex-1">{editingStaff ? '╨б╨╛╤Е╤А╨░╨╜╨╕╤В╤М' : '╨Ф╨╛╨▒╨░╨▓╨╕╤В╤М ╤Б╨╛╤В╤А╤Г╨┤╨╜╨╕╨║╨░'}</Button>
          <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>╨Ю╤В╨╝╨╡╨╜╨░</Button>
        </div>
      </form>
    </Modal>
  )

  const profileDetailModal = (
    <Modal
      open={!!profileModal}
      onClose={() => setProfileModal(null)}
      title="╨Я╤А╨╛╤Д╨╕╨╗╤М ╤Б╨╛╤В╤А╤Г╨┤╨╜╨╕╨║╨░"
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
                <span>╨б╤В╨░╨╢: {profileModal.experienceYears} ╨╗╨╡╤В</span>
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
                ╨а╨╡╨┤╨░╨║╤В╨╕╤А╨╛╨▓╨░╤В╤М
              </Button>
            )}
            <Button variant="ghost" onClick={() => setProfileModal(null)}>╨Ч╨░╨║╤А╤Л╤В╤М</Button>
          </div>
        </>
      )}
    </Modal>
  )

  return (
    <div className="p-6">
      <PageHeader
        title="╨б╨╛╤В╤А╤Г╨┤╨╜╨╕╨║╨╕"
        subtitle={`${clinic?.name} ┬╖ ${staff.length} ╤З╨╡╨╗.`}
        icon={<Users size={20} />}
        actions={
          canManage ? (
            <Button icon={<UserPlus size={16} />} onClick={() => { setForm(EMPTY_FORM); setModalOpen(true) }}>
              ╨Ф╨╛╨▒╨░╨▓╨╕╤В╤М ╤Б╨╛╤В╤А╤Г╨┤╨╜╨╕╨║╨░
            </Button>
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
          title="╨Э╨╡╤В ╤Б╨╛╤В╤А╤Г╨┤╨╜╨╕╨║╨╛╨▓"
          description={canManage ? '╨Ф╨╛╨▒╨░╨▓╤М╤В╨╡ ╨┐╨╡╤А╨▓╨╛╨│╨╛ ╤Б╨╛╤В╤А╤Г╨┤╨╜╨╕╨║╨░' : '╨Э╨╡╤В ╨┤╨░╨╜╨╜╤Л╤Е'}
          action={
            canManage ? (
              <Button icon={<UserPlus size={16} />} onClick={() => { setForm(EMPTY_FORM); setModalOpen(true) }}>
                ╨Ф╨╛╨▒╨░╨▓╨╕╤В╤М
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
                                <Lock size={10} /> ╨Я╤А╨╕╨▓╨░╤В╨╜╤Л╨╣
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      {isCurrentUser && (
                        <Badge variant="gold" size="xs">╨Т╤Л</Badge>
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
                          <span>╨б╤В╨░╨╢: {member.experienceYears} {member.experienceYears === 1 ? '╨│╨╛╨┤' : member.experienceYears! < 5 ? '╨│╨╛╨┤╨░' : '╨╗╨╡╤В'}</span>
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
                      <p className="text-2xs font-bold text-txt-muted uppercase tracking-wider mb-2">╨Ф╨╛╤Б╤В╤Г╨┐</p>
                      <div className="flex gap-1 flex-wrap">
                        {(ROLES[member.role]?.pages || []).slice(0, 8).map(p => (
                          <Badge key={p} variant="default" size="xs">{PAGE_ICONS[p] || p}</Badge>
                        ))}
                        {(ROLES[member.role]?.pages || []).length > 8 && (
                          <Badge variant="default" size="xs">+{ROLES[member.role]!.pages.length - 8}</Badge>
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
                        ╨а╨╡╨┤╨░╨║╤В╨╕╤А╨╛╨▓╨░╤В╤М
                      </Button>
                    )}
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {staffFormModal}
      {profileDetailModal}
    </div>
  )
}
