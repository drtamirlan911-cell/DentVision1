import { useState } from 'react';
import { BarChart3, Plus, Gauge, LayoutGrid, RefreshCw } from 'lucide-react';
import {
  Card, CardHeader, CardTitle, CardContent, Button, Badge, Modal, Input, Select,
  DataTable, EmptyState, Drawer, Skeleton,
} from '@/components/ui/ds';
import { useToast } from '@/components/ui/ds/Toast';
import type { Column } from '@/components/ui/ds/DataTable';
import type { DataMetric, DataDashboard, DashboardTile, MetricComputationType } from '@/utils/api';
import {
  useDataMetrics, useDataDashboards, useRegisterDataMetric, useCreateDataDashboard,
  useDataMetricValue,
} from '@/queries/dataIntelligence.query';

const COMPUTATION_OPTIONS: { value: MetricComputationType; label: string }[] = [
  { value: 'patient_count', label: 'Число пациентов' },
  { value: 'appointment_count', label: 'Число приёмов' },
  { value: 'revenue_month', label: 'Выручка за месяц' },
  { value: 'gmv_total', label: 'Оборот (GMV)' },
  { value: 'supplier_count', label: 'Число поставщиков' },
];

function fd(d: string | null | undefined) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('ru-RU'); } catch { return d; }
}

function MetricValueCell({ metricKey }: { metricKey: string }) {
  const { data, isLoading, refetch, isFetching } = useDataMetricValue(metricKey);
  return (
    <div className="flex items-center gap-1.5">
      {isLoading ? <Skeleton className="h-4 w-12" /> : (
        <span className="text-txt-primary">
          {data ? `${data.value}${data.unit ? ` ${data.unit}` : ''}` : '—'}
        </span>
      )}
      <button
        onClick={() => refetch()}
        disabled={isFetching}
        aria-label="Обновить значение"
        className="text-txt-ghost hover:text-txt-primary transition-colors disabled:opacity-40"
      >
        <RefreshCw size={11} className={isFetching ? 'animate-spin' : ''} />
      </button>
    </div>
  );
}

function RegisterMetricModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const registerMetric = useRegisterDataMetric();
  const [form, setForm] = useState<{ key: string; title: string; domain: string; type: MetricComputationType }>({
    key: '', title: '', domain: 'core', type: 'patient_count',
  });

  const submit = async () => {
    if (!form.key.trim() || !form.title.trim()) { toast.error('Укажите ключ и название'); return; }
    try {
      await registerMetric.mutateAsync({ key: form.key, title: form.title, domain: form.domain, definition: { type: form.type } });
      onClose();
      setForm({ key: '', title: '', domain: 'core', type: 'patient_count' });
      toast.success('Метрика зарегистрирована');
    } catch (e: any) {
      toast.error(e.message || 'Не удалось зарегистрировать метрику');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Новая метрика" size="sm">
      <div className="space-y-3">
        <Input label="Ключ" placeholder="active_patients" value={form.key} onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))} />
        <Input label="Название" placeholder="Активные пациенты" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        <Input label="Домен" placeholder="core" value={form.domain} onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))} />
        <Select
          label="Вычисление" options={COMPUTATION_OPTIONS}
          value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as MetricComputationType }))}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button loading={registerMetric.isPending} onClick={submit}>Зарегистрировать</Button>
        </div>
      </div>
    </Modal>
  );
}

