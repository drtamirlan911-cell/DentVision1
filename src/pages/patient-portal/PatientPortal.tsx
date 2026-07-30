import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Calendar, FileText, Receipt, MessageCircle, Activity,
  LogIn, LogOut, ChevronRight, ClipboardList, FileImage,
} from 'lucide-react';
import { Tabs } from '@/components/ui/ds/Misc';
import { Card } from '@/components/ui/ds/Card';
import { Button } from '@/components/ui/ds/Button';
import { Badge } from '@/components/ui/ds/Badge';
import { Skeleton } from '@/components/ui/ds/Skeleton';
import { GlassCard } from '@/components/ui/ds/GlassCard';
import { Textarea } from '@/components/ui/ds/Input';

const API = '/api/patient-portal';

function apiFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem('patient_token');
  return fetch(path, {
    ...opts,
    headers: { ...opts?.headers, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  }).then(r => r.json());
}

function LoginStep({ onLogin }: { onLogin: (data: any) => void }) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [iin, setIin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email && !phone && !iin) { setError('Введите email, телефон или ИИН'); return; }
    setLoading(true); setError('');
    try {
      const res = await apiFetch(`${API}/login`, { method: 'POST', body: JSON.stringify({ email, phone, iin }) });
      if (!res.ok) { setError(res.error || 'Пациент не найден'); return; }
      localStorage.setItem('patient_token', res.data.token);
      onLogin(res.data);
    } catch { setError('Ошибка сети'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0 p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <Card padding="xl" className="text-center">
          <h1 className="text-2xl font-bold text-txt-primary mb-1">Кабинет пациента</h1>
          <p className="text-sm text-txt-muted mb-6">Войдите чтобы посмотреть историю лечения, приёмы и оплаты</p>
          <div className="space-y-3 text-left">
            <input value={iin} onChange={e => setIin(e.target.value)} placeholder="ИИН" className="w-full bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2.5 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold" />
            <div className="text-xs text-txt-ghost text-center">или</div>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" className="w-full bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2.5 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold" />
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Телефон" type="tel" className="w-full bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2.5 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold" />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <Button variant="primary" className="w-full" onClick={handleLogin} loading={loading} icon={<LogIn size={16} />}>Войти</Button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

export default function PatientPortal() {
  const [patientData, setPatientData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('appointments');

  const logout = () => { localStorage.removeItem('patient_token'); setPatientData(null); };

  if (!patientData) return <LoginStep onLogin={setPatientData} />;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-txt-primary">Кабинет пациента</h1>
          <p className="text-sm text-txt-muted mt-0.5">{patientData.patientName}</p>
        </div>
        <Button variant="ghost" size="sm" icon={<LogOut size={14} />} onClick={logout}>Выйти</Button>
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

function AppointmentsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['pp-appointments'],
    queryFn: () => apiFetch(`${API}/appointments`),
  });
  const items = data?.data || [];
  if (isLoading) return <Skeleton className="h-48" />;
  if (!items.length) return <Empty text="Нет приёмов" />;
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
    queryFn: () => apiFetch(`${API}/treatments`),
  });
  const items = data?.data || [];
  if (isLoading) return <Skeleton className="h-48" />;
  if (!items.length) return <Empty text="Нет записей о лечении" />;
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
    queryFn: () => apiFetch(`${API}/visits`),
  });
  const items = data?.data || [];
  if (isLoading) return <Skeleton className="h-48" />;
  if (!items.length) return <Empty text="Нет истории посещений" />;
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
    queryFn: () => apiFetch(`${API}/invoices`),
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
      {!invoices.length ? <Empty text="Нет счетов" /> : (
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
    queryFn: () => apiFetch(`${API}/documents`),
  });
  const items = data?.data || [];
  if (isLoading) return <Skeleton className="h-48" />;
  if (!items.length) return <Empty text="Нет документов" />;
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
    queryFn: () => apiFetch(`${API}/diagnostics`),
  });
  const items = data?.data || [];
  if (isLoading) return <Skeleton className="h-48" />;
  if (!items.length) return <Empty text="Нет направлений на диагностику" />;
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

function Empty({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center h-32 text-txt-muted text-sm">
      {text}
    </div>
  );
}
