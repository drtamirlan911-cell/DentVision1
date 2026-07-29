import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Users, FileText, Search, ChevronRight, Calendar, Activity } from 'lucide-react';
import { GlassCard } from '@/components/ui/ds/GlassCard';
import { Card } from '@/components/ui/ds/Card';
import { Badge } from '@/components/ui/ds/Badge';
import { Skeleton } from '@/components/ui/ds/Skeleton';
import { queryKeys } from '@/queries/keys';
import * as api from '@/utils/api';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  SENT: { label: 'Отправлено', color: '#3498DB' },
  ACCEPTED: { label: 'Принято', color: '#F39C12' },
  IN_PROGRESS: { label: 'В работе', color: '#C9A96E' },
  COMPLETED: { label: 'Завершено', color: '#27AE60' },
  REVIEWED: { label: 'Просмотрено', color: '#95A5A6' },
  CANCELLED: { label: 'Отменено', color: '#E74C3C' },
};

export default function DiagnosticPatients() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.diagnostics.referrals({ limit: '500' }),
    queryFn: () => api.getDiagnosticReferrals({ limit: '500' }),
  });

  const patients = useMemo(() => {
    const referrals = data?.items || data?.data || data?.referrals || [];
    const map = new Map();
    for (const r of referrals) {
      const key = r.patientId || r.patientName;
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, { id: r.patientId, name: r.patientName || 'Неизвестно', phone: r.patientPhone, iin: r.patientIin, referrals: [] });
      }
      map.get(key).referrals.push(r);
    }
    return Array.from(map.values());
  }, [data]);

  const filtered = search
    ? patients.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.phone || '').includes(search))
    : patients;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-txt-primary">Пациенты диагностики</h1>
        <p className="text-sm text-txt-muted mt-0.5">Все пациенты, которым назначались исследования</p>
      </div>

      <div className="relative max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по имени или телефону..."
          className="w-full bg-surface-1 border border-bdr-subtle rounded-lg pl-9 pr-3 py-2 text-sm text-txt-primary placeholder:text-txt-ghost focus:outline-none focus:ring-1 focus:ring-dv-gold" />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}</div>
      ) : filtered.length === 0 ? (
        <GlassCard padding="md">
          <div className="flex items-center justify-center h-40 text-txt-muted text-sm flex-col gap-2">
            <Users size={48} className="opacity-20" />
            {search ? 'Ничего не найдено' : 'Нет пациентов'}
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-2">
          {filtered.map((p: any) => {
            const lastRef = p.referrals[p.referrals.length - 1];
            const activeCount = p.referrals.filter((r: any) => r.status === 'IN_PROGRESS' || r.status === 'ACCEPTED').length;
            return (
              <Card key={p.id || p.name} padding="md" hover className="cursor-pointer" onClick={() => navigate(`/diagnostics/referrals/${lastRef?.id}`)}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-dv-gold/10 flex items-center justify-center text-dv-gold text-sm font-bold shrink-0">
                    {p.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-txt-primary">{p.name}</p>
                    <p className="text-xs text-txt-muted">
                      {p.phone && `${p.phone}`}{p.iin ? ` · ${p.iin}` : ''} · {p.referrals.length} направлений
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeCount > 0 && (
                      <Badge variant="outline" style={{ borderColor: '#F39C12', color: '#F39C12' }}>
                        {activeCount} активн.
                      </Badge>
                    )}
                    <ChevronRight size={16} className="text-txt-muted" />
                  </div>
                </div>
                {p.referrals.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.referrals.slice(-3).map((r: any) => {
                      const si = STATUS_MAP[r.status] || { label: r.status, color: '#95A5A6' };
                      return (
                        <span key={r.id} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: si.color + '18', color: si.color }}>
                          {r.studyType || r.labTestType || 'Исследование'}
                        </span>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
