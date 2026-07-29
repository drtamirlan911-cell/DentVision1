import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Building2, FileText, Clock, CheckCircle, XCircle, Search,
  PlayCircle, Activity, RefreshCw, Eye,
} from 'lucide-react';
import { GlassCard } from '@/components/ui/ds/GlassCard';
import { Card } from '@/components/ui/ds/Card';
import { Button } from '@/components/ui/ds/Button';
import { Badge } from '@/components/ui/ds/Badge';
import { Skeleton } from '@/components/ui/ds/Skeleton';
import { queryKeys } from '@/queries/keys';
import * as api from '@/utils/api';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  SENT: { label: 'Отправлено', color: '#3498DB' },
  RECEIVED: { label: 'Получено', color: '#9B59B6' },
  ACCEPTED: { label: 'Принято', color: '#F39C12' },
  IN_PROGRESS: { label: 'В работе', color: '#C9A96E' },
  COMPLETED: { label: 'Завершено', color: '#27AE60' },
  REVIEWED: { label: 'Просмотрено', color: '#95A5A6' },
  CANCELLED: { label: 'Отменено', color: '#E74C3C' },
};

export default function CenterDashboard() {
  const navigate = useNavigate();
  const [selectedCenterId, setSelectedCenterId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: centersData } = useQuery({
    queryKey: queryKeys.diagnostics.centers(),
    queryFn: () => api.getDiagnosticCenters(),
  });

  const centers = centersData?.data || centersData || [];

  const { data: referralsData, isLoading, refetch } = useQuery({
    queryKey: queryKeys.diagnostics.referrals({ centerId: selectedCenterId, status: statusFilter, search, limit: '100' }),
    queryFn: () => api.getDiagnosticReferrals({ centerId: selectedCenterId, status: statusFilter, search, limit: '100' }),
    enabled: !!selectedCenterId,
  });

  const referrals = referralsData?.items || referralsData?.data || referralsData?.referrals || [];
  const total = referralsData?.total || referrals.length;

  const selectedCenter = centers.find((c: any) => c.id === selectedCenterId);

  const stats = {
    total: referrals.length,
    sent: referrals.filter((r: any) => r.status === 'SENT').length,
    accepted: referrals.filter((r: any) => r.status === 'ACCEPTED').length,
    inProgress: referrals.filter((r: any) => r.status === 'IN_PROGRESS').length,
    completed: referrals.filter((r: any) => r.status === 'COMPLETED').length,
    cancelled: referrals.filter((r: any) => r.status === 'CANCELLED').length,
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await api.changeDiagnosticReferralStatus(id, status);
      refetch();
    } catch (err) {
      console.error('Status change failed', err);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-txt-primary">Панель диагностического центра</h1>
          <p className="text-sm text-txt-muted mt-0.5">Управление входящими направлениями</p>
        </div>
        <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={() => refetch()}>
          Обновить
        </Button>
      </div>

      {/* Center selector */}
      <Card padding="md">
        <div className="flex items-center gap-3">
          <Building2 size={18} className="text-dv-gold shrink-0" />
          <select
            value={selectedCenterId}
            onChange={(e) => setSelectedCenterId(e.target.value)}
            className="flex-1 bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold"
          >
            <option value="">Выберите диагностический центр</option>
            {centers.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name} — {c.city}</option>
            ))}
          </select>
        </div>
      </Card>

      {selectedCenterId && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <GlassCard padding="sm">
              <div className="flex items-center gap-2"><Activity size={16} className="text-info" /><span className="text-xs text-txt-muted">Всего</span></div>
              <p className="text-xl font-bold text-txt-primary mt-1">{stats.total}</p>
            </GlassCard>
            <GlassCard padding="sm">
              <div className="flex items-center gap-2"><FileText size={16} className="text-info" /><span className="text-xs text-txt-muted">Отправлено</span></div>
              <p className="text-xl font-bold text-txt-primary mt-1">{stats.sent}</p>
            </GlassCard>
            <GlassCard padding="sm">
              <div className="flex items-center gap-2"><Clock size={16} className="text-warning" /><span className="text-xs text-txt-muted">Принято</span></div>
              <p className="text-xl font-bold text-txt-primary mt-1">{stats.accepted}</p>
            </GlassCard>
            <GlassCard padding="sm">
              <div className="flex items-center gap-2"><PlayCircle size={16} className="text-dv-gold" /><span className="text-xs text-txt-muted">В работе</span></div>
              <p className="text-xl font-bold text-txt-primary mt-1">{stats.inProgress}</p>
            </GlassCard>
            <GlassCard padding="sm">
              <div className="flex items-center gap-2"><CheckCircle size={16} className="text-success" /><span className="text-xs text-txt-muted">Завершено</span></div>
              <p className="text-xl font-bold text-txt-primary mt-1">{stats.completed}</p>
            </GlassCard>
            <GlassCard padding="sm">
              <div className="flex items-center gap-2"><XCircle size={16} className="text-danger" /><span className="text-xs text-txt-muted">Отменено</span></div>
              <p className="text-xl font-bold text-txt-primary mt-1">{stats.cancelled}</p>
            </GlassCard>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по пациенту..."
                className="w-full bg-surface-1 border border-bdr-subtle rounded-lg pl-9 pr-3 py-2 text-sm text-txt-primary placeholder:text-txt-ghost focus:outline-none focus:ring-1 focus:ring-dv-gold"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold"
            >
              <option value="">Все статусы</option>
              {Object.entries(STATUS_MAP).map(([key, v]) => (
                <option key={key} value={key}>{v.label}</option>
              ))}
            </select>
          </div>

          {/* Referrals table */}
          <Card padding="md">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-txt-primary">Направления ({total})</h3>
            </div>
            {isLoading ? (
              <Skeleton className="h-64" />
            ) : referrals.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-txt-muted text-sm flex-col gap-2">
                <FileText size={32} className="opacity-20" />
                Нет направлений для этого центра
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-txt-muted text-xs uppercase tracking-wider border-b border-bdr-subtle">
                      <th className="pb-2 pr-3">Пациент</th>
                      <th className="pb-2 pr-3">Исследование</th>
                      <th className="pb-2 pr-3">Клиника</th>
                      <th className="pb-2 pr-3">Статус</th>
                      <th className="pb-2 pr-3">Дата</th>
                      <th className="pb-2 pr-3">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.map((r: any) => {
                      const statusInfo = STATUS_MAP[r.status] || { label: r.status, color: '#95A5A6' };
                      return (
                        <tr key={r.id} className="border-b border-bdr-subtle/50 hover:bg-surface-1/30 transition-colors">
                          <td className="py-2.5 pr-3">
                            <button onClick={() => navigate(`/diagnostics/referrals/${r.id}`)} className="font-medium text-txt-primary hover:text-dv-gold transition-colors">
                              {r.patientName || 'Неизвестно'}
                            </button>
                          </td>
                          <td className="py-2.5 pr-3 text-txt-muted">{r.studyType || '—'}</td>
                          <td className="py-2.5 pr-3 text-txt-muted">{r.clinic?.name || r.clinicName || '—'}</td>
                          <td className="py-2.5 pr-3">
                            <Badge variant="outline" style={{ borderColor: statusInfo.color, color: statusInfo.color }}>
                              {statusInfo.label}
                            </Badge>
                          </td>
                          <td className="py-2.5 pr-3 text-txt-muted">{new Date(r.createdAt).toLocaleDateString()}</td>
                          <td className="py-2.5 pr-3">
                            <div className="flex items-center gap-1">
                              {r.status === 'SENT' && (
                                <Button size="xs" variant="primary" onClick={() => handleStatusChange(r.id, 'ACCEPTED')}>
                                  Принять
                                </Button>
                              )}
                              {r.status === 'ACCEPTED' && (
                                <Button size="xs" variant="primary" onClick={() => handleStatusChange(r.id, 'IN_PROGRESS')}>
                                  Начать
                                </Button>
                              )}
                              {r.status === 'IN_PROGRESS' && (
                                <Button size="xs" variant="primary" onClick={() => handleStatusChange(r.id, 'COMPLETED')}>
                                  Завершить
                                </Button>
                              )}
                              <Button size="xs" variant="ghost" icon={<Eye size={14} />} aria-label="View" onClick={() => navigate(`/diagnostics/referrals/${r.id}`)} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {!selectedCenterId && (
        <div className="flex items-center justify-center h-40 text-txt-muted text-sm flex-col gap-2">
          <Building2 size={48} className="opacity-20" />
          Выберите диагностический центр для просмотра направлений
        </div>
      )}
    </motion.div>
  );
}
