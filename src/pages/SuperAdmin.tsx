import React, { useState, type FormEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, CheckCircle, Ban, AlertTriangle, Users, Banknote, Pencil, KeyRound, Trash2, Plus, Info } from 'lucide-react';
import { useAuth } from '@/store/auth.store';
import { useToast } from '@/components/ui/ds/Toast';
import { Button } from '../components/ui/ds/Button';
import { Card } from '../components/ui/ds/Card';
import { Input, Select } from '../components/ui/ds/Input';
import { Badge } from '../components/ui/ds/Badge';
import { Modal } from '../components/ui/ds/Modal';
import { StatCard, PageHeader } from '../components/ui/ds/StatCard';
import { PLANS, tg, gid, fd } from '../utils/constants';
import type { Clinic, User, RoleInfo } from '../types';

const PLAN_COLORS: Record<string, string> = { starter: '#4e8cff', pro: '#c9a96e', enterprise: '#9b5de5' };
const PLAN_BADGE_CLASSES: Record<string, string> = {
  starter: 'bg-[#4e8cff]/10 text-[#4e8cff] border-[#4e8cff]/20',
  pro: 'bg-dv-gold/10 text-dv-gold border-dv-gold/20',
  enterprise: 'bg-[#9b5de5]/10 text-[#9b5de5] border-[#9b5de5]/20',
  default: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
};

interface ClinicForm {
  name: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  plan: string;
  active: boolean;
}

