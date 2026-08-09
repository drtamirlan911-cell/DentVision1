import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, FlaskConical, CheckCircle, XCircle, Clock, Search, Shield } from 'lucide-react';
import { GlassCard } from '@/components/ui/ds/GlassCard';
import { Card } from '@/components/ui/ds/Card';
import { Button } from '@/components/ui/ds/Button';
import { Badge } from '@/components/ui/ds/Badge';
import { Skeleton } from '@/components/ui/ds/Skeleton';
import { PageHeader } from '@/components/ui/ds/StatCard';
import * as api from '@/utils/api';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Ожидает', color: '#F39C12' },
  APPROVED: { label: 'Подтверждён', color: '#27AE60' },
  REJECTED: { label: 'Отклонён', color: '#E74C3C' },
};

export default function RegistrationRequests() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [rejectModal, setRejectModal] = useState<{ id: string; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['registrations', statusFilter],
    queryFn: () => api.getDiagnosticsRegistrations(statusFilter || undefined),
  });

  const requests = data?.data || data || [];

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.approveDiagnosticsRegistration(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['registrations'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => api.rejectDiagnosticsRegistration(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registrations'] });
      setRejectModal(null);
      setRejectReason('');
    },
  });

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-6 space-y-6 max-w-full overflow-x-hidden">
      <PageHeader
        title="Заявки на регистрацию"
        subtitle="Центры и лаборатории, ожидающие подтверждения"
        icon={<Shield size={22} />}
      />

      <div className="flex flex-wrap items-center gap-2">
        {['', 'PENDING', 'APPROVED', 'REJECTED'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-11 ${
              statusFilter === s ? 'bg-dv-gold text-dv-gold-on' : 'bg-surface-1 text-txt-muted hover:text-txt-primary'
            }`}>
            {s ? STATUS_CONFIG[s]?.label : 'Все'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}</div>
      ) : requests.length === 0 ? (
        <GlassCard padding="md">
          <div className="flex items-center justify-center h-40 text-txt-muted text-sm flex-col gap-2">
            <Shield size={48} className="opacity-20" />
            Нет заявок
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {requests.map((r: any) => {
            const sc = STATUS_CONFIG[r.status] || { label: r.status, color: '#95A5A6' };
            return (
              <Card key={r.id} padding="md">
                <div className="flex flex-wrap items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    r.type === 'center' ? 'bg-dv-gold/10' : 'bg-purple-500/10'
                  }`}>
                    {r.type === 'center'
                      ? <Building2 size={20} className="text-dv-gold" />
                      : <FlaskConical size={20} className="text-purple-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-txt-primary">{r.name}</p>
                      <Badge variant="outline" style={{ borderColor: sc.color, color: sc.color, fontSize: 10 }}>{sc.label}</Badge>
                    </div>
                    <p className="text-xs text-txt-muted mt-0.5">
                      {r.city && `${r.city}`}{r.address ? `, ${r.address}` : ''}
                      {r.phone && ` · ${r.phone}`}
                    </p>
                    {r.comment && <p className="text-xs text-txt-muted mt-1 italic">"{r.comment}"</p>}
                    {r.reviewNote && <p className="text-xs text-danger mt-1">Причина: {r.reviewNote}</p>}
                    <p className="text-xs text-txt-ghost mt-1">{new Date(r.createdAt).toLocaleString()}</p>
                  </div>
                  {r.status === 'PENDING' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="xs" variant="primary" className="min-h-11" onClick={() => approveMutation.mutate(r.id)}
                        disabled={approveMutation.isPending}>
                        <CheckCircle size={14} className="mr-1" />Подтвердить
                      </Button>
                      <Button size="xs" variant="ghost" className="min-h-11" onClick={() => setRejectModal({ id: r.id, name: r.name })}>
                        <XCircle size={14} className="mr-1" />Отклонить
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setRejectModal(null)}>
          <Card padding="lg" className="w-full max-w-sm max-h-[90vh] overflow-y-auto mx-4" onClick={(e: any) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-txt-primary mb-2">Отклонить заявку</h3>
            <p className="text-sm text-txt-muted mb-3">{rejectModal.name}</p>
            <div>
              <label className="text-xs text-txt-muted block mb-1">Причина отклонения</label>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3}
                className="w-full bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold resize-none" />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setRejectModal(null)}>Отмена</Button>
              <Button variant="danger" onClick={() => rejectMutation.mutate({ id: rejectModal.id, reason: rejectReason })}
                disabled={rejectMutation.isPending}>
                Отклонить
              </Button>
            </div>
          </Card>
        </div>
      )}
    </motion.div>
  );
}
