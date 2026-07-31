import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  StatCard, PageHeader, GlassCard, Card, CardContent, Button, Badge, Modal,
  Input, Select, EmptyState, Skeleton, Pagination,
} from '../../components/ui/ds';
import { useToast } from '../../components/ui/ds/Toast';
import * as api from '../../utils/api';
import {
  ShoppingCart, Store, FileCheck, AlertTriangle, Check, X, Eye, Search,
  RefreshCw, Users, Shield, Truck, BadgeCheck, Ban,
  Package, MessageSquare, TrendingUp,
} from 'lucide-react';

const fd = (d: string) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('ru-RU'); } catch { return d; }
};

const PAGE_SIZE = 15;

const PIPELINE_STATUSES = ['pending', 'documents_review', 'verified', 'official_partner'] as const;

const PIPELINE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Ожидает', color: 'text-warning', icon: <AlertTriangle size={20} /> },
  documents_review: { label: 'Документы', color: 'text-info', icon: <FileCheck size={20} /> },
  verified: { label: 'Верифицирован', color: 'text-success', icon: <BadgeCheck size={20} /> },
  official_partner: { label: 'Партнёр', color: 'text-dv-gold', icon: <Truck size={20} /> },
};

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Все статусы' },
  { value: 'pending', label: 'Ожидает' },
  { value: 'documents_review', label: 'Документы' },
  { value: 'verified', label: 'Верифицирован' },
  { value: 'official_partner', label: 'Офиц. партнёр' },
  { value: 'suspended', label: 'Заблокирован' },
];

const STATUS_BADGE: Record<string, 'success' | 'error' | 'warning' | 'gold' | 'info' | 'default'> = {
  pending: 'warning',
  documents_review: 'info',
  verified: 'success',
  official_partner: 'gold',
  suspended: 'error',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Ожидает',
  documents_review: 'Документы',
  verified: 'Верифицирован',
  official_partner: 'Офиц. партнёр',
  suspended: 'Заблокирован',
};

