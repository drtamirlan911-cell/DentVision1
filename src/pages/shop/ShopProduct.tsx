import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Star, ShoppingCart, Heart, Package, Truck, Clock, Shield,
  ChevronRight, MessageSquare, ThumbsUp, Check, Minus, Plus, Share2,
  MapPin, Ruler, Weight, Tag, ChevronLeft, ChevronDown, Zap, Eye,
} from 'lucide-react';
import * as api from '../../utils/api';
import { useCart } from '@/store/cart.store';
import { useAuth } from '@/store/auth.store';
import { useUIStore } from '@/store/ui.store';
import { useToast } from '../../components/ui/ds/Toast';
import { Button } from '../../components/ui/ds/Button';
import { Badge } from '../../components/ui/ds/Badge';
import { EmptyState } from '../../components/ui/ds/EmptyState';
import { cn } from '@/lib/utils';

interface SpecTemplate {
  id: string; name: string; type: string; unit?: string; options?: any[];
  required: boolean; sortOrder: number;
}

interface ReviewItem {
  id: string; rating: number; pros?: string; cons?: string; comment?: string;
  images?: string[]; helpfulCount: number; createdAt: string;
  user?: { id: string; name: string; avatar?: string | null; };
}

interface RelatedProduct {
  id: string; name: string; brand: string; price: number; rating: number | null;
  imageUrl?: string; reviewCount: number;
}

