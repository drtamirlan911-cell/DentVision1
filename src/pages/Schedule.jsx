import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar, ChevronLeft, ChevronRight, Plus, Trash2, CheckCircle, XCircle,
  Clock, Search, ListOrdered, GripVertical, DollarSign, X, ArrowRight,
} from 'lucide-react'
import { useData } from '@/hooks/useData'
import { useAuth } from '@/context/AuthContext'
import { cn, today } from '@/lib/utils'
import { Button } from '@/components/ui/ds/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/ds/Card'
import { Input, Select } from '@/components/ui/ds/Input'
import { Badge, StatusBadge } from '@/components/ui/ds/Badge'
import { Modal } from '@/components/ui/ds/Modal'
import { Tabs } from '@/components/ui/ds/Misc'
import { EmptyState } from '@/components/ui/ds/EmptyState'
import { PageHeader } from '@/components/ui/ds/StatCard'
import { Avatar } from '@/components/ui/ds/Avatar'
import { T, APPOINTMENT_STATUS, HOURS, ALL_SERVICES, PAY_METHODS, gid } from '@/utils/constants'
import { tg } from '@/utils/constants'

const STATUS_CFG = APPOINTMENT_STATUS
const WORK_START = '08:00'
const WORK_END = '20:00'
const HOUR_HEIGHT = 64
const MIN_PER_SLOT = 30

const EMPTY_FORM = {
  patientId: '', doctorId: '', service: '', time: '09:00', status: 'scheduled', notes: '', duration: 60,
}
const EMPTY_PATIENT = { name: '', phone: '', email: '', dob: '', gender: '', notes: '' }
const EMPTY_PAYMENT = { payMethod: 'Наличные', amount: 0, paid: false }
const EMPTY_WAIT = { patientId: '', patientName: '', patientPhone: '', doctorId: '', preferredDate: '', preferredTime: '', preferredService: '', notes: '' }

function timeToMinutes(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m }
function minutesToTop(minutes) { return ((minutes - timeToMinutes(WORK_START)) / MIN_PER_SLOT) * (HOUR_HEIGHT / 2) }
function formatDuration(mins) { if (mins < 60) return `${mins} мин`; const h = Math.floor(mins / 60); const m = mins % 60; return m ? `${h} ч ${m} мин` : `${h} ч` }

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }

