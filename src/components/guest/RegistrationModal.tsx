import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from '@/components/ui/ds/Modal';
import { useGuestStore } from '@/store/guest.store';
import { useAuth } from '@/store/auth.store';
import { Mail, Lock, Check, Loader2, UserPlus } from 'lucide-react';

export default function RegistrationModal() {
  const navigate = useNavigate();
  const { showRegistrationModal, setRegistrationModal, pendingAction, convertGuest } = useGuestStore();
  const { login, register } = useAuth();
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [loginData, setLoginData] = useState({ login: '', password: '' });
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [registerData, setRegisterData] = useState({ name: '', login: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (showRegistrationModal && pendingAction) {
      setShowLoginForm(true);
    }
  }, [showRegistrationModal, pendingAction]);

  const handleClose = () => {
    setRegistrationModal(false);
    setShowLoginForm(false);
    setLoginData({ login: '', password: '' });
    setName('');
    setShowPassword(false);
    setRegisterData({ name: '', login: '', password: '', confirmPassword: '' });
    setError('');
    setSuccess(false);
  };

  const handleGuestLogin = async () => {
    setError('');
    if (!loginData.login.trim() || !loginData.password) {
      setError('Введите логин и пароль');
      return;
    }
    setLoading(true);
    try {
      await login(loginData.login, loginData.password);
      setSuccess(true);
      setTimeout(() => {
        handleClose();
        if (pendingAction) pendingAction();
        else navigate('/');
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  const handleConvertAndRegister = async () => {
    setError('');
    if (!registerData.name.trim()) { setError('Введите имя'); return; }
    if (!registerData.login.trim() || registerData.login.length < 4) { setError('Логин ≥ 4 символа'); return; }
    if (registerData.password.length < 6) { setError('Пароль ≥ 6 символов'); return; }
    if (registerData.password !== registerData.confirmPassword) { setError('Пароли не совпадают'); return; }
    
    setLoading(true);
    try {
      const converted = await convertGuest(registerData.login, registerData.password, registerData.name);
      if (converted) {
        await register({ name: registerData.name, login: registerData.login, password: registerData.password });
        setSuccess(true);
        setTimeout(() => {
          handleClose();
          if (pendingAction) pendingAction();
          else navigate('/');
        }, 500);
      } else {
        setError('Ошибка конвертации');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL || 'https://dentvision-api.onrender.com'}/api/auth/google`;
  };

  return (
    <Modal
      open={showRegistrationModal}
      onClose={handleClose}
      size="sm"
    >
      <AnimatePresence mode="wait">
        {success ? (
          <motion.div
            key="success"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center py-8"
          >
            <div className="mx-auto w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mb-3">
              <Check size={24} className="text-green-400" />
            </div>
            <p className="text-lg font-semibold text-txt-primary">Готово</p>
            <p className="text-sm text-txt-secondary mt-1">Вход выполнен, переходим...</p>
          </motion.div>
        ) : showLoginForm ? (
          <motion.div
            key="login-form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-5"
          >
            <div className="text-center">
              <h3 className="text-lg font-semibold text-txt-primary mb-1">Вход в аккаунт</h3>
              <p className="text-xs text-txt-muted">Вы начали гостевую сессию. Войдите, чтобы сохранить прогресс.</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-txt-secondary mb-1.5">Логин</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-txt-muted" />
                  <input
                    type="text"
                    value={loginData.login}
                    onChange={(e) => setLoginData(prev => ({ ...prev, login: e.target.value }))}
                    placeholder="Логин"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-2 border border-bdr-subtle text-txt-primary text-sm focus:outline-none focus:border-dv-gold/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-txt-secondary mb-1.5">Пароль</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-txt-muted" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginData.password}
                    onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Пароль"
                    className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-surface-2 border border-bdr-subtle text-txt-primary text-sm focus:outline-none focus:border-dv-gold/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-txt-muted hover:text-txt-secondary"
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-2 rounded-lg bg-error/10 border border-error/20">
                <p className="text-xs text-error">{error}</p>
              </div>
            )}

            <button
              onClick={handleGuestLogin}
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-dv-gold text-surface-0 font-semibold text-sm hover:bg-dv-gold/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {loading ? 'Входим...' : 'Войти'}
            </button>

            <div className="text-center">
              <button
                onClick={() => setShowLoginForm(false)}
                className="text-xs text-txt-muted hover:text-txt-secondary transition-colors"
              >
                Вместо этого зарегистрироваться
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="register-form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="text-center">
              <h3 className="text-lg font-semibold text-txt-primary mb-1">Создать аккаунт</h3>
              <p className="text-xs text-txt-muted">Регистрация-convert guest session to permanent account</p>
            </div>

            {error && (
              <div className="p-2 rounded-lg bg-error/10 border border-error/20">
                <p className="text-xs text-error">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-txt-secondary mb-1.5">Имя</label>
              <input
                type="text"
                value={registerData.name}
                onChange={(e) => setRegisterData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ваше имя"
                className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-bdr-subtle text-txt-primary text-sm focus:outline-none focus:border-dv-gold/50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-txt-secondary mb-1.5">Логин</label>
              <input
                type="text"
                value={registerData.login}
                onChange={(e) => setRegisterData(prev => ({ ...prev, login: e.target.value }))}
                placeholder="Логин (мин. 4 символа)"
                className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-bdr-subtle text-txt-primary text-sm focus:outline-none focus:border-dv-gold/50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-txt-secondary mb-1.5">Пароль</label>
              <input
                type="password"
                value={registerData.password}
                onChange={(e) => setRegisterData(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Пароль (мин. 6 символов)"
                className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-bdr-subtle text-txt-primary text-sm focus:outline-none focus:border-dv-gold/50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-txt-secondary mb-1.5">Подтвердите пароль</label>
              <input
                type="password"
                value={registerData.confirmPassword}
                onChange={(e) => setRegisterData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                placeholder="Повторите пароль"
                className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-bdr-subtle text-txt-primary text-sm focus:outline-none focus:border-dv-gold/50"
              />
            </div>

            <button
              onClick={handleConvertAndRegister}
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-dv-gold text-surface-0 font-semibold text-sm hover:bg-dv-gold/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              {loading ? 'Регистрируем...' : 'Зарегистрироваться'}
            </button>

            <div className="text-center space-y-2">
              <button
                onClick={() => setShowLoginForm(true)}
                className="text-xs text-txt-muted hover:text-txt-secondary transition-colors block mx-auto"
              >
                Уже есть аккаунт? Войти
              </button>
              <button
                onClick={handleClose}
                className="text-xs text-txt-muted hover:text-txt-secondary transition-colors block mx-auto"
              >
                Продолжить как гость
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}

