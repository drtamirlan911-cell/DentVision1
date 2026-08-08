import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wallet, Search, ReceiptText, Plus, Trash2, X, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/ds/Card';
import { GlassCard } from '@/components/ui/ds/GlassCard';
import { Button } from '@/components/ui/ds/Button';
import { Badge } from '@/components/ui/ds/Badge';
import { Skeleton } from '@/components/ui/ds/Skeleton';
import { useToast } from '@/components/ui/ds/Toast';
import { queryKeys } from '@/queries/keys';
import * as api from '@/utils/api';
import type { TabProps } from './types';

export function CashierTab({ config, orgId }: TabProps) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['diagnostics', 'payments', config.kind, orgId],
    queryFn: () => config.getPayments(orgId),
    enabled: !!orgId,
  });

  const { data: studiesData, isLoading: studiesLoading } = useQuery({
    queryKey: ['diagnostics', 'pricing', config.kind, orgId],
    queryFn: () => config.getPricing(orgId),
    enabled: !!orgId,
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
      config.collectPayment(orgId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diagnostics', 'payments', config.kind, orgId] });
      queryClient.invalidateQueries({ queryKey: ['diagnostics'] });
      queryClient.invalidateQueries({ queryKey: ['diagnostics', 'center-dashboard', orgId] });
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
                    className={`w-full min-h-11 text-left rounded-xl border px-3 py-2.5 transition-colors ${active ? 'border-dv-gold bg-dv-gold/10' : 'border-bdr-subtle bg-surface-1/40 hover:border-dv-gold/40'}`}
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
                  className="w-full min-h-11 flex items-center justify-between gap-2 rounded-lg border border-bdr-subtle px-3 py-2 text-left hover:border-dv-gold/40 transition-colors disabled:opacity-40"
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
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
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
                      <button onClick={() => setCart((prev) => prev.filter((x) => x.studyId !== c.studyId))} className="min-h-11 w-8 flex items-center justify-center text-txt-ghost hover:text-error transition-colors" aria-label="Убрать">
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
                  <input type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder={String(total)} className="w-full min-h-11 bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold" />
                </div>
                <div>
                  <label className="text-xs text-txt-muted block mb-1">Комиссия платформы (%)</label>
                  <input type="number" value={feePercent} onChange={(e) => setFeePercent(e.target.value)} className="w-full min-h-11 bg-surface-1 border border-bdr-subtle rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-1 focus:ring-dv-gold" />
                </div>
              </div>

              <div className="rounded-xl bg-surface-1 border border-bdr-subtle p-4 space-y-2 mb-4">
                <div className="flex justify-between text-sm"><span className="text-txt-muted">Принято от пациента</span><span className="text-txt-primary font-semibold">{paid.toLocaleString()} ₸</span></div>
                <div className="flex justify-between text-sm"><span className="text-txt-muted">Комиссия платформы</span><span className="text-dv-gold">{fee.toLocaleString()} ₸</span></div>
                <div className="flex justify-between text-sm border-t border-bdr-subtle pt-2"><span className="text-txt-primary font-semibold">К выплате центру</span><span className="text-success font-bold">{net.toLocaleString()} ₸</span></div>
              </div>

              <Button variant="primary" className="w-full min-h-11" icon={<Wallet size={16} />} loading={collectMutation.isPending} disabled={paid <= 0} onClick={() => collectMutation.mutate({ referralId: selected.id, cost: paid, platformFee: fee })}>
                Принять оплату {paid.toLocaleString()} ₸
              </Button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
