import React, { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  CreditCard, TrendingUp, TrendingDown, Wallet, AlertTriangle, Plus,
  DollarSign, Package, Receipt, Send, ShoppingCart,
} from 'lucide-react'
import { useData, useToast } from '../hooks/useData'
import { Button } from '../components/ui/ds/Button'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/ds/Card'
import { Input, Select } from '../components/ui/ds/Input'
import { Badge, StatusBadge } from '../components/ui/ds/Badge'
import { Modal } from '../components/ui/ds/Modal'
import { EmptyState } from '../components/ui/ds/EmptyState'
import { StatCard, PageHeader } from '../components/ui/ds/StatCard'
import { Tabs } from '../components/ui/ds/Misc'
import { Switch } from '../components/ui/ds/Misc'
import { tg, fd, gid, today, PAY_METHODS, ALL_SERVICES, getClinicCurrency } from '../utils/constants'
import { cn, formatMoney } from '../lib/utils'

const TABS = [
  { id: 'transactions', label: 'Операции', icon: <CreditCard size={14} /> },
  { id: 'receivables', label: 'Долги', icon: <AlertTriangle size={14} /> },
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

export default function Cashier() {
  const { clinic } = useOutletContext()
  const { receipts, patients, doctors, upsertReceipt, expenses, upsertExpense, inventory } = useData(clinic?.id)
  const { toast, showToast, clearToast } = useToast()
  const [activeTab, setActiveTab] = useState('transactions')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [expenseForm, setExpenseForm] = useState({ category: '', amount: '', notes: '' })
  const [expModalOpen, setExpModalOpen] = useState(false)
  const [cashSettings, setCashSettings] = useState({ defaultMethod: 'Kaspi QR', autoReceipt: true, reminders: true })
  const money = (value) => tg(value, clinic)
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

  const handleNewTransaction = () => { setForm({ ...EMPTY_FORM, paymentMethod: cashSettings.defaultMethod }); setModalOpen(true) }

  const handleQuickPayment = (service) => {
    setForm({ ...EMPTY_FORM, service: service.name, amount: service.price, paymentMethod: cashSettings.defaultMethod })
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
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
        items: form.service ? [{ name: form.service, price: Number(form.amount), qty: 1 }] : [],
      })
      showToast('Операция сохранена', 'success')
      setModalOpen(false)
    } catch {
      showToast('Ошибка сохранения', 'error')
    }
  }

  const handleExpenseSubmit = async (e) => {
    e.preventDefault()
    await upsertExpense({ ...expenseForm, amount: Number(expenseForm.amount), date: today() })
    showToast('Расход добавлен', 'success')
    setExpModalOpen(false)
    setExpenseForm({ category: '', amount: '', notes: '' })
  }

  const quickPresets = [
    { name: 'Профгигиена', price: 45000 },
    { name: 'Лечение кариеса', price: 120000 },
    { name: 'Имплантация', price: 650000 },
  ]

  const payrollRows = doctors
    .filter((doctor) => Number(doctor.salary || 0) > 0 || Number(doctor.paid || 0) > 0)
    .map((doctor) => ({
      name: doctor.name,
      role: doctor.spec || 'Врач',
      salary: Number(doctor.salary || 0),
      paid: Number(doctor.paid || 0),
    }))

  const debtRows = debts.map((debt) => ({
    patient: debt.patientName || patients.find((p) => p.id === debt.patientId)?.name || 'Пациент не указан',
    amount: debt.total || Number(debt.amount) || 0,
    date: debt.date,
  }))

  return (
    <div className="p-6">
      <PageHeader
        title="Финансы"
        subtitle="Доходы, расходы, зарплата, склад"
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
          <StatCard label="Дебиторская задолж." value={money(debtBalance)} icon={<AlertTriangle size={18} />} />
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
                        {['Дата', 'Пациент', 'Услуга', 'Способ оплаты', 'Тип', 'Сумма'].map(h => (
                          <th key={h} className="text-left py-2 px-3 text-2xs font-bold text-txt-muted uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {receipts.slice().reverse().map((r) => {
                        const statusVariant = r.status === 'debt' ? 'error' : r.status === 'partial' ? 'warning' : 'success'
                        const statusLabel = r.status === 'debt' ? 'Долг' : r.status === 'partial' ? 'Частично' : 'Оплачено'
                        return (
                          <tr key={r.id} className="border-b border-bdr-subtle last:border-b-0">
                            <td className="py-2.5 px-3 text-xs text-txt-secondary">{fd(r.date)}</td>
                            <td className="py-2.5 px-3 text-sm font-semibold text-txt-primary">{r.patientName || patients.find(p => p.id === r.patientId)?.name || '---'}</td>
                            <td className="py-2.5 px-3 text-xs text-txt-secondary">{r.service || (r.items?.[0]?.name) || '---'}</td>
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
                        onClick={() => showToast('Напоминание отправлено через WhatsApp', 'success')}
                      >
                        Напомнить
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'payroll' && (
            <div>
              <p className="text-sm font-bold text-txt-primary mb-4">Зарплата сотрудников</p>
              {payrollRows.length === 0 && (
                <EmptyState
                  icon={<Wallet size={32} />}
                  title="Нет начислений"
                  description="Зарплатные данные для этой клиники пока не внесены"
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
                          <p className="text-xs text-txt-secondary">Начислено: <span className="font-semibold text-txt-primary">{money(emp.salary)}</span></p>
                          <p className="text-xs text-success">Выплачено: {money(emp.paid)}</p>
                          {remaining > 0 && <p className="text-xs text-error">Остаток: {money(remaining)}</p>}
                        </div>
                      </div>
                      <div className="h-1.5 bg-white/[0.07] rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-1000', pct >= 100 ? 'bg-success' : 'bg-warning')}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-txt-muted mt-1 text-right">{pct}% выплачено</p>
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

      {/* New transaction modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Новая оплата"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <Select
            label="Услуга из прайса"
            value={form.service}
            onChange={e => {
              const selectedService = ALL_SERVICES.find(s => s.id === e.target.value)
              if (selectedService) {
                setForm({ ...form, service: selectedService.name, amount: selectedService.price })
              } else {
                setForm({ ...form, service: '' })
              }
            }}
            options={[
              { value: '', label: '--- Выберите услугу ---' },
              ...ALL_SERVICES.map(s => ({ value: s.id, label: `${s.name} — ${money(s.price)}` })),
            ]}
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
            <Button type="submit" className="flex-1">Сохранить</Button>
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
