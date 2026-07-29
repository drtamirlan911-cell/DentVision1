import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GlassCard, Button, Skeleton } from '../../components/ui/ds';
import { useToast } from '../../components/ui/ds';
import { apiRequest } from '../../utils/api';
import { Scale, Save } from 'lucide-react';

const FIELDS = [
  { key: 'PlatformName', label: 'Наименование платформы' },
  { key: 'PlatformDirector', label: 'ФИО Директора' },
  { key: 'PLATFORM_BIN', label: 'БИН' },
  { key: 'PLATFORM_ADDRESS', label: 'Юридический адрес' },
  { key: 'PLATFORM_PHONE', label: 'Телефон' },
  { key: 'PLATFORM_EMAIL', label: 'Email' },
  { key: 'PLATFORM_IBAN', label: 'IBAN счёт' },
  { key: 'PLATFORM_BANK', label: 'Банк' },
  { key: 'PLATFORM_BIC', label: 'БИК' },
  { key: 'PLATFORM_KBE', label: 'КБЕ' },
];

export default function LegalSettings() {
  const toast = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['legal-platform-settings'],
    queryFn: () => apiRequest('/api/legal/platform-settings'),
  });

  useEffect(() => {
    if (data && typeof data === 'object') {
      setForm(prev => {
        const merged = { ...data };
        Object.keys(merged).forEach(k => { if (typeof merged[k] !== 'string') delete merged[k]; });
        return Object.keys(prev).length ? prev : merged;
      });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => apiRequest('/api/legal/platform-settings', { method: 'PUT', body: JSON.stringify(form) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['legal-platform-settings'] });
      toast.showToast('Настройки сохранены', 'success');
    },
    onError: (e: any) => toast.showToast(e.message || 'Ошибка', 'error'),
  });

  if (isLoading) return <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>;

  return (
    <div className="space-y-6">
      <GlassCard padding="md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Scale size={18} className="text-dv-gold" />
            <h3 className="text-sm font-semibold text-txt-primary">Реквизиты ТОО «DentVision»</h3>
          </div>
          <Button size="sm" icon={<Save size={14} />} onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
            Сохранить
          </Button>
        </div>
        <p className="text-xs text-txt-muted mb-4">Эти данные подставляются во все шаблоны документов через переменные <code className="text-dv-gold">{'{{PLATFORM_*}}'}</code>.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {FIELDS.map(f => (
            <div key={f.key}>
              <label className="text-xs text-txt-secondary mb-1 block">{f.label}</label>
              <input
                className="w-full px-3 py-2 bg-surface-1 border border-bdr-subtle rounded-lg text-sm text-txt-primary font-mono focus:outline-none focus:border-dv-gold"
                value={form[f.key] || ''}
                onChange={e => setForm({ ...form, [f.key]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
