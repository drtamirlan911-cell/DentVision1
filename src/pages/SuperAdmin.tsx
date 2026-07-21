import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, CheckCircle, Ban, AlertTriangle, Users, Banknote, Pencil,
  KeyRound, Trash2, Plus, Shield, UserPlus, Eye, EyeOff, Copy, RefreshCw,
  Search, LifeBuoy, Headphones, UserCheck,
} from 'lucide-react';
import { useToast } from '@/components/ui/ds/Toast';
import { Button } from '../components/ui/ds/Button';
import { Card } from '../components/ui/ds/Card';
import { Input, Select } from '../components/ui/ds/Input';
import { Badge } from '../components/ui/ds/Badge';
import { Modal } from '../components/ui/ds/Modal';
import { StatCard, PageHeader } from '../components/ui/ds/StatCard';
import { tg, fd } from '../utils/constants';
import * as api from '@/utils/api';
import { queryKeys } from '@/queries/keys';
import { useAuth } from '@/store/auth.store';

const PLANS: Record<string, { name: string; price: string }> = {
  starter: { name: 'Starter', price: '15 000 ₸' },
  pro: { name: 'Pro', price: '35 000 ₸' },
  enterprise: { name: 'Enterprise', price: '150 000 ₸' },
};

const PLAN_BADGE: Record<string, string> = {
  starter: 'bg-[#4e8cff]/10 text-[#4e8cff] border-[#4e8cff]/20',
  pro: 'bg-dv-gold/10 text-dv-gold border-dv-gold/20',
  enterprise: 'bg-[#9b5de5]/10 text-[#9b5de5] border-[#9b5de5]/20',
};

type Tab = 'clinics' | 'users' | 'support';

