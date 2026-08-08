import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  StatCard, PageHeader, GlassCard, Card, CardContent, Button, Badge, Modal,
  Input, Select, EmptyState, Skeleton,
} from '../../components/ui/ds';
import { useToast } from '../../components/ui/ds/Toast';
import { apiRequest } from '../../utils/api';
import {
  Brain, Activity, CheckCircle, AlertTriangle, Search, RefreshCw,
  Shield, Zap, Eye, Send, FileText, Bot,
} from 'lucide-react';

const fd = (d: string) => new Date(d).toLocaleDateString('ru-RU');

type SubTab = 'overview' | 'logs' | 'compliance' | 'suggestions';

const SUB_TABS: { id: SubTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Обзор', icon: <Activity size={14} /> },
  { id: 'logs', label: 'Журнал действий', icon: <FileText size={14} /> },
  { id: 'compliance', label: 'Проверка соответствия', icon: <Shield size={14} /> },
  { id: 'suggestions', label: 'AI-рекомендации', icon: <Bot size={14} /> },
];

const ACTION_STATUS_BADGE: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  confirmed: 'success',
  pending: 'warning',
  rejected: 'error',
  completed: 'success',
  running: 'info',
};

const ACTION_STATUS_LABEL: Record<string, string> = {
  confirmed: 'Подтверждено',
  pending: 'Ожидает',
  rejected: 'Отклонено',
  completed: 'Завершено',
  running: 'Выполняется',
};

const REVIEW_TYPE_OPTIONS = [
  { value: 'product', label: 'Продукт' },
  { value: 'course', label: 'Курс' },
  { value: 'supplier', label: 'Поставщик' },
];

const VERDICT_STYLES: Record<string, string> = {
  pass: 'border-success/30 bg-success/5',
  fail: 'border-error/30 bg-error/5',
  warning: 'border-warning/30 bg-warning/5',
};

const SEVERITY_BADGE: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  high: 'error',
  medium: 'warning',
  low: 'info',
  critical: 'error',
  info: 'info',
};

const SEVERITY_LABEL: Record<string, string> = {
  high: 'Высокая',
  medium: 'Средняя',
  low: 'Низкая',
  critical: 'Критическая',
  info: 'Информация',
};

