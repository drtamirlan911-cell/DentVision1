import React, { useState, useMemo, useEffect } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  CreditCard, TrendingUp, TrendingDown, Wallet, AlertTriangle, Plus,
  DollarSign, Send, CheckCircle, Clock,
  User, Stethoscope, Search, Trash2, Settings2, ExternalLink, Download,
  Receipt as ReceiptIcon,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/ds/Toast'
import { useAuth } from '@/store/auth.store'
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
import { PaymentQrPanel } from '@/components/payments/PaymentQrPanel'
import { FinancePeriodBar } from '@/components/crm/finance/FinancePeriodBar'
import { FinancePnLStrip } from '@/components/crm/finance/FinancePnLStrip'
import { FinancePayrollPanel } from '@/components/crm/finance/FinancePayrollPanel'
import { FinanceExpensesPanel } from '@/components/crm/finance/FinanceExpensesPanel'
import { buildPeriod, EXPENSE_CATEGORIES, downloadCsv, type FinancePeriod } from '@/lib/financePeriod'
import { tg, fd, gid, today, PAY_METHODS, ALL_SERVICES, getClinicCurrency, TOOTH_NAMES } from '../../utils/constants'
import { buildWaLink } from '../../utils/reminders'
import { cn, formatMoney } from '../../lib/utils'
import { isOnlineQrMethod } from '@/utils/payMethod'
import { extractPaymentQrUrl } from '@/utils/paymentQr'
import { useNavigate } from 'react-router-dom'
// type imports
import type { Receipt, Appointment, Patient, Expense, Clinic, User as UserType, RoleInfo } from '../../types'

const TABS = [
  { id: 'unpaid', label: 'К оплате', icon: <Clock size={14} /> },
  { id: 'transactions', label: 'Операции', icon: <CreditCard size={14} /> },
  { id: 'receivables', label: 'Долги', icon: <AlertTriangle size={14} /> },
  { id: 'reports', label: 'Отчёты', icon: <TrendingUp size={14} /> },
  { id: 'payroll', label: 'Зарплата', icon: <Wallet size={14} /> },
  { id: 'expenses', label: 'Расходы', icon: <ReceiptIcon size={14} /> },
]

const EMPTY_FORM = {
  type: 'income', amount: '', patientId: '', patientName: '', service: '',
  paymentMethod: 'QR-оплата', paymentType: 'full', notes: '',
}

const PAY_TYPES = [
  { value: 'full', label: 'Полная оплата' },
  { value: 'prepayment', label: 'Предоплата' },
  { value: 'installment', label: 'Рассрочка' },
  { value: 'credit', label: 'Долг' },
]

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
  date: string
}

