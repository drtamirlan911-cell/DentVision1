import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Plus, LogIn, FlaskConical, Building2, Users, QrCode, Link2, KeyRound,
  CheckCircle2, ArrowRight, Sparkles, Loader2, Crown, ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/store/auth.store';
import { useToast } from '@/components/ui/ds/Toast';
import * as api from '@/utils/api';
import { Input } from '@/components/ui/ds/Input';
import { Button } from '@/components/ui/ds/Button';
import { Modal } from '@/components/ui/ds/Modal';
import { GLOBAL_CSS } from '@/utils/constants';

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4 } }) };

export default function MyClinics() {
  const { user, clinics, activeMembership, switchClinic } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
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
      const res = await api.joinClinic({ code: joinCode.trim() });
      await switchClinic(res.clinic?.id || null);
      toast.success('Вы присоединились к организации');
      navigate('/crm/schedule');
    } catch (e: any) { toast.error(e?.message || 'Приглашение не найдено'); }
    finally { setJoining(false); }
  };

  const handleDemo = async () => {
    toast.success('Демо-режим скоро будет доступен');
  };

  if (loading) return (
    <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-[#C9A96E]" /></div>
  );

  const enterClinic = async (clinicId: string) => {
    await switchClinic(clinicId);
    navigate('/crm/schedule');
  };

  return (
    <div className="min-h-screen bg-[#080F1A] p-6 relative overflow-hidden">
      <style>{GLOBAL_CSS}</style>
      <div className="absolute w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,#C9A96E05_0%,transparent_70%)] -top-32 -right-32 pointer-events-none" />

      <div className="max-w-[760px] mx-auto relative z-10">
        <div className="flex items-center gap-3 mb-1">
          <Building2 size={26} className="text-[#C9A96E]" />
          <h1 className="text-2xl font-bold text-white m-0">Мои клиники</h1>
        </div>
        <p className="text-sm text-[#7A8899] mb-6">
          {user?.name ? `${user.name}, ` : ''}выберите рабочее пространство или создайте новое
        </p>

        {clinics.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xs uppercase tracking-[0.08em] text-[#7A8899] mb-3">Ваши организации</h2>
            <div className="space-y-2.5">
              {clinics.map((m, i) => (
                <motion.button
                  key={m.id}
                  custom={i}
                  initial="hidden" animate="visible" variants={fadeUp}
                  onClick={() => enterClinic(m.clinicId)}
                  className="w-full flex items-center gap-4 p-4 bg-[#0D1B2E] border border-[rgba(255,255,255,0.06)] rounded-[14px] hover:border-[#C9A96E]/40 transition-all text-left cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold shrink-0"
                    style={{ background: (m.clinic?.color || '#C9A96E') + '22', color: m.clinic?.color || '#C9A96E' }}>
                    {(m.clinic?.name || '?').slice(0, 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white m-0 truncate">{m.clinic?.name}</p>
                    <p className="text-xs text-[#7A8899] m-0">{m.clinic?.city}{m.clinic?.city && m.clinic?.type ? ' · ' : ''}{m.clinic?.type === 'clinic' ? 'Клиника' : m.clinic?.type}</p>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.06] text-[#C9A96E] font-semibold shrink-0">
                    {m.role === 'owner' ? <><Crown size={11} className="inline mr-1" />Владелец</> : m.role}
                  </span>
                  {activeMembership?.clinicId === m.clinicId && <CheckCircle2 size={16} className="text-[#27AE60] shrink-0" />}
                  <ChevronRight size={18} className="text-[#7A8899] shrink-0" />
                </motion.button>
              ))}
            </div>
          </div>
        )}

        <h2 className="text-xs uppercase tracking-[0.08em] text-[#7A8899] mb-3">Действия</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ActionCard
            icon={<Plus size={22} />}
            title="Создать клинику"
            desc="Для владельцев бизнеса"
            color="#C9A96E"
            onClick={() => setActiveTab('create')}
          />
          <ActionCard
            icon={<LogIn size={22} />}
            title="Присоединиться"
            desc="По коду приглашения"
            color="#3498DB"
            onClick={() => setActiveTab('join')}
          />
          <ActionCard
            icon={<FlaskConical size={22} />}
            title="Попробовать демо"
            desc="Временный доступ"
            color="#27AE60"
            onClick={handleDemo}
          />
        </div>

        <div className="mt-8 p-4 bg-white/[0.03] border border-[rgba(255,255,255,0.06)] rounded-xl flex items-start gap-3">
          <Sparkles size={18} className="text-[#C9A96E] mt-0.5 shrink-0" />
          <p className="text-xs text-[#B0BEC5] leading-relaxed m-0">
            Не хотите создавать клинику? Вы уже можете пользоваться <span className="text-[#C9A96E]">Магазином</span>, <span className="text-[#C9A96E]">Академией</span> и <span className="text-[#C9A96E]">AI-ассистентом</span> в личном режиме. CRM активируется только после выбора рабочего пространства.
          </p>
        </div>
      </div>

      {/* Create modal */}
      <Modal open={activeTab === 'create'} onClose={() => setActiveTab('list')} title="Создание клиники">
        <div className="space-y-3">
          <Input label="Название клиники *" value={createForm.name} onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="Стоматология «Улыбка»" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Город" value={createForm.city} onChange={(e) => setCreateForm(f => ({ ...f, city: e.target.value }))} placeholder="Алматы" />
            <Input label="Страна" value={createForm.country} onChange={(e) => setCreateForm(f => ({ ...f, country: e.target.value }))} placeholder="Казахстан" />
          </div>
          <Input label="Адрес" value={createForm.address} onChange={(e) => setCreateForm(f => ({ ...f, address: e.target.value }))} placeholder="ул. Абая 10" />
          <Input label="Телефон" value={createForm.phone} onChange={(e) => setCreateForm(f => ({ ...f, phone: e.target.value }))} placeholder="+7 777 000 00 00" />
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={() => setActiveTab('list')}>Отмена</Button>
            <Button variant="primary" loading={creating} onClick={handleCreate} icon={<Building2 size={15} />}>
              Создать клинику
            </Button>
          </div>
        </div>
      </Modal>

      {/* Join modal */}
      <Modal open={activeTab === 'join'} onClose={() => setActiveTab('list')} title="Присоединиться к клинике">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-[#B0BEC5] mb-1.5 block">Код приглашения</label>
            <div className="flex gap-2">
              <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="ABCD-1234" icon={<KeyRound size={15} />} />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#7A8899]">
            <QrCode size={14} /> <Link2 size={14} /> Также можно присоединиться по ссылке-приглашению
          </div>
          <div className="flex gap-3 pt-2">
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

function ActionCard({ icon, title, desc, color, onClick }: { icon: React.ReactNode; title: string; desc: string; color: string; onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ y: -3 }}
      onClick={onClick}
      className="p-5 bg-[#0D1B2E] border border-[rgba(255,255,255,0.06)] rounded-[14px] text-left cursor-pointer hover:border-[rgba(201,169,110,0.4)] transition-all flex flex-col gap-2"
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: color + '22', color }}>{icon}</div>
      <div>
        <p className="text-sm font-bold text-white m-0">{title}</p>
        <p className="text-xs text-[#7A8899] m-0 mt-0.5">{desc}</p>
      </div>
      <ArrowRight size={15} className="text-[#7A8899] self-end" />
    </motion.button>
  );
}
