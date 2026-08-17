import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Receipt } from 'lucide-react';
import { Card } from '@/components/ui/ds/Card';
import { GlassCard } from '@/components/ui/ds/GlassCard';
import { EmptyState } from '@/components/ui/ds/EmptyState';
import * as api from '@/utils/api';
import { useFormatters, StatusBadge, TabLoader, TabError } from '../shared';

export function PaymentsTab() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['pp-invoices'],
    queryFn: () => api.apiRequest('/api/patient-portal/invoices'),
  });
  const fmt = useFormatters();
  const result = data?.data || {};
  const invoices = result.invoices || [];
  const summary = result.summary || {};
  if (isLoading) return <TabLoader />;
  if (isError) return <TabError onRetry={refetch} />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <GlassCard padding="sm">
          <p className="text-xs text-txt-muted">{t('patientPortal.payments.summary.total')}</p>
          <p className="text-lg font-bold text-txt-primary">{fmt.money(summary.total)}</p>
        </GlassCard>
        <GlassCard padding="sm">
          <p className="text-xs text-txt-muted">{t('patientPortal.payments.summary.paid')}</p>
          <p className="text-lg font-bold text-success">{fmt.money(summary.paid)}</p>
        </GlassCard>
        <GlassCard padding="sm">
          <p className="text-xs text-txt-muted">{t('patientPortal.payments.summary.unpaid')}</p>
          <p className="text-lg font-bold text-warning">{fmt.money(summary.unpaid)}</p>
        </GlassCard>
      </div>
      {!invoices.length ? (
        <EmptyState
          icon={<Receipt size={28} className="text-dv-gold" />}
          title={t('patientPortal.empty.payments')}
          description={t('patientPortal.empty.payments_desc')}
        />
      ) : (
        <div className="space-y-3">
          {invoices.map((inv: any) => (
            <Card key={inv.id} padding="md" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-txt-primary truncate">{inv.clinic?.name}</p>
                <p className="text-xs text-txt-muted mt-0.5">{fmt.dateShort(inv.createdAt)}</p>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                <p className="text-sm font-semibold text-txt-primary">{fmt.money(inv.amount)}</p>
                <StatusBadge status={inv.status} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default PaymentsTab;
