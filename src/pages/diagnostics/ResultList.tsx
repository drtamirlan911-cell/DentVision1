import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Search, Eye, CheckCircle, Clock } from 'lucide-react';
import { GlassCard } from '@/components/ui/ds/GlassCard';
import { Card } from '@/components/ui/ds/Card';
import { Button } from '@/components/ui/ds/Button';
import { Skeleton } from '@/components/ui/ds/Skeleton';
import { QueryError } from '@/components/ui/ds/QueryError';
import { PageHeader } from '@/components/ui/ds/StatCard';
import { queryKeys } from '@/queries/keys';
import * as api from '@/utils/api';
import { StatusPill } from './workspace/Pipeline';

export default function ResultList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.diagnostics.referrals({ status: statusFilter || '', search, limit: '100' }),
    queryFn: () => api.getDiagnosticReferrals({ status: statusFilter || '', search, limit: '100' }),
  });

  const items = data?.items || data?.data || data?.referrals || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="dv-page space-y-6 max-w-full overflow-x-hidden"
    >
      <PageHeader
        title="Результаты исследований"
        subtitle="Завершённые и просмотренные исследования"
        icon={<ClipboardList size={22} />}
      />

      <div className="dv-panel p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="relative flex-1 min-w-0" aria-label="Поиск по пациенту">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по пациенту..."
              className="w-full min-h-11 bg-surface-raised border border-bdr-subtle rounded-lg pl-9 pr-3 py-2.5 text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:border-dv-gold/50 focus:ring-1 focus:ring-dv-gold/20 transition-colors"
            />
          </label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            aria-label="Фильтр статуса"
            className="w-full sm:w-auto min-h-11 bg-surface-raised border border-bdr-subtle rounded-lg px-3 py-2.5 text-sm text-txt-primary focus:outline-none focus:border-dv-gold/50 focus:ring-1 focus:ring-dv-gold/20 transition-colors"
          >
            <option value="">Все результаты</option>
            <option value="COMPLETED">Готово</option>
            <option value="REVIEWED">Просмотрено</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}</div>
      ) : isError ? (
        <QueryError what="результаты" onRetry={() => refetch()} />
      ) : items.length === 0 ? (
        <GlassCard padding="md">
          <div className="flex items-center justify-center min-h-40 text-txt-muted text-sm flex-col gap-2">
            <ClipboardList size={48} className="opacity-20" />
            Нет завершённых исследований
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-2">
          {items.map((r: any) => (
            <Card
              key={r.id}
              padding="md"
              hover
              className="cursor-pointer"
              onClick={() => navigate(`/diagnostics/referrals/${r.id}`)}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
                  <CheckCircle size={20} className="text-success" />
                </div>
                <div className="flex-1 min-w-0 w-full">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-txt-primary">{r.patientName || 'Неизвестно'}</p>
                    <StatusPill status={r.status} />
                  </div>
                  <p className="text-xs text-txt-muted mt-0.5">
                    {r.studyType || r.labTestType || 'Исследование'}
                    {r.clinic?.name && ` · ${r.clinic.name}`}
                    {r.center?.name && ` · ${r.center.name}`}
                    {r.lab?.name && ` · ${r.lab.name}`}
                  </p>
                  <p className="text-xs text-txt-muted mt-0.5">
                    <Clock size={10} className="inline mr-1" />
                    {new Date(r.updatedAt || r.createdAt).toLocaleString()}
                  </p>
                </div>
                <Button
                  size="xs"
                  variant="ghost"
                  icon={<Eye size={14} />}
                  className="min-h-11 w-full sm:w-auto"
                  onClick={(e: any) => { e.stopPropagation(); navigate(`/diagnostics/referrals/${r.id}`); }}
                >
                  Открыть
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}
