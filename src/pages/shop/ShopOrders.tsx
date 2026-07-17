import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Package, CheckCircle2, Clock, Truck } from 'lucide-react';
import { tg } from '../../utils/constants';
import * as api from '../../utils/api';
import { useAuth } from '@/store/auth.store';
import { useToast } from '../../components/ui/ds/Toast';
import { Card, CardContent } from '../../components/ui/ds/Card';
import { Badge } from '../../components/ui/ds/Badge';
import { PageHeader } from '../../components/ui/ds/StatCard';
import { EmptyState } from '../../components/ui/ds/EmptyState';

const STATUS: Record<string, { label: string; variant: 'success' | 'warning' | 'info' | 'error' }> = {
  pending: { label: 'Ожидает', variant: 'warning' },
  confirmed: { label: 'Подтверждён', variant: 'info' },
  shipped: { label: 'Отправлен', variant: 'info' },
  delivered: { label: 'Доставлен', variant: 'success' },
  cancelled: { label: 'Отменён', variant: 'error' },
};

interface OrderItem { id: string; productName: string; quantity: number; price: number; }
interface Order { id: string; total: number; status: string; createdAt: string; deliveryMethod?: string; paymentMethod?: string; items: OrderItem[]; }

export default function ShopOrders() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, activeClinic } = useAuth();
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const st = (location.state as any)?.successOrderId;
    if (st) toast.success('Заказ успешно оформлен');
    if (!user) { setLoading(false); return; }
    // Personal orders: clinic_id=null; workspace orders: activeClinic.id
    const clinicId = activeClinic?.id || '';
    api.getShopOrders(activeClinic ? clinicId : 'personal')
      .then(setOrders)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, activeClinic]);

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="h-9 w-9 rounded-full border-[3px] border-[#C9A96E]/30 border-t-[#C9A96E] animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-[900px] mx-auto">
      <PageHeader title="Мои заказы" subtitle="История покупок в Магазине" icon={<Package size={22} />} />

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
            return (
              <motion.div key={o.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Card hover>
                  <CardContent>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">Заказ #{o.id.slice(0, 8)}</span>
                        <Badge variant={st.variant} size="xs">{st.label}</Badge>
                      </div>
                      <span className="text-xs text-[var(--slate)]">{new Date(o.createdAt).toLocaleString('ru-RU')}</span>
                    </div>
                    <div className="space-y-1.5 mb-3">
                      {o.items?.map(it => (
                        <div key={it.id} className="flex justify-between text-xs">
                          <span className="text-[var(--slate-light)]">{it.productName} <span className="text-[var(--slate)]">×{it.quantity}</span></span>
                          <span className="text-white">{tg(Number(it.price) * it.quantity)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-2.5">
                      <div className="flex items-center gap-3 text-[11px] text-[var(--slate)]">
                        {o.deliveryMethod && <span className="flex items-center gap-1"><Truck size={11} /> {o.deliveryMethod}</span>}
                        {o.paymentMethod && <span className="flex items-center gap-1"><Clock size={11} /> {o.paymentMethod}</span>}
                      </div>
                      <span className="text-base font-extrabold text-white">{tg(Number(o.total))}</span>
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
