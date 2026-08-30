import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card, Button, Badge, Modal, Input, Select, EmptyState, Skeleton,
} from '../../components/ui/ds';
import { useToast } from '../../components/ui/ds/Toast';
import { ConfirmModal } from '../../components/ui/ds/Modal';
import { apiRequest } from '../../utils/api';
import {
  FileText, Plus, Search, Eye, Archive, Send, ChevronDown, ChevronRight,
} from 'lucide-react';

const TEMPLATE_TYPE_OPTIONS = [
  { value: 'CLINIC_AGREEMENT', label: 'Договор с клиникой' },
  { value: 'DIAGNOSTICS_AGREEMENT', label: 'Договор с диагностикой' },
  { value: 'LABORATORY_AGREEMENT', label: 'Договор с лабораторией' },
  { value: 'MARKETPLACE_AGREEMENT', label: 'Договор маркетплейса' },
  { value: 'SUPPLIER_AGREEMENT', label: 'Договор с поставщиком' },
  { value: 'LECTURER_AGREEMENT', label: 'Договор с лектором' },
  { value: 'NDA', label: 'NDA' },
  { value: 'PRIVACY_POLICY', label: 'Политика конфиденциальности' },
  { value: 'TERMS_OF_SERVICE', label: 'Пользовательское соглашение' },
  { value: 'AI_POLICY', label: 'Политика AI' },
  { value: 'COOKIE_POLICY', label: 'Политика Cookie' },
  { value: 'DPA', label: 'DPA' },
  { value: 'SLA', label: 'SLA' },
];

const TYPE_BADGE: Record<string, 'gold' | 'info' | 'success' | 'warning' | 'default'> = {
  CLINIC_AGREEMENT: 'gold',
  DIAGNOSTICS_AGREEMENT: 'info',
  LABORATORY_AGREEMENT: 'success',
  MARKETPLACE_AGREEMENT: 'warning',
  SUPPLIER_AGREEMENT: 'info',
  LECTURER_AGREEMENT: 'gold',
  NDA: 'warning',
  PRIVACY_POLICY: 'info',
  TERMS_OF_SERVICE: 'gold',
  AI_POLICY: 'default',
  COOKIE_POLICY: 'default',
  DPA: 'warning',
  SLA: 'success',
};

const STATUS_BADGE: Record<string, 'success' | 'error' | 'warning' | 'default'> = {
  PUBLISHED: 'success',
  ARCHIVED: 'error',
  DRAFT: 'default',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Черновик',
  PUBLISHED: 'Опубликован',
  ARCHIVED: 'Архивный',
};

const fd = (d: string) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('ru-RU'); } catch { return d; }
};

