import React, { useState, useMemo, useEffect } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  CreditCard, TrendingUp, TrendingDown, Wallet, AlertTriangle, Plus,
  DollarSign, Package, Receipt, Send, ShoppingCart, CheckCircle, Clock,
  User, Stethoscope, Search, Trash2,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/ds/Toast'
import { useDataQuery } from '../../queries/useDataQuery'
import { queryKeys } from '../../queries/keys'
import * as api from '@/utils/api'
import { Button } from '../../components/ui/ds/Button'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/ds/Card'
import { Input, Select } from '../../components/ui/ds/Input'
import { Badge, StatusBadge } from '../../components/ui/ds/Badge'
import { Modal } from '../../components/ui/ds/Modal'
import { EmptyState } from '../../components/ui/ds/EmptyState'
import { StatCard, PageHeader } from '../../components/ui/ds/StatCard'
import { Tabs } from '../../components/ui/ds/Misc'
import { Switch } from '../../components/ui/ds/Misc'
import { tg, fd, gid, today, PAY_METHODS, ALL_SERVICES, getClinicCurrency, TOOTH_NAMES } from '../../utils/constants'
import { buildWaLink } from '../../utils/reminders'
import { cn, formatMoney } from '../../lib/utils'
import type { Receipt, Appointment, Patient, Expense, InventoryItem, Clinic, User as UserType, RoleInfo } from '../../types'

const TABS = [
  { id: 'unpaid', label: 'К оплате', icon: <Clock size={14} /> },
  { id: 'transactions', label: 'Операции', icon: <CreditCard size={14} /> },
  { id: 'receivables', label: 'Долги', icon: <AlertTriangle size={14} /> },
  { id: 'reports', label: 'Отчёты', icon: <TrendingUp size={14} /> },
  { id: 'payroll', label: 'Зарплата', icon: <Wallet size={14} /> },
  { id: 'inventory', label: 'Склад', icon: <Package size={14} /> },
  { id: 'expenses', label: 'Расходы', icon: <Receipt size={14} /> },
]

const EMPTY_FORM = {
  type: 'income', amount: '', patientId: '', patientName: '', service: '',
  paymentMethod: 'Kaspi QR', paymentType: 'full', notes: '',
}

const PAY_TYPES = [
  { value: 'full', label: 'Полная оплата' },
  { value: 'prepayment', label: 'Предоплата' },
  { value: 'installment', label: 'Рассрочка' },
  { value: 'kaspi_installment', label: 'Kaspi Рассрочка' },
  { value: 'credit', label: 'Долг' },
]

const EXPENSE_CATEGORIES = [
  { value: 'Аренда', label: 'Аренда' },
  { value: 'Коммунальные', label: 'Коммунальные услуги' },
  { value: 'Материалы', label: 'Закупка материалов' },
  { value: 'Маркетинг', label: 'Маркетинг' },
  { value: 'Зарплата', label: 'Зарплата' },
  { value: 'Прочее', label: 'Прочее' },
]

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }

interface OutletContext {
  clinic: Clinic
  user: UserType
  roleInfo?: RoleInfo
}

interface CashierForm {
  type: string
  amount: string
  patientId: string
  patientName: string
  service: string
  paymentMethod: string
  paymentType: string
  notes: string
  appointmentId?: string
  diagnosis?: string
  toothNumber?: string | number
}

interface ExpenseForm {
  category: string
  amount: string
  notes: string
}

