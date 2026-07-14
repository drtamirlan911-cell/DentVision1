import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useData, useToast } from '../hooks/useData';
import { PBtn, GBtn, Card, Input, Select, Badge, Modal, StatCard, Toast, EmptyState } from '../components/ui/BaseComponents';
import { T, tg, fd, gid, today, PAY_METHODS, ALL_SERVICES, getClinicCurrency } from '../utils/constants';

const TABS = [
  { id: 'transactions', label: '💳 Операции' },
  { id: 'receivables',  label: '📋 Долги' },
  { id: 'payroll',      label: '💼 Зарплата' },
  { id: 'inventory',    label: '📦 Склад' },
  { id: 'expenses',     label: '🧾 Расходы' },
];

const EMPTY_FORM = {
  type: 'income', amount: '', patientId: '', patientName: '', service: '',
  paymentMethod: 'Kaspi QR', paymentType: 'full', notes: '',
};

const PAY_TYPES = [
  { value: 'full',              label: 'Полная оплата' },
  { value: 'prepayment',        label: 'Предоплата' },
  { value: 'installment',       label: 'Рассрочка' },
  { value: 'kaspi_installment', label: 'Kaspi Рассрочка' },
  { value: 'credit',            label: 'Долг' },
];

export default function Cashier() {
  const { clinic } = useOutletContext();
  const { receipts, patients, doctors, upsertReceipt, expenses, upsertExpense, inventory } = useData(clinic?.id);
  const { toast, showToast, clearToast } = useToast();
  const [activeTab, setActiveTab] = useState('transactions');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [expenseForm, setExpenseForm] = useState({ category: '', amount: '', notes: '' });
  const [expModalOpen, setExpModalOpen] = useState(false);
  const [cashSettings, setCashSettings] = useState({ defaultMethod: 'Kaspi QR', autoReceipt: true, reminders: true });
  const money = (value) => tg(value, clinic);
  const { currency } = getClinicCurrency(clinic);

  const todayKey = today();
  const todayReceipts = receipts.filter((r) => (r.date || todayKey) === todayKey && (r.status === 'paid' || r.status === 'completed'));
  const todayExpenses = expenses.filter((e) => (e.date || todayKey) === todayKey);
  const currentMonthReceipts = receipts.filter((r) => (r.date || '').slice(0, 7) === todayKey.slice(0, 7));
  const totalIncome = currentMonthReceipts.reduce((s, r) => s + (r.total || Number(r.amount) || 0), 0);
  const debts = receipts.filter((r) => r.paymentType === 'credit' || r.status === 'debt');
  const debtBalance = debts.reduce((s, r) => s + (r.total || Number(r.amount) || 0), 0);
  const todayRevenue = todayReceipts.reduce((s, r) => s + (r.total || Number(r.amount) || 0), 0);
  const todayExpenseAmount = todayExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const handleNewTransaction = () => { setForm({ ...EMPTY_FORM, paymentMethod: cashSettings.defaultMethod }); setModalOpen(true); };

  const handleQuickPayment = (service) => {
    setForm({ ...EMPTY_FORM, service: service.name, amount: service.price, paymentMethod: cashSettings.defaultMethod });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || isNaN(Number(form.amount))) {
      showToast('Введите корректную сумму', 'warning');
      return;
    }
    try {
      const status = form.paymentType === 'credit'
        ? 'debt'
        : form.paymentType === 'prepayment' || form.paymentType === 'installment' || form.paymentType === 'kaspi_installment'
          ? 'partial'
          : 'paid';

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
      });
      showToast('Операция сохранена', 'success');
      setModalOpen(false);
    } catch {
      showToast('Ошибка сохранения', 'error');
    }
  };

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    await upsertExpense({ ...expenseForm, amount: Number(expenseForm.amount), date: today() });
    showToast('Расход добавлен', 'success');
    setExpModalOpen(false);
    setExpenseForm({ category: '', amount: '', notes: '' });
  };

  const quickPresets = [
    { name: 'Профгигиена', price: 45000 },
    { name: 'Лечение кариеса', price: 120000 },
    { name: 'Имплантация', price: 650000 },
  ];

  const payrollRows = doctors
    .filter((doctor) => Number(doctor.salary || 0) > 0 || Number(doctor.paid || 0) > 0)
    .map((doctor) => ({
      name: doctor.name,
      role: doctor.spec || 'Врач',
      salary: Number(doctor.salary || 0),
      paid: Number(doctor.paid || 0),
    }));

  const debtRows = debts.map((debt) => ({
    patient: debt.patientName || patients.find((p) => p.id === debt.patientId)?.name || 'Пациент не указан',
    amount: debt.total || Number(debt.amount) || 0,
    date: debt.date,
  }));

  return (
    <div style={{ padding: 24 }}>
      <Toast msg={toast?.msg} type={toast?.type} onClose={clearToast} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 23, fontWeight: 700, color: T.white, margin: 0 }}>Финансы</h1>
          <p style={{ fontSize: 12, color: T.slate, marginTop: 3 }}>Доходы, расходы, зарплата, склад</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <GBtn color={T.slate} onClick={() => setExpModalOpen(true)}>+ Расход</GBtn>
          <PBtn onClick={handleNewTransaction}>+ Оплата</PBtn>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-[rgba(201,169,110,0.15)] bg-[#0E1A2B]/90 p-4">
        <div style={{ fontSize: 14, fontWeight: 700, color: T.white, marginBottom: 10 }}>⚡ Быстрый приём оплаты</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {quickPresets.map((preset) => (
            <button
              key={preset.name}
              onClick={() => handleQuickPayment(preset)}
              className="rounded-lg border border-[#C9A96E]/20 bg-[#C9A96E]/10 px-3 py-2 text-sm font-semibold text-[#C9A96E] transition-colors hover:bg-[#C9A96E]/20"
            >
              {preset.name} · {money(preset.price)}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard title="Доход сегодня" value={money(todayRevenue)} icon="💰" trend="+15%" color={T.emerald} />
        <StatCard title="Расход сегодня" value={money(todayExpenseAmount)} icon="💸" trend="-5%" color={T.ruby} />
        <StatCard title="Доход за месяц" value={money(totalIncome)} icon="📊" trend="+22%" color={T.gold} />
        <StatCard title="Дебиторская задолж." value={money(debtBalance)} icon="📋" trend="+8%" color={T.amber} />
      </div>

      <Card className="mb-4" style={{ padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.white, marginBottom: 10 }}>⚙️ Настройки кассы</div>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div style={{ fontSize: 12, color: T.slate, marginBottom: 6 }}>Способ оплаты по умолчанию</div>
            <Select
              value={cashSettings.defaultMethod}
              onChange={(e) => setCashSettings({ ...cashSettings, defaultMethod: e.target.value })}
              options={PAY_METHODS.map((m) => ({ value: m, label: m }))}
            />
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <button onClick={() => setCashSettings({ ...cashSettings, autoReceipt: !cashSettings.autoReceipt })} className="flex w-full items-center justify-between text-sm font-semibold text-white">
              <span>Авто-чеки</span>
              <span className="text-[#C9A96E]">{cashSettings.autoReceipt ? 'ВКЛ' : 'ВЫКЛ'}</span>
            </button>
            <button onClick={() => setCashSettings({ ...cashSettings, reminders: !cashSettings.reminders })} className="mt-2 flex w-full items-center justify-between text-sm font-semibold text-white">
              <span>Напоминания по долгам</span>
              <span className="text-[#C9A96E]">{cashSettings.reminders ? 'ВКЛ' : 'ВЫКЛ'}</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 2, marginBottom: 16,
        background: T.card, border: `1px solid ${T.borderSub}`, borderRadius: 11, padding: '6px',
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', transition: 'all .12s', whiteSpace: 'nowrap',
            background: activeTab === t.id ? `${T.gold}20` : 'transparent',
            color: activeTab === t.id ? T.gold : T.slate,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <Card>
        {activeTab === 'transactions' && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.white, marginBottom: 16 }}>Последние операции</div>
            {receipts.length === 0 ? (
              <EmptyState icon="💳" text="Нет операций" sub="Нажмите «+ Оплата» чтобы добавить" />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${T.borderSub}` }}>
                      {['Дата', 'Пациент', 'Услуга', 'Способ оплаты', 'Тип', 'Сумма'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: T.slate, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {receipts.slice().reverse().map((r) => {
                      const statusLabel = r.status === 'debt' ? 'Долг' : r.status === 'partial' ? 'Частично' : 'Оплачено';
                      const statusColor = r.status === 'debt' ? T.ruby : r.status === 'partial' ? T.amber : T.emerald;
                      return (
                        <tr key={r.id} style={{ borderBottom: `1px solid ${T.borderSub}` }}>
                          <td style={{ padding: '10px 12px', fontSize: 12, color: T.slateL }}>{fd(r.date)}</td>
                          <td style={{ padding: '10px 12px', fontSize: 13, color: T.white, fontWeight: 600 }}>{r.patientName || patients.find(p => p.id === r.patientId)?.name || '—'}</td>
                          <td style={{ padding: '10px 12px', fontSize: 12, color: T.slateL }}>{r.service || (r.items?.[0]?.name) || '—'}</td>
                          <td style={{ padding: '10px 12px' }}><Badge color={T.sapphire} size="sm">{r.payMethod || '—'}</Badge></td>
                          <td style={{ padding: '10px 12px' }}>
                            <Badge color={statusColor} size="sm">{statusLabel}</Badge>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: statusColor, fontSize: 14 }}>
                            +{money(r.total || r.amount || 0)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'receivables' && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.white, marginBottom: 16 }}>Долги пациентов</div>
            {debtRows.length === 0 && <EmptyState icon="📋" text="Нет долгов" sub="Долги появятся только из операций этой клиники" />}
            {debtRows.map((d, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 16px', marginBottom: 10,
                background: `${T.ruby}08`, border: `1px solid ${T.ruby}20`, borderRadius: 10,
              }}>
                <div>
                  <div style={{ fontSize: 14, color: T.white, fontWeight: 600 }}>{d.patient}</div>
                  <div style={{ fontSize: 12, color: T.slate, marginTop: 2 }}>от {fd(d.date)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: T.ruby }}>{money(d.amount)}</span>
                  <GBtn size="sm" color={T.amber} onClick={() => showToast('Напоминание отправлено через WhatsApp', 'success')}>
                    💬 Напомнить
                  </GBtn>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'payroll' && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.white, marginBottom: 16 }}>Зарплата сотрудников</div>
            {payrollRows.length === 0 && <EmptyState icon="💼" text="Нет начислений" sub="Зарплатные данные для этой клиники пока не внесены" />}
            {payrollRows.map((emp, i) => {
              const pct = emp.salary > 0 ? Math.round((emp.paid / emp.salary) * 100) : 0;
              const remaining = emp.salary - emp.paid;
              return (
                <div key={i} style={{
                  padding: '16px', marginBottom: 12,
                  background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.borderSub}`, borderRadius: 10,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.white }}>{emp.name}</div>
                      <div style={{ fontSize: 12, color: T.slate }}>{emp.role}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, color: T.slateL }}>Начислено: <span style={{ color: T.white, fontWeight: 600 }}>{money(emp.salary)}</span></div>
                      <div style={{ fontSize: 13, color: T.emerald }}>Выплачено: {money(emp.paid)}</div>
                      {remaining > 0 && <div style={{ fontSize: 11, color: T.ruby }}>Остаток: {money(remaining)}</div>}
                    </div>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 4 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? T.emerald : T.amber, borderRadius: 4, transition: 'width 1s' }} />
                  </div>
                  <div style={{ fontSize: 11, color: T.slate, marginTop: 4, textAlign: 'right' }}>{pct}% выплачено</div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'inventory' && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.white, marginBottom: 16 }}>Склад материалов</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {inventory.map((item, i) => {
                const isLow = item.quantity <= item.min;
                return (
                  <div key={item.id || i} style={{
                    padding: '14px 16px', borderRadius: 10,
                    background: isLow ? `${T.ruby}08` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isLow ? T.ruby + '30' : T.borderSub}`,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.white, marginBottom: 8 }}>{item.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: isLow ? T.ruby : T.white }}>
                        {item.quantity} {item.unit}
                      </span>
                      <Badge color={isLow ? T.ruby : T.emerald} size="sm">
                        {isLow ? '⚠ Заканчивается' : '✓ В норме'}
                      </Badge>
                    </div>
                    <div style={{ fontSize: 11, color: T.slate, marginTop: 6 }}>Минимум: {item.min} {item.unit}</div>
                    {isLow && (
                      <GBtn color={T.amber} size="sm" style={{ marginTop: 8 }}
                        onClick={() => showToast(`Заявка на ${item.name} отправлена`, 'success')}>
                        🛒 Заказать
                      </GBtn>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'expenses' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.white }}>Расходы клиники</div>
              <GBtn color={T.ruby} onClick={() => setExpModalOpen(true)}>+ Расход</GBtn>
            </div>
            {expenses.length === 0 && <EmptyState icon="🧾" text="Нет расходов" sub="Добавьте расход для текущей клиники" />}
            {expenses.map((exp, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 14px', marginBottom: 8,
                background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.borderSub}`, borderRadius: 9,
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.white }}>{exp.category}</div>
                  <div style={{ fontSize: 11, color: T.slate }}>{fd(exp.date)}</div>
                </div>
                <span style={{ fontSize: 16, fontWeight: 700, color: T.ruby }}>−{money(exp.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* New transaction modal */}
      {modalOpen && (
        <Modal title="Новая оплата" onClose={() => setModalOpen(false)} size="lg">
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Select
                label="Пациент"
                value={form.patientId}
                onChange={(e) => {
                  const selectedPatient = patients.find((p) => p.id === e.target.value);
                  setForm({ ...form, patientId: e.target.value, patientName: selectedPatient?.name || '' });
                }}
                options={[
                  { value: '', label: '— Выберите пациента —' },
                  ...patients.map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
              <Input label={`Сумма (${currency})`} type="number" value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })} required />
            </div>
            <Input label="Пациент (ФИО)" value={form.patientName}
              onChange={e => setForm({ ...form, patientName: e.target.value })}
              placeholder="Иванов Иван Иванович" />
            <Select 
              label="Услуга из прайса" 
              value={form.service}
              onChange={e => {
                const selectedService = ALL_SERVICES.find(s => s.id === e.target.value);
                if (selectedService) {
                  setForm({ ...form, service: selectedService.name, amount: selectedService.price });
                } else {
                  setForm({ ...form, service: '' });
                }
              }}
              options={[
                { value: '', label: '— Выберите услугу —' },
                ...ALL_SERVICES.map(s => ({ value: s.id, label: `${s.name} — ${money(s.price)}` })),
              ]}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Select label="Способ оплаты" value={form.paymentMethod}
                onChange={e => setForm({ ...form, paymentMethod: e.target.value })}
                options={PAY_METHODS.map(m => ({ value: m, label: m }))} />
              <Select label="Тип платежа" value={form.paymentType}
                onChange={e => setForm({ ...form, paymentType: e.target.value })}
                options={PAY_TYPES} />
            </div>
            <Input label="Комментарий" value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })} />
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <PBtn type="submit" style={{ flex: 1 }}>Сохранить</PBtn>
              <GBtn type="button" onClick={() => setModalOpen(false)}>Отмена</GBtn>
            </div>
          </form>
        </Modal>
      )}

      {/* Expense modal */}
      {expModalOpen && (
        <Modal title="Новый расход" onClose={() => setExpModalOpen(false)}>
          <form onSubmit={handleExpenseSubmit}>
            <Select label="Категория" value={expenseForm.category}
              onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}
              options={[
                { value: 'Аренда', label: 'Аренда' },
                { value: 'Коммунальные', label: 'Коммунальные услуги' },
                { value: 'Материалы', label: 'Закупка материалов' },
                { value: 'Маркетинг', label: 'Маркетинг' },
                { value: 'Зарплата', label: 'Зарплата' },
                { value: 'Прочее', label: 'Прочее' },
              ]} required />
            <Input label={`Сумма (${currency})`} type="number" value={expenseForm.amount}
              onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} required />
            <Input label="Комментарий" value={expenseForm.notes}
              onChange={e => setExpenseForm({ ...expenseForm, notes: e.target.value })} />
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <PBtn type="submit" style={{ flex: 1 }}>Добавить</PBtn>
              <GBtn type="button" onClick={() => setExpModalOpen(false)}>Отмена</GBtn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
