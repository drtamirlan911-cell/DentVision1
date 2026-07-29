import { useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import { Settings, Save } from 'lucide-react';
import { Card } from '@/components/ui/ds/Card';
import { Input, Select } from '@/components/ui/ds/Input';
import { Button } from '@/components/ui/ds/Button';
import { useToast } from '@/components/ui/ds/Toast';
import { useAuth } from '@/store/auth.store';

export default function DiagnosticSettings() {
  const { clinic } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    defaultCategory: '3D',
    notifyOnStatusChange: true,
    autoAssignCenter: false,
    requirePriority: true,
  });

  const saveMutation = useMutation({
    mutationFn: async () => { await new Promise(r => setTimeout(r, 500)); return true; },
    onSuccess: () => toast.success('Настройки сохранены'),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold text-txt-primary">Настройки диагностики</h1>

      <Card padding="md">
        <h3 className="text-sm font-semibold text-txt-primary mb-4">Основные</h3>
        <div className="space-y-4">
          <Select label="Категория по умолчанию" value={form.defaultCategory}
            onChange={e => setForm(f => ({ ...f, defaultCategory: e.target.value }))}
            options={[{ value: '3D', label: '3D-диагностика' }, { value: 'LABORATORY', label: 'Лаборатория' }]} />

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.notifyOnStatusChange} onChange={e => setForm(f => ({ ...f, notifyOnStatusChange: e.target.checked }))}
              className="accent-dv-gold w-4 h-4" />
            <div><p className="text-sm text-txt-primary">Уведомлять о смене статуса</p><p className="text-xs text-txt-muted">При изменении статуса направления</p></div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.autoAssignCenter} onChange={e => setForm(f => ({ ...f, autoAssignCenter: e.target.checked }))}
              className="accent-dv-gold w-4 h-4" />
            <div><p className="text-sm text-txt-primary">Автоназначение центра</p><p className="text-xs text-txt-muted">По типу исследования</p></div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.requirePriority} onChange={e => setForm(f => ({ ...f, requirePriority: e.target.checked }))}
              className="accent-dv-gold w-4 h-4" />
            <div><p className="text-sm text-txt-primary">Обязательный приоритет</p><p className="text-xs text-txt-muted">Требовать выбор приоритета при создании</p></div>
          </label>
        </div>

        <div className="mt-6 pt-4 border-t border-bdr-subtle flex justify-end">
          <Button variant="primary" icon={<Save size={16} />} loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            Сохранить
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