export default function Cashier() {
  const { clinic } = useOutletContext<OutletContext>()
  const { receipts, patients, doctors, appointments, upsertReceipt, upsertAppointment, expenses, upsertExpense, inventory } = useDataQuery(clinic?.id)
  const queryClient = useQueryClient()
  const { toast, showToast, clearToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const voidReceipt = async (id: string) => {
    if (!window.confirm('Удалить эту операцию из кассы?')) return
    try {
      await api.deleteReceipt(id)
      await queryClient.invalidateQueries({ queryKey: queryKeys.receipts })
      showToast('Операция удалена', 'success')
    } catch (err: any) {
      showToast(err?.message || 'Не удалось удалить', 'error')
    }
  }
  const [activeTab, setActiveTab] = useState('unpaid')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<CashierForm>(EMPTY_FORM)
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>({ category: '', amount: '', notes: '' })
  const [expModalOpen, setExpModalOpen] = useState(false)
  const [cashSettings, setCashSettings] = useState({ defaultMethod: 'Kaspi QR', autoReceipt: true, reminders: true })
  const [searchUnpaid, setSearchUnpaid] = useState('')
  const [financeReport, setFinanceReport] = useState<any>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const money = (value: number) => tg(value, clinic)
  const { currency } = getClinicCurrency(clinic)

  useEffect(() => {
    if (activeTab !== 'reports' || !clinic?.id) return
    let cancelled = false
    ;(async () => {
      setReportLoading(true)
      try {
        const monthStart = `${today().slice(0, 7)}-01`
        const data = await api.getFinanceReport({ from: monthStart, to: today() })
        if (!cancelled) setFinanceReport(data)
      } catch {
        if (!cancelled) setFinanceReport(null)
      } finally {
        if (!cancelled) setReportLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [activeTab, clinic?.id])

  useEffect(() => {
    const patientId = searchParams.get('patient')
    if (!patientId || !patients.length) return
    const patient = patients.find((p) => p.id === patientId)
    if (!patient) return
    const planId = searchParams.get('plan')
    const stageId = searchParams.get('stage')
    const noteParts = [
      planId ? `План лечения: ${planId}` : '',
      stageId ? `этап ${stageId}` : '',
    ].filter(Boolean)
    setForm((f) => ({
      ...f,
      type: 'income',
      patientId,
      patientName: patient.name,
      notes: noteParts.join(' · ') || f.notes,
    }))
    setActiveTab('transactions')
    setModalOpen(true)
    setSearchParams({}, { replace: true })
  }, [searchParams, patients, setSearchParams])

  const todayKey = today()
  const todayReceipts = receipts.filter((r) => (r.date || todayKey) === todayKey && (r.status === 'paid' || r.status === 'completed'))
  const todayExpenses = expenses.filter((e) => (e.date || todayKey) === todayKey)
  const currentMonthReceipts = receipts.filter((r) => (r.date || '').slice(0, 7) === todayKey.slice(0, 7))
  const totalIncome = currentMonthReceipts.reduce((s, r) => s + (r.total || Number(r.amount) || 0), 0)
  const debts = receipts.filter((r) => r.paymentType === 'credit' || r.status === 'debt')
  const debtBalance = debts.reduce((s, r) => s + (r.total || Number(r.amount) || 0), 0)
  const todayRevenue = todayReceipts.reduce((s, r) => s + (r.total || Number(r.amount) || 0), 0)
  const todayExpenseAmount = todayExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)

  const unpaidAppointments = useMemo(() => {
    let list = appointments.filter(a => a.paymentStatus !== 'paid' && a.status !== 'cancelled')
    if (searchUnpaid) {
      const q = searchUnpaid.toLowerCase()
      list = list.filter(a => {
        const p = patients.find(pt => pt.id === a.patientId)
        return p?.name?.toLowerCase().includes(q) || a.serviceName?.toLowerCase().includes(q) || a.diagnosis?.toLowerCase().includes(q)
      })
    }
    return list
  }, [appointments, patients, searchUnpaid])

  const unpaidCount = unpaidAppointments.length

  const openPaymentModal = (appt: Appointment) => {
    const patient = patients.find(p => p.id === appt.patientId)
    setForm({
      ...EMPTY_FORM,
      patientId: appt.patientId || '',
      patientName: patient?.name || '',
      service: appt.serviceName || '',
      amount: appt.servicePrice || '',
      paymentMethod: cashSettings.defaultMethod,
      appointmentId: appt.id,
      diagnosis: appt.diagnosis || '',
      toothNumber: appt.toothNumber || '',
    })
    setModalOpen(true)
  }

  const handleNewTransaction = () => { setForm({ ...EMPTY_FORM, paymentMethod: cashSettings.defaultMethod }); setModalOpen(true) }

  const handleQuickPayment = (service: { name: string; price: number }) => {
    setForm({ ...EMPTY_FORM, service: service.name, amount: service.price, paymentMethod: cashSettings.defaultMethod })
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form.amount || isNaN(Number(form.amount))) {
      showToast('Введите корректную сумму', 'warning')
      return
    }
    try {
      const status = form.paymentType === 'credit'
        ? 'debt'
        : form.paymentType === 'prepayment' || form.paymentType === 'installment' || form.paymentType === 'kaspi_installment'
          ? 'partial'
          : 'paid'

      await upsertReceipt({
        id: gid(),
        clinicId: clinic?.id,
        date: today(),
        status,
        total: Number(form.amount),
        payMethod: form.paymentMethod,
        paymentType: form.paymentType,
        notes: form.notes,
        patientId: form.patientId || undefined,
        patientName: form.patientName || patients.find((p) => p.id === form.patientId)?.name || '',
        service: form.service,
        appointmentId: form.appointmentId || undefined,
        diagnosis: form.diagnosis || '',
        toothNumber: form.toothNumber || '',
        items: form.service ? [{ name: form.service, price: Number(form.amount), qty: 1 }] : [],
      })

      if (form.appointmentId && status === 'paid') {
        await upsertAppointment({ id: form.appointmentId, paymentStatus: 'paid' })
      }

      showToast('Оплата принята', 'success')
      setModalOpen(false)
    } catch {
      showToast('Ошибка сохранения', 'error')
    }
  }

  const handleExpenseSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    await upsertExpense({ ...expenseForm, amount: Number(expenseForm.amount), date: today() } as any)
    showToast('Расход добавлен', 'success')
    setExpModalOpen(false)
    setExpenseForm({ category: '', amount: '', notes: '' })
  }

  const quickPresets = [
    { name: 'Профгигиена', price: 45000 },
    { name: 'Лечение кариеса', price: 120000 },
    { name: 'Имплантация', price: 650000 },
  ]

  const payrollRows = (financeReport?.payroll || []).length
    ? (financeReport.payroll as any[]).map((row) => ({
        name: row.name,
        role: `${row.role || 'DOCTOR'} · ${row.percent || 30}%`,
        salary: Number(row.earned || 0),
        paid: 0,
        visits: row.visits,
        gross: row.gross,
        matCost: row.matCost,
        net: row.net,
        percent: row.percent,
      }))
    : doctors
      .filter((doctor: any) => Number(doctor.salary || 0) > 0 || Number(doctor.commissionPercent || 0) > 0)
      .map((doctor: any) => ({
        name: doctor.name,
        role: doctor.spec || `Врач · ${doctor.commissionPercent ?? 30}%`,
        salary: Number(doctor.salary || 0),
        paid: Number(doctor.paid || 0),
      }))

  const debtRows = debts.map((debt) => {
    const patient = patients.find((p) => p.id === debt.patientId)
    return {
      patientId: debt.patientId,
      patient: debt.patientName || patient?.name || 'Пациент не указан',
      phone: patient?.phone || '',
      amount: debt.total || Number(debt.amount) || 0,
      date: debt.date,
    }
  })

  return (
    <div className="p-6">
      <PageHeader
        title="Касса"
        subtitle="Оплата из расписания, операции, расходы"
        icon={<DollarSign size={20} />}
        actions={
          <>
            <Button variant="secondary" icon={<Plus size={16} />} onClick={() => setExpModalOpen(true)}>
              Расход
            </Button>
            <Button icon={<Plus size={16} />} onClick={handleNewTransaction}>
              Оплата
            </Button>
          </>
        }
      />

      {/* Quick payment bar */}
      <Card padding="md" className="mb-5">
        <p className="text-sm font-bold text-txt-primary mb-3">Быстрый приём оплаты</p>
        <div className="flex flex-wrap gap-2">
          {quickPresets.map((preset) => (
            <Button
              key={preset.name}
              variant="outline"
              size="sm"
              icon={<CreditCard size={14} />}
              onClick={() => handleQuickPayment(preset)}
            >
              {preset.name} · {money(preset.price)}
            </Button>
          ))}
        </div>
      </Card>

      {/* KPIs */}
      <motion.div
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={fadeUp}>
          <StatCard label="Доход сегодня" value={money(todayRevenue)} icon={<TrendingUp size={18} />} />
        </motion.div>
        <motion.div variants={fadeUp}>
          <StatCard label="Расход сегодня" value={money(todayExpenseAmount)} icon={<TrendingDown size={18} />} />
        </motion.div>
        <motion.div variants={fadeUp}>
          <StatCard label="Доход за месяц" value={money(totalIncome)} icon={<DollarSign size={18} />} />
        </motion.div>
        <motion.div variants={fadeUp}>
          <StatCard label="К оплате" value={String(unpaidCount)} icon={<Clock size={18} />} className={unpaidCount > 0 ? 'ring-1 ring-warning/30' : ''} />
        </motion.div>
      </motion.div>

      {/* Settings */}
      <Card padding="md" className="mb-5">
        <p className="text-sm font-bold text-txt-primary mb-3">Настройки кассы</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg border border-bdr-subtle bg-white/[0.02]">
            <p className="text-xs text-txt-secondary mb-2">Способ оплаты по умолчанию</p>
            <Select
              value={cashSettings.defaultMethod}
              onChange={(e) => setCashSettings({ ...cashSettings, defaultMethod: e.target.value })}
              options={PAY_METHODS.map((m) => ({ value: m, label: m }))}
            />
          </div>
          <div className="p-3 rounded-lg border border-bdr-subtle bg-white/[0.02] space-y-3">
            <Switch
              checked={cashSettings.autoReceipt}
              onCheckedChange={(v) => setCashSettings({ ...cashSettings, autoReceipt: v })}
              label="Авто-чеки"
            />
            <Switch
              checked={cashSettings.reminders}
              onCheckedChange={(v) => setCashSettings({ ...cashSettings, reminders: v })}
              label="Напоминания по долгам"
            />
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} className="mb-5" />

      {/* Content */}
      <Card padding="none">
        <div className="p-5">
          {activeTab === 'unpaid' && (
            <div>
              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <p className="text-sm font-bold text-txt-primary">
                  Записи из расписания к оплате
                  {unpaidCount > 0 && <Badge variant="warning" size="sm" className="ml-2">{unpaidCount}</Badge>}
                </p>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
                  <input
                    placeholder="Поиск..."
                    value={searchUnpaid}
                    onChange={e => setSearchUnpaid(e.target.value)}
                    className="pl-9 !h-8 !text-xs !w-48"
                  />
                </div>
              </div>
              {unpaidAppointments.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle size={32} />}
                  title="Все оплачено"
                  description="Нет неоплаченных записей из расписания"
                />
              ) : (
                <div className="space-y-2.5">
                  {unpaidAppointments.map((appt) => {
                    const patient = patients.find(p => p.id === appt.patientId)
                    const doctor = doctors.find(d => d.id === appt.doctorId)
                    const toothLabel = appt.toothNumber ? `Зуб ${appt.toothNumber}` : ''
                    return (
                      <motion.div
                        key={appt.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-between p-4 rounded-xl border border-warning/20 bg-warning/5 hover:bg-warning/8 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <User size={14} className="text-txt-muted flex-shrink-0" />
                            <span className="text-sm font-semibold text-txt-primary truncate">{patient?.name || 'Пациент'}</span>
                            <Badge variant="warning" size="xs">Не оплачено</Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-txt-secondary">
                            {appt.serviceName && (
                              <span className="flex items-center gap-1">
                                <Stethoscope size={12} className="text-txt-muted" />
                                {appt.serviceName}
                              </span>
                            )}
                            {doctor && <span className="text-txt-muted">{doctor.name}</span>}
                            <span className="text-txt-muted">{appt.date} · {appt.time}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {appt.diagnosis && (
                              <span className="text-2xs text-dv-gold font-medium">{appt.diagnosis?.split(' — ')[0]}</span>
                            )}
                            {toothLabel && (
                              <span className="text-2xs text-emerald-400 font-medium">{toothLabel}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                          <span className="text-lg font-bold text-warning">{money(appt.servicePrice || 0)}</span>
                          <Button
                            size="sm"
                            icon={<CreditCard size={14} />}
                            onClick={() => openPaymentModal(appt)}
                          >
                            Оплата
                          </Button>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'transactions' && (
            <div>
              <p className="text-sm font-bold text-txt-primary mb-4">Последние операции</p>
              {receipts.length === 0 ? (
                <EmptyState
                  icon={<CreditCard size={32} />}
                  title="Нет операций"
                  description="Нажмите «+ Оплата» чтобы добавить"
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-bdr-subtle">
                        {['Дата', 'Пациент', 'Услуга', 'Зуб', 'Диагноз', 'Способ', 'Статус', 'Сумма', ''].map(h => (
                          <th key={h || 'actions'} className="text-left py-2 px-3 text-2xs font-bold text-txt-muted uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {receipts.slice().reverse().map((r) => {
                        const statusVariant = r.status === 'debt' ? 'error' : r.status === 'partial' ? 'warning' : 'success'
                        const statusLabel = r.status === 'debt' ? 'Долг' : r.status === 'partial' ? 'Частично' : 'Оплачено'
                        const toothLabel = r.toothNumber ? `Зуб ${r.toothNumber}` : '—'
                        const diagShort = r.diagnosis ? r.diagnosis.split(' — ')[0] : '—'
                        return (
                          <tr key={r.id} className="border-b border-bdr-subtle last:border-b-0">
                            <td className="py-2.5 px-3 text-xs text-txt-secondary">{fd(r.date)}</td>
                            <td className="py-2.5 px-3 text-sm font-semibold text-txt-primary">{r.patientName || patients.find(p => p.id === r.patientId)?.name || '---'}</td>
                            <td className="py-2.5 px-3 text-xs text-txt-secondary">{r.service || (r.items?.[0]?.name) || '---'}</td>
                            <td className="py-2.5 px-3 text-xs text-emerald-400">{toothLabel}</td>
                            <td className="py-2.5 px-3 text-xs text-dv-gold">{diagShort}</td>
                            <td className="py-2.5 px-3"><Badge variant="info" size="sm">{r.payMethod || '---'}</Badge></td>
                            <td className="py-2.5 px-3"><Badge variant={statusVariant} size="sm">{statusLabel}</Badge></td>
                            <td className={cn('py-2.5 px-3 text-right text-sm font-bold', statusVariant === 'success' ? 'text-success' : statusVariant === 'error' ? 'text-error' : 'text-warning')}>
                              +{money(r.total || r.amount || 0)}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                icon={<Trash2 size={14} />}
                                className="text-error/60 hover:text-error"
                                onClick={() => voidReceipt(r.id)}
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'receivables' && (
            <div>
              <p className="text-sm font-bold text-txt-primary mb-4">Долги пациентов</p>
              {debtRows.length === 0 && (
                <EmptyState
                  icon={<AlertTriangle size={32} />}
                  title="Нет долгов"
                  description="Долги появятся только из операций этой клиники"
                />
              )}
              <div className="space-y-2.5">
                {debtRows.map((d, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-error/20 bg-error/5">
                    <div>
                      <p className="text-sm font-semibold text-txt-primary">{d.patient}</p>
                      <p className="text-xs text-txt-muted mt-0.5">от {fd(d.date)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-error">{money(d.amount)}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Send size={14} />}
                        onClick={() => {
                          if (!d.phone) {
                            showToast('У пациента нет телефона', 'warning')
                            return
                          }
                          const msg = `Здравствуйте, ${d.patient}!\n\nНапоминаем о задолженности ${Math.round(d.amount).toLocaleString('ru-RU')} ₸ в клинике ${clinic?.name || ''}.\nОплатить можно в кассе или онлайн. Ответьте, если нужна помощь.`
                          window.open(buildWaLink(d.phone, msg), '_blank', 'noopener,noreferrer')
                          showToast('WhatsApp-напоминание о долге открыто', 'success')
                        }}
                      >
                        Напомнить
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-4">
              <p className="text-sm font-bold text-txt-primary">Отчёт за текущий месяц</p>
              {reportLoading ? (
                <div className="flex justify-center py-10">
                  <div className="w-8 h-8 rounded-full border-2 border-dv-gold/30 border-t-dv-gold animate-spin" />
                </div>
              ) : !financeReport ? (
                <EmptyState icon={<TrendingUp size={32} />} title="Нет данных" description="Оплатите счета — отчёт появится автоматически" />
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard label="Выручка" value={money(financeReport.totals?.revenue || 0)} icon={<DollarSign size={16} />} />
                    <StatCard label="Оплат" value={String(financeReport.totals?.paidCount || 0)} icon={<CheckCircle size={16} />} />
                    <StatCard label="Долг" value={money(financeReport.totals?.unpaid || 0)} icon={<AlertTriangle size={16} />} />
                    <StatCard label="Неоплаченных" value={String(financeReport.totals?.unpaidCount || 0)} icon={<Clock size={16} />} />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader><CardTitle>По дням</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        {(financeReport.byDay || []).slice(-14).map((d: any) => (
                          <div key={d.date} className="flex justify-between text-sm">
                            <span className="text-txt-muted">{d.date}</span>
                            <span className="font-semibold text-txt-primary">{money(d.revenue)} · {d.count}</span>
                          </div>
                        ))}
                        {(financeReport.byDay || []).length === 0 && <p className="text-xs text-txt-muted">Пока пусто</p>}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader><CardTitle>По услугам</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        {(financeReport.byService || []).slice(0, 12).map((s: any) => (
                          <div key={s.name} className="flex justify-between text-sm gap-2">
                            <span className="text-txt-muted truncate">{s.name}</span>
                            <span className="font-semibold text-txt-primary whitespace-nowrap">{money(s.revenue)}</span>
                          </div>
                        ))}
                        {(financeReport.byService || []).length === 0 && <p className="text-xs text-txt-muted">Пока пусто</p>}
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'payroll' && (
            <div>
              <p className="text-sm font-bold text-txt-primary mb-4">Зарплата по % (как в KazDent)</p>
              <p className="text-xs text-txt-muted mb-4">
                Начисление = (сумма услуг − себестоимость материалов) × % врача за выбранный период отчёта.
              </p>
              {payrollRows.length === 0 && (
                <EmptyState
                  icon={<Wallet size={32} />}
                  title="Нет начислений"
                  description="Закройте приёмы с услугами и укажите % сотрудникам"
                />
              )}
              <div className="space-y-3">
                {payrollRows.map((emp: any, i) => {
                  const pct = emp.salary > 0 && emp.paid != null && emp.paid > 0
                    ? Math.round((emp.paid / emp.salary) * 100)
                    : emp.percent || 0
                  return (
                    <div key={i} className="p-4 rounded-xl border border-bdr-subtle bg-white/[0.02]">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-sm font-semibold text-txt-primary">{emp.name}</p>
                          <p className="text-xs text-txt-muted">{emp.role}</p>
                          {emp.visits != null && (
                            <p className="text-2xs text-txt-muted mt-1">
                              Приёмов: {emp.visits} · Валово: {money(emp.gross || 0)} · Материалы: {money(emp.matCost || 0)}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-dv-gold">{money(emp.salary)}</p>
                          <p className="text-2xs text-txt-muted">к выплате</p>
                        </div>
                      </div>
                      {pct > 0 && emp.paid > 0 && (
                        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full bg-dv-gold/60" style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {activeTab === 'inventory' && (
            <div>
              <p className="text-sm font-bold text-txt-primary mb-4">Склад материалов</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {inventory.map((item, i) => {
                  const isLow = item.quantity <= item.min
                  return (
                    <div key={item.id || i} className={cn(
                      'p-4 rounded-xl border transition-colors',
                      isLow ? 'border-error/30 bg-error/5' : 'border-bdr-subtle bg-white/[0.02]'
                    )}>
                      <p className="text-sm font-semibold text-txt-primary mb-2">{item.name}</p>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={cn('text-lg font-bold', isLow ? 'text-error' : 'text-txt-primary')}>
                          {item.quantity} {item.unit}
                        </span>
                        <Badge variant={isLow ? 'error' : 'success'} size="sm">
                          {isLow ? 'Заканчивается' : 'В норме'}
                        </Badge>
                      </div>
                      <p className="text-xs text-txt-muted mb-2">Минимум: {item.min} {item.unit}</p>
                      {isLow && (
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<ShoppingCart size={14} />}
                          onClick={() => showToast(`Заявка на ${item.name} отправлена`, 'success')}
                        >
                          Заказать
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {activeTab === 'expenses' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-txt-primary">Расходы клиники</p>
                <Button variant="danger" size="sm" icon={<Plus size={14} />} onClick={() => setExpModalOpen(true)}>
                  Расход
                </Button>
              </div>
              {expenses.length === 0 && (
                <EmptyState
                  icon={<Receipt size={32} />}
                  title="Нет расходов"
                  description="Добавьте расход для текущей клиники"
                />
              )}
              <div className="space-y-2">
                {expenses.map((exp, i) => (
                  <div key={i} className="flex items-center justify-between p-3.5 rounded-xl border border-bdr-subtle bg-white/[0.02]">
                    <div>
                      <p className="text-sm font-semibold text-txt-primary">{exp.category}</p>
                      <p className="text-xs text-txt-muted">{fd(exp.date)}</p>
                    </div>
                    <span className="text-lg font-bold text-error">-{money(exp.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Payment modal (from schedule or manual) */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.appointmentId ? 'Оплата из расписания' : 'Новая оплата'}
        size="lg"
        className="max-md:!w-[calc(100vw-1rem)] max-md:!max-h-[calc(100vh-2rem)] max-md:!m-2"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {form.appointmentId && (
            <div className="p-3 rounded-xl bg-warning/5 border border-warning/20 space-y-2">
              <p className="text-xs font-semibold text-warning">Оплата из расписания</p>
              {form.diagnosis && <p className="text-xs text-txt-secondary">Диагноз: <span className="text-txt-primary font-medium">{form.diagnosis}</span></p>}
              {form.toothNumber && <p className="text-xs text-txt-secondary">Зуб: <span className="text-emerald-400 font-medium">{form.toothNumber} — {TOOTH_NAMES[form.toothNumber as number]}</span></p>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Пациент"
              value={form.patientId}
              onChange={(e) => {
                const selectedPatient = patients.find((p) => p.id === e.target.value)
                setForm({ ...form, patientId: e.target.value, patientName: selectedPatient?.name || '' })
              }}
              options={[
                { value: '', label: '--- Выберите пациента ---' },
                ...patients.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
            <Input
              label={`Сумма (${currency})`}
              type="number"
              value={form.amount}
              onChange={e => setForm({ ...form, amount: e.target.value })}
              required
            />
          </div>
          <Input
            label="Пациент (ФИО)"
            value={form.patientName}
            onChange={e => setForm({ ...form, patientName: e.target.value })}
            placeholder="Иванов Иван Иванович"
          />
          <Input
            label="Услуга"
            value={form.service}
            onChange={e => setForm({ ...form, service: e.target.value })}
            placeholder="Название услуги"
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Способ оплаты"
              value={form.paymentMethod}
              onChange={e => setForm({ ...form, paymentMethod: e.target.value })}
              options={PAY_METHODS.map(m => ({ value: m, label: m }))}
            />
            <Select
              label="Тип платежа"
              value={form.paymentType}
              onChange={e => setForm({ ...form, paymentType: e.target.value })}
              options={PAY_TYPES}
            />
          </div>
          <Input
            label="Комментарий"
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
          />
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" icon={<CreditCard size={16} />}>
              Принять оплату {form.amount ? money(Number(form.amount)) : ''}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Отмена</Button>
          </div>
        </form>
      </Modal>

      {/* Expense modal */}
      <Modal
        open={expModalOpen}
        onClose={() => setExpModalOpen(false)}
        title="Новый расход"
      >
        <form onSubmit={handleExpenseSubmit} className="space-y-4">
          <Select
            label="Категория"
            value={expenseForm.category}
            onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}
            options={EXPENSE_CATEGORIES}
            required
          />
          <Input
            label={`Сумма (${currency})`}
            type="number"
            value={expenseForm.amount}
            onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
            required
          />
          <Input
            label="Комментарий"
            value={expenseForm.notes}
            onChange={e => setExpenseForm({ ...expenseForm, notes: e.target.value })}
          />
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1">Добавить</Button>
            <Button type="button" variant="ghost" onClick={() => setExpModalOpen(false)}>Отмена</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