export default function SuperAdmin() {
  const { showToast } = useToast();
  const qc = useQueryClient();
  const platformRole = useAuth(s => s.user?.platformRole);
  const userRole = useAuth(s => s.user?.role);

  const [tab, setTab] = useState<Tab>('clinics');
  const [search, setSearch] = useState('');

  const stats = useQuery({ queryKey: queryKeys.admin.stats, queryFn: api.getAdminStats, staleTime: 30_000 });
  const clinics = useQuery({ queryKey: queryKeys.admin.clinics, queryFn: api.getAdminClinics, staleTime: 30_000 });
  const users = useQuery({ queryKey: queryKeys.admin.users(), queryFn: () => api.getAdminUsers(), staleTime: 30_000 });
  const support = useQuery({ queryKey: queryKeys.admin.support, queryFn: api.getAdminSupport, staleTime: 30_000 });

  const [clinicModal, setClinicModal] = useState<false | 'create' | 'edit'>(false);
  const [editClinic, setEditClinic] = useState<any>(null);
  const [clinicForm, setClinicForm] = useState({ name: '', city: '', phone: '', email: '', address: '', plan: 'starter' });
  const [deleteModal, setDeleteModal] = useState<any>(null);
  const [pwModal, setPwModal] = useState<any>(null);
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [userModal, setUserModal] = useState(false);
  const [userForm, setUserForm] = useState({ login: '', name: '', email: '', role: 'doctor', clinicId: '', password: '' });
  const [newUserPw, setNewUserPw] = useState<string | null>(null);
  const [supportModal, setSupportModal] = useState(false);
  const [supportForm, setSupportForm] = useState({ login: '', name: '', email: '', password: '' });
  const [newSupportPw, setNewSupportPw] = useState<string | null>(null);

  const createClinic = useMutation({
    mutationFn: api.createAdminClinic,
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.clinics });
      qc.invalidateQueries({ queryKey: queryKeys.admin.stats });
      showToast(`Клиника создана. Директор: ${d.directorLogin}, пароль: ${d.tempPassword}`, 'success');
      setClinicModal(false);
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const updateClinic = useMutation({
    mutationFn: ({ id, ...rest }: any) => api.updateAdminClinic(id, rest),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.admin.clinics }); showToast('Клиника обновлена', 'success'); setClinicModal(false); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const toggleClinic = useMutation({
    mutationFn: api.toggleAdminClinic,
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.admin.clinics }); showToast('Статус обновлён', 'info'); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const changePlan = useMutation({
    mutationFn: ({ id, plan }: any) => api.changeAdminClinicPlan(id, plan),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.admin.clinics }); showToast('Тариф изменён', 'success'); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const extendSub = useMutation({
    mutationFn: ({ id, months }: any) => api.extendAdminClinic(id, months),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.admin.clinics }); showToast('Подписка продлена', 'success'); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const deleteClinic = useMutation({
    mutationFn: api.deleteAdminClinic,
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.admin.clinics }); qc.invalidateQueries({ queryKey: queryKeys.admin.stats }); showToast('Клиника удалена', 'success'); setDeleteModal(null); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const resetPw = useMutation({
    mutationFn: ({ id, password }: any) => api.resetAdminUserPassword(id, password),
    onSuccess: () => { showToast('Пароль сброшен', 'success'); setPwModal(null); setPw(''); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const createUser = useMutation({
    mutationFn: api.createAdminUser,
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.users() });
      showToast('Пользователь создан', 'success');
      if (d.tempPassword) setNewUserPw(d.tempPassword);
      setUserModal(false);
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const deleteUser = useMutation({
    mutationFn: api.deleteAdminUser,
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.admin.users() }); showToast('Пользователь удалён', 'success'); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const createSupport = useMutation({
    mutationFn: api.createAdminSupport,
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.support });
      showToast('Ассистент создан', 'success');
      if (d.tempPassword) setNewSupportPw(d.tempPassword);
      setSupportModal(false);
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const deleteSupport = useMutation({
    mutationFn: api.deleteAdminSupport,
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.admin.support }); showToast('Ассистент удалён', 'success'); },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  if (platformRole !== 'superadmin' && userRole !== 'superadmin') {
    return <Navigate to="/" replace />;
  }

  const s = stats.data;
  const clinicList = clinics.data || [];
  const userList = users.data || [];
  const supportList = support.data || [];

  const filteredClinics = clinicList.filter((c: any) => !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.city?.toLowerCase().includes(search.toLowerCase()));
  const filteredUsers = userList.filter((u: any) => !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.login?.toLowerCase().includes(search.toLowerCase()));
  const filteredSupport = supportList.filter((u: any) => !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.login?.toLowerCase().includes(search.toLowerCase()));

  const TABS: { id: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'clinics', label: 'Клиники', icon: <Building2 size={16} />, count: clinicList.length },
    { id: 'users', label: 'Пользователи', icon: <Users size={16} />, count: userList.length },
    { id: 'support', label: 'Поддержка', icon: <LifeBuoy size={16} />, count: supportList.length },
  ];

  const copyToClip = (text: string) => { navigator.clipboard?.writeText(text); showToast('Скопировано', 'info'); };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="p-6 space-y-6">
      <PageHeader
        title="Управление платформой"
        subtitle="DentVision Platform Admin"
        icon={<Shield size={20} />}
        actions={<Button icon={<RefreshCw size={16} />} variant="ghost" onClick={() => { qc.invalidateQueries({ queryKey: queryKeys.admin.stats }); qc.invalidateQueries({ queryKey: queryKeys.admin.clinics }); qc.invalidateQueries({ queryKey: queryKeys.admin.users() }); qc.invalidateQueries({ queryKey: queryKeys.admin.support }); }}>Обновить</Button>}
      />

      {s && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <StatCard label="Клиник" value={s.totalClinics} icon={<Building2 size={18} />} />
          <StatCard label="Активных" value={s.activeClinics} icon={<CheckCircle size={18} />} />
          <StatCard label="Заблокировано" value={s.blockedClinics} icon={<Ban size={18} />} />
          <StatCard label="Истекают" value={s.expiringSoon} icon={<AlertTriangle size={18} />} />
          <StatCard label="Пользователей" value={s.totalUsers} icon={<Users size={18} />} />
          <StatCard label="MRR" value={tg(s.mrr)} icon={<Banknote size={18} />} />
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-1 bg-surface-2 rounded-lg p-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setSearch(''); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t.id ? 'bg-surface-1 text-txt-primary shadow-sm' : 'text-txt-muted hover:text-txt-secondary'}`}>
              {t.icon}{t.label}<Badge size="xs" className="ml-1">{t.count}</Badge>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-txt-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск..."
              className="pl-8 pr-3 py-1.5 rounded-lg bg-surface-2 border border-bdr-subtle text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-1 focus:ring-dv-gold/50 w-56" />
          </div>
          {tab === 'clinics' && <Button icon={<Plus size={16} />} onClick={() => { setEditClinic(null); setClinicForm({ name: '', city: '', phone: '', email: '', address: '', plan: 'starter' }); setClinicModal('create'); }}>Клиника</Button>}
          {tab === 'users' && <Button icon={<UserPlus size={16} />} onClick={() => { setUserForm({ login: '', name: '', email: '', role: 'doctor', clinicId: '', password: '' }); setUserModal(true); }}>Пользователь</Button>}
          {tab === 'support' && <Button icon={<Headphones size={16} />} onClick={() => { setSupportForm({ login: '', name: '', email: '', password: '' }); setSupportModal(true); }}>Ассистент</Button>}
        </div>
      </div>

      {tab === 'clinics' && (
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
                  {filteredClinics.map((c: any) => {
                    const sub = c.subscription;
                    const endDate = sub?.endDate ? new Date(sub.endDate) : null;
                    const daysLeft = endDate ? Math.floor((endDate.getTime() - Date.now()) / 86400000) : null;
                    const isExpiring = daysLeft !== null && daysLeft <= 7 && daysLeft >= 0;
                    const isExpired = daysLeft !== null && daysLeft < 0;
                    return (
                      <motion.tr key={c.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="border-b border-bdr-subtle/50">
                        <td className="px-4 py-3">
                          <div className="text-sm font-semibold text-txt-primary">{c.name}</div>
                          <div className="text-xs text-txt-muted">{c.city || '—'} · {c._count?.memberships ?? 0} сотр. · {c._count?.patients ?? 0} пациен.</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-txt-secondary">
                          <div>{c.phone || '—'}</div><div className="text-xs text-txt-muted">{c.email || '—'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge size="sm" className={PLAN_BADGE[c.plan || '']}>{PLANS[c.plan]?.name || c.plan}</Badge>
                          <div className="mt-1">
                            <Select value={c.plan || ''} onChange={e => changePlan.mutate({ id: c.id, plan: e.target.value })}
                              options={Object.entries(PLANS).map(([k, v]) => ({ value: k, label: v.name }))} className="w-auto min-w-[90px] h-7 text-xs px-2" />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {endDate ? (
                            <div>
                              <div className={`text-xs font-medium ${isExpired ? 'text-error' : isExpiring ? 'text-warning' : 'text-txt-muted'}`}>
                                {isExpired ? 'Истекла' : isExpiring ? `${daysLeft} дн.` : `${daysLeft} дн.`}
                              </div>
                              <div className="text-xs text-txt-muted mb-1">{fd(sub.endDate)}</div>
                              <div className="flex gap-1">
                                <Button size="xs" variant="ghost" onClick={() => extendSub.mutate({ id: c.id, months: 1 })}>+1</Button>
                                <Button size="xs" variant="ghost" onClick={() => extendSub.mutate({ id: c.id, months: 3 })}>+3</Button>
                              </div>
                            </div>
                          ) : <span className="text-xs text-txt-muted">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={c.active ? 'success' : 'error'} size="sm" dot>{c.active ? 'Активна' : 'Заблокирована'}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <Button size="icon-sm" variant="ghost" onClick={() => { setEditClinic(c); setClinicForm({ name: c.name, city: c.city || '', phone: c.phone || '', email: c.email || '', address: c.address || '', plan: c.plan || 'starter' }); setClinicModal('edit'); }} title="Ред."><Pencil size={14} /></Button>
                            <Button size="icon-sm" variant={c.active ? 'danger' : 'outline'} onClick={() => toggleClinic.mutate(c.id)} title={c.active ? 'Заблок.' : 'Разблок.'}>
                              {c.active ? <Ban size={14} /> : <CheckCircle size={14} />}
                            </Button>
                            <Button size="icon-sm" variant="ghost" onClick={() => { setPwModal(c); setPw(''); }} title="Сброс пароля"><KeyRound size={14} /></Button>
                            <Button size="icon-sm" variant="danger" onClick={() => setDeleteModal(c)} title="Удалить"><Trash2 size={14} /></Button>
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
      )}

      {tab === 'users' && (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-bdr-subtle">
                  {['Пользователь', 'Логин', 'Роль', 'Клиника', 'Действия'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-txt-muted uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u: any) => (
                  <tr key={u.id} className="border-b border-bdr-subtle/50">
                    <td className="px-4 py-3"><div className="text-sm font-semibold text-txt-primary">{u.name}</div><div className="text-xs text-txt-muted">{u.email || '—'}</div></td>
                    <td className="px-4 py-3 text-sm font-mono text-txt-secondary">{u.login}</td>
                    <td className="px-4 py-3"><Badge size="sm">{u.role}</Badge></td>
                    <td className="px-4 py-3 text-sm text-txt-muted">{u.clinicId || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button size="icon-sm" variant="ghost" onClick={() => { setPwModal(u); setPw(''); }}><KeyRound size={14} /></Button>
                        <Button size="icon-sm" variant="danger" onClick={() => { if (confirm(`Удалить ${u.name}?`)) deleteUser.mutate(u.id); }}><Trash2 size={14} /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'support' && (
        <div className="space-y-4">
          <Card padding="sm">
            <div className="flex items-center gap-2 mb-1">
              <LifeBuoy size={16} className="text-dv-gold" />
              <h3 className="text-sm font-semibold text-txt-primary">Ассистенты платформы</h3>
            </div>
            <p className="text-xs text-txt-muted">Пользователи с ролью поддержки — помогают управлять сервисом, обрабатывают заявки, следят за здоровьем платформы.</p>
          </Card>
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-bdr-subtle">
                    {['Ассистент', 'Логин', 'Email', 'Создан', 'Действия'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold text-txt-muted uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSupport.map((u: any) => (
                    <tr key={u.id} className="border-b border-bdr-subtle/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-dv-gold/10 flex items-center justify-center text-dv-gold"><Headphones size={14} /></div>
                          <div><div className="text-sm font-semibold text-txt-primary">{u.name}</div><Badge size="xs" className="mt-0.5">{u.platformRole}</Badge></div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-txt-secondary">{u.login}</td>
                      <td className="px-4 py-3 text-sm text-txt-muted">{u.email || '—'}</td>
                      <td className="px-4 py-3 text-xs text-txt-muted">{u.createdAt ? fd(u.createdAt) : '—'}</td>
                      <td className="px-4 py-3">
                        <Button size="icon-sm" variant="danger" onClick={() => { if (confirm(`Удалить ассистента ${u.name}?`)) deleteSupport.mutate(u.id); }}><Trash2 size={14} /></Button>
                      </td>
                    </tr>
                  ))}
                  {filteredSupport.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-txt-muted text-sm">Нет ассистентов. Нажмите "Ассистент" чтобы добавить.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ═══ MODALS ═══ */}
      <Modal open={!!clinicModal} onClose={() => setClinicModal(false)} title={clinicModal === 'edit' ? 'Редактировать клинику' : 'Новая клиника'}>
        <form onSubmit={e => { e.preventDefault(); if (!clinicForm.name.trim()) { showToast('Введите название', 'warning'); return; } if (clinicModal === 'edit' && editClinic) updateClinic.mutate({ id: editClinic.id, ...clinicForm }); else createClinic.mutate(clinicForm); }} className="space-y-4">
          <Input label="Название *" value={clinicForm.name} onChange={e => setClinicForm({ ...clinicForm, name: e.target.value })} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Город" value={clinicForm.city} onChange={e => setClinicForm({ ...clinicForm, city: e.target.value })} />
            <Input label="Телефон" value={clinicForm.phone} onChange={e => setClinicForm({ ...clinicForm, phone: e.target.value })} />
          </div>
          <Input label="Email" value={clinicForm.email} onChange={e => setClinicForm({ ...clinicForm, email: e.target.value })} type="email" />
          <Input label="Адрес" value={clinicForm.address} onChange={e => setClinicForm({ ...clinicForm, address: e.target.value })} />
          {clinicModal === 'create' && (
            <Select label="Тариф" value={clinicForm.plan} onChange={e => setClinicForm({ ...clinicForm, plan: e.target.value })}
              options={Object.entries(PLANS).map(([k, v]) => ({ value: k, label: `${v.name} (${v.price})` }))} />
          )}
          {clinicModal === 'create' && (
            <div className="bg-dv-gold/5 border border-dv-gold/20 rounded-lg p-3 text-xs text-txt-secondary">
              Будет создан аккаунт директора с логином <code>admin_&lt;slug&gt;</code> и временным паролем.
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button type="submit" loading={createClinic.isPending || updateClinic.isPending}>{clinicModal === 'edit' ? 'Сохранить' : 'Создать клинику'}</Button>
            <Button type="button" variant="ghost" onClick={() => setClinicModal(false)}>Отмена</Button>
          </div>
        </form>
      </Modal>

      <Modal open={userModal} onClose={() => { setUserModal(false); setNewUserPw(null); }} title="Новый пользователь">
        {newUserPw ? (
          <div className="space-y-4">
            <div className="bg-success/10 border border-success/20 rounded-lg p-4 text-center">
              <UserCheck size={24} className="mx-auto text-success mb-2" />
              <p className="text-sm text-txt-primary font-medium">Пользователь создан!</p>
              <p className="text-xs text-txt-muted mt-1">Пароль:</p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <code className="text-lg font-mono text-dv-gold bg-surface-2 px-3 py-1 rounded">{newUserPw}</code>
                <Button size="icon-sm" variant="ghost" onClick={() => copyToClip(newUserPw)}><Copy size={14} /></Button>
              </div>
            </div>
            <Button className="w-full" onClick={() => setNewUserPw(null)}>Готово</Button>
          </div>
        ) : (
          <form onSubmit={e => { e.preventDefault(); if (!userForm.login.trim() || !userForm.name.trim()) { showToast('Логин и имя обязательны', 'warning'); return; } createUser.mutate(userForm); }} className="space-y-4">
            <Input label="Логин *" value={userForm.login} onChange={e => setUserForm({ ...userForm, login: e.target.value })} required />
            <Input label="Имя *" value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} required />
            <Input label="Email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} type="email" />
            <Select label="Роль" value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })}
              options={[{ value: 'doctor', label: 'Врач' }, { value: 'assistant', label: 'Ассистент' }, { value: 'admin', label: 'Администратор' }, { value: 'reception', label: 'Регистратор' }, { value: 'manager', label: 'Менеджер' }, { value: 'laboratory', label: 'Лаборант' }, { value: 'owner', label: 'Руководитель' }]} />
            <div className="flex gap-2 pt-2">
              <Button type="submit" loading={createUser.isPending}>Создать</Button>
              <Button type="button" variant="ghost" onClick={() => setUserModal(false)}>Отмена</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={supportModal} onClose={() => { setSupportModal(false); setNewSupportPw(null); }} title="Новый ассистент поддержки">
        {newSupportPw ? (
          <div className="space-y-4">
            <div className="bg-success/10 border border-success/20 rounded-lg p-4 text-center">
              <Headphones size={24} className="mx-auto text-success mb-2" />
              <p className="text-sm text-txt-primary font-medium">Ассистент создан!</p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <code className="text-lg font-mono text-dv-gold bg-surface-2 px-3 py-1 rounded">{newSupportPw}</code>
                <Button size="icon-sm" variant="ghost" onClick={() => copyToClip(newSupportPw)}><Copy size={14} /></Button>
              </div>
            </div>
            <Button className="w-full" onClick={() => setNewSupportPw(null)}>Готово</Button>
          </div>
        ) : (
          <form onSubmit={e => { e.preventDefault(); if (!supportForm.login.trim() || !supportForm.name.trim()) { showToast('Логин и имя обязательны', 'warning'); return; } createSupport.mutate(supportForm); }} className="space-y-4">
            <Input label="Логин *" value={supportForm.login} onChange={e => setSupportForm({ ...supportForm, login: e.target.value })} required />
            <Input label="Имя *" value={supportForm.name} onChange={e => setSupportForm({ ...supportForm, name: e.target.value })} required />
            <Input label="Email" value={supportForm.email} onChange={e => setSupportForm({ ...supportForm, email: e.target.value })} type="email" />
            <div className="bg-dv-gold/5 border border-dv-gold/20 rounded-lg p-3 text-xs text-txt-secondary">
              Ассистент получит роль <strong>support</strong> — доступ к аналитике, настройкам и управлению платформой.
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" loading={createSupport.isPending}>Создать</Button>
              <Button type="button" variant="ghost" onClick={() => setSupportModal(false)}>Отмена</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!pwModal} onClose={() => { setPwModal(null); setPw(''); }} title={`Сброс пароля: ${pwModal?.name || ''}`}>
        <form onSubmit={e => { e.preventDefault(); if (!pw || pw.length < 6) { showToast('Минимум 6 символов', 'warning'); return; } resetPw.mutate({ id: pwModal.id, password: pw }); }} className="space-y-4">
          <div className="text-sm text-txt-secondary">Логин: <strong className="text-txt-primary font-mono">{pwModal?.login}</strong></div>
          <div className="relative">
            <Input label="Новый пароль *" type={showPw ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} placeholder="Минимум 6 символов" required />
            <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-9 text-txt-muted hover:text-txt-primary">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" loading={resetPw.isPending}>Сбросить</Button>
            <Button type="button" variant="ghost" onClick={() => { setPwModal(null); setPw(''); }}>Отмена</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleteModal} onClose={() => setDeleteModal(null)} title="Удаление клиники" size="sm">
        <AlertTriangle size={20} className="text-warning mb-3" />
        <div className="text-sm text-txt-secondary mb-6">
          Удалить клинику <strong className="text-txt-primary">{deleteModal?.name}</strong>?<br /><br />
          Это действие необратимо. Все данные будут удалены.
        </div>
        <div className="flex gap-2">
          <Button variant="danger" className="flex-1" loading={deleteClinic.isPending} onClick={() => deleteClinic.mutate(deleteModal.id)}>Удалить</Button>
          <Button variant="ghost" onClick={() => setDeleteModal(null)}>Отмена</Button>
        </div>
      </Modal>
    </motion.div>
  );
}
