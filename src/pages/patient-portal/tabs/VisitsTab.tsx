import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ClipboardList } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/ds/Card';
import { EmptyState } from '@/components/ui/ds/EmptyState';
import * as api from '@/utils/api';
import { useFormatters, TabLoader, TabError } from '../shared';

export function VisitsTab() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['pp-visits'],
    queryFn: () => api.apiRequest('/api/patient-portal/visits'),
  });
  const fmt = useFormatters();
  const items = data?.data || [];
  if (isLoading) return <TabLoader />;
  if (isError) return <TabError onRetry={refetch} />;
  if (!items.length) {
    return (
      <EmptyState
        icon={<ClipboardList size={28} className="text-dv-gold" />}
        title={t('patientPortal.empty.visits')}
        description={t('patientPortal.empty.visits_desc')}
      />
    );
  }
  return (
    <div className="space-y-3">
      {items.map((v: any) => (
        <Card key={v.id} padding="md">
          <CardHeader>
            <CardTitle>{v.diagnosis || t('patientPortal.visits.diagnosis')}</CardTitle>
            <p className="text-xs text-txt-muted">{fmt.dateShort(v.date)}</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {v.treatmentPlan && (
              <p className="text-xs text-txt-muted">
                <span className="text-txt-ghost">{t('patientPortal.visits.treatment_plan')}:</span> {v.treatmentPlan}
              </p>
            )}
            {v.procedures && (
              <p className="text-xs text-txt-muted">
                <span className="text-txt-ghost">{t('patientPortal.visits.procedures')}:</span> {v.procedures}
              </p>
            )}
            {v.prescription && (
              <p className="text-xs text-txt-muted">
                <span className="text-txt-ghost">{t('patientPortal.visits.prescription')}:</span> {v.prescription}
              </p>
            )}
            {/* `border-white/5` was invisible in the light theme: the light remap
                covers the bracketed opacities and `/10`, but not a bare `/5`. */}
            <p className="text-xs text-txt-ghost pt-1 border-t border-bdr-subtle">
              {v.doctor?.firstName} {v.doctor?.lastName} — {v.clinic?.name}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default VisitsTab;
