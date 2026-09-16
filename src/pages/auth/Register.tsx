import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiRequest, setTokens } from '@/utils/api';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { Loader2, UserPlus, AlertTriangle } from 'lucide-react';

interface RegisterProps { onBack: () => void; }
interface RegisterForm { name: string; firstName: string; lastName: string; login: string; email: string; phone: string; spec: string; city: string; clinicName: string; password: string; confirmPassword: string; }

const ROLE_COPY: Record<string, { title: string; subtitle: string }> = {
  doctor: { title: 'Создать аккаунт врача', subtitle: 'AI Workspace, клинический контекст и инструменты DentVision.' },
  patient: { title: 'Создать аккаунт пациента', subtitle: 'Врачи, клиники, диагностика, покупки и личный кабинет.' },
  owner: { title: 'Создать аккаунт владельца', subtitle: 'Создайте аккаунт и клинику сразу. После регистрации владелец получает реальное членство OWNER.' },
  admin: { title: 'Подключить администратора', subtitle: 'Администратор подключается к клинике по приглашению владельца или другого уполномоченного сотрудника.' },
  lab: { title: 'Создать аккаунт лаборатории', subtitle: 'Заказы клиник, производство, сроки и контроль готовности.' },
  laboratory: { title: 'Создать аккаунт лаборатории', subtitle: 'Заказы клиник, производство, сроки и контроль готовности.' },
  diagnostic_center: { title: 'Создать аккаунт диагностического центра', subtitle: 'Создание учётной записи выполняется сейчас; подключение центра к партнёрскому контуру проходит отдельным workflow.' },
  student: { title: 'Создать аккаунт студента', subtitle: 'Академия, обучение и личный прогресс.' },
};

