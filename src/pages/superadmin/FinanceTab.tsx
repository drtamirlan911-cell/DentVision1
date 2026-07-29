import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  StatCard, PageHeader, GlassCard, Card, Button, Badge, Modal,
  Input, Select, EmptyState, Skeleton, Pagination,
} from '../../components/ui/ds';
import { useToast } from '../../components/ui/ds/Toast';
import { AreaChartComponent, DonutChartComponent } from '../../components/charts';
import * as api from '../../utils/api';
import {
  DollarSign, Wallet, ArrowUpDown, AlertTriangle, Check, X, Search, Plus,
  RefreshCw, Shield, Activity, TrendingUp, CreditCard, Eye,
} from 'lucide-react';

const fd = (d: string) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('ru-RU'); } catch { return d; }
};

const fmtKzt = (n: number) => (Number(n) || 0).toLocaleString('ru-RU') + ' ₸';

const TX_PAGE_SIZE = 20;

const TX_TYPE_OPTIONS = [
  { value: '', label: 'Все типы' },
  { value: 'CREDIT', label: 'Приход' },
  { value: 'DEBIT', label: 'Расход' },
  { value: 'COMMISSION', label: 'Комиссия' },
  { value: 'REFUND', label: 'Возврат' },
];

const TX_STATUS_OPTIONS = [
  { value: '', label: 'Все статусы' },
  { value: 'COMPLETED', label: 'Завершена' },
  { value: 'PENDING', label: 'Ожидает' },
  { value: 'FAILED', label: 'Ошибка' },
  { value: 'CANCELLED', label: 'Отменена' },
];

const DISPUTE_STATUS_OPTIONS = [
  { value: '', label: 'Все' },
  { value: 'OPEN', label: 'Открыт' },
  { value: 'REVIEW', label: 'На рассмотрении' },
  { value: 'RESOLVED', label: 'Решён' },
  { value: 'REJECTED', label: 'Отклонён' },
];

const TX_STATUS_BADGE: Record<string, 'success' | 'error' | 'warning' | 'info' | 'default'> = {
  COMPLETED: 'success',
  PENDING: 'warning',
  FAILED: 'error',
  CANCELLED: 'error',
};

const TX_STATUS_LABEL: Record<string, string> = {
  COMPLETED: 'Завершена',
  PENDING: 'Ожидает',
  FAILED: 'Ошибка',
  CANCELLED: 'Отменена',
};

const TX_TYPE_LABEL: Record<string, string> = {
  CREDIT: 'Приход',
  DEBIT: 'Расход',
  COMMISSION: 'Комиссия',
  REFUND: 'Возврат',
};

const DISPUTE_STATUS_BADGE: Record<string, 'success' | 'error' | 'warning' | 'gold'> = {
  OPEN: 'warning',
  REVIEW: 'gold',
  RESOLVED: 'success',
  REJECTED: 'error',
};

const DISPUTE_STATUS_LABEL: Record<string, string> = {
  OPEN: 'Открыт',
  REVIEW: 'На рассмотрении',
  RESOLVED: 'Решён',
  REJECTED: 'Отклонён',
};

type SubTab = 'overview' | 'transactions' | 'wallets' | 'commissions' | 'disputes' | 'ledger';

const SUB_TABS: { id: SubTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Обзор', icon: <Activity size={14} /> },
  { id: 'transactions', label: 'Транзакции', icon: <ArrowUpDown size={14} /> },
  { id: 'wallets', label: 'Кошельки', icon: <Wallet size={14} /> },
  { id: 'commissions', label: 'Комиссии', icon: <TrendingUp size={14} /> },
  { id: 'disputes', label: 'Споры', icon: <AlertTriangle size={14} /> },
  { id: 'ledger', label: 'Леджер', icon: <Shield size={14} /> },
];

const WALLET_ICONS: Record<string, typeof DollarSign> = {
  platform: DollarSign,
  seller: CreditCard,
  gateway: Shield,
};

