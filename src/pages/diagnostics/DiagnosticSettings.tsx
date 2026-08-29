import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Settings, Save } from 'lucide-react';
import { Card } from '@/components/ui/ds/Card';
import { Input, Select } from '@/components/ui/ds/Input';
import { Button } from '@/components/ui/ds/Button';
import { PageHeader } from '@/components/ui/ds/StatCard';
import { useToast } from '@/components/ui/ds/Toast';
import { useAuth } from '@/store/auth.store';
import * as api from '@/utils/api';

const DEFAULT_FORM = {
  defaultCategory: '3D' as '3D' | 'LABORATORY',
  notifyOnStatusChange: true,
  autoAssignCenter: false,
  requirePriority: true,
};

export default function DiagnosticSettings() {
  const { clinic } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(DEFAULT_FORM);

  const { data, isLoading } = useQuery({
    queryKey: ['clinic-settings', clinic?.id],
    queryFn: () => api.getClinicSettings(clinic!.id),
    enabled: !!clinic?.id,
  });

  useEffect(() => {
    if (data?.settings?.diagnostics) setForm({ ...DEFAULT_FORM, ...data.settings.diagnostics });
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => api.saveClinicSettings(clinic!.id, { ...(data?.settings || {}), diagnostics: form }),
    onSuccess: () => toast.success('Настройки сохранены'),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!clinic?.id) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-full overflow-x-hidden px-4 py-4 sm:px-6 sm:py-6 lg:px-8 space-y-6">
        <PageHeader title="Настройки диагностики" subtitle="Значения по умолчанию для новых направлений" icon={<Settings size={22} />} />
        <Card padding="md">
          <p className="text-sm text-txt-muted">
            Это настройки клиники, создающей направления. У вашего аккаунта нет привязки к клинике —
            изменить их отсюда нельзя.
          </p>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-full overflow-x-hidden px-4 py-4 sm:px-6 sm:py-6 lg:px-8 space-y-6">
      <PageHeader
        title="Настройки диагностики"
        subtitle="Значения по умолчанию для новых направлений"
        icon={<Settings size={22} />}
      />

      <Card padding="md">
        <h3 className="text-sm font-semibold text-txt-primary mb-4">Основные</h3>
        <div className="space-y-4">
          <Select label="Категория по умолчанию" value={form.defaultCategory} disabled={isLoading}
            onChange={e => setForm(f => ({ ...f, defaultCategory: e.target.value as '3D' | 'LABORATORY' }))}
            options={[{ value: '3D', label: '3D-диагностика' }, { value: 'LABORATORY', label: 'Лаборатория' }]}
            className="min-h-11 h-11" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <label className="flex items-center gap-3 cursor-pointer min-h-11">
              <input type="checkbox" checked={form.notifyOnStatusChange} onChange={e => setForm(f => ({ ...f, notifyOnStatusChange: e.target.checked }))}
                className="accent-dv-gold w-4 h-4" />
              <div><p className="text-sm text-txt-primary">Уведомлять о смене статуса</p><p className="text-xs text-txt-muted">При изменении статуса направления</p></div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer min-h-11">
              <input type="checkbox" checked={form.autoAssignCenter} onChange={e => setForm(f => ({ ...f, autoAssignCenter: e.target.checked }))}
                className="accent-dv-gold w-4 h-4" />
              <div><p className="text-sm text-txt-primary">Автоназначение центра</p><p className="text-xs text-txt-muted">По типу исследования</p></div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer min-h-11">
              <input type="checkbox" checked={form.requirePriority} onChange={e => setForm(f => ({ ...f, requirePriority: e.target.checked }))}
                className="accent-dv-gold w-4 h-4" />
              <div><p className="text-sm text-txt-primary">Обязательный приоритет</p><p className="text-xs text-txt-muted">Требовать выбор приоритета при создании</p></div>
            </label>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-bdr-subtle flex flex-wrap justify-end gap-3">
          <Button variant="primary" icon={<Save size={16} />} loading={saveMutation.isPending} disabled={isLoading} onClick={() => saveMutation.mutate()}
            className="min-h-11 h-11">
            Сохранить
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
