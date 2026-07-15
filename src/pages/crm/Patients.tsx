import React, { useState, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UserPlus, Search, ArrowLeft, Phone, Mail, MapPin, Calendar, FileText, Camera,
  AlertTriangle, CreditCard, History, Smile, Star, User, Send, Trash2, Receipt,
} from 'lucide-react'
import { useData, useToast } from '../../hooks/useData'
import { Button } from '../../components/ui/ds/Button'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/ds/Card'
import { Input, Textarea, Select } from '../../components/ui/ds/Input'
import { Badge } from '../../components/ui/ds/Badge'
import { Modal, ConfirmModal } from '../../components/ui/ds/Modal'
import { EmptyState } from '../../components/ui/ds/EmptyState'
import { PageHeader } from '../../components/ui/ds/StatCard'
import { Tabs } from '../../components/ui/ds/Misc'
import { Avatar } from '../../components/ui/ds/Avatar'
import { Odontogram3D, SurfaceEditor, AutoTreatmentPlan, ToothLegend } from '../../components/Odontogram3D'
import { T, PATIENT_CATEGORY, calculateAge, formatPhone, fd, tg, gid, today } from '../../utils/constants'
import { cn, formatMoney } from '../../lib/utils'
import type { Patient, Appointment, Clinic, User as UserType, RoleInfo } from '../../types'

const CAT_CFG = PATIENT_CATEGORY

const CAT_BADGE: Record<string, string> = {
  new: 'success',
  regular: 'gold',
  vip: 'info',
  debt: 'error',
}

const STATUS_BADGE: Record<string, string> = {
  scheduled: 'info',
  confirmed: 'success',
  done: 'success',
  completed: 'success',
  cancelled: 'error',
  noShow: 'error',
  reminderSent: 'warning',
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: '╨Ч╨░╨┐╨╗╨░╨╜╨╕╤А╨╛╨▓╨░╨╜',
  confirmed: '╨Я╨╛╨┤╤В╨▓╨╡╤А╨╢╨┤╤С╨╜',
  done: '╨Ч╨░╨▓╨╡╤А╤И╤С╨╜',
  completed: '╨Ч╨░╨▓╨╡╤А╤И╤С╨╜',
  cancelled: '╨Ю╤В╨╝╨╡╨╜╤С╨╜',
  noShow: '╨Э╨╡╤П╨▓╨║╨░',
}

const PHOTO_LABELS: Record<string, string> = {
  smile: '╨г╨╗╤Л╨▒╨║╨░',
  face: '╨Ы╨╕╤Ж╨╛',
  intraoral: '╨Ш╨╜╤В╤А╨░╨╛╤А╨░╨╗╤М╨╜╤Л╨╡',
  xray: '╨а╨╡╨╜╤В╨│╨╡╨╜',
}

const PHOTO_ICONS: Record<string, React.ReactNode> = {
  smile: <Smile size={14} />,
  face: <User size={14} />,
  intraoral: <Smile size={14} />,
  xray: <Camera size={14} />,
}

const EMPTY_FORM = {
  name: '', phone: '', email: '', dob: '', address: '',
  category: 'new', notes: '', teeth: {},
}

const EMPTY_PAYMENT = { amount: '', payMethod: 'cash' }

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.03 } } }
const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }

interface OutletContext {
  clinic: Clinic
  user: UserType
  roleInfo?: RoleInfo
}

