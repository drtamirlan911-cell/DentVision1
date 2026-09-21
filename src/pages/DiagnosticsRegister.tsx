import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, FlaskConical, ArrowLeft, Factory, CheckCircle2, Loader2 } from 'lucide-react';
import { GlassCard } from '@/components/ui/ds/GlassCard';
import { Button } from '@/components/ui/ds/Button';
import { useAuth } from '@/store/auth.store';
import * as api from '@/utils/api';

type Kind = 'diagnostic_center' | 'medical_lab' | 'dental_lab';

const CONFIG: Record<Kind, { label: string; title: string; icon: typeof Building2; next: string }> = {
  diagnostic_center: { label: 'диагностический центр', title: 'Создать диагностический центр', icon: Building2, next: '/diagnostics/center' },
  medical_lab: { label: 'медицинскую лабораторию', title: 'Создать медицинскую лабораторию', icon: FlaskConical, next: '/diagnostics/lab?workspace=medical-lab' },
  dental_lab: { label: 'зуботехническую лабораторию', title: 'Создать зуботехническую лабораторию', icon: Factory, next: '/diagnostics/lab' },
};

function normalizeType(value: string | null): Kind {
  if (value === 'center') return 'diagnostic_center';
  if (value === 'laboratory') return 'medical_lab';
  return 'dental_lab';
}

export default function DiagnosticsRegister() {
  const { isAuthenticated, loading: authLoading, restoreSession } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const kind = normalizeType(params.get('type'));
  const config = CONFIG[kind];
  const Icon = config.icon;
  const [form, setForm] = useState({ name: '', city: '', address: '', phone: '', email: '', taxId: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loginUrl = useMemo(() => {
    const returnUrl = '/register-diagnostics?type=' + (params.get('type') || 'dental_laboratory');
    return '/login?role=owner&returnUrl=' + encodeURIComponent(returnUrl);
  }, [params]);

  if (authLoading) {
    return <div className="min-h-screen bg-surface-0 flex items-center justify-center"><Loader2 className="animate-spin text-dv-gold" /></div>;
  }
  if (!isAuthenticated) return <Navigate to={loginUrl} replace />;

  const submit = async () => {
    if (!form.name.trim()) { setError('Укажите название организации'); return; }
    if (!form.city.trim()) { setError('Укажите город'); return; }
    setSubmitting(true);
    setError('');
    try {
      const result = await api.createSelfServiceOrganization({
        type: kind,
        name: form.name.trim(),
        city: form.city.trim(),
        address: form.address.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        taxId: form.taxId.trim() || undefined,
      });
      if (result?.accessToken) api.setTokens(result.accessToken, result.refreshToken || null);
      await restoreSession();
      navigate(result?.nextPath || config.next, { replace: true });
    } catch (e: any) {
      setError(e?.message || 'Не удалось создать организацию');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-surface-0 flex items-center justify-center p-4 max-w-full overflow-x-hidden">
      <GlassCard padding="lg" className="w-full max-w-md">
        <button type="button" onClick={() => navigate('/')} className="flex min-h-11 items-center gap-1 text-xs text-txt-muted hover:text-txt-primary mb-4">
          <ArrowLeft size={14} /> Назад
        </button>
        <div className="flex items-center gap-3 mb-2">
          <span className="w-11 h-11 rounded-xl bg-dv-gold/10 flex items-center justify-center text-dv-gold"><Icon size={22} /></span>
          <div><h1 className="text-lg font-bold text-txt-primary">{config.title}</h1><p className="text-xs text-txt-muted">Самостоятельное создание рабочего пространства</p></div>
        </div>
        <p className="text-sm text-txt-secondary mt-4 mb-5">Организация создаётся сразу. Проверка регулируемого профиля может проходить асинхронно, без ручного создания кабинета оператором DentVision.</p>
        <div className="space-y-3">
          <label className="block"><span className="text-xs text-txt-muted">Название *</span><input aria-label="Название *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1 w-full min-h-11 rounded-lg border border-bdr-subtle bg-surface-1 px-3 text-sm text-txt-primary" /></label>
          <label className="block"><span className="text-xs text-txt-muted">Город *</span><input aria-label="Город *" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="mt-1 w-full min-h-11 rounded-lg border border-bdr-subtle bg-surface-1 px-3 text-sm text-txt-primary" /></label>
          <label className="block"><span className="text-xs text-txt-muted">Адрес</span><input aria-label="Адрес" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="mt-1 w-full min-h-11 rounded-lg border border-bdr-subtle bg-surface-1 px-3 text-sm text-txt-primary" /></label>
          <label className="block"><span className="text-xs text-txt-muted">Телефон</span><input aria-label="Телефон" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="mt-1 w-full min-h-11 rounded-lg border border-bdr-subtle bg-surface-1 px-3 text-sm text-txt-primary" /></label>
          <label className="block"><span className="text-xs text-txt-muted">Email</span><input aria-label="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="mt-1 w-full min-h-11 rounded-lg border border-bdr-subtle bg-surface-1 px-3 text-sm text-txt-primary" /></label>
          <label className="block"><span className="text-xs text-txt-muted">БИН / ИИН</span><input aria-label="БИН / ИИН" value={form.taxId} onChange={e => setForm({ ...form, taxId: e.target.value })} className="mt-1 w-full min-h-11 rounded-lg border border-bdr-subtle bg-surface-1 px-3 text-sm text-txt-primary" /></label>
          {error && <p role="alert" className="text-xs text-danger">{error}</p>}
          <Button variant="primary" className="w-full min-h-11" onClick={submit} disabled={submitting || !form.name.trim() || !form.city.trim()}>
            {submitting ? 'Создаём рабочее пространство…' : 'Создать и открыть workspace'}
          </Button>
        </div>
        <div className="mt-5 flex gap-2 rounded-xl border border-bdr-subtle bg-surface-1 p-3 text-xs text-txt-muted">
          <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success" />
          <span>После подтверждения сервером вы станете владельцем организации и сразу попадёте в соответствующий workspace.</span>
        </div>
      </GlassCard>
    </main>
  );
}
