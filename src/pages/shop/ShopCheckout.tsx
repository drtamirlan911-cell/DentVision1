import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingBag, Truck, CreditCard, Check, ArrowLeft, Building2 } from 'lucide-react';
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

const DELIVERY_FREE_FROM = 50000;
const DELIVERY_COST = 2500;

export default function ShopCheckout() {
  const navigate = useNavigate();
  const { cart, cartTotal, clearCart } = useCart();
  const { user, activeClinic } = useAuth();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    contactName: user?.name || '',
    phone: user?.phone || '',
    delivery_address: '',
    delivery_method: 'courier',
    payment_method: 'kaspi',
    buyFor: 'self' as 'self' | 'clinic',
    notes: '',
  });

  if (cart.length === 0) {
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
  const total = cartTotal + deliveryCost;
  const canBuyForClinic = !!activeClinic;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = async () => {
    if (!user) { toast.error('Необходимо войти в систему'); return; }
    if (!form.delivery_address.trim()) { toast.error('Укажите адрес доставки'); return; }
    // "for" = clinicId when buying for the workspace, else null (personal)
    const clinicId = form.buyFor === 'clinic' && activeClinic ? activeClinic.id : null;
    setSubmitting(true);
    try {
      const res = await api.createShopOrder({
        clinic_id: clinicId,
        items: cart.map(i => ({ product_id: i.id, quantity: i.qty })),
        delivery_address: form.delivery_address,
        delivery_method: form.delivery_method,
        payment_method: form.payment_method,
        notes: form.notes,
      });
      clearCart();
      toast.success('Заказ оформлен!');
      navigate('/shop/orders', { state: { successOrderId: res.id, total: res.total } });
    } catch {
      toast.error('Не удалось оформить заказ');
    } finally {
      setSubmitting(false);
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
                {!canBuyForClinic && (
                  <p className="text-[11px] text-[var(--slate)] mt-1.5">Чтобы купить для клиники, выберите рабочее пространство в шапке</p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2.5">
                <div>
                  <label className="text-xs text-[var(--slate)] mb-1 block">Способ доставки</label>
                  <select value={form.delivery_method} onChange={set('delivery_method')} className="!w-full !rounded-lg">
                    <option value="courier">Курьер</option>
                    <option value="self">Самовывоз</option>
                    <option value="post">Почта</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--slate)] mb-1 block">Оплата</label>
                  <select value={form.payment_method} onChange={set('payment_method')} className="!w-full !rounded-lg">
                    <option value="kaspi">Kaspi Pay</option>
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
                      <span className="text-white font-semibold shrink-0">{tg(i.price * i.qty)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-[var(--border-subtle)] mt-3 pt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-[var(--slate)]">Товары:</span><span className="text-white">{tg(cartTotal)}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--slate)]">Доставка:</span><span className="text-white">{deliveryCost === 0 ? 'Бесплатно' : tg(deliveryCost)}</span></div>
                  <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-[var(--border-subtle)]">
                    <span className="text-white">Итого:</span><span className="text-[#C9A96E]">{tg(total)}</span>
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
