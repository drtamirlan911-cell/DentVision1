import { useQuery } from '@tanstack/react-query';
import { ArrowDown, DollarSign, TrendingUp, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/ds/Card';
import { GlassCard } from '@/components/ui/ds/GlassCard';
import { Skeleton } from '@/components/ui/ds/Skeleton';
import type { TabProps } from './types';
import { StatusPill } from './Pipeline';

export function FinanceTab({ config, orgId }: TabProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['diagnostics', 'center-dashboard', orgId],
    queryFn: () => config.getDashboard(orgId),
    enabled: !!orgId,
  });

  if (isLoading) return <Skeleton className="h-64" />;
  const d = data?.data || data || {};

  const fmt = (n: number) => Number(n || 0).toLocaleString('ru-RU') + ' ₸';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <GlassCard padding="sm">
          <div className="flex items-center gap-2"><TrendingUp size={16} className="text-success" /><span className="text-xs text-txt-muted">Доход сегодня</span></div>
          <p className="text-xl font-bold text-txt-primary mt-1">{fmt(d.revenue?.today)}</p>
          <p className="text-xs text-txt-muted">Комиссия: {fmt(d.commissions?.today)}</p>
        </GlassCard>
        <GlassCard padding="sm">
          <div className="flex items-center gap-2"><TrendingUp size={16} className="text-info" /><span className="text-xs text-txt-muted">Доход за неделю</span></div>
          <p className="text-xl font-bold text-txt-primary mt-1">{fmt(d.revenue?.week)}</p>
          <p className="text-xs text-txt-muted">Чистый: {fmt(d.netRevenue?.week)}</p>
        </GlassCard>
        <GlassCard padding="sm">
          <div className="flex items-center gap-2"><TrendingUp size={16} className="text-dv-gold" /><span className="text-xs text-txt-muted">Доход за месяц</span></div>
          <p className="text-xl font-bold text-txt-primary mt-1">{fmt(d.revenue?.month)}</p>
          <p className="text-xs text-txt-muted">Выполнено: {d.completedCount || 0} направлений</p>
        </GlassCard>
        <GlassCard padding="sm">
          <div className="flex items-center gap-2"><DollarSign size={16} className="text-warning" /><span className="text-xs text-txt-muted">Не оплачено</span></div>
          <p className="text-xl font-bold text-txt-primary mt-1">{d.paymentStats?.unpaid || 0}</p>
          <p className="text-xs text-txt-muted">Оплачено: {d.paymentStats?.paid || 0}</p>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card padding="md">
          <h3 className="text-sm font-semibold text-txt-primary mb-3">Сводка по году</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-txt-muted">Общий доход</span><span className="text-txt-primary font-semibold">{fmt(d.revenue?.year)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-txt-muted">Комиссия платформы</span><span className="text-txt-primary">{fmt(d.commissions?.year)}</span></div>
            <div className="flex justify-between text-sm border-t border-bdr-subtle pt-2"><span className="text-txt-muted">Чистый доход центра</span><span className="text-success font-semibold">{fmt(d.netRevenue?.year)}</span></div>
          </div>
        </Card>
        <Card padding="md">
          <h3 className="text-sm font-semibold text-txt-primary mb-3">Статусы направлений</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(d.byStatus ? Object.entries(d.byStatus as Record<string, number>).sort(([,a],[,b]) => (b as number) - (a as number)) : []).map(([status, count]) => {
              return (
                <div key={status} className="flex justify-between items-center p-2 rounded-lg bg-surface-1 border border-bdr-subtle">
                  <StatusPill status={status} />
                  <span className="text-sm font-semibold text-txt-primary">{count as number}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
