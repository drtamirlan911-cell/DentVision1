import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { FileText, Clock, CheckCircle, AlertTriangle, Activity, ArrowRight, Plus, Database } from 'lucide-react';
import { GlassCard } from '@/components/ui/ds/GlassCard';
import { Card } from '@/components/ui/ds/Card';
import { Button } from '@/components/ui/ds/Button';
import { Skeleton } from '@/components/ui/ds/Skeleton';
import { useAuth } from '@/store/auth.store';
import { queryKeys } from '@/queries/keys';
import * as api from '@/utils/api';

export default function DiagnosticsDashboard() {
  const { clinic, role } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const clinicId = clinic?.id;
  const [seeding, setSeeding] = useState(false);

  const isSuperAdmin = role === 'superadmin';

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.diagnostics.dashboard(clinicId),
    queryFn: () => api.getDiagnosticsDashboard(clinicId),
  });

  const stats = [
    { label: 'Направлений сегодня', value: data?.todayCount ?? 0, icon: <FileText size={18} />, color: '#C9A96E' },
    { label: 'В ожидании', value: data?.pending ?? 0, icon: <Clock size={18} />, color: '#F39C12' },
    { label: 'Готово', value: data?.completed ?? 0, icon: <CheckCircle size={18} />, color: '#27AE60' },
    { label: 'Просрочено', value: data?.overdue ?? 0, icon: <AlertTriangle size={18} />, color: '#E74C3C' },
    { label: 'Всего', value: data?.total ?? 0, icon: <Activity size={18} />, color: '#3498DB' },
  ];

  const recent = data?.recent || [];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-6 space-y-6 max-w-full overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-txt-primary">Diagnostics Dashboard</h1>
          <p className="text-sm text-txt-muted mt-0.5">Единый центр диагностики — 3D и лабораторные исследования</p>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => navigate('/diagnostics/referrals/new')} className="min-h-11">
            Новое направление
          </Button>
          {isSuperAdmin && (
            <Button variant="ghost" icon={<Database size={14} />} className="min-h-11" onClick={async () => {
              setSeeding(true);
              try { await api.seedDiagnosticsTestData(); queryClient.invalidateQueries(); } catch { /* seed failed, ignore */ }
              setSeeding(false);
            }} disabled={seeding}>
              {seeding ? 'Создание...' : 'Seed тестовые'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {stats.map((s, i) => (
          <GlassCard key={i} padding="md" hover>
            {isLoading ? (
              <Skeleton className="h-16" />
            ) : (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ background: s.color + '18', color: s.color }}>{s.icon}</div>
                <div>
                  <p className="text-2xl font-bold text-txt-primary">{s.value}</p>
                  <p className="text-xs text-txt-muted">{s.label}</p>
                </div>
              </div>
            )}
          </GlassCard>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card padding="md">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-semibold text-txt-primary">Последние исследования</h3>
            <Button variant="ghost" size="xs" icon={<ArrowRight size={14} />} onClick={() => navigate('/diagnostics/referrals')}>
              Все
            </Button>
          </div>
          {isLoading ? (
            <Skeleton className="h-40" />
          ) : recent.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-txt-muted text-sm flex-col gap-2">
              <FileText size={32} className="opacity-20" />
              Нет направлений. Создайте новое направление.
            </div>
          ) : (
            <div className="space-y-2">
              {recent.slice(0, 5).map((r: any) => (
                <div key={r.id} className="flex items-center gap-3 p-2 min-h-11 rounded-lg hover:bg-surface-1/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/diagnostics/referrals/${r.id}`)}>
                  <div className="w-8 h-8 rounded-lg bg-dv-gold/10 flex items-center justify-center text-dv-gold text-xs font-bold">
                    {r.patientName?.slice(0, 1) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-txt-primary truncate">{r.patientName}</p>
                    <p className="text-xs text-txt-muted">{r.studyType} · {r.clinic?.name}</p>
                  </div>
                  <span className="text-xs text-txt-ghost">{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card padding="md">
          <h3 className="text-sm font-semibold text-txt-primary mb-3">Быстрые действия</h3>
          <div className="space-y-2">
            <button onClick={() => navigate('/diagnostics/referrals/new')}
              className="w-full flex items-center gap-3 p-3 min-h-11 rounded-xl bg-dv-gold/5 border border-dv-gold/20 hover:bg-dv-gold/10 transition-colors text-left">
              <FileText size={18} className="text-dv-gold" />
              <div><p className="text-sm font-medium text-txt-primary">Создать направление</p><p className="text-xs text-txt-muted">3D или лаборатория</p></div>
            </button>
            <button onClick={() => navigate('/diagnostics/centers')}
              className="w-full flex items-center gap-3 p-3 min-h-11 rounded-xl bg-surface-1/50 border border-bdr-subtle hover:bg-surface-1 transition-colors text-left">
              <Activity size={18} className="text-info" />
              <div><p className="text-sm font-medium text-txt-primary">Найти диагностический центр</p><p className="text-xs text-txt-muted">Поиск по городу и исследованиям</p></div>
            </button>
            <button onClick={() => navigate('/diagnostics/results')}
              className="w-full flex items-center gap-3 p-3 min-h-11 rounded-xl bg-surface-1/50 border border-bdr-subtle hover:bg-surface-1 transition-colors text-left">
              <CheckCircle size={18} className="text-success" />
              <div><p className="text-sm font-medium text-txt-primary">Просмотреть результаты</p><p className="text-xs text-txt-muted">Готовые исследования</p></div>
            </button>
          </div>
        </Card>
      </div>
    </motion.div>
  );
}