export default function MarketplaceTab() {
  const toast = useToast();
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<any>(null);

  const suppliers = useQuery({
    queryKey: ['marketplace', 'suppliers', statusFilter],
    queryFn: () => api.opsListSuppliers({ status: statusFilter || undefined }),
    staleTime: 15_000,
  });

  const detailQuery = useQuery({
    queryKey: ['marketplace', 'supplier', detail?.id],
    queryFn: () => api.opsGetSupplier(detail.id),
    enabled: !!detail?.id,
    staleTime: 10_000,
  });

  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.opsSetSupplierStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketplace'] });
      toast.success('Статус обновлён');
      setDetail(null);
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка'),
  });

  const batchAdvance = useMutation({
    mutationFn: () => api.opsAutoAdvanceSuppliers(),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['marketplace'] });
      toast.success(`Обработано: ${data?.advanced ?? 0} поставщиков`);
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка'),
  });

  const batchVerifyLecturers = useMutation({
    mutationFn: () => api.opsAutoVerifyLecturers(),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['marketplace'] });
      toast.success(`Верифицировано лекторов: ${data?.verified ?? 0}`);
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка'),
  });

  const allList: any[] = Array.isArray(suppliers.data)
    ? suppliers.data
    : Array.isArray(suppliers.data?.data)
      ? suppliers.data.data
      : Array.isArray(suppliers.data?.items)
        ? suppliers.data.items
        : [];

  const pipelineCount: Record<string, number> = {};
  PIPELINE_STATUSES.forEach(s => { pipelineCount[s] = 0; });
  allList.forEach((s: any) => {
    const st = String(s.status || 'pending').toLowerCase();
    if (pipelineCount[st] !== undefined) pipelineCount[st]++;
  });

  const totalCount = allList.length;
  const pendingCount = pipelineCount['pending'] || 0;
  const verifiedCount = pipelineCount['verified'] || 0;
  const officialCount = pipelineCount['official_partner'] || 0;

  const filtered = allList.filter((s: any) => {
    if (statusFilter && s.status?.toLowerCase() !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        String(s.name || '').toLowerCase().includes(q) ||
        String(s.email || '').toLowerCase().includes(q) ||
        String(s.city || '').toLowerCase().includes(q) ||
        String(s.phone || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const detailData: any = detailQuery.data || detail;
  const detailMembers: any[] = Array.isArray(detailData?.members)
    ? detailData.members
    : Array.isArray(detailData?.users)
      ? detailData.users
      : [];
  const detailDocuments: any[] = Array.isArray(detailData?.documents)
    ? detailData.documents
    : [];

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ['marketplace'] });
  };

  const shopStats = useQuery({
    queryKey: ['marketplace', 'stats'],
    queryFn: () => api.getShopAdminStats(),
    staleTime: 30_000,
  });
  const shopStatsData: any = shopStats.data?.data || shopStats.data || {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketplace Moderation"
        subtitle="Модерация поставщиков и партнёров маркетплейса"
        icon={<ShoppingCart size={20} />}
        actions={
          <Button icon={<RefreshCw size={16} />} variant="ghost" onClick={refreshAll}>Обновить</Button>
        }
      />

      {/* Marketplace Financial Analytics */}
      {!shopStats.isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Выручка (оплачено)" value={`${(shopStatsData.totalRevenue || 0).toLocaleString()} ₸`} icon={<TrendingUp size={18} />} />
          <StatCard label="Всего заказов" value={shopStatsData.totalOrders ?? 0} icon={<ShoppingCart size={18} />} />
          <StatCard label="Активных товаров" value={shopStatsData.totalProducts ?? 0} icon={<Package size={18} />} />
          <StatCard label="Партнёров" value={shopStatsData.activeSuppliers ?? 0} icon={<BadgeCheck size={18} />} />
        </div>
      )}

      {suppliers.isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Всего поставщиков" value={totalCount} icon={<Store size={18} />} />
          <StatCard label="Ожидают" value={pendingCount} icon={<AlertTriangle size={18} />} />
          <StatCard label="Верифицированы" value={verifiedCount} icon={<Check size={18} />} />
          <StatCard label="Офиц. партнёры" value={officialCount} icon={<Truck size={18} />} />
        </div>
      )}

      <GlassCard padding="md">
        <p className="text-xs font-semibold text-txt-muted uppercase tracking-wider mb-4">Pipeline поставщиков</p>
        {suppliers.isLoading ? (
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {PIPELINE_STATUSES.map((st, idx) => {
              const cfg = PIPELINE_CONFIG[st];
              return (
                <div key={st} className="flex items-center gap-2">
                  <button
                    onClick={() => { setStatusFilter(statusFilter === st ? '' : st); setPage(1); }}
                    className={`flex-1 p-3 rounded-xl border transition-all duration-200 ${
                      statusFilter === st
                        ? 'border-dv-gold/40 bg-dv-gold/5 shadow-sm'
                        : 'border-bdr-subtle bg-surface-2 hover:border-bdr/50 hover:bg-surface-raised-hover'
                    }`}
                  >
                    <div className={`flex items-center gap-2 mb-1.5 ${cfg.color}`}>
                      {cfg.icon}
                      <span className="text-xs font-medium text-txt-muted">{cfg.label}</span>
                    </div>
                    <p className="text-xl font-bold text-txt-primary">{pipelineCount[st] || 0}</p>
                  </button>
                  {idx < PIPELINE_STATUSES.length - 1 && (
                    <div className="hidden md:flex items-center text-txt-ghost">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-txt-ghost/50">
                        <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      <GlassCard padding="md">
        <p className="text-xs font-semibold text-txt-muted uppercase tracking-wider mb-4">Батч-автоматизации</p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            icon={<FileCheck size={16} />}
            loading={batchAdvance.isPending}
            onClick={() => batchAdvance.mutate()}
          >
            Продвинуть заявки поставщиков
          </Button>
          <Button
            variant="secondary"
            icon={<Users size={16} />}
            loading={batchVerifyLecturers.isPending}
            onClick={() => batchVerifyLecturers.mutate()}
          >
            Верифицировать новых лекторов
          </Button>
        </div>
      </GlassCard>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 justify-end">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-txt-muted" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Поиск поставщиков..."
              className="pl-8 pr-3 py-1.5 rounded-lg bg-surface-2 border border-bdr-subtle text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-1 focus:ring-dv-gold/50 w-56"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            options={STATUS_FILTER_OPTIONS}
            size="sm"
            className="w-auto min-w-[150px]"
          />
        </div>

        {suppliers.isLoading ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : paged.length === 0 ? (
          <EmptyState
            icon={<Store size={40} />}
            title="Нет поставщиков"
            description="Поставщики появятся здесь после регистрации"
          />
        ) : (
          <>
            <Card padding="none">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-bdr-subtle">
                      {['Поставщик', 'Контакты', 'Город', 'Статус', 'Товаров', 'Создано', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-txt-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((s: any) => (
                      <tr key={s.id} className="border-b border-bdr-subtle/50 hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <div className="text-sm font-semibold text-txt-primary">{s.name || '—'}</div>
                          <div className="text-xs text-txt-muted">{s.email || ''}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-txt-secondary">{s.phone || '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-txt-secondary">{s.city || '—'}</td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_BADGE[s.status?.toLowerCase()] || 'default'} size="sm" dot>
                            {STATUS_LABEL[s.status?.toLowerCase()] || s.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-txt-secondary">
                          {s.product_count ?? s._count?.products ?? s.productCount ?? 0}
                        </td>
                        <td className="px-4 py-3 text-xs text-txt-muted">{fd(s.createdAt)}</td>
                        <td className="px-4 py-3">
                          <Button size="icon-sm" variant="ghost" onClick={() => setDetail(s)} title="Подробнее">
                            <Eye size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <div className="flex justify-center">
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Детали поставщика" size="lg">
        {detailQuery.isLoading && detail?.id ? (
          <Skeleton className="h-48" />
        ) : detailData && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-txt-muted mb-1">Название</p>
                <p className="text-sm font-medium text-txt-primary">{detailData.name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-txt-muted mb-1">Статус</p>
                <Badge variant={STATUS_BADGE[detailData.status?.toLowerCase()] || 'default'} size="md" dot>
                  {STATUS_LABEL[detailData.status?.toLowerCase()] || detailData.status}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-txt-muted mb-1">Email</p>
                <p className="text-sm text-txt-secondary">{detailData.email || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-txt-muted mb-1">Телефон</p>
                <p className="text-sm text-txt-secondary">{detailData.phone || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-txt-muted mb-1">Город</p>
                <p className="text-sm text-txt-secondary">{detailData.city || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-txt-muted mb-1">Создано</p>
                <p className="text-sm text-txt-secondary">{fd(detailData.createdAt)}</p>
              </div>
            </div>

            {detailData.description && (
              <div>
                <p className="text-xs text-txt-muted mb-1">Описание</p>
                <p className="text-sm text-txt-secondary">{detailData.description}</p>
              </div>
            )}

            {detailDocuments.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-txt-muted uppercase tracking-wider mb-2">Документы</p>
                <div className="space-y-2">
                  {detailDocuments.map((doc: any, idx: number) => (
                    <div key={doc.id || idx} className="flex items-center gap-2 p-2 rounded-lg bg-surface-2 border border-bdr-subtle">
                      <FileCheck size={14} className="text-txt-muted shrink-0" />
                      <span className="text-sm text-txt-primary truncate">{doc.name || doc.title || `Документ ${idx + 1}`}</span>
                      <Badge variant={doc.verified ? 'success' : 'warning'} size="xs">
                        {doc.verified ? 'Проверен' : 'На проверке'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detailMembers.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-txt-muted uppercase tracking-wider mb-2">Участники</p>
                <div className="space-y-2">
                  {detailMembers.map((m: any, idx: number) => (
                    <div key={m.id || idx} className="flex items-center gap-3 p-2 rounded-lg bg-surface-2 border border-bdr-subtle">
                      <div className="w-8 h-8 rounded-full bg-dv-gold/10 flex items-center justify-center text-dv-gold">
                        <Users size={14} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-txt-primary truncate">
                          {[m.firstName, m.lastName].filter(Boolean).join(' ') || m.name || m.email || '—'}
                        </p>
                        <p className="text-xs text-txt-muted">{m.role || m.email || ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-3 border-t border-bdr-subtle">
              {detailData.status?.toLowerCase() === 'pending' && (
                <>
                  <Button
                    variant="success"
                    icon={<Check size={16} />}
                    loading={changeStatus.isPending}
                    onClick={() => changeStatus.mutate({ id: detailData.id, status: 'documents_review' })}
                  >
                    На проверку
                  </Button>
                  <Button
                    variant="danger"
                    icon={<Ban size={16} />}
                    loading={changeStatus.isPending}
                    onClick={() => changeStatus.mutate({ id: detailData.id, status: 'suspended' })}
                  >
                    Заблокировать
                  </Button>
                </>
              )}
              {detailData.status?.toLowerCase() === 'documents_review' && (
                <Button
                  variant="success"
                  icon={<Check size={16} />}
                  loading={changeStatus.isPending}
                  onClick={() => changeStatus.mutate({ id: detailData.id, status: 'verified' })}
                >
                  Одобрить документы
                </Button>
              )}
              {detailData.status?.toLowerCase() === 'verified' && (
                <Button
                  variant="primary"
                  icon={<Truck size={16} />}
                  loading={changeStatus.isPending}
                  onClick={() => changeStatus.mutate({ id: detailData.id, status: 'official_partner' })}
                >
                  Назначить партнёром
                </Button>
              )}
              {detailData.status?.toLowerCase() === 'official_partner' && (
                <Button
                  variant="warning"
                  icon={<Shield size={16} />}
                  loading={changeStatus.isPending}
                  onClick={() => changeStatus.mutate({ id: detailData.id, status: 'verified' })}
                >
                  Понизить до верифицированного
                </Button>
              )}
              {detailData.status?.toLowerCase() === 'suspended' && (
                <Button
                  variant="success"
                  icon={<Check size={16} />}
                  loading={changeStatus.isPending}
                  onClick={() => changeStatus.mutate({ id: detailData.id, status: 'pending' })}
                >
                  Разблокировать
                </Button>
              )}
              <Button variant="ghost" onClick={() => setDetail(null)}>Закрыть</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
