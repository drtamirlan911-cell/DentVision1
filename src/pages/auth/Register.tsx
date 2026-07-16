import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { GLOBAL_CSS } from '../../utils/constants';
import { Loader2, UserPlus, AlertTriangle, Check, User, Stethoscope, Bot, GraduationCap, ShoppingBag } from 'lucide-react';

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
    if (form.password.length < 6) { setLocalError('Пароль должен быть не менее 6 символов'); return; }
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
    <>
      <style>{GLOBAL_CSS}</style>
      <div className="min-h-screen bg-[#080F1A] flex items-center justify-center p-5 relative overflow-hidden">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,#C9A96E06_0%,transparent_70%)] -top-24 -right-24 pointer-events-none" />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,#27AE6005_0%,transparent_70%)] -bottom-20 -left-20 pointer-events-none" />

        <div className="w-full max-w-[480px] bg-[#0D1B2E] border border-[rgba(201,169,110,0.15)] rounded-[18px] py-9 px-8 shadow-[0_40px_80px_rgba(0,0,0,0.5)] relative z-10">
          <div className="text-center mb-7">
            <div className="mb-2.5 flex justify-center text-[#C9A96E]">
              <UserPlus size={40} />
            </div>
            <h1 className="font-['Georgia',serif] text-[22px] font-bold text-white m-0">
              Регистрация в DentVision
            </h1>
            <p className="text-xs text-[#7A8899] mt-1.5">
              Присоединяйтесь к экосистеме — это бесплатно
            </p>
          </div>

          {displayError && (
            <div className="bg-[#E74C3C]/15 border border-[#E74C3C]/30 rounded-lg px-3.5 py-2.5 mb-4 text-[13px] text-[#E74C3C] flex items-center gap-2">
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
              <Field label="Пароль *" value={form.password} type="password" onChange={(v) => set('password', v)} placeholder="Минимум 6 символов" />
              <Field label="Повторите пароль *" value={form.confirmPassword} type="password" onChange={(v) => set('confirmPassword', v)} placeholder="••••••" />
            </div>
          </div>

          <div className="mt-4 p-3.5 bg-[#27AE60]/[0.08] border border-[#27AE60]/20 rounded-[10px] text-xs text-[#B0BEC5] leading-relaxed">
            После регистрации вы сразу получаете доступ к <span className="text-[#C9A96E]">Магазину</span>, <span className="text-[#C9A96E]">Академии</span> и <span className="text-[#C9A96E]">AI-ассистенту</span>. Клинику можно создать или присоединиться к ней позже.
          </div>

          <div className="mt-6 flex gap-2.5">
            <button onClick={onBack} className="px-[18px] py-[11px] bg-white/[0.06] border border-[rgba(255,255,255,0.06)] rounded-lg text-[#7A8899] text-[13px] cursor-pointer">
              ← Назад
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className={`flex-1 py-[11px] border-none rounded-lg text-[#080F1A] text-sm font-bold flex items-center justify-center gap-2 shadow-[0_4px_16px_#C9A96E30] ${
                loading ? 'bg-[#8B6F3E] cursor-not-allowed' : 'bg-gradient-to-r from-[#C9A96E] to-[#8B6F3E] cursor-pointer'
              }`}
            >
              {loading ? <><Loader2 size={16} className="animate-spin text-[#080F1A]" /> Создаём аккаунт…</> : 'Создать аккаунт'}
            </button>
          </div>

          <div className="mt-5 grid grid-cols-4 gap-2">
            {[
              { icon: ShoppingBag, text: 'Магазин' },
              { icon: GraduationCap, text: 'Академия' },
              { icon: Bot, text: 'AI' },
              { icon: Stethoscope, text: 'CRM' },
            ].map((f, i) => (
              <div key={i} className="px-2 py-2 bg-white/[0.03] border border-[rgba(255,255,255,0.06)] rounded-lg flex flex-col items-center gap-1 text-[10px] text-[#B0BEC5]">
                <f.icon size={14} className="text-[#C9A96E]" />{f.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
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
