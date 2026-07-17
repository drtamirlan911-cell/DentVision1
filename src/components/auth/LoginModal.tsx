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
      await login({ login: loginInput, password });
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
    if (!loginInput.trim() || loginInput.length < 4) {
      setError('Логин ≥ 4 символов');
      return;
    }
    if (password.length < 6) {
      setError('Пароль ≥ 6 символов');
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

  const handleGoogleLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL || 'https://dentvision-api.onrender.com'}/api/auth/google`;
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
                    onClick={handleGoogleLogin}
                    className="w-full py-3 px-4 rounded-xl border border-white/10 bg-surface-2 text-txt-primary hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path d="M12.24 10.295v3.298h7.84c-.24 1.84-.853 3.18-1.693 4.1-1.02 1.02-2.7 1.85-4.19 1.85-3.22 0-5.88-2.22-5.88-5.58 0-3.36 2.66-5.58 5.88-5.58 1.73 0 3.04.73 3.93 1.57l-1.52 1.52c-.4-.38-1.04-.74-1.91-.74-1.63 0-2.95 1.4-2.95 2.82 0 1.42 1.32 2.82 2.95 2.82.85 0 1.5-.23 1.91-.5z" fill="#4285F4" />
                      <path d="M5.355 14.243L4.064 12.04 1.207 12.04C.45 13.666-.02 15.66.02 17.7c0 2.15 1.23 4.02 3.22 4.96 1.99.94 4.32.44 5.98-.84l-2.86-2.58c-.85.56-1.99.8-3.12.8-2.4 0-4.34-1.54-5.36-3.7-.86-1.47-.86-3.3 0-4.77 1.02-2.15 3.01-3.68 5.41-3.68 2.17 0 4.01 1.15 5.02 2.68l1.8-1.68c-1.4-1.74-3.24-2.79-5.18-2.79-3.9 0-7.06 3.24-7.06 7.23 0 3.99 3.16 7.23 7.06 7.23 3.09 0 5.8-1.59 7.17-4.06l-2.03-1.87c-.67.71-1.55 1.16-2.54 1.16-1.74 0-3.15-1.41-3.15-3.15 0-1.74 1.41-3.15 3.15-3.15 1.0 0 1.87.45 2.54 1.16z" fill="#34A853" />
                      <path d="M12.545 21.545c2.55 0 4.78-.86 6.57-2.32l-3.02-2.42c-.83.56-1.89.89-2.93.89-2.24 0-4.14-1.51-4.83-3.56-.33-.64-.53-1.33-.53-2.05 0-.72.2-1.41.53-2.05 1.64 2.04 4.57 3.44 7.73 3.44 1.21 0 2.33-.3 3.12-.89l2.86 2.58c-1.01 1.37-2.27 2.22-3.68 2.22-2.96 0-5.35-1.47-6.7-3.94-.88-1.42-.88-3.07 0-4.49 1.36-2.48 3.75-3.96 6.71-3.96 3.34 0 6.15 2.02 6.93 4.94.19.43.32.9.32 1.38 0 .48-.13.94-.35 1.34-.87 1.53-2.45 2.54-4.4 2.54-1.08 0-2.03-.37-2.81-1.0z" fill="#FBBC05" />
                      <path d="M8.6 12.5l2.56-1.55L12.24 10.3v3.52c-1.47-.76-2.35-2.62-1.85-4.4-.5 1.78-.73 3.69-.5 5.23.4 2.09 1.84 3.85 3.68 4.5 1.84.65 3.82.16 5.0-1.0-1.47-1.6-2.38-3.89-1.95-6.1-2.5.2-4.5 2.15-5.15 5.15z" fill="#EA4335" />
                    </svg>
                    <span>Google</span>
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
