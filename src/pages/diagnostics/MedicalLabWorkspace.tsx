import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, CheckCircle2, Clock3, FlaskConical, Plus, ShieldCheck, Sparkles, TestTube2, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/ds/Card';
import { Badge } from '@/components/ui/ds/Badge';
import { Button } from '@/components/ui/ds/Button';
import { PageHeader } from '@/components/ui/ds/StatCard';
import { QueryError } from '@/components/ui/ds/QueryError';
import { useEcosystemUrlContext } from '@/hooks/useEcosystemUrlContext';
import EcosystemContextBridge from '@/components/ecosystem/EcosystemContextBridge';
import EcosystemRelationRail from '@/components/ecosystem/EcosystemRelationRail';
import { createMedicalLabOrder, getMedicalLabOrder, listMedicalLabOrders, saveMedicalLabInterpretation, saveMedicalLabResults, updateMedicalLabStatus, verifyMedicalLabOrder, type MedicalLabOrder, type MedicalLabStatus } from '@/utils/medicalLabApi';

const STAGES: Array<{ id: MedicalLabStatus; label: string }> = [
  { id: 'ordered', label: 'Направлено' },
  { id: 'sample_collected', label: 'Материал взят' },
  { id: 'received', label: 'Принято' },
  { id: 'processing', label: 'Исследование' },
  { id: 'result_ready', label: 'Результат' },
  { id: 'verified', label: 'Проверено' },
];

const NEXT: Partial<Record<MedicalLabStatus, MedicalLabStatus>> = {
  ordered: 'sample_collected', sample_collected: 'received', received: 'processing', processing: 'result_ready', result_ready: 'verified',
};

const statusLabel: Record<string, string> = { ordered: 'Направлено', sample_collected: 'Материал взят', received: 'Принято', processing: 'В работе', result_ready: 'Результат готов', verified: 'Проверено', cancelled: 'Отменено', draft: 'Черновик' };

