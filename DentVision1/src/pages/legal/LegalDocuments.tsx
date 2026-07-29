import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card, Button, Badge, Modal, Input, Select, EmptyState, Skeleton,
} from '../../components/ui/ds';
import { useToast } from '../../components/ui/ds/Toast';
import { apiRequest } from '../../utils/api';
import {
  FileText, Plus, Search, ChevronDown, ChevronRight, Eye, History, FileInput,
} from 'lucide-react';

const STATUS_OPTIONS = [
  { value: '', label: 'Все статусы' },
  { value: 'DRAFT', label: 'Черновик' },
  { value: 'REVIEW', label: 'На проверке' },
  { value: 'APPROVED', label: 'Утверждён' },
  { value: 'PUBLISHED', label: 'Опубликован' },
  { value: 'ARCHIVED', label: 'Архивный' },
  { value: 'EXPIRED', label: 'Истёк' },
  { value: 'CANCELLED', label: 'Отменён' },
];

const STATUS_BADGE: Record<string, 'success' | 'warning' | 'error' | 'info' | 'gold' | 'default'> = {
  DRAFT: 'default',
  REVIEW: 'warning',
  APPROVED: 'info',
  PUBLISHED: 'success',
  ARCHIVED: 'default',
  EXPIRED: 'error',
  CANCELLED: 'error',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Черновик',
  REVIEW: 'На проверке',
  APPROVED: 'Утверждён',
  PUBLISHED: 'Опубликован',
  ARCHIVED: 'Архивный',
  EXPIRED: 'Истёк',
  CANCELLED: 'Отменён',
};

const FORWARD_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['REVIEW', 'CANCELLED'],
  REVIEW: ['APPROVED', 'DRAFT', 'CANCELLED'],
  APPROVED: ['PUBLISHED', 'ARCHIVED'],
  PUBLISHED: ['ARCHIVED', 'EXPIRED'],
  ARCHIVED: [],
  EXPIRED: [],
  CANCELLED: [],
};

const fd = (d: string) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('ru-RU'); } catch { return d; }
};

const fdFull = (d: string) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('ru-RU'); } catch { return d; }
};

