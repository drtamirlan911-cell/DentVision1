import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, CheckCircle2, Clock3, FlaskConical, Plus, ShieldCheck, Sparkles, TestTube2, Wallet, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/ds/Card';
import { EmptyState } from '@/components/ui/ds/EmptyState';
import { Badge } from '@/components/ui/ds/Badge';
import { Button } from '@/components/ui/ds/Button';
import { PageHeader } from '@/components/ui/ds/StatCard';
import { QueryError } from '@/components/ui/ds/QueryError';
import { useEcosystemUrlContext } from '@/hooks/useEcosystemUrlContext';
import { useAuth } from '@/store/auth.store';
import EcosystemRelationRail from '@/components/ecosystem/EcosystemRelationRail';
import { PartnerBranchSubscriptionBilling } from '@/components/billing/PartnerBranchSubscriptionBilling';
import { WorkspaceRoleStart } from '@/components/workspaces/WorkspaceRoleStart';
import { resolveWorkspaceTab } from '@/lib/workspaceNavigation';
import { createMedicalLabAliquot, createMedicalLabOrder, createMedicalLabSpecimen, getMedicalLabCapabilities, getMedicalLabFinance, getMedicalLabOrder, listMedicalLabOrders, performMedicalLabQualityControl, requestMedicalLabPayout, saveMedicalLabInterpretation, saveMedicalLabResults, scanMedicalLabSpecimen, updateMedicalLabStatus, verifyMedicalLabOrder, type MedicalLabOrder, type MedicalLabStatus } from '@/utils/medicalLabApi';

const STAGES: Array<{ id: MedicalLabStatus; label: string }> = [
  { id: 'ordered', label: 'Направлено' }, { id: 'sample_collected', label: 'Материал взят' }, { id: 'received', label: 'Принято' }, { id: 'processing', label: 'Исследование' }, { id: 'result_ready', label: 'Результат' }, { id: 'verified', label: 'Проверено' },
];
const NEXT: Partial<Record<MedicalLabStatus, MedicalLabStatus>> = { ordered: 'sample_collected', sample_collected: 'received', received: 'processing' };
const EMPTY_ORDERS: MedicalLabOrder[] = [];

function formatMinor(value: string | number | bigint): string {
  let minor: bigint;
  try { minor = BigInt(String(value ?? '0')); } catch { minor = 0n; }
  const whole = (minor / 100n).toLocaleString('ru-RU');
  const fraction = String(minor % 100n).padStart(2, '0').replace(/0+$/, '');
  return `${whole}${fraction ? `,${fraction}` : ''} ₸`;
}

