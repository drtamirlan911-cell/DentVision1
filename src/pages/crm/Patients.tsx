import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { useOutletContext, useSearchParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UserPlus, Search, ArrowLeft, Phone, Mail, MapPin, Calendar, FileText, Camera,
  AlertTriangle, CreditCard, History, Smile, Star, User, Send, Trash2, Receipt, RefreshCw,
} from 'lucide-react'
import { useToast } from '@/components/ui/ds/Toast'
import { useAuth } from '@/store/auth.store'
import { useDataQuery } from '../../queries/useDataQuery'
import * as api from '@/utils/api'
import { getRecallCandidates, findDuplicatePatients } from '@/utils/recall'
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
import { usePatientStore } from '@/store/patient.store'

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
  scheduled: 'Запланирован',
  confirmed: 'Подтверждён',
  done: 'Завершён',
  completed: 'Завершён',
  cancelled: 'Отменён',
  noShow: 'Неявка',
}

const PHOTO_LABELS: Record<string, string> = {
  smile: 'Улыбка',
  face: 'Лицо',
  intraoral: 'Интраоральные',
  xray: 'Рентген',
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
  const outlet = useOutletContext<OutletContext>() || ({} as OutletContext)
  const { user, clinic: authClinic, roleInfo } = useAuth()
  const readOnly = !!roleInfo?.readOnly
  const clinicId = outlet.clinic?.id || authClinic?.id || user?.clinicId || ''
  const clinic = (outlet.clinic?.id ? outlet.clinic : authClinic) || ({ id: clinicId } as Clinic)
  const navigate = useNavigate()
  const { patients, appointments, receipts, upsertPatient, deletePatient, upsertReceipt } = useDataQuery(clinicId || undefined)
  const { toast, showToast, clearToast } = useToast()
  const [params] = useSearchParams()

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
  const [photosLoading, setPhotosLoading] = useState(false)
  const [payment, setPayment] = useState(EMPTY_PAYMENT)
  const [patientSummary, setPatientSummary] = useState<{
    balance?: number
    paidTotal?: number
    openPlans?: number
    nextVisit?: { date?: string; time?: string; service?: string } | null
  } | null>(null)
  const [openPlanIds, setOpenPlanIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!clinic?.id) return
    let cancelled = false
    ;(async () => {
      try {
        const plans = await api.getTreatmentPlans(clinic.id)
        const ids = new Set<string>()
        for (const p of plans || []) {
          if (['draft', 'proposed', 'accepted', 'in_progress', 'active'].includes(p.status)) {
            if (p.patientId) ids.add(p.patientId)
          }
        }
        if (!cancelled) setOpenPlanIds(ids)
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [clinic?.id])

  const recallList = useMemo(
    () => getRecallCandidates(patients, appointments, receipts, { inactiveDays: 180, openPlanPatientIds: openPlanIds }),
    [patients, appointments, receipts, openPlanIds],
  )
  const duplicates = useMemo(() => findDuplicatePatients(patients), [patients])

  useEffect(() => {
    const pid = params.get('patient')
    const tab = params.get('tab')
    if (pid && patients.length) {
      const p = patients.find((x) => x.id === pid)
      if (p) {
        setSelected(p)
        setTeethState((p as any).teeth || {})
        void usePatientStore.getState().openPatient(p.id)
      }
    }
    if (tab) setActiveTab(tab)
  }, [params, patients])

  useEffect(() => {
    if (!selected?.id) { setPatientSummary(null); return }
    let cancelled = false
    ;(async () => {
      try {
        const data = await api.getPatientSummary(selected.id)
        if (!cancelled) setPatientSummary(data)
      } catch {
        if (!cancelled) setPatientSummary(null)
      }
    })()
    return () => { cancelled = true }
  }, [selected?.id])

  const mapPatientImageToUi = (img: any) => {
    const meta = img?.metadata && typeof img.metadata === 'object' ? img.metadata : null
    const fromMetaCategory = meta?.category ? String(meta.category) : null
    const derivedCategory =
      fromMetaCategory ||
      (img?.type === 'X_RAY' ? 'xray' : 'smile')

    const createdAt = img?.createdAt ? String(img.createdAt) : null
    const date = createdAt ? new Date(createdAt).toISOString().slice(0, 10) : today()

    return {
      id: String(img.id),
      url: String(img.url || ''),
      category: derivedCategory,
      date,
      name: String(img.name || ''),
    }
  }

  const loadPhotos = async (patientId: string) => {
    setPhotosLoading(true)
    try {
      const list = await api.getPatientImages(patientId)
      setPhotos((list || []).map(mapPatientImageToUi))
    } catch {
      setPhotos([])
    } finally {
      setPhotosLoading(false)
    }
  }

  useEffect(() => {
    if (!selected?.id) {
      setPhotos([])
      return
    }
    loadPhotos(selected.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id])

  const filtered = patients.filter(p => {
    const matchSearch = p.name?.toLowerCase().includes(search.toLowerCase())
      || p.phone?.includes(search)
      || p.email?.toLowerCase().includes(search.toLowerCase())
    if (filterCat === 'recall') {
      return matchSearch && recallList.some((r) => r.patient.id === p.id)
    }
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
    if (!form.name.trim()) { showToast('Введите ФИО пациента', 'warning'); return }
    try {
      await upsertPatient({ ...form, id: editPatient?.id, clinicId: clinic?.id })
      showToast(editPatient ? 'Данные обновлены' : 'Пациент добавлен', 'success')
      setModalOpen(false)
      if (selected && selected.id === editPatient?.id) {
        setSelected(s => s ? { ...s, ...form } as Patient : null)
      }
    } catch {
      showToast('Ошибка сохранения', 'error')
    }
  }

  const handleDelete = async () => {
    if (!editPatient) return
    await deletePatient(editPatient.id)
    showToast('Пациент удалён', 'success')
    setModalOpen(false)
    if (selected?.id === editPatient.id) setSelected(null)
  }

  const handleToothClick = useCallback((toothNum: number) => {
    setSelectedTooth(t => t === toothNum ? null : toothNum)
  }, [])

  const handleSaveToothSurfaces = async (toothNum: number, surfaces: any) => {
    const updated = { ...teethState, [toothNum]: { ...teethState[toothNum], surfaces } }
    setTeethState(updated)
    setSelectedTooth(null)
    if (selected) {
      try {
        await upsertPatient({
          id: selected.id,
          clinicId: clinic?.id || selected.clinicId,
          name: selected.name,
          phone: selected.phone,
          teeth: updated,
        } as any)
        showToast('Зубная карта обновлена', 'success')
      } catch {
        showToast('Не удалось сохранить зубную карту', 'error')
      }
    }
  }

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
      reader.readAsDataURL(file)
    })

  const mapUiCategoryToBackendType = (cat: string): string => {
    if (cat === 'xray') return 'X_RAY'
    return 'PHOTO'
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    if (!selected?.id) {
      showToast('Выберите пациента', 'warning')
      return
    }
    if (photosLoading) return

    setPhotosLoading(true)
    try {
      for (const file of files) {
        const url = await fileToDataUrl(file)
        await api.uploadPhoto({
          patientId: selected.id,
          type: mapUiCategoryToBackendType(photoCategory),
          url,
          metadata: {
            category: photoCategory,
            originalName: file.name,
            mimeType: file.type,
            size: file.size,
          },
        } as any)
      }
      await loadPhotos(selected.id)
      showToast('Фото сохранены', 'success')
    } catch (err: any) {
      showToast(err?.message || 'Не удалось сохранить фото', 'error')
    } finally {
      setPhotosLoading(false)
      // allow uploading the same file again
      if (e.target) e.target.value = ''
    }
  }

  const patientAppts = selected
    ? appointments.filter(a => a.patientId === selected.id).sort((a, b) => b.date.localeCompare(a.date))
    : []

  const formModal = (
    <Modal
      open={modalOpen}
      onClose={() => setModalOpen(false)}
      title={editPatient ? 'Редактировать пациента' : 'Новый пациент'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="ФИО"
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          required
          placeholder="Иванов Иван Иванович"
          icon={<User size={16} />}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Телефон"
            value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })}
            required
            placeholder="+7 700 000 00 00"
            icon={<Phone size={16} />}
          />
          <Input
            label="Дата рождения"
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
          label="Адрес"
          value={form.address}
          onChange={e => setForm({ ...form, address: e.target.value })}
          placeholder="ул. Примерная, 1"
          icon={<MapPin size={16} />}
        />
        <Select
          label="Категория"
          value={form.category}
          onChange={e => setForm({ ...form, category: e.target.value })}
          options={Object.entries(CAT_CFG).map(([k, v]) => ({ value: k, label: v.l }))}
        />
        <Textarea
          label="Заметки / анамнез / аллергии"
          value={form.notes}
          onChange={e => setForm({ ...form, notes: e.target.value })}
          rows={3}
          placeholder="Аллергия на лидокаин, гипертония..."
        />
        <div className="flex gap-2 pt-2">
          <Button type="submit" className="flex-1">
            {editPatient ? 'Сохранить' : 'Добавить'}
          </Button>
          {editPatient && (
            <Button
              type="button"
              variant="danger"
              icon={<Trash2 size={16} />}
              onClick={() => { setConfirmDeleteOpen(true); setModalOpen(false) }}
            >
              Удалить
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
            Отмена
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
      title="Удалить пациента?"
      message={`Вы уверены, что хотите удалить пациента ${editPatient?.name}? Это действие необратимо.`}
      confirmLabel="Удалить"
    />
  )

  // ── List View ──────────────────────────────────────────────
  if (!selected) {
    return (
      <div className="dv-page py-4 md:py-6">
        <PageHeader
          title="Пациенты"
          subtitle={`База пациентов клиники · ${patients.length} чел.`}
          icon={<User size={20} />}
          actions={
            {!readOnly && (
              <Button icon={<UserPlus size={16} />} onClick={openNew}>
                Новый пациент
              </Button>
            )}
          }
        />

        <div className="flex flex-wrap gap-2 mb-5 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по ФИО, телефону, email..."
              icon={<Search size={16} />}
            />
          </div>
          {Object.entries({ all: 'Все', ...Object.fromEntries(Object.entries(CAT_CFG).map(([k, v]) => [k, v.l])), recall: `Recall (${recallList.length})` }).map(([k, label]) => (
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

        {duplicates.length > 0 && (
          <Card padding="md" className="mb-4 border-warning/30 bg-warning/5">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
              <div className="text-sm text-txt-secondary">
                <p className="font-semibold text-warning mb-1">Возможные дубликаты ({duplicates.length})</p>
                {duplicates.slice(0, 3).map((d) => (
                  <p key={d.key} className="text-xs">
                    {d.match === 'phone' ? 'Телефон' : 'ФИО'}: {d.patients.map((p) => p.name).join(' · ')}
                  </p>
                ))}
              </div>
            </div>
          </Card>
        )}

        {filterCat === 'recall' && recallList.length > 0 && (
          <Card padding="md" className="mb-4">
            <p className="text-sm font-bold text-txt-primary mb-3 flex items-center gap-2">
              <RefreshCw size={14} className="text-dv-gold" />
              Smart Recall — нет визита 6+ мес.
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {recallList.slice(0, 20).map((r) => (
                <div key={r.patient.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-txt-primary truncate">{r.patient.name}</p>
                    <p className="text-[11px] text-txt-muted">
                      {r.daysSince === Infinity ? 'Никогда не был' : `${Math.floor(r.daysSince / 30)} мес. назад`}
                      {r.openPlansHint ? ' · открытый план' : ''}
                      {(r.balanceHint || 0) > 0 ? ` · долг ${tg(r.balanceHint || 0)}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="xs"
                      variant="secondary"
                      icon={<Send size={12} />}
                      onClick={() => {
                        window.open(r.waLink, '_blank', 'noopener,noreferrer')
                        showToast(`Recall: ${r.patient.name}`, 'success')
                      }}
                    >
                      WhatsApp
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      icon={<Calendar size={12} />}
                      onClick={() => navigate(`/crm/schedule?patient=${r.patient.id}`)}
                    >
                      Записать
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Search size={32} />}
            title="Пациенты не найдены"
            description="Попробуйте изменить параметры поиска"
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
              const lastAppt = [...pAppts]
                .filter((a) => a?.date)
                .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]

              return (
                <motion.div key={p.id} variants={fadeUp}>
                  <Card
                    hover
                    className="cursor-pointer group"
                    onClick={() => {
                      setSelected(p)
                      setTeethState(p.teeth || {})
                      setActiveTab('info')
                      void usePatientStore.getState().openPatient(p.id)
                    }}
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
                          {age && <p className="text-xs text-txt-muted">{age} лет</p>}
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
                        <span>Визитов: {pAppts.length}{lastAppt ? ` · ${fd(lastAppt.date)}` : ''}</span>
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

  // ── Detail View ──────────────────────────────────────────────
  const catKey = selected.category || 'regular'
  const cat = CAT_CFG[catKey] || CAT_CFG.regular

  const PATIENT_TABS = [
    { id: 'info', label: 'Карта', icon: <FileText size={14} /> },
    { id: 'odontogram', label: 'Одонтограмма', icon: <Smile size={14} /> },
    { id: 'payment', label: 'Оплата', icon: <CreditCard size={14} /> },
    { id: 'photos', label: 'Фотопротокол', icon: <Camera size={14} /> },
    { id: 'history', label: 'История', icon: <History size={14} /> },
  ]

  return (
    <div className="dv-page py-4 md:py-6">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={() => {
          setSelected(null)
          usePatientStore.getState().closePatient()
        }}>
          К списку
        </Button>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button
            variant="outline"
            icon={<FileText size={16} />}
            onClick={() => navigate(`/crm/medical-card?patient=${selected.id}`)}
          >
            Медкарта
          </Button>
          <Button
            variant="outline"
            icon={<FileText size={16} />}
            onClick={() => navigate(`/crm/treatment-plans?patient=${selected.id}`)}
          >
            План лечения
          </Button>
          <Button variant="secondary" icon={<FileText size={16} />} onClick={() => openEdit(selected)}>
            Редактировать
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

            {patientSummary && (
              <div className="grid grid-cols-2 gap-2 mb-4 text-left">
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2.5">
                  <p className="text-[10px] text-txt-muted uppercase tracking-wide">Баланс</p>
                  <p className={cn('text-sm font-bold', (patientSummary.balance || 0) > 0 ? 'text-error' : 'text-success')}>
                    {tg(patientSummary.balance || 0)}
                  </p>
                </div>
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2.5">
                  <p className="text-[10px] text-txt-muted uppercase tracking-wide">Планы</p>
                  <p className="text-sm font-bold text-txt-primary">{patientSummary.openPlans || 0} откр.</p>
                </div>
                <div className="col-span-2 rounded-lg bg-white/[0.03] border border-white/[0.06] p-2.5">
                  <p className="text-[10px] text-txt-muted uppercase tracking-wide">След. визит</p>
                  <p className="text-sm font-medium text-txt-primary">
                    {patientSummary.nextVisit
                      ? `${patientSummary.nextVisit.date || ''} ${patientSummary.nextVisit.time || ''} · ${patientSummary.nextVisit.service || 'приём'}`
                      : 'Не записан'}
                  </p>
                </div>
              </div>
            )}

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
                  <span>{fd(selected.dob)} ({calculateAge(selected.dob)} лет)</span>
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
            <p className="text-xs font-bold text-txt-muted uppercase tracking-wider mb-3">Статистика</p>
            <div className="space-y-2">
              {[
                { label: 'Визитов всего', value: patientAppts.length },
                { label: 'Завершено', value: patientAppts.filter(a => a.status === 'done' || a.status === 'completed').length },
                { label: 'Отменено', value: patientAppts.filter(a => a.status === 'cancelled').length },
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
                  <p className="text-sm font-bold text-txt-primary mb-3">Планы и заметки</p>
                  <div className="p-4 rounded-xl border border-dashed border-bdr-subtle text-sm text-txt-secondary mb-5">
                    {selected.notes || 'Нет особых заметок. Для добавления нажмите «Редактировать».'}
                  </div>
                  <AutoTreatmentPlan
                    teeth={teethState}
                    onAddToPlan={(recs: any[]) => showToast(`Добавлено ${recs.length} процедур в план`, 'success')}
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
                  <p className="text-sm font-bold text-txt-primary mb-4">Оплата и финансовые операции</p>

                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {[
                      { label: 'Всего оплачено', value: patientAppts.filter(a => a.status === 'done' || a.status === 'completed').reduce((sum, a) => sum + (a.price || 0), 0), color: 'text-success' },
                      { label: 'Ожидает оплаты', value: patientAppts.filter(a => a.status === 'confirmed' || a.status === 'scheduled').reduce((sum, a) => sum + (a.price || 0), 0), color: 'text-warning' },
                      { label: 'Скидки', value: catKey === 'vip' ? '15%' : catKey === 'regular' ? '5%' : '0%', color: 'text-info' },
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
                    <p className="text-sm font-semibold text-txt-primary mb-3">Внести оплату</p>
                    <div className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
                      <Input
                        label="Сумма (₸)"
                        type="number"
                        placeholder="0"
                        value={payment.amount}
                        onChange={e => setPayment({ ...payment, amount: e.target.value })}
                      />
                      <Select
                        label="Тип оплаты"
                        value={payment.payMethod}
                        onChange={e => setPayment({ ...payment, payMethod: e.target.value })}
                        options={[
                          { value: 'cash', label: 'Наличные' },
                          { value: 'card', label: 'Карта' },
                          { value: 'transfer', label: 'Перевод' },
                        ]}
                      />
                      <Button
                        icon={<CreditCard size={16} />}
                        onClick={async () => {
                          if (!selected?.id) { showToast('Выберите пациента', 'warning'); return }
                          if (!payment.amount || Number(payment.amount) <= 0) { showToast('Укажите сумму', 'warning'); return }
                          try {
                            await upsertReceipt({
                              clinicId: clinic?.id,
                              patientId: selected.id,
                              patientName: selected.name,
                              amount: Number(payment.amount),
                              total: Number(payment.amount),
                              payMethod: payment.payMethod,
                              status: 'paid',
                              service: 'Оплата',
                              date: new Date().toISOString().slice(0, 10),
                              items: [{ name: 'Оплата', price: Number(payment.amount), qty: 1 }],
                            })
                            showToast(`Оплата ${tg(Number(payment.amount))} внесена успешно`, 'success')
                            setPayment(EMPTY_PAYMENT)
                          } catch (err: any) {
                            showToast(err?.message || 'Не удалось сохранить оплату', 'error')
                          }
                        }}
                      >
                        Внести
                      </Button>
                    </div>
                    <div className="mt-4 pt-4 border-t border-bdr-subtle flex items-end gap-3 flex-wrap">
                      <div className="flex-1 min-w-[140px]">
                        <p className="text-xs text-txt-muted mb-1">Предоплата / баланс</p>
                        <p className="text-lg font-bold text-dv-gold">{tg(Number(selected.prepaidBalance || 0))}</p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={async () => {
                          const raw = window.prompt('Сумма пополнения баланса (₸)', '10000')
                          const amount = Number(raw)
                          if (!amount || Number.isNaN(amount)) return
                          try {
                            const updated = await api.depositPatient(selected.id, amount)
                            setSelected({ ...selected, prepaidBalance: updated?.prepaidBalance ?? (Number(selected.prepaidBalance || 0) + amount) })
                            showToast('Баланс пополнен', 'success')
                          } catch (err: any) {
                            showToast(err?.message || 'Не удалось пополнить', 'error')
                          }
                        }}
                      >
                        Пополнить баланс
                      </Button>
                    </div>
                  </div>

                  <p className="text-sm font-semibold text-txt-primary mb-3">История платежей</p>
                  {(() => {
                    const patientReceipts = (receipts || []).filter(
                      (r: any) => r.patientId === selected?.id || r.patientName === selected?.name,
                    )
                    const fromAppts = patientAppts.filter(a => a.price)
                    if (patientReceipts.length === 0 && fromAppts.length === 0) {
                      return (
                        <EmptyState
                          icon={<CreditCard size={32} />}
                          title="Нет записей об оплате"
                          description="Внесите оплату выше или завершите приём в кассе"
                        />
                      )
                    }
                    return (
                      <div className="space-y-2">
                        {patientReceipts.map((r: any) => (
                          <div key={r.id} className="flex items-center justify-between p-3 rounded-xl border border-bdr-subtle bg-white/[0.02]">
                            <div>
                              <p className="text-sm font-semibold text-txt-primary">{r.service || r.notes || 'Оплата'}</p>
                              <p className="text-xs text-txt-muted mt-0.5">{fd(r.date || r.paidAt || r.createdAt)}</p>
                            </div>
                            <Badge variant="success" size="sm">+{Number(r.total || r.amount || 0).toLocaleString()} ₸</Badge>
                          </div>
                        ))}
                        {fromAppts.map(a => (
                          <div key={a.id} className="flex items-center justify-between p-3 rounded-xl border border-bdr-subtle bg-white/[0.02]">
                            <div>
                              <p className="text-sm font-semibold text-txt-primary">{a.reason || a.service || '---'}</p>
                              <p className="text-xs text-txt-muted mt-0.5">{fd(a.date)} · {a.time}</p>
                            </div>
                            <Badge variant="info" size="sm">+{a.price.toLocaleString()} ₸</Badge>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
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
                    Нажмите для загрузки фото
                  </label>

                  {photos.filter(p => p.category === photoCategory).length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {photos.filter(p => p.category === photoCategory).map(photo => (
                        <div key={photo.id} className="rounded-xl overflow-hidden border border-bdr-subtle group">
                          <img src={photo.url} alt="Patient" className="w-full h-32 object-cover" />
                          <div className="flex items-center justify-between p-2 text-xs text-txt-muted">
                            <span>{fd(photo.date)}</span>
                            <button
                              onClick={async () => {
                                try {
                                  await api.deletePhoto(photo.id)
                                  setPhotos(prev => prev.filter(p => p.id !== photo.id))
                                } catch {
                                  showToast('Не удалось удалить фото', 'error')
                                }
                              }}
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
                      title="Нет фото в этой категории"
                    />
                  )}
                </motion.div>
              )}

              {activeTab === 'history' && (
                <motion.div key="history" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
                  <p className="text-sm font-bold text-txt-primary mb-4">История посещений</p>
                  {patientAppts.length === 0 ? (
                    <EmptyState
                      icon={<History size={32} />}
                      title="Нет записей о посещениях"
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
                            <p className="text-xs text-txt-muted mt-0.5">{fd(a.date)} · {a.time}</p>
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
