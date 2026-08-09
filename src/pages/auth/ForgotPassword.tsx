import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { rateLimit, passwordPolicyError } from '../../utils/security';
import { Loader2, KeyRound } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname.includes('vercel.app') ? 'https://dentvision-api.onrender.com' : 'http://localhost:3001');

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // The letter links straight to the reset form with the token in the query,
  // so someone arriving from their inbox does not have to copy anything.
  useEffect(() => {
    const fromLink = searchParams.get('token');
    if (fromLink) {
      setToken(fromLink);
      setStep('reset');
    }
  }, [searchParams]);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!rateLimit('forgot-password', { maxAttempts: 3, windowMs: 60000 })) {
      setError('Слишком много запросов. Подождите минуту.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Введите email, указанный при регистрации');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The server looks the account up by email — it never had a login
        // column to search. The form used to ask for "логин" with `admin_c1` as
        // the placeholder, so a correct answer found nothing.
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      const devToken = data._devToken || data.data?._devToken;
      if (devToken) {
        // Development only — the server never returns this in production.
        setToken(devToken);
        setSuccess('Токен подставлен (режим разработки)');
      } else {
        setSuccess('Если такой аккаунт существует, письмо со ссылкой отправлено');
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
    const policyError = passwordPolicyError(newPassword);
    if (policyError) {
      setError(policyError);
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
      if (!res.ok) throw new Error(data.data?.error || data.error || 'Ошибка');
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
      <div className="min-h-screen max-w-full overflow-x-hidden bg-surface-0 flex items-center justify-center p-5 relative overflow-hidden">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(201,169,110,0.08)_0%,transparent_70%)] -top-24 -right-24 pointer-events-none" />

        <div className="w-full max-w-md sm:max-w-lg bg-surface-1 border border-dv-gold/20 rounded-[18px] py-9 px-8 shadow-[0_40px_80px_rgba(0,0,0,0.5)] relative z-10">
          <div className="text-center mb-7">
            <div className="mb-2.5 flex justify-center text-dv-gold">
              <KeyRound size={40} />
            </div>
            <h1 className="font-serif text-2xl font-bold text-txt-primary m-0">
              {step === 'request' ? 'Сброс пароля' : 'Новый пароль'}
            </h1>
            <p className="text-xs text-txt-muted mt-1.5">
              {step === 'request'
                ? 'Укажите email — вышлем ссылку для сброса'
                : 'Задайте новый пароль'}
            </p>
          </div>

          {error && (
            <div className="bg-error/10 border border-error/25 rounded-lg px-3.5 py-2.5 mb-4 text-sm text-error">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-success/10 border border-success/25 rounded-lg px-3.5 py-2.5 mb-4 text-sm text-success">
              {success}
            </div>
          )}

          {step === 'request' ? (
            <form onSubmit={handleRequest}>
              <div className="mb-5">
                <label className="block text-xs font-semibold text-txt-secondary mb-1.5">Email</label>
                <input type="email" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  placeholder="you@example.kz" required autoFocus
                  className="w-full min-h-11 bg-surface-2 border border-dv-gold/20 rounded-lg px-3.5 py-2.5 text-sm text-txt-primary outline-none focus:border-dv-gold transition-colors" />
              </div>
              <button type="submit" disabled={loading}
                className={`w-full min-h-11 py-3 border-none rounded-lg text-surface-0 text-sm font-bold flex items-center justify-center gap-2 ${
                  loading
                    ? 'bg-dv-gold-dim cursor-not-allowed'
                    : 'bg-gradient-to-r from-dv-gold to-dv-gold-dim cursor-pointer'
                }`}>
                {loading ? <><Loader2 size={16} className="animate-spin text-surface-0" /> Отправка...</> : 'Отправить ссылку'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleReset}>
              <div className="mb-3.5">
                <label className="block text-xs font-semibold text-txt-secondary mb-1.5">Токен сброса</label>
                <input type="text" value={token} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setToken(e.target.value)}
                  placeholder="Вставьте токен из письма" required autoFocus
                  className="w-full min-h-11 bg-surface-2 border border-dv-gold/20 rounded-lg px-3.5 py-2.5 text-sm text-txt-primary outline-none focus:border-dv-gold transition-colors font-mono" />
              </div>
              <div className="mb-3.5">
                <label className="block text-xs font-semibold text-txt-secondary mb-1.5">Новый пароль</label>
                <input type="password" value={newPassword} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
                  placeholder="Минимум 8 символов, буквы и цифры" required
                  className="w-full min-h-11 bg-surface-2 border border-dv-gold/20 rounded-lg px-3.5 py-2.5 text-sm text-txt-primary outline-none focus:border-dv-gold transition-colors" />
              </div>
              <div className="mb-5">
                <label className="block text-xs font-semibold text-txt-secondary mb-1.5">Подтвердите пароль</label>
                <input type="password" value={confirmPassword} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                  placeholder="Повторите пароль" required
                  className="w-full min-h-11 bg-surface-2 border border-dv-gold/20 rounded-lg px-3.5 py-2.5 text-sm text-txt-primary outline-none focus:border-dv-gold transition-colors" />
              </div>
              <button type="submit" disabled={loading}
                className={`w-full min-h-11 py-3 border-none rounded-lg text-surface-0 text-sm font-bold flex items-center justify-center gap-2 ${
                  loading
                    ? 'bg-dv-gold-dim cursor-not-allowed'
                    : 'bg-gradient-to-r from-dv-gold to-dv-gold-dim cursor-pointer'
                }`}>
                {loading ? <><Loader2 size={16} className="animate-spin text-surface-0" /> Сохранение...</> : 'Изменить пароль'}
              </button>
            </form>
          )}

          <div className="text-center mt-4">
            <button onClick={() => navigate('/login')} className="bg-transparent border-none text-dv-gold text-sm cursor-pointer underline">
              ← Вернуться к входу
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
