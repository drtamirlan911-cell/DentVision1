import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import {
  Calendar, FileText, Receipt, Activity,
  LogIn, UserPlus, ClipboardList, FileImage,
} from 'lucide-react';
import { Tabs } from '@/components/ui/ds/Misc';
import { Card } from '@/components/ui/ds/Card';
import { Button } from '@/components/ui/ds/Button';
import { Badge } from '@/components/ui/ds/Badge';
import { Skeleton } from '@/components/ui/ds/Skeleton';
import { GlassCard } from '@/components/ui/ds/GlassCard';
import { useAuth } from '@/store/auth.store';
import * as api from '@/utils/api';

function AppointmentsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['pp-appointments'],
    queryFn: () => api.apiRequest('/api/patient-portal/appointments'),
  });
  const items = data?.data || [];
  if (isLoading) return <Skeleton className="h-48" />;
  if (!items.length) return <div className="flex items-center justify-center h-32 text-txt-muted text-sm">Нет приёмов</div>;
  return (
    <div className="space-y-2">
      {items.map((a: any) => (
        <Card key={a.id} padding="md" className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-txt-primary">{a.procedureType || 'Приём'}</p>
            <p className="text-xs text-txt-muted">{a.doctor?.firstName} {a.doctor?.lastName} — {a.clinic?.name}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-txt-primary">{a.date?.slice(0, 10)} {a.time}</p>
            <Badge variant="outline" size="sm">{a.status}</Badge>
          </div>
        </Card>
      ))}
    </div>
  );
}

function TreatmentsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['pp-treatments'],
    queryFn: () => api.apiRequest('/api/patient-portal/treatments'),
  });
  const items = data?.data || [];
  if (isLoading) return <Skeleton className="h-48" />;
  if (!items.length) return <div className="flex items-center justify-center h-32 text-txt-muted text-sm">Нет записей о лечении</div>;
  return (
    <div className="space-y-2">
      {items.map((t: any) => (
        <Card key={t.id} padding="md" className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-txt-primary">{t.procedureType}</p>
            <p className="text-xs text-txt-muted">Зуб {t.toothNumber} — {t.clinic?.name}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-txt-primary">{Number(t.cost || 0).toLocaleString()} ₸</p>
            <p className="text-xs text-txt-muted">{t.createdAt?.slice(0, 10)}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}

function VisitsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['pp-visits'],
    queryFn: () => api.apiRequest('/api/patient-portal/visits'),
  });
  const items = data?.data || [];
  if (isLoading) return <Skeleton className="h-48" />;
  if (!items.length) return <div className="flex items-center justify-center h-32 text-txt-muted text-sm">Нет истории посещений</div>;
  return (
    <div className="space-y-3">
      {items.map((v: any) => (
        <Card key={v.id} padding="md">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-txt-primary">{v.diagnosis || 'Визит'}</p>
            <p className="text-xs text-txt-muted">{v.date?.slice(0, 10)}</p>
          </div>
          {v.treatmentPlan && <p className="text-xs text-txt-muted mb-1">План: {v.treatmentPlan}</p>}
          {v.procedures && <p className="text-xs text-txt-muted mb-1">Процедуры: {v.procedures}</p>}
          {v.prescription && <p className="text-xs text-txt-muted">Назначения: {v.prescription}</p>}
          <p className="text-xs text-txt-ghost mt-1">{v.doctor?.firstName} {v.doctor?.lastName} — {v.clinic?.name}</p>
        </Card>
      ))}
    </div>
  );
}

function PaymentsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['pp-invoices'],
    queryFn: () => api.apiRequest('/api/patient-portal/invoices'),
  });
  const result = data?.data || {};
  const invoices = result.invoices || [];
  const summary = result.summary || {};
  if (isLoading) return <Skeleton className="h-48" />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <GlassCard padding="sm">
          <p className="text-xs text-txt-muted">Всего</p>
          <p className="text-lg font-bold text-txt-primary">{Number(summary.total || 0).toLocaleString()} ₸</p>
        </GlassCard>
        <GlassCard padding="sm">
          <p className="text-xs text-txt-muted">Оплачено</p>
          <p className="text-lg font-bold text-success">{Number(summary.paid || 0).toLocaleString()} ₸</p>
        </GlassCard>
        <GlassCard padding="sm">
          <p className="text-xs text-txt-muted">К оплате</p>
          <p className="text-lg font-bold text-warning">{Number(summary.unpaid || 0).toLocaleString()} ₸</p>
        </GlassCard>
      </div>
      {!invoices.length ? <div className="flex items-center justify-center h-32 text-txt-muted text-sm">Нет счетов</div> : (
        <div className="space-y-2">
          {invoices.map((inv: any) => (
            <Card key={inv.id} padding="md" className="flex items-center justify-between">
              <div>
                <p className="text-sm text-txt-primary">{inv.clinic?.name}</p>
                <p className="text-xs text-txt-muted">{inv.createdAt?.slice(0, 10)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-txt-primary">{Number(inv.amount || 0).toLocaleString()} ₸</p>
                <Badge variant="outline" size="sm">{inv.status}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['pp-documents'],
    queryFn: () => api.apiRequest('/api/patient-portal/documents'),
  });
  const items = data?.data || [];
  if (isLoading) return <Skeleton className="h-48" />;
  if (!items.length) return <div className="flex items-center justify-center h-32 text-txt-muted text-sm">Нет документов</div>;
  return (
    <div className="space-y-2">
      {items.map((d: any) => (
        <Card key={d.id} padding="md" className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileImage size={18} className="text-txt-muted" />
            <div>
              <p className="text-sm text-txt-primary">{d.title}</p>
              <p className="text-xs text-txt-muted">{d.docType} — {d.clinic?.name}</p>
            </div>
          </div>
          <div className="text-right">
            {d.signedAt ? <Badge variant="filled" className="bg-success/20 text-success">Подписан</Badge> : <Badge variant="outline">Ожидает</Badge>}
            <p className="text-xs text-txt-muted mt-0.5">{d.createdAt?.slice(0, 10)}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}

function DiagnosticsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['pp-diagnostics'],
    queryFn: () => api.apiRequest('/api/patient-portal/diagnostics'),
  });
  const items = data?.data || [];
  if (isLoading) return <Skeleton className="h-48" />;
  if (!items.length) return <div className="flex items-center justify-center h-32 text-txt-muted text-sm">Нет направлений</div>;
  return (
    <div className="space-y-3">
      {items.map((r: any) => (
        <Card key={r.id} padding="md">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-txt-primary">{r.studyType}</p>
            <Badge variant="outline" size="sm">{r.status}</Badge>
          </div>
          <p className="text-xs text-txt-muted mb-1">Категория: {r.category}</p>
          <p className="text-xs text-txt-muted mb-1">
            {r.center?.name && `Центр: ${r.center.name}`}
            {r.lab?.name && `Лаборатория: ${r.lab.name}`}
          </p>
          {r.result?.reportText && (
            <div className="mt-2 p-3 bg-surface-1 rounded-lg text-xs text-txt-primary max-h-24 overflow-y-auto">
              {r.result.reportText.slice(0, 300)}
            </div>
          )}
          {r.cost ? <p className="text-xs text-txt-muted mt-1">Стоимость: {Number(r.cost).toLocaleString()} ₸</p> : null}
        </Card>
      ))}
    </div>
  );
}

export default function PatientPortal() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('appointments');

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-0 p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm text-center">
          <Card padding="lg">
            <h1 className="text-2xl font-bold text-txt-primary mb-2">Кабинет пациента</h1>
            <p className="text-sm text-txt-muted mb-6">Войдите или создайте аккаунт для доступа к истории лечения, приёмам и оплатам</p>
            <div className="space-y-3">
              <Button variant="primary" className="w-full" onClick={() => navigate('/login?portal=patient')} icon={<LogIn size={16} />}>Войти как пациент</Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/login?portal=patient&register=1')} icon={<UserPlus size={16} />}>Зарегистрироваться</Button>
              <p className="text-xs text-txt-ghost pt-2">После регистрации попросите вашу клинику привязать аккаунт к вашей карте пациента</p>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-txt-primary">Кабинет пациента</h1>
        <p className="text-sm text-txt-muted mt-0.5">{user.name}</p>
      </div>

      <Tabs
        tabs={[
          { id: 'appointments', label: 'Приёмы', icon: <Calendar size={14} /> },
          { id: 'treatments', label: 'Лечение', icon: <Activity size={14} /> },
          { id: 'visits', label: 'Визиты', icon: <ClipboardList size={14} /> },
          { id: 'payments', label: 'Оплаты', icon: <Receipt size={14} /> },
          { id: 'docs', label: 'Документы', icon: <FileImage size={14} /> },
          { id: 'diagnostics', label: 'Диагностика', icon: <FileText size={14} /> },
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'appointments' && <AppointmentsTab />}
      {activeTab === 'treatments' && <TreatmentsTab />}
      {activeTab === 'visits' && <VisitsTab />}
      {activeTab === 'payments' && <PaymentsTab />}
      {activeTab === 'docs' && <DocumentsTab />}
      {activeTab === 'diagnostics' && <DiagnosticsTab />}
    </motion.div>
  );
}