export default function LegalDocuments() {
  const toast = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [createModal, setCreateModal] = useState(false);
  const [statusModal, setStatusModal] = useState<{ id: string; currentStatus: string } | null>(null);
  const [statusForm, setStatusForm] = useState({ status: '', changelog: '' });
  const [createForm, setCreateForm] = useState({ templateId: '', partnerId: '', variables: '' });
  const [expandedContent, setExpandedContent] = useState<any>(null);
  const [expandedVersions, setExpandedVersions] = useState<any[]>([]);
  const [expandedAudit, setExpandedAudit] = useState<any[]>([]);
  const [loadingExtra, setLoadingExtra] = useState<{ versions: boolean; audit: boolean }>({ versions: false, audit: false });

  const docs = useQuery({
    queryKey: ['legal', 'documents', statusFilter, search],
    queryFn: () => apiRequest(`/api/legal/documents?status=${statusFilter}&search=${encodeURIComponent(search)}`),
    staleTime: 10_000,
  });

  const templates = useQuery({
    queryKey: ['legal', 'templates'],
    queryFn: () => apiRequest('/api/legal/templates'),
    staleTime: 30_000,
  });

  const partners = useQuery({
    queryKey: ['legal', 'partners'],
    queryFn: () => apiRequest('/api/legal/partners'),
    staleTime: 30_000,
  });

  const createDoc = useMutation({
    mutationFn: (data: typeof createForm) => apiRequest('/api/legal/documents', {
      method: 'POST',
      body: JSON.stringify({
        templateId: data.templateId,
        partnerId: data.partnerId,
        variables: data.variables ? JSON.parse(data.variables) : {},
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['legal', 'documents'] });
      toast.success('Документ создан');
      setCreateModal(false);
      setCreateForm({ templateId: '', partnerId: '', variables: '' });
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка создания'),
  });

  const changeStatus = useMutation({
    mutationFn: ({ id, status, changelog }: { id: string; status: string; changelog: string }) =>
      apiRequest(`/api/legal/documents/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status, changelog: changelog || undefined }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['legal', 'documents'] });
      toast.success('Статус изменён');
      setStatusModal(null);
      setStatusForm({ status: '', changelog: '' });
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка изменения статуса'),
  });

  const docList: any[] = Array.isArray(docs.data) ? docs.data : (docs.data?.data || []);
  const templateOptions = Array.isArray(templates.data) ? templates.data : (templates.data?.data || []);
  const partnerOptions = Array.isArray(partners.data) ? partners.data : (partners.data?.data || []);

  const toggleExpand = async (d: any) => {
    if (expandedId === d.id) {
      setExpandedId(null);
      setExpandedContent(null);
      setExpandedVersions([]);
      setExpandedAudit([]);
      return;
    }
    setExpandedId(d.id);
    setExpandedContent(d);
    setLoadingExtra({ versions: true, audit: true });

    try {
      const versions = await apiRequest(`/api/legal/documents/${d.id}/versions`);
      setExpandedVersions(Array.isArray(versions) ? versions : (versions?.data || []));
    } catch { setExpandedVersions([]); }
    setLoadingExtra(prev => ({ ...prev, versions: false }));

    try {
      const audit = await apiRequest(`/api/legal/documents/${d.id}/audit`);
      setExpandedAudit(Array.isArray(audit) ? audit : (audit?.data || []));
    } catch { setExpandedAudit([]); }
    setLoadingExtra(prev => ({ ...prev, audit: false }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-end">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-txt-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по номеру..."
            className="pl-8 pr-3 py-1.5 rounded-lg bg-surface-2 border border-bdr-subtle text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-1 focus:ring-dv-gold/50 w-56" />
        </div>
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} options={STATUS_OPTIONS} size="sm" className="w-auto min-w-[140px]" />
        <Button icon={<Plus size={16} />} onClick={() => { setCreateForm({ templateId: '', partnerId: '', variables: '' }); setCreateModal(true); }}>
          Создать документ
        </Button>
      </div>

      {docs.isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : docList.length === 0 ? (
        <EmptyState
          icon={<FileText size={40} />}
          title="Нет документов"
          description={search || statusFilter ? 'Измените параметры поиска' : 'Создайте первый документ'}
          action={!search && !statusFilter ? <Button icon={<Plus size={16} />} onClick={() => { setCreateForm({ templateId: '', partnerId: '', variables: '' }); setCreateModal(true); }}>Создать документ</Button> : undefined}
        />
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-bdr-subtle">
                  {['Номер', 'Шаблон', 'Партнёр', 'Статус', 'Версия', 'Создан', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-txt-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {docList.map((d: any) => (
                  <>
                    <tr key={d.id} className="border-b border-bdr-subtle/50 hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => toggleExpand(d)}>
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-txt-primary">{d.documentNumber || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-txt-secondary">{d.templateName || d.template?.name || '—'}</td>
                      <td className="px-4 py-3 text-sm text-txt-secondary">{d.partnerName || d.partner?.legalName || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_BADGE[d.status] || 'default'} size="sm" dot>{STATUS_LABEL[d.status] || d.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-txt-secondary">{d.version || '—'}</td>
                      <td className="px-4 py-3 text-xs text-txt-muted">{fd(d.createdAt)}</td>
                      <td className="px-4 py-3">
                        <Button size="icon-sm" variant="ghost" aria-label="Подробнее" title="Подробнее">
                          {expandedId === d.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </Button>
                      </td>
                    </tr>
                    {expandedId === d.id && (
                      <tr key={`${d.id}-expanded`}>
                        <td colSpan={7} className="px-4 py-3 bg-surface-2/50">
                          <div className="space-y-4">
                            <div className="flex gap-2">
                              {FORWARD_TRANSITIONS[d.status]?.length > 0 && (
                                <Button size="sm" icon={<FileInput size={14} />}
                                  onClick={() => { setStatusModal({ id: d.id, currentStatus: d.status }); setStatusForm({ status: '', changelog: '' }); }}>
                                  Сменить статус
                                </Button>
                              )}
                            </div>
                            {d.content && (
                              <div>
                                <h4 className="text-xs font-bold text-txt-muted uppercase tracking-wider mb-2">Содержимое</h4>
                                <div className="p-3 rounded-lg bg-surface-1 border border-bdr-subtle text-sm text-txt-primary"
                                  dangerouslySetInnerHTML={{ __html: d.content }} />
                              </div>
                            )}
                            <div>
                              <h4 className="text-xs font-bold text-txt-muted uppercase tracking-wider mb-2">Версии</h4>
                              {loadingExtra.versions ? (
                                <Skeleton className="h-12 rounded-lg" />
                              ) : expandedVersions.length === 0 ? (
                                <p className="text-xs text-txt-muted">Нет версий</p>
                              ) : (
                                <div className="space-y-1">
                                  {expandedVersions.map((v: any) => (
                                    <div key={v.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-1 border border-bdr-subtle">
                                      <span className="text-sm text-txt-primary">v{v.version}</span>
                                      <Badge variant={v.isPublished ? 'success' : 'default'} size="xs">
                                        {v.isPublished ? 'Опубликована' : 'Черновик'}
                                      </Badge>
                                      <span className="text-xs text-txt-muted ml-auto">{fd(v.createdAt)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-txt-muted uppercase tracking-wider mb-2">Аудит</h4>
                              {loadingExtra.audit ? (
                                <Skeleton className="h-12 rounded-lg" />
                              ) : expandedAudit.length === 0 ? (
                                <p className="text-xs text-txt-muted">Нет записей аудита</p>
                              ) : (
                                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                                  {expandedAudit.map((a: any, i: number) => (
                                    <div key={a.id || i} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-surface-1 border border-bdr-subtle">
                                      <History size={14} className="text-txt-muted mt-0.5 shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs text-txt-secondary">
                                          <span className="font-medium text-txt-primary">{a.action || a.event || '—'}</span>
                                          {a.details && <span className="text-txt-muted"> — {a.details}</span>}
                                        </p>
                                        <p className="text-xs text-txt-muted">{fdFull(a.createdAt)}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Новый документ">
        <form onSubmit={e => {
          e.preventDefault();
          if (!createForm.templateId) { toast.warn('Выберите шаблон'); return; }
          if (!createForm.partnerId) { toast.warn('Выберите партнёра'); return; }
          createDoc.mutate(createForm);
        }} className="space-y-4">
          <Select label="Шаблон *" value={createForm.templateId} onChange={e => setCreateForm({ ...createForm, templateId: e.target.value })}
            options={[{ value: '', label: '— Выберите шаблон —' }, ...templateOptions.map((t: any) => ({ value: t.id, label: t.name }))]} />
          <Select label="Партнёр *" value={createForm.partnerId} onChange={e => setCreateForm({ ...createForm, partnerId: e.target.value })}
            options={[{ value: '', label: '— Выберите партнёра —' }, ...partnerOptions.map((p: any) => ({ value: p.id, label: p.legalName || p.name }))]} />
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-txt-secondary">Переменные (JSON)</label>
            <textarea value={createForm.variables} onChange={e => setCreateForm({ ...createForm, variables: e.target.value })} rows={5}
              placeholder='{"name": "Иван", "date": "2025-01-01"}'
              className="flex w-full rounded-lg border bg-white/[0.03] text-sm text-txt-primary border-bdr-subtle placeholder:text-txt-muted transition-all duration-200 resize-none focus:outline-none focus:border-dv-gold/50 focus:ring-1 focus:ring-dv-gold/20 px-3 py-2 min-h-[80px]" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" loading={createDoc.isPending}>Создать документ</Button>
            <Button type="button" variant="ghost" onClick={() => setCreateModal(false)}>Отмена</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!statusModal} onClose={() => { setStatusModal(null); setStatusForm({ status: '', changelog: '' }); }}
        title="Смена статуса">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-txt-muted">Текущий:</span>
            <Badge variant={STATUS_BADGE[statusModal?.currentStatus || ''] || 'default'} size="sm" dot>
              {STATUS_LABEL[statusModal?.currentStatus || ''] || statusModal?.currentStatus}
            </Badge>
          </div>
          <Select label="Новый статус *" value={statusForm.status} onChange={e => setStatusForm({ ...statusForm, status: e.target.value })}
            options={[
              { value: '', label: '— Выберите статус —' },
              ...(FORWARD_TRANSITIONS[statusModal?.currentStatus || ''] || []).map(s => ({
                value: s,
                label: STATUS_LABEL[s] || s,
              })),
            ]} />
          <Input label="Комментарий изменения" value={statusForm.changelog} onChange={e => setStatusForm({ ...statusForm, changelog: e.target.value })}
            placeholder="Причина изменения статуса" />
          <div className="flex gap-2 pt-2">
            <Button onClick={() => { if (statusModal && statusForm.status) changeStatus.mutate({ id: statusModal.id, ...statusForm }); }}
              loading={changeStatus.isPending} disabled={!statusForm.status}>Изменить статус</Button>
            <Button variant="ghost" onClick={() => { setStatusModal(null); setStatusForm({ status: '', changelog: '' }); }}>Отмена</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