function parsePayoutAmountMinor(value: string): bigint | null {
  const match = /^(0|[1-9]\d*)(?:[.,](\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  return BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0'));
}
const statusLabel: Record<string, string> = { ordered: 'Направлено', sample_collected: 'Материал взят', received: 'Принято', processing: 'В работе', result_ready: 'Результат готов', verified: 'Проверено', cancelled: 'Отменено', draft: 'Черновик' };

export default function MedicalLabWorkspace() {
  const context = useEcosystemUrlContext();
  const { user, activeWorkspace } = useAuth();
  const activeScopeType = String(activeWorkspace?.scopeType || user?.organizationType || '').toUpperCase();
  const isLaboratoryWorkspace = activeScopeType === 'LABORATORY';
  const medicalLabRoleTokens = String(activeWorkspace?.roleKey || activeWorkspace?.role || user?.effectiveRole || user?.role || '')
    .toLowerCase().split(',').map((value) => value.trim()).filter(Boolean);
  const queryClient = useQueryClient();
  const billingOrganizationId = String(activeWorkspace?.organizationId || user?.organizationId || context.organizationId || '');
  const workspaceCacheScope = JSON.stringify([billingOrganizationId, String(activeWorkspace?.scopeId || ''), String(context.branchId || '')]);
  const capabilitiesQuery = useQuery({
    queryKey: ['medical-lab-capabilities', workspaceCacheScope],
    queryFn: getMedicalLabCapabilities,
    enabled: isLaboratoryWorkspace,
  });
  const medicalLabCapabilities = capabilitiesQuery.data?.capabilities ?? [];
  const canReadFinance = medicalLabCapabilities.includes('finance.read');
  const canManageFinance = medicalLabCapabilities.includes('finance.manage');
  const canReadOperations = medicalLabCapabilities.some((capability) =>
    ['specimen.collect', 'specimen.receive', 'order.process', 'order.cancel', 'result.write', 'result.verify', 'result.interpret', 'quality.perform'].includes(capability),
  );
  const financeQuery = useQuery({
    queryKey: ['medical-lab-finance', workspaceCacheScope],
    queryFn: getMedicalLabFinance,
    enabled: isLaboratoryWorkspace && canReadFinance,
  });
  const [payoutAmount, setPayoutAmount] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeSection, setActiveSection] = useState<'operations' | 'finance'>(() =>
    searchParams.get('tab') === 'finance' || (!canReadOperations && canReadFinance) ? 'finance' : 'operations',
  );
  const selectSection = (section: 'operations' | 'finance') => {
    setActiveSection(section);
    const next = new URLSearchParams(searchParams);
    if (section === 'finance') next.set('tab', 'finance');
    else next.delete('tab');
    setSearchParams(next, { replace: true });
  };
  useEffect(() => {
    const availableSections = [
      ...(canReadOperations ? ['operations'] : []),
      ...(canReadFinance ? ['finance'] : []),
    ];
    const fallbackSection = canReadOperations ? 'operations' : canReadFinance ? 'finance' : 'operations';
    const requestedSection = searchParams.get('tab') === 'finance' ? 'finance' : null;
    const nextSection = resolveWorkspaceTab(requestedSection, availableSections, fallbackSection) as 'operations' | 'finance';
    setActiveSection(nextSection);

    const expectedTab = nextSection === 'finance' ? 'finance' : null;
    if (searchParams.get('tab') !== expectedTab) {
      const nextParams = new URLSearchParams(searchParams);
      if (expectedTab) nextParams.set('tab', expectedTab);
      else nextParams.delete('tab');
      setSearchParams(nextParams, { replace: true });
    }
  }, [workspaceCacheScope, searchParams, canReadOperations, canReadFinance, setSearchParams]);
  const payoutAmountMinor = parsePayoutAmountMinor(payoutAmount);
  const payoutMutation = useMutation({
    mutationFn: () => requestMedicalLabPayout(payoutAmount.trim()),
    onSuccess: () => {
      setPayoutAmount('');
      queryClient.invalidateQueries({ queryKey: ['medical-lab-finance', workspaceCacheScope] });
    },
  });
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
  useEffect(() => {
    setSelectedId(null);
    setResultDrafts({});
    setInterpretation('');
    setQualityNote('');
    setBarcodeScan('');
    setScanNote('');
    setPayoutAmount('');
  }, [workspaceCacheScope]);
  const [creating, setCreating] = useState(false);
  const listQuery = useQuery({ queryKey: ['medical-lab-orders', workspaceCacheScope, context.patientId, context.caseId], queryFn: () => listMedicalLabOrders({ patientId: context.patientId || undefined, caseId: context.caseId || undefined }), enabled: isLaboratoryWorkspace && canReadOperations });
  const detailQuery = useQuery({ queryKey: ['medical-lab-order', workspaceCacheScope, selectedId], queryFn: () => getMedicalLabOrder(selectedId!), enabled: isLaboratoryWorkspace && canReadOperations && !!selectedId });
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ['medical-lab-orders', workspaceCacheScope] }); if (selectedId) queryClient.invalidateQueries({ queryKey: ['medical-lab-order', workspaceCacheScope, selectedId] }); };
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
  const availableBalanceMinor = financeQuery.data ? BigInt(financeQuery.data.availableBalanceMinor || '0') : 0n;
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
  const medicalRoleTokens = medicalLabRoleTokens;
  const isFinanceRole = medicalRoleTokens.some((value) => value.includes('finance') || value === 'accountant');
  const isReceptionRole = medicalRoleTokens.some((value) => value.includes('reception') || value.includes('operator'));
  const isQualityRole = medicalRoleTokens.some((value) => value.includes('validator') || value.includes('quality') || value.includes('doctor'));
  const isTechnicianRole = medicalRoleTokens.some((value) => value.includes('technician') || value.includes('lab_tech'));
  const roleGuide = isFinanceRole
    ? { role: 'Финансовый специалист', heading: 'Проверяйте счета и выплаты лаборатории', description: 'Работайте с финансовым разделом: проверяйте начисления, доступный баланс и заявки на выплату. Лабораторные операции остаются у профильных сотрудников.', steps: ['Откройте финансовый раздел', 'Проверьте счета и доступный баланс', 'Отправьте заявку на выплату и отслеживайте статус'] }
    : isReceptionRole
      ? { role: 'Регистратура', heading: 'Принимайте направления и регистрируйте биоматериал', description: 'Ваш рабочий маршрут начинается с входящих заказов и приёмки. Проверяйте данные направления, маркировку и передачу образца.', steps: ['Откройте поток направлений', 'Проверьте заказ и зарегистрируйте образец', 'Передайте материал на следующий этап'] }
      : isQualityRole
        ? { role: 'Верификатор / контроль качества', heading: 'Проверяйте результаты перед выпуском', description: 'Сначала найдите исследования, ожидающие проверки. Фиксируйте решение и замечания, не изменяя опубликованный результат без сохранения истории.', steps: ['Найдите результаты, ожидающие проверки', 'Проверьте данные и QC', 'Подтвердите выпуск или верните на доработку'] }
        : isTechnicianRole
          ? { role: 'Лаборант', heading: 'Выполняйте исследования и отслеживайте образцы', description: 'Ваш основной рабочий участок — текущие заказы и биоматериалы. Обновляйте только свой этап и фиксируйте сканирование при приёмке.', steps: ['Откройте поток исследований', 'Проверьте статус и маркировку образца', 'Выполните исследование и сохраните результат'] }
          : { role: 'Сотрудник медицинской лаборатории', heading: 'Продвигайте заказы по этапам лабораторного процесса', description: 'Поток показывает, какие исследования ожидают действия. Откройте заказ, выполните доступный этап и передайте его следующей ответственной роли.', steps: ['Проверьте очередь исследований', 'Откройте заказ и выполните свой этап', 'Передайте результат на проверку или выпуск'] };
  if (listQuery.isError) return <QueryError error={listQuery.error as Error} onRetry={() => listQuery.refetch()} />;
  return (
    <div className="space-y-6">
      <PageHeader title="Медицинская лаборатория" subtitle="Направление → биоматериал → исследование → результат → верификация → клиническая интерпретация" />
      {isLaboratoryWorkspace && (
        <WorkspaceRoleStart
          roleLabel={roleGuide.role}
          heading={roleGuide.heading}
          description={roleGuide.description}
          steps={roleGuide.steps}
          actionLabel={isFinanceRole && canReadFinance ? 'Открыть финансы' : 'Открыть мои операции'}
          onAction={() => selectSection(isFinanceRole && canReadFinance ? 'finance' : 'operations')}
        />
      )}
      {isLaboratoryWorkspace && (canReadOperations || canReadFinance) && (
        <div role="group" aria-label="Разделы медицинской лаборатории" className="flex flex-wrap gap-2 border-b border-bdr-subtle pb-3">
          {canReadOperations && (
            <Button id="medical-lab-operations-tab" aria-pressed={activeSection === 'operations'} variant={activeSection === 'operations' ? 'primary' : 'secondary'} size="sm" onClick={() => selectSection('operations')}>
              Операции и образцы
            </Button>
          )}
          {canReadFinance && (
            <Button id="medical-lab-finance-tab" aria-pressed={activeSection === 'finance'} variant={activeSection === 'finance' ? 'primary' : 'secondary'} size="sm" onClick={() => selectSection('finance')}>
              Финансы
            </Button>
          )}
        </div>
      )}
      {(!isLaboratoryWorkspace || (canReadOperations && activeSection === 'operations')) && (
        <section id="medical-lab-operations-panel" aria-labelledby="medical-lab-operations-tab" tabIndex={0} className="space-y-6">
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
                        {hasCapability('specimen.collect') && specimen.status === 'received' && (
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
        </section>
      )}

      {isLaboratoryWorkspace && canReadFinance && activeSection === 'finance' && (
        <section id="medical-lab-finance-panel" aria-labelledby="medical-lab-finance-tab" tabIndex={0} className="space-y-4">
          <PageHeader
            title="Финансы медицинской лаборатории"
            subtitle="Оборот по подтверждённым оплатам, комиссия DentVision и средства, фактически доступные к выплате."
            icon={<Wallet size={20} />}
          />
          {financeQuery.isError ? (
            <QueryError what="финансы медицинской лаборатории" onRetry={() => financeQuery.refetch()} />
          ) : financeQuery.isPending ? (
            <Card padding="lg"><div className="h-24 animate-pulse rounded-xl bg-surface-2" /></Card>
          ) : financeQuery.data ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
                <Card className="p-4">
                  <p className="text-xs text-txt-muted">Учётный баланс</p>
                  <p className="mt-2 text-xl font-semibold tabular-nums text-txt-primary">{formatMinor(financeQuery.data.wallet.balance)}</p>
                  <p className="mt-1 text-[11px] text-txt-muted">Включает расчётные записи</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-txt-muted">Доступно к выплате</p>
                  <p className="mt-2 text-xl font-semibold tabular-nums text-txt-primary">{formatMinor(financeQuery.data.availableBalanceMinor)}</p>
                  <p className="mt-1 text-[11px] text-txt-muted">После резервов и прямых сборов</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-txt-muted">Оплаченный оборот</p>
                  <p className="mt-2 text-xl font-semibold tabular-nums text-txt-primary">{formatMinor(financeQuery.data.economics.totals.grossMinor)}</p>
                  <p className="mt-1 text-[11px] text-txt-muted">{financeQuery.data.economics.totals.operations} операций</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-txt-muted">Комиссия DentVision</p>
                  <p className="mt-2 text-xl font-semibold tabular-nums text-txt-primary">{formatMinor(financeQuery.data.economics.totals.commissionMinor)}</p>
                  <p className="mt-1 text-[11px] text-txt-muted">По правилам медицинской лаборатории</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-txt-muted">Доля лаборатории</p>
                  <p className="mt-2 text-xl font-semibold tabular-nums text-txt-primary">{formatMinor(financeQuery.data.economics.totals.partnerPayoutMinor)}</p>
                  <p className="mt-1 text-[11px] text-txt-muted">До внешних удержаний</p>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                {canManageFinance && (
                  <Card className="space-y-3 p-5">
                    <div>
                      <h3 className="text-sm font-semibold text-txt-primary">Запрос выплаты</h3>
                      <p className="mt-1 text-xs text-txt-muted">Платформенные поступления доступны после подтверждения платежа. Прямые оплаты лаборатории не считаются средствами DentVision к выплате.</p>
                    </div>
                    <label className="block space-y-1 text-xs text-txt-secondary">
                      <span>Сумма, ₸</span>
                      <input
                        inputMode="decimal"
                        value={payoutAmount}
                        onChange={(event) => setPayoutAmount(event.target.value)}
                        placeholder="Например, 25000.00"
                        className="min-h-11 w-full rounded-lg border border-bdr-subtle bg-surface-1 px-3 text-sm text-txt-primary"
                      />
                    </label>
                    {payoutMutation.isError && (
                      <p role="alert" className="text-xs text-error">{payoutMutation.error instanceof Error ? payoutMutation.error.message : 'Не удалось создать запрос выплаты'}</p>
                    )}
                    <Button
                      className="w-full"
                      disabled={!payoutAmountMinor || payoutAmountMinor <= 0n || payoutAmountMinor > availableBalanceMinor || payoutMutation.isPending}
                      loading={payoutMutation.isPending}
                      onClick={() => payoutMutation.mutate()}
                    >
                      Запросить выплату
                    </Button>
                    <p className="text-[11px] text-txt-muted">Заявленная сумма резервируется до решения финансовой службы.</p>
                  </Card>
                )}

                <Card className="space-y-3 p-5">
                  <h3 className="text-sm font-semibold text-txt-primary">История выплат</h3>
                  <div className="divide-y divide-bdr-subtle">
                    {financeQuery.data.payouts.map((payout) => (
                      <div key={payout.id} className="flex items-center justify-between gap-3 py-3">
                        <div>
                          <p className="text-sm font-medium text-txt-primary">{formatMinor(payout.amount)}</p>
                          <p className="text-xs text-txt-muted">{new Date(payout.createdAt).toLocaleString('ru-RU')}</p>
                        </div>
                        <Badge variant={payout.status === 'paid' ? 'success' : payout.status === 'rejected' ? 'error' : 'outline'}>
                          {({ requested: 'Заявлена', approved: 'Одобрена', paid: 'Выплачена', rejected: 'Отклонена' } as Record<string, string>)[payout.status]}
                        </Badge>
                      </div>
                    ))}
                    {financeQuery.data.payouts.length === 0 && <p className="py-5 text-center text-xs text-txt-muted">Запросов на выплату пока нет.</p>}
                  </div>
                </Card>
              </div>

              <Card className="space-y-3 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-txt-primary">Расчёты по анализам</h3>
                  <Badge variant="outline">{financeQuery.data.economics.totals.operations} операций</Badge>
                </div>
                {financeQuery.data.economics.rows.length ? (
                  <div className="divide-y divide-bdr-subtle">
                    {financeQuery.data.economics.rows.slice(0, 12).map((row) => (
                      <div key={row.transactionId} className="grid grid-cols-2 gap-2 py-3 text-xs sm:grid-cols-4">
                        <div><p className="text-txt-muted">Заказ</p><p className="mt-1 truncate font-medium text-txt-primary">{row.operationId.slice(0, 12)}</p></div>
                        <div><p className="text-txt-muted">Оплачено</p><p className="mt-1 font-medium text-txt-primary">{formatMinor(row.grossMinor)}</p></div>
                        <div><p className="text-txt-muted">Комиссия</p><p className="mt-1 font-medium text-txt-primary">{formatMinor(row.commissionMinor)}</p></div>
                        <div><p className="text-txt-muted">Доля лаборатории</p><p className="mt-1 font-medium text-txt-primary">{formatMinor(row.partnerPayoutMinor)}</p></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-5 text-center text-xs text-txt-muted">Подтверждённых оплат пока нет.</p>
                )}
                {financeQuery.data.economics.discrepancies > 0 && (
                  <p className="text-xs text-error">Обнаружены расхождения в финансовых записях: {financeQuery.data.economics.discrepancies}.</p>
                )}
              </Card>
            </div>
          ) : null}
          {billingOrganizationId && (
            <PartnerBranchSubscriptionBilling
              organizationId={billingOrganizationId}
              canReadBilling={canReadFinance}
              canManageBilling={canManageFinance}
            />
          )}
        </section>
      )}
    </div>
  );
}