export default function Schedule() {
  const { user, roleInfo } = useAuth()
  const clinic = user?.clinicId ? { id: user.clinicId } : null
  const {
    appointments, patients, doctors, waitingList,
    upsertAppointment, deleteAppointment,
    upsertPatient, upsertReceipt,
    upsertWaitingListItem, deleteWaitingListItem,
  } = useData(clinic?.id)

  const [selDate, setSelDate] = useState(today())
  const [modalOpen, setModalOpen] = useState(false)
  const [editAppt, setEditAppt] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [dragged, setDragged] = useState(null)
  const [viewMode, setViewMode] = useState('doctors')
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState('all')
  const [activeTab, setActiveTab] = useState('schedule')
  const [waitModalOpen, setWaitModalOpen] = useState(false)
  const [waitForm, setWaitForm] = useState(EMPTY_WAIT)
  const [editWaitId, setEditWaitId] = useState(null)
  const [showNewPatient, setShowNewPatient] = useState(false)
  const [newPatient, setNewPatient] = useState(EMPTY_PATIENT)
  const [showPayment, setShowPayment] = useState(false)
  const [payment, setPayment] = useState(EMPTY_PAYMENT)
  const [searchAppts, setSearchAppts] = useState('')
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'info') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  const ownDataOnly = !!roleInfo?.ownDataOnly && user?.role === 'doctor'

  const dayAppts = useMemo(() => {
    let list = appointments.filter(a => a.date === selDate)
    if (ownDataOnly) list = list.filter(a => a.doctorId === user.id)
    if (selectedDoctorFilter !== 'all') list = list.filter(a => a.doctorId === selectedDoctorFilter)
    if (searchAppts) {
      const q = searchAppts.toLowerCase()
      list = list.filter(a => {
        const p = patients.find(pt => pt.id === a.patientId)
        return p?.name?.toLowerCase().includes(q) || a.notes?.toLowerCase().includes(q) || a.service?.toLowerCase().includes(q)
      })
    }
    return list
  }, [appointments, selDate, ownDataOnly, user, selectedDoctorFilter, patients, searchAppts])

  const dayWaitList = useMemo(
    () => waitingList.filter(w => w.status === 'waiting' && (!w.preferred_date || w.preferred_date === selDate)),
    [waitingList, selDate]
  )

  const doctorColumns = useMemo(() => {
    if (selectedDoctorFilter !== 'all') {
      const doc = doctors.find(d => d.id === selectedDoctorFilter)
      return doc ? [doc] : []
    }
    return doctors
  }, [doctors, selectedDoctorFilter])

  const serviceOptions = [{ value: '', label: '— Выберите услугу —' }, ...ALL_SERVICES.map(s => ({ value: s.id, label: `${s.name} — ${tg(s.price)}` }))]
  const selectedService = ALL_SERVICES.find(s => s.id === form.service)

  const openNew = () => { setEditAppt(null); setForm(EMPTY_FORM); setShowNewPatient(false); setNewPatient(EMPTY_PATIENT); setShowPayment(false); setPayment(EMPTY_PAYMENT); setModalOpen(true) }
  const openSlotBooking = (time, doctorId) => { setEditAppt(null); setForm({ ...EMPTY_FORM, time, doctorId: doctorId || '' }); setShowNewPatient(false); setNewPatient(EMPTY_PATIENT); setShowPayment(false); setPayment(EMPTY_PAYMENT); setModalOpen(true) }
  const openEdit = (a) => { setEditAppt(a); setForm({ patientId: a.patientId || '', doctorId: a.doctorId || '', service: a.service || a.reason || '', time: a.time, status: a.status, notes: a.notes || '', duration: a.duration || 60 }); setShowNewPatient(false); setShowPayment(false); setModalOpen(true) }

  const handleCreatePatient = async () => {
    if (!newPatient.name.trim()) { showToast('Введите ФИО пациента', 'warning'); return null }
    const patientData = { ...newPatient, id: gid(), clinicId: clinic?.id, category: 'new' }
    const created = await upsertPatient(patientData)
    showToast('Пациент добавлен', 'success')
    return created
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    let patientId = form.patientId
    if (showNewPatient && !patientId) { const created = await handleCreatePatient(); if (!created) return; patientId = created.id }
    if (!patientId || !form.time) { showToast('Выберите пациента и время', 'warning'); return }
    try {
      await upsertAppointment({ ...form, id: editAppt?.id, clinicId: clinic?.id, date: selDate, patientId, serviceId: form.service, serviceName: selectedService?.name || form.service, servicePrice: selectedService?.price || 0, reason: selectedService?.name || form.service })
      showToast(editAppt ? 'Запись обновлена' : 'Запись создана', 'success')
      if (showPayment && payment.paid && selectedService) {
        await upsertReceipt({ id: gid(), clinicId: clinic?.id, patientId, doctorId: form.doctorId || null, amount: selectedService.price, payMethod: payment.payMethod, status: 'paid', notes: `Оплата: ${selectedService.name}`, date: selDate })
        showToast('Оплата принята', 'success')
      }
      setModalOpen(false)
    } catch { showToast('Ошибка сохранения', 'error') }
  }

  const handleDelete = async () => { if (!editAppt) return; await deleteAppointment(editAppt.id); showToast('Запись удалена', 'success'); setModalOpen(false) }
  const handleDrop = async (e, timeSlot, doctorId) => { e.preventDefault(); if (!dragged) return; await upsertAppointment({ ...dragged, time: timeSlot, date: selDate, doctorId: doctorId || dragged.doctorId }); showToast('Запись перенесена', 'success'); setDragged(null) }
  const shiftDate = (days) => { const d = new Date(selDate); d.setDate(d.getDate() + days); setSelDate(d.toISOString().slice(0, 10)) }

  const patientOptions = [{ value: '', label: '— Выберите пациента —' }, ...patients.map(p => ({ value: p.id, label: p.name }))]
  const doctorOptions = [{ value: '', label: '— Выберите врача —' }, ...doctors.map(d => ({ value: d.id, label: `${d.name} (${d.spec || 'Врач'})` }))]

  const dayStats = useMemo(() => ({
    total: dayAppts.length,
    confirmed: dayAppts.filter(a => ['confirmed', 'done', 'completed'].includes(a.status)).length,
    scheduled: dayAppts.filter(a => ['scheduled', 'pending'].includes(a.status)).length,
    cancelled: dayAppts.filter(a => ['cancelled', 'noShow'].includes(a.status)).length,
  }), [dayAppts])

  const handleSaveWait = async () => {
    if (!waitForm.patientName.trim()) { showToast('Введите ФИО пациента', 'warning'); return }
    const doctor = doctors.find(d => d.id === waitForm.doctorId)
    await upsertWaitingListItem({ id: editWaitId || gid(), clinicId: clinic?.id, patientId: waitForm.patientId || null, patientName: waitForm.patientName, patientPhone: waitForm.patientPhone, doctorId: waitForm.doctorId || null, doctorName: doctor?.name || '', preferredDate: waitForm.preferredDate || null, preferredTime: waitForm.preferredTime || null, preferredService: waitForm.preferredService || '', notes: waitForm.notes || '', status: 'waiting' })
    showToast(editWaitId ? 'Запись обновлена' : 'Пациент добавлен в лист ожидания', 'success')
    setWaitModalOpen(false); setEditWaitId(null); setWaitForm(EMPTY_WAIT)
  }

  const handleDeleteWait = async (id) => { await deleteWaitingListItem(id); showToast('Удалено', 'success') }

  const handlePromoteFromWait = async (w) => {
    setForm({ ...EMPTY_FORM, patientId: w.patient_id || '', doctorId: w.doctor_id || '', time: w.preferred_time || '09:00', service: w.preferred_service || '' })
    setShowNewPatient(false); setShowPayment(false); setPayment(EMPTY_PAYMENT); setModalOpen(true)
    await deleteWaitingListItem(w.id)
    showToast('Перенесён в форму записи', 'info')
  }

  const renderAppointmentBlock = (appt, compact = false) => {
    const patient = patients.find(p => p.id === appt.patientId)
    const sc = STATUS_CFG[appt.status] || STATUS_CFG.scheduled
    const dur = appt.duration || 60
    const heightPx = (dur / MIN_PER_SLOT) * (HOUR_HEIGHT / 2) - 4
    return (
      <motion.div
        key={appt.id}
        layout
        draggable
        onDragStart={() => setDragged(appt)}
        onClick={(e) => { e.stopPropagation(); openEdit(appt) }}
        whileHover={{ scale: 1.01 }}
        className="rounded-lg cursor-grab active:cursor-grabbing mb-1 transition-all"
        style={{ background: `${sc.dot}12`, borderLeft: `3px solid ${sc.dot}`, minHeight: compact ? 32 : heightPx, padding: compact ? '6px 8px' : '8px 10px' }}
      >
        <div className="flex justify-between items-start gap-1">
          <span className="text-xs font-semibold text-txt-primary truncate">{patient?.name || 'Пациент'}</span>
          <span className="text-2xs font-bold whitespace-nowrap" style={{ color: sc.dot }}>{appt.time}</span>
        </div>
        <div className="text-2xs text-txt-muted mt-0.5 truncate">{appt.service || appt.reason || '—'}</div>
        {!compact && (
          <div className="flex justify-between items-center mt-1">
            <span className="text-2xs text-dv-gold/70">{formatDuration(dur)}</span>
            <Badge variant="default" size="xs">{sc.label}</Badge>
          </div>
        )}
      </motion.div>
    )
  }

  const stats = [
    { label: 'Всего', value: dayStats.total, icon: <Calendar size={14} />, variant: 'info' },
    { label: 'Ожидание', value: dayStats.scheduled, icon: <Clock size={14} />, variant: 'warning' },
    { label: 'Подтверждено', value: dayStats.confirmed, icon: <CheckCircle size={14} />, variant: 'success' },
    { label: 'Отмены', value: dayStats.cancelled, icon: <XCircle size={14} />, variant: 'error' },
  ]

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="max-w-7xl mx-auto space-y-4">
      {toast && (
        <div className={cn('fixed bottom-20 md:bottom-6 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg animate-fade-up',
          toast.type === 'success' && 'bg-success text-white',
          toast.type === 'error' && 'bg-error text-white',
          toast.type === 'warning' && 'bg-warning text-surface-0',
          toast.type === 'info' && 'bg-info text-white',
        )}>{toast.msg}</div>
      )}

      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-center justify-between gap-3">
        <PageHeader title="Расписание" subtitle="Управление записями и лист ожидания" icon={<Calendar size={20} />} />
        <div className="flex gap-2 flex-shrink-0">
          <Button onClick={openNew} icon={<Plus size={14} />} className="hidden sm:inline-flex">Новая запись</Button>
          <Button onClick={openNew} icon={<Plus size={14} />} className="sm:hidden !px-3">Новая</Button>
          {roleInfo?.canSeeSuperAdmin !== false && (
            <Button variant="secondary" onClick={() => { setWaitForm(EMPTY_WAIT); setEditWaitId(null); setWaitModalOpen(true) }} icon={<ListOrdered size={14} />}>
              <span className="hidden sm:inline">Лист ожидания</span>
              <span className="sm:hidden">Ожидание</span>
              {dayWaitList.length > 0 && <Badge variant="error" size="xs">{dayWaitList.length}</Badge>}
            </Button>
          )}
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div variants={fadeUp}>
        <Tabs
          tabs={[
            { id: 'schedule', label: 'Расписание', icon: <Calendar size={14} /> },
            { id: 'waiting', label: `Лист ожидания`, count: dayWaitList.length },
          ]}
          active={activeTab}
          onChange={setActiveTab}
        />
      </motion.div>

      {activeTab === 'schedule' ? (
        <>
          {/* Controls bar */}
          <motion.div variants={fadeUp} className="flex items-center gap-3 p-3 rounded-xl bg-surface-raised border border-bdr-subtle overflow-x-auto">
            <Button variant="ghost" size="icon-sm" onClick={() => shiftDate(-1)}><ChevronLeft size={16} /></Button>
            <input type="date" value={selDate} onChange={e => setSelDate(e.target.value)}
              className="h-8 px-3 rounded-lg bg-white/[0.04] border border-bdr-subtle text-sm text-txt-primary outline-none" />
            <Button variant="ghost" size="icon-sm" onClick={() => shiftDate(1)}><ChevronRight size={16} /></Button>
            <Button variant="outline" size="sm" onClick={() => setSelDate(today())}>Сегодня</Button>

            <div className="ml-auto flex items-center gap-2 flex-wrap">
              <Input placeholder="Поиск..." value={searchAppts} onChange={e => setSearchAppts(e.target.value)}
                icon={<Search size={14} />} className="!w-40 !h-8" />

              {doctors.length > 1 && (
                <Select value={selectedDoctorFilter} onChange={e => setSelectedDoctorFilter(e.target.value)}
                  options={[{ value: 'all', label: 'Все врачи' }, ...doctors.map(d => ({ value: d.id, label: d.name }))]}
                  className="!w-40 !h-8" />
              )}

              {roleInfo?.canSeeSuperAdmin !== false && (
                <div className="flex rounded-lg border border-bdr-subtle overflow-hidden">
                  {[{ key: 'doctors', label: 'По врачам' }, { key: 'single', label: 'Общий' }].map(m => (
                    <button key={m.key} onClick={() => setViewMode(m.key)}
                      className={cn('px-3 py-1.5 text-xs font-semibold transition-colors',
                        viewMode === m.key ? 'bg-dv-gold/15 text-dv-gold' : 'text-txt-muted hover:text-txt-secondary')}>
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div variants={fadeUp} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="flex items-center gap-3 p-3 rounded-xl bg-surface-raised border border-bdr-subtle">
                <Badge variant={s.variant} size="md">{s.value}</Badge>
                <div>
                  <p className="text-lg font-bold text-txt-primary leading-none">{s.value}</p>
                  <p className="text-2xs text-txt-muted mt-0.5">{s.label}</p>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Doctor columns */}
          {doctorColumns.length > 0 ? (
            <motion.div variants={fadeUp} className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
              <div className="grid gap-3" style={{ gridTemplateColumns: viewMode === 'doctors' ? `repeat(${Math.min(doctorColumns.length, 4)}, minmax(260px, 1fr))` : '1fr' }}>
              {doctorColumns.map(doc => {
                const docAppts = dayAppts.filter(a => a.doctorId === doc.id)
                return (
                  <Card key={doc.id} padding="none" className="overflow-hidden">
                    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-bdr-subtle bg-dv-gold/[0.03]">
                      <Avatar name={doc.name || '?'} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-txt-primary truncate">{doc.name}</p>
                        <p className="text-2xs text-txt-muted">{doc.spec || 'Врач'} · {docAppts.length} записей</p>
                      </div>
                    </div>
                    <div className="overflow-y-auto" style={{ maxHeight: 520 }}>
                      {HOURS.filter(h => h >= WORK_START && h <= WORK_END).map(time => {
                        const slotAppts = docAppts.filter(a => a.time === time)
                        const min = timeToMinutes(time)
                        const isLunch = min >= 720 && min < 780
                        return (
                          <div key={time}
                            onDragOver={e => e.preventDefault()}
                            onDrop={e => handleDrop(e, time, doc.id)}
                            onClick={() => slotAppts.length === 0 && !isLunch && openSlotBooking(time, doc.id)}
                            className={cn('flex border-b border-bdr-subtle transition-colors',
                              slotAppts.length === 0 && !isLunch && 'cursor-pointer hover:bg-dv-gold/[0.03]')}
                            style={{ minHeight: HOUR_HEIGHT }}>
                            <div className="w-12 shrink-0 px-1 text-center text-2xs font-semibold text-txt-muted pt-2.5 border-r border-bdr-subtle">{time}</div>
                            <div className="flex-1 p-1">
                              {isLunch ? (
                                <p className="text-2xs text-dv-gold/40 italic text-center pt-3">Обед</p>
                              ) : slotAppts.length === 0 ? (
                                <p className="text-2xs text-txt-ghost text-center pt-3">Свободно</p>
                              ) : (
                                slotAppts.map(a => renderAppointmentBlock(a))
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </Card>
                )
              })}
              </div>
            </motion.div>
          ) : (
            <EmptyState icon={<Calendar size={32} />} title="Нет врачей" description="Добавьте сотрудников для отображения расписания" />
          )}
        </>
      ) : (
        /* Waiting List */
        <motion.div variants={fadeUp}>
          <Card padding="none">
            <div className="flex items-center justify-between px-4 py-3 border-b border-bdr-subtle">
              <div className="flex items-center gap-2">
                <ListOrdered size={16} className="text-dv-gold" />
                <span className="text-sm font-semibold text-txt-primary">Лист ожидания</span>
                <Badge variant="gold" size="xs">{dayWaitList.length}</Badge>
              </div>
              <Button size="sm" onClick={() => { setWaitForm(EMPTY_WAIT); setEditWaitId(null); setWaitModalOpen(true) }} icon={<Plus size={14} />}>Добавить</Button>
            </div>
            {dayWaitList.length === 0 ? (
              <EmptyState icon={<ListOrdered size={32} />} title="Лист ожидания пуст" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-bdr-subtle">
                      {['Пациент', 'Телефон', 'Врач', 'Время', 'Услуга', 'Действия'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-2xs font-semibold text-txt-muted uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dayWaitList.map(w => (
                      <tr key={w.id} className="border-b border-bdr-subtle hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-2.5 font-medium text-txt-primary">{w.patient_name || '—'}</td>
                        <td className="px-4 py-2.5 text-txt-secondary">{w.patient_phone || '—'}</td>
                        <td className="px-4 py-2.5 text-dv-gold">{w.doctor_name || 'Любой'}</td>
                        <td className="px-4 py-2.5 text-txt-secondary">{w.preferred_time || '—'} {w.preferred_date ? `(${w.preferred_date})` : ''}</td>
                        <td className="px-4 py-2.5 text-txt-secondary">{w.preferred_service || '—'}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1">
                            <Button size="icon-xs" variant="ghost" onClick={() => handlePromoteFromWait(w)} title="Записать"><CheckCircle size={13} className="text-success" /></Button>
                            <Button size="icon-xs" variant="ghost" onClick={() => { setEditWaitId(w.id); setWaitForm({ patientId: w.patient_id || '', patientName: w.patient_name || '', patientPhone: w.patient_phone || '', doctorId: w.doctor_id || '', preferredDate: w.preferred_date || '', preferredTime: w.preferred_time || '', preferredService: w.preferred_service || '', notes: w.notes || '' }); setWaitModalOpen(true) }} title="Редактировать"><GripVertical size={13} className="text-dv-gold" /></Button>
                            <Button size="icon-xs" variant="ghost" onClick={() => handleDeleteWait(w.id)} title="Удалить"><Trash2 size={13} className="text-error" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </motion.div>
      )}

      {/* Appointment Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editAppt ? 'Редактировать запись' : 'Новая запись'} size="lg" className="max-md:!w-[calc(100vw-1rem)] max-md:!max-h-[calc(100vh-2rem)] max-md:!m-2">
        <form onSubmit={handleSubmit} className="space-y-3">
          {!showNewPatient ? (
            <>
              <Select label="Пациент" value={form.patientId} onChange={e => setForm({ ...form, patientId: e.target.value })} options={patientOptions} required />
              <button type="button" onClick={() => setShowNewPatient(true)} className="w-full py-2 rounded-lg border border-dashed border-dv-gold/40 text-dv-gold text-xs font-semibold hover:bg-dv-gold/5 transition-colors">
                + Добавить нового пациента
              </button>
            </>
          ) : (
            <div className="p-3 rounded-xl bg-dv-gold/5 border border-dv-gold/20 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-dv-gold">Новый пациент</span>
                <button type="button" onClick={() => { setShowNewPatient(false); setNewPatient(EMPTY_PATIENT) }} className="text-xs text-txt-muted hover:text-txt-primary">Выбрать из списка</button>
              </div>
              <Input label="ФИО *" value={newPatient.name} onChange={e => setNewPatient({ ...newPatient, name: e.target.value })} placeholder="Иванов Иван Иванович" required />
              <div className="grid grid-cols-2 gap-2">
                <Input label="Телефон" value={newPatient.phone} onChange={e => setNewPatient({ ...newPatient, phone: e.target.value })} placeholder="+7 777 000 00 00" />
                <Input label="Дата рождения" type="date" value={newPatient.dob} onChange={e => setNewPatient({ ...newPatient, dob: e.target.value })} />
              </div>
            </div>
          )}

          <Select label="Врач" value={form.doctorId} onChange={e => setForm({ ...form, doctorId: e.target.value })} options={doctorOptions} />
          <Select label="Услуга из прайса" value={form.service}
            onChange={e => { const svc = ALL_SERVICES.find(s => s.id === e.target.value); setForm({ ...form, service: e.target.value }); if (svc) setPayment({ ...payment, amount: svc.price }) }}
            options={serviceOptions} required />

          <div className="grid grid-cols-3 gap-2">
            <Select label="Время" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} options={HOURS.map(h => ({ value: h, label: h }))} required />
            <Select label="Длительность" value={form.duration} onChange={e => setForm({ ...form, duration: Number(e.target.value) })} options={[{ value: 30, label: '30 мин' }, { value: 45, label: '45 мин' }, { value: 60, label: '1 час' }, { value: 90, label: '1.5 ч' }, { value: 120, label: '2 часа' }]} />
            <Select label="Статус" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} options={Object.entries(STATUS_CFG).map(([k, v]) => ({ value: k, label: v.label }))} />
          </div>

          <Input label="Заметки" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Дополнительная информация" />

          {!editAppt && selectedService && (
            <div className={cn('p-3 rounded-xl border transition-colors', showPayment ? 'bg-success/5 border-success/20' : 'bg-white/[0.02] border-bdr-subtle')}>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-txt-secondary">Оплата: {tg(selectedService.price)}</span>
                <Button type="button" size="sm" variant={showPayment ? 'primary' : 'secondary'} onClick={() => setShowPayment(!showPayment)}>
                  {showPayment ? 'Принято' : 'Принять оплату'}
                </Button>
              </div>
              {showPayment && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Select label="Способ оплаты" value={payment.payMethod} onChange={e => setPayment({ ...payment, payMethod: e.target.value })} options={PAY_METHODS.map(m => ({ value: m, label: m }))} />
                  <Input label="Сумма" type="number" min="0" value={payment.amount} onChange={e => setPayment({ ...payment, amount: Number(e.target.value) })} />
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1">{editAppt ? 'Сохранить' : 'Сохранить'}</Button>
            {editAppt && <Button type="button" variant="danger" onClick={handleDelete} icon={<Trash2 size={14} />} />}
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Отмена</Button>
          </div>
        </form>
      </Modal>

      {/* Waiting List Modal */}
      <Modal open={waitModalOpen} onClose={() => setWaitModalOpen(false)} title={editWaitId ? 'Редактировать запись' : 'Добавить в лист ожидания'} className="max-md:!w-[calc(100vw-1rem)] max-md:!max-h-[calc(100vh-2rem)] max-md:!m-2">
        <div className="space-y-3">
          <Select label="Пациент (из базы)" value={waitForm.patientId}
            onChange={e => { const p = patients.find(pt => pt.id === e.target.value); setWaitForm({ ...waitForm, patientId: e.target.value, patientName: p?.name || waitForm.patientName, patientPhone: p?.phone || waitForm.patientPhone }) }}
            options={[{ value: '', label: '— Или введите вручную —' }, ...patients.map(p => ({ value: p.id, label: p.name }))]} />
          <div className="grid grid-cols-2 gap-2">
            <Input label="ФИО пациента *" value={waitForm.patientName} onChange={e => setWaitForm({ ...waitForm, patientName: e.target.value })} placeholder="Иванов Иван Иванович" required />
            <Input label="Телефон" value={waitForm.patientPhone} onChange={e => setWaitForm({ ...waitForm, patientPhone: e.target.value })} placeholder="+7 777 000 00 00" />
          </div>
          <Select label="Желаемый врач" value={waitForm.doctorId} onChange={e => setWaitForm({ ...waitForm, doctorId: e.target.value })}
            options={[{ value: '', label: '— Любой врач —' }, ...doctors.map(d => ({ value: d.id, label: `${d.name} (${d.spec || 'Врач'})` }))]} />
          <div className="grid grid-cols-2 gap-2">
            <Input label="Желаемая дата" type="date" value={waitForm.preferredDate} onChange={e => setWaitForm({ ...waitForm, preferredDate: e.target.value })} />
            <Select label="Желаемое время" value={waitForm.preferredTime} onChange={e => setWaitForm({ ...waitForm, preferredTime: e.target.value })}
              options={[{ value: '', label: '— Любое —' }, ...HOURS.map(h => ({ value: h, label: h }))]} />
          </div>
          <Input label="Желаемая услуга" value={waitForm.preferredService} onChange={e => setWaitForm({ ...waitForm, preferredService: e.target.value })} placeholder="Консультация, отбеливание..." />
          <Input label="Заметки" value={waitForm.notes} onChange={e => setWaitForm({ ...waitForm, notes: e.target.value })} placeholder="Дополнительная информация" />
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSaveWait} className="flex-1">{editWaitId ? 'Обновить' : 'Добавить'}</Button>
            <Button variant="ghost" onClick={() => { setWaitModalOpen(false); setEditWaitId(null) }}>Отмена</Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  )
}
