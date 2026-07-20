import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar, ChevronLeft, ChevronRight, Plus, Trash2, CheckCircle, XCircle,
  Clock, Search, ListOrdered, GripVertical, DollarSign, X, ArrowRight, User, Stethoscope,
  WifiOff, CloudOff, Printer, ClipboardCheck, Globe,
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDataQuery } from '@/queries/useDataQuery'
import { queryKeys } from '@/queries/keys'
import * as api from '@/utils/api'
import {
  cacheDayAppointments,
  enqueueAppointmentUpsert,
  flushSyncQueue,
  getSyncQueue,
  isLikelyOffline,
  readCachedDayAppointments,
  startSyncQueueListener,
} from '@/lib/syncQueue'
import { useAuth } from '@/store/auth.store'
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
import { T, APPOINTMENT_STATUS, HOURS, ALL_SERVICES, PAY_METHODS, gid, DENTAL_ICD10, UPPER, LOWER, TOOTH_NAMES } from '@/utils/constants'
import { tg } from '@/utils/constants'
import type { Appointment, Patient, WaitingListItem, User, Booking } from '@/types'

const STATUS_CFG = APPOINTMENT_STATUS
const WORK_START = '08:00'
const WORK_END = '20:00'
const HOUR_HEIGHT = 64
const MIN_PER_SLOT = 30

const EMPTY_FORM = {
  patientId: '', doctorId: '', service: '', time: '09:00', status: 'scheduled', notes: '', duration: 60,
  diagnosis: '', toothNumber: '', chairId: '',
}
const EMPTY_PATIENT = { name: '', phone: '', email: '', dob: '', gender: '', notes: '' }
const EMPTY_WAIT = { patientId: '', patientName: '', patientPhone: '', doctorId: '', preferredDate: '', preferredTime: '', preferredService: '', notes: '' }

function timeToMinutes(t: string): number { const [h, m] = t.split(':').map(Number); return h * 60 + m }
function minutesToTop(minutes: number): number { return ((minutes - timeToMinutes(WORK_START)) / MIN_PER_SLOT) * (HOUR_HEIGHT / 2) }
function formatDuration(mins: number): string { if (mins < 60) return `${mins} мин`; const h = Math.floor(mins / 60); const m = mins % 60; return m ? `${h} ч ${m} мин` : `${h} ч` }
function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d.toISOString().slice(0, 10)
}
function getWeekDates(weekStart: string): string[] {
  const dates: string[] = []
  const d = new Date(weekStart + 'T12:00:00')
  for (let i = 0; i < 7; i++) { dates.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1) }
  return dates
}
const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }

