import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, BellOff, ShoppingCart, GraduationCap, Stethoscope, Microscope, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/ds/Card';
import { PageHeader } from '@/components/ui/ds/StatCard';
import { Switch } from '@/components/ui/ds/Misc';
import { useNotificationStore } from '@/store/notification.store';

interface PrefGroup {
  label: string;
  icon: React.ReactNode;
  types: Array<{ type: string; label: string }>;
}

const PREF_GROUPS: PrefGroup[] = [
  {
    label: 'CRM',
    icon: <Stethoscope size={16} />,
    types: [
      { type: 'crm.appointment.reminder', label: 'Напоминание о записи' },
      { type: 'crm.appointment.cancelled', label: 'Отмена записи' },
      { type: 'crm.patient.no_show', label: 'Неявка пациента' },
      { type: 'crm.invoice.paid', label: 'Оплата счёта' },
      { type: 'crm.inventory.low', label: 'Мало товара на складе' },
    ],
  },
  {
    label: 'Диагностика',
    icon: <Microscope size={16} />,
    types: [
      { type: 'diagnostics.referral.sent', label: 'Новое направление' },
      { type: 'diagnostics.referral.accepted', label: 'Направление принято' },
      { type: 'diagnostics.referral.result', label: 'Результат готов' },
      { type: 'diagnostics.referral.payment', label: 'Оплата за направление' },
    ],
  },
  {
    label: 'Магазин',
    icon: <ShoppingCart size={16} />,
    types: [
      { type: 'shop.order.placed', label: 'Заказ создан' },
      { type: 'shop.order.status', label: 'Статус заказа изменился' },
      { type: 'shop.order.payment', label: 'Оплата подтверждена' },
    ],
  },
  {
    label: 'Академия',
    icon: <GraduationCap size={16} />,
    types: [
      { type: 'school.enrollment.confirmed', label: 'Зачисление на курс' },
      { type: 'school.course.completed', label: 'Курс завершён' },
      { type: 'school.certificate.ready', label: 'Сертификат готов' },
    ],
  },
  {
    label: 'Администрирование',
    icon: <Shield size={16} />,
    types: [
      { type: 'admin.clinic.expiring', label: 'Подписка истекает' },
      { type: 'admin.clinic.expired', label: 'Подписка истекла' },
      { type: 'admin.clinic.new', label: 'Новая клиника' },
    ],
  },
];

export default function NotificationPreferencesPage() {
  const { t } = useTranslation();
  const preferences = useNotificationStore((s) => s.preferences);
  const loadPreferences = useNotificationStore((s) => s.loadPreferences);
  const updatePreference = useNotificationStore((s) => s.updatePreference);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    void loadPreferences();
  }, [loadPreferences]);

  const isEnabled = (type: string) => {
    const pref = preferences.find((p) => p.type === type);
    return pref ? pref.enabled : true; // default enabled
  };

  const handleToggle = async (type: string, enabled: boolean) => {
    setSaving(type);
    try {
      await updatePreference(type, enabled);
    } finally {
      setSaving(null);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-4 sm:p-6 space-y-6 max-w-3xl">
      <PageHeader
        title="Настройки уведомлений"
        subtitle="Выберите какие уведомления вы хотите получать"
        icon={<Bell size={20} />}
      />

      <div className="space-y-4">
        {PREF_GROUPS.map((group) => (
          <Card key={group.label} padding="none">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-bdr-subtle">
              <span className="text-dv-gold">{group.icon}</span>
              <h3 className="text-sm font-semibold text-txt-primary">{group.label}</h3>
            </div>
            <div className="divide-y divide-bdr-subtle/60">
              {group.types.map((item) => (
                <div key={item.type} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-txt-primary">{item.label}</span>
                  <Switch
                    checked={isEnabled(item.type)}
                    onCheckedChange={(v) => handleToggle(item.type, v)}
                    disabled={saving === item.type}
                  />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}
