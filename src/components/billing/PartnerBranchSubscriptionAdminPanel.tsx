import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/ds/Badge';
import { Button } from '@/components/ui/ds/Button';
import { Card } from '@/components/ui/ds/Card';
import { QueryError } from '@/components/ui/ds/QueryError';
import { Skeleton } from '@/components/ui/ds/Skeleton';
import {
  getOrganizations,
  getPartnerBranchSubscriptionInvoices,
  issuePartnerBranchSubscriptionInvoice,
  type PartnerBranchSubscriptionInvoice,
} from '@/utils/api';
import {
  formatPartnerBranchMoney,
  partnerBranchInvoiceStatusLabel,
  partnerBranchInvoiceStatusTone,
  partnerBranchVerticalLabel,
} from '@/lib/partnerBranchBilling';

type OrganizationOption = {
  id: string;
  name: string;
  type: string;
  originalType?: string | null;
  originalId?: string | null;
  settings?: Record<string, unknown> | null;
};

function rowsOf(value: any): OrganizationOption[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function verticalOf(org: OrganizationOption): string {
  if (org.type === 'DIAGNOSTIC_CENTER') return 'DIAGNOSTIC_3D';
  const settings = org.settings && typeof org.settings === 'object' ? org.settings : {};
  const value = String(settings.partnerVertical || settings.laboratoryType || settings.selfServiceType || '').toUpperCase();
  if (value.includes('DENTAL')) return 'DENTAL_LAB';
  if (value.includes('MEDICAL')) return 'MEDICAL_ANALYSIS';
  return 'LABORATORY';
}

function dateLabel(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString('ru-RU');
}

export function PartnerBranchSubscriptionAdminPanel() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [issuedMessage, setIssuedMessage] = useState('');

  const organizationsQuery = useQuery({
    queryKey: ['finance', 'partner-branch-billing', 'organizations', search],
    queryFn: async () => {
      const [centers, laboratories] = await Promise.all([
        getOrganizations({ type: 'DIAGNOSTIC_CENTER', search: search.trim() || undefined, page: 1, limit: 100 }),
        getOrganizations({ type: 'LABORATORY', search: search.trim() || undefined, page: 1, limit: 100 }),
      ]);
      const candidates = [...rowsOf(centers), ...rowsOf(laboratories)].filter((org) =>
        Boolean(org.id && org.originalId)
        && ((org.type === 'DIAGNOSTIC_CENTER' && org.originalType === 'DiagnosticCenter')
          || (org.type === 'LABORATORY' && org.originalType === 'Laboratory')),
      );
      return candidates.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    },
    staleTime: 30_000,
  });

  const invoicesQuery = useQuery({
    queryKey: ['finance', 'partner-branch-billing', 'invoices', organizationId],
    queryFn: () => getPartnerBranchSubscriptionInvoices(organizationId || undefined, 100),
    refetchInterval: 30_000,
  });

  const issueMutation = useMutation({
    mutationFn: () => {
      const currentOrganizations = organizationsQuery.data || [];
      const activeSelection = currentOrganizations.find((org) => org.id === organizationId);
      if (!activeSelection || !organizationId || !periodStart || !periodEnd || periodEnd <= periodStart) {
        throw new Error('Выберите доступную организацию и корректный период');
      }
      return issuePartnerBranchSubscriptionInvoice({
        organizationId,
        periodStart: new Date(`${periodStart}T00:00:00.000Z`).toISOString(),
        // The period end is an exclusive boundary: a monthly invoice for November
        // uses 01 Nov 00:00 UTC → 01 Dec 00:00 UTC.
        periodEnd: new Date(`${periodEnd}T00:00:00.000Z`).toISOString(),
      });
    },
    onSuccess: (invoice: PartnerBranchSubscriptionInvoice) => {
      setIssuedMessage(`Счёт ${invoice.invoiceNumber} сформирован или уже существовал для этого периода.`);
      void queryClient.invalidateQueries({ queryKey: ['finance', 'partner-branch-billing', 'invoices'] });
    },
  });

  const organizations = organizationsQuery.data || [];
  const selectedOrganization = organizations.find((org) => org.id === organizationId);
  const invoices = invoicesQuery.data || [];
  const organizationNames = useMemo(() => new Map(organizations.map((org) => [org.id, org.name])), [organizations]);
  const validPeriod = Boolean(periodStart && periodEnd && periodEnd > periodStart);

  return (
    <div className="space-y-4">
      <Card padding="md" className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-txt-primary">Выпуск филиальных счетов партнёров</h3>
          <p className="mt-1 text-xs leading-relaxed text-txt-muted">
            Финансовая служба формирует неизменяемый счёт по подтверждённой организации, тарифу и снимку активных филиалов. Сумма и филиалы не вводятся вручную. Партнёр оплачивает сформированный счёт в своём кабинете.
          </p>
        </div>

        {organizationsQuery.isError ? <QueryError what="список организаций партнёров" onRetry={() => organizationsQuery.refetch()} /> : (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block space-y-1 text-xs text-txt-secondary">
              Поиск организации
              <input value={search} onChange={(event) => { setSearch(event.target.value); setOrganizationId(''); setIssuedMessage(''); }} maxLength={120} placeholder="Название центра или лаборатории" className="min-h-11 w-full rounded-lg border border-bdr-subtle bg-surface-1 px-3 text-sm text-txt-primary" />
            </label>
            <label className="block space-y-1 text-xs text-txt-secondary">
              Партнёрская организация
              <select value={organizationId} onChange={(event) => { setOrganizationId(event.target.value); setIssuedMessage(''); }} disabled={organizationsQuery.isLoading} className="min-h-11 w-full rounded-lg border border-bdr-subtle bg-surface-1 px-3 text-sm text-txt-primary">
                <option value="">Выберите организацию</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>{org.name} — {partnerBranchVerticalLabel(verticalOf(org))}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        {selectedOrganization && (
          <div className="rounded-lg bg-surface-1 p-3 text-xs text-txt-secondary">
            <p className="font-medium text-txt-primary">{selectedOrganization.name}</p>
            <p className="mt-1">{partnerBranchVerticalLabel(verticalOf(selectedOrganization))}</p>
            <p className="mt-1">Перед выпуском сервер дополнительно проверяет активность, тарифную конфигурацию, юридическую активацию и филиалы.</p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-xs text-txt-secondary">
            Начало периода
            <input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} className="min-h-11 w-full rounded-lg border border-bdr-subtle bg-surface-1 px-3 text-sm text-txt-primary" />
          </label>
          <label className="block space-y-1 text-xs text-txt-secondary">
            Окончание периода (не включается)
            <input type="date" value={periodEnd} min={periodStart || undefined} onChange={(event) => setPeriodEnd(event.target.value)} className="min-h-11 w-full rounded-lg border border-bdr-subtle bg-surface-1 px-3 text-sm text-txt-primary" />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-txt-muted">Начало должно быть раньше окончания. Повторный выпуск того же периода вернёт существующий счёт, а не создаст дубликат.</p>
          <Button size="sm" disabled={!selectedOrganization || !validPeriod || issueMutation.isPending} loading={issueMutation.isPending} onClick={() => { setIssuedMessage(''); issueMutation.mutate(); }}>
            Сформировать счёт
          </Button>
        </div>
        {issueMutation.isError && <p role="alert" className="text-xs text-error">{issueMutation.error instanceof Error ? issueMutation.error.message : 'Не удалось сформировать счёт'}</p>}
        {issuedMessage && <p role="status" className="text-xs text-success">{issuedMessage}</p>}
      </Card>

      <Card padding="md" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-txt-primary">Счета партнёров</h3>
            <p className="mt-1 text-xs text-txt-muted">{invoices.length} последних записей · до 100</p>
          </div>
          <Button size="sm" variant="ghost" loading={invoicesQuery.isFetching} onClick={() => void invoicesQuery.refetch()}>Обновить</Button>
        </div>
        {invoicesQuery.isLoading ? <Skeleton className="h-32" />
          : invoicesQuery.isError ? <QueryError what="реестр филиальных счетов" onRetry={() => invoicesQuery.refetch()} />
            : invoices.length === 0 ? <p className="py-6 text-center text-sm text-txt-muted">Счета ещё не сформированы.</p>
              : <div className="divide-y divide-bdr-subtle">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-txt-primary">{organizationNames.get(invoice.organizationId) || invoice.organizationId}</p>
                      <p className="mt-1 text-xs text-txt-muted">{invoice.invoiceNumber} · {partnerBranchVerticalLabel(invoice.vertical)}</p>
                      <p className="mt-1 text-[11px] text-txt-muted">{dateLabel(invoice.periodStart)} — {dateLabel(invoice.periodEnd)} · {invoice.billableBranchCount} тарифицируемых филиала</p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums text-txt-primary">{formatPartnerBranchMoney(invoice.amountMinor)}</p>
                    <Badge variant={partnerBranchInvoiceStatusTone(invoice.status)}>{partnerBranchInvoiceStatusLabel(invoice.status)}</Badge>
                  </div>
                ))}
              </div>}
      </Card>
    </div>
  );
}
