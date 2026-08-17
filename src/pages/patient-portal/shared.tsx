import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/ds/Badge';
import { Button } from '@/components/ui/ds/Button';
import { Skeleton } from '@/components/ui/ds/Skeleton';
import { EmptyState } from '@/components/ui/ds/EmptyState';
import { getAccessToken } from '@/utils/api';

/**
 * The pieces every portal tab needs, pulled out of the single file the portal
 * used to be so each tab can live on its own. Behaviour is unchanged — this is
 * a move, not a rewrite.
 */

export type PortalTab =
  | 'appointments'
  | 'treatments'
  | 'visits'
  | 'payments'
  | 'documents'
  | 'diagnostics'
  | 'access';

export function usePortalLocale() {
  const { i18n } = useTranslation();
  return useMemo(() => {
    const lang = i18n.language?.startsWith('kz') ? 'kk' : i18n.language?.startsWith('en') ? 'en' : 'ru';
    return {
      locale: lang === 'kk' ? 'kk-KZ' : lang === 'en' ? 'en-US' : 'ru-RU',
      lang,
    };
  }, [i18n.language]);
}

export function useFormatters() {
  const { locale } = usePortalLocale();
  return useMemo(() => ({
    date: (value: string | Date | undefined | null) => {
      if (!value) return '—';
      try {
        const d = typeof value === 'string' ? new Date(value) : value;
        if (Number.isNaN(d.getTime())) return '—';
        return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
      } catch {
        return '—';
      }
    },
    dateShort: (value: string | Date | undefined | null) => {
      if (!value) return '—';
      try {
        const d = typeof value === 'string' ? new Date(value) : value;
        if (Number.isNaN(d.getTime())) return '—';
        return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
      } catch {
        return '—';
      }
    },
    time: (value: string | undefined | null) => {
      if (!value) return '';
      return value;
    },
    money: (amount: number | string | undefined | null, currency = 'KZT') => {
      const value = typeof amount === 'string' ? Number(amount) : (amount ?? 0);
      if (Number.isNaN(value)) return '—';
      return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
    },
  }), [locale]);
}

/**
 * Statuses arrive as free text in either language, so this matches on
 * substrings rather than an enum. Distinct from the design system's
 * `StatusBadge`, which maps a known set.
 */
export function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return <Badge variant="outline">—</Badge>;
  const s = status.toLowerCase();
  let variant: React.ComponentProps<typeof Badge>['variant'] = 'outline';
  if (['completed', 'подписан', 'signed', 'paid', 'оплачен', 'confirmed'].some((x) => s.includes(x))) variant = 'success';
  else if (['pending', 'ожидает', 'scheduled', 'запланирован'].some((x) => s.includes(x))) variant = 'warning';
  else if (['cancelled', 'отменён', 'no-show'].some((x) => s.includes(x))) variant = 'error';
  return <Badge variant={variant} size="sm">{status}</Badge>;
}

export function TabLoader() {
  return (
    <div className="space-y-3">
      <Skeleton variant="card" height={80} />
      <Skeleton variant="card" height={80} />
      <Skeleton variant="card" height={80} />
    </div>
  );
}

export function TabError({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={<AlertCircle size={28} className="text-error" />}
      title={t('patientPortal.error')}
      description={t('common.error')}
      action={onRetry ? <Button size="sm" variant="secondary" icon={<RefreshCw size={14} />} onClick={onRetry}>{t('patientPortal.retry')}</Button> : undefined}
    />
  );
}

export function downloadDocument(docId: string, title: string) {
  const token = getAccessToken();
  if (!token) return;
  const baseUrl = import.meta.env.VITE_API_URL || (
    window.location.hostname.includes('vercel.app')
      ? 'https://dentvision-api.onrender.com'
      : 'http://localhost:3001'
  );
  fetch(`${baseUrl}/api/patient-portal/documents/${docId}/content`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.blob();
    })
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'document'}.txt`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    })
    .catch((err) => console.error('Download failed:', err));
}