function DashboardFormModal({ open, onClose, metrics }: { open: boolean; onClose: () => void; metrics: DataMetric[] }) {
  const toast = useToast();
  const createDashboard = useCreateDataDashboard();
  const [name, setName] = useState('');
  const [tiles, setTiles] = useState<DashboardTile[]>([]);
  const [pickerKey, setPickerKey] = useState('');

  const addTile = () => {
    const metric = metrics.find((m) => m.key === pickerKey);
    if (!metric) return;
    if (tiles.some((t) => t.metricKey === metric.key)) return;
    setTiles((t) => [...t, { metricKey: metric.key, label: metric.title }]);
  };

  const removeTile = (key: string) => setTiles((t) => t.filter((x) => x.metricKey !== key));

  const submit = async () => {
    if (!name.trim() || tiles.length === 0) { toast.error('Укажите название и хотя бы одну плитку'); return; }
    try {
      await createDashboard.mutateAsync({ name, layout: { tiles } });
      onClose();
      setName('');
      setTiles([]);
      toast.success('Дашборд создан');
    } catch (e: any) {
      toast.error(e.message || 'Не удалось создать дашборд');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Новый дашборд" size="md">
      <div className="space-y-4">
        <Input label="Название" placeholder="Обзор платформы" value={name} onChange={(e) => setName(e.target.value)} />
        <div>
          <p className="text-xs font-medium text-txt-secondary mb-1.5">Плитки метрик</p>
          <div className="flex gap-2 mb-2">
            <Select
              options={metrics.map((m) => ({ value: m.key, label: m.title }))}
              placeholder="Выберите метрику"
              value={pickerKey}
              onChange={(e) => setPickerKey(e.target.value)}
            />
            <Button size="sm" variant="secondary" onClick={addTile}>Добавить</Button>
          </div>
          {tiles.length === 0 ? (
            <p className="text-xs text-txt-muted">Плиток пока нет.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {tiles.map((t) => (
                <Badge key={t.metricKey} variant="outline" className="cursor-pointer" onClick={() => removeTile(t.metricKey)}>
                  {t.label} ×
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button loading={createDashboard.isPending} onClick={submit}>Создать</Button>
        </div>
      </div>
    </Modal>
  );
}

function DashboardDetail({ dashboard, onClose }: { dashboard: DataDashboard; onClose: () => void }) {
  return (
    <Drawer open onClose={onClose} title={dashboard.name} width={420}>
      <div className="grid grid-cols-2 gap-3">
        {(dashboard.layout?.tiles || []).map((tile) => (
          <div key={tile.metricKey} className="rounded-xl border border-bdr-subtle p-3">
            <p className="text-xs text-txt-muted mb-1">{tile.label}</p>
            <MetricValueCell metricKey={tile.metricKey} />
          </div>
        ))}
      </div>
    </Drawer>
  );
}

export default function DataIntelligenceTab() {
  const { data: metrics, isLoading: metricsLoading } = useDataMetrics();
  const { data: dashboards, isLoading: dashboardsLoading } = useDataDashboards();

  const [registerOpen, setRegisterOpen] = useState(false);
  const [dashboardFormOpen, setDashboardFormOpen] = useState(false);
  const [selectedDashboard, setSelectedDashboard] = useState<DataDashboard | null>(null);

  const metricColumns: Column<DataMetric>[] = [
    { key: 'title', header: 'Название' },
    { key: 'key', header: 'Ключ', render: (row) => <code className="text-2xs">{row.key}</code> },
    { key: 'domain', header: 'Домен', render: (row) => <Badge variant="outline" size="xs">{row.domain}</Badge> },
    { key: 'value', header: 'Значение', render: (row) => <MetricValueCell metricKey={row.key} /> },
    { key: 'createdAt', header: 'Создана', render: (row) => fd(row.createdAt) },
  ];

  const dashboardColumns: Column<DataDashboard>[] = [
    { key: 'name', header: 'Название' },
    { key: 'tiles', header: 'Плиток', render: (row) => row.layout?.tiles?.length ?? 0 },
    { key: 'createdAt', header: 'Создан', render: (row) => fd(row.createdAt) },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge size={16} className="text-dv-gold" />
            Реестр метрик
          </CardTitle>
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setRegisterOpen(true)}>
            Метрика
          </Button>
        </CardHeader>
        <CardContent>
          {metricsLoading ? (
            <div className="space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
          ) : !metrics?.length ? (
            <EmptyState
              icon={<Gauge size={24} />}
              title="Метрик пока нет"
              description="Зарегистрируйте метрику из известного набора вычислений — она станет доступна дашбордам и AI CFO."
              action={<Button size="sm" icon={<Plus size={14} />} onClick={() => setRegisterOpen(true)}>Метрика</Button>}
            />
          ) : (
            <DataTable columns={metricColumns} data={metrics} rowKey={(r) => r.key} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutGrid size={16} className="text-dv-gold" />
            Дашборды
          </CardTitle>
          <Button size="sm" icon={<Plus size={14} />} disabled={!metrics?.length} onClick={() => setDashboardFormOpen(true)}>
            Дашборд
          </Button>
        </CardHeader>
        <CardContent>
          {dashboardsLoading ? (
            <div className="space-y-2"><Skeleton className="h-10" /></div>
          ) : !dashboards?.length ? (
            <EmptyState
              icon={<BarChart3 size={24} />}
              title="Дашбордов пока нет"
              description={metrics?.length ? 'Соберите дашборд из плиток зарегистрированных метрик.' : 'Сначала зарегистрируйте хотя бы одну метрику.'}
              action={metrics?.length ? <Button size="sm" icon={<Plus size={14} />} onClick={() => setDashboardFormOpen(true)}>Дашборд</Button> : undefined}
            />
          ) : (
            <DataTable columns={dashboardColumns} data={dashboards} rowKey={(r) => r.id} onRowClick={(r) => setSelectedDashboard(r)} />
          )}
        </CardContent>
      </Card>

      <RegisterMetricModal open={registerOpen} onClose={() => setRegisterOpen(false)} />
      <DashboardFormModal open={dashboardFormOpen} onClose={() => setDashboardFormOpen(false)} metrics={metrics || []} />
      {selectedDashboard && <DashboardDetail dashboard={selectedDashboard} onClose={() => setSelectedDashboard(null)} />}
    </div>
  );
}
