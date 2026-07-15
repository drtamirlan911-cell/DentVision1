import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GLOBAL_CSS } from '../utils/constants';
import { rateLimit, validatePassword } from '../utils/security';
import { Loader2, KeyRound } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname.includes('vercel.app') ? 'https://dentvision-api.onrender.com' : 'http://localhost:3001');

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [login, setLogin] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!rateLimit('forgot-password', { maxAttempts: 3, windowMs: 60000 })) {
      setError('Слишком много запросов. Подождите минуту.');
      return;
    }
    if (!login.trim()) {
      setError('Введите логин');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: login.trim() }),
      });
      const data = await res.json();
      if (data._devToken) {
        setToken(data._devToken);
        setSuccess('Токен для сброса (dev): ' + data._devToken);
      } else {
        setSuccess(data.message || 'Инструкция отправлена');
      }
      setStep('reset');
    } catch {
      setError('Ошибка соединения с сервером');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!token.trim()) {
      setError('Введите токен');
      return;
    }
    if (!validatePassword(newPassword)) {
      setError('Пароль должен быть не менее 6 символов');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim(), newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка');
      setSuccess('Пароль успешно изменён!');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка при смене пароля');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div className="min-h-screen bg-[#080F1A] flex items-center justify-center p-5 relative overflow-hidden">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,#C9A96E08_0%,transparent_70%)] -top-24 -right-24 pointer-events-none" />

        <div className="w-full max-w-[400px] bg-[#0D1B2E] border border-[rgba(201,169,110,0.15)] rounded-[18px] py-9 px-8 shadow-[0_40px_80px_rgba(0,0,0,0.5)] relative z-10">
          <div className="text-center mb-7">
            <div className="mb-2.5 flex justify-center text-[#C9A96E]">
              <KeyRound size={40} />
            </div>
            <h1 className="font-['Georgia',serif] text-[22px] font-bold text-white m-0">
              {step === 'request' ? 'Сброс пароля' : 'Новый пароль'}
            </h1>
            <p className="text-xs text-[#7A8899] mt-1.5">
              {step === 'request' ? 'Введите ваш логин для получения токена' : 'Введите токен и новый пароль'}
            </p>
          </div>

          {error && (
            <div className="bg-[#E74C3C]/15 border border-[#E74C3C]/30 rounded-lg px-3.5 py-2.5 mb-4 text-[13px] text-[#E74C3C]">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-[#27AE60]/15 border border-[#27AE60]/30 rounded-lg px-3.5 py-2.5 mb-4 text-[13px] text-[#27AE60]">
              {success}
            </div>
          )}

          {step === 'request' ? (
            <form onSubmit={handleRequest}>
              <div className="mb-5">
                <label className="block text-xs font-semibold text-[#B0BEC5] mb-1.5">Логин</label>
                <input type="text" value={login} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLogin(e.target.value)}
                  placeholder="admin_c1" required autoFocus
                  className="w-full bg-white/[0.06] border border-[rgba(201,169,110,0.15)] rounded-lg px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#C9A96E] transition-colors" />
              </div>
              <button type="submit" disabled={loading}
                className={`w-full py-3 border-none rounded-lg text-[#080F1A] text-sm font-bold flex items-center justify-center gap-2 ${
                  loading
                    ? 'bg-[#8B6F3E] cursor-not-allowed'
                    : 'bg-gradient-to-r from-[#C9A96E] to-[#8B6F3E] cursor-pointer'
                }`}>
                {loading ? <><Loader2 size={16} className="animate-spin text-[#080F1A]" /> Отправка...</> : 'Получить токен'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleReset}>
              <div className="mb-3.5">
                <label className="block text-xs font-semibold text-[#B0BEC5] mb-1.5">Токен сброса</label>
                <input type="text" value={token} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setToken(e.target.value)}
                  placeholder="Вставьте токен из письма" required autoFocus
                  className="w-full bg-white/[0.06] border border-[rgba(201,169,110,0.15)] rounded-lg px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#C9A96E] transition-colors font-mono" />
              </div>
              <div className="mb-3.5">
                <label className="block text-xs font-semibold text-[#B0BEC5] mb-1.5">Новый пароль</label>
                <input type="password" value={newPassword} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
                  placeholder="Минимум 6 символов" required
                  className="w-full bg-white/[0.06] border border-[rgba(201,169,110,0.15)] rounded-lg px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#C9A96E] transition-colors" />
              </div>
              <div className="mb-5">
                <label className="block text-xs font-semibold text-[#B0BEC5] mb-1.5">Подтвердите пароль</label>
                <input type="password" value={confirmPassword} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                  placeholder="Повторите пароль" required
                  className="w-full bg-white/[0.06] border border-[rgba(201,169,110,0.15)] rounded-lg px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#C9A96E] transition-colors" />
              </div>
              <button type="submit" disabled={loading}
                className={`w-full py-3 border-none rounded-lg text-[#080F1A] text-sm font-bold flex items-center justify-center gap-2 ${
                  loading
                    ? 'bg-[#8B6F3E] cursor-not-allowed'
                    : 'bg-gradient-to-r from-[#C9A96E] to-[#8B6F3E] cursor-pointer'
                }`}>
                {loading ? <><Loader2 size={16} className="animate-spin text-[#080F1A]" /> Сохранение...</> : 'Изменить пароль'}
              </button>
            </form>
          )}

          <div className="text-center mt-4">
            <button onClick={() => navigate('/login')} className="bg-transparent border-none text-[#C9A96E] text-[13px] cursor-pointer underline">
              ← Вернуться к входу
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