export default function MedicalLabWorkspace() {
  const context = useEcosystemUrlContext();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [testName, setTestName] = useState('');
  const [specimenType, setSpecimenType] = useState('');
  const [interpretation, setInterpretation] = useState('');
  const [creating, setCreating] = useState(false);

  const listQuery = useQuery({ queryKey: ['medical-lab-orders', context.patientId, context.caseId], queryFn: () => listMedicalLabOrders({ patientId: context.patientId || undefined, caseId: context.caseId || undefined }) });
  const detailQuery = useQuery({ queryKey: ['medical-lab-order', selectedId], queryFn: () => getMedicalLabOrder(selectedId!), enabled: !!selectedId });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['medical-lab-orders'] });
    if (selectedId) queryClient.invalidateQueries({ queryKey: ['medical-lab-order', selectedId] });
  };
  const statusMutation = useMutation({ mutationFn: ({ id, status }: { id: string; status: MedicalLabStatus }) => updateMedicalLabStatus(id, status), onSuccess: refresh });
  const verifyMutation = useMutation({ mutationFn: (id: string) => verifyMedicalLabOrder(id), onSuccess: refresh });
  const interpretationMutation = useMutation({ mutationFn: ({ id, text }: { id: string; text: string }) => saveMedicalLabInterpretation(id, text, 'human'), onSuccess: () => { setInterpretation(''); refresh(); } });
  const resultMutation = useMutation({ mutationFn: ({ id, testId, result }: { id: string; testId: string; result: string }) => saveMedicalLabResults(id, [{ id: testId, result }]), onSuccess: refresh });
  const createMutation = useMutation({ mutationFn: () => createMedicalLabOrder({ patientId: context.patientId || undefined, treatmentCaseId: context.caseId || undefined, specimenType: specimenType || undefined, tests: [{ name: testName.trim() }] }), onSuccess: (order) => { setSelectedId(order.id); setTestName(''); setSpecimenType(''); setCreating(false); refresh(); } });

  const orders = listQuery.data || [];
  const selected = detailQuery.data;
  const counts = useMemo(() => orders.reduce<Record<string, number>>((acc, item) => { acc[item.status] = (acc[item.status] || 0) + 1; return acc; }, {}), [orders]);
  const currentNext = selected?.order.status ? NEXT[selected.order.status] : undefined;

  if (listQuery.isError) return <QueryError error={listQuery.error as Error} onRetry={() => listQuery.refetch()} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Медицинская лаборатория" subtitle="Направление → биоматериал → исследование → результат → верификация → клиническая интерпретация" />
      <EcosystemContextBridge />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        {[
          ['ordered', 'Направлено', Activity], ['sample_collected', 'Материал', TestTube2], ['processing', 'В работе', FlaskConical], ['result_ready', 'Результаты', Clock3], ['verified', 'Проверено', ShieldCheck], ['cancelled', 'Отменено', XCircle],
        ].map(([id, label, Icon]) => (
          <Card key={id as string} className="border-border/60 bg-surface/80 p-4">
            <div className="flex items-center justify-between"><Icon className="h-4 w-4 text-primary" /><span className="text-xl font-semibold text-foreground">{counts[id as string] || 0}</span></div>
            <div className="mt-2 text-xs text-muted-foreground">{label as string}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="overflow-hidden border-border/60 bg-surface/80">
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
            <div><div className="text-sm font-semibold text-foreground">Поток исследований</div><div className="text-xs text-muted-foreground">{orders.length} направлений в текущем контексте</div></div>
            <Button onClick={() => setCreating((v) => !v)}><Plus className="mr-2 h-4 w-4" />Новое направление</Button>
          </div>
          {creating && (
            <div className="border-b border-border/60 bg-muted/20 p-5">
              <div className="grid gap-3 md:grid-cols-2">
                <input value={testName} onChange={(e) => setTestName(e.target.value)} placeholder="Название анализа" className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
                <input value={specimenType} onChange={(e) => setSpecimenType(e.target.value)} placeholder="Тип биоматериала" className="rounded-xl border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div className="mt-3 flex justify-end"><Button disabled={!testName.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}>Создать направление</Button></div>
            </div>
          )}
          <div className="divide-y divide-border/50">
            {orders.length === 0 && <div className="p-10 text-center text-sm text-muted-foreground">Нет направлений. Создайте первое из текущего пациента или клинического кейса.</div>}
            {orders.map((order) => (
              <button key={order.id} onClick={() => setSelectedId(order.id)} className={`w-full px-5 py-4 text-left transition hover:bg-muted/30 ${selectedId === order.id ? 'bg-muted/40' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0"><div className="truncate text-sm font-medium text-foreground">{order.specimenType || 'Биоматериал не указан'}</div><div className="mt-1 text-xs text-muted-foreground">{order.patientId ? `Пациент ${order.patientId.slice(0, 8)}` : 'Без пациента'}{order.treatmentCaseId ? ` · Case ${order.treatmentCaseId.slice(0, 8)}` : ''}</div></div>
                  <Badge>{statusLabel[order.status] || order.status}</Badge>
                </div>
                <div className="mt-3 flex gap-1">{STAGES.map((stage) => <span key={stage.id} className={`h-1.5 flex-1 rounded-full ${STAGES.findIndex((s) => s.id === order.status) >= STAGES.findIndex((s) => s.id === stage.id) ? 'bg-primary' : 'bg-muted'}`} />)}</div>
              </button>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          {selected ? (
            <>
              <Card className="border-border/60 bg-surface/80 p-5">
                <div className="flex items-start justify-between gap-3"><div><div className="text-xs text-muted-foreground">Направление</div><div className="mt-1 font-semibold text-foreground">{selected.order.id}</div></div><Badge>{statusLabel[selected.order.status]}</Badge></div>
                <div className="mt-5 grid grid-cols-2 gap-3 text-xs"><div><div className="text-muted-foreground">Пациент</div><div className="mt-1 text-foreground">{selected.order.patientId || '—'}</div></div><div><div className="text-muted-foreground">Case</div><div className="mt-1 text-foreground">{selected.order.treatmentCaseId || '—'}</div></div></div>
                {currentNext && <Button className="mt-5 w-full" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ id: selected.order.id, status: currentNext })}>{statusLabel[currentNext]} <span className="ml-auto">→</span></Button>}
                {selected.order.status === 'result_ready' && <Button className="mt-2 w-full" variant="outline" disabled={verifyMutation.isPending} onClick={() => verifyMutation.mutate(selected.order.id)}><CheckCircle2 className="mr-2 h-4 w-4" />Верифицировать результат</Button>}
              </Card>
              <Card className="border-border/60 bg-surface/80 p-5"><div className="mb-4 text-sm font-semibold">Результаты</div><div className="space-y-3">{selected.tests.map((test) => <div key={test.id} className="rounded-xl border border-border/60 p-3"><div className="text-sm font-medium">{test.name}</div><div className="mt-2 flex gap-2"><input defaultValue={test.result || ''} placeholder="Значение" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" onBlur={(e) => { if (e.target.value !== (test.result || '')) resultMutation.mutate({ id: selected.order.id, testId: test.id, result: e.target.value }); }} /><span className="flex items-center text-xs text-muted-foreground">{test.unit || ''}</span></div>{test.referenceRange && <div className="mt-2 text-xs text-muted-foreground">Референс: {test.referenceRange}</div>}</div>)}</div></Card>
              <Card className="border-border/60 bg-surface/80 p-5"><div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" />Клиническая интерпретация</div><textarea value={interpretation} onChange={(e) => setInterpretation(e.target.value)} placeholder={selected.order.interpretation || 'Зафиксируйте интерпретацию результата для врача...'} className="mt-3 min-h-28 w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm" /><Button className="mt-3 w-full" disabled={!interpretation.trim() || interpretationMutation.isPending} onClick={() => interpretationMutation.mutate({ id: selected.order.id, text: interpretation.trim() })}>Сохранить интерпретацию</Button></Card>
              <EcosystemRelationRail node={{ type: 'medical-analysis', id: selected.order.id, label: 'Медицинский анализ' }} patientId={selected.order.patientId || undefined} caseId={selected.order.treatmentCaseId || undefined} />
            </>
          ) : <Card className="border-border/60 bg-surface/80 p-8 text-sm text-muted-foreground">Выберите направление, чтобы открыть полный lifecycle.</Card>}
        </div>
      </div>
    </div>
  );
}
