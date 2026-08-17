import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Activity } from 'lucide-react';
import { Card } from '@/components/ui/ds/Card';
import { EmptyState } from '@/components/ui/ds/EmptyState';
import * as api from '@/utils/api';
import { useFormatters, TabLoader, TabError } from '../shared';

export function TreatmentsTab() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['pp-treatments'],
    queryFn: () => api.apiRequest('/api/patient-portal/treatments'),
  });
  const fmt = useFormatters();
  const items = data?.data || [];
  if (isLoading) return <TabLoader />;
  if (isError) return <TabError onRetry={refetch} />;
  if (!items.length) {
    return (
      <EmptyState
        icon={<Activity size={28} className="text-dv-gold" />}
        title={t('patientPortal.empty.treatments')}
        description={t('patientPortal.empty.treatments_desc')}
      />
    );
  }
  return (
    <div className="space-y-3">
      {items.map((item: any) => (
        <Card key={item.id} padding="md" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-txt-primary truncate">{item.procedureType || '—'}</p>
            <p className="text-xs text-txt-muted mt-1">
              {item.toothNumber ? `${t('patientPortal.treatments.tooth')} ${item.toothNumber}` : ''}
              {item.toothNumber && item.clinic?.name ? ' · ' : ''}
              {item.clinic?.name}
            </p>
          </div>
          <div className="text-left sm:text-right shrink-0">
            <p className="text-sm font-semibold text-txt-primary">{fmt.money(item.cost)}</p>
            <p className="text-xs text-txt-muted mt-0.5">{fmt.dateShort(item.createdAt)}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}

export default TreatmentsTab;
