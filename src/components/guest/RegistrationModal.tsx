import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from '@/components/ui/ds/Modal';
import { useGuestStore } from '@/store/guest.store';
import { useAuth } from '@/store/auth.store';
import { Mail, Lock, Check, Loader2, UserPlus, Eye, EyeOff } from 'lucide-react';

export default function RegistrationModal() {
  const navigate = useNavigate();
  const { showRegistrationModal, setRegistrationModal, pendingAction, convertGuest } = useGuestStore();
  const { login } = useAuth();
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [loginData, setLoginData] = useState({ login: '', password: '' });
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
    setShowPassword(false);
    setRegisterData({ name: '', login: '', password: '', confirmPassword: '' });
    setError('');
    setSuccess(false);
  };

  const afterAuth = () => {
    handleClose();
    if (pendingAction) pendingAction();
    else navigate('/');
  };

  const handleGuestLogin = async () => {
    setError('');
    if (!loginData.login.trim() || !loginData.password) {
      setError('Введите email и пароль');
      return;
    }
    setLoading(true);
    try {
      await login(loginData.login, loginData.password);
      setSuccess(true);
      setTimeout(afterAuth, 400);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  const handleConvertAndRegister = async () => {
    setError('');
    if (!registerData.name.trim()) { setError('Введите имя'); return; }
    const email = registerData.login.trim().toLowerCase();
    if (!email.includes('@') || email.length < 5) { setError('Укажите корректный email'); return; }
    if (registerData.password.length < 8) { setError('Пароль ≥ 8 символов'); return; }
    if (!/[A-Za-zА-Яа-я]/.test(registerData.password) || !/\d/.test(registerData.password)) {
      setError('Пароль должен содержать буквы и цифры');
      return;
    }
    if (registerData.password !== registerData.confirmPassword) { setError('Пароли не совпадают'); return; }

    setLoading(true);
    try {
      const converted = await convertGuest(email, registerData.password, registerData.name);
      if (!converted) {
        setError('Ошибка конвертации');
        return;
      }
      // Convert already minted tokens; login hydrates user/clinic into auth store
      const ok = await login(email, registerData.password);
      if (!ok) {
        setError('Аккаунт создан, но вход не удался — попробуйте войти вручную');
        return;
      }
      setSuccess(true);
      setTimeout(afterAuth, 400);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
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
                <label className="block text-xs font-medium text-txt-secondary mb-1.5">Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-txt-muted" />
                  <input
                    type="email"
                    value={loginData.login}
                    onChange={(e) => setLoginData(prev => ({ ...prev, login: e.target.value }))}
                    placeholder="email@clinic.kz"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-2 border border-bdr-subtle text-txt-primary text-sm focus:outline-none focus:border-dv-gold/50"
                    autoComplete="username"
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
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-txt-muted hover:text-txt-secondary"
                    aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
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
              <p className="text-xs text-txt-muted">Сохраним гостевую сессию и откроем полный доступ</p>
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
                autoComplete="name"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-txt-secondary mb-1.5">Email</label>
              <input
                type="email"
                value={registerData.login}
                onChange={(e) => setRegisterData(prev => ({ ...prev, login: e.target.value }))}
                placeholder="email@clinic.kz"
                className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-bdr-subtle text-txt-primary text-sm focus:outline-none focus:border-dv-gold/50"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-txt-secondary mb-1.5">Пароль</label>
              <input
                type="password"
                value={registerData.password}
                onChange={(e) => setRegisterData(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Минимум 8 символов, буквы и цифры"
                className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-bdr-subtle text-txt-primary text-sm focus:outline-none focus:border-dv-gold/50"
                autoComplete="new-password"
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
                autoComplete="new-password"
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
