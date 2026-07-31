import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Building2, FileText, Clock, CheckCircle, XCircle, Search,
  PlayCircle, Activity, RefreshCw, Eye, DollarSign, Save, FlaskConical,
  Sparkles, Upload, TrendingUp, ArrowDown, Wallet, Plus, ReceiptText, Trash2, X,
} from 'lucide-react';
import { Tabs } from '@/components/ui/ds/Misc';
import { GlassCard } from '@/components/ui/ds/GlassCard';
import { Card } from '@/components/ui/ds/Card';
import { Button } from '@/components/ui/ds/Button';
import { Badge } from '@/components/ui/ds/Badge';
import { Skeleton } from '@/components/ui/ds/Skeleton';
import { Textarea } from '@/components/ui/ds/Input';
import { useToast } from '@/components/ui/ds/Toast';
import { queryKeys } from '@/queries/keys';
import { useAuth } from '@/store/auth.store';
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

const DIAG_CATEGORIES = ['CBCT', 'OPG', 'TRG', 'TMJ', 'STL', 'FACE_SCAN', 'DICOM', 'ALLERGY', 'HISTOLOGY', 'PCR', 'MICROBIOLOGY', 'BLOOD', 'GENETICS', 'BIOPSY', 'SALIVA', 'PATHOLOGY', 'OTHER'];