export default function AIGovernanceTab() {
  const toast = useToast();
  const qc = useQueryClient();

  const [subTab, setSubTab] = useState<SubTab>('overview');
  const [logSearch, setLogSearch] = useState('');
  const [reviewType, setReviewType] = useState('product');
  const [reviewId, setReviewId] = useState('');
  const [reviewResult, setReviewResult] = useState<any>(null);
  const [selectedAction, setSelectedAction] = useState<any>(null);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');

  const aiActions = useQuery({
    queryKey: ['ai-governance', 'actions'],
    queryFn: () => apiRequest('/api/compliance/ai'),
    staleTime: 30_000,
  });

  const stats = useQuery({
    queryKey: ['ai-governance', 'stats'],
    queryFn: () => apiRequest('/api/compliance/ai/stats'),
    staleTime: 30_000,
  });

  const suppliers = useQuery({
    queryKey: ['ai-governance', 'suppliers'],
    queryFn: () => apiRequest('/api/shop/suppliers'),
    staleTime: 60_000,
  });

  const confirmAction = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/compliance/ai/${id}/confirm`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-governance'] });
      toast.success('Действие подтверждено');
      setSelectedAction(null);
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка подтверждения'),
  });

  const runReview = useMutation({
    mutationFn: (body: { type: string; id: string }) =>
      apiRequest('/api/ai-governance/review', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (data: any) => {
      setReviewResult(data);
      toast.success('Проверка завершена');
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка проверки'),
  });

  const fetchSuggestions = useMutation({
    mutationFn: (supplierId: string) => apiRequest(`/api/ai-governance/supplier/${supplierId}/suggest`),
    onError: (e: any) => toast.error(e.message || 'Ошибка загрузки рекомендаций'),
  });

  const actionList: any[] = Array.isArray(aiActions.data) ? aiActions.data : (aiActions.data?.data || []);
  const sData: any = stats.data || {};
  const supplierList: any[] = Array.isArray(suppliers.data) ? suppliers.data : (suppliers.data?.data || []);

  const filteredActions = actionList.filter((a: any) => {
    if (!logSearch) return true;
    const q = logSearch.toLowerCase();
    return (
      String(a.model || '').toLowerCase().includes(q) ||
      String(a.action || '').toLowerCase().includes(q) ||
      String(a.status || '').toLowerCase().includes(q) ||
      String(a.description || '').toLowerCase().includes(q)
    );
  });

  const totalActions = sData.total ?? actionList.length;
  const confirmedCount = sData.confirmed ?? actionList.filter((a: any) => a.status === 'confirmed').length;
  const pendingCount = sData.pending ?? actionList.filter((a: any) => a.status === 'pending').length;
  const estimatedCost = sData.costEstimate ?? actionList.reduce((sum: number, a: any) => sum + (Number(a.costEstimate) || 0), 0);

  const filteredSuppliers = supplierList.filter((s: any) => {
    if (!supplierSearch) return true;
    const q = supplierSearch.toLowerCase();
    return (
      String(s.name || '').toLowerCase().includes(q) ||
      String(s.city || '').toLowerCase().includes(q)
    );
  });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ['ai-governance'] });
  };

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      <PageHeader
        title="AI Governance"
        subtitle="Мониторинг и управление AI-действиями платформы"
        icon={<Brain size={20} />}
        actions={
          <Button icon={<RefreshCw size={16} />} variant="ghost" onClick={refreshAll} className="min-h-11">Обновить</Button>
        }
      />

      <div className="flex gap-1 bg-surface-2 rounded-lg p-1 overflow-x-auto">
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 min-h-11 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${subTab === t.id ? 'bg-surface-1 text-txt-primary shadow-sm' : 'text-txt-muted hover:text-txt-secondary'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {subTab === 'overview' && (
        <div className="space-y-6">
          {stats.isLoading || aiActions.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Всего AI-действий" value={totalActions} icon={<Brain size={18} />} />
              <StatCard label="Подтверждено" value={confirmedCount} icon={<CheckCircle size={18} />} />
              <StatCard label="Ожидают" value={pendingCount} icon={<AlertTriangle size={18} />} />
              <StatCard label="Оценка стоимости" value={`${estimatedCost.toLocaleString('ru-RU')} ₸`} icon={<Zap size={18} />} />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <GlassCard padding="md">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10 text-success"><CheckCircle size={18} /></div>
                <div>
                  <p className="text-lg font-bold text-txt-primary">{confirmedCount}</p>
                  <p className="text-xs text-txt-muted">Подтверждённых действий</p>
                </div>
              </div>
            </GlassCard>
            <GlassCard padding="md">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10 text-warning"><AlertTriangle size={18} /></div>
                <div>
                  <p className="text-lg font-bold text-txt-primary">{pendingCount}</p>
                  <p className="text-xs text-txt-muted">Ожидают подтверждения</p>
                </div>
              </div>
            </GlassCard>
            <GlassCard padding="md">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-dv-gold/10 text-dv-gold"><Shield size={18} /></div>
                <div>
                  <p className="text-lg font-bold text-txt-primary">{actionList.length}</p>
                  <p className="text-xs text-txt-muted">Всего записей в журнале</p>
                </div>
              </div>
            </GlassCard>
          </div>

          {filteredActions.length > 0 && (
            <Card padding="none">
              <div className="px-4 py-3 border-b border-bdr-subtle">
                <h3 className="text-sm font-semibold text-txt-primary">Последние AI-действия</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-bdr-subtle">
                      {['Действие', 'Модель', 'Статус', 'Дата'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-txt-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredActions.slice(0, 5).map((a: any) => (
                      <tr key={a.id} className="border-b border-bdr-subtle/50 hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 text-sm text-txt-primary">{a.action || a.description || '—'}</td>
                        <td className="px-4 py-3">
                          <Badge variant="info" size="sm">{a.model || '—'}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={ACTION_STATUS_BADGE[a.status] || 'default'} size="sm" dot>
                            {ACTION_STATUS_LABEL[a.status] || a.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-txt-muted">{fd(a.createdAt || a.timestamp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {subTab === 'logs' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 justify-end">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-txt-muted" />
              <input value={logSearch} onChange={e => setLogSearch(e.target.value)} placeholder="Поиск по журналу..."
                className="pl-8 pr-3 py-1.5 min-h-11 rounded-lg bg-surface-2 border border-bdr-subtle text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-1 focus:ring-dv-gold/50 w-full sm:w-64" />
            </div>
          </div>

          {aiActions.isLoading ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : filteredActions.length === 0 ? (
            <EmptyState icon={<FileText size={40} />} title="Нет AI-действий" description="Журнал действий пуст" />
          ) : (
            <Card padding="none">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-bdr-subtle">
                      {['Действие', 'Описание', 'Модель', 'Токены', 'Стоимость', 'Статус', 'Дата', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-txt-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredActions.map((a: any) => (
                      <tr key={a.id} className="border-b border-bdr-subtle/50 hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <div className="text-sm font-semibold text-txt-primary">{a.action || '—'}</div>
                          {a.entityType && (
                            <div className="text-xs text-txt-muted mt-0.5">{a.entityType}{a.entityId ? ` · ${a.entityId}` : ''}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-txt-secondary max-w-[200px] truncate">{a.description || '—'}</td>
                        <td className="px-4 py-3">
                          <Badge variant="info" size="sm">{a.model || '—'}</Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-txt-muted">
                          {a.tokens != null ? Number(a.tokens).toLocaleString('ru-RU') : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-txt-muted">
                          {a.costEstimate != null ? `${Number(a.costEstimate).toLocaleString('ru-RU')} ₸` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={ACTION_STATUS_BADGE[a.status] || 'default'} size="sm" dot>
                            {ACTION_STATUS_LABEL[a.status] || a.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-txt-muted">{fd(a.createdAt || a.timestamp)}</td>
                        <td className="px-4 py-3">
                          <Button size="icon-sm" variant="ghost" onClick={() => setSelectedAction(a)} title="Подробнее">
                            <Eye size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {subTab === 'compliance' && (
        <div className="space-y-4">
          <Card padding="md">
            <h3 className="text-sm font-semibold text-txt-primary mb-4 flex items-center gap-2">
              <Shield size={16} className="text-dv-gold" />
              AI-проверка соответствия
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select label="Тип объекта" className="min-h-11" value={reviewType} onChange={e => { setReviewType(e.target.value); setReviewResult(null); }} options={REVIEW_TYPE_OPTIONS} />
              <Input label="ID объекта" className="min-h-11" value={reviewId} onChange={e => { setReviewId(e.target.value); setReviewResult(null); }} placeholder="Введите UUID или ID" />
              <div className="flex items-end">
                <Button icon={<Search size={16} />} className="min-h-11" onClick={() => {
                  if (!reviewId.trim()) { toast.warn('Введите ID объекта'); return; }
                  runReview.mutate({ type: reviewType, id: reviewId.trim() });
                }} loading={runReview.isPending} disabled={!reviewId.trim()}>
                  Запустить проверку
                </Button>
              </div>
            </div>
          </Card>

          {runReview.isPending && (
            <div className="space-y-4">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-48 rounded-xl" />
            </div>
          )}

          {reviewResult && !runReview.isPending && (
            <div className="space-y-4">
              <Card padding="md" className={`border ${VERDICT_STYLES[reviewResult.verdict] || 'border-bdr-subtle'}`}>
                <div className="flex items-center gap-3 mb-4">
                  {reviewResult.verdict === 'pass' && <CheckCircle size={24} className="text-success" />}
                  {reviewResult.verdict === 'fail' && <AlertTriangle size={24} className="text-error" />}
                  {reviewResult.verdict === 'warning' && <AlertTriangle size={24} className="text-warning" />}
                  {(!reviewResult.verdict || !['pass', 'fail', 'warning'].includes(reviewResult.verdict)) && <Shield size={24} className="text-dv-gold" />}
                  <div>
                    <p className="text-sm font-semibold text-txt-primary">Вердикт</p>
                    <Badge
                      variant={reviewResult.verdict === 'pass' ? 'success' : reviewResult.verdict === 'fail' ? 'error' : reviewResult.verdict === 'warning' ? 'warning' : 'default'}
                      size="md" dot
                    >
                      {reviewResult.verdict === 'pass' ? 'Соответствует' : reviewResult.verdict === 'fail' ? 'Не соответствует' : reviewResult.verdict === 'warning' ? 'Есть замечания' : reviewResult.verdict || 'Неизвестно'}
                    </Badge>
                  </div>
                </div>
                {reviewResult.summary && (
                  <p className="text-sm text-txt-secondary">{reviewResult.summary}</p>
                )}
              </Card>

              {Array.isArray(reviewResult.findings) && reviewResult.findings.length > 0 && (
                <Card padding="md">
                  <h4 className="text-sm font-semibold text-txt-primary mb-3 flex items-center gap-2">
                    <AlertTriangle size={14} className="text-warning" />
                    Найдены замечания ({reviewResult.findings.length})
                  </h4>
                  <div className="space-y-2">
                    {reviewResult.findings.map((f: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-surface-2 border border-bdr-subtle">
                        <Badge variant={SEVERITY_BADGE[f.severity] || 'default'} size="xs">
                          {SEVERITY_LABEL[f.severity] || f.severity || '—'}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-txt-primary">{f.message || f.text || f}</p>
                          {f.field && <p className="text-xs text-txt-muted mt-0.5">Поле: {f.field}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {Array.isArray(reviewResult.recommendations) && reviewResult.recommendations.length > 0 && (
                <Card padding="md">
                  <h4 className="text-sm font-semibold text-txt-primary mb-3 flex items-center gap-2">
                    <Zap size={14} className="text-info" />
                    Рекомендации ({reviewResult.recommendations.length})
                  </h4>
                  <div className="space-y-2">
                    {reviewResult.recommendations.map((r: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-bdr-subtle/50">
                        <div className="mt-0.5 h-5 w-5 rounded-full bg-info/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-info">{idx + 1}</span>
                        </div>
                        <p className="text-sm text-txt-secondary">{typeof r === 'string' ? r : r.message || r.text || JSON.stringify(r)}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {(!reviewResult.findings || reviewResult.findings.length === 0) && (!reviewResult.recommendations || reviewResult.recommendations.length === 0) && (
                <EmptyState icon={<CheckCircle size={40} />} title="Проверка пройдена" description="Замечания и рекомендации не найдены" />
              )}
            </div>
          )}
        </div>
      )}

      {subTab === 'suggestions' && (
        <div className="space-y-4">
          <Card padding="md">
            <h3 className="text-sm font-semibold text-txt-primary mb-4 flex items-center gap-2">
              <Bot size={16} className="text-dv-gold" />
              AI-рекомендации для поставщиков
            </h3>
            <div className="flex flex-wrap gap-2 justify-end">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-txt-muted" />
                <input value={supplierSearch} onChange={e => { setSupplierSearch(e.target.value); setSupplierSearch(e.target.value); }} placeholder="Найти поставщика..."
                  className="pl-8 pr-3 py-1.5 min-h-11 rounded-lg bg-surface-2 border border-bdr-subtle text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-1 focus:ring-dv-gold/50 w-full sm:w-64" />
              </div>
            </div>
          </Card>

          {suppliers.isLoading ? (
            <Skeleton className="h-48 rounded-xl" />
          ) : filteredSuppliers.length === 0 ? (
            <EmptyState icon={<Bot size={40} />} title="Нет поставщиков" description="Поставщики не найдены" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredSuppliers.map((s: any) => (
                <Card key={s.id} padding="md">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-dv-gold/10 text-dv-gold shrink-0"><Bot size={16} /></div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-txt-primary truncate">{s.name}</p>
                        <p className="text-xs text-txt-muted">{s.city || '—'}</p>
                      </div>
                    </div>
                    <Badge variant={s.status === 'OFFICIAL_PARTNER' ? 'success' : s.status === 'VERIFIED' ? 'info' : 'default'} size="sm">
                      {s.status === 'OFFICIAL_PARTNER' ? 'Партнёр' : s.status === 'VERIFIED' ? 'Верифицирован' : s.status || '—'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-1 text-xs text-txt-muted">
                      <span className="text-dv-gold font-semibold">{s.rating != null ? Number(s.rating).toFixed(1) : '—'}</span>
                      <span>/ 5.0</span>
                    </div>
                    <span className="text-xs text-txt-muted">·</span>
                    <span className="text-xs text-txt-muted">{s.productCount ?? 0} товаров</span>
                  </div>
                  {fetchSuggestions.data && fetchSuggestions.variables === s.id ? (
                    <div className="space-y-2">
                      {Array.isArray((fetchSuggestions.data as any)?.suggestions) ? (fetchSuggestions.data as any).suggestions.map((sg: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-success/5 border border-success/20">
                          <CheckCircle size={14} className="text-success mt-0.5 shrink-0" />
                          <p className="text-xs text-txt-secondary">{typeof sg === 'string' ? sg : sg.message || sg.text || ''}</p>
                        </div>
                      )) : Array.isArray(fetchSuggestions.data) ? (fetchSuggestions.data as any[]).map((sg: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-success/5 border border-success/20">
                          <CheckCircle size={14} className="text-success mt-0.5 shrink-0" />
                          <p className="text-xs text-txt-secondary">{typeof sg === 'string' ? sg : sg.message || sg.text || ''}</p>
                        </div>
                      )) : (
                        <p className="text-sm text-txt-secondary">{JSON.stringify(fetchSuggestions.data)}</p>
                      )}
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" icon={<Zap size={14} />} onClick={() => fetchSuggestions.mutate(s.id)} loading={fetchSuggestions.isPending && fetchSuggestions.variables === s.id}>
                      Получить рекомендации
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal open={!!selectedAction} onClose={() => setSelectedAction(null)} title="Детали AI-действия" size="lg">
        {selectedAction && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-txt-muted mb-1">Действие</p>
                <p className="text-sm font-medium text-txt-primary">{selectedAction.action || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-txt-muted mb-1">Статус</p>
                <Badge variant={ACTION_STATUS_BADGE[selectedAction.status] || 'default'} size="md" dot>
                  {ACTION_STATUS_LABEL[selectedAction.status] || selectedAction.status}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-txt-muted mb-1">Модель</p>
                <Badge variant="info" size="sm">{selectedAction.model || '—'}</Badge>
              </div>
              <div>
                <p className="text-xs text-txt-muted mb-1">Токены</p>
                <p className="text-sm text-txt-secondary">{selectedAction.tokens != null ? Number(selectedAction.tokens).toLocaleString('ru-RU') : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-txt-muted mb-1">Стоимость</p>
                <p className="text-sm text-txt-secondary">{selectedAction.costEstimate != null ? `${Number(selectedAction.costEstimate).toLocaleString('ru-RU')} ₸` : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-txt-muted mb-1">Дата</p>
                <p className="text-sm text-txt-secondary">{fd(selectedAction.createdAt || selectedAction.timestamp)}</p>
              </div>
            </div>
            {selectedAction.description && (
              <div>
                <p className="text-xs text-txt-muted mb-1">Описание</p>
                <p className="text-sm text-txt-secondary">{selectedAction.description}</p>
              </div>
            )}
            {selectedAction.entityType && (
              <div>
                <p className="text-xs text-txt-muted mb-1">Объект</p>
                <p className="text-sm text-txt-secondary">{selectedAction.entityType}{selectedAction.entityId ? ` · ${selectedAction.entityId}` : ''}</p>
              </div>
            )}
            {selectedAction.status === 'pending' && (
              <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-bdr-subtle">
                <Button icon={<CheckCircle size={16} />} className="min-h-11" onClick={() => confirmAction.mutate(selectedAction.id)} loading={confirmAction.isPending}>
                  Подтвердить действие
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
