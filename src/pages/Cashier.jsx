import React, { useState } from 'react';
import { useData, useToast } from '../hooks/useData';
import { PBtn, GBtn, Card, Input, Select, Badge, Modal, StatCard, Toast, EmptyState } from '../components/ui/BaseComponents';
import { T, tg, fd, gid, today, PAY_METHODS, ALL_SERVICES } from '../utils/constants';

const TABS = [
  { id: 'transactions', label: '💳 Операции' },
  { id: 'receivables',  label: '📋 Долги' },
  { id: 'payroll',      label: '💼 Зарплата' },
  { id: 'inventory',    label: '📦 Склад' },
  { id: 'expenses',     label: '🧾 Расходы' },
];

const EMPTY_FORM = {
  type: 'income', amount: '', patientName: '', service: '',
  paymentMethod: 'Kaspi QR', paymentType: 'full', notes: '',
};

const PAY_TYPES = [
  { value: 'full',              label: 'Полная оплата' },
  { value: 'prepayment',        label: 'Предоплата' },
  { value: 'installment',       label: 'Рассрочка' },
  { value: 'kaspi_installment', label: 'Kaspi Рассрочка' },
  { value: 'credit',            label: 'Долг' },
];

export default function Cashier({ clinic }) {
  const { receipts, patients, upsertReceipt, expenses, upsertExpense, inventory, upsertInventoryItem } = useData(clinic?.id);
  const { toast, showToast, clearToast } = useToast();
  const [activeTab, setActiveTab] = useState('transactions');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [expenseForm, setExpenseForm] = useState({ category: '', amount: '', notes: '' });
  const [expModalOpen, setExpModalOpen] = useState(false);

  const totalIncome  = receipts.filter(r => r.status === 'paid').reduce((s, r) => s + (r.total || Number(r.amount) || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const debts = receipts.filter(r => r.paymentType === 'credit' || r.status === 'debt');

  const handleNewTransaction = () => { setForm(EMPTY_FORM); setModalOpen(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || isNaN(Number(form.amount))) {
      showToast('Введите корректную сумму', 'warning');
      return;
    }
    try {
      await upsertReceipt({
        id: gid(),
        clinicId: clinic?.id,
        date: today(),
        status: form.paymentType === 'credit' ? 'debt' : 'paid',
        total: Number(form.amount),
        payMethod: form.paymentMethod,
        paymentType: form.paymentType,
        notes: form.notes,
        patientName: form.patientName,
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

  const demoPayroll = [
    { name: 'Д-р Ахметов',  role: 'Врач',          salary: 450000, paid: 320000 },
    { name: 'Д-р Омарова',  role: 'Врач',          salary: 380000, paid: 280000 },
    { name: 'Иванова М.',   role: 'Администратор', salary: 250000, paid: 250000 },
  ];

  const demoDebts = [
    { patient: 'Петров В.В.',     amount: 120000, date: '2025-01-15' },
    { patient: 'Сидорова Е.К.',   amount: 85000,  date: '2025-01-20' },
    { patient: 'Алиев Н.Р.',      amount: 135000, date: '2025-02-05' },
  ];

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

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard title="Доход сегодня"         value={tg(125000)}    icon="💰" trend="+15%" color={T.emerald} />
        <StatCard title="Расход сегодня"        value={tg(15000)}     icon="💸" trend="-5%"  color={T.ruby} />
        <StatCard title="Доход за месяц"        value={tg(totalIncome || 2450000)} icon="📊" trend="+22%" color={T.gold} />
        <StatCard title="Дебиторская задолж."   value={tg(340000)}    icon="📋" trend="+8%"  color={T.amber} />
      </div>

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
                    {receipts.slice().reverse().map((r, i) => (
                      <tr key={r.id} style={{ borderBottom: `1px solid ${T.borderSub}` }}>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: T.slateL }}>{fd(r.date)}</td>
                        <td style={{ padding: '10px 12px', fontSize: 13, color: T.white, fontWeight: 600 }}>{r.patientName || patients.find(p => p.id === r.patientId)?.name || '—'}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: T.slateL }}>{r.service || (r.items?.[0]?.name) || '—'}</td>
                        <td style={{ padding: '10px 12px' }}><Badge color={T.sapphire} size="sm">{r.payMethod || '—'}</Badge></td>
                        <td style={{ padding: '10px 12px' }}>
                          <Badge color={r.status === 'debt' ? T.ruby : T.emerald} size="sm">
                            {r.status === 'debt' ? 'Долг' : 'Оплачено'}
                          </Badge>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: r.status === 'debt' ? T.ruby : T.emerald, fontSize: 14 }}>
                          +{tg(r.total || r.amount || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'receivables' && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.white, marginBottom: 16 }}>Долги пациентов</div>
            {demoDebts.map((d, i) => (
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
                  <span style={{ fontSize: 16, fontWeight: 700, color: T.ruby }}>{tg(d.amount)}</span>
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
            {demoPayroll.map((emp, i) => {
              const pct = Math.round((emp.paid / emp.salary) * 100);
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
                      <div style={{ fontSize: 13, color: T.slateL }}>Начислено: <span style={{ color: T.white, fontWeight: 600 }}>{tg(emp.salary)}</span></div>
                      <div style={{ fontSize: 13, color: T.emerald }}>Выплачено: {tg(emp.paid)}</div>
                      {remaining > 0 && <div style={{ fontSize: 11, color: T.ruby }}>Остаток: {tg(remaining)}</div>}
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
            {[
              { category: 'Аренда',              amount: 450000, date: '2025-01-01' },
              { category: 'Коммунальные услуги',  amount: 85000,  date: '2025-01-05' },
              { category: 'Закупка материалов',   amount: 320000, date: '2025-01-10' },
              { category: 'Маркетинг',            amount: 150000, date: '2025-01-12' },
              ...expenses,
            ].map((exp, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 14px', marginBottom: 8,
                background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.borderSub}`, borderRadius: 9,
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.white }}>{exp.category}</div>
                  <div style={{ fontSize: 11, color: T.slate }}>{fd(exp.date)}</div>
                </div>
                <span style={{ fontSize: 16, fontWeight: 700, color: T.ruby }}>−{tg(exp.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* New transaction modal */}
      {modalOpen && (
        <Modal title="Новая оплата" onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label="Пациент (ФИО)" value={form.patientName}
                onChange={e => setForm({ ...form, patientName: e.target.value })}
                placeholder="Иванов Иван Иванович" />
              <Input label="Сумма (₸)" type="number" value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })} required />
            </div>
            <Input label="Услуга" value={form.service}
              onChange={e => setForm({ ...form, service: e.target.value })}
              placeholder="Лечение кариеса, протезирование…" />
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
            <Input label="Сумма (₸)" type="number" value={expenseForm.amount}
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
