import React, { useState, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  CreditCard, TrendingUp, TrendingDown, Wallet, AlertTriangle, Plus,
  DollarSign, Package, Receipt, Send, ShoppingCart, CheckCircle, Clock,
  User, Stethoscope, Search,
} from 'lucide-react'
import { useData, useToast } from '../../hooks/useData'
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
import { cn, formatMoney } from '../../lib/utils'
import type { Receipt, Appointment, Patient, Expense, InventoryItem, Clinic, User as UserType, RoleInfo } from '../../types'

const TABS = [
  { id: 'unpaid', label: '╨Ъ ╨╛╨┐╨╗╨░╤В╨╡', icon: <Clock size={14} /> },
  { id: 'transactions', label: '╨Ю╨┐╨╡╤А╨░╤Ж╨╕╨╕', icon: <CreditCard size={14} /> },
  { id: 'receivables', label: '╨Ф╨╛╨╗╨│╨╕', icon: <AlertTriangle size={14} /> },
  { id: 'payroll', label: '╨Ч╨░╤А╨┐╨╗╨░╤В╨░', icon: <Wallet size={14} /> },
  { id: 'inventory', label: '╨б╨║╨╗╨░╨┤', icon: <Package size={14} /> },
  { id: 'expenses', label: '╨а╨░╤Б╤Е╨╛╨┤╤Л', icon: <Receipt size={14} /> },
]

const EMPTY_FORM = {
  type: 'income', amount: '', patientId: '', patientName: '', service: '',
  paymentMethod: 'Kaspi QR', paymentType: 'full', notes: '',
}

const PAY_TYPES = [
  { value: 'full', label: '╨Я╨╛╨╗╨╜╨░╤П ╨╛╨┐╨╗╨░╤В╨░' },
  { value: 'prepayment', label: '╨Я╤А╨╡╨┤╨╛╨┐╨╗╨░╤В╨░' },
  { value: 'installment', label: '╨а╨░╤Б╤Б╤А╨╛╤З╨║╨░' },
  { value: 'kaspi_installment', label: 'Kaspi ╨а╨░╤Б╤Б╤А╨╛╤З╨║╨░' },
  { value: 'credit', label: '╨Ф╨╛╨╗╨│' },
]