function CenterReferralsTab({ centerId }: { centerId: string }) {
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
    queryKey: queryKeys.diagnostics.referrals({ centerId, status: statusFilter, search, limit: '100' }),
    queryFn: () => api.getDiagnosticReferrals({ centerId, status: statusFilter, search, limit: '100' }),
    enabled: !!centerId,
  });

  const referrals = referralsData?.items || referralsData?.data || referralsData?.referrals || [];
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

  const stats = {
    total: referrals.length,
    sent: referrals.filter((r: any) => r.status === 'SENT').length,
    accepted: referrals.filter((r: any) => r.status === 'ACCEPTED').length,
    inProgress: referrals.filter((r: any) => r.status === 'IN_PROGRESS').length,
    completed: referrals.filter((r: any) => r.status === 'COMPLETED').length,
    cancelled: referrals.filter((r: any) => r.status === 'CANCELLED').length,
  };

  return (
    <div className="space-y-4">
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
          <div className="flex items-center gap-2"><DollarSign size={16} className="text-txt-muted" /><span className="text-xs text-txt-muted">Не оплачено</span></div>
          <p className="text-xl font-bold text-txt-primary mt-1">{referrals.filter((r: any) => !r.paid && r.status === 'COMPLETED').length}</p>
        </GlassCard>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по пациенту..." className="w-full bg-surface-1 border border-bdr-subtle rounded-lg pl-9 pr-3 py-2 text-sm text-txt-primary placeholder:text-txt-ghost focus:outline-none focus:ring-1 focus:ring-dv-gold" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold">
          <option value="">Все статусы</option>
          {Object.entries(STATUS_MAP).map(([key, v]) => (<option key={key} value={key}>{v.label}</option>))}
        </select>
        <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={() => refetch()}>Обновить</Button>
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
                  const statusInfo = STATUS_MAP[r.status] || { label: r.status, color: '#95A5A6' };
                  return (
                    <tr key={r.id} className="border-b border-bdr-subtle/50 hover:bg-surface-1/30 transition-colors">
                      <td className="py-2.5 pr-3">
                        <button onClick={() => navigate(`/diagnostics/referrals/${r.id}`)} className="font-medium text-txt-primary hover:text-dv-gold transition-colors">{r.patientName || 'Неизвестно'}</button>
                      </td>
                      <td className="py-2.5 pr-3 text-txt-muted">{r.studyType || '—'}</td>
                      <td className="py-2.5 pr-3 text-txt-muted">{r.clinic?.name || r.clinicName || '—'}</td>
                      <td className="py-2.5 pr-3">
                        {r.cost ? (
                          <span className="text-txt-primary">{Number(r.cost).toLocaleString()} ₸</span>
                        ) : <span className="text-txt-ghost">—</span>}
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge variant="outline" style={{ borderColor: statusInfo.color, color: statusInfo.color }}>{statusInfo.label}</Badge>
                        {r.paid && <Badge variant="filled" className="ml-1 bg-success/20 text-success text-2xs">Оплачено</Badge>}
                      </td>
                      <td className="py-2.5 pr-3 text-txt-muted">{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-1">
                          {r.status === 'SENT' && (
                            <Button size="xs" variant="primary" onClick={() => setCostModal(r.id)}>Принять</Button>
                          )}
                          {r.status === 'ACCEPTED' && (
                            <Button size="xs" variant="primary" onClick={() => statusMutation.mutate({ id: r.id, status: 'IN_PROGRESS' })}>Начать</Button>
                          )}
                          {r.status === 'IN_PROGRESS' && (
                            <Button size="xs" variant="primary" onClick={() => { setResultModal(r.id); setReportText(''); setConclusion(''); setResultFiles([]); }}>Результат</Button>
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

      {/* Cost modal */}
      {costModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setCostModal(null)}>
          <Card padding="lg" className="max-w-sm w-full mx-4" onClick={(e: any) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-txt-primary mb-4">Принять направление</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-txt-muted block mb-1">Стоимость услуги (₸)</label>
                <input type="number" value={costValue} onChange={(e) => setCostValue(e.target.value)} placeholder="Напр. 15000" className="w-full bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold" />
              </div>
              <div>
                <label className="text-xs text-txt-muted block mb-1">Комиссия платформы (₸, опционально)</label>
                <input type="number" value={feeValue} onChange={(e) => setFeeValue(e.target.value)} placeholder="Напр. 1500" className="w-full bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setCostModal(null)}>Отмена</Button>
                <Button variant="primary" size="sm" onClick={() => handleAccept(costModal)} disabled={!costValue || parseFloat(costValue) <= 0}>Принять</Button>
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
                  <Button variant="ghost" size="xs" icon={<Sparkles size={12} />} onClick={() => aiMutation.mutate(resultModal)} loading={aiMutation.isPending}>AI</Button>
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
                <Button variant="ghost" size="sm" onClick={() => setResultModal(null)}>Отмена</Button>
                <Button variant="primary" size="sm" onClick={() => signMutation.mutate(resultModal)} loading={signMutation.isPending} disabled={!reportText}>Отправить результат</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function CenterServicesTab({ centerId }: { centerId: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: studiesData, isLoading } = useQuery({
    queryKey: queryKeys.diagnostics.centerPricing(centerId),
    queryFn: () => api.getDiagnosticsCenterPricing(centerId),
    enabled: !!centerId,
  });

  const studies = Array.isArray(studiesData?.data) ? studiesData.data : [];
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', category: 'CBCT', price: '' });

  useEffect(() => {
    if (studies.length > 0) {
      const initial: Record<string, string> = {};
      studies.forEach((s: any) => { initial[s.id] = String(s.price || ''); });
      setPrices((prev) => Object.keys(initial).some((k) => initial[k] !== prev[k]) ? initial : prev);
    }
  }, [studies]);

  const saveMutation = useMutation({
    mutationFn: (data: { id: string; price: number }[]) => api.updateDiagnosticsCenterPricing(centerId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.diagnostics.centerPricing(centerId) }),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; category: string; price?: number }) => api.createDiagnosticsCenterStudy(centerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.diagnostics.centerPricing(centerId) });
      setAddOpen(false);
      setAddForm({ name: '', category: 'CBCT', price: '' });
      toast.success('Услуга добавлена');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSave = () => {
    const updates = Object.entries(prices)
      .filter(([, v]) => v !== '')
      .map(([id, price]) => ({ id, price: parseFloat(price) }));
    if (updates.length > 0) saveMutation.mutate(updates);
  };

  const handleCreate = () => {
    if (!addForm.name.trim()) { toast.error('Укажите название услуги'); return; }
    createMutation.mutate({ name: addForm.name.trim(), category: addForm.category, price: parseFloat(addForm.price) || 0 });
  };

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-txt-primary">Прайс-лист услуг</h3>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={() => setAddOpen(true)}>Добавить услугу</Button>
          <Button variant="primary" size="sm" icon={<Save size={14} />} onClick={handleSave} loading={saveMutation.isPending}>Сохранить</Button>
        </div>
      </div>
      {isLoading ? <Skeleton className="h-48" /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-txt-muted text-xs uppercase tracking-wider border-b border-bdr-subtle">
                <th className="pb-2 pr-3">Услуга</th>
                <th className="pb-2 pr-3">Категория</th>
                <th className="pb-2 pr-3">Цена (₸)</th>
                <th className="pb-2 pr-3">Статус</th>
              </tr>
            </thead>
            <tbody>
              {studies.map((s: any) => (
                <tr key={s.id} className="border-b border-bdr-subtle/50">
                  <td className="py-2.5 pr-3 font-medium text-txt-primary">{s.name}</td>
                  <td className="py-2.5 pr-3 text-txt-muted">{s.category}</td>
                  <td className="py-2.5 pr-3">
                    <input type="number" value={prices[s.id] ?? ''} onChange={(e) => setPrices((p: any) => ({ ...p, [s.id]: e.target.value }))} className="w-28 bg-surface-1 border border-bdr-subtle rounded-lg px-2 py-1 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold" />
                  </td>
                  <td className="py-2.5 pr-3"><Badge variant="outline" style={{ borderColor: s.active ? '#27AE60' : '#E74C3C', color: s.active ? '#27AE60' : '#E74C3C' }}>{s.active ? 'Активна' : 'Не активна'}</Badge></td>
                </tr>
              ))}
              {studies.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-txt-muted">Нет услуг. Добавьте первую услугу.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setAddOpen(false)}>
          <Card padding="lg" className="max-w-sm w-full mx-4" onClick={(e: any) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-txt-primary mb-4">Добавить услугу</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-txt-muted block mb-1">Название услуги</label>
                <input type="text" value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} placeholder="Напр. Конусно-лучевая КТ" className="w-full bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold" />
              </div>
              <div>
                <label className="text-xs text-txt-muted block mb-1">Категория</label>
                <select value={addForm.category} onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value }))} className="w-full bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold">
                  {DIAG_CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
              </div>
              <div>
                <label className="text-xs text-txt-muted block mb-1">Цена (₸)</label>
                <input type="number" value={addForm.price} onChange={(e) => setAddForm((f) => ({ ...f, price: e.target.value }))} placeholder="Напр. 15000" className="w-full bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setAddOpen(false)}>Отмена</Button>
                <Button variant="primary" size="sm" onClick={handleCreate} loading={createMutation.isPending} disabled={!addForm.name.trim()}>Добавить</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </Card>
  );
}

function CenterPaymentsTab({ centerId }: { centerId: string }) {
  const { data: paymentsData, isLoading } = useQuery({
    queryKey: queryKeys.diagnostics.centerPayments(centerId),
    queryFn: () => api.getDiagnosticsCenterPayments(centerId),
    enabled: !!centerId,
  });

  if (isLoading) return <Skeleton className="h-48" />;

  const referrals = paymentsData?.data?.referrals || [];
  const totals = paymentsData?.data?.totals || { totalRevenue: 0, totalFees: 0, paidCount: 0, unpaidCount: 0 };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <GlassCard padding="sm">
          <div className="flex items-center gap-2"><DollarSign size={16} className="text-success" /><span className="text-xs text-txt-muted">Выручка</span></div>
          <p className="text-xl font-bold text-txt-primary mt-1">{Number(totals.totalRevenue).toLocaleString()} ₸</p>
        </GlassCard>
        <GlassCard padding="sm">
          <div className="flex items-center gap-2"><Activity size={16} className="text-dv-gold" /><span className="text-xs text-txt-muted">Комиссия платформы</span></div>
          <p className="text-xl font-bold text-txt-primary mt-1">{Number(totals.totalFees).toLocaleString()} ₸</p>
        </GlassCard>
        <GlassCard padding="sm">
          <div className="flex items-center gap-2"><CheckCircle size={16} className="text-success" /><span className="text-xs text-txt-muted">Оплачено</span></div>
          <p className="text-xl font-bold text-txt-primary mt-1">{totals.paidCount}</p>
        </GlassCard>
        <GlassCard padding="sm">
          <div className="flex items-center gap-2"><Clock size={16} className="text-warning" /><span className="text-xs text-txt-muted">Ожидают оплаты</span></div>
          <p className="text-xl font-bold text-txt-primary mt-1">{totals.unpaidCount}</p>
        </GlassCard>
      </div>
      <Card padding="md">
        <h3 className="text-sm font-semibold text-txt-primary mb-3">История оплат</h3>
        {referrals.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-txt-muted text-sm">Нет завершённых направлений</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-txt-muted text-xs uppercase tracking-wider border-b border-bdr-subtle">
                  <th className="pb-2 pr-3">Пациент</th>
                  <th className="pb-2 pr-3">Услуга</th>
                  <th className="pb-2 pr-3">Стоимость</th>
                  <th className="pb-2 pr-3">Комиссия</th>
                  <th className="pb-2 pr-3">К выплате</th>
                  <th className="pb-2 pr-3">Статус</th>
                  <th className="pb-2 pr-3">Дата</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r: any) => {
                  const net = Number(r.cost || 0) - Number(r.platformFee || 0);
                  return (
                    <tr key={r.id} className="border-b border-bdr-subtle/50">
                      <td className="py-2.5 pr-3 text-txt-primary">{r.patientName}</td>
                      <td className="py-2.5 pr-3 text-txt-muted">{r.studyType || '—'}</td>
                      <td className="py-2.5 pr-3 text-txt-primary">{Number(r.cost || 0).toLocaleString()} ₸</td>
                      <td className="py-2.5 pr-3 text-txt-muted">{Number(r.platformFee || 0).toLocaleString()} ₸</td>
                      <td className="py-2.5 pr-3 text-success font-medium">{net.toLocaleString()} ₸</td>
                      <td className="py-2.5 pr-3">{r.paid ? <Badge variant="filled" className="bg-success/20 text-success">Оплачено</Badge> : <Badge variant="outline" className="text-warning border-warning">Ожидание</Badge>}</td>
                      <td className="py-2.5 pr-3 text-txt-muted">{new Date(r.createdAt).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function CenterCashierTab({ centerId }: { centerId: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: queryKeys.diagnostics.centerPayments(centerId),
    queryFn: () => api.getDiagnosticsCenterPayments(centerId),
    enabled: !!centerId,
  });

  const { data: studiesData, isLoading: studiesLoading } = useQuery({
    queryKey: queryKeys.diagnostics.centerPricing(centerId),
    queryFn: () => api.getDiagnosticsCenterPricing(centerId),
    enabled: !!centerId,
  });

  const referrals = (paymentsData?.data?.referrals || []).filter((r: any) => !r.paid);
  const studies = Array.isArray(studiesData?.data) ? studiesData.data.filter((s: any) => s.active) : [];

  const [selectedId, setSelectedId] = useState<string>('');
  const [cart, setCart] = useState<Array<{ studyId: string; name: string; price: number }>>([]);
  const [paidAmount, setPaidAmount] = useState('');
  const [feePercent, setFeePercent] = useState('10');

  const selected = referrals.find((r: any) => r.id === selectedId) || null;

  const baseCost = Number(selected?.cost || 0);
  const servicesTotal = cart.reduce((sum, c) => sum + Number(c.price || 0), 0);
  const total = baseCost + servicesTotal;
  const paid = parseFloat(paidAmount) || total;
  const fee = Math.round((paid * (parseFloat(feePercent) || 0)) / 100);
  const net = paid - fee;

  const pickReferral = (id: string) => {
    setSelectedId(id);
    setCart([]);
    setPaidAmount('');
  };

  const addToCart = (s: any) => {
    if (cart.some((c) => c.studyId === s.id)) return;
    setCart((prev) => [...prev, { studyId: s.id, name: s.name, price: Number(s.price || 0) }]);
  };

  const collectMutation = useMutation({
    mutationFn: (payload: { referralId: string; cost: number; platformFee: number }) =>
      api.collectDiagnosticsCashierPayment(centerId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.diagnostics.centerPayments(centerId) });
      queryClient.invalidateQueries({ queryKey: ['diagnostics'] });
      queryClient.invalidateQueries({ queryKey: ['diagnostics', 'center-dashboard', centerId] });
      toast.success(`Оплата ${paid.toLocaleString()} ₸ принята`);
      setSelectedId('');
      setCart([]);
      setPaidAmount('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (paymentsLoading || studiesLoading) return <Skeleton className="h-64" />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* Queue */}
      <div className="lg:col-span-2 space-y-3">
        <Card padding="md">
          <h3 className="text-sm font-semibold text-txt-primary mb-3">Очередь оплаты ({referrals.length})</h3>
          {referrals.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-txt-muted text-sm">Нет неоплаченных направлений</div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {referrals.map((r: any) => {
                const active = r.id === selectedId;
                return (
                  <button
                    key={r.id}
                    onClick={() => pickReferral(r.id)}
                    className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${active ? 'border-dv-gold bg-dv-gold/10' : 'border-bdr-subtle bg-surface-1/40 hover:border-dv-gold/40'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-txt-primary truncate">{r.patientName || 'Неизвестно'}</span>
                      <Badge variant="outline" className="text-txt-muted border-bdr-subtle shrink-0">{r.status}</Badge>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-xs text-txt-muted">
                      <span className="truncate">{r.studyType || '—'}</span>
                      <span className="font-semibold text-txt-primary shrink-0 ml-2">{Number(r.cost || 0).toLocaleString()} ₸</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {/* Service catalog */}
        <Card padding="md">
          <h3 className="text-sm font-semibold text-txt-primary mb-3">Услуги центра (добавить к оплате)</h3>
          {studies.length === 0 ? (
            <p className="text-sm text-txt-muted">Услуги не заданы. Добавьте их во вкладке «Услуги и цены».</p>
          ) : (
            <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
              {studies.map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => addToCart(s)}
                  disabled={cart.some((c) => c.studyId === s.id)}
                  className="w-full flex items-center justify-between gap-2 rounded-lg border border-bdr-subtle px-3 py-2 text-left hover:border-dv-gold/40 transition-colors disabled:opacity-40"
                >
                  <span className="text-sm text-txt-primary truncate">{s.name}</span>
                  <span className="text-sm font-semibold text-dv-gold shrink-0">{Number(s.price || 0).toLocaleString()} ₸</span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Check */}
      <div className="lg:col-span-3">
        <Card padding="lg" className="h-full">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[320px] text-center gap-2 text-txt-muted">
              <ReceiptText size={40} className="opacity-20" />
              <p className="text-sm">Выберите направление слева, чтобы начать приём оплаты</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-txt-primary">Касса — {selected.patientName || 'Пациент'}</h3>
                  <p className="text-xs text-txt-muted mt-0.5">{selected.studyType || 'Услуга'} · {new Date(selected.createdAt).toLocaleDateString()}</p>
                </div>
                <Badge variant="outline" className="text-dv-gold border-dv-gold/30">Чек</Badge>
              </div>

              <div className="space-y-1.5 mb-4">
                <div className="flex items-center justify-between text-sm py-1.5 border-b border-bdr-subtle/60">
                  <span className="text-txt-muted">Направление · {selected.studyType || '—'}</span>
                  <span className="text-txt-primary font-medium">{baseCost.toLocaleString()} ₸</span>
                </div>
                {cart.map((c) => (
                  <div key={c.studyId} className="flex items-center justify-between text-sm py-1.5 border-b border-bdr-subtle/60">
                    <span className="text-txt-muted">{c.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-txt-primary font-medium">{Number(c.price).toLocaleString()} ₸</span>
                      <button onClick={() => setCart((prev) => prev.filter((x) => x.studyId !== c.studyId))} className="text-txt-ghost hover:text-error transition-colors" aria-label="Убрать">
                        <X size={14} />
                      </button>
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm font-semibold pt-2">
                  <span className="text-txt-primary">Стоимость услуг</span>
                  <span className="text-txt-primary">{total.toLocaleString()} ₸</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs text-txt-muted block mb-1">Пациент платит (₸)</label>
                  <input type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder={String(total)} className="w-full bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold" />
                </div>
                <div>
                  <label className="text-xs text-txt-muted block mb-1">Комиссия платформы (%)</label>
                  <input type="number" value={feePercent} onChange={(e) => setFeePercent(e.target.value)} className="w-full bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold" />
                </div>
              </div>

              <div className="rounded-xl bg-surface-1 border border-bdr-subtle p-4 space-y-2 mb-4">
                <div className="flex justify-between text-sm"><span className="text-txt-muted">Принято от пациента</span><span className="text-txt-primary font-semibold">{paid.toLocaleString()} ₸</span></div>
                <div className="flex justify-between text-sm"><span className="text-txt-muted">Комиссия платформы</span><span className="text-dv-gold">{fee.toLocaleString()} ₸</span></div>
                <div className="flex justify-between text-sm border-t border-bdr-subtle pt-2"><span className="text-txt-primary font-semibold">К выплате центру</span><span className="text-success font-bold">{net.toLocaleString()} ₸</span></div>
              </div>

              <Button variant="primary" className="w-full" icon={<Wallet size={16} />} loading={collectMutation.isPending} disabled={paid <= 0} onClick={() => collectMutation.mutate({ referralId: selected.id, cost: paid, platformFee: fee })}>
                Принять оплату {paid.toLocaleString()} ₸
              </Button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function CenterFinanceTab({ centerId }: { centerId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['diagnostics', 'center-dashboard', centerId],
    queryFn: () => api.getDiagnosticsCenterDashboard(centerId),
    enabled: !!centerId,
  });

  if (isLoading) return <Skeleton className="h-64" />;
  const d = data?.data || data || {};

  const fmt = (n: number) => Number(n || 0).toLocaleString('ru-RU') + ' ₸';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <GlassCard padding="sm">
          <div className="flex items-center gap-2"><TrendingUp size={16} className="text-success" /><span className="text-xs text-txt-muted">Доход сегодня</span></div>
          <p className="text-xl font-bold text-txt-primary mt-1">{fmt(d.revenue?.today)}</p>
          <p className="text-xs text-txt-muted">Комиссия: {fmt(d.commissions?.today)}</p>
        </GlassCard>
        <GlassCard padding="sm">
          <div className="flex items-center gap-2"><TrendingUp size={16} className="text-info" /><span className="text-xs text-txt-muted">Доход за неделю</span></div>
          <p className="text-xl font-bold text-txt-primary mt-1">{fmt(d.revenue?.week)}</p>
          <p className="text-xs text-txt-muted">Чистый: {fmt(d.netRevenue?.week)}</p>
        </GlassCard>
        <GlassCard padding="sm">
          <div className="flex items-center gap-2"><TrendingUp size={16} className="text-dv-gold" /><span className="text-xs text-txt-muted">Доход за месяц</span></div>
          <p className="text-xl font-bold text-txt-primary mt-1">{fmt(d.revenue?.month)}</p>
          <p className="text-xs text-txt-muted">Выполнено: {d.completedCount || 0} направлений</p>
        </GlassCard>
        <GlassCard padding="sm">
          <div className="flex items-center gap-2"><DollarSign size={16} className="text-warning" /><span className="text-xs text-txt-muted">Не оплачено</span></div>
          <p className="text-xl font-bold text-txt-primary mt-1">{d.paymentStats?.unpaid || 0}</p>
          <p className="text-xs text-txt-muted">Оплачено: {d.paymentStats?.paid || 0}</p>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card padding="md">
          <h3 className="text-sm font-semibold text-txt-primary mb-3">Сводка по году</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-txt-muted">Общий доход</span><span className="text-txt-primary font-semibold">{fmt(d.revenue?.year)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-txt-muted">Комиссия платформы</span><span className="text-txt-primary">{fmt(d.commissions?.year)}</span></div>
            <div className="flex justify-between text-sm border-t border-bdr-subtle pt-2"><span className="text-txt-muted">Чистый доход центра</span><span className="text-success font-semibold">{fmt(d.netRevenue?.year)}</span></div>
          </div>
        </Card>
        <Card padding="md">
          <h3 className="text-sm font-semibold text-txt-primary mb-3">Статусы направлений</h3>
          <div className="grid grid-cols-2 gap-2">
            {(d.byStatus ? Object.entries(d.byStatus as Record<string, number>).sort(([,a],[,b]) => (b as number) - (a as number)) : []).map(([status, count]) => {
              const statusInfo = STATUS_MAP[status] || { label: status, color: '#95A5A6' };
              return (
                <div key={status} className="flex justify-between items-center p-2 rounded-lg bg-surface-1 border border-bdr-subtle">
                  <span className="text-xs" style={{ color: statusInfo.color }}>{statusInfo.label}</span>
                  <span className="text-sm font-semibold text-txt-primary">{count as number}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function CenterDashboard() {
  const { user } = useAuth();
  const isOwnOrg = user?.organizationType === 'DIAGNOSTIC_CENTER';
  const ownOrgId = user?.organizationId || '';
  const [centerId, setCenterId] = useState<string>(isOwnOrg ? ownOrgId : '');
  const [activeTab, setActiveTab] = useState('referrals');

  const { data: centersData } = useQuery({
    queryKey: queryKeys.diagnostics.centers(),
    queryFn: () => api.getDiagnosticCenters(),
    enabled: !isOwnOrg,
  });

  const centers = centersData?.data || centersData || [];

  useEffect(() => {
    if (isOwnOrg && ownOrgId) setCenterId(ownOrgId);
  }, [isOwnOrg, ownOrgId]);

  const tabs = [
    { id: 'cashier', label: 'Касса', icon: <Wallet size={14} /> },
    { id: 'referrals', label: 'Направления', icon: <FileText size={14} /> },
    { id: 'finance', label: 'Финансы', icon: <TrendingUp size={14} /> },
    { id: 'services', label: 'Услуги и цены', icon: <FlaskConical size={14} /> },
    { id: 'payments', label: 'Оплаты', icon: <DollarSign size={14} /> },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-txt-primary">Панель диагностического центра</h1>
          <p className="text-sm text-txt-muted mt-0.5">Управление направлениями, услугами и оплатами</p>
        </div>
      </div>

      {!isOwnOrg && (
        <Card padding="md">
          <div className="flex items-center gap-3">
            <Building2 size={18} className="text-dv-gold shrink-0" />
            <select value={centerId} onChange={(e) => setCenterId(e.target.value)} className="flex-1 bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold">
              <option value="">Выберите диагностический центр</option>
              {centers.map((c: any) => (<option key={c.id} value={c.id}>{c.name} — {c.city}</option>))}
            </select>
          </div>
        </Card>
      )}

      {centerId && (
        <>
          <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
          {activeTab === 'cashier' && <CenterCashierTab centerId={centerId} />}
          {activeTab === 'referrals' && <CenterReferralsTab centerId={centerId} />}
          {activeTab === 'finance' && <CenterFinanceTab centerId={centerId} />}
          {activeTab === 'services' && <CenterServicesTab centerId={centerId} />}
          {activeTab === 'payments' && <CenterPaymentsTab centerId={centerId} />}
        </>
      )}
    </motion.div>
  );
}
