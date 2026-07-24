import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Star, ShoppingCart, Heart, Package, Truck, Clock, Shield, ChevronRight, MessageSquare, ThumbsUp } from 'lucide-react';
import { tg } from '../../utils/constants';
import * as api from '../../utils/api';
import { useCart } from '@/store/cart.store';
import { useAuth } from '@/store/auth.store';
import { useUIStore } from '@/store/ui.store';
import { useToast } from '../../components/ui/ds/Toast';
import { Button } from '../../components/ui/ds/Button';
import { Card, CardContent } from '../../components/ui/ds/Card';
import { Badge } from '../../components/ui/ds/Badge';
import { EmptyState } from '../../components/ui/ds/EmptyState';
import { estimateCashbackTenge, formatCashbackPercent } from '@/lib/dentcash';

interface ProductReview {
  user_name?: string;
  rating: number;
  pros?: string;
  cons?: string;
  comment?: string;
}

interface ProductDetail {
  id: string;
  name: string;
  brand: string;
  model?: string;
  price: number;
  old_price?: number;
  rating: number;
  review_count: number;
  stock: number;
  unit?: string;
  sku?: string;
  category_name: string;
  description?: string;
  supplier_id?: string;
  supplier_name?: string;
  supplier_country?: string;
  own_brand?: boolean;
  delivery_days?: number;
  delivery_cost?: number;
  image_url?: string;
  reviews?: ProductReview[];
  related?: { id: string; name: string; brand: string; price: number }[];
}

