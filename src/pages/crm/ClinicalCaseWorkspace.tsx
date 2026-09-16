import React, { useMemo } from 'react';
import { ArrowRight, BrainCircuit, CalendarDays, ClipboardList, CreditCard, FlaskConical, Image, PackageSearch, UserRound, Activity, Clock3, CircleDollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/ds/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/ds/Card';
import { Badge } from '@/components/ui/ds/Badge';
import { Button } from '@/components/ui/ds/Button';
import { useAuth } from '@/store/auth.store';
import { useDataQuery } from '@/queries/useDataQuery';
import { useEcosystemUrlContext } from '@/hooks/useEcosystemUrlContext';
import { withEcosystemContext } from '@/config/ecosystemContextLink';
import { resolveEcosystemRoute } from '@/config/ecosystemRouteResolver';

const FLOW = [
  { id: 'patient', label: 'Пациент', description: 'Карточка и история', icon: UserRound, route: '/crm/patients' },
  { id: 'diagnostics', label: 'Диагностика', description: 'Направления и результаты', icon: Image, route: '/diagnostics' },
  { id: 'treatment', label: 'План лечения', description: 'Этапы и стоимость', icon: ClipboardList, route: '/crm/treatment-plans' },
  { id: 'lab', label: 'Лаборатория', description: 'Заказы и сроки', icon: FlaskConical, route: '/crm/lab' },
  { id: 'market', label: 'Материалы', description: 'Поставщики и товары', icon: PackageSearch, route: '/shop' },
  { id: 'schedule', label: 'Запись', description: 'Визит и кресло', icon: CalendarDays, route: '/crm/schedule' },
  { id: 'finance', label: 'Финансы', description: 'Счёт и оплаты', icon: CreditCard, route: '/crm/cashier' },
  { id: 'ai', label: 'DentVision AI', description: 'Анализ и следующий шаг', icon: BrainCircuit, route: '/ai' },
] as const;

export default function ClinicalCaseWorkspace() {
  const navigate = useNavigate();
  const { user, clinic } = useAuth();
  const context = useEcosystemUrlContext();
  const clinicId = clinic?.id || user?.clinicId || '';
  const { patients, appointments, labOrders, visits, receipts } = useDataQuery(clinicId || undefined);

  const patient = useMemo(() => {
    if (!context.patientId || !Array.isArray(patients)) return null;
    return patients.find((item: any) => item.id === context.patientId) || null;
  }, [context.patientId, patients]);

  const caseAppointments = useMemo(
    () => context.patientId ? appointments.filter((item: any) => item.patientId === context.patientId) : [],
    [appointments, context.patientId],
  );
  const caseLabs = useMemo(
    () => context.patientId ? labOrders.filter((item: any) => item.patientId === context.patientId) : [],
    [labOrders, context.patientId],
  );
  const caseVisits = useMemo(
    () => context.patientId ? visits.filter((item: any) => item.patientId === context.patientId) : [],
    [visits, context.patientId],
  );
  const caseReceipts = useMemo(
    () => context.patientId ? receipts.filter((item: any) => item.patientId === context.patientId) : [],
    [receipts, context.patientId],
  );

  const nextAppointment = useMemo(() => {
    const now = Date.now();
    return caseAppointments
      .filter((item: any) => item.status !== 'cancelled' && new Date(item.date).getTime() >= now - 86400000)
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] || null;
  }, [caseAppointments]);

  const openLabs = caseLabs.filter((item: any) => !['delivered', 'cancelled'].includes(item.status));
  const outstanding = caseReceipts
    .filter((item: any) => ['debt', 'partial', 'pending', 'unpaid', 'overdue'].includes(String(item.status).toLowerCase()))
    .reduce((sum: number, item: any) => sum + Number(item.total || item.amount || 0), 0);

  const go = (route: string) => navigate(withEcosystemContext(resolveEcosystemRoute(route), context));

  return (
    <div className="dv-page max-w-6xl mx-auto space-y-6 py-4 md:py-6">
      <PageHeader
        title="Клинический кейс"
        subtitle="Единая рабочая точка для пациента, диагностики, лечения, лаборатории и финансов"
        icon={<ClipboardList size={20} />}
        actions={<Button size="sm" onClick={() => go('/ai')} icon={<BrainCircuit size={14} />}>Спросить AI</Button>}
      />

      <Card className="overflow-hidden border-dv-gold/20 bg-surface-1">
        <CardContent className="p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="gold" size="xs">Клинический контекст</Badge>
                {context.caseId && <span className="text-[11px] text-txt-muted">Кейс {context.caseId.slice(0, 8)}</span>}
              </div>
              <h2 className="mt-2 text-xl font-semibold text-txt-primary truncate">
                {patient?.name || (context.patientId ? 'Пациент загружается' : 'Выберите пациента')}
              </h2>
              <p className="mt-1 text-sm text-txt-secondary">
                {patient?.phone || 'Контекст кейса сохраняется при переходе между рабочими модулями.'}
              </p>
            </div>
            {context.patientId && (
              <Button variant="secondary" size="sm" onClick={() => go('/crm/patients')}>
                Открыть пациента <ArrowRight size={14} className="ml-1.5" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {context.patientId && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <CaseMetric icon={<Activity size={16} />} label="Визиты" value={caseVisits.length} />
          <CaseMetric icon={<CalendarDays size={16} />} label="Записи" value={caseAppointments.length} />
          <CaseMetric icon={<FlaskConical size={16} />} label="Лаб. заказы" value={caseLabs.length} hint={openLabs.length ? `${openLabs.length} в работе` : 'нет открытых'} />
          <CaseMetric icon={<CircleDollarSign size={16} />} label="К оплате" value={outstanding > 0 ? `${outstanding.toLocaleString('ru-RU')} ₸` : '0 ₸'} />
        </div>
      )}

      {context.patientId && (
        <Card>
          <CardHeader>
            <CardTitle>Текущий статус кейса</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <StatusItem icon={<Clock3 size={16} />} label="Следующая запись" value={nextAppointment ? `${nextAppointment.date}${nextAppointment.time ? ` · ${nextAppointment.time}` : ''}` : 'Не назначена'} />
            <StatusItem icon={<FlaskConical size={16} />} label="Лаборатория" value={openLabs[0]?.status ? `В работе: ${openLabs[0].status}` : 'Нет активного заказа'} />
            <StatusItem icon={<CreditCard size={16} />} label="Финансы" value={outstanding > 0 ? 'Есть задолженность / незакрытая оплата' : 'Нет открытой задолженности'} />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {FLOW.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => go(item.route)}
              className="group text-left rounded-2xl border border-bdr-subtle bg-surface-1 p-4 hover:border-dv-gold/30 hover:bg-surface-2 transition-all"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 border border-bdr-subtle text-dv-gold group-hover:border-dv-gold/30">
                  <Icon size={17} />
                </span>
                <ArrowRight size={14} className="text-txt-ghost group-hover:text-dv-gold transition-colors" />
              </div>
              <div className="mt-4 text-sm font-semibold text-txt-primary">{item.label}</div>
              <div className="mt-1 text-xs text-txt-muted">{item.description}</div>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Контекст, который переносится дальше</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <ContextValue label="Пациент" value={context.patientId || 'не выбран'} />
          <ContextValue label="Кейс" value={context.caseId || 'не указан'} />
          <ContextValue label="Филиал" value={context.branchId || 'текущий'} />
        </CardContent>
      </Card>
    </div>
  );
}

function CaseMetric({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card padding="md" className="border-bdr-subtle bg-surface-1">
      <div className="flex items-center gap-2 text-txt-muted">{icon}<span className="text-[11px] uppercase tracking-wider">{label}</span></div>
      <div className="mt-2 text-lg font-semibold text-txt-primary">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-txt-muted">{hint}</div>}
    </Card>
  );
}

function StatusItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-bdr-subtle bg-surface-2/60 px-3 py-3">
      <div className="flex items-center gap-2 text-[11px] text-txt-muted">{icon}{label}</div>
      <div className="mt-1.5 text-sm text-txt-secondary">{value}</div>
    </div>
  );
}

function ContextValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-bdr-subtle bg-surface-2/60 px-3 py-2.5">
      <div className="text-[11px] text-txt-muted">{label}</div>
      <div className="mt-1 text-xs text-txt-secondary truncate">{value}</div>
    </div>
  );
}
