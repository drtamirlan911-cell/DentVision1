"use client"
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, X, UserPlus, LogIn, Loader2 } from 'lucide-react';
import { useAuth } from '@/store/auth.store';

interface LoginModalProps {
  isOpen: boolean;
  returnUrl?: string;
  onClose?: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, returnUrl, onClose }) => {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleClose = () => {
    setIsRegister(false);
    setName('');
    setLoginInput('');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess(false);
    onClose?.();
  };

  const handleLogin = async () => {
    setError('');
    if (!loginInput.trim() || !password) {
      setError('Введите логин и пароль');
      return;
    }

    setLoading(true);
    try {
      await login(loginInput, password);
      setSuccess(true);
      setTimeout(() => {
        handleClose();
        navigate(returnUrl || '/');
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setError('');
    if (!name.trim()) {
      setError('Введите имя');
      return;
    }
    if (!loginInput.trim() || !loginInput.includes('@')) {
      setError('Укажите корректный email');
      return;
    }
    if (password.length < 8) {
      setError('Пароль ≥ 8 символов');
      return;
    }
    if (!/[A-Za-zА-Яа-я]/.test(password) || !/\d/.test(password)) {
      setError('Пароль должен содержать буквы и цифры');
      return;
    }
    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);
    try {
      await register({ name, login: loginInput, password });
      setSuccess(true);
      setTimeout(() => {
        handleClose();
        navigate(returnUrl || '/');
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md p-6 rounded-2xl bg-surface-1 border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-txt-primary">
                {isRegister ? 'Регистрация' : 'Вход'}
              </h2>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
              >
                <X size={20} className="text-txt-muted" />
              </button>
            </div>

            {success ? (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center py-8"
              >
                <div className="mx-auto w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-lg font-semibold text-txt-primary">Успешно</p>
                <p className="text-sm text-txt-secondary mt-1">
                  {isRegister ? 'Аккаунт создан' : 'Вы вошли'}
                </p>
              </motion.div>
            ) : (
              <>
                <div className="flex gap-3 mb-6">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setIsRegister(false)}
                    className={`flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all ${!isRegister
                      ? 'bg-dv-gold/15 text-dv-gold border border-dv-gold/30'
                      : 'bg-surface-2 text-txt-secondary border border-white/5 hover:bg-white/5'}
                  `}
                  >
                    Войти
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setIsRegister(true)}
                    className={`flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all ${isRegister
                      ? 'bg-dv-gold/15 text-dv-gold border border-dv-gold/30'
                      : 'bg-surface-2 text-txt-secondary border border-white/5 hover:bg-white/5'}
                  `}
                  >
                    Зарегистрироваться
                  </motion.button>
                </div>

                <div className="space-y-4">
                  {isRegister && (
                    <div>
                      <label className="block text-sm font-medium text-txt-secondary mb-2">Имя</label>
                      <div className="relative">
                        <UserPlus size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-txt-muted" />
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface-2 border border-white/5 text-txt-primary focus:outline-none focus:border-dv-gold/50"
                          placeholder="Ваше имя"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-txt-secondary mb-2">Логин</label>
                    <div className="relative">
                      <Mail size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-txt-muted" />
                      <input
                        type="text"
                        value={loginInput}
                        onChange={(e) => setLoginInput(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface-2 border border-white/5 text-txt-primary focus:outline-none focus:border-dv-gold/50"
                        placeholder="Логин"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-txt-secondary mb-2">Пароль</label>
                    <div className="relative">
                      <Lock size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-txt-muted" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface-2 border border-white/5 text-txt-primary focus:outline-none focus:border-dv-gold/50"
                        placeholder="Пароль"
                      />
                    </div>
                  </div>

                  {isRegister && (
                    <div>
                      <label className="block text-sm font-medium text-txt-secondary mb-2">Подтвердите пароль</label>
                      <div className="relative">
                        <Lock size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-txt-muted" />
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface-2 border border-white/5 text-txt-primary focus:outline-none focus:border-dv-gold/50"
                          placeholder="Подтвердите пароль"
                        />
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="p-3 rounded-lg bg-error/10 border border-error/20">
                      <p className="text-sm text-error">{error}</p>
                    </div>
                  )}

                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={isRegister ? handleRegister : handleLogin}
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-xl bg-dv-gold text-surface-0 font-semibold hover:bg-dv-gold/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : (isRegister ? <UserPlus size={18} /> : <LogIn size={18} />)}
                    {loading ? 'Подождите...' : (isRegister ? 'Зарегистрироваться' : 'Войти')}
                  </motion.button>

                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/5" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="px-2 bg-surface-1 text-txt-muted">или</span>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleClose}
                    className="w-full py-3 px-4 rounded-xl border border-white/10 bg-surface-2 text-txt-primary hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
                  >
                    <span>Продолжить как гость</span>
                  </motion.button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoginModal;
