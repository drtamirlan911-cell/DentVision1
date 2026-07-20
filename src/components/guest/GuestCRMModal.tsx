import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, LogIn, FlaskConical, ArrowRight, Loader2, CheckCircle2,
  Mail, Lock, UserPlus, KeyRound, Stethoscope, Sparkles, X,
} from 'lucide-react';
import { useAuth } from '@/store/auth.store';
import { useToast } from '@/components/ui/ds/Toast';
import * as api from '@/utils/api';

type Step = 'menu' | 'auth' | 'join';
type PendingAction = 'create' | 'join' | 'demo';

interface GuestCRMModalProps {
  open: boolean;
  onClose: () => void;
}

export default function GuestCRMModal({ open, onClose }: GuestCRMModalProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const { login, register, isAuthenticated, switchClinic } = useAuth();

  const [step, setStep] = useState<Step>('menu');
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [isRegister, setIsRegister] = useState(false);
  const [authData, setAuthData] = useState({ name: '', login: '', password: '', confirmPassword: '' });
  const [joinCode, setJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const reset = () => {
    setStep('menu');
    setPendingAction(null);
    setLoading(false);
    setError('');
    setIsRegister(false);
    setAuthData({ name: '', login: '', password: '', confirmPassword: '' });
    setJoinCode('');
    setJoinLoading(false);
    setDemoLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSelect = (action: PendingAction) => {
    if (action === 'demo') {
      if (isAuthenticated) {
        handleDemo();
      } else {
        setPendingAction('demo');
        setStep('auth');
      }
      return;
    }
    if (isAuthenticated) {
      if (action === 'create') {
        handleClose();
        navigate('/my-clinics');
        return;
      }
      setPendingAction(action);
      setStep('join');
    } else {
      setPendingAction(action);
      setStep('auth');
    }
  };

  const handleAuth = async () => {
    setError('');
    if (!authData.login.trim() || !authData.password) {
      setError('Введите логин и пароль');
      return;
    }
    setLoading(true);
    try {
      if (isRegister) {
        if (!authData.name.trim()) { setError('Введите имя'); setLoading(false); return; }
        if (authData.login.length < 4) { setError('Логин ≥ 4 символов'); setLoading(false); return; }
        if (authData.password.length < 6) { setError('Пароль ≥ 6 символов'); setLoading(false); return; }
        if (authData.password !== authData.confirmPassword) { setError('Пароли не совпадают'); setLoading(false); return; }
        await register({ name: authData.name, login: authData.login, password: authData.password });
      } else {
        await login(authData.login, authData.password);
      }
      handlePostAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const handlePostAuth = () => {
    if (pendingAction === 'create') {
      handleClose();
      navigate('/my-clinics');
    } else if (pendingAction === 'join') {
      setStep('join');
    } else if (pendingAction === 'demo') {
      handleDemo();
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) { toast.error('Введите код приглашения'); return; }
    setJoinLoading(true);
    try {
      const invite = await api.lookupInvitation(joinCode.trim());
      if (!invite?.clinicId) throw new Error('Приглашение недействительно');
      const res = await api.joinClinic({ code: joinCode.trim() });
      await switchClinic(res.clinic?.id || null);
      toast.success('Вы присоединились к организации');
      handleClose();
      navigate('/crm/schedule');
    } catch (e: any) {
      toast.error(e?.message || 'Приглашение не найдено');
    } finally {
      setJoinLoading(false);
    }
  };

  const handleDemo = async () => {
    setDemoLoading(true);
    try {
      const res = await api.createDemoClinic();
      await switchClinic(res.clinic?.id || null);
      toast.success('Демо-клиника готова!');
      handleClose();
      navigate('/crm/schedule');
    } catch (e: any) {
      toast.error(e?.message || 'Не удалось создать демо-клинику');
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

          <motion.div
            className="relative w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#0D1B2E] shadow-2xl overflow-hidden"
            initial={{ scale: 0.92, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0, transition: { type: 'spring', damping: 25, stiffness: 300 } }}
            exit={{ scale: 0.92, opacity: 0, y: 30, transition: { duration: 0.15 } }}
          >
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#C9A96E]/8 to-transparent pointer-events-none" />

            <div className="relative p-6 pb-0">
              <button onClick={handleClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-[#7A8899] hover:text-white hover:bg-white/5 transition-colors">
                <X size={18} />
              </button>

              <AnimatePresence mode="wait">
                {step === 'menu' && (
                  <motion.div key="menu" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-10 h-10 rounded-xl bg-[#C9A96E]/15 flex items-center justify-center">
                        <Stethoscope size={20} className="text-[#C9A96E]" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-white m-0">CRM Стоматологии</h2>
                        <p className="text-xs text-[#7A8899] m-0">Выберите способ начать работу</p>
                      </div>
                    </div>

                    <div className="space-y-3 mt-5 mb-2">
                      <CRMOption
                        icon={<Building2 size={20} />}
                        title="Создать клинику"
                        desc="Для владельцев бизнеса. Настройте свою клинику за 2 минуты."
                        color="#C9A96E"
                        onClick={() => handleSelect('create')}
                      />
                      <CRMOption
                        icon={<KeyRound size={20} />}
                        title="Войти по приглашению"
                        desc="Введите код от коллеги, чтобы присоединиться к существующей клинике."
                        color="#3498DB"
                        onClick={() => handleSelect('join')}
                      />
                      <CRMOption
                        icon={<FlaskConical size={20} />}
                        title="Попробовать демо"
                        desc="Демо-клиника с患者ами, планами лечения и данными для тестирования."
                        color="#27AE60"
                        onClick={() => handleSelect('demo')}
                        loading={demoLoading}
                      />
                    </div>

                    <div className="flex items-start gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.04] mb-4 mt-4">
                      <Sparkles size={14} className="text-[#C9A96E] mt-0.5 shrink-0" />
                      <p className="text-[11px] text-[#7A8899] leading-relaxed m-0">
                        Вы уже можете пользоваться <span className="text-[#C9A96E]">Магазином</span>, <span className="text-[#C9A96E]">Академией</span> и <span className="text-[#C9A96E]">AI-ассистентом</span> в личном режиме.
                      </p>
                    </div>
                  </motion.div>
                )}

                {step === 'auth' && (
                  <motion.div key="auth" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                    <button onClick={() => { setStep('menu'); setError(''); }} className="text-xs text-[#7A8899] hover:text-[#C9A96E] transition-colors mb-3 flex items-center gap-1">
                      ← Назад к выбору
                    </button>

                    <h2 className="text-lg font-bold text-white m-0 mb-1">
                      {isRegister ? 'Регистрация' : 'Вход в аккаунт'}
                    </h2>
                    <p className="text-xs text-[#7A8899] m-0 mb-4">
                      {isRegister ? 'Создайте аккаунт для доступа к CRM' : 'Войдите, чтобы продолжить'}
                    </p>

                    <div className="space-y-3">
                      {isRegister && (
                        <div>
                          <label className="text-[11px] text-[#7A8899] mb-1 block">Имя</label>
                          <input
                            value={authData.name}
                            onChange={(e) => setAuthData(d => ({ ...d, name: e.target.value }))}
                            placeholder="Ваше имя"
                            className="w-full px-3 py-2.5 rounded-xl bg-[#080F1A] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#C9A96E]/50 placeholder-[#4A5568]"
                          />
                        </div>
                      )}
                      <div>
                        <label className="text-[11px] text-[#7A8899] mb-1 block">Логин</label>
                        <div className="relative">
                          <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A5568]" />
                          <input
                            value={authData.login}
                            onChange={(e) => setAuthData(d => ({ ...d, login: e.target.value }))}
                            placeholder="Логин"
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#080F1A] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#C9A96E]/50 placeholder-[#4A5568]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] text-[#7A8899] mb-1 block">Пароль</label>
                        <div className="relative">
                          <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A5568]" />
                          <input
                            type="password"
                            value={authData.password}
                            onChange={(e) => setAuthData(d => ({ ...d, password: e.target.value }))}
                            placeholder="Пароль"
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#080F1A] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#C9A96E]/50 placeholder-[#4A5568]"
                          />
                        </div>
                      </div>
                      {isRegister && (
                        <div>
                          <label className="text-[11px] text-[#7A8899] mb-1 block">Подтвердите пароль</label>
                          <div className="relative">
                            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A5568]" />
                            <input
                              type="password"
                              value={authData.confirmPassword}
                              onChange={(e) => setAuthData(d => ({ ...d, confirmPassword: e.target.value }))}
                              placeholder="Повторите пароль"
                              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#080F1A] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#C9A96E]/50 placeholder-[#4A5568]"
                            />
                          </div>
                        </div>
                      )}

                      {error && (
                        <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                          <p className="text-xs text-red-400 m-0">{error}</p>
                        </div>
                      )}

                      <button
                        onClick={handleAuth}
                        disabled={loading}
                        className="w-full py-2.5 rounded-xl bg-[#C9A96E] text-[#080F1A] font-semibold text-sm hover:bg-[#C9A96E]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : (isRegister ? <UserPlus size={16} /> : <LogIn size={16} />)}
                        {loading ? 'Подождите...' : (isRegister ? 'Зарегистрироваться' : 'Войти')}
                      </button>

                      <div className="text-center">
                        <button
                          onClick={() => { setIsRegister(!isRegister); setError(''); }}
                          className="text-xs text-[#7A8899] hover:text-[#C9A96E] transition-colors"
                        >
                          {isRegister ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 'join' && (
                  <motion.div key="join" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                    <button onClick={() => { setStep('menu'); setJoinCode(''); }} className="text-xs text-[#7A8899] hover:text-[#C9A96E] transition-colors mb-3 flex items-center gap-1">
                      ← Назад к выбору
                    </button>

                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-10 h-10 rounded-xl bg-[#3498DB]/15 flex items-center justify-center">
                        <KeyRound size={20} className="text-[#3498DB]" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-white m-0">Вход по приглашению</h2>
                        <p className="text-xs text-[#7A8899] m-0">Введите код, полученный от администратора</p>
                      </div>
                    </div>

                    <div className="mt-5 space-y-3">
                      <div>
                        <label className="text-[11px] text-[#7A8899] mb-1 block">Код приглашения</label>
                        <input
                          value={joinCode}
                          onChange={(e) => setJoinCode(e.target.value)}
                          placeholder="ABCD-1234"
                          className="w-full px-3 py-3 rounded-xl bg-[#080F1A] border border-white/[0.08] text-white text-sm font-mono tracking-wider text-center focus:outline-none focus:border-[#3498DB]/50 placeholder-[#4A5568]"
                          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                        />
                      </div>

                      <button
                        onClick={handleJoin}
                        disabled={joinLoading || !joinCode.trim()}
                        className="w-full py-2.5 rounded-xl bg-[#3498DB] text-white font-semibold text-sm hover:bg-[#3498DB]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {joinLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                        {joinLoading ? 'Присоединяем...' : 'Присоединиться'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CRMOption({ icon, title, desc, color, onClick, loading }: {
  icon: React.ReactNode; title: string; desc: string; color: string; onClick: () => void; loading?: boolean;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.01, y: -1 }}
      whileTap={{ scale: 0.99 }}
      disabled={loading}
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 bg-[#080F1A] border border-white/[0.06] rounded-xl text-left cursor-pointer hover:border-white/[0.12] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: color + '18', color }}>
        {loading ? <Loader2 size={20} className="animate-spin" /> : icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white m-0">{title}</p>
        <p className="text-[11px] text-[#7A8899] m-0 mt-0.5 leading-relaxed">{desc}</p>
      </div>
      <ArrowRight size={16} className="text-[#4A5568] shrink-0" />
    </motion.button>
  );
}
