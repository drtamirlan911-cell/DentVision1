import { useState } from 'react';
import { Building2, FlaskConical, CheckCircle, ArrowLeft } from 'lucide-react';
import { GlassCard } from '@/components/ui/ds/GlassCard';
import { Button } from '@/components/ui/ds/Button';
import { useNavigate } from 'react-router-dom';
import { DIAGNOSTICS_BENEFITS, PartnerBenefits } from '@/components/PartnerBenefits';
import * as api from '@/utils/api';

export default function DiagnosticsRegister() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'type' | 'form' | 'done'>('type');
  const [type, setType] = useState<'center' | 'laboratory' | null>(null);
  const [form, setForm] = useState({ name: '', city: '', address: '', phone: '', email: '', comment: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!type || !form.name) return;
    setSubmitting(true);
    setError('');
    try {
      await api.submitDiagnosticsRegistration({ ...form, type });
      setStep('done');
    } catch (e: any) {
      setError(e.message || 'Ошибка отправки');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4 max-w-full overflow-x-hidden">
        <GlassCard padding="lg" className="w-full max-w-md text-center">
          <div className="flex justify-center mb-4"><CheckCircle size={48} className="text-success" /></div>
          <h2 className="text-lg font-bold text-txt-primary mb-2">Заявка отправлена!</h2>
          <p className="text-sm text-txt-muted mb-6">
            Администратор проверит вашу заявку и активирует {type === 'center' ? 'центр' : 'лабораторию'} в ближайшее время.
          </p>
          <Button variant="primary" onClick={() => navigate('/')}>На главную</Button>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col items-center justify-center gap-6 p-4 max-w-full overflow-x-hidden">
      <GlassCard padding="lg" className="w-full max-w-md">
        <button onClick={() => step === 'form' ? setStep('type') : navigate('/')} className="flex items-center gap-1 text-xs text-txt-muted hover:text-txt-primary mb-4 transition-colors min-h-11">
          <ArrowLeft size={14} /> Назад
        </button>

        <h2 className="text-lg font-bold text-txt-primary mb-1">Регистрация в системе диагностики</h2>
        <p className="text-sm text-txt-muted mb-6">Подключите ваш диагностический центр или лабораторию к платформе</p>

        {step === 'type' && (
          <div className="space-y-3">
            <button onClick={() => { setType('center'); setStep('form'); }}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-bdr-subtle hover:border-dv-gold/40 hover:bg-dv-gold/5 transition-all text-left min-h-11">
              <div className="w-12 h-12 rounded-xl bg-dv-gold/10 flex items-center justify-center"><Building2 size={24} className="text-dv-gold" /></div>
              <div><p className="text-sm font-semibold text-txt-primary">Диагностический центр</p><p className="text-xs text-txt-muted">3D-снимки, МРТ, КТ, радиология</p></div>
            </button>
            <button onClick={() => { setType('laboratory'); setStep('form'); }}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-bdr-subtle hover:border-dv-gold/40 hover:bg-dv-gold/5 transition-all text-left min-h-11">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center"><FlaskConical size={24} className="text-purple-500" /></div>
              <div><p className="text-sm font-semibold text-txt-primary">Лаборатория</p><p className="text-xs text-txt-muted">Анализы, гистология, биопсия</p></div>
            </button>
          </div>
        )}

        {step === 'form' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-txt-muted block mb-1">Название *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold min-h-11" />
            </div>
            <div>
              <label className="text-xs text-txt-muted block mb-1">Город</label>
              <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
                className="w-full bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold min-h-11" />
            </div>
            <div>
              <label className="text-xs text-txt-muted block mb-1">Адрес</label>
              <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                className="w-full bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold min-h-11" />
            </div>
            <div>
              <label className="text-xs text-txt-muted block mb-1">Телефон</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold min-h-11" />
            </div>
            <div>
              <label className="text-xs text-txt-muted block mb-1">Email</label>
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold min-h-11" />
            </div>
            <div>
              <label className="text-xs text-txt-muted block mb-1">Комментарий</label>
              <textarea value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} rows={3}
                className="w-full bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold resize-none min-h-11" />
            </div>
            {error && <p className="text-xs text-danger">{error}</p>}
            <Button variant="primary" className="w-full min-h-11" onClick={handleSubmit}
              disabled={!form.name || submitting}>
              {submitting ? 'Отправка...' : 'Отправить заявку'}
            </Button>
          </div>
        )}
      </GlassCard>
      <PartnerBenefits benefits={DIAGNOSTICS_BENEFITS} className="w-full max-w-md" />
    </div>
  );
}
