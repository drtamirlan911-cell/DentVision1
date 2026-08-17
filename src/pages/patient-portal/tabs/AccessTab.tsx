import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CheckCircle2, Clock, Check, X } from 'lucide-react';
import { Card } from '@/components/ui/ds/Card';
import { Button } from '@/components/ui/ds/Button';
import { EmptyState } from '@/components/ui/ds/EmptyState';
import { useToast } from '@/components/ui/ds/Toast';
import * as api from '@/utils/api';
import { useFormatters, TabLoader, TabError } from '../shared';

const CROSS_CLINIC_CATEGORY_LABELS: Record<string, string> = {
  visits: 'Визиты',
  treatment_plans: 'Планы лечения',
  medical_history: 'История болезни',
  files: 'Снимки и документы',
  full_summary: 'Полная сводка',
};

export function AccessTab() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const fmt = useFormatters();
  const [acting, setActing] = useState<string | null>(null);

  const requestsQuery = useQuery({
    queryKey: ['pp-access-requests'],
    queryFn: () => api.getAccessRequests(),
  });
  const grantsQuery = useQuery({
    queryKey: ['pp-access-grants'],
    queryFn: () => api.getAccessGrants(),
  });
  const logQuery = useQuery({
    queryKey: ['pp-access-log'],
    queryFn: () => api.getCrossClinicAccessLog(),
  });

  const approve = useMutation({
    mutationFn: (grantId: string) => api.approveAccessRequest(grantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pp-access-requests'] });
      queryClient.invalidateQueries({ queryKey: ['pp-access-grants'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Не удалось подтвердить доступ'),
    onSettled: () => setActing(null),
  });
  const decline = useMutation({
    mutationFn: (grantId: string) => api.declineAccessRequest(grantId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pp-access-requests'] }),
    onError: (e: any) => toast.error(e?.message || 'Не удалось отклонить запрос'),
    onSettled: () => setActing(null),
  });
  const revoke = useMutation({
    mutationFn: (grantId: string) => api.revokeAccessGrant(grantId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pp-access-grants'] }),
    onError: (e: any) => toast.error(e?.message || 'Не удалось отозвать доступ'),
    onSettled: () => setActing(null),
  });

  if (requestsQuery.isLoading || grantsQuery.isLoading || logQuery.isLoading) return <TabLoader />;
  if (requestsQuery.isError && grantsQuery.isError && logQuery.isError) {
    return (
      <TabError
        onRetry={() => { requestsQuery.refetch(); grantsQuery.refetch(); logQuery.refetch(); }}
      />
    );
  }

  const requests = requestsQuery.data || [];
  const grants = grantsQuery.data || [];
  const log = logQuery.data || [];

  if (!requests.length && !grants.length && !log.length) {
    return (
      <EmptyState
        icon={<CheckCircle2 size={28} className="text-dv-gold" />}
        title="Нет запросов на доступ"
        description="Когда другая клиника попросит увидеть вашу историю лечения, запрос появится здесь — вы решаете, разрешить или отказать."
      />
    );
  }

  return (
    <div className="space-y-6">
      {requests.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-txt-primary">Входящие запросы</h3>
          {requests.map((g) => (
            <Card key={g.id} padding="md" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0 flex items-start gap-3">
                <Building2 size={18} className="text-dv-gold shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-txt-primary truncate">{g.receivingClinic.name}</p>
                  <p className="text-xs text-txt-muted mt-0.5">
                    запрашивает доступ к вашей истории лечения в клинике «{g.sourceClinic.name}»
                  </p>
                  <p className="text-xs text-txt-ghost mt-0.5 inline-flex items-center gap-1">
                    <Clock size={11} /> {fmt.dateShort(g.requestedAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  icon={<X size={14} />}
                  disabled={acting === g.id}
                  loading={acting === g.id && decline.isPending}
                  onClick={() => { setActing(g.id); decline.mutate(g.id); }}
                >
                  Отклонить
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Check size={14} />}
                  disabled={acting === g.id}
                  loading={acting === g.id && approve.isPending}
                  onClick={() => { setActing(g.id); approve.mutate(g.id); }}
                >
                  Разрешить
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {grants.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-txt-primary">Активный доступ</h3>
          {grants.map((g) => (
            <Card key={g.id} padding="md" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0 flex items-start gap-3">
                <CheckCircle2 size={18} className="text-success shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-txt-primary truncate">{g.receivingClinic.name}</p>
                  <p className="text-xs text-txt-muted mt-0.5">
                    видит вашу историю лечения из клиники «{g.sourceClinic.name}»
                  </p>
                  {g.respondedAt && (
                    <p className="text-xs text-txt-ghost mt-0.5">предоставлено {fmt.dateShort(g.respondedAt)}</p>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                icon={<X size={14} />}
                disabled={acting === g.id}
                loading={acting === g.id && revoke.isPending}
                onClick={() => { setActing(g.id); revoke.mutate(g.id); }}
              >
                Отозвать доступ
              </Button>
            </Card>
          ))}
        </div>
      )}

      {log.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-txt-primary">Кто и когда смотрел ваши данные</h3>
          <div className="space-y-2">
            {log.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 px-3 py-2.5 rounded-lg bg-surface-1 border border-bdr-subtle text-xs"
              >
                <div className="min-w-0">
                  <span className="text-txt-primary font-medium">{entry.accessedBy || 'Сотрудник'}</span>
                  <span className="text-txt-muted"> · {entry.receivingClinicName}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-txt-muted">
                  <span>{CROSS_CLINIC_CATEGORY_LABELS[entry.dataCategory] || entry.dataCategory}</span>
                  <span>·</span>
                  <span>{fmt.dateShort(entry.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AccessTab;
