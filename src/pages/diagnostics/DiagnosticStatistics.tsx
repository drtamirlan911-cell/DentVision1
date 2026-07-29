import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/ds/Card';
import { GlassCard } from '@/components/ui/ds/GlassCard';
import { Skeleton } from '@/components/ui/ds/Skeleton';
import { useAuth } from '@/store/auth.store';
import { queryKeys } from '@/queries/keys';
import * as api from '@/utils/api';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#6B7280', SENT: '#C9A96E', ACCEPTED: '#3B82F6', SCHEDULED: '#8B5CF6',
  IN_PROGRESS: '#F97316', COMPLETED: '#22C55E', DELIVERED: '#14B8A6', CANCELLED: '#EF4444',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Черновик', SENT: 'Отправлено', ACCEPTED: 'Принято', SCHEDULED: 'Запланировано',
  IN_PROGRESS: 'В работе', COMPLETED: 'Выполнено', DELIVERED: 'Доставлено', CANCELLED: 'Отменено',
};

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
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-txt-primary">Статистика</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Всего', value: dashData?.total ?? 0, icon: <BarChart3 size={18} />, color: '#3498DB' },
          { label: 'За сегодня', value: dashData?.todayCount ?? 0, icon: <TrendingUp size={18} />, color: '#C9A96E' },
          { label: 'В работе', value: dashData?.pending ?? 0, icon: <Clock size={18} />, color: '#F97316' },
          { label: 'Готово', value: dashData?.completed ?? 0, icon: <CheckCircle size={18} />, color: '#22C55E' },
        ].map((s, i) => (
          <GlassCard key={i} padding="md">
            {isLoading ? <Skeleton className="h-14" /> : (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ background: s.color + '18', color: s.color }}>{s.icon}</div>
                <div>
                  <p className="text-2xl font-bold text-txt-primary">{s.value}</p>
                  <p className="text-xs text-txt-muted">{s.label}</p>
                </div>
              </div>
            )}
          </GlassCard>
        ))}
      </div>

      <Card padding="md">
        <h3 className="text-sm font-semibold text-txt-primary mb-4">Распределение по статусам</h3>
        {Object.keys(statusCounts).length === 0 ? (
          <p className="text-sm text-txt-muted text-center py-8">Нет данных</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(statusCounts).sort(([, a], [, b]) => b - a).map(([status, count]) => (
              <div key={status}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-txt-primary">{STATUS_LABELS[status] || status}</span>
                  <span className="text-txt-muted">{count}</span>
                </div>
                <div className="h-2 bg-surface-1 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${(count / maxCount) * 100}%`, background: STATUS_COLORS[status] || '#6B7280' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </motion.div>
  );
}
