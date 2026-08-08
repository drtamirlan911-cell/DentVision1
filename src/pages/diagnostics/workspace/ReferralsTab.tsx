import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { FileText, Search, RefreshCw, Eye, Sparkles, Upload, X } from 'lucide-react';
import { Card } from '@/components/ui/ds/Card';
import { Button } from '@/components/ui/ds/Button';
import { Badge } from '@/components/ui/ds/Badge';
import { Skeleton } from '@/components/ui/ds/Skeleton';
import { Textarea } from '@/components/ui/ds/Input';
import { useToast } from '@/components/ui/ds/Toast';
import { queryKeys } from '@/queries/keys';
import { REFERRAL_STATUS, statusInfo, type PhaseId } from '@/lib/referralStatus';
import * as api from '@/utils/api';
import type { TabProps } from './types';
import { StatusPill } from './Pipeline';

export function ReferralsTab({ config, orgId, phaseFilter, onClearPhase }: TabProps & {
  phaseFilter?: PhaseId | null
  onClearPhase?: () => void
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [costModal, setCostModal] = useState<string | null>(null);
  const [costValue, setCostValue] = useState('');
  const [feeValue, setFeeValue] = useState('');
  const [resultModal, setResultModal] = useState<string | null>(null);
  const [reportText, setReportText] = useState('');
  const [conclusion, setConclusion] = useState('');
  const [resultFiles, setResultFiles] = useState<File[]>([]);
  const toast = useToast();

  const { data: referralsData, isLoading, refetch } = useQuery({
    queryKey: queryKeys.diagnostics.referrals({ ...config.referralScope(orgId), status: statusFilter, search, limit: '100' }),
    queryFn: () => api.getDiagnosticReferrals({ ...config.referralScope(orgId), status: statusFilter, search, limit: '100' }),
    enabled: !!orgId,
  });

  const allReferrals = referralsData?.items || referralsData?.data || referralsData?.referrals || [];
  const referrals = phaseFilter
    ? allReferrals.filter((r: any) => statusInfo(r.status).phase === phaseFilter)
    : allReferrals;
  const total = referralsData?.total || referrals.length;

  const statusMutation = useMutation({
    mutationFn: ({ id, status, cost, platformFee }: { id: string; status: string; cost?: number; platformFee?: number }) =>
      api.changeDiagnosticReferralStatus(id, status, undefined, { cost, platformFee }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['diagnostics'] }); refetch(); setCostModal(null); },
  });

  const aiMutation = useMutation({
    mutationFn: (referralId: string) => api.aiGenerateDiagnosticResult(referralId),
    onSuccess: (res: any) => { setReportText(res?.data?.reportText || ''); toast.success('AI-заключение сгенерировано'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const signMutation = useMutation({
    mutationFn: async (referralId: string) => {
      await api.signDiagnosticResult(referralId, reportText, conclusion || undefined);
      for (const file of resultFiles) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        await api.uploadDiagnosticFile({ referralId, fileName: file.name, fileData: base64, fileType: file.type, fileSize: file.size });
      }
    },
    onSuccess: (_, referralId) => {
      statusMutation.mutate({ id: referralId, status: 'COMPLETED' });
      setResultModal(null); setReportText(''); setConclusion(''); setResultFiles([]);
      toast.success('Результат отправлен');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleAccept = (id: string) => {
    const cost = parseFloat(costValue);
    const fee = parseFloat(feeValue);
    if (!cost || cost <= 0) return;
    statusMutation.mutate({ id, status: 'ACCEPTED', cost, platformFee: fee > 0 ? fee : undefined });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по пациенту..." className="w-full min-h-11 bg-surface-1 border border-bdr-subtle rounded-lg pl-9 pr-3 py-2 text-sm text-txt-primary placeholder:text-txt-ghost focus:outline-none focus:ring-1 focus:ring-dv-gold" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="min-h-11 bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold">
          <option value="">Все статусы</option>
          {Object.entries(REFERRAL_STATUS).map(([key, info]) => (<option key={key} value={key}>{info.label}</option>))}
        </select>
        <Button variant="ghost" size="sm" className="min-h-11" icon={<RefreshCw size={14} />} onClick={() => refetch()}>Обновить</Button>
      </div>

      {/* Referrals table */}
      <Card padding="md">
        <h3 className="text-sm font-semibold text-txt-primary mb-3">Направления ({total})</h3>
        {isLoading ? <Skeleton className="h-64" /> : referrals.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-txt-muted text-sm flex-col gap-2">
            <FileText size={32} className="opacity-20" />Нет направлений
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-txt-muted text-xs uppercase tracking-wider border-b border-bdr-subtle">
                  <th className="pb-2 pr-3">Пациент</th>
                  <th className="pb-2 pr-3">Исследование</th>
                  <th className="pb-2 pr-3">Клиника</th>
                  <th className="pb-2 pr-3">Стоимость</th>
                  <th className="pb-2 pr-3">Статус</th>
                  <th className="pb-2 pr-3">Дата</th>
                  <th className="pb-2 pr-3">Действия</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r: any) => {
                  return (
                    <tr key={r.id} className="border-b border-bdr-subtle/50 hover:bg-surface-1/30 transition-colors">
                      <td className="py-2.5 pr-3">
                        <button onClick={() => navigate(`/diagnostics/referrals/${r.id}`)} className="min-h-11 flex items-center font-medium text-txt-primary hover:text-dv-gold transition-colors">{r.patientName || 'Неизвестно'}</button>
                      </td>
                      <td className="py-2.5 pr-3 text-txt-muted">{r.studyType || '—'}</td>
                      <td className="py-2.5 pr-3 text-txt-muted">{r.clinic?.name || r.clinicName || '—'}</td>
                      <td className="py-2.5 pr-3">
                        {r.cost ? (
                          <span className="text-txt-primary">{Number(r.cost).toLocaleString()} ₸</span>
                        ) : <span className="text-txt-ghost">—</span>}
                      </td>
                      <td className="py-2.5 pr-3">
                        <StatusPill status={r.status} />
                        {r.paid && <Badge variant="filled" className="ml-1 bg-success/20 text-success text-2xs">Оплачено</Badge>}
                      </td>
                      <td className="py-2.5 pr-3 text-txt-muted">{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-1">
                          {r.status === 'SENT' && (
                            <Button size="xs" variant="primary" className="min-h-11" onClick={() => setCostModal(r.id)}>Принять</Button>
                          )}
                          {r.status === 'ACCEPTED' && (
                            <Button size="xs" variant="primary" className="min-h-11" onClick={() => statusMutation.mutate({ id: r.id, status: 'IN_PROGRESS' })}>Начать</Button>
                          )}
                          {r.status === 'IN_PROGRESS' && (
                            <Button size="xs" variant="primary" className="min-h-11" onClick={() => { setResultModal(r.id); setReportText(''); setConclusion(''); setResultFiles([]); }}>Результат</Button>
                          )}
                          <Button size="xs" variant="ghost" className="min-h-11" icon={<Eye size={14} />} aria-label="View" onClick={() => navigate(`/diagnostics/referrals/${r.id}`)} />
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

      {/* Cost modal */}
      {costModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setCostModal(null)}>
          <Card padding="lg" className="max-w-sm w-full mx-4" onClick={(e: any) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-txt-primary mb-4">Принять направление</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-txt-muted block mb-1">Стоимость услуги (₸)</label>
                <input type="number" value={costValue} onChange={(e) => setCostValue(e.target.value)} placeholder="Напр. 15000" className="w-full min-h-11 bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold" />
              </div>
              <div>
                <label className="text-xs text-txt-muted block mb-1">Комиссия платформы (₸, опционально)</label>
                <input type="number" value={feeValue} onChange={(e) => setFeeValue(e.target.value)} placeholder="Напр. 1500" className="w-full min-h-11 bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" className="min-h-11" onClick={() => setCostModal(null)}>Отмена</Button>
                <Button variant="primary" size="sm" className="min-h-11" onClick={() => handleAccept(costModal)} disabled={!costValue || parseFloat(costValue) <= 0}>Принять</Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Result modal */}
      {resultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setResultModal(null)}>
          <Card padding="lg" className="max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e: any) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-txt-primary mb-4">Отправить результат</h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-txt-muted">Заключение / Описание результата</label>
                  <Button variant="ghost" size="xs" className="min-h-11" icon={<Sparkles size={12} />} onClick={() => aiMutation.mutate(resultModal)} loading={aiMutation.isPending}>AI</Button>
                </div>
                <Textarea value={reportText} onChange={(e) => setReportText(e.target.value)} rows={6} placeholder="Введите заключение или сгенерируйте AI" />
              </div>
              <div>
                <label className="text-xs text-txt-muted block mb-1">Вывод (опционально)</label>
                <Textarea value={conclusion} onChange={(e) => setConclusion(e.target.value)} rows={2} placeholder="Краткий вывод" />
              </div>
              <div>
                <label className="text-xs text-txt-muted block mb-1">Файлы результатов</label>
                <div className="border border-dashed border-bdr-subtle rounded-lg p-4 text-center">
                  <input type="file" multiple accept="image/*,.pdf,.dcm" onChange={(e) => setResultFiles(Array.from(e.target.files || []))} className="hidden" id="result-files" />
                  <label htmlFor="result-files" className="cursor-pointer flex flex-col items-center gap-1 text-txt-muted hover:text-txt-primary">
                    <Upload size={24} className="opacity-40" />
                    <span className="text-xs">Нажмите для загрузки файлов</span>
                  </label>
                  {resultFiles.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {resultFiles.map((f, i) => <Badge key={i} variant="outline" size="sm">{f.name}</Badge>)}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" className="min-h-11" onClick={() => setResultModal(null)}>Отмена</Button>
                <Button variant="primary" size="sm" className="min-h-11" onClick={() => signMutation.mutate(resultModal)} loading={signMutation.isPending} disabled={!reportText}>Отправить результат</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