export default function Register({ onBack }: RegisterProps) {
  const [params] = useSearchParams();
  const role = params.get('role') || '';
  const copy = ROLE_COPY[role] || { title: 'Создать аккаунт DentVision', subtitle: 'Один аккаунт для экосистемы DentVision.' };
  const [form, setForm] = useState<RegisterForm>({ name: '', firstName: '', lastName: '', login: '', email: '', phone: '', spec: '', city: '', clinicName: '', password: '', confirmPassword: '' });
  const [localError, setLocalError] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const set = (k: keyof RegisterForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setLocalError('');
    if (role === 'admin') { setLocalError('Администратор подключается к существующей клинике по приглашению владельца.'); return; }
    if (!form.name.trim()) { setLocalError('Введите имя'); return; }
    if (!form.login.trim() || form.login.length < 4) { setLocalError('Логин должен быть не менее 4 символов'); return; }
    if (!form.email.trim()) { setLocalError('Введите email'); return; }
    if (role === 'owner' && !form.clinicName.trim()) { setLocalError('Введите название клиники'); return; }
    if (form.password.length < 8) { setLocalError('Пароль должен быть не менее 8 символов'); return; }
    if (!/[A-Za-zА-Яа-я]/.test(form.password) || !/\d/.test(form.password)) { setLocalError('Пароль должен содержать буквы и цифры'); return; }
    if (form.password !== form.confirmPassword) { setLocalError('Пароли не совпадают'); return; }
    if (!agreed) { setLocalError('Нужно согласиться с условиями использования'); return; }
    setLoading(true);
    try {
      const parts = form.name.trim().split(/\s+/).filter(Boolean);
      const result = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          password: form.password,
          firstName: form.firstName.trim() || parts[0] || 'Пользователь',
          lastName: form.lastName.trim() || parts.slice(1).join(' '),
          phone: form.phone.trim() || undefined,
          role: role || 'student',
        }),
      });
      if (!result?.accessToken) throw new Error('Сервер не вернул токен авторизации');
      setTokens(result.accessToken, result.refreshToken || null);

      if (role === 'owner') {
        await apiRequest('/api/clinics', {
          method: 'POST',
          body: JSON.stringify({
            name: form.clinicName.trim(),
            city: form.city.trim() || undefined,
            phone: form.phone.trim() || undefined,
          }),
        });
      }

      window.location.assign('/ai');
    } catch (err) {
      setLocalError((err as Error)?.message || 'Не удалось завершить регистрацию');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen min-h-[100dvh] bg-surface-0 text-txt-primary flex items-center justify-center p-4 overflow-y-auto">
      <section className="w-full max-w-xl rounded-3xl border border-dv-gold/20 bg-surface-1 p-6 sm:p-8 shadow-[0_40px_100px_rgba(0,0,0,.45)]">
        <button type="button" onClick={onBack} className="text-xs text-txt-muted hover:text-txt-primary">← Вернуться</button>
        <div className="mt-5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-dv-gold/25 bg-dv-gold/10 text-dv-gold"><UserPlus size={22} /></div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">{copy.title}</h1>
          <p className="mt-2 text-xs leading-5 text-txt-muted">{copy.subtitle}</p>
        </div>
        {localError && <div className="mt-5 flex gap-2 rounded-xl border border-error/25 bg-error/10 px-3 py-2.5 text-xs text-error"><AlertTriangle size={15} />{localError}</div>}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-xs"><span className="mb-1.5 block text-txt-secondary">Имя и фамилия</span><input value={form.name} onChange={e => set('name', e.target.value)} className="w-full rounded-xl border border-bdr-subtle bg-surface-0 px-3 py-3 outline-none focus:border-dv-gold/50" /></label>
          <label className="text-xs"><span className="mb-1.5 block text-txt-secondary">Логин</span><input value={form.login} onChange={e => set('login', e.target.value)} className="w-full rounded-xl border border-bdr-subtle bg-surface-0 px-3 py-3 outline-none focus:border-dv-gold/50" /></label>
          <label className="text-xs"><span className="mb-1.5 block text-txt-secondary">Email</span><input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="w-full rounded-xl border border-bdr-subtle bg-surface-0 px-3 py-3 outline-none focus:border-dv-gold/50" /></label>
          <label className="text-xs"><span className="mb-1.5 block text-txt-secondary">Телефон</span><input value={form.phone} onChange={e => set('phone', e.target.value)} className="w-full rounded-xl border border-bdr-subtle bg-surface-0 px-3 py-3 outline-none focus:border-dv-gold/50" /></label>
          {role === 'owner' && <label className="text-xs sm:col-span-2"><span className="mb-1.5 block text-txt-secondary">Название клиники</span><input value={form.clinicName} onChange={e => set('clinicName', e.target.value)} placeholder="Например, DentVision Clinic" className="w-full rounded-xl border border-bdr-subtle bg-surface-0 px-3 py-3 outline-none focus:border-dv-gold/50" /></label>}
          {role === 'owner' && <label className="text-xs"><span className="mb-1.5 block text-txt-secondary">Город</span><input value={form.city} onChange={e => set('city', e.target.value)} placeholder="Астана" className="w-full rounded-xl border border-bdr-subtle bg-surface-0 px-3 py-3 outline-none focus:border-dv-gold/50" /></label>}
          <label className="text-xs"><span className="mb-1.5 block text-txt-secondary">Пароль</span><input type="password" value={form.password} onChange={e => set('password', e.target.value)} className="w-full rounded-xl border border-bdr-subtle bg-surface-0 px-3 py-3 outline-none focus:border-dv-gold/50" /></label>
          <label className="text-xs"><span className="mb-1.5 block text-txt-secondary">Повторите пароль</span><input type="password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} className="w-full rounded-xl border border-bdr-subtle bg-surface-0 px-3 py-3 outline-none focus:border-dv-gold/50" /></label>
        </div>
        <label className="mt-5 flex gap-3 text-xs text-txt-secondary"><input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-0.5" />Я принимаю условия использования и политику конфиденциальности.</label>
        <button type="button" onClick={() => void handleSubmit()} disabled={loading} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-dv-gold px-4 text-sm font-semibold text-surface-0 disabled:opacity-60">{loading && <Loader2 size={16} className="animate-spin" />} {role === 'owner' ? 'Создать аккаунт и клинику' : 'Создать аккаунт'}</button>
        <div className="mt-4"><GoogleSignInButton text="signup_with" onCredential={() => setLocalError('Регистрация через Google сейчас создаёт стандартный аккаунт. Для выбора рабочей роли используйте регистрацию по email.')} /></div>
      </section>
    </main>
  );
}
