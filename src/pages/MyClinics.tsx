import React, { useState, useEffect } from 'react';
import { ListSkeleton } from '@/components/ui/ds';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Plus, LogIn, FlaskConical, Building2, QrCode, Link2, KeyRound,
  CheckCircle2, ArrowRight, Sparkles, Loader2, Crown, ChevronRight,
} from 'lucide-react';
import { tintedAccent } from '@/lib/utils';
import { useAuth } from '@/store/auth.store';
import { useToast } from '@/components/ui/ds/Toast';
import * as api from '@/utils/api';
import { Input } from '@/components/ui/ds/Input';
import { Button } from '@/components/ui/ds/Button';
import { Modal } from '@/components/ui/ds/Modal';
import { PageHeader } from '@/components/ui/ds/StatCard';
import { GLOBAL_CSS } from '@/utils/constants';

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4 } }) };

export default function MyClinics() {
  const { user, clinics, activeMembership, switchClinic } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', city: '', country: 'Казахстан', address: '', phone: '', type: 'clinic', plan: 'starter' });
  const [joinCode, setJoinCode] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'join' | 'demo'>('list');

  useEffect(() => {
    // clinics already loaded via AuthContext; just stop spinner
    setLoading(false);
  }, []);

  const handleCreate = async () => {
    if (!createForm.name.trim()) { toast.error('Введите название'); return; }
    setCreating(true);
    try {
      const res = await api.createClinic(createForm);
      await switchClinic(res.clinic?.id || null);
      toast.success('Клиника создана!');
      navigate('/crm/schedule');
    } catch { toast.error('Не удалось создать клинику'); }
    finally { setCreating(false); }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) { toast.error('Введите код приглашения'); return; }
    setJoining(true);
    try {
      // First lookup the invitation by code
      const invite = await api.lookupInvitation(joinCode.trim());
      if (!invite?.clinicId) throw new Error('Приглашение недействительно');
      // Then join using the clinicId from the invitation
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
      toast.success('Демо-клиника готова! Добро пожаловать в DentVision');
      navigate('/crm/schedule');
    } catch (e: any) { toast.error(e?.message || 'Не удалось создать демо-клинику'); }
    finally { setDemoLoading(false); }
  };

  if (loading) return (
    <div className="dv-page py-6"><ListSkeleton count={3} /></div>
  );

  const enterClinic = async (clinicId: string) => {
    await switchClinic(clinicId);
    navigate('/crm/schedule');
  };

  return (
    <div className="min-h-screen bg-surface-0 p-6 relative max-w-full overflow-x-hidden">
      <style>{GLOBAL_CSS}</style>
      <div className="absolute w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(201,169,110,0.06)_0%,transparent_70%)] -top-32 -right-32 pointer-events-none" />

      <div className="max-w-[760px] mx-auto relative z-10 space-y-8">
        <PageHeader
          title="Мои клиники"
          subtitle={`${user?.name ? `${user.name}, ` : ''}выберите рабочее пространство или создайте новое`}
          icon={<Building2 size={22} />}
        />

        {clinics.length > 0 && (
          <div>
            <h2 className="text-xs uppercase tracking-[0.08em] text-txt-muted mb-3">Ваши организации</h2>
            <div className="space-y-2.5">
              {clinics.map((m, i) => (
                <motion.button
                  key={m.id}
                  custom={i}
                  initial="hidden" animate="visible" variants={fadeUp}
                  onClick={() => enterClinic(m.clinicId)}
                  className="w-full flex items-center gap-4 p-4 min-h-11 bg-surface-1 border border-bdr-subtle rounded-[14px] hover:border-dv-gold/40 transition-all text-left cursor-pointer"
                >
                  {/* The clinic picks its own accent, so this one is data, not
                      a hardcoded palette; the fallback is the brand token, and
                      the tint is mixed rather than concatenated so a `var()`
                      fallback stays valid CSS. */}
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold shrink-0"
                    style={tintedAccent(m.clinic?.color, 13)}>
                    {(m.clinic?.name || '?').slice(0, 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-txt-primary m-0 truncate">{m.clinic?.name}</p>
                    <p className="text-xs text-txt-muted m-0">{m.clinic?.city}{m.clinic?.city && (m.clinic as any)?.type ? ' · ' : ''}{(m.clinic as any)?.type === 'clinic' ? 'Клиника' : (m.clinic as any)?.type}</p>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-surface-2 text-dv-gold font-semibold shrink-0">
                    {m.role === 'owner' ? <><Crown size={11} className="inline mr-1" />Владелец</> : m.role}
                  </span>
                  {activeMembership?.clinicId === m.clinicId && <CheckCircle2 size={16} className="text-success shrink-0" />}
                  <ChevronRight size={18} className="text-txt-muted shrink-0" />
                </motion.button>
              ))}
            </div>
          </div>
        )}

        <div>
        <h2 className="text-xs uppercase tracking-[0.08em] text-txt-muted mb-3">Действия</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <ActionCard
            icon={<Plus size={22} />}
            title="Создать клинику"
            desc="Для владельцев бизнеса"
            tone="gold"
            onClick={() => setActiveTab('create')}
          />
          <ActionCard
            icon={<LogIn size={22} />}
            title="Присоединиться"
            desc="По коду приглашения"
            tone="info"
            onClick={() => setActiveTab('join')}
          />
          <ActionCard
            icon={<FlaskConical size={22} />}
            title="Попробовать демо"
            desc="Временный доступ"
            tone="success"
            onClick={handleDemo}
            loading={demoLoading}
          />
          <ActionCard
            icon={<ArrowRight size={22} />}
            title="Продолжить без клиники"
            desc="Личный режим"
            tone="purple"
            onClick={() => navigate('/')}
          />
        </div>
        </div>

        <div className="p-4 bg-surface-1 border border-bdr-subtle rounded-xl flex flex-wrap items-start gap-3">
          <Sparkles size={18} className="text-dv-gold mt-0.5 shrink-0" />
          <p className="text-xs text-txt-secondary leading-relaxed m-0">
            Не хотите создавать клинику? Вы уже можете пользоваться <span className="text-dv-gold">Магазином</span>, <span className="text-dv-gold">Академией</span> и <span className="text-dv-gold">AI-ассистентом</span> в личном режиме. CRM активируется только после выбора рабочего пространства.
          </p>
        </div>
      </div>

      {/* Create modal */}
      <Modal open={activeTab === 'create'} onClose={() => setActiveTab('list')} title="Создание клиники" className="w-full max-w-full sm:max-w-md md:max-w-lg lg:max-w-xl">
        <div className="space-y-3">
          <Input label="Название клиники *" value={createForm.name} onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="Стоматология «Улыбка»" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Город" value={createForm.city} onChange={(e) => setCreateForm(f => ({ ...f, city: e.target.value }))} placeholder="Алматы" />
            <Input label="Страна" value={createForm.country} onChange={(e) => setCreateForm(f => ({ ...f, country: e.target.value }))} placeholder="Казахстан" />
          </div>
          <Input label="Адрес" value={createForm.address} onChange={(e) => setCreateForm(f => ({ ...f, address: e.target.value }))} placeholder="ул. Абая 10" />
          <Input label="Телефон" value={createForm.phone} onChange={(e) => setCreateForm(f => ({ ...f, phone: e.target.value }))} placeholder="+7 777 000 00 00" />
          <div className="flex flex-wrap gap-3 pt-2">
            <Button variant="ghost" onClick={() => setActiveTab('list')}>Отмена</Button>
            <Button variant="primary" loading={creating} onClick={handleCreate} icon={<Building2 size={15} />}>
              Создать клинику
            </Button>
          </div>
        </div>
      </Modal>

      {/* Join modal */}
      <Modal open={activeTab === 'join'} onClose={() => setActiveTab('list')} title="Присоединиться к клинике" className="w-full max-w-full sm:max-w-md md:max-w-lg lg:max-w-xl">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-txt-secondary mb-1.5 block">Код приглашения</label>
            <div className="flex gap-2">
              <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="ABCD-1234" icon={<KeyRound size={15} />} />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-txt-muted">
            <QrCode size={14} /> <Link2 size={14} /> Также можно присоединиться по ссылке-приглашению
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button variant="ghost" onClick={() => setActiveTab('list')}>Отмена</Button>
            <Button variant="primary" loading={joining} onClick={handleJoin} icon={<LogIn size={15} />}>
              Присоединиться
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/**
 * Four unrelated entry points, so the tiles differ by hue — but from the token
 * set, not four ad-hoc hexes. `#3498DB` was not even the `info` token
 * (`#2980B9`), so the page shipped a fifth blue nobody had chosen.
 */
const ACTION_TONES = {
  gold: 'bg-dv-gold/15 text-dv-gold',
  info: 'bg-info/15 text-info',
  success: 'bg-success/15 text-success',
  purple: 'bg-accent-purple/15 text-accent-purple',
} as const

function ActionCard({ icon, title, desc, tone, onClick, loading }: { icon: React.ReactNode; title: string; desc: string; tone: keyof typeof ACTION_TONES; onClick: () => void; loading?: boolean }) {
  return (
    <motion.button
      whileHover={{ y: -3 }}
      disabled={loading}
      onClick={onClick}
      className="p-5 min-h-11 bg-surface-1 border border-bdr-subtle rounded-[14px] text-left cursor-pointer hover:border-dv-gold/40 transition-all flex flex-col gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${ACTION_TONES[tone]}`}>{icon}</div>
      <div>
        <p className="text-sm font-bold text-txt-primary m-0">{title}</p>
        <p className="text-xs text-txt-muted m-0 mt-0.5">{desc}</p>
      </div>
      <ArrowRight size={15} className="text-txt-muted self-end" />
    </motion.button>
  );
}
