import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/ds/Card';
import { Skeleton } from '@/components/ui/ds/Skeleton';
import { PageHeader, StatCard } from '@/components/ui/ds/StatCard';
import { statusInfo, toneClasses } from '@/lib/referralStatus';
import { cn } from '@/lib/utils';
import { useAuth } from '@/store/auth.store';
import { queryKeys } from '@/queries/keys';
import * as api from '@/utils/api';

export default function DiagnosticStatistics() {
  const { clinic, activeMembership } = useAuth();
  const clinicId = clinic?.id || activeMembership?.clinicId || '';

  const { data: dashData, isLoading } = useQuery({
    queryKey: queryKeys.diagnostics.dashboard(clinicId),
    queryFn: () => api.getDiagnosticsDashboard(clinicId),
    enabled: !!clinicId,
  });

  const { data: listData } = useQuery({
    queryKey: queryKeys.diagnostics.referrals({ clinicId, limit: '500' }),
    queryFn: () => api.getDiagnosticReferrals({ clinicId, limit: '500' }),
    enabled: !!clinicId,
  });

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (listData?.items || []).forEach((r: any) => {
      counts[r.status] = (counts[r.status] || 0) + 1;
    });
    return counts;
  }, [listData]);

  const maxCount = Math.max(...Object.values(statusCounts), 1);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-6 space-y-6 max-w-full overflow-x-hidden">
      <PageHeader
        title="Статистика"
        subtitle="Объём и структура направлений"
        icon={<BarChart3 size={22} />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading
          ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          : (
            <>
              <StatCard label="Всего" value={dashData?.total ?? 0} icon={<BarChart3 size={18} />} />
              <StatCard label="За сегодня" value={dashData?.todayCount ?? 0} icon={<TrendingUp size={18} />} />
              <StatCard label="В работе" value={dashData?.pending ?? 0} icon={<Clock size={18} />} />
              <StatCard label="Готово" value={dashData?.completed ?? 0} icon={<CheckCircle size={18} />} tone="success" />
            </>
          )}
      </div>

      <Card padding="md">
        <h3 className="text-sm font-semibold text-txt-primary mb-4">Распределение по статусам</h3>
        {Object.keys(statusCounts).length === 0 ? (
          <p className="text-sm text-txt-muted text-center py-8">Нет данных</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(statusCounts).sort(([, a], [, b]) => b - a).map(([status, count]) => {
              // Eighth copy of the status vocabulary lived here, with its own
              // palette and only 8 of the 11 enum values — the missing three
              // printed their raw enum name at the user.
              const info = statusInfo(status);
              return (
                <div key={status}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-txt-primary">{info.label}</span>
                    <span className="text-txt-muted">{count}</span>
                  </div>
                  <div className="h-2 bg-surface-1 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', toneClasses(info.tone).dot)}
                      style={{ width: `${(count / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </motion.div>
  );
}