export default function Schedule() {
  const { user, roleInfo, clinic: activeClinic } = useAuth()
  const clinic = user?.clinicId ? { id: user.clinicId } : null
  const {
    appointments: liveAppointments, patients, doctors, waitingList, bookings, receipts,
    upsertAppointment: upsertAppointmentApi, deleteAppointment,
    upsertPatient, upsertReceipt,
    upsertWaitingListItem, deleteWaitingListItem,
  } = useDataQuery(clinic?.id)

  const queryClient = useQueryClient()
  const chairsQ = useQuery({
    queryKey: queryKeys.chairs,
    queryFn: () => api.getChairs(clinic?.id),
    enabled: !!clinic?.id,
  })
  const chairs = chairsQ.data || []

  const navigate = useNavigate()
  const [selDate, setSelDate] = useState(today())
  const [modalOpen, setModalOpen] = useState(false)
  const [editAppt, setEditAppt] = useState<Appointment | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [dragged, setDragged] = useState<Appointment | null>(null)
  const [viewMode, setViewMode] = useState<'doctors' | 'single' | 'chairs'>('doctors')
  const [periodMode, setPeriodMode] = useState<'day' | 'week'>('day')
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState('all')
  const [activeTab, setActiveTab] = useState('schedule')
  const [waitModalOpen, setWaitModalOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [closeAppt, setCloseAppt] = useState<Appointment | null>(null)
  const [closeNotes, setCloseNotes] = useState('')
  const [closeServices, setCloseServices] = useState<Array<{ name: string; price: number; matCost: number }>>([])
  const [priceOptions, setPriceOptions] = useState<Array<{ name: string; price: number; matCost: number }>>([])
  const [closeSaving, setCloseSaving] = useState(false)
  const [waitForm, setWaitForm] = useState(EMPTY_WAIT)
  const [editWaitId, setEditWaitId] = useState<string | null>(null)
  const [showNewPatient, setShowNewPatient] = useState(false)
  const [newPatient, setNewPatient] = useState(EMPTY_PATIENT)
  const [searchAppts, setSearchAppts] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false)
  const [pendingSync, setPendingSync] = useState(0)

  const showToast = (msg: string, type: string = 'info'): void => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  useEffect(() => {
    const onOff = () => setOffline(true)
    const onOn = () => setOffline(false)
    window.addEventListener('offline', onOff)
    window.addEventListener('online', onOn)
    const stop = startSyncQueueListener((r) => {
      setPendingSync(getSyncQueue().length)
      if (r.flushed > 0) showToast(`Синхронизировано: ${r.flushed}`, 'success')
    })
    setPendingSync(getSyncQueue().length)
    return () => {
      window.removeEventListener('offline', onOff)
      window.removeEventListener('online', onOn)
      stop()
    }
  }, [])

  useEffect(() => {
    if (clinic?.id && liveAppointments.length) {
      cacheDayAppointments(clinic.id, selDate, liveAppointments.filter((a) => a.date === selDate))
    }
  }, [clinic?.id, selDate, liveAppointments])

  const appointments = useMemo(() => {
    if (liveAppointments.length) return liveAppointments
    if (clinic?.id) {
      const cached = readCachedDayAppointments(clinic.id, selDate)
      if (cached?.length) return cached
    }
    return liveAppointments
  }, [liveAppointments, clinic?.id, selDate])

  const upsertAppointment = async (data: Partial<Appointment> & { force?: boolean; id?: string }) => {
    try {
      const result = await upsertAppointmentApi(data)
      setPendingSync(getSyncQueue().length)
      return result
    } catch (err) {
      if (isLikelyOffline(err) && data.id) {
        enqueueAppointmentUpsert({ ...data, id: data.id } as any)
        setPendingSync(getSyncQueue().length)
        showToast('Нет сети — запись в очереди синка', 'warning')
        return data
      }
      throw err
    }
  }

  const ownDataOnly = !!roleInfo?.ownDataOnly && user?.role === 'doctor'

  const dayAppts = useMemo(() => {
    let list = appointments.filter(a => a.date === selDate)
    if (ownDataOnly) list = list.filter(a => a.doctorId === user!.id)
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
    () => waitingList.filter(w => {
      if (w.status !== 'waiting') return false
      const pref = w.preferredDate ?? (w as { preferred_date?: string }).preferred_date
      return !pref || pref === selDate
    }),
    [waitingList, selDate]
  )

  const pendingBookings = useMemo(
    () => (bookings as Booking[]).filter((b) => {
      if (b.status !== 'pending') return false
      return !b.date || b.date === selDate
    }),
    [bookings, selDate]
  )

  const weekStart = useMemo(() => getWeekStart(selDate), [selDate])
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart])

  const weekApptsByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {}
    for (const d of weekDates) {
      let list = appointments.filter(a => a.date === d)
      if (ownDataOnly) list = list.filter(a => a.doctorId === user!.id)
      if (selectedDoctorFilter !== 'all') list = list.filter(a => a.doctorId === selectedDoctorFilter)
      if (searchAppts) {
        const q = searchAppts.toLowerCase()
        list = list.filter(a => {
          const p = patients.find(pt => pt.id === a.patientId)
          return p?.name?.toLowerCase().includes(q) || a.notes?.toLowerCase().includes(q) || a.service?.toLowerCase().includes(q)
        })
      }
      map[d] = list.sort((a, b) => a.time.localeCompare(b.time))
    }
    return map
  }, [appointments, weekDates, ownDataOnly, user, selectedDoctorFilter, patients, searchAppts])

  const doctorColumns = useMemo(() => {
    if (selectedDoctorFilter !== 'all') {
      const doc = doctors.find(d => d.id === selectedDoctorFilter)
      return doc ? [doc] : []
    }
    return doctors
  }, [doctors, selectedDoctorFilter])

  const serviceOptions = [{ value: '', label: '— Выберите услугу —' }, ...ALL_SERVICES.map(s => ({ value: s.id, label: `${s.name} — ${tg(s.price)}` }))]
  const selectedService = ALL_SERVICES.find(s => s.id === form.service)

  const openNew = (): void => { setEditAppt(null); setForm(EMPTY_FORM); setShowNewPatient(false); setNewPatient(EMPTY_PATIENT); setModalOpen(true) }
  const openSlotBooking = (time: string, doctorId: string, chairId = ''): void => {
    setEditAppt(null)
    setForm({ ...EMPTY_FORM, time, doctorId: doctorId || '', chairId })
    setShowNewPatient(false)
    setNewPatient(EMPTY_PATIENT)
    setModalOpen(true)
  }
  const openEdit = (a: Appointment): void => {
    setEditAppt(a)
    setForm({
      patientId: a.patientId || '',
      doctorId: a.doctorId || '',
      service: a.service || a.reason || '',
      time: a.time,
      status: a.status,
      notes: a.notes || '',
      duration: a.duration || 60,
      diagnosis: a.diagnosis || '',
      toothNumber: a.toothNumber || '',
      chairId: a.chairId || '',
    })
    setShowNewPatient(false)
    setModalOpen(true)
  }

  const handleCreatePatient = async (): Promise<Patient | null> => {
    if (!newPatient.name.trim()) { showToast('Введите ФИО пациента', 'warning'); return null }
    const patientData = { ...newPatient, id: gid(), clinicId: clinic?.id, category: 'new' }
    const created = await upsertPatient(patientData)
    showToast('Пациент добавлен', 'success')
    return created
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    let patientId = form.patientId
    if (showNewPatient && !patientId) { const created = await handleCreatePatient(); if (!created) return; patientId = created.id }
    if (!patientId || !form.time) { showToast('Выберите пациента и время', 'warning'); return }
    if (!form.doctorId) { showToast('Выберите врача', 'warning'); return }
    const chair = chairs.find((c) => c.id === form.chairId)
    const payload = {
      ...form,
      id: editAppt?.id || gid(),
      clinicId: clinic?.id,
      date: selDate,
      patientId,
      serviceId: form.service,
      serviceName: selectedService?.name || form.service,
      servicePrice: selectedService?.price || 0,
      reason: selectedService?.name || form.service,
      diagnosis: form.diagnosis,
      toothNumber: form.toothNumber,
      chairId: form.chairId || '',
      chairName: chair?.name || '',
      paymentStatus: editAppt?.paymentStatus || 'unpaid',
    }
    try {
      await upsertAppointment(payload)
      showToast(editAppt ? 'Запись обновлена' : 'Запись создана. Оплата: Касса → К оплате', 'success')
      setModalOpen(false)
    } catch (err: any) {
      const msg = String(err?.message || '')
      if (msg.includes('Конфликт') || msg.includes('конфликт')) {
        const force = window.confirm(`${msg}\n\nСохранить запись всё равно (овербукинг)?`)
        if (!force) return
        try {
          await upsertAppointment({ ...payload, force: true })
          showToast('Запись сохранена с овербукингом', 'warning')
          setModalOpen(false)
        } catch {
          showToast('Ошибка сохранения', 'error')
        }
        return
      }
      showToast(msg || 'Ошибка сохранения', 'error')
    }
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, timeSlot: string, doctorId: string): Promise<void> => {
    e.preventDefault()
    if (!dragged) return
    try {
      await upsertAppointment({ ...dragged, time: timeSlot, date: selDate, doctorId: doctorId || dragged.doctorId })
      showToast('Запись перенесена', 'success')
    } catch (err: any) {
      const msg = String(err?.message || '')
      if (msg.includes('Конфликт') || msg.includes('конфликт')) {
        const force = window.confirm(`${msg}\n\nПеренести всё равно?`)
        if (force) {
          await upsertAppointment({ ...dragged, time: timeSlot, date: selDate, doctorId: doctorId || dragged.doctorId, force: true })
          showToast('Перенесено с овербукингом', 'warning')
        }
      } else {
        showToast(msg || 'Не удалось перенести', 'error')
      }
    }
    setDragged(null)
  }
  const handleDelete = async (): Promise<void> => { if (!editAppt) return; await deleteAppointment(editAppt.id); showToast('Запись удалена', 'success'); setModalOpen(false) }

  const openCloseVisit = async (appt: Appointment) => {
    setCloseAppt(appt)
    setCloseNotes(appt.notes || '')
    setCloseServices(appt.service || appt.serviceName
      ? [{ name: String(appt.service || appt.serviceName), price: Number(appt.servicePrice || 0), matCost: Number((appt as any).matCost || 0) }]
      : [])
    setCloseOpen(true)
    setModalOpen(false)
    try {
      const rows = await api.getPriceList()
      const opts = (rows || []).map((r: any) => ({
        name: r.name || r.serviceCode,
        price: Number(r.price || 0),
        matCost: Number(r.matCost || 0),
      })).filter((r: any) => r.name)
      // Also include catalog defaults lightly
      setPriceOptions(opts)
    } catch {
      setPriceOptions([])
    }
  }

  const handleCloseVisit = async () => {
    if (!closeAppt) return
    setCloseSaving(true)
    try {
      const res = await api.closeAppointment(closeAppt.id, {
        notes: closeNotes,
        services: closeServices,
        paymentStatus: closeAppt.paymentStatus || 'unpaid',
      })
      await queryClient.invalidateQueries({ queryKey: queryKeys.appointments })
      await queryClient.invalidateQueries({ queryKey: queryKeys.inventory })
      showToast(
        res?.deducted?.length
          ? `Приём закрыт. Склад: ${res.deducted.join(', ')}`
          : 'Приём закрыт',
        'success',
      )
      setCloseOpen(false)
      setCloseAppt(null)
    } catch (err: any) {
      showToast(err?.message || 'Не удалось закрыть приём', 'error')
    } finally {
      setCloseSaving(false)
    }
  }

  const printDaySchedule = () => {
    const rows = dayAppts.map((a) => {
      const p = patients.find((x) => x.id === a.patientId)
      const d = doctors.find((x) => x.id === a.doctorId)
      return `<tr><td>${a.time || ''}</td><td>${d?.name || '—'}</td><td>${p?.name || a.patientName || '—'}</td><td>${a.service || a.reason || '—'}</td><td>${p?.phone || a.patientPhone || '—'}</td></tr>`
    }).join('')
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Расписание ${selDate}</title>
      <style>body{font-family:sans-serif;padding:24px} table{width:100%;border-collapse:collapse;margin-top:16px} th,td{border:1px solid #333;padding:8px;text-align:left} th{background:#eee}</style></head>
      <body><h1>Расписание на ${selDate}</h1><p>${activeClinic?.name || 'Клиника'}</p>
      <table><thead><tr><th>Время</th><th>Врач</th><th>Пациент</th><th>Услуга</th><th>Телефон</th></tr></thead><tbody>${rows || '<tr><td colspan="5">Нет записей</td></tr>'}</tbody></table>
      <script>window.onload=()=>window.print()</script></body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close() }
  }

  const printZReport = async () => {
    let byMethod: Record<string, number> = {}
    let total = 0
    try {
      const report = await api.getFinanceReport({ from: selDate, to: selDate })
      for (const row of report?.byMethod || []) {
        byMethod[row.method] = Number(row.revenue || 0)
        total += Number(row.revenue || 0)
      }
    } catch { /* fallback below */ }
    if (total === 0) {
      const dayReceipts = (receipts || []).filter((r: any) => {
        const d = String(r.date || r.paidAt || r.createdAt || '').slice(0, 10)
        return d === selDate && ['paid', 'completed', 'PAID'].includes(String(r.status || ''))
      })
      byMethod = {}
      total = 0
      for (const r of dayReceipts) {
        const m = r.payMethod || 'Прочее'
        byMethod[m] = (byMethod[m] || 0) + Number(r.total || r.amount || 0)
        total += Number(r.total || r.amount || 0)
      }
    }
    const doneAppts = dayAppts.filter((a) => ['done', 'completed'].includes(a.status))
    const unpaid = doneAppts.filter((a) => a.paymentStatus !== 'paid')
    const methodRows = Object.entries(byMethod).map(([m, v]) => `<tr><td>${m}</td><td style="text-align:right">${v.toLocaleString('ru-RU')} ₸</td></tr>`).join('')
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Z-отчёт ${selDate}</title>
      <style>body{font-family:sans-serif;padding:24px} table{width:100%;border-collapse:collapse;margin-top:12px} th,td{border:1px solid #333;padding:8px}</style></head>
      <body><h1>Z-отчёт кассы</h1><p>${activeClinic?.name || ''} · ${selDate}</p>
      <p>Завершённых приёмов: <b>${doneAppts.length}</b> · Без оплаты: <b>${unpaid.length}</b></p>
      <h3>По способам оплаты</h3>
      <table><thead><tr><th>Способ</th><th>Сумма</th></tr></thead><tbody>${methodRows || '<tr><td colspan="2">Нет оплат</td></tr>'}</tbody>
      <tfoot><tr><th>Итого</th><th style="text-align:right">${total.toLocaleString('ru-RU')} ₸</th></tr></tfoot></table>
      <script>window.onload=()=>window.print()</script></body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close() }
  }
  const shiftDate = (days: number): void => { const d = new Date(selDate); d.setDate(d.getDate() + days); setSelDate(d.toISOString().slice(0, 10)) }
  const shiftPeriod = (dir: -1 | 1): void => shiftDate(periodMode === 'week' ? dir * 7 : dir)

  const patientOptions = [{ value: '', label: '— Выберите пациента —' }, ...patients.map(p => ({ value: p.id, label: p.name }))]
  const doctorOptions = [{ value: '', label: '— Выберите врача —' }, ...doctors.map(d => ({ value: d.id, label: `${d.name} (${d.spec || 'Врач'})` }))]

  const dayStats = useMemo(() => ({
    total: dayAppts.length,
    scheduled: dayAppts.filter(a => ['scheduled', 'pending'].includes(a.status)).length,
    confirmed: dayAppts.filter(a => ['confirmed', 'reminderSent'].includes(a.status)).length,
    arrived: dayAppts.filter(a => a.status === 'arrived').length,
    inChair: dayAppts.filter(a => a.status === 'in_chair').length,
    done: dayAppts.filter(a => ['done', 'completed'].includes(a.status)).length,
    cancelled: dayAppts.filter(a => ['cancelled', 'noShow'].includes(a.status)).length,
  }), [dayAppts])

  const advanceStatus = async (appt: Appointment, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const chain = ['scheduled', 'confirmed', 'arrived', 'in_chair', 'done'] as const
    const idx = chain.indexOf(appt.status as typeof chain[number])
    const next = idx >= 0 && idx < chain.length - 1 ? chain[idx + 1] : null
    if (!next) return
    try {
      await upsertAppointment({ ...appt, status: next })
      showToast(`Статус: ${STATUS_CFG[next]?.label || next}`, 'success')
    } catch {
      showToast('Не удалось сменить статус', 'error')
    }
  }

  const handleSaveWait = async (): Promise<void> => {
    if (!waitForm.patientName.trim()) { showToast('Введите ФИО пациента', 'warning'); return }
    const doctor = doctors.find(d => d.id === waitForm.doctorId)
    await upsertWaitingListItem({ id: editWaitId || gid(), clinicId: clinic?.id, patientId: waitForm.patientId || null, patientName: waitForm.patientName, patientPhone: waitForm.patientPhone, doctorId: waitForm.doctorId || null, doctorName: doctor?.name || '', preferredDate: waitForm.preferredDate || null, preferredTime: waitForm.preferredTime || null, preferredService: waitForm.preferredService || '', notes: waitForm.notes || '', status: 'waiting' })
    showToast(editWaitId ? 'Запись обновлена' : 'Пациент добавлен в лист ожидания', 'success')
    setWaitModalOpen(false); setEditWaitId(null); setWaitForm(EMPTY_WAIT)
  }

  const handleDeleteWait = async (id: string): Promise<void> => { await deleteWaitingListItem(id); showToast('Удалено', 'success') }

  const handleConfirmBooking = async (b: Booking): Promise<void> => {
    try {
      await api.confirmBooking(b.id)
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings })
      queryClient.invalidateQueries({ queryKey: queryKeys.appointments })
      queryClient.invalidateQueries({ queryKey: queryKeys.patients })
      showToast('Заявка подтверждена — запись создана', 'success')
    } catch (e: any) {
      showToast(e?.message || 'Не удалось подтвердить', 'error')
    }
  }

  const handleRejectBooking = async (id: string): Promise<void> => {
    try {
      await api.deleteBooking(id)
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings })
      showToast('Заявка отклонена', 'success')
    } catch {
      showToast('Ошибка', 'error')
    }
  }

  const handlePromoteFromWait = async (w: any): Promise<void> => {
    setForm({ ...EMPTY_FORM, patientId: w.patient_id || '', doctorId: w.doctor_id || '', time: w.preferred_time || '09:00', service: w.preferred_service || '' })
    setShowNewPatient(false); setModalOpen(true)
    await deleteWaitingListItem(w.id)
    showToast('Перенесён в форму записи', 'info')
  }

  const renderAppointmentBlock = (appt: Appointment, compact = false): React.ReactNode => {
    const patient = patients.find(p => p.id === appt.patientId)
    const sc = STATUS_CFG[appt.status] || STATUS_CFG.scheduled
    const dur = appt.duration || 60
    const heightPx = (dur / MIN_PER_SLOT) * (HOUR_HEIGHT / 2) - 4
    const toothLabel = appt.toothNumber ? `Зуб ${appt.toothNumber}` : ''
    const diagShort = appt.diagnosis ? appt.diagnosis.split(' — ')[0] : ''
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
        {(diagShort || toothLabel) && (
          <div className="flex items-center gap-1 mt-0.5">
            {diagShort && <span className="text-2xs text-dv-gold/70 font-medium">{diagShort}</span>}
            {toothLabel && <span className="text-2xs text-emerald-400/70 font-medium">· {toothLabel}</span>}
          </div>
        )}
        {!compact && (
          <div className="flex justify-between items-center mt-1">
            <span className="text-2xs text-dv-gold/70">{formatDuration(dur)}</span>
            <div className="flex items-center gap-1">
              {appt.paymentStatus === 'paid' ? (
                <Badge variant="success" size="xs">Оплачено</Badge>
              ) : (
                <Badge variant="warning" size="xs">Не оплачено</Badge>
              )}
              <button
                type="button"
                title="Следующий статус"
                onClick={(e) => advanceStatus(appt, e)}
                className="inline-flex"
              >
                <Badge variant="default" size="xs">{sc.label || sc.l}</Badge>
              </button>
            </div>
          </div>
        )}
      </motion.div>
    )
  }

  const stats = [
    { label: 'Всего', value: dayStats.total, icon: <Calendar size={14} />, variant: 'info' },
    { label: 'Запись', value: dayStats.scheduled, icon: <Clock size={14} />, variant: 'warning' },
    { label: 'Подтверждено', value: dayStats.confirmed, icon: <CheckCircle size={14} />, variant: 'success' },
    { label: 'Пришёл', value: dayStats.arrived, icon: <User size={14} />, variant: 'warning' },
    { label: 'В кресле', value: dayStats.inChair, icon: <Stethoscope size={14} />, variant: 'gold' },
    { label: 'Готово', value: dayStats.done, icon: <CheckCircle size={14} />, variant: 'success' },
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
        <PageHeader title="Расписание" subtitle="Записи, лист ожидания и онлайн-заявки" icon={<Calendar size={20} />} />
        <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
          <Button variant="secondary" onClick={printDaySchedule} icon={<Printer size={14} />}>
            <span className="hidden sm:inline">Печать дня</span>
          </Button>
          <Button variant="secondary" onClick={printZReport} icon={<ClipboardCheck size={14} />}>
            <span className="hidden sm:inline">Z-отчёт</span>
          </Button>
          <Button variant="secondary" onClick={() => navigate('/crm/cashier')} icon={<DollarSign size={14} />}>Касса</Button>
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

      {(offline || pendingSync > 0) && (
        <motion.div variants={fadeUp} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-warning/30 bg-warning/10 text-sm text-txt-primary">
          {offline ? <WifiOff size={16} className="text-warning" /> : <CloudOff size={16} className="text-warning" />}
          <span className="flex-1">
            {offline ? 'Офлайн-режим: правки сохраняются в очередь синка.' : `Очередь синка: ${pendingSync}`}
          </span>
          {!offline && pendingSync > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                const r = await flushSyncQueue()
                setPendingSync(getSyncQueue().length)
                showToast(r.flushed ? `Синхронизировано: ${r.flushed}` : 'Нечего синхронизировать', r.flushed ? 'success' : 'info')
              }}
            >
              Синхронизировать
            </Button>
          )}
        </motion.div>
      )}

      {/* Tabs */}
      <motion.div variants={fadeUp}>
        <Tabs
          tabs={[
            { id: 'schedule', label: 'Расписание', icon: <Calendar size={14} /> },
            { id: 'waiting', label: `Лист ожидания`, count: dayWaitList.length },
            { id: 'online', label: 'Онлайн-запись', icon: <Globe size={14} />, count: pendingBookings.length },
          ]}
          active={activeTab}
          onChange={setActiveTab}
        />
      </motion.div>

      {activeTab === 'schedule' ? (
        <>
          {/* Controls bar */}
          <motion.div variants={fadeUp} className="flex items-center gap-3 p-3 rounded-xl bg-surface-raised border border-bdr-subtle overflow-x-auto">
            <Button variant="ghost" size="icon-sm" onClick={() => shiftPeriod(-1)}><ChevronLeft size={16} /></Button>
            <input type="date" value={selDate} onChange={e => setSelDate(e.target.value)}
              className="h-8 px-3 rounded-lg bg-white/[0.04] border border-bdr-subtle text-sm text-txt-primary outline-none" />
            <Button variant="ghost" size="icon-sm" onClick={() => shiftPeriod(1)}><ChevronRight size={16} /></Button>
            <Button variant="outline" size="sm" onClick={() => setSelDate(today())}>Сегодня</Button>

            <div className="flex rounded-lg border border-bdr-subtle overflow-hidden">
              {([['day', 'День'], ['week', 'Неделя']] as const).map(([key, label]) => (
                <button key={key} onClick={() => setPeriodMode(key)}
                  className={cn('px-3 py-1.5 text-xs font-semibold transition-colors',
                    periodMode === key ? 'bg-dv-gold/15 text-dv-gold' : 'text-txt-muted hover:text-txt-secondary')}>
                  {label}
                </button>
              ))}
            </div>

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
                  {([
                    { key: 'doctors' as const, label: 'По врачам' },
                    { key: 'chairs' as const, label: 'По креслам' },
                    { key: 'single' as const, label: 'Общий' },
                  ]).map(m => (
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

          {periodMode === 'week' ? (
            <motion.div variants={fadeUp} className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
              <div className="grid grid-cols-7 gap-2 min-w-[700px]">
                {weekDates.map((d, i) => {
                  const appts = weekApptsByDate[d] || []
                  const [, mo, dd] = d.split('-')
                  const isToday = d === today()
                  const isSelected = d === selDate
                  return (
                    <div key={d} className="flex flex-col rounded-xl bg-surface-raised border border-bdr-subtle overflow-hidden min-h-[320px]">
                      <button
                        type="button"
                        onClick={() => { setSelDate(d); setPeriodMode('day') }}
                        className={cn('px-2 py-2 text-center border-b border-bdr-subtle transition-colors hover:bg-dv-gold/[0.06]',
                          isSelected && 'bg-dv-gold/10', isToday && 'ring-1 ring-inset ring-dv-gold/40')}
                      >
                        <p className="text-2xs font-semibold text-txt-muted">{WEEKDAY_LABELS[i]}</p>
                        <p className={cn('text-sm font-bold', isToday ? 'text-dv-gold' : 'text-txt-primary')}>{dd}.{mo}</p>
                        <p className="text-2xs text-txt-muted">{appts.length} зап.</p>
                      </button>
                      <div className="flex-1 p-1.5 space-y-1 overflow-y-auto" style={{ maxHeight: 480 }}>
                        {appts.length === 0 ? (
                          <p className="text-2xs text-txt-ghost text-center pt-4">Нет записей</p>
                        ) : (
                          appts.map(a => renderAppointmentBlock(a, true))
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          ) : (
            <>
              {/* Stats */}
              <motion.div variants={fadeUp} className="grid grid-cols-3 lg:grid-cols-6 gap-3">
                {stats.map((s) => (
                  <div key={s.label} className="flex items-center gap-3 p-3 rounded-xl bg-surface-raised border border-bdr-subtle">
                    <Badge variant={s.variant as any} size="md">{s.value}</Badge>
                    <div>
                      <p className="text-lg font-bold text-txt-primary leading-none">{s.value}</p>
                      <p className="text-2xs text-txt-muted mt-0.5">{s.label}</p>
                    </div>
                  </div>
                ))}
              </motion.div>

              {/* Doctor / chair columns */}
              {viewMode === 'chairs' ? (
                chairs.length > 0 ? (
                  <motion.div variants={fadeUp} className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(chairs.length, 4)}, minmax(260px, 1fr))` }}>
                      {chairs.map((chair) => {
                        const chairAppts = dayAppts.filter((a) => a.chairId === chair.id)
                        return (
                          <Card key={chair.id} padding="none" className="overflow-hidden">
                            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-bdr-subtle bg-dv-gold/[0.03]">
                              <Stethoscope size={16} className="text-dv-gold" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-txt-primary truncate">{chair.name}</p>
                                <p className="text-2xs text-txt-muted">{chairAppts.length} записей</p>
                              </div>
                            </div>
                            <div className="overflow-y-auto" style={{ maxHeight: 520 }}>
                              {HOURS.filter((h) => h >= WORK_START && h <= WORK_END).map((time) => {
                                const slotAppts = chairAppts.filter((a) => a.time === time)
                                const min = timeToMinutes(time)
                                const isLunch = min >= 720 && min < 780
                                return (
                                  <div
                                    key={time}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={async (e) => {
                                      e.preventDefault()
                                      if (!dragged) return
                                      try {
                                        await upsertAppointment({ ...dragged, time, date: selDate, chairId: chair.id, chairName: chair.name })
                                        showToast('Перенесено на кресло', 'success')
                                      } catch (err: any) {
                                        const msg = String(err?.message || '')
                                        if (msg.includes('Конфликт') || msg.includes('конфликт')) {
                                          const force = window.confirm(`${msg}\n\nПеренести всё равно?`)
                                          if (force) {
                                            await upsertAppointment({ ...dragged, time, date: selDate, chairId: chair.id, chairName: chair.name, force: true })
                                            showToast('Перенесено с овербукингом', 'warning')
                                          }
                                        } else {
                                          showToast(msg || 'Не удалось перенести', 'error')
                                        }
                                      }
                                      setDragged(null)
                                    }}
                                    onClick={() => slotAppts.length === 0 && !isLunch && openSlotBooking(time, form.doctorId || doctors[0]?.id || '', chair.id)}
                                    className={cn('flex border-b border-bdr-subtle transition-colors',
                                      slotAppts.length === 0 && !isLunch && 'cursor-pointer hover:bg-dv-gold/[0.03]')}
                                    style={{ minHeight: HOUR_HEIGHT }}
                                  >
                                    <div className="w-12 shrink-0 px-1 text-center text-2xs font-semibold text-txt-muted pt-2.5 border-r border-bdr-subtle">{time}</div>
                                    <div className="flex-1 p-1">
                                      {isLunch ? (
                                        <p className="text-2xs text-dv-gold/40 italic text-center pt-3">Обед</p>
                                      ) : slotAppts.length === 0 ? (
                                        <p className="text-2xs text-txt-ghost text-center pt-3">Свободно</p>
                                      ) : (
                                        slotAppts.map((a) => renderAppointmentBlock(a))
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
                  <EmptyState icon={<Stethoscope size={32} />} title="Нет кресел" description="Кресла появятся автоматически после первого открытия расписания" />
                )
              ) : doctorColumns.length > 0 ? (
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
          )}
        </>
      ) : activeTab === 'waiting' ? (
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
      ) : (
        /* Online bookings */
        <motion.div variants={fadeUp}>
          <Card padding="none">
            <div className="flex items-center justify-between px-4 py-3 border-b border-bdr-subtle">
              <div className="flex items-center gap-2">
                <Globe size={16} className="text-dv-gold" />
                <span className="text-sm font-semibold text-txt-primary">Онлайн-заявки</span>
                <Badge variant="gold" size="xs">{pendingBookings.length}</Badge>
              </div>
              {clinic?.id && (
                <Button size="sm" variant="outline" onClick={() => window.open(`/book/${clinic.id}`, '_blank')}>
                  Страница записи
                </Button>
              )}
            </div>
            {pendingBookings.length === 0 ? (
              <EmptyState
                icon={<Globe size={32} />}
                title="Нет новых заявок"
                description="Поделитесь ссылкой онлайн-записи с пациентами — заявки появятся здесь"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-bdr-subtle">
                      {['Пациент', 'Телефон', 'Дата', 'Время', 'Врач', 'Услуга', 'Действия'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-2xs font-semibold text-txt-muted uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pendingBookings.map((b) => (
                      <tr key={b.id} className="border-b border-bdr-subtle hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-2.5 font-medium text-txt-primary">{b.patientName || '—'}</td>
                        <td className="px-4 py-2.5 text-txt-secondary">{b.patientPhone || b.phone || '—'}</td>
                        <td className="px-4 py-2.5 text-txt-secondary">{b.date ? b.date.split('-').reverse().join('.') : '—'}</td>
                        <td className="px-4 py-2.5 text-txt-secondary">{b.time || '—'}</td>
                        <td className="px-4 py-2.5 text-dv-gold">{(b as any).doctorName || 'Любой'}</td>
                        <td className="px-4 py-2.5 text-txt-secondary">{b.serviceName || '—'}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1">
                            <Button size="icon-xs" variant="ghost" onClick={() => handleConfirmBooking(b)} title="Подтвердить">
                              <CheckCircle size={13} className="text-success" />
                            </Button>
                            <Button size="icon-xs" variant="ghost" onClick={() => handleRejectBooking(b.id)} title="Отклонить">
                              <XCircle size={13} className="text-error" />
                            </Button>
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
          <Select
            label="Кресло"
            value={form.chairId}
            onChange={e => setForm({ ...form, chairId: e.target.value })}
            options={[{ value: '', label: '— Без кресла —' }, ...chairs.map((c) => ({ value: c.id, label: c.name }))]}
          />
          <Select label="Услуга из прайса" value={form.service}
            onChange={e => { const svc = ALL_SERVICES.find(s => s.id === e.target.value); setForm({ ...form, service: e.target.value }); if (svc) { setForm(f => ({ ...f, serviceName: svc.name, servicePrice: svc.price })); } }}
            options={serviceOptions} required />

          <div className="grid grid-cols-3 gap-2">
            <Select label="Время" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} options={HOURS.map(h => ({ value: h, label: h }))} required />
            <Select label="Длительность" value={form.duration} onChange={e => setForm({ ...form, duration: Number(e.target.value) })} options={[{ value: 30, label: '30 мин' }, { value: 45, label: '45 мин' }, { value: 60, label: '1 час' }, { value: 90, label: '1.5 ч' }, { value: 120, label: '2 часа' }]} />
            <Select label="Статус" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} options={Object.entries(STATUS_CFG).map(([k, v]) => ({ value: k, label: v.label }))} />
          </div>

          {/* Diagnosis ICD-10 */}
          <div className="space-y-1">
            <label className="text-2xs font-semibold text-txt-muted uppercase">Диагноз (МКБ-10)</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
              <input
                placeholder="Введите код или название диагноза..."
                value={form.diagnosis}
                onChange={e => setForm({ ...form, diagnosis: e.target.value })}
                className="pl-9"
                list="icd10-suggestions"
              />
              <datalist id="icd10-suggestions">
                {DENTAL_ICD10.filter(d =>
                  d.code.toLowerCase().includes(form.diagnosis.toLowerCase()) ||
                  d.name.toLowerCase().includes(form.diagnosis.toLowerCase())
                ).map(d => (
                  <option key={d.code} value={`${d.code} — ${d.name}`} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Tooth Number */}
          <div className="space-y-1">
            <label className="text-2xs font-semibold text-txt-muted uppercase">Зуб (номер по FDI)</label>
            <select
              value={form.toothNumber}
              onChange={e => setForm({ ...form, toothNumber: e.target.value })}
            >
              <option value="">— Выберите зуб —</option>
              <optgroup label="Верхняя челюсть (правая)">
                {[18,17,16,15,14,13,12,11].map(n => (
                  <option key={n} value={n}>{n} — {TOOTH_NAMES[n]}</option>
                ))}
              </optgroup>
              <optgroup label="Верхняя челюсть (левая)">
                {[21,22,23,24,25,26,27,28].map(n => (
                  <option key={n} value={n}>{n} — {TOOTH_NAMES[n]}</option>
                ))}
              </optgroup>
              <optgroup label="Нижняя челюсть (левая)">
                {[31,32,33,34,35,36,37,38].map(n => (
                  <option key={n} value={n}>{n} — {TOOTH_NAMES[n]}</option>
                ))}
              </optgroup>
              <optgroup label="Нижняя челюсть (правая)">
                {[41,42,43,44,45,46,47,48].map(n => (
                  <option key={n} value={n}>{n} — {TOOTH_NAMES[n]}</option>
                ))}
              </optgroup>
            </select>
          </div>

          <Input label="Заметки" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Дополнительная информация" />

          <div className="flex gap-2 pt-2 flex-wrap">
            <Button type="submit" className="flex-1">{editAppt ? 'Сохранить' : 'Сохранить'}</Button>
            {editAppt && !['done', 'completed', 'cancelled'].includes(editAppt.status) && (
              <Button type="button" variant="secondary" icon={<ClipboardCheck size={14} />} onClick={() => openCloseVisit(editAppt)}>
                Закрыть приём
              </Button>
            )}
            {editAppt && <Button type="button" variant="danger" onClick={handleDelete} icon={<Trash2 size={14} />} />}
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Отмена</Button>
          </div>
        </form>
      </Modal>

      <Modal open={closeOpen} onClose={() => setCloseOpen(false)} title="Закрыть приём" size="lg">
        {closeAppt && (
          <div className="space-y-4">
            <p className="text-sm text-txt-secondary">
              Укажите выполненные услуги и заметки — как в KazDent. При включённом авто-списании материалы уйдут со склада.
            </p>
            <Input
              label="Заметки врача"
              value={closeNotes}
              onChange={(e) => setCloseNotes(e.target.value)}
              placeholder="Лечение, рекомендации, швы…"
            />
            <div className="space-y-2">
              <p className="text-xs font-semibold text-txt-muted uppercase tracking-wider">Услуги</p>
              {closeServices.map((s, idx) => (
                <div key={idx} className="flex gap-2 items-end">
                  <Input
                    label="Услуга"
                    value={s.name}
                    onChange={(e) => {
                      const next = [...closeServices]
                      next[idx] = { ...next[idx], name: e.target.value }
                      setCloseServices(next)
                    }}
                    className="flex-1"
                  />
                  <Input
                    label="Цена"
                    type="number"
                    value={s.price || ''}
                    onChange={(e) => {
                      const next = [...closeServices]
                      next[idx] = { ...next[idx], price: Number(e.target.value) }
                      setCloseServices(next)
                    }}
                    className="w-28"
                  />
                  <Button variant="ghost" size="icon-sm" icon={<Trash2 size={14} />} onClick={() => setCloseServices(closeServices.filter((_, i) => i !== idx))} />
                </div>
              ))}
              <div className="flex gap-2 flex-wrap">
                <Select
                  label="Из прайса"
                  value=""
                  onChange={(e) => {
                    const opt = priceOptions.find((p) => p.name === e.target.value)
                    if (!opt) return
                    setCloseServices([...closeServices, { ...opt }])
                  }}
                  options={[{ value: '', label: '— добавить услугу —' }, ...priceOptions.map((p) => ({ value: p.name, label: `${p.name} · ${p.price}` }))]}
                />
                <Button
                  variant="secondary"
                  className="self-end"
                  onClick={() => setCloseServices([...closeServices, { name: '', price: 0, matCost: 0 }])}
                >
                  Своя строка
                </Button>
              </div>
              <p className="text-sm font-semibold text-dv-gold">
                Итого: {closeServices.reduce((s, x) => s + Number(x.price || 0), 0).toLocaleString('ru-RU')} ₸
              </p>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" disabled={closeSaving} onClick={handleCloseVisit}>
                {closeSaving ? 'Сохранение…' : 'Завершить приём'}
              </Button>
              <Button variant="ghost" onClick={() => setCloseOpen(false)}>Отмена</Button>
            </div>
          </div>
        )}
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
