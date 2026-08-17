import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Calendar, User, Building2 } from 'lucide-react';
import { Card } from '@/components/ui/ds/Card';
import { EmptyState } from '@/components/ui/ds/EmptyState';
import * as api from '@/utils/api';
import { useFormatters, StatusBadge, TabLoader, TabError } from '../shared';

export function AppointmentsTab() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['pp-appointments'],
    queryFn: () => api.apiRequest('/api/patient-portal/appointments'),
  });
  const fmt = useFormatters();
  const items = data?.data || [];
  if (isLoading) return <TabLoader />;
  if (isError) return <TabError onRetry={refetch} />;
  if (!items.length) {
    return (
      <EmptyState
        icon={<Calendar size={28} className="text-dv-gold" />}
        title={t('patientPortal.empty.appointments')}
        description={t('patientPortal.empty.appointments_desc')}
      />
    );
  }
  return (
    <div className="space-y-3">
      {items.map((a: any) => (
        <Card key={a.id} padding="md" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-txt-primary truncate">{a.procedureType || t('patientPortal.appointments.title')}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-txt-muted mt-1">
              <span className="inline-flex items-center gap-1"><User size={12} /> {a.doctor?.firstName} {a.doctor?.lastName}</span>
              <span className="inline-flex items-center gap-1"><Building2 size={12} /> {a.clinic?.name}</span>
            </div>
          </div>
          <div className="text-left sm:text-right shrink-0">
            <p className="text-sm font-medium text-txt-primary">{fmt.dateShort(a.date)} {a.time && `· ${a.time}`}</p>
            <div className="mt-1"><StatusBadge status={a.status} /></div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export default AppointmentsTab;