export default function Cashier() {
  const navigate = useNavigate()
  const outlet = useOutletContext<OutletContext>() || ({} as OutletContext)
  const { user, clinic: authClinic } = useAuth()
  const clinicId = outlet.clinic?.id || authClinic?.id || user?.clinicId || ''
  const clinic = (outlet.clinic?.id ? outlet.clinic : authClinic) || ({ id: clinicId } as Clinic)
  const { receipts, patients, doctors, appointments, upsertReceipt, upsertAppointment, expenses, upsertExpense } = useDataQuery(clinicId || undefined)
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
  const tabFromUrl = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(
    TABS.some((t) => t.id === tabFromUrl) ? String(tabFromUrl) : 'unpaid',
  )
  const [modalOpen, setModalOpen] = useState(false)
  const [pendingPay, setPendingPay] = useState<any>(null)
  const [payBusy, setPayBusy] = useState(false)
  const [form, setForm] = useState<CashierForm>(EMPTY_FORM)
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>({
    category: 'Прочее',
    amount: '',
    notes: '',
    date: today(),
  })
  const [expModalOpen, setExpModalOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [cashSettings, setCashSettings] = useState({ defaultMethod: 'QR-оплата', autoReceipt: true, reminders: true })
  const [searchUnpaid, setSearchUnpaid] = useState('')
  const [financeReport, setFinanceReport] = useState<any>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [period, setPeriod] = useState<FinancePeriod>(() => buildPeriod('month'))
  const money = (value: number) => tg(value, clinic)
  const { currency } = getClinicCurrency(clinic)

  const setTab = (id: string) => {
    setActiveTab(id)
    const next = new URLSearchParams(searchParams)
    next.set('tab', id)
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    if (!clinic?.id) return
    let cancelled = false
    ;(async () => {
      setReportLoading(true)
      try {
        const data = await api.getFinanceReport({ from: period.from, to: period.to })
        if (!cancelled) setFinanceReport(data)
      } catch {
        if (!cancelled) setFinanceReport(null)
      } finally {
        if (!cancelled) setReportLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [clinic?.id, period.from, period.to])

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
    setPendingPay(null)
    setForm({
      ...EMPTY_FORM,
      patientId: appt.patientId || '',
      patientName: patient?.name || '',
      service: appt.serviceName || '',
      amount: appt.servicePrice != null ? String(appt.servicePrice) : '',
      paymentMethod: cashSettings.defaultMethod,
      appointmentId: appt.id,
      diagnosis: appt.diagnosis || '',
      toothNumber: appt.toothNumber || '',
    })
    setModalOpen(true)
  }

  const handleNewTransaction = () => {
    setPendingPay(null)
    setForm({ ...EMPTY_FORM, paymentMethod: cashSettings.defaultMethod })
    setModalOpen(true)
  }

  const handleQuickPayment = (service: { name: string; price: number }) => {
    setPendingPay(null)
    setForm({ ...EMPTY_FORM, service: service.name, amount: String(service.price), paymentMethod: cashSettings.defaultMethod })
    setModalOpen(true)
  }

  const finalizeReceipt = async () => {
    const status = form.paymentType === 'credit'
      ? 'debt'
      : form.paymentType === 'prepayment' || form.paymentType === 'installment'
        ? 'partial'
        : 'paid'

    await upsertReceipt({
      id: gid(),
      clinicId: clinic?.id,
      date: today(),
      status,
      total: Number(form.amount),
      amount: Number(form.amount),
      payMethod: form.paymentMethod,
      paymentType: form.paymentType,
      notes: form.notes,
      patientId: form.patientId,
      patientName: form.patientName || patients.find((p) => p.id === form.patientId)?.name || '',
      service: form.service,
      appointmentId: form.appointmentId || undefined,
      diagnosis: form.diagnosis || '',
      toothNumber: form.toothNumber || '',
      items: form.service ? [{ name: form.service, price: Number(form.amount), qty: 1 }] : [],
    })

    if (form.appointmentId && (status === 'paid' || status === 'partial')) {
      const appt = appointments.find((a) => a.id === form.appointmentId)
      await upsertAppointment({
        id: form.appointmentId,
        patientId: appt?.patientId || form.patientId,
        doctorId: appt?.doctorId,
        date: appt?.date,
        time: appt?.time,
        duration: appt?.duration,
        paymentStatus: status === 'paid' ? 'paid' : 'partial',
      })
    }

    showToast('Оплата принята', 'success')
    setPendingPay(null)
    setModalOpen(false)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!form.patientId) {
      showToast('Выберите пациента', 'warning')
      return
    }
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      showToast('Введите корректную сумму', 'warning')
      return
    }
    try {
      const needsQr = isOnlineQrMethod(form.paymentMethod) && form.paymentType !== 'credit'
      if (needsQr) {
        setPayBusy(true)
        const payment = await api.createPayment({
          amount: Number(form.amount),
          domain: 'crm',
          refType: form.appointmentId ? 'appointment' : 'crm_invoice',
          refId: form.appointmentId || form.patientId,
          meta: {
            clinicId: clinic?.id || null,
            patientId: form.patientId,
            patientName: form.patientName,
            service: form.service,
            appointmentId: form.appointmentId || null,
            title: form.service || `Оплата · ${form.patientName || 'пациент'}`,
          },
        })
        const qr = extractPaymentQrUrl(payment)
        setPendingPay({
          ...payment,
          qr: qr || payment?.qr,
          title: form.service || `Оплата · ${form.patientName || 'пациент'}`,
        })
        showToast(qr ? 'Счёт создан — покажите QR пациенту' : 'Счёт создан — завершите оплату ниже')
        return
      }
      await finalizeReceipt()
    } catch (err: any) {
      showToast(err?.message || 'Ошибка сохранения', 'error')
    } finally {
      setPayBusy(false)
    }
  }

  const confirmCashierQr = async () => {
    if (!pendingPay?.id) return
    setPayBusy(true)
    try {
      const res = await api.confirmPayment(pendingPay.id)
      if (res?.status === 'paid' || res?.settled || res?.alreadyPaid) {
        await finalizeReceipt()
      } else {
        showToast('Оплата ещё не подтверждена', 'info')
      }
    } catch (err: any) {
      showToast(err?.message || 'Оплата не подтверждена', 'error')
    } finally {
      setPayBusy(false)
    }
  }

  const handleExpenseSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    await upsertExpense({
      ...expenseForm,
      amount: Number(expenseForm.amount),
      date: expenseForm.date || today(),
    } as any)
    showToast('Расход добавлен', 'success')
    setExpModalOpen(false)
    setExpenseForm({ category: 'Прочее', amount: '', notes: '', date: today() })
    await queryClient.invalidateQueries({ queryKey: queryKeys.expenses })
    // Refresh P&L
    try {
      const data = await api.getFinanceReport({ from: period.from, to: period.to })
      setFinanceReport(data)
    } catch { /* ignore */ }
  }

  const handleDeleteExpense = async (id: string) => {
    try {
      await api.deleteExpense(id)
      await queryClient.invalidateQueries({ queryKey: queryKeys.expenses })
      showToast('Расход удалён', 'success')
      const data = await api.getFinanceReport({ from: period.from, to: period.to })
      setFinanceReport(data)
    } catch (err: any) {
      showToast(err?.message || 'Не удалось удалить', 'error')
    }
  }

  const openDebtPayment = (debt: { patientId?: string; patient: string; amount: number }) => {
    setPendingPay(null)
    setForm({
      ...EMPTY_FORM,
      patientId: debt.patientId || '',
      patientName: debt.patient,
      amount: String(debt.amount || ''),
      service: 'Погашение долга',
      paymentMethod: cashSettings.defaultMethod,
      paymentType: 'full',
      notes: 'Погашение долга',
    })
    setTab('transactions')
    setModalOpen(true)
  }

  const payrollRows = (financeReport?.payroll || []).map((row: any) => ({
    userId: row.userId,
    name: row.name,
    role: row.role || 'DOCTOR',
    percent: row.percent,
    payType: row.payType || 'commission',
    baseSalary: row.baseSalary,
    salaryPart: row.salaryPart,
    commissionPart: row.commissionPart,
    visits: row.visits,
    gross: row.gross,
    matCost: row.matCost,
    net: row.net,
    earned: Number(row.earned || 0),
  }))

  const periodLabel = `${period.from} — ${period.to}`
  const pnlRevenue = Number(financeReport?.totals?.revenue ?? 0)
  const pnlExpenses = Number(financeReport?.totals?.expenses ?? 0)
  const pnlPayroll = Number(financeReport?.totals?.payroll ?? 0)
  const pnlProfit = Number(
    financeReport?.totals?.profit ?? (pnlRevenue - pnlExpenses - pnlPayroll),
  )

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

  const quickPresets = [
    { name: 'Профгигиена', price: 45000 },
    { name: 'Лечение кариеса', price: 120000 },
    { name: 'Имплантация', price: 650000 },
  ]

  return (
    <div className="dv-page py-4 md:py-6">
      <PageHeader
        title="Финансы"
        subtitle="Касса, зарплаты, расходы и P&L клиники"
        icon={<DollarSign size={20} />}
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              icon={<Settings2 size={16} />}
              onClick={() => setShowSettings((v) => !v)}
            >
              Касса
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<ExternalLink size={16} />}
              onClick={() => navigate('/crm/inventory')}
            >
              Склад
            </Button>
            <Button variant="secondary" icon={<Plus size={16} />} onClick={() => setExpModalOpen(true)}>
              Расход
            </Button>
            <Button icon={<Plus size={16} />} onClick={handleNewTransaction}>
              Оплата
            </Button>
          </>
        }
      />

      <div className="mb-4">
        <FinancePeriodBar period={period} onChange={setPeriod} />
      </div>

      <FinancePnLStrip
        money={money}
        revenue={pnlRevenue}
        expenses={pnlExpenses}
        payroll={pnlPayroll}
        profit={pnlProfit}
        debts={debtBalance}
        loading={reportLoading}
      />

      {/* Compact quick pay */}
      <Card padding="md" className="mb-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm font-bold text-txt-primary">Быстрая оплата</p>
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
        </div>
      </Card>

      {showSettings && (
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
      )}

      <Tabs tabs={TABS} active={activeTab} onChange={setTab} className="mb-5" />

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
                                aria-label="Удалить операцию"
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
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-error">{money(d.amount)}</span>
                      <Button
                        size="sm"
                        icon={<CreditCard size={14} />}
                        onClick={() => openDebtPayment(d)}
                      >
                        Оплатить
                      </Button>
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
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm font-bold text-txt-primary">Отчёт · {periodLabel}</p>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Download size={14} />}
                  disabled={!financeReport}
                  onClick={() => {
                    downloadCsv(
                      `finance-${period.from}_${period.to}.csv`,
                      ['Метрика', 'Значение'],
                      [
                        ['Выручка', pnlRevenue],
                        ['Расходы', pnlExpenses],
                        ['ФОТ', pnlPayroll],
                        ['Прибыль', pnlProfit],
                        ['Долги', debtBalance],
                      ],
                    )
                  }}
                >
                  CSV
                </Button>
              </div>
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
                    <StatCard label="Расходы" value={money(financeReport.totals?.expenses || 0)} icon={<TrendingDown size={16} />} />
                    <StatCard label="Прибыль" value={money(financeReport.totals?.profit ?? pnlProfit)} icon={<Wallet size={16} />} />
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
                  {(financeReport.byMethod || []).length > 0 && (
                    <Card>
                      <CardHeader><CardTitle>По способам оплаты</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        {(financeReport.byMethod || []).map((m: any) => (
                          <div key={m.method} className="flex justify-between text-sm">
                            <span className="text-txt-muted">{m.method}</span>
                            <span className="font-semibold text-txt-primary">{money(m.revenue)} · {m.count}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'payroll' && (
            <FinancePayrollPanel
              rows={payrollRows}
              money={money}
              loading={reportLoading}
              periodLabel={periodLabel}
            />
          )}

          {activeTab === 'expenses' && (
            <FinanceExpensesPanel
              expenses={expenses}
              money={money}
              periodFrom={period.from}
              periodTo={period.to}
              onAdd={() => setExpModalOpen(true)}
              onDelete={handleDeleteExpense}
            />
          )}
        </div>
      </Card>

      {/* Payment modal (from schedule or manual) */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setPendingPay(null) }}
        title={pendingPay ? 'Оплата по QR' : form.appointmentId ? 'Оплата из расписания' : 'Новая оплата'}
        size="lg"
        className="max-md:!w-[calc(100vw-1rem)] max-md:!max-h-[calc(100vh-2rem)] max-md:!m-2"
      >
        {pendingPay ? (
          <PaymentQrPanel
            payment={pendingPay}
            title={pendingPay.title || form.service || 'Оплата'}
            amount={Number(form.amount)}
            busy={payBusy}
            onConfirm={confirmCashierQr}
            onCancel={() => setPendingPay(null)}
            hint="Покажите QR пациенту. После оплаты нажмите «Проверить оплату» — чек сохранится в кассе."
          />
        ) : (
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
          {isOnlineQrMethod(form.paymentMethod) && form.paymentType !== 'credit' && (
            <p className="text-[11px] text-txt-muted m-0">
              Для QR сначала создаётся счёт с кодом — пациент оплачивает, затем вы подтверждаете.
            </p>
          )}
          <Input
            label="Комментарий"
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
          />
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" loading={payBusy} icon={<CreditCard size={16} />}>
              {isOnlineQrMethod(form.paymentMethod) && form.paymentType !== 'credit'
                ? `Создать QR ${form.amount ? money(Number(form.amount)) : ''}`
                : `Принять оплату ${form.amount ? money(Number(form.amount)) : ''}`}
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setModalOpen(false); setPendingPay(null) }}>Отмена</Button>
          </div>
        </form>
        )}
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
            label="Дата"
            type="date"
            value={expenseForm.date}
            onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })}
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
