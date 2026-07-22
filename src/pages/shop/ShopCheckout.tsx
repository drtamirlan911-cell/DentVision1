import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingBag, Truck, CreditCard, ArrowLeft, Building2, Wallet } from 'lucide-react';
import { tg } from '../../utils/constants';
import * as api from '../../utils/api';
import { useCart } from '@/store/cart.store';
import { useAuth } from '@/store/auth.store';
import { useToast } from '../../components/ui/ds/Toast';
import { Button } from '../../components/ui/ds/Button';
import { Card, CardContent } from '../../components/ui/ds/Card';
import { Input } from '../../components/ui/ds/Input';
import { PageHeader } from '../../components/ui/ds/StatCard';
import { EmptyState } from '../../components/ui/ds/EmptyState';
import { PaymentQrPanel } from '@/components/payments/PaymentQrPanel';
import { extractPaymentQrUrl } from '@/utils/paymentQr';

const DELIVERY_FREE_FROM = 50000;
const DELIVERY_COST = 2500;

function money(n: number) {
  try {
    return tg(n, 'KZT');
  } catch {
    return `${Math.round(n).toLocaleString('ru-RU')} ₸`;
  }
}

export default function ShopCheckout() {
  const navigate = useNavigate();
  const { cart, cartTotal, clearCart } = useCart();
  const { user, activeClinic } = useAuth();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [useDentCash, setUseDentCash] = useState(false);
  const [quote, setQuote] = useState<any>(null);
  const [quoteFailed, setQuoteFailed] = useState(false);
  const [pendingPay, setPendingPay] = useState<any>(null);
  const [payStatus, setPayStatus] = useState<'pending' | 'paid'>('pending');
  const [confirming, setConfirming] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [form, setForm] = useState({
    contactName: user?.name || '',
    phone: user?.phone || '',
    delivery_address: '',
    delivery_method: 'courier',
    payment_method: 'qr',
    buyFor: 'self' as 'self' | 'clinic',
    notes: '',
  });

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const finishPaid = useCallback((orderId?: string, orderTotal?: number, earn?: number) => {
    stopPoll();
    clearCart();
    setPendingPay(null);
    toast.success(
      earn
        ? `Оплата прошла! Кэшбэк ~${Math.round(earn).toLocaleString('ru-RU')} ₸ после доставки`
        : 'Оплата прошла, заказ оформлен!',
    );
    navigate('/shop/orders', { state: { successOrderId: orderId, total: orderTotal } });
  }, [clearCart, navigate, stopPoll, toast]);

  const checkPayment = useCallback(async (paymentId: string, silent = false) => {
    try {
      const status = await api.getPayment(paymentId);
      if (status?.status === 'paid') {
        setPayStatus('paid');
        finishPaid(pendingPay?.orderId, pendingPay?.total, pendingPay?.earn);
        return;
      }
      if (!silent) toast.info('Оплата ещё не подтверждена');
    } catch {
      if (!silent) toast.error('Не удалось проверить оплату');
    }
  }, [finishPaid, pendingPay?.earn, pendingPay?.orderId, pendingPay?.total, toast]);

  useEffect(() => {
    if (!pendingPay?.payment?.id || payStatus === 'paid') return;
    pollRef.current = setInterval(() => {
      void checkPayment(pendingPay.payment.id, true);
    }, 5000);
    return stopPoll;
  }, [pendingPay?.payment?.id, payStatus, checkPayment, stopPoll]);

  useEffect(() => {
    if (!user || cart.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.quoteDentCash({
          lines: cart.map((i) => ({
            productId: i.id,
            name: i.name,
            priceTenge: i.price,
            qty: i.qty,
            supplierId: i.supplierId || undefined,
            category: i.category || undefined,
            ownBrand: i.ownBrand,
          })),
        });
        if (!cancelled) setQuote(data);
      } catch {
        if (!cancelled) setQuote(null);
      }
    })();
    return () => { cancelled = true; };
  }, [user, cart]);

  if (cart.length === 0 && !pendingPay) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<ShoppingBag size={36} />}
          title="Корзина пуста"
          description="Добавьте товары из каталога, чтобы оформить заказ"
          action={<Button variant="primary" onClick={() => navigate('/shop')}>В каталог</Button>}
        />
      </div>
    );
  }

  const deliveryCost = cartTotal >= DELIVERY_FREE_FROM ? 0 : DELIVERY_COST;
  const payable = cartTotal + deliveryCost;
  const maxSpend = Math.min(Number(quote?.balanceTenge || 0), payable);
  const spendTenge = useDentCash ? maxSpend : 0;
  const total = Math.max(0, payable - spendTenge);
  const canBuyForClinic = !!activeClinic;
  const earnPreview = Number(quote?.earnTenge || 0);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = async () => {
    if (!user) { toast.error('Необходимо войти в систему'); return; }
    if (!form.delivery_address.trim()) { toast.error('Укажите адрес доставки'); return; }
    if (!activeClinic?.id && form.buyFor === 'clinic') {
      toast.error('Выберите клинику для заказа');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.createShopOrder({
        clinic_id: activeClinic?.id || null,
        items: cart.map(i => ({ product_id: i.id, quantity: i.qty })),
        delivery_address: form.delivery_address,
        delivery_method: form.delivery_method,
        payment_method: form.payment_method,
        notes: form.notes,
        dentCashTenge: spendTenge > 0 ? spendTenge : undefined,
        total,
      });
      const earn = res?.dentCashEarnPendingTenge;
      if (res?.requiresPayment && res?.payment?.id) {
        const qr = extractPaymentQrUrl(res.payment);
        setPendingPay({
          payment: { ...res.payment, qr: qr || res.payment.qr },
          orderId: res.id,
          total: res.total,
          earn,
        });
        setPayStatus('pending');
        toast.success(qr ? 'Заказ создан — отсканируйте QR ниже' : 'Заказ создан — завершите оплату ниже');
        return;
      }
      clearCart();
      toast.success(
        earn
          ? `Заказ оформлен! Кэшбэк ~${Math.round(earn).toLocaleString('ru-RU')} ₸ после доставки`
          : 'Заказ оформлен!',
      );
      navigate('/shop/orders', { state: { successOrderId: res.id, total: res.total } });
    } catch (e: any) {
      toast.error(e?.message || 'Не удалось оформить заказ');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmPay = async () => {
    if (!pendingPay?.payment?.id) return;
    setConfirming(true);
    try {
      const res = await api.confirmPayment(pendingPay.payment.id);
      if (res?.status === 'paid' || res?.settled || res?.alreadyPaid) {
        setPayStatus('paid');
        finishPaid(pendingPay.orderId, pendingPay.total, pendingPay.earn);
      } else {
        toast.info('Оплата ещё не подтверждена');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Оплата не подтверждена');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="p-6 max-w-[900px] mx-auto">
      <button
        onClick={() => navigate('/shop')}
        className="flex items-center gap-1 bg-transparent border-none text-[#C9A96E] cursor-pointer font-inherit text-xs mb-3"
      >
        <ArrowLeft size={14} /> Назад в каталог
      </button>

      <PageHeader title="Оформление заказа" subtitle="Проверьте данные и подтвердите заказ" icon={<ShoppingBag size={22} />} />

      {pendingPay?.payment && (
        <PaymentQrPanel
          className="mt-5"
          payment={pendingPay.payment}
          title="Оплата заказа"
          amount={Number(pendingPay.total || 0)}
          busy={confirming}
          onConfirm={confirmPay}
          onCancel={() => { stopPoll(); setPendingPay(null); }}
          hint="Откройте оплату по QR, оплатите, затем нажмите «Проверить оплату». В демо-среде кнопка завершает оплату сразу."
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-5 mt-5">
        <div className="md:col-span-3 space-y-4">
          <Card>
            <CardContent>
              <h3 className="text-sm font-bold text-white m-0 mb-3 flex items-center gap-2">
                <Truck size={16} className="text-[#C9A96E]" /> Данные доставки
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Input label="Контактное лицо" value={form.contactName} onChange={set('contactName')} placeholder="Имя" />
                <Input label="Телефон" value={form.phone} onChange={set('phone')} placeholder="+7..." />
              </div>
              <div className="mt-2.5">
                <Input label="Адрес доставки" value={form.delivery_address} onChange={set('delivery_address')} placeholder="Город, улица, дом" />
              </div>
              <div className="mt-3">
                <label className="text-xs text-[var(--slate)] mb-1.5 block">Купить для</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, buyFor: 'self' }))}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all ${
                      form.buyFor === 'self' ? 'border-[#C9A96E]/60 bg-[#C9A96E]/10 text-[#C9A96E]' : 'border-[var(--border-subtle)] bg-white/[0.03] text-[var(--slate)]'
                    }`}
                  >
                    <ShoppingBag size={15} /> Для себя
                  </button>
                  <button
                    type="button"
                    disabled={!canBuyForClinic}
                    onClick={() => setForm(f => ({ ...f, buyFor: 'clinic' }))}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                      form.buyFor === 'clinic' ? 'border-[#C9A96E]/60 bg-[#C9A96E]/10 text-[#C9A96E]' : 'border-[var(--border-subtle)] bg-white/[0.03] text-[var(--slate)]'
                    }`}
                  >
                    <Building2 size={15} /> {activeClinic ? activeClinic.name : 'Для клиники'}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2.5">
                <div>
                  <label className="text-xs text-[var(--slate)] mb-1 block">Способ доставки</label>
                  <select className="dv-select" value={form.delivery_method} onChange={set('delivery_method')}>
                    <option value="courier">Курьер</option>
                    <option value="self">Самовывоз</option>
                    <option value="post">Почта</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--slate)] mb-1 block">Оплата</label>
                  <select className="dv-select" value={form.payment_method} onChange={set('payment_method')}>
                    <option value="qr">Онлайн по QR</option>
                    <option value="card">Картой</option>
                    <option value="cash">Наличными при получении</option>
                  </select>
                </div>
              </div>
              <div className="mt-2.5">
                <label className="text-xs text-[var(--slate)] mb-1 block">Комментарий</label>
                <textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Примечание к заказу" className="!rounded-lg" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardContent>
                <h3 className="text-sm font-bold text-white m-0 mb-3">Ваш заказ</h3>
                <div className="space-y-2.5 max-h-[260px] overflow-y-auto">
                  {cart.map(i => (
                    <div key={i.id} className="flex justify-between gap-2 text-xs">
                      <span className="text-[var(--slate-light)] truncate">{i.name} <span className="text-[var(--slate)]">×{i.qty}</span></span>
                      <span className="text-white font-semibold shrink-0">{money(i.price * i.qty)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-[var(--border-subtle)] mt-3 pt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-[var(--slate)]">Товары:</span><span className="text-white">{money(cartTotal)}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--slate)]">Доставка:</span><span className="text-white">{deliveryCost === 0 ? 'Бесплатно' : money(deliveryCost)}</span></div>
                  <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-2 space-y-1">
                    {!user ? (
                      <p className="text-emerald-200/90">Войдите, чтобы копить и списывать кэшбэк DentCash</p>
                    ) : quote ? (
                      <>
                        <div className="flex justify-between text-emerald-300">
                          <span>Кэшбэк после доставки:</span>
                          <span>+{money(earnPreview)}</span>
                        </div>
                        <div className="flex justify-between text-[var(--slate-light)]">
                          <span>Баланс DentCash:</span>
                          <span>{money(Number(quote.balanceTenge || 0))}</span>
                        </div>
                        {maxSpend > 0 ? (
                          <label className="flex items-center justify-between gap-2 pt-1 cursor-pointer">
                            <span className="text-[var(--slate)] flex items-center gap-1.5">
                              <Wallet size={12} className="text-[#C9A96E]" />
                              Списать DentCash ({money(maxSpend)})
                            </span>
                            <input
                              type="checkbox"
                              checked={useDentCash}
                              onChange={(e) => setUseDentCash(e.target.checked)}
                              className="accent-[#C9A96E]"
                            />
                          </label>
                        ) : (
                          <p className="text-[10px] text-[var(--slate)]">
                            Баланс 0 — кэшбэк появится после первой доставки.
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-[var(--slate)]">Считаем кэшбэк…</p>
                    )}
                  </div>
                  {useDentCash && spendTenge > 0 && (
                    <div className="flex justify-between text-[#C9A96E]">
                      <span>DentCash:</span>
                      <span>−{money(spendTenge)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-[var(--border-subtle)]">
                    <span className="text-white">Итого:</span><span className="text-[#C9A96E]">{money(total)}</span>
                  </div>
                </div>
                <Button variant="primary" size="lg" className="w-full mt-4 flex items-center justify-center gap-2" disabled={submitting} onClick={handleSubmit}>
                  {submitting ? 'Оформляем...' : <><CreditCard size={16} /> Подтвердить заказ</>}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
