import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, CheckCircle2, Clock3, FlaskConical, Plus, ShieldCheck, Sparkles, TestTube2, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/ds/Card';
import { EmptyState } from '@/components/ui/ds/EmptyState';
import { Badge } from '@/components/ui/ds/Badge';
import { Button } from '@/components/ui/ds/Button';
import { PageHeader } from '@/components/ui/ds/StatCard';
import { QueryError } from '@/components/ui/ds/QueryError';
import { useEcosystemUrlContext } from '@/hooks/useEcosystemUrlContext';
import { useAuth } from '@/store/auth.store';
import EcosystemRelationRail from '@/components/ecosystem/EcosystemRelationRail';
import { createMedicalLabAliquot, createMedicalLabOrder, createMedicalLabSpecimen, getMedicalLabOrder, listMedicalLabOrders, performMedicalLabQualityControl, saveMedicalLabInterpretation, saveMedicalLabResults, scanMedicalLabSpecimen, updateMedicalLabStatus, verifyMedicalLabOrder, type MedicalLabOrder, type MedicalLabStatus } from '@/utils/medicalLabApi';

const STAGES: Array<{ id: MedicalLabStatus; label: string }> = [
  { id: 'ordered', label: 'Направлено' }, { id: 'sample_collected', label: 'Материал взят' }, { id: 'received', label: 'Принято' }, { id: 'processing', label: 'Исследование' }, { id: 'result_ready', label: 'Результат' }, { id: 'verified', label: 'Проверено' },
];
const NEXT: Partial<Record<MedicalLabStatus, MedicalLabStatus>> = { ordered: 'sample_collected', sample_collected: 'received', received: 'processing' };
const EMPTY_ORDERS: MedicalLabOrder[] = [];
const statusLabel: Record<string, string> = { ordered: 'Направлено', sample_collected: 'Материал взят', received: 'Принято', processing: 'В работе', result_ready: 'Результат готов', verified: 'Проверено', cancelled: 'Отменено', draft: 'Черновик' };

