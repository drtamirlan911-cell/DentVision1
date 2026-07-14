import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { T, GLOBAL_CSS } from '../utils/constants';
import { rateLimit, validatePassword } from '../utils/security';
import { Spinner } from '../components/ui/BaseComponents';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState('request');
  const [login, setLogin] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleRequest = async (e) => {
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

  const handleReset = async (e) => {
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
    } catch (err) {
      setError(err.message || 'Ошибка при смене пароля');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{
        minHeight: '100vh', background: T.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: `radial-gradient(circle, ${T.gold}08 0%, transparent 70%)`, top: -100, right: -100, pointerEvents: 'none' }} />

        <div style={{
          width: '100%', maxWidth: 400,
          background: T.navy, border: `1px solid ${T.border}`,
          borderRadius: 18, padding: '36px 32px',
          boxShadow: '0 40px 80px rgba(0,0,0,.5)',
          position: 'relative', zIndex: 1,
        }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🔑</div>
            <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 22, fontWeight: 700, color: T.white, margin: 0 }}>
              {step === 'request' ? 'Сброс пароля' : 'Новый пароль'}
            </h1>
            <p style={{ fontSize: 12, color: T.slate, marginTop: 6 }}>
              {step === 'request' ? 'Введите ваш логин для получения токена' : 'Введите токен и новый пароль'}
            </p>
          </div>

          {error && (
            <div style={{
              background: `${T.ruby}15`, border: `1px solid ${T.ruby}30`,
              borderRadius: 9, padding: '10px 14px', marginBottom: 16,
              fontSize: 13, color: T.ruby,
            }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{
              background: `${T.emerald}15`, border: `1px solid ${T.emerald}30`,
              borderRadius: 9, padding: '10px 14px', marginBottom: 16,
              fontSize: 13, color: T.emerald,
            }}>
              {success}
            </div>
          )}

          {step === 'request' ? (
            <form onSubmit={handleRequest}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.slateL, marginBottom: 6 }}>Логин</label>
                <input type="text" value={login} onChange={e => setLogin(e.target.value)}
                  placeholder="admin_c1" required autoFocus
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${T.border}`, borderRadius: 9, padding: '11px 14px', fontSize: 14, color: T.white, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '13px',
                background: loading ? T.goldDim : `linear-gradient(135deg, ${T.gold}, ${T.goldDim})`,
                border: 'none', borderRadius: 9, color: T.bg, fontSize: 14, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                {loading ? <><Spinner size={16} color={T.bg} /> Отправка...</> : 'Получить токен'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleReset}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.slateL, marginBottom: 6 }}>Токен сброса</label>
                <input type="text" value={token} onChange={e => setToken(e.target.value)}
                  placeholder="Вставьте токен из письма" required autoFocus
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${T.border}`, borderRadius: 9, padding: '11px 14px', fontSize: 14, color: T.white, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', fontFamily: 'monospace' }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.slateL, marginBottom: 6 }}>Новый пароль</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="Минимум 6 символов" required
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${T.border}`, borderRadius: 9, padding: '11px 14px', fontSize: 14, color: T.white, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.slateL, marginBottom: 6 }}>Подтвердите пароль</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Повторите пароль" required
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${T.border}`, borderRadius: 9, padding: '11px 14px', fontSize: 14, color: T.white, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '13px',
                background: loading ? T.goldDim : `linear-gradient(135deg, ${T.gold}, ${T.goldDim})`,
                border: 'none', borderRadius: 9, color: T.bg, fontSize: 14, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                {loading ? <><Spinner size={16} color={T.bg} /> Сохранение...</> : 'Изменить пароль'}
              </button>
            </form>
          )}

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button onClick={() => navigate('/login')} style={{
              background: 'none', border: 'none', color: T.gold, fontSize: 13,
              cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline',
            }}>
              ← Вернуться к входу
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
