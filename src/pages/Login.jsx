import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Register from './Register';
import { T, GLOBAL_CSS } from '../utils/constants';
import { Spinner } from '../components/ui/BaseComponents';

export default function Login() {
  const navigate = useNavigate();
  const { user, login, loading, error } = useAuth();
  const [loginStr, setLoginStr] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  if (showRegister) return <Register onBack={() => setShowRegister(false)} />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    if (!loginStr.trim() || !password.trim()) {
      setLocalError('Введите логин и пароль');
      return;
    }
    await login(loginStr.trim(), password);
  };

  const displayError = error || localError;

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{
        minHeight: '100vh', background: T.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: `radial-gradient(circle, ${T.gold}08 0%, transparent 70%)`, top: -100, right: -100, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: `radial-gradient(circle, ${T.sapphire}06 0%, transparent 70%)`, bottom: -80, left: -80, pointerEvents: 'none' }} />

        <div style={{
          width: '100%', maxWidth: 400,
          background: T.navy, border: `1px solid ${T.border}`,
          borderRadius: 18, padding: '36px 32px',
          boxShadow: '0 40px 80px rgba(0,0,0,.5)',
          position: 'relative', zIndex: 1,
        }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 44, marginBottom: 12, filter: 'drop-shadow(0 4px 12px rgba(201,169,110,0.4))' }}>🦷</div>
            <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 26, fontWeight: 700, color: T.white, margin: 0, letterSpacing: '-0.02em' }}>
              DentVision
            </h1>
            <p style={{ fontSize: 13, color: T.slate, marginTop: 6 }}>CRM-система для стоматологических клиник</p>
          </div>

          {displayError && (
            <div style={{
              background: `${T.ruby}15`, border: `1px solid ${T.ruby}30`,
              borderRadius: 9, padding: '10px 14px', marginBottom: 18,
              fontSize: 13, color: T.ruby, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>⚠</span>{displayError}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.slateL, marginBottom: 6 }}>Логин</label>
              <input
                type="text" value={loginStr} onChange={e => setLoginStr(e.target.value)}
                placeholder="admin_c1" autoComplete="username" required
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${T.border}`, borderRadius: 9, padding: '11px 14px', fontSize: 14, color: T.white, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = T.gold}
                onBlur={e => e.target.style.borderColor = T.border}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.slateL, marginBottom: 6 }}>Пароль</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" autoComplete="current-password" required
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${T.border}`, borderRadius: 9, padding: '11px 14px', fontSize: 14, color: T.white, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = T.gold}
                onBlur={e => e.target.style.borderColor = T.border}
              />
            </div>

            <button
              type="submit" disabled={loading}
              style={{
                width: '100%', padding: '13px',
                background: loading ? T.goldDim : `linear-gradient(135deg, ${T.gold}, ${T.goldDim})`,
                border: 'none', borderRadius: 9, color: T.bg, fontSize: 14, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: loading ? 'none' : `0 6px 20px ${T.gold}35`,
                fontFamily: 'inherit',
              }}
            >
              {loading ? <><Spinner size={16} color={T.bg} /> Вход…</> : 'Войти в систему'}
            </button>
          </form>

          {/* Register CTA */}
          <div style={{
            marginTop: 16,
            padding: '14px 16px',
            background: `${T.emerald}08`,
            border: `1px solid ${T.emerald}20`,
            borderRadius: 10,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 12, color: T.emerald, fontWeight: 700 }}>Новая клиника?</div>
              <div style={{ fontSize: 11, color: T.slate }}>14 дней бесплатно</div>
            </div>
            <button
              onClick={() => setShowRegister(true)}
              style={{
                padding: '7px 14px', background: `${T.emerald}20`,
                border: `1px solid ${T.emerald}40`, borderRadius: 8,
                color: T.emerald, fontSize: 12, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
              }}
            >
              Зарегистрироваться →
            </button>
          </div>

          {/* Demo credentials */}
          <div style={{ marginTop: 14, padding: '14px 16px', background: `${T.gold}08`, border: `1px solid ${T.border}`, borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: T.gold, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Demo-доступ
            </div>
            {[
              { login: 'admin_c1',  pass: 'admin123',        role: 'Администратор' },
              { login: 'doc1_c1',  pass: 'doc123',           role: 'Врач-терапевт' },
              { login: 'dr.tamirlan', pass: 'DentVision2025!', role: 'Super Admin' },
            ].map((d, i) => (
              <button
                key={i}
                onClick={() => { setLoginStr(d.login); setPassword(d.pass); }}
                style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer', color: T.slateL, fontSize: 12, fontFamily: 'inherit' }}
              >
                <span style={{ color: T.gold, fontWeight: 600 }}>{d.login}</span>
                <span style={{ color: T.slate }}> / {d.pass}</span>
                <span style={{ color: T.slate, fontStyle: 'italic' }}> — {d.role}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
