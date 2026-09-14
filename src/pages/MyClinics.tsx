import React, { useState, useEffect } from 'react';
import { ListSkeleton } from '@/components/ui/ds';
import { useNavigate, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Plus, LogIn, FlaskConical, Building2, QrCode, Link2, KeyRound,
  CheckCircle2, ArrowRight, Sparkles, Loader2, Crown, ChevronRight,
  GitBranch, MapPin, Power, Users,
} from 'lucide-react';
import { tintedAccent } from '@/lib/utils';
import { useAuth } from '@/store/auth.store';
import { useToast } from '@/components/ui/ds/Toast';
import * as api from '@/utils/api';
import { getClinicBranches, createClinicBranch, updateClinicBranch, type ClinicBranch } from '@/utils/branches';
import { Input } from '@/components/ui/ds/Input';
import { Button } from '@/components/ui/ds/Button';
import { Modal } from '@/components/ui/ds/Modal';
import { PageHeader } from '@/components/ui/ds/StatCard';
import { GLOBAL_CSS } from '@/utils/constants';

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4 } }) };

export default function MyClinics() {
  const { user, clinics, activeMembership, switchClinic, isAuthenticated, loading: authLoading } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [branchLoading, setBranchLoading] = useState(false);
  const [branches, setBranches] = useState<ClinicBranch[]>([]);
  const [branchModal, setBranchModal] = useState(false);
  const [branchForm, setBranchForm] = useState({ name: '', code: '', city: '', address: '', phone: '' });
  const [createForm, setCreateForm] = useState({ name: '', city: '', country: 'Казахстан', address: '', phone: '', type: 'clinic', plan: 'starter' });
  const [joinCode, setJoinCode] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'join' | 'demo'>('list');

  useEffect(() => { if (!authLoading) setLoading(false); }, [authLoading]);

  useEffect(() => {
    const clinicId = activeMembership?.clinicId;
    if (!clinicId) { setBranches([]); return; }
    let cancelled = false;
    setBranchLoading(true);
    getClinicBranches(clinicId)
      .then((rows) => { if (!cancelled) setBranches(rows); })
      .catch(() => { if (!cancelled) setBranches([]); })
      .finally(() => { if (!cancelled) setBranchLoading(false); });
    return () => { cancelled = true; };
  }, [activeMembership?.clinicId]);

  if (!authLoading && !isAuthenticated) {
    return <Navigate to="/login?role=doctor" replace state={{ from: { pathname: '/my-clinics' } }} />;
  }
  if (authLoading || loading) return <div className="dv-page py-6"><ListSkeleton count={3} /></div>;

  const canManageBranches = ['owner', 'admin'].includes(String(activeMembership?.role || user?.role || '').toLowerCase());

  const handleCreate = async () => {
    if (!createForm.name.trim()) { toast.error('Введите название'); return; }
    setCreating(true);
    try {
      const res = await api.createClinic(createForm);
      await switchClinic(res.clinic?.id || null);
      toast.success('Клиника создана');
      navigate('/crm/schedule');
    } catch { toast.error('Не удалось создать клинику'); }
    finally { setCreating(false); }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) { toast.error('Введите код приглашения'); return; }
    setJoining(true);
    try {
      const invite = await api.lookupInvitation(joinCode.trim());
      if (!invite?.clinicId) throw new Error('Приглашение недействительно');
      const res = await api.joinClinic({ code: joinCode.trim() });
      await switchClinic(res.clinic?.id || null);
      toast.success('Вы присоединились к организации');
      navigate('/crm/schedule');
    } catch (e: any) { toast.error(e?.message || 'Приглашение не найдено'); }
    finally { setJoining(false); }
  };

  const handleDemo = async () => {
    setDemoLoading(true);
    try {
      const res = await api.createDemoClinic();
      await switchClinic(res.clinic?.id || null);
      toast.success('Демо-клиника готова');
      navigate('/crm/schedule');
    } catch (e: any) { toast.error(e?.message || 'Не удалось создать демо-клинику'); }
    finally { setDemoLoading(false); }
  };

  const enterClinic = async (clinicId: string) => { await switchClinic(clinicId); };

  const handleCreateBranch = async () => {
    const clinicId = activeMembership?.clinicId;
    if (!clinicId || !branchForm.name.trim()) { toast.error('Название филиала обязательно'); return; }
    setBranchLoading(true);
    try {
      const branch = await createClinicBranch({ clinicId, ...branchForm });
      setBranches((current) => [...current, branch]);
      setBranchModal(false);
      setBranchForm({ name: '', code: '', city: '', address: '', phone: '' });
      toast.success('Филиал создан');
    } catch (e: any) { toast.error(e?.message || 'Не удалось создать филиал'); }
    finally { setBranchLoading(false); }
  };

  const toggleBranch = async (branch: ClinicBranch) => {
    try {
      const updated = await updateClinicBranch(branch.id, { active: !branch.active });
      setBranches((current) => current.map((item) => item.id === branch.id ? updated : item));
      toast.success(updated.active ? 'Филиал активирован' : 'Филиал отключён');
    } catch (e: any) { toast.error(e?.message || 'Не удалось изменить статус филиала'); }
  };

  return (
    <div className="min-h-screen bg-surface-0 p-6 relative max-w-full overflow-x-hidden">
      <style>{GLOBAL_CSS}</style>
      <div className="absolute w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(201,169,110,0.06)_0%,transparent_70%)] -top-32 -right-32 pointer-events-none" />
      <div className="max-w-[900px] mx-auto relative z-10 space-y-8">
        <PageHeader title="Мои клиники" subtitle={`${user?.name ? `${user.name}, ` : ''}рабочие пространства и филиалы`} icon={<Building2 size={22} />} />

        {clinics.length > 0 && <div>
          <h2 className="text-xs uppercase tracking-[0.08em] text-txt-muted mb-3">Ваши организации</h2>
          <div className="space-y-2.5">
            {clinics.map((m, i) => (
              <motion.button key={m.id} custom={i} initial="hidden" animate="visible" variants={fadeUp} onClick={() => enterClinic(m.clinicId)} className="w-full flex items-center gap-4 p-4 min-h-11 bg-surface-1 border border-bdr-subtle rounded-[14px] hover:border-dv-gold/40 transition-all text-left cursor-pointer">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold shrink-0" style={tintedAccent(m.clinic?.color, 13)}>{(m.clinic?.name || '?').slice(0, 1)}</div>
                <div className="flex-1 min-w-0"><p className="text-sm font-bold text-txt-primary m-0 truncate">{m.clinic?.name}</p><p className="text-xs text-txt-muted m-0">{m.clinic?.city}</p></div>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-surface-2 text-dv-gold font-semibold shrink-0">{m.role === 'owner' ? <><Crown size={11} className="inline mr-1" />Владелец</> : m.role}</span>
                {activeMembership?.clinicId === m.clinicId && <CheckCircle2 size={16} className="text-success shrink-0" />}
                <ChevronRight size={18} className="text-txt-muted shrink-0" />
              </motion.button>
            ))}
          </div>
        </div>}

        {activeMembership?.clinicId && <section className="bg-surface-1 border border-bdr-subtle rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div><div className="flex items-center gap-2"><GitBranch size={18} className="text-dv-gold" /><h2 className="text-base font-bold text-txt-primary m-0">Филиалы</h2></div><p className="text-xs text-txt-muted mt-1">Филиалы являются отдельным операционным scope внутри клиники.</p></div>
            {canManageBranches && <Button variant="primary" onClick={() => setBranchModal(true)} icon={<Plus size={15} />}>Добавить филиал</Button>}
          </div>
          {branchLoading ? <ListSkeleton count={2} /> : branches.length === 0 ? <div className="p-4 rounded-xl bg-surface-2 text-sm text-txt-muted">Филиалы ещё не созданы.</div> : <div className="space-y-2">
            {branches.map((branch) => <div key={branch.id} className="flex items-center gap-3 p-3 rounded-xl border border-bdr-subtle bg-surface-0">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-dv-gold/10 text-dv-gold"><GitBranch size={17} /></div>
              <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><p className="text-sm font-semibold text-txt-primary truncate m-0">{branch.name}</p>{branch.isDefault && <span className="text-[10px] px-1.5 py-0.5 rounded bg-dv-gold/10 text-dv-gold">Основной</span>}</div><p className="text-xs text-txt-muted m-0 mt-0.5">{branch.code}{branch.city ? ` · ${branch.city}` : ''}{branch.address ? ` · ${branch.address}` : ''}</p></div>
              <span className={`text-[10px] px-2 py-1 rounded-md ${branch.active ? 'bg-success/10 text-success' : 'bg-surface-2 text-txt-muted'}`}>{branch.active ? 'Активен' : 'Отключён'}</span>
              {canManageBranches && <button aria-label={branch.active ? `Отключить филиал ${branch.name}` : `Активировать филиал ${branch.name}`} title={branch.active ? 'Отключить филиал' : 'Активировать филиал'} onClick={() => toggleBranch(branch)} className="w-9 h-9 rounded-lg flex items-center justify-center bg-surface-2 text-txt-muted hover:text-txt-primary"><Power size={15} /></button>}
            </div>)}
          </div>}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-txt-muted"><div className="p-3 rounded-lg bg-surface-0 border border-bdr-subtle flex items-center gap-2"><MapPin size={14} /> {branches.length} филиал(ов)</div><div className="p-3 rounded-lg bg-surface-0 border border-bdr-subtle flex items-center gap-2"><Users size={14} /> Branch-scoped роли</div><div className="p-3 rounded-lg bg-surface-0 border border-bdr-subtle flex items-center gap-2"><Power size={14} /> Изоляция доступа</div></div>
        </section>}

        <div><h2 className="text-xs uppercase tracking-[0.08em] text-txt-muted mb-3">Действия</h2><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <ActionCard icon={<Plus size={22} />} title="Создать клинику" desc="Для владельцев бизнеса" tone="gold" onClick={() => setActiveTab('create')} />
          <ActionCard icon={<LogIn size={22} />} title="Присоединиться" desc="По коду приглашения" tone="info" onClick={() => setActiveTab('join')} />
          <ActionCard icon={<FlaskConical size={22} />} title="Попробовать демо" desc="Временный доступ" tone="success" onClick={handleDemo} loading={demoLoading} />
          <ActionCard icon={<ArrowRight size={22} />} title="Продолжить без клиники" desc="Личный режим" tone="purple" onClick={() => navigate('/')} />
        </div></div>

        <div className="p-4 bg-surface-1 border border-bdr-subtle rounded-xl flex flex-wrap items-start gap-3"><Sparkles size={18} className="text-dv-gold mt-0.5 shrink-0" /><p className="text-xs text-txt-secondary leading-relaxed m-0">CRM активируется после выбора рабочего пространства. Филиал теперь хранится как отдельная сущность и не является UI-заглушкой.</p></div>
      </div>

      <Modal open={activeTab === 'create'} onClose={() => setActiveTab('list')} title="Создание клиники" className="w-full max-w-full sm:max-w-md md:max-w-lg lg:max-w-xl"><div className="space-y-3"><Input label="Название клиники *" value={createForm.name} onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="Стоматология «Улыбка»" /><div className="grid grid-cols-2 gap-3"><Input label="Город" value={createForm.city} onChange={(e) => setCreateForm(f => ({ ...f, city: e.target.value }))} placeholder="Алматы" /><Input label="Страна" value={createForm.country} onChange={(e) => setCreateForm(f => ({ ...f, country: e.target.value }))} placeholder="Казахстан" /></div><Input label="Адрес" value={createForm.address} onChange={(e) => setCreateForm(f => ({ ...f, address: e.target.value }))} placeholder="ул. Абая 10" /><Input label="Телефон" value={createForm.phone} onChange={(e) => setCreateForm(f => ({ ...f, phone: e.target.value }))} placeholder="+7 777 000 00 00" /><div className="flex flex-wrap gap-3 pt-2"><Button variant="ghost" onClick={() => setActiveTab('list')}>Отмена</Button><Button variant="primary" loading={creating} onClick={handleCreate} icon={<Building2 size={15} />}>Создать клинику</Button></div></div></Modal>
      <Modal open={activeTab === 'join'} onClose={() => setActiveTab('list')} title="Присоединиться к клинике" className="w-full max-w-full sm:max-w-md md:max-w-lg lg:max-w-xl"><div className="space-y-3"><div><label className="text-xs text-txt-secondary mb-1.5 block">Код приглашения</label><Input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="ABCD-1234" icon={<KeyRound size={15} />} /></div><div className="flex items-center gap-2 text-xs text-txt-muted"><QrCode size={14} /><Link2 size={14} /> Также можно присоединиться по ссылке-приглашению</div><div className="flex flex-wrap gap-3 pt-2"><Button variant="ghost" onClick={() => setActiveTab('list')}>Отмена</Button><Button variant="primary" loading={joining} onClick={handleJoin} icon={<LogIn size={15} />}>Присоединиться</Button></div></div></Modal>
      <Modal open={branchModal} onClose={() => setBranchModal(false)} title="Новый филиал" className="w-full max-w-full sm:max-w-md md:max-w-lg"><div className="space-y-3"><Input label="Название филиала *" value={branchForm.name} onChange={(e) => setBranchForm(f => ({ ...f, name: e.target.value }))} placeholder="DentVision — Абая" /><Input label="Код" value={branchForm.code} onChange={(e) => setBranchForm(f => ({ ...f, code: e.target.value }))} placeholder="ABAYA" /><div className="grid grid-cols-2 gap-3"><Input label="Город" value={branchForm.city} onChange={(e) => setBranchForm(f => ({ ...f, city: e.target.value }))} placeholder="Тараз" /><Input label="Телефон" value={branchForm.phone} onChange={(e) => setBranchForm(f => ({ ...f, phone: e.target.value }))} placeholder="+7 777 000 00 00" /></div><Input label="Адрес" value={branchForm.address} onChange={(e) => setBranchForm(f => ({ ...f, address: e.target.value }))} placeholder="ул. Абая 10" /><div className="flex gap-3 pt-2"><Button variant="ghost" onClick={() => setBranchModal(false)}>Отмена</Button><Button variant="primary" loading={branchLoading} onClick={handleCreateBranch} icon={<GitBranch size={15} />}>Создать филиал</Button></div></div></Modal>
    </div>
  );
}

const ACTION_TONES = { gold: 'bg-dv-gold/15 text-dv-gold', info: 'bg-info/15 text-info', success: 'bg-success/15 text-success', purple: 'bg-accent-purple/15 text-accent-purple' } as const;
function ActionCard({ icon, title, desc, tone, onClick, loading }: { icon: React.ReactNode; title: string; desc: string; tone: keyof typeof ACTION_TONES; onClick: () => void; loading?: boolean }) {
  return <motion.button whileHover={{ y: -3 }} disabled={loading} onClick={onClick} className="p-5 min-h-11 bg-surface-1 border border-bdr-subtle rounded-[14px] text-left cursor-pointer hover:border-dv-gold/40 transition-all flex flex-col gap-2 disabled:opacity-60 disabled:cursor-not-allowed"><div className={`w-10 h-10 rounded-xl flex items-center justify-center ${ACTION_TONES[tone]}`}>{icon}</div><div><p className="text-sm font-bold text-txt-primary m-0">{title}</p><p className="text-xs text-txt-muted m-0 mt-0.5">{desc}</p></div><ArrowRight size={15} className="text-txt-muted self-end" /></motion.button>;
}
