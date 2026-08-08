import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, FileText, Filter, Trash2, X } from 'lucide-react';
import { useAuth } from '@/store/auth.store';
import { useToast } from '@/components/ui/ds/Toast';
import { Button } from '@/components/ui/ds/Button';
import { Input } from '@/components/ui/ds/Input';
import { Card } from '@/components/ui/ds/Card';
import { Badge } from '@/components/ui/ds/Badge';
import { PageLoader } from '@/components/ui/PageLoader';
import * as api from '@/utils/api';
import { queryKeys } from '@/queries/keys';

const STATUS_OPTS = [
  { value: '', label: 'Все' },
  { value: 'DRAFT', label: 'Черновик' },
  { value: 'SENT', label: 'Отправлено' },
  { value: 'ACCEPTED', label: 'Принято' },
  { value: 'SCHEDULED', label: 'Запланировано' },
  { value: 'IN_PROGRESS', label: 'В работе' },
  { value: 'COMPLETED', label: 'Выполнено' },
  { value: 'DELIVERED', label: 'Доставлено' },
  { value: 'CANCELLED', label: 'Отменено' },
];

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-surface-2 text-txt-muted',
  SENT: 'bg-dv-gold/10 text-dv-gold',
  ACCEPTED: 'bg-blue-500/10 text-blue-500',
  SCHEDULED: 'bg-purple-500/10 text-purple-500',
  PATIENT_ARRIVED: 'bg-cyan-500/10 text-cyan-500',
  IN_PROGRESS: 'bg-orange-500/10 text-orange-500',
  COMPLETED: 'bg-green-500/10 text-green-500',
  REVIEWED: 'bg-emerald-500/10 text-emerald-500',
  DELIVERED: 'bg-teal-500/10 text-teal-500',
  CLOSED: 'bg-surface-2 text-txt-muted',
  CANCELLED: 'bg-error/10 text-error',
};

const PRIORITY_COLORS: Record<string, string> = {
  NORMAL: 'bg-surface-2 text-txt-muted',
  URGENT: 'bg-warning/10 text-warning',
  EMERGENCY: 'bg-error/10 text-error',
};

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.03 } } };
const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

export default function ReferralList() {
  const navigate = useNavigate();
  const { clinic, activeMembership } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const statusFilter = searchParams.get('status') || '';
  const page = Number(searchParams.get('page')) || 1;
  const pageSize = 20;

  const clinicId = clinic?.id || activeMembership?.clinicId || '';

  const params: Record<string, string> = {};
  if (clinicId) params.clinicId = clinicId;
  if (statusFilter) params.status = statusFilter;
  if (search) params.search = search;
  params.limit = String(pageSize);
  params.offset = String((page - 1) * pageSize);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.diagnostics.referrals(params),
    queryFn: () => api.getDiagnosticReferrals(params),
    staleTime: 15_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteDiagnosticReferral(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.diagnostics.referrals() });
      toast.success('Направление удалено');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = useMemo(() => data?.items || [], [data]);
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  const setFilter = (key: string, val: string) => {
    const next = new URLSearchParams(searchParams);
    if (val) next.set(key, val); else next.delete(key);
    if (key !== 'page') next.set('page', '1');
    setSearchParams(next);
  };

  const handleSearch = (val: string) => {
    setSearch(val);
    setFilter('search', val);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 sm:p-6 space-y-4 max-w-full overflow-x-hidden">
      <div className="flex flex-wrap items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-txt-primary">Направления</h1>
          <p className="text-sm text-txt-muted mt-0.5">{total} всего</p>
        </div>
        <Button variant="primary" className="min-h-11" icon={<Plus size={16} />} onClick={() => navigate('/diagnostics/referrals/new')}>
          Новое направление
        </Button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1 max-w-full sm:max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
          <input value={search} onChange={e => handleSearch(e.target.value)}
            placeholder="Поиск по имени или ИИН..."
            className="w-full min-h-11 pl-9 pr-3 py-2 bg-surface-1 border border-bdr-subtle rounded-lg text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:border-dv-gold/40" />
          {search && (
            <button aria-label="Clear search" onClick={() => handleSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-muted hover:text-txt-primary">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1 overflow-x-auto">
          {STATUS_OPTS.map(s => (
            <button key={s.value} onClick={() => setFilter('status', s.value)}
              className={`min-h-11 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${statusFilter === s.value ? 'bg-dv-gold/10 text-dv-gold border border-dv-gold/20' : 'text-txt-muted hover:text-txt-primary bg-surface-1 border border-transparent'}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : items.length === 0 ? (
        <Card padding="lg" className="text-center py-16">
          <FileText size={40} className="mx-auto text-txt-muted mb-3" />
          <p className="text-txt-muted text-sm">Нет направлений</p>
          <Button variant="primary" className="mt-4 min-h-11" onClick={() => navigate('/diagnostics/referrals/new')}>
            Создать первое направление
          </Button>
        </Card>
      ) : (
        <>
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-2">
            {items.map((r: any) => (
              <motion.div key={r.id} variants={fadeUp}>
                <Card padding="md" className="cursor-pointer hover:border-dv-gold/30 transition-all"
                  onClick={() => navigate(`/diagnostics/referrals/${r.id}`)}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-txt-primary truncate">{r.patientName}</span>
                        <Badge className={STATUS_COLORS[r.status] || ''}>{r.status}</Badge>
                        <Badge className={PRIORITY_COLORS[r.priority] || ''}>{r.priority}</Badge>
                      </div>
                      <div className="text-xs text-txt-muted space-x-3">
                        <span>{r.studyType}</span>
                        {r.center && <span>• {r.center.name}</span>}
                        {r.lab && <span>• {r.lab.name}</span>}
                        <span>• {new Date(r.createdAt).toLocaleDateString('ru-RU')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.status === 'DRAFT' && (
                        <Button variant="ghost" size="icon-sm" className="min-h-11 min-w-11" aria-label="Удалить" onClick={e => { e.stopPropagation(); deleteMutation.mutate(r.id); }}>
                          <Trash2 size={14} className="text-error" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button variant="ghost" size="sm" className="min-h-11" disabled={page <= 1} onClick={() => setFilter('page', String(page - 1))}>
                Назад
              </Button>
              <span className="text-sm text-txt-muted px-2">{page} из {totalPages}</span>
              <Button variant="ghost" size="sm" className="min-h-11" disabled={page >= totalPages} onClick={() => setFilter('page', String(page + 1))}>
                Вперёд
              </Button>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