export default function LegalTemplates() {
  const toast = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ type: 'CONTRACT', name: '', description: '' });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [publishId, setPublishId] = useState<string | null>(null);
  /** Шаблон, архивирование которого ждёт подтверждения. */
  const [toArchive, setToArchive] = useState<{ id: string; name: string } | null>(null);
  const [publishVersion, setPublishVersion] = useState('');

  const templates = useQuery({
    queryKey: ['legal', 'templates'],
    queryFn: () => apiRequest('/api/legal/templates'),
    staleTime: 30_000,
  });

  const createTemplate = useMutation({
    mutationFn: (data: typeof form) => apiRequest('/api/legal/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['legal', 'templates'] });
      toast.success('Шаблон создан');
      setModal(false);
      setForm({ type: 'CONTRACT', name: '', description: '' });
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка создания'),
  });

  const publishTemplate = useMutation({
    mutationFn: ({ id, versionId }: { id: string; versionId: string }) => apiRequest(`/api/legal/templates/${id}/publish`, {
      method: 'POST',
      body: JSON.stringify({ versionId }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['legal', 'templates'] });
      toast.success('Версия опубликована');
      setPublishId(null);
      setPublishVersion('');
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка публикации'),
  });

  const archiveTemplate = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/legal/templates/${id}/archive`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['legal', 'templates'] });
      toast.success('Шаблон архивирован');
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка архивации'),
  });

  const templateList: any[] = Array.isArray(templates.data) ? templates.data : (templates.data?.data || []);

  const filteredList = templateList.filter((t: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return String(t.name || '').toLowerCase().includes(q) || String(t.type || '').toLowerCase().includes(q);
  });

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div className="space-y-4 max-w-full overflow-x-hidden">
      <div className="flex flex-wrap gap-2 justify-end">
        <div className="relative w-full sm:w-auto">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-txt-muted" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск шаблонов..."
            className="pl-8 pr-3 py-1.5 rounded-lg bg-surface-2 border border-bdr-subtle text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-1 focus:ring-dv-gold/50 w-full sm:w-56 min-h-11" />
        </div>
        <Button icon={<Plus size={16} />} onClick={() => { setForm({ type: 'CONTRACT', name: '', description: '' }); setModal(true); }} className="min-h-11">
          Создать шаблон
        </Button>
      </div>

      {templates.isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : filteredList.length === 0 ? (
        <EmptyState
          icon={<FileText size={40} />}
          title="Нет шаблонов"
          description={search ? 'Измените поисковый запрос' : 'Создайте первый шаблон'}
          action={!search ? <Button icon={<Plus size={16} />} onClick={() => { setForm({ type: 'CONTRACT', name: '', description: '' }); setModal(true); }}>Создать шаблон</Button> : undefined}
        />
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-bdr-subtle">
                  {['Тип', 'Название', 'Версия', 'Статус', 'Блоков', 'Создан', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-txt-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredList.map((t: any) => (
                  <>
                    <tr key={t.id} className="border-b border-bdr-subtle/50 hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => toggleExpand(t.id)}>
                      <td className="px-4 py-3">
                        <Badge variant={TYPE_BADGE[t.type] || 'default'} size="sm">
                          {TEMPLATE_TYPE_OPTIONS.find(o => o.value === t.type)?.label || t.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-txt-primary">{t.name || '—'}</div>
                        {t.description && <div className="text-xs text-txt-muted truncate max-w-[200px]">{t.description}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm text-txt-secondary">{t.currentVersion ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={t.versions?.[0]?.status === 'PUBLISHED' ? 'success' : 'default'} size="sm" dot>
                          {t.versions?.[0]?.status === 'PUBLISHED' ? 'Опубликован' : 'Черновик'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-txt-secondary">{t.blocks?.length ?? 0}</td>
                      <td className="px-4 py-3 text-xs text-txt-muted">{fd(t.createdAt)}</td>
                      <td className="px-4 py-3">
                        <Button size="icon-sm" variant="ghost" aria-label="Подробнее" title="Подробнее">
                          {expandedId === t.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </Button>
                      </td>
                    </tr>
                    {expandedId === t.id && (
                      <tr key={`${t.id}-expanded`}>
                        <td colSpan={7} className="px-4 py-3 bg-surface-2/50">
                          <div className="space-y-4">
                            <div>
                              <h4 className="text-xs font-bold text-txt-muted uppercase tracking-wider mb-2">Версии</h4>
                              {Array.isArray(t.versions) && t.versions.length > 0 ? (
                                <div className="space-y-1">
                                  {t.versions.map((v: any) => (
                      <div key={v.id} className="px-3 py-2 rounded-lg bg-surface-1 border border-bdr-subtle">
                                          <div className="flex items-center gap-3 mb-2">
                                            <span className="text-sm text-txt-primary font-semibold">v{v.version}</span>
                                            <Badge variant={v.status === 'PUBLISHED' ? 'success' : 'default'} size="xs">
                                              {v.status === 'PUBLISHED' ? 'Опубликована' : 'Черновик'}
                                            </Badge>
                                            <span className="text-xs text-txt-muted ml-auto">{fd(v.createdAt)}</span>
                                          </div>
                                          {v.content && (
                                            <div className="text-xs text-txt-secondary leading-relaxed max-h-60 overflow-y-auto bg-surface-2 rounded p-2 font-mono whitespace-pre-wrap border border-bdr-subtle">
                                              {v.content.length > 2000 ? v.content.slice(0, 2000) + '…' : v.content}
                                            </div>
                                          )}
                                        </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-txt-muted">Нет версий</p>
                              )}
                            </div>
                            <div className="flex gap-2">
                              {t.versions?.[0]?.status !== 'ARCHIVED' && (
                                <Button size="sm" icon={<Send size={14} />} onClick={() => setPublishId(t.id)} className="min-h-11">
                                  Опубликовать версию
                                </Button>
                              )}
                              {t.versions?.[0]?.status === 'PUBLISHED' && (
                                <Button size="sm" variant="ghost" icon={<Archive size={14} />}
                                  onClick={() => setToArchive({ id: t.id, name: t.name || 'Без названия' })}
                                  loading={archiveTemplate.isPending}
                                  className="min-h-11">
                                  Архивировать
                                </Button>
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

      <Modal open={modal} onClose={() => setModal(false)} title="Новый шаблон">
        <form onSubmit={e => {
          e.preventDefault();
          if (!form.name.trim()) { toast.warn('Введите название'); return; }
          createTemplate.mutate(form);
        }} className="space-y-4">
          <Select label="Тип *" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} options={TEMPLATE_TYPE_OPTIONS} />
          <Input label="Название *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="Введите название шаблона" />
          <Input label="Описание" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Описание шаблона" />
          <div className="flex gap-2 pt-2">
            <Button type="submit" loading={createTemplate.isPending}>Создать шаблон</Button>
            <Button type="button" variant="ghost" onClick={() => setModal(false)}>Отмена</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!publishId} onClose={() => { setPublishId(null); setPublishVersion(''); }} title="Публикация версии">
        <div className="space-y-4">
          <p className="text-sm text-txt-muted">Выберите версию для публикации</p>
          {(() => {
            const tmpl = templateList.find(t => t.id === publishId);
            const versions = Array.isArray(tmpl?.versions) ? tmpl?.versions : [];
            return (
              <Select
                label="Версия"
                value={publishVersion}
                onChange={e => setPublishVersion(e.target.value)}
                options={[
                  { value: '', label: '— Выберите версию —' },
                  ...versions.map((v: any) => ({ value: v.id, label: `v${v.version} — ${fd(v.createdAt)}` })),
                ]}
              />
            );
          })()}
          <div className="flex gap-2 pt-2">
            <Button onClick={() => { if (publishId && publishVersion) publishTemplate.mutate({ id: publishId, versionId: publishVersion }); }}
              loading={publishTemplate.isPending} disabled={!publishVersion}>Опубликовать</Button>
            <Button variant="ghost" onClick={() => { setPublishId(null); setPublishVersion(''); }}>Отмена</Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!toArchive}
        onClose={() => setToArchive(null)}
        onConfirm={() => { if (toArchive) archiveTemplate.mutate(toArchive.id); }}
        title="Архивировать шаблон?"
        message={toArchive ? `«${toArchive.name}» перестанет быть доступен для новых документов. Уже созданные документы не изменятся.` : ''}
        confirmLabel="Архивировать"
        variant="warning"
      />
    </div>
  );
}