export default function FinanceTab() {
  const toast = useToast();
  const qc = useQueryClient();

  const [subTab, setSubTab] = useState<SubTab>('overview');
  const [txPage, setTxPage] = useState(1);
  const [txType, setTxType] = useState('');
  const [txStatus, setTxStatus] = useState('');
  const [txSearch, setTxSearch] = useState('');
  const [txDateFrom, setTxDateFrom] = useState('');
  const [txDateTo, setTxDateTo] = useState('');

  const [manualModal, setManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({ walletId: '', type: 'CREDIT' as 'CREDIT' | 'DEBIT', amount: '', description: '' });

  const [commModal, setCommModal] = useState(false);
  const [commEdit, setCommEdit] = useState<any>(null);
  const [commForm, setCommForm] = useState({ name: '', percent: '', targetType: 'PLATFORM', description: '' });

  const [disputeDetail, setDisputeDetail] = useState<any>(null);

  const report = useQuery({ queryKey: ['finance', 'report'], queryFn: () => api.getFinanceReport(), staleTime: 30_000 });

  const txParams: Record<string, string> = { page: String(txPage), limit: String(TX_PAGE_SIZE) };
  if (txType) txParams.type = txType;
  if (txStatus) txParams.status = txStatus;
  if (txSearch) txParams.search = txSearch;
  if (txDateFrom) txParams.from = txDateFrom;
  if (txDateTo) txParams.to = txDateTo;

  const transactions = useQuery({
    queryKey: ['finance', 'transactions', txParams],
    queryFn: () => apiFetch('/api/finance/transactions?' + new URLSearchParams(txParams).toString()),
    staleTime: 10_000,
  });

  const wallets = useQuery({
    queryKey: ['finance', 'wallets'],
    queryFn: () => apiFetch('/api/finance/wallets'),
    staleTime: 30_000,
  });

  const commissionRules = useQuery({
    queryKey: ['finance', 'commission-rules'],
    queryFn: () => apiFetch('/api/finance/commission-rules'),
    staleTime: 30_000,
  });

  const disputes = useQuery({
    queryKey: ['finance', 'disputes'],
    queryFn: () => apiFetch('/api/disputes'),
    staleTime: 10_000,
  });

  const ledgerHealth = useQuery({
    queryKey: ['finance', 'ledger-health'],
    queryFn: () => apiFetch('/api/finance/ledger/health'),
    staleTime: 30_000,
  });

  const createManualTx = useMutation({
    mutationFn: api.createManualTransaction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance', 'transactions'] });
      qc.invalidateQueries({ queryKey: ['finance', 'wallets'] });
      toast.success('Транзакция создана');
      setManualModal(false);
      setManualForm({ walletId: '', type: 'CREDIT', amount: '', description: '' });
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка создания транзакции'),
  });

  const createCommRule = useMutation({
    mutationFn: (data: any) => apiFetch('/api/finance/commission-rules', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance', 'commission-rules'] });
      toast.success('Правило создано');
      setCommModal(false);
      setCommForm({ name: '', percent: '', targetType: 'PLATFORM', description: '' });
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка'),
  });

  const updateCommRule = useMutation({
    mutationFn: ({ id, ...rest }: any) => apiFetch(`/api/finance/commission-rules/${id}`, { method: 'PUT', body: JSON.stringify(rest) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance', 'commission-rules'] });
      toast.success('Правило обновлено');
      setCommModal(false);
      setCommEdit(null);
      setCommForm({ name: '', percent: '', targetType: 'PLATFORM', description: '' });
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка'),
  });

  const updateDispute = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiFetch(`/api/disputes/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance', 'disputes'] });
      toast.success('Статус спора обновлён');
      setDisputeDetail(null);
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка'),
  });

  const API_URL: string = (import.meta as any).env?.VITE_API_URL || (window.location.hostname.includes('vercel.app') ? 'https://dentvision-api.onrender.com' : 'http://localhost:3001');

  async function apiFetch(path: string, options: RequestInit = {}): Promise<any> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as Record<string, string>) };
    const token = api.getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_URL}${path}`, { ...options, headers, credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
  }

  const reportData: any = report.data || {};
  const txData: any = transactions.data || {};
  const txList: any[] = Array.isArray(txData.data) ? txData.data : (Array.isArray(txData) ? txData : []);
  const txTotal: number = txData.total || txList.length;
  const txTotalPages = Math.max(1, Math.ceil(txTotal / TX_PAGE_SIZE));

  const walletRaw: any = wallets.data;
  const walletList: any[] = Array.isArray(walletRaw) ? walletRaw : (walletRaw?.data || []);
  const commRaw: any = commissionRules.data;
  const commList: any[] = Array.isArray(commRaw) ? commRaw : (commRaw?.data || []);
  const disputeRaw: any = disputes.data;
  const disputeList: any[] = Array.isArray(disputeRaw) ? disputeRaw : (disputeRaw?.data || []);
  const ledgerData: any = ledgerHealth.data || {};

  const totalTransactions = reportData.totalTransactions ?? txTotal;
  const platformBalance = reportData.platformBalance ?? walletList.find((w: any) => (w.type || '').toLowerCase() === 'platform')?.balance ?? 0;
  const totalCommissions = reportData.totalCommissions ?? 0;
  const disputesCount = reportData.disputesCount ?? disputeList.filter((d: any) => d.status === 'OPEN' || d.status === 'REVIEW').length;

  const chartData = (reportData.dailyTransactions || []).map((d: any) => ({
    date: fd(d.date || d.createdAt),
    amount: d.amount || d.total || 0,
  }));

  const txTypeDonutData = (() => {
    const counts: Record<string, number> = {};
    txList.forEach((t: any) => { const k = t.type || 'OTHER'; counts[k] = (counts[k] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name: TX_TYPE_LABEL[name] || name, value }));
  })();

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ['finance'] });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance Management"
        subtitle="Финансы и биллинг платформы"
        icon={<DollarSign size={20} />}
        actions={
          <Button icon={<RefreshCw size={16} />} variant="ghost" onClick={refreshAll}>Обновить</Button>
        }
      />

      <div className="flex gap-1 bg-surface-2 rounded-lg p-1 overflow-x-auto">
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${subTab === t.id ? 'bg-surface-1 text-txt-primary shadow-sm' : 'text-txt-muted hover:text-txt-secondary'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {subTab === 'overview' && (
        <div className="space-y-6">
          {report.isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Транзакции" value={totalTransactions} icon={<ArrowUpDown size={18} />} />
              <StatCard label="Баланс платформы" value={fmtKzt(platformBalance)} icon={<Wallet size={18} />} />
              <StatCard label="Комиссии" value={fmtKzt(totalCommissions)} icon={<TrendingUp size={18} />} />
              <StatCard label="Споры" value={disputesCount} icon={<AlertTriangle size={18} />} />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <GlassCard padding="md" className="lg:col-span-2">
              <h3 className="text-sm font-semibold text-txt-primary mb-4">Транзакции по дням</h3>
              {chartData.length > 0 ? (
                <AreaChartComponent data={chartData} xKey="date" yKey="amount" height={240} formatter={(v: number) => fmtKzt(v)} />
              ) : (
                <div className="flex items-center justify-center h-[240px] text-txt-muted text-sm">Нет данных</div>
              )}
            </GlassCard>
            <GlassCard padding="md">
              <h3 className="text-sm font-semibold text-txt-primary mb-4">По типам</h3>
              {txTypeDonutData.length > 0 ? (
                <DonutChartComponent data={txTypeDonutData} height={240} />
              ) : (
                <div className="flex items-center justify-center h-[240px] text-txt-muted text-sm">Нет данных</div>
              )}
            </GlassCard>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <GlassCard padding="md">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#22C55E]/10 text-[#22C55E]"><Check size={18} /></div>
                <div>
                  <p className="text-lg font-bold text-txt-primary">{reportData.completedTransactions ?? 0}</p>
                  <p className="text-xs text-txt-muted">Завершённых транзакций</p>
                </div>
              </div>
            </GlassCard>
            <GlassCard padding="md">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#F59E0B]/10 text-[#F59E0B]"><AlertTriangle size={18} /></div>
                <div>
                  <p className="text-lg font-bold text-txt-primary">{reportData.pendingTransactions ?? 0}</p>
                  <p className="text-xs text-txt-muted">Ожидающих</p>
                </div>
              </div>
            </GlassCard>
            <GlassCard padding="md">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-dv-gold/10 text-dv-gold"><DollarSign size={18} /></div>
                <div>
                  <p className="text-lg font-bold text-txt-primary">{fmtKzt(reportData.revenue ?? 0)}</p>
                  <p className="text-xs text-txt-muted">Выручка</p>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {subTab === 'transactions' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 justify-end items-end">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-txt-muted" />
              <input value={txSearch} onChange={e => { setTxSearch(e.target.value); setTxPage(1); }} placeholder="Поиск..."
                className="pl-8 pr-3 py-1.5 rounded-lg bg-surface-2 border border-bdr-subtle text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-1 focus:ring-dv-gold/50 w-48" />
            </div>
            <Select value={txType} onChange={e => { setTxType(e.target.value); setTxPage(1); }} options={TX_TYPE_OPTIONS} size="sm" className="w-auto min-w-[130px]" />
            <Select value={txStatus} onChange={e => { setTxStatus(e.target.value); setTxPage(1); }} options={TX_STATUS_OPTIONS} size="sm" className="w-auto min-w-[130px]" />
            <input type="date" value={txDateFrom} onChange={e => { setTxDateFrom(e.target.value); setTxPage(1); }}
              className="px-3 py-1.5 rounded-lg bg-surface-2 border border-bdr-subtle text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold/50" />
            <input type="date" value={txDateTo} onChange={e => { setTxDateTo(e.target.value); setTxPage(1); }}
              className="px-3 py-1.5 rounded-lg bg-surface-2 border border-bdr-subtle text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold/50" />
            <Button icon={<Plus size={16} />} onClick={() => setManualModal(true)}>Транзакция</Button>
          </div>

          {transactions.isLoading ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : txList.length === 0 ? (
            <EmptyState icon={<ArrowUpDown size={40} />} title="Нет транзакций" description="Транзакции появятся здесь после создания" />
          ) : (
            <>
              <Card padding="none">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-bdr-subtle">
                        {['ID', 'Тип', 'Сумма', 'Статус', 'Описание', 'Дата', ''].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-bold text-txt-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {txList.map((tx: any) => (
                        <tr key={tx.id} className="border-b border-bdr-subtle/50 hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3">
                            <span className="text-xs text-txt-muted font-mono">{(tx.id || '').slice(0, 8)}...</span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={tx.type === 'CREDIT' ? 'success' : tx.type === 'DEBIT' ? 'error' : 'info'} size="sm">
                              {TX_TYPE_LABEL[tx.type] || tx.type}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-semibold ${tx.type === 'CREDIT' ? 'text-[#22C55E]' : tx.type === 'DEBIT' ? 'text-[#EF4444]' : 'text-txt-primary'}`}>
                              {tx.type === 'CREDIT' ? '+' : '-'}{fmtKzt(tx.amount)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={TX_STATUS_BADGE[tx.status] || 'default'} size="sm" dot>
                              {TX_STATUS_LABEL[tx.status] || tx.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-txt-secondary max-w-[200px] truncate">{tx.description || '—'}</td>
                          <td className="px-4 py-3 text-xs text-txt-muted">{fd(tx.createdAt)}</td>
                          <td className="px-4 py-3">
                            <Button size="icon-sm" variant="ghost" onClick={() => setDisputeDetail(tx)} title="Подробнее"><Eye size={14} /></Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              <div className="flex justify-center">
                <Pagination page={txPage} totalPages={txTotalPages} onPageChange={setTxPage} />
              </div>
            </>
          )}
        </div>
      )}

      {subTab === 'wallets' && (
        <div className="space-y-4">
          {wallets.isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
            </div>
          ) : walletList.length === 0 ? (
            <EmptyState icon={<Wallet size={40} />} title="Нет кошельков" description="Кошельки появятся после создания транзакций" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {walletList.map((w: any) => {
                const Icon = WALLET_ICONS[(w.type || '').toLowerCase()] || Wallet;
                return (
                  <GlassCard key={w.id || w.type} padding="md">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 rounded-lg bg-dv-gold/10 text-dv-gold"><Icon size={18} /></div>
                      <div>
                        <p className="text-sm font-semibold text-txt-primary">{w.name || w.type || 'Кошелёк'}</p>
                        <p className="text-xs text-txt-muted">{w.currency || 'KZT'}</p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-dv-gold">{fmtKzt(w.balance || 0)}</p>
                    <div className="mt-2 flex gap-4 text-xs text-txt-muted">
                      <span>Приход: {fmtKzt(w.totalCredit || 0)}</span>
                      <span>Расход: {fmtKzt(w.totalDebit || 0)}</span>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}

          {walletList.length > 0 && (
            <Card padding="md">
              <h3 className="text-sm font-semibold text-txt-primary mb-3">Детали кошельков</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-bdr-subtle">
                      {['Кошелёк', 'Тип', 'Баланс', 'Приход', 'Расход', 'Обновлён'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-txt-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {walletList.map((w: any) => {
                      const Icon = WALLET_ICONS[(w.type || '').toLowerCase()] || Wallet;
                      return (
                        <tr key={w.id || w.type} className="border-b border-bdr-subtle/50 hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Icon size={14} className="text-dv-gold" />
                              <span className="text-sm text-txt-primary">{w.name || w.id || '—'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="info" size="sm">{w.type || '—'}</Badge>
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-dv-gold">{fmtKzt(w.balance || 0)}</td>
                          <td className="px-4 py-3 text-sm text-[#22C55E]">{fmtKzt(w.totalCredit || 0)}</td>
                          <td className="px-4 py-3 text-sm text-[#EF4444]">{fmtKzt(w.totalDebit || 0)}</td>
                          <td className="px-4 py-3 text-xs text-txt-muted">{fd(w.updatedAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {subTab === 'commissions' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button icon={<Plus size={16} />} onClick={() => { setCommEdit(null); setCommForm({ name: '', percent: '', targetType: 'PLATFORM', description: '' }); setCommModal(true); }}>Правило</Button>
          </div>

          {commissionRules.isLoading ? (
            <Skeleton className="h-48 rounded-xl" />
          ) : commList.length === 0 ? (
            <EmptyState icon={<TrendingUp size={40} />} title="Нет правил комиссий" description="Создайте первое правило комиссии" action={<Button icon={<Plus size={16} />} onClick={() => { setCommEdit(null); setCommForm({ name: '', percent: '', targetType: 'PLATFORM', description: '' }); setCommModal(true); }}>Создать правило</Button>} />
          ) : (
            <Card padding="none">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-bdr-subtle">
                      {['Название', 'Процент', 'Тип', 'Описание', 'Действия'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-txt-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {commList.map((rule: any) => (
                      <tr key={rule.id} className="border-b border-bdr-subtle/50 hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <TrendingUp size={14} className="text-dv-gold" />
                            <span className="text-sm font-semibold text-txt-primary">{rule.name || '—'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="gold" size="sm">{rule.percent ?? rule.rate ?? '—'}%</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="info" size="sm">{rule.targetType || rule.type || 'PLATFORM'}</Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-txt-secondary max-w-[200px] truncate">{rule.description || '—'}</td>
                        <td className="px-4 py-3">
                          <Button size="icon-sm" variant="ghost" onClick={() => {
                            setCommEdit(rule);
                            setCommForm({ name: rule.name || '', percent: String(rule.percent ?? rule.rate ?? ''), targetType: rule.targetType || 'PLATFORM', description: rule.description || '' });
                            setCommModal(true);
                          }} title="Редактировать"><Eye size={14} /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {subTab === 'disputes' && (
        <div className="space-y-4">
          {disputes.isLoading ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : disputeList.length === 0 ? (
            <EmptyState icon={<AlertTriangle size={40} />} title="Нет споров" description="Споры появятся здесь после обращений пользователей" />
          ) : (
            <Card padding="none">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-bdr-subtle">
                      {['ID', 'Тема', 'Статус', 'Сумма', 'Дата', 'Действия'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-txt-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {disputeList.map((d: any) => (
                      <tr key={d.id} className="border-b border-bdr-subtle/50 hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <span className="text-xs text-txt-muted font-mono">{(d.id || '').slice(0, 8)}...</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-semibold text-txt-primary">{d.subject || d.title || d.reason || '—'}</div>
                          {d.description && <div className="text-xs text-txt-muted mt-0.5 max-w-[240px] truncate">{d.description}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={DISPUTE_STATUS_BADGE[d.status] || 'default'} size="sm" dot>
                            {DISPUTE_STATUS_LABEL[d.status] || d.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-txt-primary">{d.amount ? fmtKzt(d.amount) : '—'}</td>
                        <td className="px-4 py-3 text-xs text-txt-muted">{fd(d.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <Button size="icon-sm" variant="ghost" onClick={() => setDisputeDetail(d)} title="Подробнее"><Eye size={14} /></Button>
                            {d.status === 'OPEN' && (
                              <Button size="icon-sm" variant="outline" onClick={() => updateDispute.mutate({ id: d.id, status: 'REVIEW' })} title="На рассмотрение" loading={updateDispute.isPending}>
                                <RefreshCw size={14} />
                              </Button>
                            )}
                            {d.status === 'REVIEW' && (
                              <>
                                <Button size="icon-sm" variant="success" onClick={() => updateDispute.mutate({ id: d.id, status: 'RESOLVED' })} title="Решить" loading={updateDispute.isPending}>
                                  <Check size={14} />
                                </Button>
                                <Button size="icon-sm" variant="danger" onClick={() => updateDispute.mutate({ id: d.id, status: 'REJECTED' })} title="Отклонить" loading={updateDispute.isPending}>
                                  <X size={14} />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {subTab === 'ledger' && (
        <div className="space-y-4">
          {ledgerHealth.isLoading ? (
            <Skeleton className="h-48 rounded-xl" />
          ) : (
            <>
              <GlassCard padding="md">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 rounded-lg ${ledgerData.healthy || ledgerData.balanced ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#EF4444]/10 text-[#EF4444]'}`}>
                    <Shield size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-txt-primary">Леджер: {ledgerData.healthy || ledgerData.balanced ? 'В норме' : 'Проблемы'}</h3>
                    <p className="text-xs text-txt-muted">{ledgerData.message || (ledgerData.healthy || ledgerData.balanced ? 'Двойная балансировка соблюдена' : 'Обнаружены расхождения')}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg bg-surface-2 border border-bdr-subtle">
                    <p className="text-xs text-txt-muted mb-1">Всего записей</p>
                    <p className="text-lg font-bold text-txt-primary">{ledgerData.totalEntries ?? ledgerData.total ?? '—'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-2 border border-bdr-subtle">
                    <p className="text-xs text-txt-muted mb-1">Дебет итого</p>
                    <p className="text-lg font-bold text-[#EF4444]">{ledgerData.totalDebit != null ? fmtKzt(ledgerData.totalDebit) : '—'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-2 border border-bdr-subtle">
                    <p className="text-xs text-txt-muted mb-1">Кредит итого</p>
                    <p className="text-lg font-bold text-[#22C55E]">{ledgerData.totalCredit != null ? fmtKzt(ledgerData.totalCredit) : '—'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-2 border border-bdr-subtle">
                    <p className="text-xs text-txt-muted mb-1">Разница</p>
                    <p className={`text-lg font-bold ${(ledgerData.difference ?? 0) === 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                      {ledgerData.difference != null ? fmtKzt(ledgerData.difference) : '—'}
                    </p>
                  </div>
                </div>
              </GlassCard>

              {Array.isArray(ledgerData.accounts) && ledgerData.accounts.length > 0 && (
                <Card padding="none">
                  <div className="px-4 py-3 border-b border-bdr-subtle">
                    <h3 className="text-sm font-semibold text-txt-primary">Счета леджера</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-bdr-subtle">
                          {['Счёт', 'Дебет', 'Кредит', 'Баланс'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-bold text-txt-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ledgerData.accounts.map((a: any, idx: number) => (
                          <tr key={idx} className="border-b border-bdr-subtle/50 hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3 text-sm text-txt-primary">{a.name || a.account || '—'}</td>
                            <td className="px-4 py-3 text-sm text-[#EF4444]">{fmtKzt(a.debit || 0)}</td>
                            <td className="px-4 py-3 text-sm text-[#22C55E]">{fmtKzt(a.credit || 0)}</td>
                            <td className="px-4 py-3">
                              <Badge variant={(a.balance ?? 0) >= 0 ? 'success' : 'error'} size="sm">{fmtKzt(a.balance || 0)}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {Array.isArray(ledgerData.anomalies) && ledgerData.anomalies.length > 0 && (
                <Card padding="md">
                  <h3 className="text-sm font-semibold text-[#EF4444] mb-3 flex items-center gap-2"><AlertTriangle size={14} /> Аномалии</h3>
                  <div className="space-y-2">
                    {ledgerData.anomalies.map((a: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-[#EF4444]/5 border border-[#EF4444]/20">
                        <AlertTriangle size={14} className="text-[#EF4444] shrink-0" />
                        <span className="text-sm text-txt-secondary">{a.message || a.description || JSON.stringify(a)}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <div className="flex justify-center">
                <Button icon={<RefreshCw size={16} />} variant="ghost" onClick={() => ledgerHealth.refetch()}>Проверить леджер</Button>
              </div>
            </>
          )}
        </div>
      )}

      <Modal open={manualModal} onClose={() => setManualModal(false)} title="Ручная транзакция">
        <form onSubmit={e => {
          e.preventDefault();
          if (!manualForm.walletId.trim()) { toast.warn('Выберите кошелёк'); return; }
          if (!manualForm.amount || Number(manualForm.amount) <= 0) { toast.warn('Укажите сумму'); return; }
          if (!manualForm.description.trim()) { toast.warn('Укажите описание'); return; }
          createManualTx.mutate({
            walletId: manualForm.walletId,
            type: manualForm.type,
            amount: Number(manualForm.amount),
            description: manualForm.description,
          });
        }} className="space-y-4">
          <Select label="Кошелёк *" value={manualForm.walletId} onChange={e => setManualForm({ ...manualForm, walletId: e.target.value })}
            options={[{ value: '', label: 'Выберите кошелёк' }, ...walletList.map((w: any) => ({ value: w.id, label: `${w.name || w.type} (${fmtKzt(w.balance || 0)})` }))]} />
          <Select label="Тип *" value={manualForm.type} onChange={e => setManualForm({ ...manualForm, type: e.target.value as 'CREDIT' | 'DEBIT' })}
            options={[{ value: 'CREDIT', label: 'Приход (CREDIT)' }, { value: 'DEBIT', label: 'Расход (DEBIT)' }]} />
          <Input label="Сумма (₸) *" type="number" min="0" step="100" value={manualForm.amount} onChange={e => setManualForm({ ...manualForm, amount: e.target.value })} placeholder="0" />
          <Input label="Описание *" value={manualForm.description} onChange={e => setManualForm({ ...manualForm, description: e.target.value })} placeholder="Описание транзакции" />
          <div className="flex gap-2 pt-2">
            <Button type="submit" loading={createManualTx.isPending}>Создать</Button>
            <Button type="button" variant="ghost" onClick={() => setManualModal(false)}>Отмена</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!commModal} onClose={() => { setCommModal(false); setCommEdit(null); }} title={commEdit ? 'Редактировать правило' : 'Новое правило комиссии'}>
        <form onSubmit={e => {
          e.preventDefault();
          if (!commForm.name.trim()) { toast.warn('Укажите название'); return; }
          if (!commForm.percent || Number(commForm.percent) <= 0) { toast.warn('Укажите процент'); return; }
          const payload = { name: commForm.name, percent: Number(commForm.percent), targetType: commForm.targetType, description: commForm.description };
          if (commEdit) updateCommRule.mutate({ id: commEdit.id, ...payload });
          else createCommRule.mutate(payload);
        }} className="space-y-4">
          <Input label="Название *" value={commForm.name} onChange={e => setCommForm({ ...commForm, name: e.target.value })} placeholder="Название правила" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Процент (%) *" type="number" step="0.01" min="0" max="100" value={commForm.percent} onChange={e => setCommForm({ ...commForm, percent: e.target.value })} placeholder="5.00" />
            <Select label="Тип" value={commForm.targetType} onChange={e => setCommForm({ ...commForm, targetType: e.target.value })}
              options={[{ value: 'PLATFORM', label: 'Платформа' }, { value: 'SELLER', label: 'Продавец' }, { value: 'CATEGORY', label: 'Категория' }]} />
          </div>
          <Input label="Описание" value={commForm.description} onChange={e => setCommForm({ ...commForm, description: e.target.value })} placeholder="Описание правила" />
          <div className="flex gap-2 pt-2">
            <Button type="submit" loading={createCommRule.isPending || updateCommRule.isPending}>{commEdit ? 'Сохранить' : 'Создать'}</Button>
            <Button type="button" variant="ghost" onClick={() => { setCommModal(false); setCommEdit(null); }}>Отмена</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!disputeDetail} onClose={() => setDisputeDetail(null)} title="Детали" size="lg">
        {disputeDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-txt-muted mb-1">ID</p>
                <p className="text-sm font-mono text-txt-primary">{disputeDetail.id || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-txt-muted mb-1">Статус</p>
                <Badge variant={TX_STATUS_BADGE[disputeDetail.status] || DISPUTE_STATUS_BADGE[disputeDetail.status] || 'default'} size="md" dot>
                  {TX_STATUS_LABEL[disputeDetail.status] || DISPUTE_STATUS_LABEL[disputeDetail.status] || disputeDetail.status}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-txt-muted mb-1">Тип</p>
                <p className="text-sm text-txt-primary">{TX_TYPE_LABEL[disputeDetail.type] || disputeDetail.type || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-txt-muted mb-1">Сумма</p>
                <p className="text-sm font-semibold text-dv-gold">{disputeDetail.amount ? fmtKzt(disputeDetail.amount) : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-txt-muted mb-1">Создано</p>
                <p className="text-sm text-txt-secondary">{fd(disputeDetail.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-txt-muted mb-1">Обновлено</p>
                <p className="text-sm text-txt-secondary">{fd(disputeDetail.updatedAt)}</p>
              </div>
            </div>
            {(disputeDetail.description || disputeDetail.subject || disputeDetail.title || disputeDetail.reason) && (
              <div>
                <p className="text-xs text-txt-muted mb-1">Описание</p>
                <p className="text-sm text-txt-secondary">{disputeDetail.description || disputeDetail.subject || disputeDetail.title || disputeDetail.reason}</p>
              </div>
            )}
            {disputeDetail.walletId && (
              <div>
                <p className="text-xs text-txt-muted mb-1">Кошелёк</p>
                <p className="text-sm text-txt-secondary font-mono">{disputeDetail.walletId}</p>
              </div>
            )}
            {disputeDetail.refType && (
              <div>
                <p className="text-xs text-txt-muted mb-1">Ссылка</p>
                <p className="text-sm text-txt-secondary">{disputeDetail.refType}{disputeDetail.refId ? ` / ${disputeDetail.refId}` : ''}</p>
              </div>
            )}
            <div className="flex justify-end pt-2">
              <Button variant="ghost" onClick={() => setDisputeDetail(null)}>Закрыть</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