export default function SuperAdmin() {
  const { user } = useOutletContext<{ clinic: Clinic; user: User; roleInfo: RoleInfo }>();
  const { allClinics, allUsers } = useAuth();
  const { showToast } = useToast();

  const [clinics, setClinics] = useState<Clinic[]>(allClinics);
  const [modalOpen, setModalOpen] = useState(false);
  const [editClinic, setEditClinic] = useState<Clinic | null>(null);
  const [form, setForm] = useState<ClinicForm>({ name: '', city: '', address: '', phone: '', email: '', plan: 'starter', active: true });
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [clinicToDelete, setClinicToDelete] = useState<Clinic | null>(null);

  const users = allUsers;

  const openNew = () => {
    setEditClinic(null);
    setForm({ name: '', city: '', address: '', phone: '', email: '', plan: 'starter', active: true });
    setModalOpen(true);
  };

  const openEdit = (c: Clinic) => {
    setEditClinic(c);
    setForm({ name: c.name, city: c.city || '', address: c.address || '', phone: c.phone || '', email: c.email || '', plan: c.plan || 'starter', active: c.active ?? true });
    setModalOpen(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { showToast('Введите название клиники', 'warning'); return; }
    if (editClinic) {
      setClinics(prev => prev.map(c => c.id === editClinic.id ? { ...c, ...form } : c));
      showToast('Клиника обновлена', 'success');
    } else {
      const newClinic: Clinic = { ...form, id: gid(), createdAt: new Date().toISOString().slice(0, 10), color: '#c9a96e', subscriptionStart: new Date().toISOString().slice(0, 10), subscriptionEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) };
      setClinics(prev => [...prev, newClinic]);
      showToast('Клиника добавлена', 'success');
    }
    setModalOpen(false);
  };

  const toggleActive = (id: string) => {
    setClinics(prev => prev.map(c => c.id === id ? { ...c, active: !c.active } : c));
    showToast('Статус обновлён', 'info');
  };

  const changePlan = (clinicId: string, newPlan: string) => {
    setClinics(prev => prev.map(c => c.id === clinicId ? { ...c, plan: newPlan } : c));
    showToast('Тариф изменён', 'success');
  };

  const extendSubscription = (clinicId: string, months = 1) => {
    setClinics(prev => prev.map(c => {
      if (c.id === clinicId) {
        const currentEnd = c.subscriptionEnd ? new Date(c.subscriptionEnd) : new Date();
        const newEnd = new Date(currentEnd.setMonth(currentEnd.getMonth() + months));
        return { ...c, subscriptionEnd: newEnd.toISOString().slice(0, 10) };
      }
      return c;
    }));
    showToast(`Подписка продлена на ${months} мес.`, 'success');
  };

  const openResetPassword = (u: User) => {
    setResetUser(u);
    setNewPassword('');
    setResetModalOpen(true);
  };

  const handleResetPassword = (e: FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) { showToast('Пароль должен быть не менее 6 символов', 'warning'); return; }
    showToast(`Пароль для ${resetUser?.login} сброшен`, 'success');
    setResetModalOpen(false);
  };

  const openDelete = (c: Clinic) => {
    setClinicToDelete(c);
    setDeleteModalOpen(true);
  };

  const handleDelete = () => {
    if (clinicToDelete) {
      setClinics(prev => prev.filter(c => c.id !== clinicToDelete.id));
      showToast('Клиника удалена', 'success');
      setDeleteModalOpen(false);
      setClinicToDelete(null);
    }
  };

  const stats = {
    total: clinics.length,
    active: clinics.filter(c => c.active).length,
    blocked: clinics.filter(c => !c.active).length,
    users: users.length,
    revenue: clinics.reduce((s, c) => s + (c.plan === 'enterprise' ? 150000 : c.plan === 'pro' ? 35000 : 15000), 0),
    expiringSoon: clinics.filter(c => {
      if (!c.subscriptionEnd) return false;
      const endDate = new Date(c.subscriptionEnd);
      const now = new Date();
      const daysLeft = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return daysLeft <= 7 && daysLeft >= 0;
    }).length,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-6"
    >
      <PageHeader
        title="Управление SaaS"
        subtitle={`DentVision Platform · ${user?.name}`}
        icon={<Building2 size={20} />}
        actions={<Button icon={<Plus size={16} />} onClick={openNew}>Добавить клинику</Button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard label="Всего клиник" value={stats.total} icon={<Building2 size={18} />} />
        <StatCard label="Активных" value={stats.active} icon={<CheckCircle size={18} />} />
        <StatCard label="Заблокировано" value={stats.blocked} icon={<Ban size={18} />} />
        <StatCard label="Истекают (7 дн.)" value={stats.expiringSoon} icon={<AlertTriangle size={18} />} />
        <StatCard label="Пользователей" value={stats.users} icon={<Users size={18} />} />
        <StatCard label="MRR" value={tg(stats.revenue)} icon={<Banknote size={18} />} />
      </div>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-bdr-subtle">
                {['Клиника', 'Контакты', 'Тариф', 'Подписка', 'Статус', 'Действия'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-txt-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {clinics.map(c => {
                  const clinicUsers = users.filter((u: User) => u.clinicId === c.id);
                  const endDate = c.subscriptionEnd ? new Date(c.subscriptionEnd) : null;
                  const daysLeft = endDate ? Math.floor((endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;
                  const isExpiring = daysLeft !== null && daysLeft <= 7 && daysLeft >= 0;
                  const isExpired = daysLeft !== null && daysLeft < 0;
                  return (
                    <motion.tr
                      key={c.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="border-b border-bdr-subtle/50"
                    >
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-txt-primary mb-1">{c.name}</div>
                        <div className="text-xs text-txt-muted">Город: {c.city || '—'}</div>
                        <div className="text-xs text-txt-muted">Сотрудников: {clinicUsers.length}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-txt-secondary">
                        <div>{c.phone || '—'}</div>
                        <div>{c.email || '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          size="sm"
                          className={PLAN_BADGE_CLASSES[c.plan || ''] || PLAN_BADGE_CLASSES.default}
                        >
                          {PLANS[c.plan || '']?.name || c.plan}
                        </Badge>
                        <div className="mt-1.5">
                          <Select
                            value={c.plan || ''}
                            onChange={(e) => changePlan(c.id, e.target.value)}
                            options={Object.entries(PLANS).map(([k, v]) => ({ value: k, label: v.name }))}
                            className="w-auto min-w-[100px] h-7 text-xs px-2"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {endDate && (
                          <div>
                            <div className={`text-xs font-medium mb-1 ${isExpired ? 'text-error' : isExpiring ? 'text-warning' : 'text-txt-muted'}`}>
                              {isExpired ? <span className="inline-flex items-center gap-1"><Ban size={12} /> Истекла</span>
                                : isExpiring ? <span className="inline-flex items-center gap-1"><AlertTriangle size={12} /> {daysLeft} дн.</span>
                                : <span className="inline-flex items-center gap-1"><CheckCircle size={12} /> {daysLeft} дн.</span>}
                            </div>
                            <div className="text-xs text-txt-muted mb-1.5">{fd(c.subscriptionEnd)}</div>
                            <div className="flex gap-1">
                              <Button size="xs" variant="ghost" onClick={() => extendSubscription(c.id, 1)}>+1 мес.</Button>
                              <Button size="xs" variant="ghost" onClick={() => extendSubscription(c.id, 3)}>+3 мес.</Button>
                            </div>
                          </div>
                        )}
                        {!endDate && <span className="text-xs text-txt-muted">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={c.active ? 'success' : 'error'} size="sm" dot>
                          {c.active ? 'Активна' : 'Заблокирована'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 flex-wrap">
                          <Button size="icon-sm" variant="ghost" onClick={() => openEdit(c)} title="Редактировать">
                            <Pencil size={14} />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant={c.active ? 'danger' : 'outline'}
                            onClick={() => toggleActive(c.id)}
                            title={c.active ? 'Заблокировать' : 'Разблокировать'}
                          >
                            {c.active ? <Ban size={14} /> : <CheckCircle size={14} />}
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => {
                              const director = clinicUsers.find((u: User) => u.role === 'director');
                              if (director) openResetPassword(director);
                              else showToast('Нет директора у этой клиники', 'warning');
                            }}
                            title="Сбросить пароль директору"
                          >
                            <KeyRound size={14} />
                          </Button>
                          <Button size="icon-sm" variant="danger" onClick={() => openDelete(c)} title="Удалить клинику">
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editClinic ? 'Редактировать клинику' : 'Новая клиника'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Название клиники *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Город" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
            <Input label="Телефон" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <Input label="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} type="email" />
          <Input label="Адрес" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Тарифный план" value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value })} options={Object.entries(PLANS).map(([k, v]) => ({ value: k, label: `${v.name} (${v.price})` }))} />
            <Select label="Статус" value={form.active ? 'active' : 'blocked'} onChange={e => setForm({ ...form, active: e.target.value === 'active' })} options={[{ value: 'active', label: 'Активна' }, { value: 'blocked', label: 'Заблокирована' }]} />
          </div>
          <div className="bg-dv-gold/5 border border-dv-gold/20 rounded-lg p-3 text-sm text-txt-secondary">
            <strong className="flex items-center gap-1.5 mb-1"><Info size={14} /> При создании:</strong>
            будет автоматически создан аккаунт директора с логином «admin_&lt;название&gt;» и временным паролем
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1">{editClinic ? 'Сохранить' : 'Создать клинику'}</Button>
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Отмена</Button>
          </div>
        </form>
      </Modal>

      <Modal open={resetModalOpen && !!resetUser} onClose={() => setResetModalOpen(false)} title={`Сброс пароля: ${resetUser?.name}`}>
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="text-sm text-txt-secondary">
            Логин: <strong className="text-txt-primary font-mono">{resetUser?.login}</strong>
          </div>
          <Input label="Новый пароль *" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Минимум 6 символов" required />
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1">Сбросить пароль</Button>
            <Button type="button" variant="ghost" onClick={() => setResetModalOpen(false)}>Отмена</Button>
          </div>
        </form>
      </Modal>

      <Modal open={deleteModalOpen && !!clinicToDelete} onClose={() => setDeleteModalOpen(false)} title="Удаление клиники" size="sm">
        <AlertTriangle size={20} className="text-warning mb-3" />
        <div className="text-sm text-txt-secondary mb-6">
          Вы действительно хотите удалить клинику <strong className="text-txt-primary">{clinicToDelete?.name}</strong>?
          <br /><br />
          Это действие необратимо. Все данные клиники (пациенты, записи, сотрудники) будут удалены.
        </div>
        <div className="flex gap-2">
          <Button variant="danger" className="flex-1" onClick={handleDelete}>Удалить</Button>
          <Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>Отмена</Button>
        </div>
      </Modal>
    </motion.div>
  );
}
