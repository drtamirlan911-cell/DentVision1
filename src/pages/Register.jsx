import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { T, GLOBAL_CSS } from '../utils/constants';
import { Spinner } from '../components/ui/BaseComponents';

const STEPS = ['Клиника', 'Руководитель', 'Готово'];

export default function Register({ onBack }) {
  const { register, loading, error } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    clinicName: '', city: '', phone: '', email: '',
    directorName: '', login: '', password: '', confirmPassword: '',
  });
  const [localError, setLocalError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const nextStep = () => {
    setLocalError('');
    if (step === 0) {
      if (!form.clinicName.trim()) { setLocalError('Введите название клиники'); return; }
      setStep(1);
    } else if (step === 1) {
      if (!form.directorName.trim()) { setLocalError('Введите ФИО руководителя'); return; }
      if (!form.login.trim() || form.login.length < 4) { setLocalError('Логин должен быть не менее 4 символов'); return; }
      if (form.password.length < 6) { setLocalError('Пароль должен быть не менее 6 символов'); return; }
      if (form.password !== form.confirmPassword) { setLocalError('Пароли не совпадают'); return; }
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setLocalError('');
    const ok = await register(form);
    if (ok) setStep(2);
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
        {/* Decorations */}
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: `radial-gradient(circle, ${T.gold}06 0%, transparent 70%)`, top: -100, right: -100, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: `radial-gradient(circle, ${T.emerald}05 0%, transparent 70%)`, bottom: -80, left: -80, pointerEvents: 'none' }} />

        <div style={{
          width: '100%', maxWidth: 480,
          background: T.navy, border: `1px solid ${T.border}`,
          borderRadius: 18, padding: '36px 32px',
          boxShadow: '0 40px 80px rgba(0,0,0,.5)',
          position: 'relative', zIndex: 1,
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🦷</div>
            <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 22, fontWeight: 700, color: T.white, margin: 0 }}>
              Регистрация клиники
            </h1>
            <p style={{ fontSize: 12, color: T.slate, marginTop: 6 }}>
              Создайте аккаунт DentVision — бесплатно на 14 дней
            </p>
          </div>

          {/* Step indicators */}
          {step < 2 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
              {STEPS.slice(0, 2).map((s, i) => (
                <React.Fragment key={i}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: i <= step ? T.gold : 'rgba(255,255,255,0.08)',
                      border: `2px solid ${i <= step ? T.gold : T.borderSub}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700,
                      color: i <= step ? T.bg : T.slate,
                    }}>
                      {i < step ? '✓' : i + 1}
                    </div>
                    <span style={{ fontSize: 12, color: i === step ? T.gold : T.slate, fontWeight: i === step ? 600 : 400 }}>
                      {s}
                    </span>
                  </div>
                  {i < 1 && <div style={{ width: 30, height: 1, background: i < step ? T.gold : T.borderSub }} />}
                </React.Fragment>
              ))}
            </div>
          )}

          {/* Error */}
          {displayError && (
            <div style={{
              background: `${T.ruby}15`, border: `1px solid ${T.ruby}30`,
              borderRadius: 9, padding: '10px 14px', marginBottom: 18,
              fontSize: 13, color: T.ruby, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>⚠</span>{displayError}
            </div>
          )}

          {/* Step 0: Clinic info */}
          {step === 0 && (
            <div>
              <Field label="Название клиники *" value={form.clinicName}
                onChange={v => set('clinicName', v)} placeholder="Стоматология «Улыбка»" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Город *" value={form.city}
                  onChange={v => set('city', v)} placeholder="Алматы" />
                <Field label="Телефон" value={form.phone} type="tel"
                  onChange={v => set('phone', v)} placeholder="+7 777 000 00 00" />
              </div>
              <Field label="Email" value={form.email} type="email"
                onChange={v => set('email', v)} placeholder="clinic@example.com" />

              {/* Plans preview */}
              <div style={{
                marginTop: 16, padding: '12px 14px',
                background: `${T.emerald}08`, border: `1px solid ${T.emerald}20`,
                borderRadius: 10,
              }}>
                <div style={{ fontSize: 12, color: T.emerald, fontWeight: 700, marginBottom: 6 }}>
                  🎁 Пробный период — 14 дней бесплатно
                </div>
                <div style={{ fontSize: 11, color: T.slateL, lineHeight: 1.6 }}>
                  Тариф Starter: до 2 врачей, расписание, пациенты, касса.
                  Затем от 15 000 ₸/мес.
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Director account */}
          {step === 1 && (
            <div>
              <div style={{
                padding: '12px 14px', background: `${T.gold}08`,
                border: `1px solid ${T.gold}20`, borderRadius: 10, marginBottom: 18,
                fontSize: 12, color: T.slateL,
              }}>
                👔 Данные <span style={{ color: T.gold }}>руководителя</span> — человека, который будет управлять клиникой
              </div>
              <Field label="ФИО руководителя *" value={form.directorName}
                onChange={v => set('directorName', v)} placeholder="Иванов Иван Иванович" />
              <Field label="Логин для входа *" value={form.login}
                onChange={v => set('login', v.toLowerCase().replace(/\s/g, '_'))}
                placeholder="director_clinic" hint="Только латиница, цифры, _ (мин. 4 символа)" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Пароль *" value={form.password} type="password"
                  onChange={v => set('password', v)} placeholder="Минимум 6 символов" />
                <Field label="Повторите пароль *" value={form.confirmPassword} type="password"
                  onChange={v => set('confirmPassword', v)} placeholder="••••••" />
              </div>
            </div>
          )}

          {/* Step 2: Success */}
          {step === 2 && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 60, marginBottom: 16 }}>🎉</div>
              <h2 style={{ fontFamily: 'Georgia,serif', fontSize: 20, color: T.white, marginBottom: 10 }}>
                Клиника зарегистрирована!
              </h2>
              <p style={{ fontSize: 13, color: T.slateL, marginBottom: 20, lineHeight: 1.6 }}>
                Добро пожаловать в <span style={{ color: T.gold }}>DentVision</span>.
                Ваша 14-дневная пробная версия активирована.
              </p>
              <div style={{
                padding: '14px 18px', background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${T.borderSub}`, borderRadius: 10,
                textAlign: 'left', marginBottom: 24,
              }}>
                <div style={{ fontSize: 11, color: T.slate, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                  Данные вашего аккаунта
                </div>
                {[
                  { label: 'Клиника', value: form.clinicName },
                  { label: 'Логин',   value: form.login },
                  { label: 'Роль',    value: 'Руководитель' },
                ].map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: i < 2 ? `1px solid ${T.borderSub}` : 'none' }}>
                    <span style={{ fontSize: 12, color: T.slate }}>{r.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.white }}>{r.value}</span>
                  </div>
                ))}
              </div>
              {/* Auto-login happens via AuthContext, so the app will render */}
              <div style={{ fontSize: 12, color: T.emerald }}>
                ✓ Вы уже вошли в систему — переход в панель управления...
              </div>
            </div>
          )}

          {/* Actions */}
          {step < 2 && (
            <div style={{ marginTop: 24, display: 'flex', gap: 10 }}>
              <button
                onClick={onBack}
                style={{
                  padding: '11px 18px', background: 'rgba(255,255,255,0.06)',
                  border: `1px solid ${T.borderSub}`, borderRadius: 9,
                  color: T.slate, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                ← Назад
              </button>
              <button
                onClick={nextStep}
                disabled={loading}
                style={{
                  flex: 1, padding: '11px',
                  background: loading ? T.goldDim : `linear-gradient(135deg, ${T.gold}, ${T.goldDim})`,
                  border: 'none', borderRadius: 9,
                  color: T.bg, fontSize: 14, fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontFamily: 'inherit',
                  boxShadow: `0 4px 16px ${T.gold}30`,
                }}
              >
                {loading ? <><Spinner size={16} color={T.bg} /> Создаём аккаунт…</> :
                  step === 0 ? 'Далее →' : '🚀 Создать аккаунт'}
              </button>
            </div>
          )}

          {/* Benefits */}
          {step === 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { icon: '🦷', text: '3D Одонтограмма' },
                  { icon: '📅', text: 'Умное расписание' },
                  { icon: '💰', text: 'Финансовый учёт' },
                  { icon: '🤖', text: 'AI-ассистент' },
                ].map((f, i) => (
                  <div key={i} style={{
                    padding: '8px 10px', background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${T.borderSub}`, borderRadius: 8,
                    display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.slateL,
                  }}>
                    <span>{f.icon}</span>{f.text}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', hint }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.slateL, marginBottom: 6 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', background: 'rgba(255,255,255,0.06)',
          border: `1px solid ${T.border}`, borderRadius: 9,
          padding: '10px 13px', fontSize: 13, color: T.white,
          outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
        }}
        onFocus={e => e.target.style.borderColor = T.gold}
        onBlur={e => e.target.style.borderColor = T.border}
      />
      {hint && <div style={{ fontSize: 11, color: T.slate, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}
