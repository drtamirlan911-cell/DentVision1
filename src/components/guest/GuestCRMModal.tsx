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
import { useTranslation } from 'react-i18next';

type Step = 'menu' | 'auth' | 'join';
type PendingAction = 'create' | 'join' | 'demo';

interface GuestCRMModalProps {
  open: boolean;
  onClose: () => void;
  /** When true, immediately enter seeded demo clinic (owner@). */
  autoStartDemo?: boolean;
}

export default function GuestCRMModal({ open, onClose, autoStartDemo = false }: GuestCRMModalProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const { login, register, isAuthenticated, switchClinic } = useAuth();
  const { t } = useTranslation();

  const [step, setStep] = useState<Step>('menu');
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [isRegister, setIsRegister] = useState(false);
  const [authData, setAuthData] = useState({ name: '', login: '', password: '', confirmPassword: '', clinicName: '', clinicCity: '', clinicAddress: '', clinicPhone: '' });
  const [joinCode, setJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const autoStartedRef = React.useRef(false);

  const reset = () => {
    setStep('menu');
    setPendingAction(null);
    setLoading(false);
    setError('');
    setIsRegister(false);
    setAuthData({ name: '', login: '', password: '', confirmPassword: '', clinicName: '', clinicCity: '', clinicAddress: '', clinicPhone: '' });
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
        void handleDemo();
      } else {
        // Guests never enter a shared seeded account. They register first,
        // then get their own private demo clinic via createDemoClinic().
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

  React.useEffect(() => {
    if (!open) {
      autoStartedRef.current = false;
      return;
    }
    if (autoStartDemo && !autoStartedRef.current) {
      autoStartedRef.current = true;
      // Guest "Открыть демо-клинику" → register first, then create own demo clinic.
      setPendingAction('demo');
      setStep('auth');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when modal opens with autoStartDemo
  }, [open, autoStartDemo]);

  const handleAuth = async () => {
    setError('');
    if (!authData.login.trim() || !authData.password) {
      setError(t('auth.login_error'));
      return;
    }
    if (pendingAction === 'demo' && !authData.clinicName.trim()) {
      setError('Укажите название клиники');
      return;
    }
    setLoading(true);
    try {
      if (isRegister) {
        if (!authData.name.trim()) { setError(t('auth.name_required')); setLoading(false); return; }
        if (!authData.login.includes('@')) { setError(t('auth.email_invalid')); setLoading(false); return; }
        if (authData.password.length < 8) { setError(t('auth.password_too_short')); setLoading(false); return; }
        if (!/[A-Za-zА-Яа-я]/.test(authData.password) || !/\d/.test(authData.password)) {
          setError(t('auth.password_format')); setLoading(false); return;
        }
        if (authData.password !== authData.confirmPassword) { setError(t('auth.passwords_mismatch')); setLoading(false); return; }
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
    if (!joinCode.trim()) {       toast.error(t('auth.enter_invite_code')); return; }
    setJoinLoading(true);
    try {
      const invite = await api.lookupInvitation(joinCode.trim());
      if (!invite?.clinicId) throw new Error(t('auth.invite_invalid'));
      const res = await api.joinClinic({ code: joinCode.trim() });
      await switchClinic(res.clinic?.id || null);
      toast.success(t('auth.joined_org'));
      handleClose();
      navigate('/crm/schedule');
    } catch (e: any) {
      toast.error(e?.message || t('auth.invite_not_found'));
    } finally {
      setJoinLoading(false);
    }
  };

  const handleDemo = async () => {
    setDemoLoading(true);
    try {
      // Use real clinic data entered by the user so they can continue with it after demo.
      const clinicData = {
        name: authData.clinicName.trim(),
        city: authData.clinicCity.trim(),
        address: authData.clinicAddress.trim(),
        phone: authData.clinicPhone.trim(),
      };
      const res = await api.createDemoClinic(clinicData);
      await switchClinic(res.clinic?.id || null);
      toast.success(t('auth.demo_ready'));
      handleClose();
      navigate('/crm/schedule');
    } catch (e: any) {
      toast.error(e?.message || t('auth.demo_create_failed'));
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
            className="relative w-full max-w-full sm:max-w-lg rounded-2xl border border-white/[0.08] bg-surface-1 shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden"
            initial={{ scale: 0.92, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0, transition: { type: 'spring', damping: 25, stiffness: 300 } }}
            exit={{ scale: 0.92, opacity: 0, y: 30, transition: { duration: 0.15 } }}
          >
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-dv-gold/8 to-transparent pointer-events-none" />

            <div className="relative p-6 pb-0 flex-1 overflow-y-auto overscroll-contain min-h-0">
              <button aria-label="Close" onClick={handleClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-txt-muted hover:text-white hover:bg-surface-1 transition-colors">
                <X size={18} />
              </button>

              <AnimatePresence mode="wait">
                {step === 'menu' && (
                  <motion.div key="menu" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-10 h-10 rounded-xl bg-dv-gold/15 flex items-center justify-center">
                        <Stethoscope size={20} className="text-dv-gold" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-txt-primary m-0">{t('crm.crm_title')}</h2>
                        <p className="text-xs text-txt-muted m-0">{t('crm.crm_subtitle')}</p>
                      </div>
                    </div>

                    <div className="space-y-3 mt-5 mb-2">
                      <CRMOption
                        icon={<Building2 size={20} />}
                        title={t('crm.create_clinic')}
                        desc={t('crm.create_clinic_desc')}
                        color="#C9A96E"
                        onClick={() => handleSelect('create')}
                      />
                      <CRMOption
                        icon={<KeyRound size={20} />}
                        title={t('auth.join_by_invite')}
                        desc={t('crm.join_by_invite_desc')}
                        color="#3498DB"
                        onClick={() => handleSelect('join')}
                      />
                      <CRMOption
                        icon={<FlaskConical size={20} />}
                        title={t('crm.try_demo')}
                        desc={t('crm.try_demo_desc')}
                        color="#27AE60"
                        onClick={() => handleSelect('demo')}
                        loading={demoLoading}
                      />
                    </div>

                    <div className="flex items-start gap-2 p-3 rounded-xl bg-surface-1 border border-white/[0.04] mb-4 mt-4">
                      <Sparkles size={14} className="text-dv-gold mt-0.5 shrink-0" />
                      <p className="text-[11px] text-txt-muted leading-relaxed m-0">
                        {t('crm.guest_crm_hint')}
                      </p>
                    </div>
                  </motion.div>
                )}

                {step === 'auth' && (
                  <motion.div key="auth" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                    <button onClick={() => { setStep('menu'); setError(''); }} className="text-xs text-txt-muted hover:text-dv-gold transition-colors mb-3 flex items-center gap-1">
                      ← {t('crm.back_to_select')}
                    </button>

                    <h2 className="text-lg font-bold text-txt-primary m-0 mb-1">
                      {pendingAction === 'demo'
                        ? (isRegister ? t('auth.registration') : t('auth.login_tab'))
                        : (isRegister ? t('auth.registration') : t('auth.sign_in_title'))}
                    </h2>
                    <p className="text-xs text-txt-muted m-0 mb-4">
                      {pendingAction === 'demo'
                        ? t('auth.demo_sign_up_hint')
                        : (isRegister ? t('auth.create_account_for_crm') : t('auth.sign_in_to_continue'))}
                    </p>

                    <div className="space-y-3">
                      {isRegister && (
                        <div>
                          <label className="text-[11px] text-txt-muted mb-1 block">{t('auth.name')}</label>
                          <input
                            value={authData.name}
                            onChange={(e) => setAuthData(d => ({ ...d, name: e.target.value }))}
                            placeholder={t('auth.your_name')}
                            className="w-full px-3 py-2.5 min-h-11 rounded-xl bg-surface-0 border border-white/[0.08] text-white text-sm focus:outline-none focus:border-dv-gold/50 placeholder-[#4A5568]"
                          />
                        </div>
                      )}
                      <div>
                        <label className="text-[11px] text-txt-muted mb-1 block">{t('auth.username')}</label>
                        <div className="relative">
                          <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-ghost" />
                          <input
                            value={authData.login}
                            onChange={(e) => setAuthData(d => ({ ...d, login: e.target.value }))}
                            placeholder="email@clinic.kz"
                            className="w-full pl-9 pr-3 py-2.5 min-h-11 rounded-xl bg-surface-0 border border-white/[0.08] text-white text-sm focus:outline-none focus:border-dv-gold/50 placeholder-[#4A5568]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] text-txt-muted mb-1 block">{t('auth.password')}</label>
                        <div className="relative">
                          <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-ghost" />
                          <input
                            type="password"
                            value={authData.password}
                            onChange={(e) => setAuthData(d => ({ ...d, password: e.target.value }))}
                            placeholder={t('auth.password')}
                            className="w-full pl-9 pr-3 py-2.5 min-h-11 rounded-xl bg-surface-0 border border-white/[0.08] text-white text-sm focus:outline-none focus:border-dv-gold/50 placeholder-[#4A5568]"
                          />
                        </div>
                      </div>
                      {isRegister && (
                        <div>
                          <label className="text-[11px] text-txt-muted mb-1 block">{t('auth.confirm_password')}</label>
                          <div className="relative">
                            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-ghost" />
                            <input
                              type="password"
                              value={authData.confirmPassword}
                              onChange={(e) => setAuthData(d => ({ ...d, confirmPassword: e.target.value }))}
                              placeholder={t('auth.repeat_password')}
                              className="w-full pl-9 pr-3 py-2.5 min-h-11 rounded-xl bg-surface-0 border border-white/[0.08] text-white text-sm focus:outline-none focus:border-dv-gold/50 placeholder-[#4A5568]"
                            />
                          </div>
                        </div>
                      )}

                      {pendingAction === 'demo' && (
                        <>
                          <div className="flex items-center gap-2 pt-1">
                            <Building2 size={14} className="text-success" />
                            <p className="text-[11px] font-semibold text-txt-muted m-0">{t('auth.clinic_data')}</p>
                          </div>
                          <div>
                            <label className="text-[11px] text-txt-muted mb-1 block">{t('auth.clinic_name')}</label>
                            <input
                              value={authData.clinicName}
                              onChange={(e) => setAuthData(d => ({ ...d, clinicName: e.target.value }))}
                              placeholder={t('auth.clinic_name_placeholder')}
                              className="w-full px-3 py-2.5 min-h-11 rounded-xl bg-surface-0 border border-white/[0.08] text-white text-sm focus:outline-none focus:border-dv-gold/50 placeholder-[#4A5568]"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-txt-muted mb-1 block">{t('auth.city')}</label>
                            <input
                              value={authData.clinicCity}
                              onChange={(e) => setAuthData(d => ({ ...d, clinicCity: e.target.value }))}
                              placeholder={t('auth.city_placeholder')}
                              className="w-full px-3 py-2.5 min-h-11 rounded-xl bg-surface-0 border border-white/[0.08] text-white text-sm focus:outline-none focus:border-dv-gold/50 placeholder-[#4A5568]"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-txt-muted mb-1 block">{t('auth.address')}</label>
                            <input
                              value={authData.clinicAddress}
                              onChange={(e) => setAuthData(d => ({ ...d, clinicAddress: e.target.value }))}
                              placeholder={t('auth.address_placeholder')}
                              className="w-full px-3 py-2.5 min-h-11 rounded-xl bg-surface-0 border border-white/[0.08] text-white text-sm focus:outline-none focus:border-dv-gold/50 placeholder-[#4A5568]"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-txt-muted mb-1 block">{t('shop.phone')}</label>
                            <input
                              value={authData.clinicPhone}
                              onChange={(e) => setAuthData(d => ({ ...d, clinicPhone: e.target.value }))}
                              placeholder={t('auth.phone_placeholder')}
                              className="w-full px-3 py-2.5 min-h-11 rounded-xl bg-surface-0 border border-white/[0.08] text-white text-sm focus:outline-none focus:border-dv-gold/50 placeholder-[#4A5568]"
                            />
                          </div>
                        </>
                      )}

                      {error && (
                        <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                          <p className="text-xs text-red-400 m-0">{error}</p>
                        </div>
                      )}

                      <button
                        onClick={handleAuth}
                        disabled={loading}
                        className="w-full py-2.5 min-h-11 rounded-xl bg-dv-gold text-surface-0 font-semibold text-sm hover:bg-dv-gold/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : (isRegister ? <UserPlus size={16} /> : <LogIn size={16} />)}
                        {loading ? t('auth.wait') : (isRegister ? t('auth.register') : t('auth.login'))}
                      </button>

                      <div className="text-center">
                        <button
                          onClick={() => { setIsRegister(!isRegister); setError(''); }}
                          className="text-xs text-txt-muted hover:text-dv-gold transition-colors"
                        >
                          {isRegister ? t('auth.already_have_account') : t('auth.register_instead')}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 'join' && (
                  <motion.div key="join" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                    <button onClick={() => { setStep('menu'); setJoinCode(''); }} className="text-xs text-txt-muted hover:text-dv-gold transition-colors mb-3 flex items-center gap-1">
                      ← {t('crm.back_to_select')}
                    </button>

                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-10 h-10 rounded-xl bg-info/15 flex items-center justify-center">
                        <KeyRound size={20} className="text-info" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-txt-primary m-0">{t('auth.join_by_invite')}</h2>
                        <p className="text-xs text-txt-muted m-0">Введите код, полученный от администратора</p>
                      </div>
                    </div>

                    <div className="mt-5 space-y-3">
                      <div>
                        <label className="text-[11px] text-txt-muted mb-1 block">{t('auth.invite_code')}</label>
                        <input
                          value={joinCode}
                          onChange={(e) => setJoinCode(e.target.value)}
                          placeholder={t('auth.invite_code_placeholder')}
                          className="w-full px-3 py-3 min-h-11 rounded-xl bg-surface-0 border border-white/[0.08] text-white text-sm font-mono tracking-wider text-center focus:outline-none focus:border-[#3498DB]/50 placeholder-[#4A5568]"
                          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                        />
                      </div>

                      <button
                        onClick={handleJoin}
                        disabled={joinLoading || !joinCode.trim()}
                        className="w-full py-2.5 min-h-11 rounded-xl bg-info text-white font-semibold text-sm hover:bg-info/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {joinLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                        {joinLoading ? t('auth.joining') : t('auth.join')}
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
      className="w-full flex items-center gap-4 p-4 bg-surface-0 border border-white/[0.06] rounded-xl text-left cursor-pointer hover:border-white/[0.12] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: color + '18', color }}>
        {loading ? <Loader2 size={20} className="animate-spin" /> : icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-txt-primary m-0">{title}</p>
        <p className="text-[11px] text-txt-muted m-0 mt-0.5 leading-relaxed">{desc}</p>
      </div>
      <ArrowRight size={16} className="text-txt-ghost shrink-0" />
    </motion.button>
  );
}