export default function ShopProduct() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, toggleFav, isFav } = useCart();
  const { user } = useAuth();
  const toast = useToast();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('description');
  const [reviewForm, setReviewForm] = useState({ rating: 5, pros: '', cons: '', comment: '' });

  const favActive = product ? isFav(product.id) : false;

  const handleAddToCart = () => {
    if (!product) return;
    addToCart({
      id: product.id,
      name: product.name,
      brand: product.brand,
      price: product.price,
      imageUrl: product.image_url,
      supplierId: product.supplier_id || null,
      category: product.category_name || null,
      ownBrand: !!product.own_brand,
    });
    toast.success('Добавлено в корзину');
  };

  const handleToggleFav = () => {
    if (!product) return;
    const wasFav = isFav(product.id);
    toggleFav({ id: product.id, name: product.name, brand: product.brand, price: product.price, rating: product.rating });
    toast.success(wasFav ? 'Убрано из избранного' : 'Добавлено в избранное');
  };

  const handleSubmitReview = async () => {
    if (!user) { toast.error('Войдите, чтобы оставить отзыв'); return; }
    if (!reviewForm.comment.trim() && !reviewForm.pros.trim() && !reviewForm.cons.trim()) {
      toast.error('Напишите текст отзыва'); return;
    }
    try {
      await api.createShopReview({ product_id: id, rating: reviewForm.rating, pros: reviewForm.pros, cons: reviewForm.cons, comment: reviewForm.comment });
      const rc = product!.review_count || 0;
      const newAvg = Math.round(((product!.rating * rc + reviewForm.rating) / (rc + 1)) * 10) / 10;
      setProduct(prev => prev ? {
        ...prev,
        reviews: [{ user_name: user.name || 'Вы', rating: reviewForm.rating, pros: reviewForm.pros, cons: reviewForm.cons, comment: reviewForm.comment }, ...(prev.reviews || [])],
        review_count: rc + 1,
        rating: newAvg,
      } : prev);
      setReviewForm({ rating: 5, pros: '', cons: '', comment: '' });
      toast.success('Отзыв добавлен');
    } catch { toast.error('Не удалось отправить отзыв'); }
  };

  useEffect(() => {
    api.getShopProduct(id || '').then(setProduct).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const label = product?.name?.trim() || null;
    useUIStore.getState().setCrumbTailLabel(label);
    return () => useUIStore.getState().setCrumbTailLabel(null);
  }, [product?.name]);

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-9 h-9 rounded-full border-[3px] border-[#C9A96E]/30 border-t-[#C9A96E] animate-spin" />
    </div>
  );

  if (!product) return (
    <div className="p-10 text-center text-[#7A8899]">Товар не найден</div>
  );

  const tabs = [
    { key: 'description', label: 'Описание' },
    { key: 'specs', label: 'Характеристики' },
    { key: 'reviews', label: `Отзывы (${product.reviews?.length || 0})` },
    { key: 'delivery', label: 'Доставка' },
  ];

  return (
    <div className="px-6 max-w-[1000px] mx-auto">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-2 mb-5 text-xs text-[#7A8899]"
      >
        <button
          onClick={() => navigate('/shop')}
          className="bg-transparent border-none text-[#C9A96E] cursor-pointer flex items-center gap-1 font-inherit text-xs"
        >
          <ArrowLeft size={14} /> Shop
        </button>
        <ChevronRight size={12} />
        <span>{product.category_name}</span>
        <ChevronRight size={12} />
        <span className="text-white">{product.name}</span>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-gradient-to-br from-[#2980B9]/20 to-[#C9A96E]/10 rounded-2xl h-[260px] sm:h-[400px] flex items-center justify-center relative overflow-hidden"
        >
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <Package size={80} color="#C9A96E30" />
          )}
          {product.old_price && (
            <Badge variant="error" size="sm" className="absolute top-4 left-4 font-bold">
              -{Math.round((1 - product.price / product.old_price) * 100)}%
            </Badge>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
          <div className="text-xs text-[#C9A96E] font-semibold uppercase mb-1.5">{product.brand}</div>
          <h1 className="text-2xl font-extrabold text-white m-0 mb-2 leading-relaxed">{product.name}</h1>
          <div className="text-[13px] text-[#7A8899] mb-3">{product.model}</div>

          <div className="flex items-center gap-2 mb-4">
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={16} color="#C9A96E" fill={i < Math.round(product.rating) ? '#C9A96E' : 'transparent'} />
              ))}
            </div>
            <span className="text-sm font-bold text-[#C9A96E]">{product.rating}</span>
            <span className="text-xs text-[#7A8899]">({product.review_count} отзывов)</span>
          </div>

          <div className="flex items-baseline gap-3 mb-4">
            <span className="text-[28px] font-extrabold text-white">{tg(product.price)}</span>
            {product.old_price && (
              <span className="text-base text-[#7A8899] line-through">{tg(product.old_price)}</span>
            )}
          </div>

          {(() => {
            const cb = estimateCashbackTenge(product.price, {
              category: product.category_name,
              name: product.name,
              promo: !!product.old_price,
            })
            return (
              <div className="mb-4 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3.5 py-2.5">
                <p className="text-sm font-semibold text-emerald-300">
                  Кэшбэк DentCash ~{formatCashbackPercent(cb.bps)} · ≈ {Math.round(cb.tenge).toLocaleString('ru-RU')} ₸
                </p>
                <p className="text-[11px] text-[#7A8899] mt-0.5">
                  Начислится после доставки. Списать можно в корзине или на курсы Academy.
                </p>
              </div>
            )
          })()}

          <div className="flex items-center gap-1.5 mb-4">
            <div className={`w-2 h-2 rounded-full ${product.stock > 0 ? 'bg-[#27AE60]' : 'bg-[#E74C3C]'}`} />
            <span className={`text-[13px] font-semibold ${product.stock > 0 ? 'text-[#27AE60]' : 'text-[#E74C3C]'}`}>
              {product.stock > 0 ? `В наличии: ${product.stock} ${product.unit || 'шт'}` : 'Нет в наличии'}
            </span>
          </div>

          {product.supplier_name && (
            <div className="bg-[#2980B9]/10 border border-[#2980B9]/20 rounded-[10px] px-3.5 py-2.5 mb-4 flex items-center gap-2.5">
              <Truck size={16} color="#2980B9" />
              <div>
                <span className="text-xs text-[var(--slate-light)]">Поставщик: </span>
                <span className="text-xs text-white font-semibold">{product.supplier_name} ({product.supplier_country})</span>
                <span className="text-xs text-[#7A8899]"> · доставка {product.delivery_days} дн.</span>
              </div>
            </div>
          )}

          <div className="flex gap-2.5">
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="flex-1">
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                disabled={product.stock <= 0}
                icon={<ShoppingCart size={16} />}
                onClick={handleAddToCart}
              >
                {product.stock > 0 ? 'Добавить в корзину' : 'Нет в наличии'}
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }}>
              <Button variant="outline" size="icon" onClick={handleToggleFav}>
                <Heart size={18} className={favActive ? 'text-[#E74C3C] fill-[#E74C3C]' : ''} />
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </div>

      <div className="border-b border-[var(--border-subtle)] flex gap-0 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-3 bg-transparent border-none text-[13px] font-semibold cursor-pointer font-inherit transition-all duration-200 ${
              activeTab === tab.key
                ? 'text-[#C9A96E] border-b-2 border-[#C9A96E]'
                : 'text-[#7A8899] border-b-2 border-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {activeTab === 'description' && (
          <div>
            <p className="text-sm text-[var(--slate-light)] leading-[1.8]">{product.description}</p>
          </div>
        )}

        {activeTab === 'specs' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              ['Бренд', product.brand],
              ['Модель', product.model],
              ['Артикул', product.sku || '—'],
              ['Категория', product.category_name],
              ['Поставщик', product.supplier_name],
              ['Страна', product.supplier_country],
              ['Доставка', `${product.delivery_days} дн.`],
              ['Стоимость доставки', product.delivery_cost === 0 ? 'Бесплатно' : tg(product.delivery_cost as number)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between py-2 px-3 bg-white/[0.02] rounded-md">
                <span className="text-xs text-[#7A8899]">{label}</span>
                <span className="text-xs text-white font-semibold">{value}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div>
            <div className="bg-white/[0.02] border border-[var(--border-subtle)] rounded-xl p-4 mb-5">
              <h4 className="text-sm font-bold text-white m-0 mb-3">Оставить отзыв</h4>
              <div className="flex items-center gap-1 mb-3">
                {[...Array(5)].map((_, j) => (
                  <button
                    key={j}
                    type="button"
                    onClick={() => setReviewForm(prev => ({ ...prev, rating: j + 1 }))}
                    className="bg-transparent border-none cursor-pointer p-0"
                  >
                    <Star size={20} color="#C9A96E" fill={j < reviewForm.rating ? '#C9A96E' : 'transparent'} />
                  </button>
                ))}
              </div>
              <input
                value={reviewForm.pros}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReviewForm(prev => ({ ...prev, pros: e.target.value }))}
                placeholder="Плюсы"
                className="!rounded-lg !mb-2"
              />
              <input
                value={reviewForm.cons}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReviewForm(prev => ({ ...prev, cons: e.target.value }))}
                placeholder="Минусы"
                className="!rounded-lg !mb-2"
              />
              <textarea
                value={reviewForm.comment}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReviewForm(prev => ({ ...prev, comment: e.target.value }))}
                placeholder="Ваш отзыв"
                rows={3}
                className="!rounded-lg !mb-3"
              />
              <Button variant="primary" size="sm" onClick={handleSubmitReview}>
                Отправить отзыв
              </Button>
            </div>
            {(product.reviews?.length ?? 0) > 0 ? (product.reviews ?? []).map((review, i) => (
              <div key={i} className="py-4 border-b border-[var(--border-subtle)]">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#C9A96E]/15 flex items-center justify-center text-[13px] font-bold text-[#C9A96E]">
                      {review.user_name?.[0] || '?'}
                    </div>
                    <div>
                      <span className="text-[13px] font-semibold text-white">{review.user_name}</span>
                      <div className="flex gap-0.5 mt-0.5">
                        {[...Array(5)].map((_, j) => (
                          <Star key={j} size={10} color="#C9A96E" fill={j < review.rating ? '#C9A96E' : 'transparent'} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <ThumbsUp size={14} color="#7A8899" />
                </div>
                {review.pros && <p className="text-xs text-[#27AE60] my-1">+ {review.pros}</p>}
                {review.cons && <p className="text-xs text-[#E74C3C] my-1">- {review.cons}</p>}
                {review.comment && <p className="text-[13px] text-[var(--slate-light)] mt-2">{review.comment}</p>}
              </div>
            )) : (
              <EmptyState
                icon={<MessageSquare size={36} className="text-[#7A8899]/40" />}
                title="Пока нет отзывов"
              />
            )}
          </div>
        )}

        {activeTab === 'delivery' && (
          <div className="flex flex-col gap-3">
            {[
              { icon: Truck, title: 'Доставка', desc: `${product.supplier_name} — ${product.delivery_days} рабочих дней` },
              { icon: Shield, title: 'Гарантия', desc: 'Оригинальная продукция с сертификатами качества' },
              { icon: Clock, title: 'Обработка заказа', desc: 'В течение 1 рабочего дня после оплаты' },
            ].map((item, i) => (
              <div key={i} className="flex gap-3.5 p-4 bg-white/[0.02] rounded-[10px]">
                <div className="w-9 h-9 rounded-[10px] bg-[#C9A96E]/[0.12] flex items-center justify-center shrink-0">
                  <item.icon size={16} color="#C9A96E" />
                </div>
                <div>
                  <h4 className="m-0 text-[13px] font-bold text-white">{item.title}</h4>
                  <p className="mt-1 text-xs text-[var(--slate-light)]">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {product.related! && product.related!.length > 0 && (
        <div className="mt-10">
          <h3 className="text-base font-bold text-white mb-4">Похожие товары</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {product.related!.map(rel => (
              <motion.div key={rel.id} whileHover={{ y: -3 }} onClick={() => navigate(`/shop/${rel.id}`)}>
                <Card hover padding="sm" className="cursor-pointer">
                  <p className="text-[11px] text-[#C9A96E] font-semibold m-0">{rel.brand}</p>
                  <p className="text-[13px] font-bold text-white mt-1 mb-1.5">{rel.name}</p>
                  <p className="text-sm font-bold text-white m-0">{tg(rel.price)}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