export default function Patients() {
  const { clinic } = useOutletContext<OutletContext>()
  const { patients, appointments, upsertPatient, deletePatient } = useData(clinic?.id)
  const { toast, showToast, clearToast } = useToast()

  const [selected, setSelected] = useState<Patient | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('info')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [editPatient, setEditPatient] = useState<Patient | null>(null)
  const [teethState, setTeethState] = useState<Record<number, any>>({})
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)
  const [filterCat, setFilterCat] = useState('all')
  const [photos, setPhotos] = useState<Array<{ id: string; url: string; category: string; date: string; name: string }>>([])
  const [photoCategory, setPhotoCategory] = useState('smile')
  const [payment, setPayment] = useState(EMPTY_PAYMENT)

  const filtered = patients.filter(p => {
    const matchSearch = p.name?.toLowerCase().includes(search.toLowerCase())
      || p.phone?.includes(search)
      || p.email?.toLowerCase().includes(search.toLowerCase())
    const matchCat = filterCat === 'all' || p.category === filterCat
    return matchSearch && matchCat
  })

  const openNew = () => {
    setEditPatient(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEdit = (p: Patient) => {
    setEditPatient(p)
    setForm({
      name: p.name || '', phone: p.phone || '', email: p.email || '',
      dob: p.dob || '', address: p.address || '',
      category: p.category || 'regular', notes: p.notes || '', teeth: p.teeth || {},
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form.name.trim()) { showToast('╨Т╨▓╨╡╨┤╨╕╤В╨╡ ╨д╨Ш╨Ю ╨┐╨░╤Ж╨╕╨╡╨╜╤В╨░', 'warning'); return }
    try {
      await upsertPatient({ ...form, id: editPatient?.id, clinicId: clinic?.id })
      showToast(editPatient ? '╨Ф╨░╨╜╨╜╤Л╨╡ ╨╛╨▒╨╜╨╛╨▓╨╗╨╡╨╜╤Л' : '╨Я╨░╤Ж╨╕╨╡╨╜╤В ╨┤╨╛╨▒╨░╨▓╨╗╨╡╨╜', 'success')
      setModalOpen(false)
      if (selected && selected.id === editPatient?.id) {
        setSelected(s => s ? { ...s, ...form } as Patient : null)
      }
    } catch {
      showToast('╨Ю╤И╨╕╨▒╨║╨░ ╤Б╨╛╤Е╤А╨░╨╜╨╡╨╜╨╕╤П', 'error')
    }
  }

  const handleDelete = async () => {
    if (!editPatient) return
    await deletePatient(editPatient.id)
    showToast('╨Я╨░╤Ж╨╕╨╡╨╜╤В ╤Г╨┤╨░╨╗╤С╨╜', 'success')
    setModalOpen(false)
    if (selected?.id === editPatient.id) setSelected(null)
  }

  const handleToothClick = useCallback((toothNum: number) => {
    setSelectedTooth(t => t === toothNum ? null : toothNum)
  }, [])

  const handleSaveToothSurfaces = (toothNum: number, surfaces: any) => {
    const updated = { ...teethState, [toothNum]: { ...teethState[toothNum], surfaces } }
    setTeethState(updated)
    setSelectedTooth(null)
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newPhotos = files.map(file => ({
      id: gid(),
      url: URL.createObjectURL(file),
      category: photoCategory,
      date: today(),
      name: file.name,
    }))
    setPhotos(prev => [...prev, ...newPhotos])
  }

  const patientAppts = selected
    ? appointments.filter(a => a.patientId === selected.id).sort((a, b) => b.date.localeCompare(a.date))
    : []

  const formModal = (
    <Modal
      open={modalOpen}
      onClose={() => setModalOpen(false)}
      title={editPatient ? '╨а╨╡╨┤╨░╨║╤В╨╕╤А╨╛╨▓╨░╤В╤М ╨┐╨░╤Ж╨╕╨╡╨╜╤В╨░' : '╨Э╨╛╨▓╤Л╨╣ ╨┐╨░╤Ж╨╕╨╡╨╜╤В'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="╨д╨Ш╨Ю"
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          required
          placeholder="╨Ш╨▓╨░╨╜╨╛╨▓ ╨Ш╨▓╨░╨╜ ╨Ш╨▓╨░╨╜╨╛╨▓╨╕╤З"
          icon={<User size={16} />}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="╨в╨╡╨╗╨╡╤Д╨╛╨╜"
            value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })}
            required
            placeholder="+7 700 000 00 00"
            icon={<Phone size={16} />}
          />
          <Input
            label="╨Ф╨░╤В╨░ ╤А╨╛╨╢╨┤╨╡╨╜╨╕╤П"
            type="date"
            value={form.dob}
            onChange={e => setForm({ ...form, dob: e.target.value })}
          />
        </div>
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={e => setForm({ ...form, email: e.target.value })}
          placeholder="email@example.com"
          icon={<Mail size={16} />}
        />
        <Input
          label="╨Р╨┤╤А╨╡╤Б"
          value={form.address}
          onChange={e => setForm({ ...form, address: e.target.value })}
          placeholder="╤Г╨╗. ╨Я╤А╨╕╨╝╨╡╤А╨╜╨░╤П, 1"
          icon={<MapPin size={16} />}
        />
        <Select
          label="╨Ъ╨░╤В╨╡╨│╨╛╤А╨╕╤П"
          value={form.category}
          onChange={e => setForm({ ...form, category: e.target.value })}
          options={Object.entries(CAT_CFG).map(([k, v]) => ({ value: k, label: v.l }))}
        />
        <Textarea
          label="╨Ч╨░╨╝╨╡╤В╨║╨╕ / ╨░╨╜╨░╨╝╨╜╨╡╨╖ / ╨░╨╗╨╗╨╡╤А╨│╨╕╨╕"
          value={form.notes}
          onChange={e => setForm({ ...form, notes: e.target.value })}
          rows={3}
          placeholder="╨Р╨╗╨╗╨╡╤А╨│╨╕╤П ╨╜╨░ ╨╗╨╕╨┤╨╛╨║╨░╨╕╨╜, ╨│╨╕╨┐╨╡╤А╤В╨╛╨╜╨╕╤П..."
        />
        <div className="flex gap-2 pt-2">
          <Button type="submit" className="flex-1">
            {editPatient ? '╨б╨╛╤Е╤А╨░╨╜╨╕╤В╤М' : '╨Ф╨╛╨▒╨░╨▓╨╕╤В╤М'}
          </Button>
          {editPatient && (
            <Button
              type="button"
              variant="danger"
              icon={<Trash2 size={16} />}
              onClick={() => { setConfirmDeleteOpen(true); setModalOpen(false) }}
            >
              ╨г╨┤╨░╨╗╨╕╤В╤М
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
            ╨Ю╤В╨╝╨╡╨╜╨░
          </Button>
        </div>
      </form>
    </Modal>
  )

  const confirmDeleteModal = (
    <ConfirmModal
      open={confirmDeleteOpen}
      onClose={() => setConfirmDeleteOpen(false)}
      onConfirm={handleDelete}
      title="╨г╨┤╨░╨╗╨╕╤В╤М ╨┐╨░╤Ж╨╕╨╡╨╜╤В╨░?"
      message={`╨Т╤Л ╤Г╨▓╨╡╤А╨╡╨╜╤Л, ╤З╤В╨╛ ╤Е╨╛╤В╨╕╤В╨╡ ╤Г╨┤╨░╨╗╨╕╤В╤М ╨┐╨░╤Ж╨╕╨╡╨╜╤В╨░ ${editPatient?.name}? ╨н╤В╨╛ ╨┤╨╡╨╣╤Б╤В╨▓╨╕╨╡ ╨╜╨╡╨╛╨▒╤А╨░╤В╨╕╨╝╨╛.`}
      confirmLabel="╨г╨┤╨░╨╗╨╕╤В╤М"
    />
  )

  // тФАтФА List View тФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФА
  if (!selected) {
    return (
      <div className="p-6">
        <PageHeader
          title="╨Я╨░╤Ж╨╕╨╡╨╜╤В╤Л"
          subtitle={`╨С╨░╨╖╨░ ╨┐╨░╤Ж╨╕╨╡╨╜╤В╨╛╨▓ ╨║╨╗╨╕╨╜╨╕╨║╨╕ ┬╖ ${patients.length} ╤З╨╡╨╗.`}
          icon={<User size={20} />}
          actions={
            <Button icon={<UserPlus size={16} />} onClick={openNew}>
              ╨Э╨╛╨▓╤Л╨╣ ╨┐╨░╤Ж╨╕╨╡╨╜╤В
            </Button>
          }
        />

        <div className="flex flex-wrap gap-2 mb-5 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="╨Я╨╛╨╕╤Б╨║ ╨┐╨╛ ╨д╨Ш╨Ю, ╤В╨╡╨╗╨╡╤Д╨╛╨╜╤Г, email..."
              icon={<Search size={16} />}
            />
          </div>
          {Object.entries({ all: '╨Т╤Б╨╡', ...Object.fromEntries(Object.entries(CAT_CFG).map(([k, v]) => [k, v.l])) }).map(([k, label]) => (
            <Button
              key={k}
              variant={filterCat === k ? 'outline' : 'ghost'}
              size="sm"
              onClick={() => setFilterCat(k)}
              className={filterCat === k ? 'border-dv-gold/50 text-dv-gold' : ''}
            >
              {label}
            </Button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Search size={32} />}
            title="╨Я╨░╤Ж╨╕╨╡╨╜╤В╤Л ╨╜╨╡ ╨╜╨░╨╣╨┤╨╡╨╜╤Л"
            description="╨Я╨╛╨┐╤А╨╛╨▒╤Г╨╣╤В╨╡ ╨╕╨╖╨╝╨╡╨╜╨╕╤В╤М ╨┐╨░╤А╨░╨╝╨╡╤В╤А╤Л ╨┐╨╛╨╕╤Б╨║╨░"
          />
        ) : (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            variants={stagger}
            initial="hidden"
            animate="show"
          >
            {filtered.map(p => {
              const catKey = p.category || 'regular'
              const cat = CAT_CFG[catKey] || CAT_CFG.regular
              const age = calculateAge(p.dob)
              const pAppts = appointments.filter(a => a.patientId === p.id)
              const lastAppt = pAppts.sort((a, b) => b.date.localeCompare(a.date))[0]

              return (
                <motion.div key={p.id} variants={fadeUp}>
                  <Card
                    hover
                    className="cursor-pointer group"
                    onClick={() => { setSelected(p); setTeethState(p.teeth || {}); setActiveTab('info') }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={p.name}
                          size="md"
                          status={catKey === 'vip' ? 'busy' : 'online'}
                        />
                        <div>
                          <p className="text-sm font-semibold text-txt-primary group-hover:text-dv-gold transition-colors">
                            {p.name}
                          </p>
                          {age && <p className="text-xs text-txt-muted">{age} ╨╗╨╡╤В</p>}
                        </div>
                      </div>
                      <Badge variant={CAT_BADGE[catKey] || 'default'} size="sm">
                        {cat.l}
                      </Badge>
                    </div>

                    <div className="space-y-1.5 text-xs text-txt-secondary">
                      <div className="flex items-center gap-2">
                        <Phone size={12} className="text-txt-muted shrink-0" />
                        <span>{formatPhone(p.phone) || '---'}</span>
                      </div>
                      {p.email && (
                        <div className="flex items-center gap-2">
                          <Mail size={12} className="text-txt-muted shrink-0" />
                          <span className="truncate">{p.email}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Calendar size={12} className="text-txt-muted shrink-0" />
                        <span>╨Т╨╕╨╖╨╕╤В╨╛╨▓: {pAppts.length}{lastAppt ? ` ┬╖ ${fd(lastAppt.date)}` : ''}</span>
                      </div>
                      {p.notes && (
                        <div className="flex items-center gap-2 text-warning">
                          <AlertTriangle size={12} className="shrink-0" />
                          <span className="truncate">{p.notes}</span>
                        </div>
                      )}
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </motion.div>
        )}

        {formModal}
        {confirmDeleteModal}
      </div>
    )
  }

  // тФАтФА Detail View тФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФАтФА
  const catKey = selected.category || 'regular'
  const cat = CAT_CFG[catKey] || CAT_CFG.regular

  const PATIENT_TABS = [
    { id: 'info', label: '╨Ъ╨░╤А╤В╨░', icon: <FileText size={14} /> },
    { id: 'odontogram', label: '╨Ю╨┤╨╛╨╜╤В╨╛╨│╤А╨░╨╝╨╝╨░', icon: <Smile size={14} /> },
    { id: 'payment', label: '╨Ю╨┐╨╗╨░╤В╨░', icon: <CreditCard size={14} /> },
    { id: 'photos', label: '╨д╨╛╤В╨╛╨┐╤А╨╛╤В╨╛╨║╨╛╨╗', icon: <Camera size={14} /> },
    { id: 'history', label: '╨Ш╤Б╤В╨╛╤А╨╕╤П', icon: <History size={14} /> },
  ]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={() => setSelected(null)}>
          ╨Ъ ╤Б╨┐╨╕╤Б╨║╤Г
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" icon={<FileText size={16} />} onClick={() => setActiveTab('info')}>
            ╨Я╨╗╨░╨╜ ╨╗╨╡╤З╨╡╨╜╨╕╤П
          </Button>
          <Button variant="secondary" icon={<FileText size={16} />} onClick={() => openEdit(selected)}>
            ╨а╨╡╨┤╨░╨║╤В╨╕╤А╨╛╨▓╨░╤В╤М
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        {/* Patient card */}
        <div className="space-y-4">
          <Card padding="lg">
            <div className="text-center mb-5">
              <Avatar name={selected.name} size="xl" className="mx-auto mb-3" />
              <p className="text-base font-bold text-txt-primary">{selected.name}</p>
              <Badge variant={CAT_BADGE[catKey] || 'default'} size="md" className="mt-2">
                {cat.l}
              </Badge>
            </div>

            <div className="space-y-2.5 text-sm text-txt-secondary">
              {selected.phone && (
                <div className="flex items-center gap-2.5">
                  <Phone size={14} className="text-txt-muted shrink-0" />
                  <span>{formatPhone(selected.phone)}</span>
                </div>
              )}
              {selected.email && (
                <div className="flex items-center gap-2.5">
                  <Mail size={14} className="text-txt-muted shrink-0" />
                  <span className="truncate">{selected.email}</span>
                </div>
              )}
              {selected.dob && (
                <div className="flex items-center gap-2.5">
                  <Calendar size={14} className="text-txt-muted shrink-0" />
                  <span>{fd(selected.dob)} ({calculateAge(selected.dob)} ╨╗╨╡╤В)</span>
                </div>
              )}
              {selected.address && (
                <div className="flex items-center gap-2.5">
                  <MapPin size={14} className="text-txt-muted shrink-0" />
                  <span>{selected.address}</span>
                </div>
              )}
              {selected.notes && (
                <div className="mt-3 p-2.5 rounded-lg bg-warning/10 border border-warning/20 text-warning text-xs flex items-start gap-2">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>{selected.notes}</span>
                </div>
              )}
            </div>
          </Card>

          <Card padding="md">
            <p className="text-xs font-bold text-txt-muted uppercase tracking-wider mb-3">╨б╤В╨░╤В╨╕╤Б╤В╨╕╨║╨░</p>
            <div className="space-y-2">
              {[
                { label: '╨Т╨╕╨╖╨╕╤В╨╛╨▓ ╨▓╤Б╨╡╨│╨╛', value: patientAppts.length },
                { label: '╨Ч╨░╨▓╨╡╤А╤И╨╡╨╜╨╛', value: patientAppts.filter(a => a.status === 'done' || a.status === 'completed').length },
                { label: '╨Ю╤В╨╝╨╡╨╜╨╡╨╜╨╛', value: patientAppts.filter(a => a.status === 'cancelled').length },
              ].map((s, i) => (
                <div key={i} className="flex justify-between items-center py-1.5 border-b border-bdr-subtle last:border-b-0">
                  <span className="text-xs text-txt-secondary">{s.label}</span>
                  <span className="text-sm font-semibold text-txt-primary">{s.value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right panel */}
        <Card padding="none" className="overflow-hidden">
          <div className="border-b border-bdr-subtle px-5">
            <Tabs tabs={PATIENT_TABS} active={activeTab} onChange={setActiveTab} size="sm" />
          </div>

          <div className="p-5">
            <AnimatePresence mode="wait">
              {activeTab === 'info' && (
                <motion.div key="info" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
                  <p className="text-sm font-bold text-txt-primary mb-3">╨Я╨╗╨░╨╜╤Л ╨╕ ╨╖╨░╨╝╨╡╤В╨║╨╕</p>
                  <div className="p-4 rounded-xl border border-dashed border-bdr-subtle text-sm text-txt-secondary mb-5">
                    {selected.notes || '╨Э╨╡╤В ╨╛╤Б╨╛╨▒╤Л╤Е ╨╖╨░╨╝╨╡╤В╨╛╨║. ╨Ф╨╗╤П ╨┤╨╛╨▒╨░╨▓╨╗╨╡╨╜╨╕╤П ╨╜╨░╨╢╨╝╨╕╤В╨╡ ┬л╨а╨╡╨┤╨░╨║╤В╨╕╤А╨╛╨▓╨░╤В╤М┬╗.'}
                  </div>
                  <AutoTreatmentPlan
                    teeth={teethState}
                    onAddToPlan={(recs: any[]) => showToast(`╨Ф╨╛╨▒╨░╨▓╨╗╨╡╨╜╨╛ ${recs.length} ╨┐╤А╨╛╤Ж╨╡╨┤╤Г╤А ╨▓ ╨┐╨╗╨░╨╜`, 'success')}
                  />
                </motion.div>
              )}

              {activeTab === 'odontogram' && (
                <motion.div key="odonto" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
                  <div className="mb-4">
                    <ToothLegend />
                  </div>
                  <Odontogram3D
                    patientTeeth={teethState}
                    onToothClick={handleToothClick}
                    selectedTooth={selectedTooth}
                  />
                  {selectedTooth && (
                    <SurfaceEditor
                      toothNumber={selectedTooth}
                      surfaces={teethState[selectedTooth]?.surfaces || {}}
                      onSave={handleSaveToothSurfaces}
                      onCancel={() => setSelectedTooth(null)}
                    />
                  )}
                </motion.div>
              )}

              {activeTab === 'payment' && (
                <motion.div key="payment" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
                  <p className="text-sm font-bold text-txt-primary mb-4">╨Ю╨┐╨╗╨░╤В╨░ ╨╕ ╤Д╨╕╨╜╨░╨╜╤Б╨╛╨▓╤Л╨╡ ╨╛╨┐╨╡╤А╨░╤Ж╨╕╨╕</p>

                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {[
                      { label: '╨Т╤Б╨╡╨│╨╛ ╨╛╨┐╨╗╨░╤З╨╡╨╜╨╛', value: patientAppts.filter(a => a.status === 'done' || a.status === 'completed').reduce((sum, a) => sum + (a.price || 0), 0), color: 'text-success' },
                      { label: '╨Ю╨╢╨╕╨┤╨░╨╡╤В ╨╛╨┐╨╗╨░╤В╤Л', value: patientAppts.filter(a => a.status === 'confirmed' || a.status === 'scheduled').reduce((sum, a) => sum + (a.price || 0), 0), color: 'text-warning' },
                      { label: '╨б╨║╨╕╨┤╨║╨╕', value: catKey === 'vip' ? '15%' : catKey === 'regular' ? '5%' : '0%', color: 'text-info' },
                    ].map((s, i) => (
                      <div key={i} className="p-4 rounded-xl border border-bdr-subtle bg-white/[0.02] text-center">
                        <p className="text-xs text-txt-muted mb-1.5">{s.label}</p>
                        <p className={cn('text-xl font-bold', s.color)}>
                          {typeof s.value === 'number' ? formatMoney(s.value) : s.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 rounded-xl border border-bdr-subtle bg-white/[0.02] mb-5">
                    <p className="text-sm font-semibold text-txt-primary mb-3">╨Т╨╜╨╡╤Б╤В╨╕ ╨╛╨┐╨╗╨░╤В╤Г</p>
                    <div className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
                      <Input
                        label="╨б╤Г╨╝╨╝╨░ (тВ╕)"
                        type="number"
                        placeholder="0"
                        value={payment.amount}
                        onChange={e => setPayment({ ...payment, amount: e.target.value })}
                      />
                      <Select
                        label="╨в╨╕╨┐ ╨╛╨┐╨╗╨░╤В╤Л"
                        value={payment.payMethod}
                        onChange={e => setPayment({ ...payment, payMethod: e.target.value })}
                        options={[
                          { value: 'cash', label: '╨Э╨░╨╗╨╕╤З╨╜╤Л╨╡' },
                          { value: 'card', label: '╨Ъ╨░╤А╤В╨░' },
                          { value: 'transfer', label: '╨Я╨╡╤А╨╡╨▓╨╛╨┤' },
                        ]}
                      />
                      <Button
                        icon={<CreditCard size={16} />}
                        onClick={() => {
                          if (!payment.amount || Number(payment.amount) <= 0) { showToast('╨г╨║╨░╨╢╨╕╤В╨╡ ╤Б╤Г╨╝╨╝╤Г', 'warning'); return }
                          showToast(`╨Ю╨┐╨╗╨░╤В╨░ ${tg(Number(payment.amount))} ╨▓╨╜╨╡╤Б╨╡╨╜╨░ ╤Г╤Б╨┐╨╡╤И╨╜╨╛`, 'success')
                          setPayment(EMPTY_PAYMENT)
                        }}
                      >
                        ╨Т╨╜╨╡╤Б╤В╨╕
                      </Button>
                    </div>
                  </div>

                  <p className="text-sm font-semibold text-txt-primary mb-3">╨Ш╤Б╤В╨╛╤А╨╕╤П ╨┐╨╗╨░╤В╨╡╨╢╨╡╨╣</p>
                  {patientAppts.filter(a => a.price).length === 0 ? (
                    <EmptyState
                      icon={<CreditCard size={32} />}
                      title="╨Э╨╡╤В ╨╖╨░╨┐╨╕╤Б╨╡╨╣ ╨╛╨▒ ╨╛╨┐╨╗╨░╤В╨╡"
                      description="╨Я╨╗╨░╤В╨╡╨╢╨╕ ╨┐╨╛╤П╨▓╤П╤В╤Б╤П ╨┐╨╛╤Б╨╗╨╡ ╨╖╨░╨▓╨╡╤А╤И╨╡╨╜╨╕╤П ╨┐╤А╨╕╤С╨╝╨╛╨▓"
                    />
                  ) : (
                    <div className="space-y-2">
                      {patientAppts.filter(a => a.price).map(a => (
                        <div key={a.id} className="flex items-center justify-between p-3 rounded-xl border border-bdr-subtle bg-white/[0.02]">
                          <div>
                            <p className="text-sm font-semibold text-txt-primary">{a.reason || a.service || '---'}</p>
                            <p className="text-xs text-txt-muted mt-0.5">{fd(a.date)} ┬╖ {a.time}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="success" size="sm">+{a.price.toLocaleString()} тВ╕</Badge>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              icon={<Send size={14} />}
                              onClick={() => showToast('╨з╨╡╨║ ╨╛╤В╨┐╤А╨░╨▓╨╗╨╡╨╜ ╨┐╨░╤Ж╨╕╨╡╨╜╤В╤Г', 'success')}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'photos' && (
                <motion.div key="photos" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {Object.entries(PHOTO_LABELS).map(([key, label]) => (
                      <Button
                        key={key}
                        variant={photoCategory === key ? 'outline' : 'ghost'}
                        size="sm"
                        icon={PHOTO_ICONS[key]}
                        onClick={() => setPhotoCategory(key)}
                        className={photoCategory === key ? 'border-dv-gold/50 text-dv-gold' : ''}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>

                  <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-bdr rounded-xl cursor-pointer text-txt-secondary text-sm hover:border-dv-gold/40 hover:text-dv-gold transition-all mb-4">
                    <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
                    <Camera size={32} className="mb-2 text-txt-muted" />
                    ╨Э╨░╨╢╨╝╨╕╤В╨╡ ╨┤╨╗╤П ╨╖╨░╨│╤А╤Г╨╖╨║╨╕ ╤Д╨╛╤В╨╛
                  </label>

                  {photos.filter(p => p.category === photoCategory).length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {photos.filter(p => p.category === photoCategory).map(photo => (
                        <div key={photo.id} className="rounded-xl overflow-hidden border border-bdr-subtle group">
                          <img src={photo.url} alt="Patient" className="w-full h-32 object-cover" />
                          <div className="flex items-center justify-between p-2 text-xs text-txt-muted">
                            <span>{fd(photo.date)}</span>
                            <button
                              onClick={() => setPhotos(prev => prev.filter(p => p.id !== photo.id))}
                              className="text-error/60 hover:text-error transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={<Camera size={32} />}
                      title="╨Э╨╡╤В ╤Д╨╛╤В╨╛ ╨▓ ╤Н╤В╨╛╨╣ ╨║╨░╤В╨╡╨│╨╛╤А╨╕╨╕"
                    />
                  )}
                </motion.div>
              )}

              {activeTab === 'history' && (
                <motion.div key="history" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
                  <p className="text-sm font-bold text-txt-primary mb-4">╨Ш╤Б╤В╨╛╤А╨╕╤П ╨┐╨╛╤Б╨╡╤Й╨╡╨╜╨╕╨╣</p>
                  {patientAppts.length === 0 ? (
                    <EmptyState
                      icon={<History size={32} />}
                      title="╨Э╨╡╤В ╨╖╨░╨┐╨╕╤Б╨╡╨╣ ╨╛ ╨┐╨╛╤Б╨╡╤Й╨╡╨╜╨╕╤П╤Е"
                    />
                  ) : (
                    <div className="space-y-2">
                      {patientAppts.map(a => (
                        <div
                          key={a.id}
                          className={cn(
                            'flex items-center justify-between p-3 rounded-xl border border-bdr-subtle bg-white/[0.02]',
                            'border-l-3',
                            (a.status === 'done' || a.status === 'completed') && 'border-l-success',
                            a.status === 'scheduled' && 'border-l-info',
                            a.status === 'confirmed' && 'border-l-success',
                            a.status === 'cancelled' && 'border-l-error',
                          )}
                        >
                          <div>
                            <p className="text-sm font-semibold text-txt-primary">{a.reason || a.service || '---'}</p>
                            <p className="text-xs text-txt-muted mt-0.5">{fd(a.date)} ┬╖ {a.time}</p>
                          </div>
                          <Badge variant={STATUS_BADGE[a.status] || 'default'} size="sm" dot>
                            {STATUS_LABEL[a.status] || a.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Card>
      </div>

      {formModal}
      {confirmDeleteModal}
    </div>
  )
}
