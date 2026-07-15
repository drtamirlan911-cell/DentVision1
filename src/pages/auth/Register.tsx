import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { GLOBAL_CSS } from '../../utils/constants';
import { Loader2, Stethoscope, AlertTriangle, Check, Calendar, DollarSign, Bot, CheckCircle2 } from 'lucide-react';

const STEPS = ['╨Ъ╨╗╨╕╨╜╨╕╨║╨░', '╨а╤Г╨║╨╛╨▓╨╛╨┤╨╕╤В╨╡╨╗╤М', '╨У╨╛╤В╨╛╨▓╨╛'];

interface RegisterProps {
  onBack: () => void;
}

interface RegisterForm {
  clinicName: string;
  city: string;
  phone: string;
  email: string;
  directorName: string;
  login: string;
  password: string;
  confirmPassword: string;
}

export default function Register({ onBack }: RegisterProps) {
  const { register, loading, error } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<RegisterForm>({
    clinicName: '', city: '', phone: '', email: '',
    directorName: '', login: '', password: '', confirmPassword: '',
  });
  const [localError, setLocalError] = useState('');

  const set = (k: keyof RegisterForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  const nextStep = () => {
    setLocalError('');
    if (step === 0) {
      if (!form.clinicName.trim()) { setLocalError('╨Т╨▓╨╡╨┤╨╕╤В╨╡ ╨╜╨░╨╖╨▓╨░╨╜╨╕╨╡ ╨║╨╗╨╕╨╜╨╕╨║╨╕'); return; }
      setStep(1);
    } else if (step === 1) {
      if (!form.directorName.trim()) { setLocalError('╨Т╨▓╨╡╨┤╨╕╤В╨╡ ╨д╨Ш╨Ю ╤А╤Г╨║╨╛╨▓╨╛╨┤╨╕╤В╨╡╨╗╤П'); return; }
      if (!form.login.trim() || form.login.length < 4) { setLocalError('╨Ы╨╛╨│╨╕╨╜ ╨┤╨╛╨╗╨╢╨╡╨╜ ╨▒╤Л╤В╤М ╨╜╨╡ ╨╝╨╡╨╜╨╡╨╡ 4 ╤Б╨╕╨╝╨▓╨╛╨╗╨╛╨▓'); return; }
      if (form.password.length < 6) { setLocalError('╨Я╨░╤А╨╛╨╗╤М ╨┤╨╛╨╗╨╢╨╡╨╜ ╨▒╤Л╤В╤М ╨╜╨╡ ╨╝╨╡╨╜╨╡╨╡ 6 ╤Б╨╕╨╝╨▓╨╛╨╗╨╛╨▓'); return; }
      if (form.password !== form.confirmPassword) { setLocalError('╨Я╨░╤А╨╛╨╗╨╕ ╨╜╨╡ ╤Б╨╛╨▓╨┐╨░╨┤╨░╤О╤В'); return; }
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
      <div className="min-h-screen bg-[#080F1A] flex items-center justify-center p-5 relative overflow-hidden">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,#C9A96E06_0%,transparent_70%)] -top-24 -right-24 pointer-events-none" />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,#27AE6005_0%,transparent_70%)] -bottom-20 -left-20 pointer-events-none" />

        <div className="w-full max-w-[480px] bg-[#0D1B2E] border border-[rgba(201,169,110,0.15)] rounded-[18px] py-9 px-8 shadow-[0_40px_80px_rgba(0,0,0,0.5)] relative z-10">
          <div className="text-center mb-7">
            <div className="mb-2.5 flex justify-center text-[#C9A96E]">
              <Stethoscope size={40} />
            </div>
            <h1 className="font-['Georgia',serif] text-[22px] font-bold text-white m-0">
              ╨а╨╡╨│╨╕╤Б╤В╤А╨░╤Ж╨╕╤П ╨║╨╗╨╕╨╜╨╕╨║╨╕
            </h1>
            <p className="text-xs text-[#7A8899] mt-1.5">
              ╨б╨╛╨╖╨┤╨░╨╣╤В╨╡ ╨░╨║╨║╨░╤Г╨╜╤В DentVision тАФ ╨▒╨╡╤Б╨┐╨╗╨░╤В╨╜╨╛ ╨╜╨░ 14 ╨┤╨╜╨╡╨╣
            </p>
          </div>

          {step < 2 && (
            <div className="flex items-center justify-center gap-2 mb-7">
              {STEPS.slice(0, 2).map((s, i) => (
                <React.Fragment key={i}>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                      i <= step
                        ? 'bg-[#C9A96E] border-[#C9A96E] text-[#080F1A]'
                        : 'bg-white/[0.08] border-[rgba(255,255,255,0.06)] text-[#7A8899]'
                    }`}>
                      {i < step ? <Check size={14} /> : i + 1}
                    </div>
                    <span className={`text-xs ${i === step ? 'text-[#C9A96E] font-semibold' : 'text-[#7A8899]'}`}>
                      {s}
                    </span>
                  </div>
                  {i < 1 && <div className={`w-[30px] h-px ${i < step ? 'bg-[#C9A96E]' : 'bg-[rgba(255,255,255,0.06)]'}`} />}
                </React.Fragment>
              ))}
            </div>
          )}

          {displayError && (
            <div className="bg-[#E74C3C]/15 border border-[#E74C3C]/30 rounded-lg px-3.5 py-2.5 mb-4 text-[13px] text-[#E74C3C] flex items-center gap-2">
              <AlertTriangle size={16} />{displayError}
            </div>
          )}

          {step === 0 && (
            <div>
              <Field label="╨Э╨░╨╖╨▓╨░╨╜╨╕╨╡ ╨║╨╗╨╕╨╜╨╕╨║╨╕ *" value={form.clinicName}
                onChange={(v: string) => set('clinicName', v)} placeholder="╨б╤В╨╛╨╝╨░╤В╨╛╨╗╨╛╨│╨╕╤П ┬л╨г╨╗╤Л╨▒╨║╨░┬╗" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="╨У╨╛╤А╨╛╨┤ *" value={form.city}
                  onChange={(v: string) => set('city', v)} placeholder="╨Р╨╗╨╝╨░╤В╤Л" />
                <Field label="╨в╨╡╨╗╨╡╤Д╨╛╨╜" value={form.phone} type="tel"
                  onChange={(v: string) => set('phone', v)} placeholder="+7 777 000 00 00" />
              </div>
              <Field label="Email" value={form.email} type="email"
                onChange={(v: string) => set('email', v)} placeholder="clinic@example.com" />

              <div className="mt-4 p-3.5 bg-[#27AE60]/[0.08] border border-[#27AE60]/20 rounded-[10px]">
                <div className="text-xs text-[#27AE60] font-bold mb-1.5">
                  ╨Я╤А╨╛╨▒╨╜╤Л╨╣ ╨┐╨╡╤А╨╕╨╛╨┤ тАФ 14 ╨┤╨╜╨╡╨╣ ╨▒╨╡╤Б╨┐╨╗╨░╤В╨╜╨╛
                </div>
                <div className="text-[11px] text-[#B0BEC5] leading-relaxed">
                  ╨в╨░╤А╨╕╤Д Starter: ╨┤╨╛ 2 ╨▓╤А╨░╤З╨╡╨╣, ╤А╨░╤Б╨┐╨╕╤Б╨░╨╜╨╕╨╡, ╨┐╨░╤Ж╨╕╨╡╨╜╤В╤Л, ╨║╨░╤Б╤Б╨░.
                  ╨Ч╨░╤В╨╡╨╝ ╨╛╤В 15 000 тВ╕/╨╝╨╡╤Б.
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="p-3.5 bg-[#C9A96E]/[0.08] border border-[#C9A96E]/20 rounded-[10px] mb-4 text-xs text-[#B0BEC5]">
                ╨Ф╨░╨╜╨╜╤Л╨╡ <span className="text-[#C9A96E]">╤А╤Г╨║╨╛╨▓╨╛╨┤╨╕╤В╨╡╨╗╤П</span> тАФ ╤З╨╡╨╗╨╛╨▓╨╡╨║╨░, ╨║╨╛╤В╨╛╤А╤Л╨╣ ╨▒╤Г╨┤╨╡╤В ╤Г╨┐╤А╨░╨▓╨╗╤П╤В╤М ╨║╨╗╨╕╨╜╨╕╨║╨╛╨╣
              </div>
              <Field label="╨д╨Ш╨Ю ╤А╤Г╨║╨╛╨▓╨╛╨┤╨╕╤В╨╡╨╗╤П *" value={form.directorName}
                onChange={(v: string) => set('directorName', v)} placeholder="╨Ш╨▓╨░╨╜╨╛╨▓ ╨Ш╨▓╨░╨╜ ╨Ш╨▓╨░╨╜╨╛╨▓╨╕╤З" />
              <Field label="╨Ы╨╛╨│╨╕╨╜ ╨┤╨╗╤П ╨▓╤Е╨╛╨┤╨░ *" value={form.login}
                onChange={(v: string) => set('login', v.toLowerCase().replace(/\s/g, '_'))}
                placeholder="director_clinic" hint="╨в╨╛╨╗╤М╨║╨╛ ╨╗╨░╤В╨╕╨╜╨╕╤Ж╨░, ╤Ж╨╕╤Д╤А╤Л, _ (╨╝╨╕╨╜. 4 ╤Б╨╕╨╝╨▓╨╛╨╗╨░)" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="╨Я╨░╤А╨╛╨╗╤М *" value={form.password} type="password"
                  onChange={(v: string) => set('password', v)} placeholder="╨Ь╨╕╨╜╨╕╨╝╤Г╨╝ 6 ╤Б╨╕╨╝╨▓╨╛╨╗╨╛╨▓" />
                <Field label="╨Я╨╛╨▓╤В╨╛╤А╨╕╤В╨╡ ╨┐╨░╤А╨╛╨╗╤М *" value={form.confirmPassword} type="password"
                  onChange={(v: string) => set('confirmPassword', v)} placeholder="тАвтАвтАвтАвтАвтАв" />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="text-center py-5">
              <div className="mb-4 flex justify-center text-[#27AE60]">
                <CheckCircle2 size={60} />
              </div>
              <h2 className="font-['Georgia',serif] text-xl text-white mb-2.5">
                ╨Ъ╨╗╨╕╨╜╨╕╨║╨░ ╨╖╨░╤А╨╡╨│╨╕╤Б╤В╤А╨╕╤А╨╛╨▓╨░╨╜╨░!
              </h2>
              <p className="text-[13px] text-[#B0BEC5] mb-5 leading-relaxed">
                ╨Ф╨╛╨▒╤А╨╛ ╨┐╨╛╨╢╨░╨╗╨╛╨▓╨░╤В╤М ╨▓ <span className="text-[#C9A96E]">DentVision</span>.
                ╨Т╨░╤И╨░ 14-╨┤╨╜╨╡╨▓╨╜╨░╤П ╨┐╤А╨╛╨▒╨╜╨░╤П ╨▓╨╡╤А╤Б╨╕╤П ╨░╨║╤В╨╕╨▓╨╕╤А╨╛╨▓╨░╨╜╨░.
              </p>
              <div className="px-4 py-3.5 bg-white/[0.04] border border-[rgba(255,255,255,0.06)] rounded-[10px] text-left mb-6">
                <div className="text-[11px] text-[#7A8899] uppercase tracking-[0.06em] mb-2.5">
                  ╨Ф╨░╨╜╨╜╤Л╨╡ ╨▓╨░╤И╨╡╨│╨╛ ╨░╨║╨║╨░╤Г╨╜╤В╨░
                </div>
                {[
                  { label: '╨Ъ╨╗╨╕╨╜╨╕╨║╨░', value: form.clinicName },
                  { label: '╨Ы╨╛╨│╨╕╨╜',   value: form.login },
                  { label: '╨а╨╛╨╗╤М',    value: '╨а╤Г╨║╨╛╨▓╨╛╨┤╨╕╤В╨╡╨╗╤М' },
                ].map((r, i) => (
                  <div key={i} className={`flex justify-between py-[5px] ${i < 2 ? 'border-b border-[rgba(255,255,255,0.06)]' : ''}`}>
                    <span className="text-xs text-[#7A8899]">{r.label}</span>
                    <span className="text-xs font-semibold text-white">{r.value}</span>
                  </div>
                ))}
              </div>
              <div className="text-xs text-[#27AE60]">
                ╨Т╤Л ╤Г╨╢╨╡ ╨▓╨╛╤И╨╗╨╕ ╨▓ ╤Б╨╕╤Б╤В╨╡╨╝╤Г тАФ ╨┐╨╡╤А╨╡╤Е╨╛╨┤ ╨▓ ╨┐╨░╨╜╨╡╨╗╤М ╤Г╨┐╤А╨░╨▓╨╗╨╡╨╜╨╕╤П...
              </div>
            </div>
          )}

          {step < 2 && (
            <div className="mt-6 flex gap-2.5">
              <button
                onClick={onBack}
                className="px-[18px] py-[11px] bg-white/[0.06] border border-[rgba(255,255,255,0.06)] rounded-lg text-[#7A8899] text-[13px] cursor-pointer"
              >
                тЖР ╨Э╨░╨╖╨░╨┤
              </button>
              <button
                onClick={nextStep}
                disabled={loading}
                className={`flex-1 py-[11px] border-none rounded-lg text-[#080F1A] text-sm font-bold flex items-center justify-center gap-2 shadow-[0_4px_16px_#C9A96E30] ${
                  loading
                    ? 'bg-[#8B6F3E] cursor-not-allowed'
                    : 'bg-gradient-to-r from-[#C9A96E] to-[#8B6F3E] cursor-pointer'
                }`}
              >
                {loading ? <><Loader2 size={16} className="animate-spin text-[#080F1A]" /> ╨б╨╛╨╖╨┤╨░╤С╨╝ ╨░╨║╨║╨░╤Г╨╜╤ВтАж</> :
                  step === 0 ? '╨Ф╨░╨╗╨╡╨╡ тЖТ' : '╨б╨╛╨╖╨┤╨░╤В╤М ╨░╨║╨║╨░╤Г╨╜╤В'}
              </button>
            </div>
          )}

          {step === 0 && (
            <div className="mt-5">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: Stethoscope, text: '3D ╨Ю╨┤╨╛╨╜╤В╨╛╨│╤А╨░╨╝╨╝╨░' },
                  { icon: Calendar, text: '╨г╨╝╨╜╨╛╨╡ ╤А╨░╤Б╨┐╨╕╤Б╨░╨╜╨╕╨╡' },
                  { icon: DollarSign, text: '╨д╨╕╨╜╨░╨╜╤Б╨╛╨▓╤Л╨╣ ╤Г╤З╤С╤В' },
                  { icon: Bot, text: 'AI-╨░╤Б╤Б╨╕╤Б╤В╨╡╨╜╤В' },
                ].map((f, i) => (
                  <div key={i} className="px-2.5 py-2 bg-white/[0.03] border border-[rgba(255,255,255,0.06)] rounded-lg flex items-center gap-2 text-xs text-[#B0BEC5]">
                    <f.icon size={14} />{f.text}
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
      <label className="block text-xs font-semibold text-[#B0BEC5] mb-1.5">
        {label}
      </label>
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