const EXPENSE_CATEGORIES = [
  { value: '╨Р╤А╨╡╨╜╨┤╨░', label: '╨Р╤А╨╡╨╜╨┤╨░' },
  { value: '╨Ъ╨╛╨╝╨╝╤Г╨╜╨░╨╗╤М╨╜╤Л╨╡', label: '╨Ъ╨╛╨╝╨╝╤Г╨╜╨░╨╗╤М╨╜╤Л╨╡ ╤Г╤Б╨╗╤Г╨│╨╕' },
  { value: '╨Ь╨░╤В╨╡╤А╨╕╨░╨╗╤Л', label: '╨Ч╨░╨║╤Г╨┐╨║╨░ ╨╝╨░╤В╨╡╤А╨╕╨░╨╗╨╛╨▓' },
  { value: '╨Ь╨░╤А╨║╨╡╤В╨╕╨╜╨│', label: '╨Ь╨░╤А╨║╨╡╤В╨╕╨╜╨│' },
  { value: '╨Ч╨░╤А╨┐╨╗╨░╤В╨░', label: '╨Ч╨░╤А╨┐╨╗╨░╤В╨░' },
  { value: '╨Я╤А╨╛╤З╨╡╨╡', label: '╨Я╤А╨╛╤З╨╡╨╡' },
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
  const { receipts, patients, doctors, appointments, upsertReceipt, upsertAppointment, expenses, upsertExpense, inventory } = useData(clinic?.id)
  const { toast, showToast, clearToast } = useToast()
  const [activeTab, setActiveTab] = useState('unpaid')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<CashierForm>(EMPTY_FORM)
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>({ category: '', amount: '', notes: '' })
  const [expModalOpen, setExpModalOpen] = useState(false)
  const [cashSettings, setCashSettings] = useState({ defaultMethod: 'Kaspi QR', autoReceipt: true, reminders: true })
  const [searchUnpaid, setSearchUnpaid] = useState('')
  const money = (value: number) => tg(value, clinic)
  const { currency } = getClinicCurrency(clinic)

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
      showToast('╨Т╨▓╨╡╨┤╨╕╤В╨╡ ╨║╨╛╤А╤А╨╡╨║╤В╨╜╤Г╤О ╤Б╤Г╨╝╨╝╤Г', 'warning')
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

      showToast('╨Ю╨┐╨╗╨░╤В╨░ ╨┐╤А╨╕╨╜╤П╤В╨░', 'success')
      setModalOpen(false)
    } catch {
      showToast('╨Ю╤И╨╕╨▒╨║╨░ ╤Б╨╛╤Е╤А╨░╨╜╨╡╨╜╨╕╤П', 'error')
    }
  }

  const handleExpenseSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    await upsertExpense({ ...expenseForm, amount: Number(expenseForm.amount), date: today() } as any)
    showToast('╨а╨░╤Б╤Е╨╛╨┤ ╨┤╨╛╨▒╨░╨▓╨╗╨╡╨╜', 'success')
    setExpModalOpen(false)
    setExpenseForm({ category: '', amount: '', notes: '' })
  }

  const quickPresets = [
    { name: '╨Я╤А╨╛╤Д╨│╨╕╨│╨╕╨╡╨╜╨░', price: 45000 },
    { name: '╨Ы╨╡╤З╨╡╨╜╨╕╨╡ ╨║╨░╤А╨╕╨╡╤Б╨░', price: 120000 },
    { name: '╨Ш╨╝╨┐╨╗╨░╨╜╤В╨░╤Ж╨╕╤П', price: 650000 },
  ]

  const payrollRows = doctors
    .filter((doctor) => Number(doctor.salary || 0) > 0 || Number(doctor.paid || 0) > 0)
    .map((doctor) => ({
      name: doctor.name,
      role: doctor.spec || '╨Т╤А╨░╤З',
      salary: Number(doctor.salary || 0),
      paid: Number(doctor.paid || 0),
    }))

  const debtRows = debts.map((debt) => ({
    patient: debt.patientName || patients.find((p) => p.id === debt.patientId)?.name || '╨Я╨░╤Ж╨╕╨╡╨╜╤В ╨╜╨╡ ╤Г╨║╨░╨╖╨░╨╜',
    amount: debt.total || Number(debt.amount) || 0,
    date: debt.date,
  }))

  return (
    <div className="p-6">
      <PageHeader
        title="╨Ъ╨░╤Б╤Б╨░"
        subtitle="╨Ю╨┐╨╗╨░╤В╨░ ╨╕╨╖ ╤А╨░╤Б╨┐╨╕╤Б╨░╨╜╨╕╤П, ╨╛╨┐╨╡╤А╨░╤Ж╨╕╨╕, ╤А╨░╤Б╤Е╨╛╨┤╤Л"
        icon={<DollarSign size={20} />}
        actions={
          <>
            <Button variant="secondary" icon={<Plus size={16} />} onClick={() => setExpModalOpen(true)}>
              ╨а╨░╤Б╤Е╨╛╨┤
            </Button>
            <Button icon={<Plus size={16} />} onClick={handleNewTransaction}>
              ╨Ю╨┐╨╗╨░╤В╨░
            </Button>
          </>
        }
      />

      {/* Quick payment bar */}
      <Card padding="md" className="mb-5">
        <p className="text-sm font-bold text-txt-primary mb-3">╨С╤Л╤Б╤В╤А╤Л╨╣ ╨┐╤А╨╕╤С╨╝ ╨╛╨┐╨╗╨░╤В╤Л</p>
        <div className="flex flex-wrap gap-2">
          {quickPresets.map((preset) => (
            <Button
              key={preset.name}
              variant="outline"
              size="sm"
              icon={<CreditCard size={14} />}
              onClick={() => handleQuickPayment(preset)}
            >
              {preset.name} ┬╖ {money(preset.price)}
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
          <StatCard label="╨Ф╨╛╤Е╨╛╨┤ ╤Б╨╡╨│╨╛╨┤╨╜╤П" value={money(todayRevenue)} icon={<TrendingUp size={18} />} />
        </motion.div>
        <motion.div variants={fadeUp}>
          <StatCard label="╨а╨░╤Б╤Е╨╛╨┤ ╤Б╨╡╨│╨╛╨┤╨╜╤П" value={money(todayExpenseAmount)} icon={<TrendingDown size={18} />} />
        </motion.div>
        <motion.div variants={fadeUp}>
          <StatCard label="╨Ф╨╛╤Е╨╛╨┤ ╨╖╨░ ╨╝╨╡╤Б╤П╤Ж" value={money(totalIncome)} icon={<DollarSign size={18} />} />
        </motion.div>
        <motion.div variants={fadeUp}>
          <StatCard label="╨Ъ ╨╛╨┐╨╗╨░╤В╨╡" value={String(unpaidCount)} icon={<Clock size={18} />} className={unpaidCount > 0 ? 'ring-1 ring-warning/30' : ''} />
        </motion.div>
      </motion.div>

      {/* Settings */}
      <Card padding="md" className="mb-5">
        <p className="text-sm font-bold text-txt-primary mb-3">╨Э╨░╤Б╤В╤А╨╛╨╣╨║╨╕ ╨║╨░╤Б╤Б╤Л</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg border border-bdr-subtle bg-white/[0.02]">
            <p className="text-xs text-txt-secondary mb-2">╨б╨┐╨╛╤Б╨╛╨▒ ╨╛╨┐╨╗╨░╤В╤Л ╨┐╨╛ ╤Г╨╝╨╛╨╗╤З╨░╨╜╨╕╤О</p>
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
              label="╨Р╨▓╤В╨╛-╤З╨╡╨║╨╕"
            />
            <Switch
              checked={cashSettings.reminders}
              onCheckedChange={(v) => setCashSettings({ ...cashSettings, reminders: v })}
              label="╨Э╨░╨┐╨╛╨╝╨╕╨╜╨░╨╜╨╕╤П ╨┐╨╛ ╨┤╨╛╨╗╨│╨░╨╝"
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
                  ╨Ч╨░╨┐╨╕╤Б╨╕ ╨╕╨╖ ╤А╨░╤Б╨┐╨╕╤Б╨░╨╜╨╕╤П ╨║ ╨╛╨┐╨╗╨░╤В╨╡
                  {unpaidCount > 0 && <Badge variant="warning" size="sm" className="ml-2">{unpaidCount}</Badge>}
                </p>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
                  <input
                    placeholder="╨Я╨╛╨╕╤Б╨║..."
                    value={searchUnpaid}
                    onChange={e => setSearchUnpaid(e.target.value)}
                    className="pl-9 !h-8 !text-xs !w-48"
                  />
                </div>
              </div>
              {unpaidAppointments.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle size={32} />}
                  title="╨Т╤Б╨╡ ╨╛╨┐╨╗╨░╤З╨╡╨╜╨╛"
                  description="╨Э╨╡╤В ╨╜╨╡╨╛╨┐╨╗╨░╤З╨╡╨╜╨╜╤Л╤Е ╨╖╨░╨┐╨╕╤Б╨╡╨╣ ╨╕╨╖ ╤А╨░╤Б╨┐╨╕╤Б╨░╨╜╨╕╤П"
                />
              ) : (
                <div className="space-y-2.5">
                  {unpaidAppointments.map((appt) => {
                    const patient = patients.find(p => p.id === appt.patientId)
                    const doctor = doctors.find(d => d.id === appt.doctorId)
                    const toothLabel = appt.toothNumber ? `╨Ч╤Г╨▒ ${appt.toothNumber}` : ''
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
                            <span className="text-sm font-semibold text-txt-primary truncate">{patient?.name || '╨Я╨░╤Ж╨╕╨╡╨╜╤В'}</span>
                            <Badge variant="warning" size="xs">╨Э╨╡ ╨╛╨┐╨╗╨░╤З╨╡╨╜╨╛</Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-txt-secondary">
                            {appt.serviceName && (
                              <span className="flex items-center gap-1">
                                <Stethoscope size={12} className="text-txt-muted" />
                                {appt.serviceName}
                              </span>
                            )}
                            {doctor && <span className="text-txt-muted">{doctor.name}</span>}
                            <span className="text-txt-muted">{appt.date} ┬╖ {appt.time}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {appt.diagnosis && (
                              <span className="text-2xs text-dv-gold font-medium">{appt.diagnosis.split(' тАФ ')[0]}</span>
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
                            ╨Ю╨┐╨╗╨░╤В╨░
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
              <p className="text-sm font-bold text-txt-primary mb-4">╨Я╨╛╤Б╨╗╨╡╨┤╨╜╨╕╨╡ ╨╛╨┐╨╡╤А╨░╤Ж╨╕╨╕</p>
              {receipts.length === 0 ? (
                <EmptyState
                  icon={<CreditCard size={32} />}
                  title="╨Э╨╡╤В ╨╛╨┐╨╡╤А╨░╤Ж╨╕╨╣"
                  description="╨Э╨░╨╢╨╝╨╕╤В╨╡ ┬л+ ╨Ю╨┐╨╗╨░╤В╨░┬╗ ╤З╤В╨╛╨▒╤Л ╨┤╨╛╨▒╨░╨▓╨╕╤В╤М"
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-bdr-subtle">
                        {['╨Ф╨░╤В╨░', '╨Я╨░╤Ж╨╕╨╡╨╜╤В', '╨г╤Б╨╗╤Г╨│╨░', '╨Ч╤Г╨▒', '╨Ф╨╕╨░╨│╨╜╨╛╨╖', '╨б╨┐╨╛╤Б╨╛╨▒', '╨б╤В╨░╤В╤Г╤Б', '╨б╤Г╨╝╨╝╨░'].map(h => (
                          <th key={h} className="text-left py-2 px-3 text-2xs font-bold text-txt-muted uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {receipts.slice().reverse().map((r) => {
                        const statusVariant = r.status === 'debt' ? 'error' : r.status === 'partial' ? 'warning' : 'success'
                        const statusLabel = r.status === 'debt' ? '╨Ф╨╛╨╗╨│' : r.status === 'partial' ? '╨з╨░╤Б╤В╨╕╤З╨╜╨╛' : '╨Ю╨┐╨╗╨░╤З╨╡╨╜╨╛'
                        const toothLabel = r.toothNumber ? `╨Ч╤Г╨▒ ${r.toothNumber}` : 'тАФ'
                        const diagShort = r.diagnosis ? r.diagnosis.split(' тАФ ')[0] : 'тАФ'
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
              <p className="text-sm font-bold text-txt-primary mb-4">╨Ф╨╛╨╗╨│╨╕ ╨┐╨░╤Ж╨╕╨╡╨╜╤В╨╛╨▓</p>
              {debtRows.length === 0 && (
                <EmptyState
                  icon={<AlertTriangle size={32} />}
                  title="╨Э╨╡╤В ╨┤╨╛╨╗╨│╨╛╨▓"
                  description="╨Ф╨╛╨╗╨│╨╕ ╨┐╨╛╤П╨▓╤П╤В╤Б╤П ╤В╨╛╨╗╤М╨║╨╛ ╨╕╨╖ ╨╛╨┐╨╡╤А╨░╤Ж╨╕╨╣ ╤Н╤В╨╛╨╣ ╨║╨╗╨╕╨╜╨╕╨║╨╕"
                />
              )}
              <div className="space-y-2.5">
                {debtRows.map((d, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-error/20 bg-error/5">
                    <div>
                      <p className="text-sm font-semibold text-txt-primary">{d.patient}</p>
                      <p className="text-xs text-txt-muted mt-0.5">╨╛╤В {fd(d.date)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-error">{money(d.amount)}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Send size={14} />}
                        onClick={() => showToast('╨Э╨░╨┐╨╛╨╝╨╕╨╜╨░╨╜╨╕╨╡ ╨╛╤В╨┐╤А╨░╨▓╨╗╨╡╨╜╨╛ ╤З╨╡╤А╨╡╨╖ WhatsApp', 'success')}
                      >
                        ╨Э╨░╨┐╨╛╨╝╨╜╨╕╤В╤М
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'payroll' && (
            <div>
              <p className="text-sm font-bold text-txt-primary mb-4">╨Ч╨░╤А╨┐╨╗╨░╤В╨░ ╤Б╨╛╤В╤А╤Г╨┤╨╜╨╕╨║╨╛╨▓</p>
              {payrollRows.length === 0 && (
                <EmptyState
                  icon={<Wallet size={32} />}
                  title="╨Э╨╡╤В ╨╜╨░╤З╨╕╤Б╨╗╨╡╨╜╨╕╨╣"
                  description="╨Ч╨░╤А╨┐╨╗╨░╤В╨╜╤Л╨╡ ╨┤╨░╨╜╨╜╤Л╨╡ ╨┤╨╗╤П ╤Н╤В╨╛╨╣ ╨║╨╗╨╕╨╜╨╕╨║╨╕ ╨┐╨╛╨║╨░ ╨╜╨╡ ╨▓╨╜╨╡╤Б╨╡╨╜╤Л"
                />
              )}
              <div className="space-y-3">
                {payrollRows.map((emp, i) => {
                  const pct = emp.salary > 0 ? Math.round((emp.paid / emp.salary) * 100) : 0
                  const remaining = emp.salary - emp.paid
                  return (
                    <div key={i} className="p-4 rounded-xl border border-bdr-subtle bg-white/[0.02]">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-sm font-semibold text-txt-primary">{emp.name}</p>
                          <p className="text-xs text-txt-muted">{emp.role}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-txt-secondary">╨Э╨░╤З╨╕╤Б╨╗╨╡╨╜╨╛: <span className="font-semibold text-txt-primary">{money(emp.salary)}</span></p>
                          <p className="text-xs text-success">╨Т╤Л╨┐╨╗╨░╤З╨╡╨╜╨╛: {money(emp.paid)}</p>
                          {remaining > 0 && <p className="text-xs text-error">╨Ю╤Б╤В╨░╤В╨╛╨║: {money(remaining)}</p>}
                        </div>
                      </div>
                      <div className="h-1.5 bg-white/[0.07] rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-1000', pct >= 100 ? 'bg-success' : 'bg-warning')}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-txt-muted mt-1 text-right">{pct}% ╨▓╤Л╨┐╨╗╨░╤З╨╡╨╜╨╛</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {activeTab === 'inventory' && (
            <div>
              <p className="text-sm font-bold text-txt-primary mb-4">╨б╨║╨╗╨░╨┤ ╨╝╨░╤В╨╡╤А╨╕╨░╨╗╨╛╨▓</p>
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
                          {isLow ? '╨Ч╨░╨║╨░╨╜╤З╨╕╨▓╨░╨╡╤В╤Б╤П' : '╨Т ╨╜╨╛╤А╨╝╨╡'}
                        </Badge>
                      </div>
                      <p className="text-xs text-txt-muted mb-2">╨Ь╨╕╨╜╨╕╨╝╤Г╨╝: {item.min} {item.unit}</p>
                      {isLow && (
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<ShoppingCart size={14} />}
                          onClick={() => showToast(`╨Ч╨░╤П╨▓╨║╨░ ╨╜╨░ ${item.name} ╨╛╤В╨┐╤А╨░╨▓╨╗╨╡╨╜╨░`, 'success')}
                        >
                          ╨Ч╨░╨║╨░╨╖╨░╤В╤М
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
                <p className="text-sm font-bold text-txt-primary">╨а╨░╤Б╤Е╨╛╨┤╤Л ╨║╨╗╨╕╨╜╨╕╨║╨╕</p>
                <Button variant="danger" size="sm" icon={<Plus size={14} />} onClick={() => setExpModalOpen(true)}>
                  ╨а╨░╤Б╤Е╨╛╨┤
                </Button>
              </div>
              {expenses.length === 0 && (
                <EmptyState
                  icon={<Receipt size={32} />}
                  title="╨Э╨╡╤В ╤А╨░╤Б╤Е╨╛╨┤╨╛╨▓"
                  description="╨Ф╨╛╨▒╨░╨▓╤М╤В╨╡ ╤А╨░╤Б╤Е╨╛╨┤ ╨┤╨╗╤П ╤В╨╡╨║╤Г╤Й╨╡╨╣ ╨║╨╗╨╕╨╜╨╕╨║╨╕"
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
        title={form.appointmentId ? '╨Ю╨┐╨╗╨░╤В╨░ ╨╕╨╖ ╤А╨░╤Б╨┐╨╕╤Б╨░╨╜╨╕╤П' : '╨Э╨╛╨▓╨░╤П ╨╛╨┐╨╗╨░╤В╨░'}
        size="lg"
        className="max-md:!w-[calc(100vw-1rem)] max-md:!max-h-[calc(100vh-2rem)] max-md:!m-2"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {form.appointmentId && (
            <div className="p-3 rounded-xl bg-warning/5 border border-warning/20 space-y-2">
              <p className="text-xs font-semibold text-warning">╨Ю╨┐╨╗╨░╤В╨░ ╨╕╨╖ ╤А╨░╤Б╨┐╨╕╤Б╨░╨╜╨╕╤П</p>
              {form.diagnosis && <p className="text-xs text-txt-secondary">╨Ф╨╕╨░╨│╨╜╨╛╨╖: <span className="text-txt-primary font-medium">{form.diagnosis}</span></p>}
              {form.toothNumber && <p className="text-xs text-txt-secondary">╨Ч╤Г╨▒: <span className="text-emerald-400 font-medium">{form.toothNumber} тАФ {TOOTH_NAMES[form.toothNumber as number]}</span></p>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="╨Я╨░╤Ж╨╕╨╡╨╜╤В"
              value={form.patientId}
              onChange={(e) => {
                const selectedPatient = patients.find((p) => p.id === e.target.value)
                setForm({ ...form, patientId: e.target.value, patientName: selectedPatient?.name || '' })
              }}
              options={[
                { value: '', label: '--- ╨Т╤Л╨▒╨╡╤А╨╕╤В╨╡ ╨┐╨░╤Ж╨╕╨╡╨╜╤В╨░ ---' },
                ...patients.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
            <Input
              label={`╨б╤Г╨╝╨╝╨░ (${currency})`}
              type="number"
              value={form.amount}
              onChange={e => setForm({ ...form, amount: e.target.value })}
              required
            />
          </div>
          <Input
            label="╨Я╨░╤Ж╨╕╨╡╨╜╤В (╨д╨Ш╨Ю)"
            value={form.patientName}
            onChange={e => setForm({ ...form, patientName: e.target.value })}
            placeholder="╨Ш╨▓╨░╨╜╨╛╨▓ ╨Ш╨▓╨░╨╜ ╨Ш╨▓╨░╨╜╨╛╨▓╨╕╤З"
          />
          <Input
            label="╨г╤Б╨╗╤Г╨│╨░"
            value={form.service}
            onChange={e => setForm({ ...form, service: e.target.value })}
            placeholder="╨Э╨░╨╖╨▓╨░╨╜╨╕╨╡ ╤Г╤Б╨╗╤Г╨│╨╕"
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="╨б╨┐╨╛╤Б╨╛╨▒ ╨╛╨┐╨╗╨░╤В╤Л"
              value={form.paymentMethod}
              onChange={e => setForm({ ...form, paymentMethod: e.target.value })}
              options={PAY_METHODS.map(m => ({ value: m, label: m }))}
            />
            <Select
              label="╨в╨╕╨┐ ╨┐╨╗╨░╤В╨╡╨╢╨░"
              value={form.paymentType}
              onChange={e => setForm({ ...form, paymentType: e.target.value })}
              options={PAY_TYPES}
            />
          </div>
          <Input
            label="╨Ъ╨╛╨╝╨╝╨╡╨╜╤В╨░╤А╨╕╨╣"
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
          />
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" icon={<CreditCard size={16} />}>
              ╨Я╤А╨╕╨╜╤П╤В╤М ╨╛╨┐╨╗╨░╤В╤Г {form.amount ? money(Number(form.amount)) : ''}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>╨Ю╤В╨╝╨╡╨╜╨░</Button>
          </div>
        </form>
      </Modal>

      {/* Expense modal */}
      <Modal
        open={expModalOpen}
        onClose={() => setExpModalOpen(false)}
        title="╨Э╨╛╨▓╤Л╨╣ ╤А╨░╤Б╤Е╨╛╨┤"
      >
        <form onSubmit={handleExpenseSubmit} className="space-y-4">
          <Select
            label="╨Ъ╨░╤В╨╡╨│╨╛╤А╨╕╤П"
            value={expenseForm.category}
            onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}
            options={EXPENSE_CATEGORIES}
            required
          />
          <Input
            label={`╨б╤Г╨╝╨╝╨░ (${currency})`}
            type="number"
            value={expenseForm.amount}
            onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
            required
          />
          <Input
            label="╨Ъ╨╛╨╝╨╝╨╡╨╜╤В╨░╤А╨╕╨╣"
            value={expenseForm.notes}
            onChange={e => setExpenseForm({ ...expenseForm, notes: e.target.value })}
          />
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1">╨Ф╨╛╨▒╨░╨▓╨╕╤В╤М</Button>
            <Button type="button" variant="ghost" onClick={() => setExpModalOpen(false)}>╨Ю╤В╨╝╨╡╨╜╨░</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
