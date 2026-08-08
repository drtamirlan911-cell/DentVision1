import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  StatCard, Card, Button, Badge, Skeleton, EmptyState,
} from '../../components/ui/ds';
import { apiRequest } from '../../utils/api';
import {
  FileText, FileSignature, Users, BookOpen, Clock, AlertTriangle,
  Search, Eye,
} from 'lucide-react';

const STATUS_BADGE: Record<string, 'success' | 'warning' | 'error' | 'info' | 'gold' | 'default'> = {
  DRAFT: 'default',
  REVIEW: 'warning',
  APPROVED: 'success',
  PUBLISHED: 'gold',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Черновик',
  REVIEW: 'На проверке',
  APPROVED: 'Утверждён',
  PUBLISHED: 'Опубликован',
};

const fd = (d: string) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('ru-RU'); } catch { return d; }
};

export default function LegalDashboard() {
  const [search, setSearch] = useState('');

  const stats = useQuery({
    queryKey: ['legal', 'dashboard'],
    queryFn: () => apiRequest('/api/legal/dashboard'),
    staleTime: 30_000,
  });

  const s: any = stats.data || {};

  const recentDocs: any[] = Array.isArray(s.recentDocuments) ? s.recentDocuments : [];
  const expiringDocs: any[] = Array.isArray(s.expiringDocuments) ? s.expiringDocuments : [];

  const filteredExpiring = expiringDocs.filter((d: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return String(d.title || '').toLowerCase().includes(q) || String(d.partnerName || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      {stats.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard label="Всего документов" value={s.totalDocuments ?? 0} icon={<FileText size={18} />} />
          <StatCard label="Черновики" value={s.draftCount ?? 0} icon={<FileSignature size={18} />} />
          <StatCard label="На проверке" value={s.reviewCount ?? 0} icon={<Clock size={18} />} />
          <StatCard label="Утверждены" value={s.approvedCount ?? 0} icon={<FileSignature size={18} />} />
          <StatCard label="Партнёров" value={s.totalPartners ?? 0} icon={<Users size={18} />} />
          <StatCard label="Истекают" value={s.expiringCount ?? 0} icon={<AlertTriangle size={18} />} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card padding="none">
          <div className="px-4 py-3 border-b border-bdr-subtle flex items-center justify-between">
            <h3 className="text-sm font-semibold text-txt-primary">Последние документы</h3>
          </div>
          {stats.isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
            </div>
          ) : recentDocs.length === 0 ? (
            <EmptyState icon={<FileText size={36} />} title="Нет документов" description="Документы появятся после создания" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-bdr-subtle">
                    {['Название', 'Статус', 'Дата'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold text-txt-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentDocs.slice(0, 10).map((d: any) => (
                    <tr key={d.id} className="border-b border-bdr-subtle/50 hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-txt-primary truncate max-w-[200px]">{d.title || '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_BADGE[d.status] || 'default'} size="sm" dot>
                          {STATUS_LABEL[d.status] || d.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-txt-muted">{fd(d.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card padding="none">
          <div className="px-4 py-3 border-b border-bdr-subtle flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-txt-primary">Истекающие документы</h3>
            <div className="relative w-full sm:w-auto">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-txt-muted" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск..."
                className="pl-8 pr-3 py-1.5 rounded-lg bg-surface-2 border border-bdr-subtle text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-1 focus:ring-dv-gold/50 w-full sm:w-44 min-h-11" />
            </div>
          </div>
          {stats.isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          ) : filteredExpiring.length === 0 ? (
            <EmptyState icon={<AlertTriangle size={36} />} title="Нет истекающих" description="Все документы в порядке" />
          ) : (
            <div className="divide-y divide-bdr-subtle/50">
              {filteredExpiring.map((d: any) => (
                <div key={d.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                  <div className="p-2 rounded-lg bg-warning/10 text-warning shrink-0">
                    <Clock size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-txt-primary truncate">{d.title || '—'}</p>
                    <p className="text-xs text-txt-muted">
                      {d.partnerName ? `${d.partnerName} · ` : ''}
                      Истекает: {fd(d.expiresAt)}
                    </p>
                  </div>
                  <Button size="icon-sm" variant="ghost" aria-label="Просмотреть" className="min-h-11 min-w-11"><Eye size={14} /></Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {stats.isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      )}

      {!stats.isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="rounded-xl border border-bdr-subtle bg-surface-raised p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-dv-gold/10 text-dv-gold"><FileText size={18} /></div>
              <div>
                <p className="text-lg font-bold text-txt-primary">{s.totalTemplates ?? 0}</p>
                <p className="text-xs text-txt-muted">Всего шаблонов</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-bdr-subtle bg-surface-raised p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info/10 text-info"><BookOpen size={18} /></div>
              <div>
                <p className="text-lg font-bold text-txt-primary">{s.totalBlocks ?? 0}</p>
                <p className="text-xs text-txt-muted">Всего блоков</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-bdr-subtle bg-surface-raised p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10 text-warning"><AlertTriangle size={18} /></div>
              <div>
                <p className="text-lg font-bold text-txt-primary">{s.expiringCount ?? 0}</p>
                <p className="text-xs text-txt-muted">Скоро истекают</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
