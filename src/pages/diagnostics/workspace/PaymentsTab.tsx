import { useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle, Clock, DollarSign } from 'lucide-react';
import { Card } from '@/components/ui/ds/Card';
import { GlassCard } from '@/components/ui/ds/GlassCard';
import { Badge } from '@/components/ui/ds/Badge';
import { Skeleton } from '@/components/ui/ds/Skeleton';
import type { TabProps } from './types';

export function PaymentsTab({ config, orgId }: TabProps) {
  const { data: paymentsData, isLoading } = useQuery({
    queryKey: ['diagnostics', 'payments', config.kind, orgId],
    queryFn: () => config.getPayments(orgId),
    enabled: !!orgId,
  });

  if (isLoading) return <Skeleton className="h-48" />;

  const referrals = paymentsData?.data?.referrals || [];
  const totals = paymentsData?.data?.totals || { totalRevenue: 0, totalFees: 0, paidCount: 0, unpaidCount: 0 };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <GlassCard padding="sm">
          <div className="flex items-center gap-2"><DollarSign size={16} className="text-success" /><span className="text-xs text-txt-muted">Выручка</span></div>
          <p className="text-xl font-bold text-txt-primary mt-1">{Number(totals.totalRevenue).toLocaleString()} ₸</p>
        </GlassCard>
        <GlassCard padding="sm">
          <div className="flex items-center gap-2"><Activity size={16} className="text-dv-gold" /><span className="text-xs text-txt-muted">Комиссия платформы</span></div>
          <p className="text-xl font-bold text-txt-primary mt-1">{Number(totals.totalFees).toLocaleString()} ₸</p>
        </GlassCard>
        <GlassCard padding="sm">
          <div className="flex items-center gap-2"><CheckCircle size={16} className="text-success" /><span className="text-xs text-txt-muted">Оплачено</span></div>
          <p className="text-xl font-bold text-txt-primary mt-1">{totals.paidCount}</p>
        </GlassCard>
        <GlassCard padding="sm">
          <div className="flex items-center gap-2"><Clock size={16} className="text-warning" /><span className="text-xs text-txt-muted">Ожидают оплаты</span></div>
          <p className="text-xl font-bold text-txt-primary mt-1">{totals.unpaidCount}</p>
        </GlassCard>
      </div>
      <Card padding="md">
        <h3 className="text-sm font-semibold text-txt-primary mb-3">История оплат</h3>
        {referrals.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-txt-muted text-sm">Нет завершённых направлений</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-bdr-subtle">
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-txt-muted whitespace-nowrap">Пациент</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-txt-muted whitespace-nowrap">Услуга</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-txt-muted whitespace-nowrap">Стоимость</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-txt-muted whitespace-nowrap">Комиссия</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-txt-muted whitespace-nowrap">К выплате</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-txt-muted whitespace-nowrap">Статус</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-txt-muted whitespace-nowrap">Дата</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r: any) => {
                  const net = Number(r.cost || 0) - Number(r.platformFee || 0);
                  return (
                    <tr key={r.id} className="border-b border-bdr-subtle/50">
                      <td className="py-2.5 pr-3 text-txt-primary">{r.patientName}</td>
                      <td className="py-2.5 pr-3 text-txt-muted">{r.studyType || '—'}</td>
                      <td className="py-2.5 pr-3 text-txt-primary">{Number(r.cost || 0).toLocaleString()} ₸</td>
                      <td className="py-2.5 pr-3 text-txt-muted">{Number(r.platformFee || 0).toLocaleString()} ₸</td>
                      <td className="py-2.5 pr-3 text-success font-medium">{net.toLocaleString()} ₸</td>
                      <td className="py-2.5 pr-3">{r.paid ? <Badge variant="filled" className="bg-success/20 text-success">Оплачено</Badge> : <Badge variant="outline" className="text-warning border-warning">Ожидание</Badge>}</td>
                      <td className="py-2.5 pr-3 text-txt-muted">{new Date(r.createdAt).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