export default function ShopProduct() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, toggleFav, isFav } = useCart();
  const { user } = useAuth();
  const toast = useToast();

  const [product, setProduct] = useState<any>(null);
  const [specTemplate, setSpecTemplate] = useState<SpecTemplate[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [relatedProducts, setRelatedProducts] = useState<RelatedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('description');
  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [reviewForm, setReviewForm] = useState({ rating: 5, pros: '', cons: '', comment: '' });
  const [reviewLoading, setReviewLoading] = useState(false);

  // Load product detail
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.getShopProduct(id).then((data: any) => {
      if (data) {
        setProduct(data);
        setSpecTemplate(Array.isArray(data.specTemplate) ? data.specTemplate : []);
        setRelatedProducts(Array.isArray(data.relatedProducts) ? data.relatedProducts : []);
      }
    }).catch(() => {}).finally(() => setLoading(false));

    api.getShopReviews(id).then(setReviews).catch(() => {});
  }, [id]);

  useEffect(() => {
    const label = product?.name?.trim() || null;
    useUIStore.getState().setCrumbTailLabel(label);
    return () => useUIStore.getState().setCrumbTailLabel(null);
  }, [product?.name]);

  const favActive = product ? isFav(product.id) : false;

  const images = useMemo(() => {
    if (!product) return [];
    const imgs: string[] = [];
    if (product.imageUrl) imgs.push(product.imageUrl);
    if (Array.isArray(product.images)) imgs.push(...product.images.filter(Boolean));
    return imgs.length > 0 ? imgs : [];
  }, [product]);

  const hasDiscount = product?.oldPrice != null && product.oldPrice > product.price;
  const discountPercent = hasDiscount ? Math.round((1 - product.price / product.oldPrice) * 100) : 0;

  const specsMap = useMemo(() => {
    if (!product?.specs) return [];
    const s = product.specs || {};
    return Object.entries(s).map(([key, value]) => ({ label: key, value: String(value) }));
  }, [product?.specs]);

  const handleAddToCart = () => {
    if (!product) return;
    for (let i = 0; i < qty; i++) {
      addToCart({
        id: product.id,
        name: product.name,
        brand: product.brand || '',
        price: product.price,
        imageUrl: product.imageUrl || null,
        supplierId: product.supplierId || null,
        category: product.category_name || null,
        ownBrand: !!product.ownBrand,
      });
    }
    toast.success(`Добавлено ${qty} ${qty === 1 ? 'товар' : 'товара'}`);
  };

  const handleToggleFav = () => {
    if (!product) return;
    toggleFav({ id: product.id, name: product.name, brand: product.brand, price: product.price, rating: product.rating || 0 });
    toast.success(favActive ? 'Удалено из избранного' : 'Добавлено в избранное');
  };

  const handleSubmitReview = async () => {
    if (!user) { toast.error('Войдите, чтобы оставить отзыв'); return; }
    if (!reviewForm.comment.trim() && !reviewForm.pros.trim() && !reviewForm.cons.trim()) {
      toast.error('Напишите текст отзыва'); return;
    }
    setReviewLoading(true);
    try {
      await api.createShopReview({
        productId: id,
        rating: reviewForm.rating,
        pros: reviewForm.pros || undefined,
        cons: reviewForm.cons || undefined,
        comment: reviewForm.comment || undefined,
      });
      toast.success('Отзыв отправлен');
      setReviewForm({ rating: 5, pros: '', cons: '', comment: '' });
      api.getShopReviews(id || '').then(setReviews).catch(() => {});
    } catch {
      toast.error('Не удалось отправить отзыв');
    } finally {
      setReviewLoading(false);
    }
  };

  // --- Loading ---

  if (loading) {
    return (
      <div className="max-w-full overflow-x-hidden mx-auto px-4 py-8 sm:max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="aspect-square bg-gray-100 rounded-2xl animate-pulse" />
          <div className="space-y-4">
            <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
            <div className="h-8 w-3/4 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
            <div className="h-10 w-32 bg-gray-100 rounded animate-pulse" />
            <div className="h-6 w-24 bg-gray-100 rounded animate-pulse" />
            <div className="h-24 bg-gray-100 rounded animate-pulse" />
            <div className="h-12 w-full bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-full overflow-x-hidden mx-auto px-4 py-20 sm:max-w-6xl">
        <EmptyState icon={<Package size={48} />} title="Товар не найден" description="Вернитесь в каталог" />
      </div>
    );
  }

  const tabs = [
    { key: 'description', label: 'Описание' },
    { key: 'specs', label: 'Характеристики' },
    { key: 'reviews', label: `Отзывы (${reviews.length})` },
    { key: 'delivery', label: 'Доставка' },
  ];

  return (
    <div className="max-w-full overflow-x-hidden mx-auto px-4 py-6 space-y-8 sm:max-w-6xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
        <button onClick={() => navigate('/shop')} className="hover:text-dv-gold transition-colors">Маркетплейс</button>
        <ChevronRight size={12} />
        {product.category_name && (
          <>
            <button onClick={() => navigate(`/shop?category=${product.category_slug || product.categoryId}`)}
              className="hover:text-dv-gold transition-colors">{product.category_name}</button>
            <ChevronRight size={12} />
          </>
        )}
        <span className="text-gray-600 truncate">{product.name}</span>
      </div>

      {/* Main Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Image Gallery */}
        <div className="space-y-3">
          <div className="relative aspect-square rounded-2xl bg-gray-50 overflow-hidden">
            {images.length > 0 ? (
              <img src={images[activeImage]} alt={product.name}
                className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-200">
                <Package size={80} />
              </div>
            )}
            {/* Badges */}
            <div className="absolute top-3 left-3 flex flex-col gap-1.5">
              {hasDiscount && (
                <Badge variant="error" className="text-sm font-bold px-3 py-1">-{discountPercent}%</Badge>
              )}
              {product.ownBrand && (
                <Badge variant="default" className="bg-dv-gold text-white">DentVision</Badge>
              )}
              {product.stock <= 0 && (
                <Badge variant="default" className="bg-gray-800 text-white">Нет в наличии</Badge>
              )}
            </div>
          </div>
          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <button key={i} onClick={() => setActiveImage(i)}
                  className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${
                    i === activeImage ? 'border-dv-gold' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}>
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-5">
          {product.brand && (
            <span className="text-xs font-semibold text-dv-gold uppercase tracking-wider">{product.brand}</span>
          )}
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">{product.name}</h1>

          {/* Rating */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} size={16}
                  className={i <= Math.round(product.rating || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'} />
              ))}
            </div>
            <span className="text-sm font-bold text-gray-900">{product.rating?.toFixed(1) || '—'}</span>
            <span className="text-sm text-gray-400">({product.reviewCount || 0} отзывов)</span>
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-gray-900">{product.price.toLocaleString()} ₸</span>
            {hasDiscount && (
              <span className="text-lg text-gray-400 line-through">{product.oldPrice.toLocaleString()} ₸</span>
            )}
          </div>

          {/* DentCash */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
            <p className="text-sm font-semibold text-emerald-700">Кэшбэк DentCash ~3% ≈ {Math.round(product.price * 0.03).toLocaleString()} ₸</p>
            <p className="text-xs text-emerald-500 mt-0.5">Зачисление после доставки</p>
          </div>

          {/* Stock */}
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${product.stock > 0 ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className={`text-sm font-medium ${product.stock > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {product.stock > 0 ? `В наличии: ${product.stock} ${product.unit || 'шт'}` : 'Нет в наличии'}
            </span>
            {product.sku && <span className="text-xs text-gray-400 ml-auto">Арт. {product.sku}</span>}
          </div>

          {/* Supplier info */}
          {product.supplier && (
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex items-center gap-3">
              <Truck size={18} className="text-dv-gold" />
              <div className="text-sm">
                <span className="text-gray-500">Поставщик: </span>
                <span className="font-semibold text-gray-900">{product.supplier.name}</span>
              </div>
            </div>
          )}

          {/* Qty + Add to cart */}
          <div className="flex items-center gap-3 pt-2">
            <div className="flex items-center border border-gray-200 rounded-xl">
              <button aria-label="Decrease quantity" onClick={() => setQty(Math.max(1, qty - 1))} className="w-10 h-10 flex items-center justify-center text-gray-500 hover:bg-gray-50 rounded-l-xl">
                <Minus size={14} />
              </button>
              <span className="w-12 h-10 flex items-center justify-center text-sm font-bold border-x border-gray-100">{qty}</span>
              <button aria-label="Increase quantity" onClick={() => setQty(qty + 1)} className="w-10 h-10 flex items-center justify-center text-gray-500 hover:bg-gray-50 rounded-r-xl">
                <Plus size={14} />
              </button>
            </div>
            <Button variant="primary" size="lg" className="flex-1" disabled={product.stock <= 0}
              onClick={handleAddToCart}>
              <ShoppingCart size={16} /> {product.stock > 0 ? 'В корзину' : 'Нет в наличии'}
            </Button>
            <button aria-label="Toggle favorite" onClick={handleToggleFav}
              className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 min-h-11">
              <Heart size={18} className={favActive ? 'fill-red-500 text-red-500' : 'text-gray-400'} />
            </button>
          </div>

          {/* Short specs preview */}
          {specsMap.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-gray-100">
              {specsMap.slice(0, 4).map((s) => (
                <div key={s.label} className="text-xs">
                  <span className="text-gray-400">{s.label}: </span>
                  <span className="font-medium text-gray-700">{s.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-100 flex gap-0 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-3 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
              activeTab === tab.key
                ? 'text-dv-gold border-dv-gold'
                : 'text-gray-400 border-transparent hover:text-gray-600'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
          {/* Description */}
          {activeTab === 'description' && (
            <div className="prose prose-sm max-w-none text-gray-600 leading-relaxed">
              {product.description || 'Нет описания'}
            </div>
          )}

          {/* Specs */}
          {activeTab === 'specs' && (
            <div className="space-y-6">
              {/* Template-based specs */}
              {specTemplate.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-3">Характеристики</h3>
                  <div className="divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
                    {specTemplate.map((tmpl) => {
                      const val = product.specs?.[tmpl.name];
                      return (
                        <div key={tmpl.id} className="flex justify-between py-2.5 px-4 text-sm bg-white">
                          <span className="text-gray-500">{tmpl.name}</span>
                          <span className="font-medium text-gray-900">{val ?? '—'}{tmpl.unit ? ` ${tmpl.unit}` : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* Raw specs */}
              {specsMap.length > 0 && specTemplate.length === 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-3">Характеристики</h3>
                  <div className="divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
                    {specsMap.map((s) => (
                      <div key={s.label} className="flex justify-between py-2.5 px-4 text-sm bg-white">
                        <span className="text-gray-500">{s.label}</span>
                        <span className="font-medium text-gray-900">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Product info fields */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">Про товар</h3>
                <div className="divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
                  {[
                    ['Бренд', product.brand],
                    ['Артикул', product.sku],
                    ['Категория', product.category_name],
                    ['Страна производства', product.country],
                    ['Производитель', product.manufacturer],
                    ['Вес', product.weight ? `${product.weight} г` : null],
                    ['Единица измерения', product.unit],
                    ['Срок годности', product.expiryDate ? new Date(product.expiryDate).toLocaleDateString('ru-RU') : null],
                  ].filter(([_, v]) => v).map(([label, value]) => (
                    <div key={String(label)} className="flex justify-between py-2.5 px-4 text-sm bg-white">
                      <span className="text-gray-500">{String(label)}</span>
                      <span className="font-medium text-gray-900">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Reviews */}
          {activeTab === 'reviews' && (
            <div className="space-y-6">
              {/* Review Form */}
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-5">
                <h4 className="text-sm font-bold text-gray-900 mb-3">Оставить отзыв</h4>
                {user ? (
                  <>
                    <div className="flex items-center gap-1 mb-3">
                      {[1, 2, 3, 4, 5].map((j) => (
                        <button key={j} type="button" onClick={() => setReviewForm(prev => ({ ...prev, rating: j }))}
                          className="p-0.5">
                          <Star size={22} className={j <= reviewForm.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'} />
                        </button>
                      ))}
                    </div>
                    <input value={reviewForm.pros} onChange={e => setReviewForm(p => ({ ...p, pros: e.target.value }))}
                      placeholder="Плюсы" className="!rounded-lg !mb-2 min-h-11" />
                    <input value={reviewForm.cons} onChange={e => setReviewForm(p => ({ ...p, cons: e.target.value }))}
                      placeholder="Минусы" className="!rounded-lg !mb-2 min-h-11" />
                    <textarea value={reviewForm.comment} onChange={e => setReviewForm(p => ({ ...p, comment: e.target.value }))}
                      placeholder="Ваш отзыв" rows={3} className="!rounded-lg !mb-3 min-h-11" />
                    <Button variant="primary" size="sm" onClick={handleSubmitReview} disabled={reviewLoading}>
                      {reviewLoading ? 'Отправка...' : 'Отправить отзыв'}
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-gray-400">Войдите в аккаунт, чтобы оставить отзыв</p>
                )}
              </div>

              {/* Reviews list */}
              {reviews.length > 0 ? reviews.map((review) => (
                <div key={review.id} className="py-4 border-b border-gray-50 last:border-0">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-dv-gold/10 flex items-center justify-center text-xs font-bold text-dv-gold">
                        {review.user?.name?.[0] || '?'}
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-gray-900">{review.user?.name || 'Пользователь'}</span>
                        <div className="flex gap-0.5 mt-0.5">
                          {[1, 2, 3, 4, 5].map((j) => (
                            <Star key={j} size={10} className={j <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'} />
                          ))}
                        </div>
                      </div>
                    </div>
                    <button className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                      <ThumbsUp size={12} /> {review.helpfulCount || 0}
                    </button>
                  </div>
                  {review.pros && <p className="text-xs text-emerald-600 my-1">+ {review.pros}</p>}
                  {review.cons && <p className="text-xs text-red-500 my-1">- {review.cons}</p>}
                  {review.comment && <p className="text-sm text-gray-600 mt-2">{review.comment}</p>}
                </div>
              )) : (
                <EmptyState icon={<MessageSquare size={36} className="text-gray-200" />}
                  title="Отзывов пока нет" description="Будьте первым, кто оставит отзыв" />
              )}
            </div>
          )}

          {/* Delivery */}
          {activeTab === 'delivery' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { icon: Truck, title: 'Доставка', desc: 'Отправляем со склада DentVision. Гарантия подлинности.' },
                { icon: MapPin, title: 'Курьер по городу', desc: 'По городу за 1-3 часа. Привезём заказ на дом.' },
                { icon: Clock, title: 'Быстрая доставка', desc: 'В течение 1 рабочего дня после заказа.' },
              ].map((item, i) => (
                <div key={i} className="flex gap-3.5 p-4 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 rounded-xl bg-dv-gold/10 flex items-center justify-center shrink-0">
                    <item.icon size={18} className="text-dv-gold" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">{item.title}</h4>
                    <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section>
          <h3 className="text-lg font-bold text-gray-900 mb-4">Похожие товары</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {relatedProducts.slice(0, 8).map((rel: any) => {
              const imgUrl = rel.imageUrl || null;
              return (
                <motion.div key={rel.id} whileHover={{ y: -3 }}
                  onClick={() => navigate(`/shop/${rel.id}`)}
                  className="bg-white rounded-xl border border-gray-100 p-3 cursor-pointer hover:border-dv-gold/30 hover:shadow-md transition-all">
                  <div className="aspect-square rounded-lg bg-gray-50 mb-2 overflow-hidden">
                    {imgUrl ? (
                      <img src={imgUrl} alt={rel.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-200"><Package size={28} /></div>
                    )}
                  </div>
                  <p className="text-[11px] text-dv-gold font-semibold">{rel.brand || ''}</p>
                  <p className="text-sm font-bold text-gray-900 truncate">{rel.name}</p>
                  <p className="text-sm font-bold text-gray-900 mt-1">{rel.price.toLocaleString()} ₸</p>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
