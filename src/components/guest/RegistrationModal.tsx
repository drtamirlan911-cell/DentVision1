// ═══════════════════════════════════════════════════════════════
// RegistrationModal — shown to guests when they try auth-gated actions
// ═══════════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Modal } from '@/components/ui/ds/Modal';
import { useGuestStore } from '@/store/guest.store';
import { useAuth } from '@/store/auth.store';
import {
  UserPlus,
  LogIn,
  Eye,
  EyeOff,
  AlertTriangle,
  Check,
  Loader2,
} from 'lucide-react';

export default function RegistrationModal() {
  const navigate = useNavigate();
  const { showRegistrationModal, setRegistrationModal, pendingAction, convertGuest } = useGuestStore();
  const { register } = useAuth();

  const [mode, setMode] = useState<'choose' | 'register' | 'login'>('choose');
  const [name, setName] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleClose = () => {
    setRegistrationModal(false);
    setMode('choose');
    setName('');
    setLogin('');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess(false);
  };

  const handleRegister = async () => {
    setError('');
    if (!name.trim()) { setError('Введите имя'); return; }
    if (!login.trim() || login.length < 4) { setError('Логин ≥ 4 символов'); return; }
    if (password.length < 6) { setError('Пароль ≥ 6 символов'); return; }
    if (password !== confirmPassword) { setError('Пароли не совпадают'); return; }

    setLoading(true);
    try {
      const converted = await convertGuest(login, password, name);
      if (converted) {
        await register({ name, login, password });
        setSuccess(true);
        setTimeout(() => {
          handleClose();
          if (pendingAction) pendingAction();
          else navigate('/');
        }, 1200);
      } else {
        setError('Ошибка конвертации гостевого аккаунта');
      }
    } catch {
      setError('Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    handleClose();
    navigate('/login');
  };

  return (
    <Modal
      open={showRegistrationModal}
      onClose={handleClose}
      size="sm"
    >
      {mode === 'choose' && (
        <div className="space-y-4 py-2">
          <div className="text-center mb-6">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-dv-gold/15 flex items-center justify-center mb-3">
              <UserPlus size={24} className="text-dv-gold" />
            </div>
            <h3 className="text-lg font-semibold text-txt-primary">Создать аккаунт</h3>
            <p className="text-sm text-txt-secondary mt-1">
              Чтобы сохранять данные и пользоваться всеми функциями
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => setMode('register')}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-dv-gold/20 bg-dv-gold/5 hover:bg-dv-gold/10 hover:border-dv-gold/40 transition-all"
          >
            <div className="w-10 h-10 rounded-lg bg-dv-gold/15 flex items-center justify-center shrink-0">
              <UserPlus size={18} className="text-dv-gold" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-txt-primary">Зарегистрироваться</p>
              <p className="text-xs text-txt-secondary">Создать новый аккаунт бесплатно</p>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleLogin}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-bdr-subtle bg-surface-2 hover:bg-surface-3 transition-all"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <LogIn size={18} className="text-blue-400" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-txt-primary">Войти</p>
              <p className="text-xs text-txt-secondary">Уже есть аккаунт? Войти</p>
            </div>
          </motion.button>

          <button
            onClick={handleClose}
            className="w-full text-center text-xs text-txt-muted hover:text-txt-secondary transition-colors py-2"
          >
            Продолжить как гость
          </button>
        </div>
      )}

      {mode === 'register' && (
        <div className="space-y-3 py-2">
          {success ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center py-8"
            >
              <div className="mx-auto w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center mb-3">
                <Check size={24} className="text-green-400" />
              </div>
              <p className="text-lg font-semibold text-txt-primary">Готово!</p>
              <p className="text-sm text-txt-secondary mt-1">Аккаунт создан, переход...</p>
            </motion.div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => setMode('choose')} className="text-xs text-txt-muted hover:text-txt-secondary">
                  ← Назад
                </button>
                <span className="text-xs text-txt-ghost">|</span>
                <span className="text-xs text-txt-secondary">Регистрация</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-txt-secondary mb-1">Имя</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-bdr-subtle text-txt-primary text-sm focus:outline-none focus:border-dv-gold/50"
                  placeholder="Ваше имя"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-txt-secondary mb-1">Логин</label>
                <input
                  type="text"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-bdr-subtle text-txt-primary text-sm focus:outline-none focus:border-dv-gold/50"
                  placeholder="Минимум 4 символа"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-txt-secondary mb-1">Пароль</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-9 rounded-lg bg-surface-2 border border-bdr-subtle text-txt-primary text-sm focus:outline-none focus:border-dv-gold/50"
                    placeholder="Минимум 6 символов"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-txt-muted hover:text-txt-secondary"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-txt-secondary mb-1">Повторите пароль</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-bdr-subtle text-txt-primary text-sm focus:outline-none focus:border-dv-gold/50"
                  placeholder="Ещё раз"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-error/10 border border-error/20">
                  <AlertTriangle size={14} className="text-error shrink-0" />
                  <span className="text-xs text-error">{error}</span>
                </div>
              )}

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleRegister}
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-dv-gold text-surface-0 font-semibold text-sm hover:bg-dv-gold/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                {loading ? 'Создаём...' : 'Зарегистрироваться'}
              </motion.button>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
