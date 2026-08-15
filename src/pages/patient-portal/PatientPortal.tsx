import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Calendar, FileText, Receipt, Activity, LogIn, UserPlus,
  ClipboardList, FileImage, AlertCircle, RefreshCw, FileSignature,
  Eye, Stethoscope, Clock, Building2, User, CheckCircle2, Check, X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tabs } from '@/components/ui/ds/Misc';
import { ConsentGate } from './ConsentGate';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/ds/Card';
import { Button } from '@/components/ui/ds/Button';
import { Badge } from '@/components/ui/ds/Badge';
import { Skeleton } from '@/components/ui/ds/Skeleton';
import { GlassCard } from '@/components/ui/ds/GlassCard';
import { EmptyState } from '@/components/ui/ds/EmptyState';
import { Modal } from '@/components/ui/ds/Modal';
import { Input } from '@/components/ui/ds/Input';
import { PageHeader } from '@/components/ui/ds/StatCard';
import { useToast } from '@/components/ui/ds/Toast';
import SignaturePad from '@/components/ui/SignaturePad';
import { getAccessToken } from '@/utils/api';

function downloadDocument(docId: string, title: string) {
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
import { useAuth } from '@/store/auth.store';
import * as api from '@/utils/api';
import { cn } from '@/lib/utils';

type PortalTab = 'appointments' | 'treatments' | 'visits' | 'payments' | 'documents' | 'diagnostics' | 'access';

function usePortalLocale() {
  const { i18n } = useTranslation();
  return useMemo(() => {
    const lang = i18n.language?.startsWith('kz') ? 'kk' : i18n.language?.startsWith('en') ? 'en' : 'ru';
    return {
      locale: lang === 'kk' ? 'kk-KZ' : lang === 'en' ? 'en-US' : 'ru-RU',
      lang,
    };
  }, [i18n.language]);
}

function useFormatters() {
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

function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return <Badge variant="outline">—</Badge>;
  const s = status.toLowerCase();
  let variant: React.ComponentProps<typeof Badge>['variant'] = 'outline';
  if (['completed', 'подписан', 'signed', 'paid', 'оплачен', 'confirmed'].some((x) => s.includes(x))) variant = 'success';
  else if (['pending', 'ожидает', 'scheduled', 'запланирован'].some((x) => s.includes(x))) variant = 'warning';
  else if (['cancelled', 'отменён', 'no-show'].some((x) => s.includes(x))) variant = 'error';
  return <Badge variant={variant} size="sm">{status}</Badge>;
}

function TabLoader() {
  return (
    <div className="space-y-3">
      <Skeleton variant="card" height={80} />
      <Skeleton variant="card" height={80} />
      <Skeleton variant="card" height={80} />
    </div>
  );
}

function TabError({ onRetry }: { onRetry?: () => void }) {
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

function AppointmentsTab() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['pp-appointments'],
    queryFn: () => api.apiRequest('/api/patient-portal/appointments'),
  });
  const fmt = useFormatters();
  const items = data?.data || [];
  if (isLoading) return <TabLoader />;
  if (isError) return <TabError onRetry={refetch} />;
  if (!items.length) {
    return (
      <EmptyState
        icon={<Calendar size={28} className="text-dv-gold" />}
        title={t('patientPortal.empty.appointments')}
        description={t('patientPortal.empty.appointments_desc')}
      />
    );
  }
  return (
    <div className="space-y-3">
      {items.map((a: any) => (
        <Card key={a.id} padding="md" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-txt-primary truncate">{a.procedureType || t('patientPortal.appointments.title')}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-txt-muted mt-1">
              <span className="inline-flex items-center gap-1"><User size={12} /> {a.doctor?.firstName} {a.doctor?.lastName}</span>
              <span className="inline-flex items-center gap-1"><Building2 size={12} /> {a.clinic?.name}</span>
            </div>
          </div>
          <div className="text-left sm:text-right shrink-0">
            <p className="text-sm font-medium text-txt-primary">{fmt.dateShort(a.date)} {a.time && `· ${a.time}`}</p>
            <div className="mt-1"><StatusBadge status={a.status} /></div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function TreatmentsTab() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['pp-treatments'],
    queryFn: () => api.apiRequest('/api/patient-portal/treatments'),
  });
  const fmt = useFormatters();
  const items = data?.data || [];
  if (isLoading) return <TabLoader />;
  if (isError) return <TabError onRetry={refetch} />;
  if (!items.length) {
    return (
      <EmptyState
        icon={<Activity size={28} className="text-dv-gold" />}
        title={t('patientPortal.empty.treatments')}
        description={t('patientPortal.empty.treatments_desc')}
      />
    );
  }
  return (
    <div className="space-y-3">
      {items.map((item: any) => (
        <Card key={item.id} padding="md" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-txt-primary truncate">{item.procedureType || '—'}</p>
            <p className="text-xs text-txt-muted mt-1">
              {item.toothNumber ? `${t('patientPortal.treatments.tooth')} ${item.toothNumber}` : ''}
              {item.toothNumber && item.clinic?.name ? ' · ' : ''}
              {item.clinic?.name}
            </p>
          </div>
          <div className="text-left sm:text-right shrink-0">
            <p className="text-sm font-semibold text-txt-primary">{fmt.money(item.cost)}</p>
            <p className="text-xs text-txt-muted mt-0.5">{fmt.dateShort(item.createdAt)}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}

function VisitsTab() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['pp-visits'],
    queryFn: () => api.apiRequest('/api/patient-portal/visits'),
  });
  const fmt = useFormatters();
  const items = data?.data || [];
  if (isLoading) return <TabLoader />;
  if (isError) return <TabError onRetry={refetch} />;
  if (!items.length) {
    return (
      <EmptyState
        icon={<ClipboardList size={28} className="text-dv-gold" />}
        title={t('patientPortal.empty.visits')}
        description={t('patientPortal.empty.visits_desc')}
      />
    );
  }
  return (
    <div className="space-y-3">
      {items.map((v: any) => (
        <Card key={v.id} padding="md">
          <CardHeader>
            <CardTitle>{v.diagnosis || t('patientPortal.visits.diagnosis')}</CardTitle>
            <p className="text-xs text-txt-muted">{fmt.dateShort(v.date)}</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {v.treatmentPlan && (
              <p className="text-xs text-txt-muted">
                <span className="text-txt-ghost">{t('patientPortal.visits.treatment_plan')}:</span> {v.treatmentPlan}
              </p>
            )}
            {v.procedures && (
              <p className="text-xs text-txt-muted">
                <span className="text-txt-ghost">{t('patientPortal.visits.procedures')}:</span> {v.procedures}
              </p>
            )}
            {v.prescription && (
              <p className="text-xs text-txt-muted">
                <span className="text-txt-ghost">{t('patientPortal.visits.prescription')}:</span> {v.prescription}
              </p>
            )}
            <p className="text-xs text-txt-ghost pt-1 border-t border-white/5">
              {v.doctor?.firstName} {v.doctor?.lastName} — {v.clinic?.name}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PaymentsTab() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['pp-invoices'],
    queryFn: () => api.apiRequest('/api/patient-portal/invoices'),
  });
  const fmt = useFormatters();
  const result = data?.data || {};
  const invoices = result.invoices || [];
  const summary = result.summary || {};
  if (isLoading) return <TabLoader />;
  if (isError) return <TabError onRetry={refetch} />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <GlassCard padding="sm">
          <p className="text-xs text-txt-muted">{t('patientPortal.payments.summary.total')}</p>
          <p className="text-lg font-bold text-txt-primary">{fmt.money(summary.total)}</p>
        </GlassCard>
        <GlassCard padding="sm">
          <p className="text-xs text-txt-muted">{t('patientPortal.payments.summary.paid')}</p>
          <p className="text-lg font-bold text-success">{fmt.money(summary.paid)}</p>
        </GlassCard>
        <GlassCard padding="sm">
          <p className="text-xs text-txt-muted">{t('patientPortal.payments.summary.unpaid')}</p>
          <p className="text-lg font-bold text-warning">{fmt.money(summary.unpaid)}</p>
        </GlassCard>
      </div>
      {!invoices.length ? (
        <EmptyState
          icon={<Receipt size={28} className="text-dv-gold" />}
          title={t('patientPortal.empty.payments')}
          description={t('patientPortal.empty.payments_desc')}
        />
      ) : (
        <div className="space-y-3">
          {invoices.map((inv: any) => (
            <Card key={inv.id} padding="md" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-txt-primary truncate">{inv.clinic?.name}</p>
                <p className="text-xs text-txt-muted mt-0.5">{fmt.dateShort(inv.createdAt)}</p>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                <p className="text-sm font-semibold text-txt-primary">{fmt.money(inv.amount)}</p>
                <StatusBadge status={inv.status} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SignDocumentModal({ document, onClose }: { document: any; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState(document?.signedByName || document?.patientName || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSign = async (signatureData: string) => {
    if (!name.trim()) {
      setError(t('patientPortal.documents.full_name'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.signDocument(document.id, { signatureData, signedByName: name.trim() });
      queryClient.invalidateQueries({ queryKey: ['pp-documents'] });
      onClose();
    } catch (e: any) {
      setError(e?.message || t('patientPortal.documents.sign_error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={t('patientPortal.documents.signing')} size="md">
      <div className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 bg-error/10 border border-error/25 rounded-xl px-3 py-2.5 text-xs text-error">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}
        <div className="rounded-xl border border-dv-gold/20 bg-dv-gold/5 p-3 text-xs text-txt-secondary space-y-1">
          <p><span className="text-txt-muted">{t('patientPortal.documents.title')}:</span> {document.title}</p>
          <p><span className="text-txt-muted">{t('patientPortal.documents.type')}:</span> {document.docType}</p>
        </div>
        <Input
          label={t('patientPortal.documents.full_name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('patientPortal.documents.full_name_placeholder')}
          required
        />
        <p className="text-xs text-txt-muted">{t('patientPortal.documents.signature_hint')}</p>
        <div className="flex justify-center">
          <SignaturePad
            onSave={handleSign}
            width={Math.min(500, 340)}
            height={160}
            label={t('patientPortal.documents.signature_label')}
            clearLabel={t('patientPortal.documents.clear')}
            applyLabel={t('patientPortal.documents.apply_signature')}
          />
        </div>
        {submitting && <p className="text-xs text-dv-gold text-center">{t('common.loading')}</p>}
        <p className="text-[10px] text-txt-ghost text-center">{t('patientPortal.documents.consent')}</p>
      </div>
    </Modal>
  );
}

function DocumentsTab() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['pp-documents'],
    queryFn: () => api.apiRequest('/api/patient-portal/documents'),
  });
  const fmt = useFormatters();
  const [signDoc, setSignDoc] = useState<any>(null);
  const items = data?.data || [];
  if (isLoading) return <TabLoader />;
  if (isError) return <TabError onRetry={refetch} />;
  if (!items.length) {
    return (
      <EmptyState
        icon={<FileImage size={28} className="text-dv-gold" />}
        title={t('patientPortal.empty.documents')}
        description={t('patientPortal.empty.documents_desc')}
      />
    );
  }
  return (
    <>
      <div className="space-y-3">
        {items.map((d: any) => {
          const isSigned = !!d.signedAt;
          return (
            <Card key={d.id} padding="md" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="shrink-0 mt-0.5">
                  <FileImage size={20} className="text-txt-muted" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-txt-primary truncate">{d.title}</p>
                  <p className="text-xs text-txt-muted mt-0.5">{d.docType} · {d.clinic?.name}</p>
                  <p className="text-xs text-txt-ghost mt-0.5">{fmt.dateShort(d.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                <Badge variant={isSigned ? 'success' : 'warning'} size="sm">
                  {isSigned ? t('patientPortal.documents.signed') : t('patientPortal.documents.pending')}
                </Badge>
                {isSigned ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Eye size={14} />}
                    onClick={() => downloadDocument(d.id, d.title)}
                  >
                    {t('patientPortal.documents.view')}
                  </Button>
                ) : (
                  <Button size="sm" variant="primary" icon={<FileSignature size={14} />} onClick={() => setSignDoc(d)}>
                    {t('patientPortal.documents.sign')}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      {signDoc && <SignDocumentModal document={signDoc} onClose={() => setSignDoc(null)} />}
    </>
  );
}

function DiagnosticsTab() {
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

const CROSS_CLINIC_CATEGORY_LABELS: Record<string, string> = {
  visits: 'Визиты',
  treatment_plans: 'Планы лечения',
  medical_history: 'История болезни',
  files: 'Снимки и документы',
  full_summary: 'Полная сводка',
};

function AccessTab() {
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

export default function PatientPortal() {
  const { t } = useTranslation();
  const { user, isAuthenticated, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<PortalTab>('appointments');

  // Arriving from a booking confirmation: the clinic and the phone used to book
  // come along in the query. `/link` attaches this account to the card
  // reception already holds — matching by phone as well as email — instead of
  // leaving the patient staring at an empty portal.
  //
  // Nothing called this endpoint before. The clinic link and the phone are the
  // difference between "your visits" and a second, blank card in the same
  // clinic.
  const linkClinicId = searchParams.get('clinic');
  const linkPhone = searchParams.get('phone');
  const [linkState, setLinkState] = useState<'idle' | 'linking' | 'done' | 'failed'>('idle');

  useEffect(() => {
    if (!isAuthenticated || !linkClinicId || linkState !== 'idle') return;
    setLinkState('linking');
    api
      .linkPatientToClinic({ clinicId: linkClinicId, phone: linkPhone || undefined })
      .then(() => {
        setLinkState('done');
        // Every tab was fetched before the link existed and answered 403.
        // The keys are flat strings rather than a shared prefix, so they are
        // named here; a new tab has to be added to this list.
        for (const key of ['pp-appointments', 'pp-treatments', 'pp-visits', 'pp-invoices', 'pp-documents', 'pp-diagnostics']) {
          queryClient.invalidateQueries({ queryKey: [key] });
        }
      })
      .catch(() => setLinkState('failed'));
  }, [isAuthenticated, linkClinicId, linkPhone, linkState, queryClient]);

  const tabs = useMemo(() => [
    { id: 'appointments' as PortalTab, label: t('patientPortal.tabs.appointments'), icon: <Calendar size={14} /> },
    { id: 'treatments' as PortalTab, label: t('patientPortal.tabs.treatments'), icon: <Activity size={14} /> },
    { id: 'visits' as PortalTab, label: t('patientPortal.tabs.visits'), icon: <ClipboardList size={14} /> },
    { id: 'payments' as PortalTab, label: t('patientPortal.tabs.payments'), icon: <Receipt size={14} /> },
    { id: 'documents' as PortalTab, label: t('patientPortal.tabs.documents'), icon: <FileImage size={14} /> },
    { id: 'diagnostics' as PortalTab, label: t('patientPortal.tabs.diagnostics'), icon: <FileText size={14} /> },
    { id: 'access' as PortalTab, label: 'Доступ клиник', icon: <CheckCircle2 size={14} /> },
  ], [t]);

  const portalReturnUrl = `/patient-portal${linkClinicId ? `?clinic=${encodeURIComponent(linkClinicId)}${linkPhone ? `&phone=${encodeURIComponent(linkPhone)}` : ''}` : ''}`;

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-0 p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm text-center">
          <Card padding="lg">
            <h1 className="text-2xl font-bold text-txt-primary mb-2">{t('patientPortal.title')}</h1>
            <p className="text-sm text-txt-muted mb-6">{t('patientPortal.subtitle')}</p>
            <div className="space-y-3">
              {/* Carry the clinic and phone through the login round-trip, so a
                  patient who arrives from a booking is still linked afterwards. */}
              <Button variant="primary" className="w-full" onClick={() => navigate(`/login?portal=patient&returnUrl=${encodeURIComponent(portalReturnUrl)}`)} icon={<LogIn size={16} />}>{t('patientPortal.login')}</Button>
              <Button variant="outline" className="w-full" onClick={() => navigate(`/login?portal=patient&register=1&returnUrl=${encodeURIComponent(portalReturnUrl)}`)} icon={<UserPlus size={16} />}>{t('patientPortal.register')}</Button>

              {/* The shortest path for a patient arriving from a booking: one
                  click instead of inventing a password for one more service. */}
              <GoogleSignInButton onCredential={(idToken) => void loginWithGoogle(idToken)} />

              <p className="text-xs text-txt-ghost pt-2">{t('patientPortal.link_hint')}</p>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    // Every portal route is behind `requireConsent()`, so the agreements come
    // first or nothing below can load at all.
    <ConsentGate>
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title={t('patientPortal.title')}
        subtitle={t('patientPortal.welcome', { name: user.name || user.login })}
        icon={<User size={22} />}
        actions={
          <Button asChild variant="outline" size="sm" className="min-h-11" icon={<Calendar size={14} />} disabled={!user.clinicId}>
            <Link to={user.clinicId ? `/book/${user.clinicId}` : '#'}>{t('patientPortal.book_online')}</Link>
          </Button>
        }
      />

      <Tabs tabs={tabs} active={activeTab} onChange={(id) => setActiveTab(id as PortalTab)} />

      <div className="min-h-[200px]">
        {activeTab === 'appointments' && <AppointmentsTab />}
        {activeTab === 'treatments' && <TreatmentsTab />}
        {activeTab === 'visits' && <VisitsTab />}
        {activeTab === 'payments' && <PaymentsTab />}
        {activeTab === 'documents' && <DocumentsTab />}
        {activeTab === 'diagnostics' && <DiagnosticsTab />}
        {activeTab === 'access' && <AccessTab />}
      </div>
    </motion.div>
    </ConsentGate>
  );
}
