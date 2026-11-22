import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, ExternalLink, RefreshCw, Wallet } from 'lucide-react';

import { PageHeader } from '@/components/ui/ds/StatCard';
import { Card } from '@/components/ui/ds/Card';
import { Badge } from '@/components/ui/ds/Badge';
import { Button } from '@/components/ui/ds/Button';
import { QueryError } from '@/components/ui/ds/QueryError';
import * as api from '@/utils/api';

type SettlementStatus = 'open' | 'invoiced' | 'paid' | 'void';

interface DiagnosticSettlement {
  id: string;
  ownerType: 'CENTER' | 'LAB';
  ownerId: string;
  periodStart: string;
  periodEnd: string;
  referralCount: number;
  commissionMinor: string;
  status: SettlementStatus;
  dueDate: string | null;
  paidAt: string | null;
}

const STATUS: Record<SettlementStatus, { label: string; variant: 'warning' | 'info' | 'success' | 'default' }> = {
  open: { label: 'К оплате', variant: 'warning' },
  invoiced: { label: 'Ссылка на оплату создана', variant: 'info' },
  paid: { label: 'Оплачен', variant: 'success' },
  void: { label: 'Аннулирован', variant: 'default' },
};

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('ru-RU');
}

function formatMinor(value: string | number | bigint): string {
  let minor: bigint;
  try { minor = BigInt(String(value || '0')); } catch { minor = 0n; }
  const whole = (minor / 100n).toLocaleString('ru-RU');
  const fractional = String(minor % 100n).padStart(2, '0').replace(/0+$/, '');
  return `${whole}${fractional ? `,${fractional}` : ''} ₸`;
}

function sumMinor(items: DiagnosticSettlement[]): bigint {
  return items.reduce((total, item) => {
    try { return total + BigInt(item.commissionMinor || '0'); } catch { return total; }
  }, 0n);
}

function externalPaymentUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export default function DiagnosticSettlements() {
  const queryClient = useQueryClient();
  const [paymentUrls, setPaymentUrls] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const query = useQuery({
    queryKey: ['diagnostics', 'settlements'],
    queryFn: api.getDiagnosticsSettlements,
  });
  const settlements = useMemo<DiagnosticSettlement[]>(() => query.data?.items ?? [], [query.data?.items]);
  const canRequestPayment = Boolean(query.data?.canRequestPayment);

  const totals = useMemo(() => ({
    due: sumMinor(settlements.filter((item) => item.status === 'open' || item.status === 'invoiced')),
    paid: sumMinor(settlements.filter((item) => item.status === 'paid')),
    countDue: settlements.filter((item) => item.status === 'open' || item.status === 'invoiced').length,
  }), [settlements]);

  const requestPayment = async (settlementId: string) => {
    setSubmittingId(settlementId);
    setActionError('');
    try {
      const result = await api.requestDiagnosticsSettlementPayment(settlementId);
      const url = externalPaymentUrl(result?.qr ?? result?.payment?.qr);
      if (url) setPaymentUrls((current) => ({ ...current, [settlementId]: url }));
      await queryClient.invalidateQueries({ queryKey: ['diagnostics', 'settlements'] });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Не удалось создать ссылку оплаты.');
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="max-w-full space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Расчёты с DentVision"
        subtitle="Комиссия по подтверждённым оплатам направлений. Здесь можно получить платёжную ссылку Kaspi QR; подписка за филиалы рассчитывается отдельно."
        icon={<Wallet size={22} />}
        actions={
          <Button variant="secondary" size="sm" onClick={() => query.refetch()} loading={query.isFetching} icon={<RefreshCw size={15} />}>
            Обновить
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card padding="md">
          <p className="text-xs text-txt-muted">Сумма к оплате</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-txt-primary">{formatMinor(totals.due)}</p>
          <p className="mt-1 text-xs text-txt-muted">{totals.countDue} расчётов</p>
        </Card>
        <Card padding="md">
          <p className="text-xs text-txt-muted">Уже оплачено</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-txt-primary">{formatMinor(totals.paid)}</p>
          <p className="mt-1 text-xs text-txt-muted">Подтверждённые платежи</p>
        </Card>
        <Card padding="md">
          <p className="text-xs text-txt-muted">Всего расчётов</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-txt-primary">{settlements.length.toLocaleString('ru-RU')}</p>
          <p className="mt-1 text-xs text-txt-muted">По активному партнёрскому кабинету</p>
        </Card>
      </div>

      {query.isError && <QueryError what="расчёты партнёра" onRetry={() => query.refetch()} />}
      {actionError && (
        <div role="alert" className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-txt-primary">
          {actionError}
        </div>
      )}

      {query.isPending ? (
        <Card padding="lg">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-1/3 rounded bg-surface-2" />
            <div className="h-10 w-full rounded bg-surface-2" />
            <div className="h-10 w-full rounded bg-surface-2" />
          </div>
        </Card>
      ) : query.isError && settlements.length === 0 ? (
        <Card padding="lg" className="text-center">
          <h2 className="text-base font-semibold text-txt-primary">Расчёты временно недоступны</h2>
          <p className="mt-1 text-sm text-txt-muted">Обновите страницу после восстановления соединения.</p>
        </Card>
      ) : settlements.length === 0 ? (
        <Card padding="lg" className="text-center">
          <Wallet className="mx-auto mb-3 text-txt-muted" size={28} />
          <h2 className="text-base font-semibold text-txt-primary">Расчётов пока нет</h2>
          <p className="mt-1 text-sm text-txt-muted">
            Они появятся после закрытия периода по оплаченным направлениям. Неоплаченные направления в комиссию не включаются.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {settlements.map((settlement) => {
            const status = STATUS[settlement.status] || STATUS.open;
            const paymentUrl = paymentUrls[settlement.id];
            const canPaySettlement = canRequestPayment && (settlement.status === 'open' || settlement.status === 'invoiced');
            return (
              <Card key={settlement.id} padding="md">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-txt-primary">
                        {formatDate(settlement.periodStart)} — {formatDate(settlement.periodEnd)}
                      </span>
                      <Badge variant={status.variant} dot>{status.label}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-txt-muted">
                      <span className="inline-flex items-center gap-1.5"><CalendarClock size={14} /> Срок: {formatDate(settlement.dueDate)}</span>
                      <span>{settlement.referralCount} оплаченных направлений</span>
                      {settlement.paidAt && <span>Оплачено: {formatDate(settlement.paidAt)}</span>}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                    <div className="min-w-32 lg:text-right">
                      <p className="text-xs text-txt-muted">Комиссия DentVision</p>
                      <p className="text-xl font-semibold tabular-nums text-txt-primary">{formatMinor(settlement.commissionMinor)}</p>
                    </div>
                    {canPaySettlement && (
                      <Button
                        size="sm"
                        onClick={() => requestPayment(settlement.id)}
                        loading={submittingId === settlement.id}
                        variant="primary"
                      >
                        {settlement.status === 'invoiced' ? 'Открыть оплату' : 'Создать ссылку Kaspi QR'}
                      </Button>
                    )}
                    {paymentUrl && settlement.status !== 'paid' && settlement.status !== 'void' && (
                      <a
                        href={paymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center gap-2 rounded-xl border border-bdr-strong bg-surface-0 px-3 text-sm font-medium text-txt-primary hover:border-dv-gold hover:text-dv-gold"
                      >
                        <ExternalLink size={14} /> Перейти к оплате
                      </a>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs leading-relaxed text-txt-muted">
        Комиссия начисляется только по фактически оплаченным направлениям и рассчитывается по действующей версии экономических правил. Оплата комиссии DentVision не заменяет отдельную подписку за активные филиалы.
      </p>
    </div>
  );
}
