import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/ds/Badge';
import { Button } from '@/components/ui/ds/Button';
import { Card } from '@/components/ui/ds/Card';
import { QueryError } from '@/components/ui/ds/QueryError';
import { Skeleton } from '@/components/ui/ds/Skeleton';
import {
  confirmPayment,
  createPayment,
  getPartnerBranchSubscriptionInvoices,
  getPayment,
  type PartnerBranchSubscriptionInvoice,
} from '@/utils/api';
import {
  formatPartnerBranchMoney,
  formatPartnerBranchUnitPrice,
  partnerBranchInvoiceStatusLabel,
  partnerBranchInvoiceStatusTone,
  partnerBranchVerticalLabel,
} from '@/lib/partnerBranchBilling';

function date(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString('ru-RU');
}

export function PartnerBranchSubscriptionBilling({
  organizationId,
  canReadBilling,
  canManageBilling,
}: {
  organizationId: string;
  canReadBilling: boolean;
  canManageBilling: boolean;
}) {
  const queryClient = useQueryClient();
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  const invoicesQuery = useQuery({
    queryKey: ['partner-branch-billing', 'invoices', organizationId],
    queryFn: () => getPartnerBranchSubscriptionInvoices(organizationId),
    enabled: canReadBilling && Boolean(organizationId),
    refetchInterval: 60_000,
  });

  const paymentQuery = useQuery({
    queryKey: ['partner-branch-billing', 'payment', organizationId, selectedPaymentId],
    queryFn: () => getPayment(selectedPaymentId!),
    enabled: canManageBilling && Boolean(selectedPaymentId),
    refetchInterval: (query) => {
      const status = String(query.state.data?.status || '').toLowerCase();
      const providerStatus = String(query.state.data?.providerStatus || '').toLowerCase();
      return ['paid', 'failed', 'expired'].includes(status) || ['paid', 'failed', 'expired'].includes(providerStatus) ? false : 15_000;
    },
  });

  const startPaymentMutation = useMutation({
    mutationFn: async (invoice: PartnerBranchSubscriptionInvoice) => {
      const payment = await createPayment({
        amountMinor: String(invoice.amountMinor),
        provider: 'kaspi_qr',
        refType: 'partner_branch_subscription_invoice',
        refId: invoice.id,
      });
      if (!payment?.id) throw new Error('Платёж создан без идентификатора. Обновите список счетов перед повторной попыткой.');
      return payment;
    },
    onSuccess: (payment, invoice) => {
      setSelectedInvoiceId(invoice.id);
      setSelectedPaymentId(String(payment.id));
      void queryClient.invalidateQueries({ queryKey: ['partner-branch-billing', 'invoices', organizationId] });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => {
      if (!selectedPaymentId) throw new Error('Не выбран платёж');
      return confirmPayment(selectedPaymentId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['partner-branch-billing', 'invoices', organizationId] });
      void paymentQuery.refetch();
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ['partner-branch-billing', 'invoices', organizationId] });
      void paymentQuery.refetch();
    },
  });

  const invoices = invoicesQuery.data || [];
  const payment = paymentQuery.data;
  const paymentQr = typeof payment?.qr === 'string' ? payment.qr : '';
  const paymentQrIsImage = paymentQr.startsWith('data:image/');
  const paymentQrIsLink = /^https?:\/\//i.test(paymentQr);
  const providerPaid = payment?.status === 'paid' || payment?.providerStatus === 'paid';
  const paymentTerminalStatus = String(payment?.status || payment?.providerStatus || '').toLowerCase();
  const paymentFailed = ['failed', 'expired'].includes(paymentTerminalStatus);

  useEffect(() => {
    if (paymentFailed) {
      void queryClient.invalidateQueries({ queryKey: ['partner-branch-billing', 'invoices', organizationId] });
    }
  }, [paymentFailed, organizationId, queryClient]);

  if (!canReadBilling || !organizationId) return null;
  if (invoicesQuery.isLoading) return <Card padding="md"><Skeleton className="h-36" /></Card>;
  if (invoicesQuery.isError) return <QueryError what="счета филиальной подписки" onRetry={() => invoicesQuery.refetch()} />;

  return (
    <section className="space-y-3" aria-labelledby="partner-branch-billing-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="partner-branch-billing-title" className="text-sm font-semibold text-txt-primary">Подписка филиалов DentVision</h3>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-txt-muted">
            Абонентская плата рассчитывается по активным тарифицируемым филиалам. Она отделена от комиссии за оплаченные направления и заказы; сумма каждого счёта зафиксирована на период.
          </p>
        </div>
        <Button size="sm" variant="ghost" icon={<RefreshCw size={14} />} loading={invoicesQuery.isFetching} onClick={() => void invoicesQuery.refetch()}>
          Обновить
        </Button>
      </div>

      {invoices.length === 0 ? (
        <Card padding="md">
          <p className="text-sm text-txt-secondary">Счетов филиальной подписки пока нет.</p>
          <p className="mt-1 text-xs text-txt-muted">Счета формируются финансовой службой DentVision на основании утверждённого тарифа и снимка активных филиалов. Самостоятельно изменить период или сумму из кабинета нельзя.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice) => (
            <Card key={invoice.id} padding="md" className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-txt-primary">{invoice.invoiceNumber}</p>
                    <Badge variant={partnerBranchInvoiceStatusTone(invoice.status)}>{partnerBranchInvoiceStatusLabel(invoice.status)}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-txt-muted">{partnerBranchVerticalLabel(invoice.vertical)} · тариф {invoice.policyVersion}</p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-lg font-semibold tabular-nums text-txt-primary">{formatPartnerBranchMoney(invoice.amountMinor)}</p>
                  <p className="text-[11px] text-txt-muted">{invoice.currency || 'KZT'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <div className="rounded-lg bg-surface-1 p-2">
                  <p className="text-txt-muted">Период</p>
                  <p className="mt-1 font-medium text-txt-primary">{date(invoice.periodStart)} — {date(invoice.periodEnd)}</p>
                </div>
                <div className="rounded-lg bg-surface-1 p-2">
                  <p className="text-txt-muted">Активные филиалы</p>
                  <p className="mt-1 font-medium text-txt-primary">{invoice.activeBranchCount}</p>
                </div>
                <div className="rounded-lg bg-surface-1 p-2">
                  <p className="text-txt-muted">Тарифицируемые</p>
                  <p className="mt-1 font-medium text-txt-primary">{invoice.billableBranchCount}</p>
                </div>
                <div className="rounded-lg bg-surface-1 p-2">
                  <p className="text-txt-muted">Цена филиала / месяц</p>
                  <p className="mt-1 font-medium text-txt-primary">{formatPartnerBranchUnitPrice(invoice.unitPriceKzt)}</p>
                </div>
              </div>

              {invoice.paidAt && <p className="text-xs text-success">Оплачен {new Date(invoice.paidAt).toLocaleString('ru-RU')}</p>}

              {invoice.status === 'issued' && canManageBilling && (
                <Button size="sm" icon={<CreditCard size={14} />} loading={startPaymentMutation.isPending} disabled={startPaymentMutation.isPending} onClick={() => startPaymentMutation.mutate(invoice)}>
                  Оплатить счёт через Kaspi
                </Button>
              )}

              {invoice.status === 'payment_pending' && invoice.paymentId && canManageBilling && (
                <Button size="sm" variant="secondary" icon={<CreditCard size={14} />} onClick={() => { setSelectedInvoiceId(invoice.id); setSelectedPaymentId(invoice.paymentId || null); }}>
                  Продолжить оплату
                </Button>
              )}

              {invoice.status === 'payment_pending' && !canManageBilling && (
                <p className="text-xs text-txt-muted">Платёж уже создан. Проверить или продолжить его может сотрудник с правом управления финансами.</p>
              )}

              {selectedInvoiceId === invoice.id && selectedPaymentId && (
                <div className="space-y-3 rounded-xl border border-bdr-subtle bg-surface-1 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-txt-primary">Платёж {selectedPaymentId.slice(0, 12)}</p>
                    <Badge variant={providerPaid ? 'success' : paymentFailed ? 'error' : 'warning'}>
                      {providerPaid ? 'Оплата подтверждена провайдером'
                        : paymentFailed ? (paymentTerminalStatus === 'expired' ? 'Платёж истёк' : 'Платёж отклонён')
                          : 'Ожидает подтверждения Kaspi'}
                    </Badge>
                  </div>
                  {paymentQuery.isLoading ? <Skeleton className="h-20" /> : paymentQuery.isError ? (
                    <QueryError what="данные платежа" onRetry={() => paymentQuery.refetch()} />
                  ) : (
                    <>
                      {paymentQrIsImage && <img src={paymentQr} alt="QR-код оплаты филиальной подписки" className="h-48 w-48 rounded-lg border border-bdr-subtle object-contain" />}
                      {paymentQrIsLink && <a href={paymentQr} target="_blank" rel="noreferrer" className="text-sm font-medium text-dv-gold underline underline-offset-4">Открыть платёж / QR Kaspi</a>}
                      {!paymentQrIsImage && !paymentQrIsLink && <p className="text-xs text-txt-muted">Платёж зарегистрирован. Для подтверждения дождитесь обновления статуса от платёжного провайдера.</p>}
                      {payment?.providerStatus && <p className="text-xs text-txt-muted">Статус провайдера: {String(payment.providerStatus)}</p>}
                    </>
                  )}
                  {!paymentFailed && invoice.status !== 'paid' && invoice.status !== 'void' && (
                    <Button size="sm" variant="secondary" loading={confirmMutation.isPending} disabled={confirmMutation.isPending || paymentQuery.isLoading} onClick={() => confirmMutation.mutate()}>
                      {providerPaid ? 'Завершить подтверждение оплаты' : 'Проверить оплату'}
                    </Button>
                  )}
                  {paymentFailed && <p role="status" className="text-xs text-error">Платёж не завершён. Счёт освобождён и доступен для повторной оплаты.</p>}
                  {confirmMutation.isError && <p role="alert" className="text-xs text-error">{confirmMutation.error instanceof Error ? confirmMutation.error.message : 'Не удалось проверить оплату'}</p>}
                  {providerPaid && invoice.status !== 'paid' && <p className="text-xs text-success">Провайдер подтвердил оплату. Завершите серверное подтверждение, чтобы обновить статус счёта и подписки.</p>}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {startPaymentMutation.isError && <p role="alert" className="text-xs text-error">{startPaymentMutation.error instanceof Error ? startPaymentMutation.error.message : 'Не удалось создать платёж'}</p>}
    </section>
  );
}
