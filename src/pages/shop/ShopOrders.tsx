import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Package, Clock, Truck, QrCode } from 'lucide-react';
import { tg } from '../../utils/constants';
import * as api from '../../utils/api';
import { useAuth } from '@/store/auth.store';
import { useToast } from '../../components/ui/ds/Toast';
import { Card, CardContent } from '../../components/ui/ds/Card';
import { Badge } from '../../components/ui/ds/Badge';
import { Button } from '../../components/ui/ds/Button';
import { PageHeader } from '../../components/ui/ds/StatCard';
import { EmptyState } from '../../components/ui/ds/EmptyState';
import { PaymentQrPanel } from '@/components/payments/PaymentQrPanel';
import { extractPaymentQrUrl } from '@/utils/paymentQr';

const STATUS: Record<string, { label: string; variant: 'success' | 'warning' | 'info' | 'error' }> = {
  pending: { label: 'Ожидает', variant: 'warning' },
  awaiting_payment: { label: 'Ждёт оплаты', variant: 'warning' },
  confirmed: { label: 'Подтверждён', variant: 'info' },
  packing: { label: 'Собирается', variant: 'info' },
  paid: { label: 'Оплачен', variant: 'success' },
  shipped: { label: 'Отправлен', variant: 'info' },
  delivered: { label: 'Доставлен', variant: 'success' },
  cancelled: { label: 'Отменён', variant: 'error' },
};

interface OrderItem { id: string; productName: string; quantity: number; price: number; }
interface Order {
  id: string;
  total: number;
  status: string;
  createdAt: string;
  deliveryMethod?: string;
  paymentMethod?: string;
  items: OrderItem[];
  meta?: { paymentId?: string; [k: string]: unknown };
}

export default function ShopOrders() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, activeClinic } = useAuth();
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [pendingPay, setPendingPay] = useState<any>(null);
  const [payBusy, setPayBusy] = useState(false);

  const loadOrders = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const clinicId = activeClinic?.id || '';
      const list = await api.getShopOrders(activeClinic ? clinicId : 'personal');
      setOrders(Array.isArray(list) ? list : []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const st = (location.state as any)?.successOrderId;
    if (st) toast.success('Заказ успешно оформлен');
    void loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeClinic]);

  const resumePay = async (order: Order) => {
    const paymentId = order.meta?.paymentId;
    if (!paymentId) {
      toast.error('Ссылка на оплату не найдена — оформите заказ заново');
      return;
    }
    setPayingOrderId(order.id);
    setPayBusy(true);
    try {
      const payment = await api.getPayment(paymentId);
      if (payment?.status === 'paid') {
        toast.success('Заказ уже оплачен');
        await loadOrders();
        setPayingOrderId(null);
        return;
      }
      const qr = extractPaymentQrUrl(payment);
      setPendingPay({
        payment: { ...payment, qr: qr || payment?.qr },
        orderId: order.id,
        total: order.total,
      });
    } catch (e: any) {
      toast.error(e?.message || 'Не удалось открыть оплату');
      setPayingOrderId(null);
    } finally {
      setPayBusy(false);
    }
  };

  const confirmOrderPay = async () => {
    if (!pendingPay?.payment?.id) return;
    setPayBusy(true);
    try {
      const res = await api.confirmPayment(pendingPay.payment.id);
      if (res?.status === 'paid' || res?.settled || res?.alreadyPaid) {
        toast.success('Оплата подтверждена');
        setPendingPay(null);
        setPayingOrderId(null);
        await loadOrders();
      } else {
        toast.info('Оплата ещё не подтверждена');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Оплата не подтверждена');
    } finally {
      setPayBusy(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="h-9 w-9 rounded-full border-[3px] border-[#C9A96E]/30 border-t-[#C9A96E] animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-[900px] mx-auto">
      <PageHeader title="Мои заказы" subtitle="История покупок в Магазине" icon={<Package size={22} />} />

      {pendingPay?.payment && (
        <PaymentQrPanel
          className="mt-5"
          payment={pendingPay.payment}
          title={`Заказ #${String(pendingPay.orderId || '').slice(0, 8)}`}
          amount={Number(pendingPay.total || 0)}
          busy={payBusy}
          onConfirm={confirmOrderPay}
          onCancel={() => { setPendingPay(null); setPayingOrderId(null); }}
          hint="Отсканируйте QR или откройте оплату, затем нажмите «Проверить оплату»."
        />
      )}

      {orders.length === 0 ? (
        <EmptyState
          icon={<Package size={36} />}
          title="Заказов пока нет"
          description="Оформите первый заказ в каталоге Магазина"
          action={<button onClick={() => navigate('/shop')} className="text-[#C9A96E] bg-transparent border-none cursor-pointer font-inherit text-sm">В каталог →</button>}
        />
      ) : (
        <div className="space-y-3 mt-5">
          {orders.map((o, i) => {
            const st = STATUS[o.status] || STATUS.pending;
            const needsPay = o.status === 'awaiting_payment' || (o.status === 'pending' && !!o.meta?.paymentId);
            return (
              <motion.div key={o.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }}>
                <Card hover={false} className={payingOrderId === o.id ? 'ring-1 ring-[#C9A96E]/40' : undefined}>
                  <CardContent>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">Заказ #{o.id.slice(0, 8)}</span>
                        <Badge variant={st.variant} size="xs">{st.label}</Badge>
                      </div>
                      <span className="text-xs text-[var(--slate)]">{new Date(o.createdAt).toLocaleString('ru-RU')}</span>
                    </div>
                    <div className="space-y-1.5 mb-3">
                      {(o.items || []).map((it: any, idx: number) => {
                        const name = it.productName || it.name || 'Товар';
                        const qty = Number(it.quantity || it.qty || 1);
                        const price = Number(it.price || 0);
                        return (
                          <div key={it.id || `${o.id}-${idx}`} className="flex justify-between text-xs">
                            <span className="text-[var(--slate-light)]">{name} <span className="text-[var(--slate)]">×{qty}</span></span>
                            <span className="text-white">{tg(price * qty)}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-2.5 gap-3 flex-wrap">
                      <div className="flex items-center gap-3 text-[11px] text-[var(--slate)]">
                        {o.deliveryMethod && <span className="flex items-center gap-1"><Truck size={11} /> {o.deliveryMethod}</span>}
                        {o.paymentMethod && <span className="flex items-center gap-1"><Clock size={11} /> {o.paymentMethod}</span>}
                      </div>
                      <div className="flex items-center gap-2 ml-auto">
                        {needsPay && (
                          <Button
                            size="sm"
                            icon={<QrCode size={14} />}
                            loading={payBusy && payingOrderId === o.id}
                            onClick={() => void resumePay(o)}
                          >
                            Оплатить по QR
                          </Button>
                        )}
                        <span className="text-base font-extrabold text-white">{tg(Number(o.total))}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