export default function MedicalLabWorkspace() {
  const context = useEcosystemUrlContext();
  const { user } = useAuth();
  const isLaboratoryWorkspace = String(user?.organizationType || '').toUpperCase() === 'LABORATORY';
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [testName, setTestName] = useState('');
  const [specimenType, setSpecimenType] = useState('');
  const [interpretation, setInterpretation] = useState('');
  const [qualityNote, setQualityNote] = useState('');
  const [containerType, setContainerType] = useState('Вакуумная пробирка');
  const [specimenLocation, setSpecimenLocation] = useState('Приёмка');
  const [barcodeScan, setBarcodeScan] = useState('');
  const [scanNote, setScanNote] = useState('');
  const [resultDrafts, setResultDrafts] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const listQuery = useQuery({ queryKey: ['medical-lab-orders', context.patientId, context.caseId], queryFn: () => listMedicalLabOrders({ patientId: context.patientId || undefined, caseId: context.caseId || undefined }) });
  const detailQuery = useQuery({ queryKey: ['medical-lab-order', selectedId], queryFn: () => getMedicalLabOrder(selectedId!), enabled: !!selectedId });
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ['medical-lab-orders'] }); if (selectedId) queryClient.invalidateQueries({ queryKey: ['medical-lab-order', selectedId] }); };
  const statusMutation = useMutation({ mutationFn: ({ id, status }: { id: string; status: MedicalLabStatus }) => updateMedicalLabStatus(id, status), onSuccess: refresh });
  const verifyMutation = useMutation({ mutationFn: (id: string) => verifyMedicalLabOrder(id), onSuccess: refresh });
  const interpretationMutation = useMutation({ mutationFn: ({ id, text }: { id: string; text: string }) => saveMedicalLabInterpretation(id, text, 'human'), onSuccess: () => { setInterpretation(''); refresh(); } });
  const resultMutation = useMutation({
    mutationFn: ({ id, results }: { id: string; results: Array<{ id: string; result: string }> }) => saveMedicalLabResults(id, results),
    onSuccess: refresh,
  });
  const qualityMutation = useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: 'passed' | 'failed'; note?: string }) => performMedicalLabQualityControl(id, decision, note),
    onSuccess: () => { setQualityNote(''); refresh(); },
  });
  const specimenMutation = useMutation({
    mutationFn: ({ id, specimenType, containerType, location }: { id: string; specimenType?: string; containerType?: string; location?: string }) =>
      createMedicalLabSpecimen(id, { specimenType, containerType, location }),
    onSuccess: (specimen) => {
      setContainerType('Вакуумная пробирка');
      refresh();
      if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(specimen.accessionNumber).catch(() => undefined);
    },
  });
  const scanMutation = useMutation({
    mutationFn: ({ id, barcode, note }: { id: string; barcode: string; note?: string }) =>
      scanMedicalLabSpecimen(id, { barcode, action: 'received', location: specimenLocation, note }),
    onSuccess: () => { setBarcodeScan(''); setScanNote(''); refresh(); },
  });
  const aliquotMutation = useMutation({
    mutationFn: ({ id, specimenId }: { id: string; specimenId: string }) =>
      createMedicalLabAliquot(id, specimenId, { containerType: 'Пробирка аликвоты', location: specimenLocation }),
    onSuccess: refresh,
  });
  const createMutation = useMutation({ mutationFn: () => createMedicalLabOrder({ patientId: context.patientId || undefined, treatmentCaseId: context.caseId || undefined, specimenType: specimenType || undefined, tests: [{ name: testName.trim() }] }), onSuccess: (order) => { setSelectedId(order.id); setTestName(''); setSpecimenType(''); setCreating(false); refresh(); } });
  const orders = listQuery.data ?? EMPTY_ORDERS;
  const selected = detailQuery.data;
  const capabilities = selected?.capabilities || [];
  const hasCapability = (capability: string) => capabilities.includes(capability);
  const activeLabScope = selected?.isLaboratoryWorkspace ?? isLaboratoryWorkspace;
  const qualityControl = selected?.order?.metadata && typeof selected.order.metadata === 'object'
    ? (selected.order.metadata as Record<string, any>).qualityControl
    : null;
  useEffect(() => {
    if (!selected) return;
    setResultDrafts(Object.fromEntries(selected.tests.map((test) => [test.id, test.result ?? test.resultText ?? ''])));
    setInterpretation(selected.order.interpretation || '');
  }, [selected]);
  const counts = useMemo(() => orders.reduce<Record<string, number>>((acc, item) => { acc[item.status] = (acc[item.status] || 0) + 1; return acc; }, {}), [orders]);
  const currentNext = selected?.order.status
    ? (selected.order.accessionRequired && (selected.order.status === 'ordered' || selected.order.status === 'sample_collected')
      ? undefined
      : NEXT[selected.order.status])
    : undefined;
  const currentNextCapability = selected?.order.status === 'ordered' ? 'specimen.collect'
    : selected?.order.status === 'sample_collected' ? 'specimen.receive'
      : selected?.order.status === 'received' ? 'order.process' : null;
  const canAdvanceCurrentStage = Boolean(currentNext && currentNextCapability
    && (!activeLabScope || hasCapability(currentNextCapability)));
  if (listQuery.isError) return <QueryError error={listQuery.error as Error} onRetry={() => listQuery.refetch()} />;
  return (
    <div className="space-y-6">
      <PageHeader title="Медицинская лаборатория" subtitle="Направление → биоматериал → исследование → результат → верификация → клиническая интерпретация" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        {[['ordered', 'Направлено', Activity], ['sample_collected', 'Материал', TestTube2], ['processing', 'В работе', FlaskConical], ['result_ready', 'Результаты', Clock3], ['verified', 'Проверено', ShieldCheck], ['cancelled', 'Отменено', XCircle]].map(([id, label, Icon]) => (
          <Card key={id as string} className="border-bdr-subtle bg-surface-1 p-4"><div className="flex items-center justify-between"><Icon className="h-4 w-4 text-dv-gold" /><span className="text-xl font-semibold text-txt-primary">{counts[id as string] || 0}</span></div><div className="mt-2 text-xs text-txt-muted">{label as string}</div></Card>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="overflow-hidden border-bdr-subtle bg-surface-1">
          <div className="flex items-center justify-between border-b border-bdr-subtle px-5 py-4"><div><div className="text-sm font-semibold text-txt-primary">Поток исследований</div><div className="text-xs text-txt-muted">{orders.length} направлений в текущем контексте</div></div>{!isLaboratoryWorkspace && <Button onClick={() => setCreating((v) => !v)}><Plus className="mr-2 h-4 w-4" />Новое направление</Button>}</div>
          {creating && <div className="border-b border-bdr-subtle bg-surface-2 p-5"><div className="grid gap-3 md:grid-cols-2"><input value={testName} onChange={(e) => setTestName(e.target.value)} placeholder="Название анализа" className="rounded-xl border border-bdr-subtle bg-surface-1 px-3 py-2 text-sm text-txt-primary" /><input value={specimenType} onChange={(e) => setSpecimenType(e.target.value)} placeholder="Тип биоматериала" className="rounded-xl border border-bdr-subtle bg-surface-1 px-3 py-2 text-sm text-txt-primary" /></div><div className="mt-3 flex justify-end"><Button disabled={!testName.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}>Создать направление</Button></div></div>}
          <div className="divide-y divide-bdr-subtle">
            {orders.length === 0 && (
              <EmptyState
                icon={<TestTube2 size={22} />}
                title="Нет направлений"
                description="Создайте направление из текущего пациента или клинического кейса."
                action={!isLaboratoryWorkspace ? <Button size="sm" onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" />Создать направление</Button> : undefined}
                className="py-10"
              />
            )}
            {orders.map((order) => <button key={order.id} type="button" onClick={() => setSelectedId(order.id)} className={`w-full px-5 py-4 text-left transition hover:bg-surface-2 ${selectedId === order.id ? 'bg-surface-2' : ''}`}><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="truncate text-sm font-medium text-txt-primary">{order.specimenType || 'Биоматериал не указан'}</div><div className="mt-1 text-xs text-txt-muted">{order.patientId ? `Пациент ${order.patientId.slice(0, 8)}` : 'Без пациента'}{order.treatmentCaseId ? ` · Case ${order.treatmentCaseId.slice(0, 8)}` : ''}</div></div><Badge>{statusLabel[order.status] || order.status}</Badge></div><div className="mt-3 flex gap-1">{STAGES.map((stage) => <span key={stage.id} className={`h-1.5 flex-1 rounded-full ${STAGES.findIndex((s) => s.id === order.status) >= STAGES.findIndex((s) => s.id === stage.id) ? 'bg-dv-gold' : 'bg-surface-3'}`} />)}</div></button>)}
          </div>
        </Card>
        <div className="space-y-4">
          {selected ? <>
            <Card className="border-bdr-subtle bg-surface-1 p-5"><div className="flex items-start justify-between gap-3"><div><div className="text-xs text-txt-muted">Направление</div><div className="mt-1 font-semibold text-txt-primary">{selected.order.id}</div></div><Badge>{statusLabel[selected.order.status]}</Badge></div><div className="mt-5 grid grid-cols-2 gap-3 text-xs"><div><div className="text-txt-muted">Пациент</div><div className="mt-1 text-txt-primary">{selected.order.patientId || '—'}</div></div><div><div className="text-txt-muted">Case</div><div className="mt-1 text-txt-primary">{selected.order.treatmentCaseId || '—'}</div></div></div>{canAdvanceCurrentStage && currentNext && <Button className="mt-5 w-full" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ id: selected.order.id, status: currentNext })}>{statusLabel[currentNext]} <span className="ml-auto">→</span></Button>}{selected.order.status === 'result_ready' && qualityControl?.decision && <div className="mt-3 rounded-lg border border-bdr-subtle bg-surface-2 p-3 text-xs text-txt-secondary">QC: <strong>{qualityControl.decision === 'passed' ? 'Пройден' : 'Отклонён'}</strong>{qualityControl.note ? ` · ${qualityControl.note}` : ''}</div>}
              {selected.order.status === 'result_ready' && hasCapability('quality.perform') && !qualityControl?.performedAt && <div className="mt-3 space-y-2"><textarea value={qualityNote} onChange={(e) => setQualityNote(e.target.value)} placeholder="Комментарий QC (обязателен при отклонении)" className="min-h-16 w-full rounded-lg border border-bdr-subtle bg-surface-1 px-3 py-2 text-sm text-txt-primary" /><div className="grid grid-cols-2 gap-2"><Button className="w-full" disabled={qualityMutation.isPending} onClick={() => qualityMutation.mutate({ id: selected.order.id, decision: 'passed', note: qualityNote.trim() || undefined })}><ShieldCheck className="mr-2 h-4 w-4" />QC пройден</Button><Button className="w-full" variant="outline" disabled={qualityMutation.isPending || !qualityNote.trim()} onClick={() => qualityMutation.mutate({ id: selected.order.id, decision: 'failed', note: qualityNote.trim() })}><XCircle className="mr-2 h-4 w-4" />Отклонить QC</Button></div></div>}
              {selected.order.status === 'result_ready' && qualityControl?.decision === 'failed' && hasCapability('order.process') && <Button className="mt-2 w-full" variant="outline" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ id: selected.order.id, status: 'processing' })}>Вернуть на повторное исследование</Button>}
              {selected.order.status === 'result_ready' && qualityControl?.decision === 'passed' && hasCapability('result.verify') && <Button className="mt-2 w-full" variant="outline" disabled={verifyMutation.isPending} onClick={() => verifyMutation.mutate(selected.order.id)}><CheckCircle2 className="mr-2 h-4 w-4" />Независимо выпустить результат</Button>}
              </Card>

            {selected.order.accessionRequired && activeLabScope && (
              <Card className="border-bdr-subtle bg-surface-1 p-5 space-y-4">
                <div>
                  <div className="text-sm font-semibold text-txt-primary">Accession и прослеживаемость образцов</div>
                  <p className="mt-1 text-xs text-txt-muted">Каждая физическая пробирка получает собственный barcode. Приёмка фиксирует сотрудника, время и место.</p>
                </div>
                {hasCapability('specimen.collect') && (selected.order.status === 'ordered' || selected.order.status === 'sample_collected') && (
                  <div className="rounded-xl border border-bdr-subtle bg-surface-2 p-3 space-y-2">
                    <div className="text-xs font-medium text-txt-secondary">Регистрация новой пробирки</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input aria-label="Тип контейнера" value={containerType} onChange={(event) => setContainerType(event.target.value)} className="min-h-11 rounded-lg border border-bdr-subtle bg-surface-1 px-3 text-sm text-txt-primary" placeholder="Тип контейнера" />
                      <input aria-label="Место регистрации образца" value={specimenLocation} onChange={(event) => setSpecimenLocation(event.target.value)} className="min-h-11 rounded-lg border border-bdr-subtle bg-surface-1 px-3 text-sm text-txt-primary" placeholder="Место / стойка" />
                    </div>
                    <Button className="w-full" disabled={specimenMutation.isPending} onClick={() => specimenMutation.mutate({ id: selected.order.id, specimenType: selected.order.specimenType || undefined, containerType, location: specimenLocation })}>
                      {specimenMutation.isPending ? 'Регистрируем…' : 'Создать barcode пробирки'}
                    </Button>
                  </div>
                )}
                {hasCapability('specimen.receive') && selected.order.status === 'sample_collected' && (
                  <div className="rounded-xl border border-bdr-subtle p-3 space-y-2">
                    <div className="text-xs font-medium text-txt-secondary">Сканирование при приёмке</div>
                    <input aria-label="Barcode образца" value={barcodeScan} onChange={(event) => setBarcodeScan(event.target.value)} className="min-h-12 w-full rounded-lg border border-bdr-subtle bg-surface-1 px-3 text-sm font-mono text-txt-primary" placeholder="Сканируйте или введите DVL-…" />
                    <input aria-label="Комментарий при приёмке" value={scanNote} onChange={(event) => setScanNote(event.target.value)} className="min-h-11 w-full rounded-lg border border-bdr-subtle bg-surface-1 px-3 text-sm text-txt-primary" placeholder="Комментарий (необязательно)" />
                    <Button className="w-full" disabled={!barcodeScan.trim() || scanMutation.isPending} onClick={() => scanMutation.mutate({ id: selected.order.id, barcode: barcodeScan, note: scanNote || undefined })}>
                      {scanMutation.isPending ? 'Проверяем barcode…' : 'Подтвердить приёмку сканированием'}
                    </Button>
                  </div>
                )}
                {(selected.specimens || []).length === 0 ? (
                  <p className="text-xs text-txt-muted">Физические образцы ещё не зарегистрированы.</p>
                ) : (
                  <div className="space-y-2">
                    {(selected.specimens || []).map((specimen) => (
                      <div key={specimen.id} className="rounded-xl border border-bdr-subtle p-3 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <code className="font-mono text-sm font-semibold text-txt-primary">{specimen.accessionNumber}</code>
                          <Badge variant={specimen.status === 'received' || specimen.status === 'processing' || specimen.status === 'consumed' ? 'success' : specimen.status === 'rejected' ? 'error' : 'warning'}>{specimen.status}</Badge>
                        </div>
                        <div className="text-xs text-txt-muted">
                          {specimen.specimenType} · {specimen.containerType || 'Контейнер не указан'}{specimen.volume ? ' · ' + specimen.volume + ' ' + (specimen.volumeUnit || '') : ''}
                        </div>
                        {specimen.parentSpecimenId && <p className="text-xs text-txt-secondary">Аликвота родительского образца {specimen.parentSpecimenId.slice(0, 8)}</p>}
                        {hasCapability('specimen.collect') && (specimen.status === 'received' || specimen.status === 'processing') && (
                          <Button size="sm" variant="outline" disabled={aliquotMutation.isPending} onClick={() => aliquotMutation.mutate({ id: selected.order.id, specimenId: specimen.id })}>
                            Создать аликвоту
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {(selected.specimenEvents || []).length > 0 && (
                  <div className="border-t border-bdr-subtle pt-3">
                    <div className="mb-2 text-xs font-semibold text-txt-secondary">Цепочка движения образца</div>
                    <ol className="space-y-2">
                      {(selected.specimenEvents || []).map((event) => (
                        <li key={event.id} className="text-xs text-txt-secondary">
                          <span className="font-medium text-txt-primary">{event.eventType}</span>
                          {event.note ? ' · ' + event.note : ''}
                          {event.location ? ' · ' + event.location : ''}
                          <span className="ml-1 text-txt-muted">{new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Almaty' }).format(new Date(event.createdAt))}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </Card>
            )}
            <Card className="border-bdr-subtle bg-surface-1 p-5"><div className="mb-4 flex items-center justify-between gap-3"><div className="text-sm font-semibold text-txt-primary">Результаты</div>{selected.order.status === 'processing' && hasCapability('result.write') && <Badge>Ввод результата</Badge>}</div><div className="space-y-3">{selected.tests.map((test) => <div key={test.id} className="rounded-xl border border-bdr-subtle p-3"><div className="text-sm font-medium text-txt-primary">{test.name}</div><div className="mt-2 flex gap-2">{selected.order.status === 'processing' && hasCapability('result.write') ? <input value={resultDrafts[test.id] ?? ''} onChange={(e) => setResultDrafts((prev) => ({ ...prev, [test.id]: e.target.value }))} placeholder="Значение результата" className="min-w-0 flex-1 rounded-lg border border-bdr-subtle bg-surface-1 px-3 py-2 text-sm text-txt-primary" /> : <div className="min-w-0 flex-1 rounded-lg bg-surface-2 px-3 py-2 text-sm text-txt-primary">{test.result || test.resultText || 'Результат ещё не внесён'}</div>}<span className="flex items-center text-xs text-txt-muted">{test.unit || ''}</span></div>{test.referenceRange && <div className="mt-2 text-xs text-txt-muted">Референс: {test.referenceRange}</div>}</div>)}</div>{selected.order.status === 'processing' && hasCapability('result.write') && <Button className="mt-4 w-full" disabled={resultMutation.isPending || selected.tests.length === 0 || selected.tests.some((test) => !(resultDrafts[test.id] || '').trim())} onClick={() => resultMutation.mutate({ id: selected.order.id, results: selected.tests.map((test) => ({
                id: test.id,
                result: (resultDrafts[test.id] || '').trim(),
                unit: test.unit || undefined,
                referenceRange: test.referenceRange || undefined,
                flag: test.flag || undefined,
              })) })}>{resultMutation.isPending ? 'Сохраняем результаты…' : 'Сохранить полный набор результатов'}</Button>}</Card>
            {selected.order.status === 'verified' && hasCapability('result.interpret') && <Card className="border-bdr-subtle bg-surface-1 p-5"><div className="flex items-center gap-2 text-sm font-semibold text-txt-primary"><Sparkles className="h-4 w-4 text-dv-gold" />Клиническая интерпретация</div><textarea value={interpretation} onChange={(e) => setInterpretation(e.target.value)} placeholder="Клиническая интерпретация для врача..." className="mt-3 min-h-28 w-full resize-y rounded-xl border border-bdr-subtle bg-surface-1 px-3 py-2 text-sm text-txt-primary" /><Button className="mt-3 w-full" disabled={!interpretation.trim() || interpretationMutation.isPending} onClick={() => interpretationMutation.mutate({ id: selected.order.id, text: interpretation.trim() })}>Подписать интерпретацию</Button></Card>}
            {selected.events.length > 0 && <Card className="border-bdr-subtle bg-surface-1 p-5"><div className="mb-3 text-sm font-semibold text-txt-primary">История движения образца и решений</div><ol className="space-y-3">{selected.events.map((event) => <li key={event.id} className="flex gap-2 text-xs"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-dv-gold" /><div className="min-w-0"><p className="text-txt-primary">{event.note || statusLabel[event.toStatus] || event.toStatus}</p><p className="mt-0.5 text-txt-muted">{new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Almaty' }).format(new Date(event.createdAt))}</p></div></li>)}</ol></Card>}

            <EcosystemRelationRail node={{ type: 'medical-analysis', id: selected.order.id, label: 'Медицинский анализ' }} patientId={selected.order.patientId || undefined} caseId={selected.order.treatmentCaseId || undefined} />
          </> : <Card className="border-bdr-subtle bg-surface-1 p-8 text-sm text-txt-muted">Выберите направление, чтобы открыть полный lifecycle.</Card>}
        </div>
      </div>
    </div>
  );
}
