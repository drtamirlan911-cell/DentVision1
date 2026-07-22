import React, { useState } from 'react';
import { useAuth } from '@/store/auth.store';
import { Loader2, UserPlus, AlertTriangle, User, Stethoscope, Bot, GraduationCap, ShoppingBag } from 'lucide-react';

interface RegisterProps {
  onBack: () => void;
}

interface RegisterForm {
  name: string;
  firstName: string;
  lastName: string;
  login: string;
  email: string;
  phone: string;
  spec: string;
  city: string;
  password: string;
  confirmPassword: string;
}

export default function Register({ onBack }: RegisterProps) {
  const { register, loading, error } = useAuth();
  const [form, setForm] = useState<RegisterForm>({
    name: '', firstName: '', lastName: '', login: '', email: '', phone: '', spec: '', city: '', password: '', confirmPassword: '',
  });
  const [localError, setLocalError] = useState('');

  const set = (k: keyof RegisterForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setLocalError('');
    if (!form.name.trim()) { setLocalError('Введите имя'); return; }
    if (!form.login.trim() || form.login.length < 4) { setLocalError('Логин должен быть не менее 4 символов'); return; }
    if (form.password.length < 8) { setLocalError('Пароль должен быть не менее 8 символов'); return; }
    if (!/[A-Za-zА-Яа-я]/.test(form.password) || !/\d/.test(form.password)) {
      setLocalError('Пароль должен содержать буквы и цифры');
      return;
    }
    if (form.password !== form.confirmPassword) { setLocalError('Пароли не совпадают'); return; }
    const ok = await register({
      name: form.name,
      firstName: form.firstName,
      lastName: form.lastName,
      login: form.login,
      email: form.email,
      phone: form.phone,
      spec: form.spec,
      city: form.city,
      password: form.password,
    });
    if (ok) {
      // No clinic created — user lands in personal mode, then "Мои клиники"
      setTimeout(() => window.location.assign('/my-clinics'), 300);
    }
  };

  const displayError = error || localError;

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-5 relative overflow-hidden">
      <div className="absolute w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(201,169,110,0.06)_0%,transparent_70%)] -top-24 -right-24 pointer-events-none" />
      <div className="absolute w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(39,174,96,0.05)_0%,transparent_70%)] -bottom-20 -left-20 pointer-events-none" />

      <div className="w-full max-w-[480px] bg-surface-1 border border-dv-gold/15 rounded-[18px] py-9 px-8 shadow-[0_40px_80px_rgba(0,0,0,0.5)] relative z-10">
        <div className="text-center mb-7">
          <div className="mb-2.5 flex justify-center text-dv-gold">
            <UserPlus size={40} />
          </div>
          <h1 className="font-serif text-[22px] font-bold text-txt-primary m-0">
            Регистрация в DentVision
          </h1>
          <p className="text-xs text-txt-muted mt-1.5">
            Присоединяйтесь к экосистеме — это бесплатно
          </p>
        </div>

        {displayError && (
          <div className="bg-error/15 border border-error/30 rounded-lg px-3.5 py-2.5 mb-4 text-[13px] text-error flex items-center gap-2">
            <AlertTriangle size={16} />{displayError}
          </div>
        )}

          <div>
            <Field label="Имя *" value={form.name} onChange={(v) => set('name', v)} placeholder="Иван Иванов" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Имя (краткое)" value={form.firstName} onChange={(v) => set('firstName', v)} placeholder="Иван" />
              <Field label="Фамилия" value={form.lastName} onChange={(v) => set('lastName', v)} placeholder="Иванов" />
            </div>
            <Field label="Специализация" value={form.spec} onChange={(v) => set('spec', v)} placeholder="Ортопед, Терапевт, Хирург…" />
            <Field label="Город" value={form.city} onChange={(v) => set('city', v)} placeholder="Алматы" />
            <Field label="Логин *" value={form.login} onChange={(v) => set('login', v.toLowerCase().replace(/\s/g, '_'))} placeholder="doctor_ivan" hint="Только латиница, цифры, _ (мин. 4 символа)" />
            <Field label="Email" value={form.email} type="email" onChange={(v) => set('email', v)} placeholder="ivan@example.com" />
            <Field label="Телефон" value={form.phone} type="tel" onChange={(v) => set('phone', v)} placeholder="+7 777 000 00 00" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Пароль *" value={form.password} type="password" onChange={(v) => set('password', v)} placeholder="Минимум 8 символов, буквы и цифры" />
              <Field label="Повторите пароль *" value={form.confirmPassword} type="password" onChange={(v) => set('confirmPassword', v)} placeholder="••••••" />
            </div>
          </div>

          <div className="mt-4 p-3.5 bg-success/10 border border-success/20 rounded-[10px] text-xs text-txt-secondary leading-relaxed">
            После регистрации вы сразу получаете доступ к <span className="text-dv-gold">Магазину</span>, <span className="text-dv-gold">Академии</span> и <span className="text-dv-gold">AI-ассистенту</span>. Клинику можно создать или присоединиться к ней позже.
          </div>

          <div className="mt-6 flex gap-2.5">
            <button type="button" onClick={onBack} className="px-[18px] py-[11px] bg-white/[0.06] border border-bdr-subtle rounded-lg text-txt-muted text-[13px] cursor-pointer">
              ← Назад
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className={`flex-1 py-[11px] border-none rounded-lg text-surface-0 text-sm font-bold flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(201,169,110,0.3)] ${
                loading ? 'bg-dv-gold/60 cursor-not-allowed' : 'bg-gradient-to-r from-dv-gold to-[#8B6F3E] cursor-pointer'
              }`}
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Создаём аккаунт…</> : 'Создать аккаунт'}
            </button>
          </div>

          <div className="mt-5 grid grid-cols-4 gap-2">
            {[
              { icon: ShoppingBag, text: 'Магазин' },
              { icon: GraduationCap, text: 'Академия' },
              { icon: Bot, text: 'AI' },
              { icon: Stethoscope, text: 'CRM' },
            ].map((f, i) => (
              <div key={i} className="px-2 py-2 bg-white/[0.03] border border-bdr-subtle rounded-lg flex flex-col items-center gap-1 text-[10px] text-txt-secondary">
                <f.icon size={14} className="text-dv-gold" />{f.text}
              </div>
            ))}
          </div>
        </div>
      </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  hint?: string;
}

function Field({ label, value, onChange, placeholder, type = 'text', hint }: FieldProps) {
  return (
    <div className="mb-3.5">
      <label className="block text-xs font-semibold text-[#B0BEC5] mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/[0.06] border border-[rgba(201,169,110,0.15)] rounded-lg px-3.5 py-2.5 text-[13px] text-white outline-none focus:border-[#C9A96E] transition-colors"
      />
      {hint && <div className="text-[11px] text-[#7A8899] mt-1">{hint}</div>}
    </div>
  );
}
