import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Stethoscope } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/ds/Card';
import { EmptyState } from '@/components/ui/ds/EmptyState';
import * as api from '@/utils/api';
import { useFormatters, StatusBadge, TabLoader, TabError } from '../shared';

export function DiagnosticsTab() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['pp-diagnostics'],
    queryFn: () => api.apiRequest('/api/patient-portal/diagnostics'),
  });
  const fmt = useFormatters();
  const items = data?.data || [];
  if (isLoading) return <TabLoader />;
  if (isError) return <TabError onRetry={refetch} />;
  if (!items.length) {
    return (
      <EmptyState
        icon={<Stethoscope size={28} className="text-dv-gold" />}
        title={t('patientPortal.empty.diagnostics')}
        description={t('patientPortal.empty.diagnostics_desc')}
      />
    );
  }
  return (
    <div className="space-y-3">
      {items.map((r: any) => (
        <Card key={r.id} padding="md">
          <CardHeader>
            <CardTitle>{r.studyType || t('patientPortal.diagnostics.study')}</CardTitle>
            <StatusBadge status={r.status} />
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-txt-muted">
              <span className="text-txt-ghost">{t('patientPortal.diagnostics.category')}:</span> {r.category || '—'}
            </p>
            {(r.center?.name || r.lab?.name) && (
              <p className="text-xs text-txt-muted">
                {r.center?.name && <><span className="text-txt-ghost">{t('patientPortal.diagnostics.center')}:</span> {r.center.name}</>}
                {r.lab?.name && <><span className="text-txt-ghost">{t('patientPortal.diagnostics.lab')}:</span> {r.lab.name}</>}
              </p>
            )}
            {r.result?.reportText ? (
              <div className="mt-2 p-3 bg-surface-1 rounded-lg text-xs text-txt-primary max-h-32 overflow-y-auto whitespace-pre-wrap">
                {r.result.reportText}
              </div>
            ) : (
              <p className="text-xs text-txt-ghost italic">{t('patientPortal.diagnostics.no_report')}</p>
            )}
            {r.cost ? <p className="text-xs text-txt-muted mt-1">{t('patientPortal.diagnostics.cost')}: {fmt.money(r.cost)}</p> : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default DiagnosticsTab;
