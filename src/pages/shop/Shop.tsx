import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, Search, Heart, Star, Package, Truck, TrendingUp, Store,
  X, Plus, Minus, Eye, Sparkles, Zap, ChevronRight, ChevronLeft, Check,
  Clock, Shield, ChevronDown, MapPin, SlidersHorizontal, Building2, Wallet,
} from 'lucide-react';
import * as api from '../../utils/api';
import { useCart } from '@/store/cart.store';
import { useAuth } from '@/store/auth.store';
import { Button } from '../../components/ui/ds/Button';
import { Badge } from '../../components/ui/ds/Badge';
import { EmptyState } from '../../components/ui/ds/EmptyState';
import { KZ_POPULAR_CITIES, KZ_CITY_OPTIONS } from '@/lib/kz-cities';
import { cn } from '@/lib/utils';
import type { InventoryItem } from '@/types';

interface ProductItem {
  id: string; name: string; brand: string; price: number; old_price?: number;
  rating: number | null; review_count: number; stock: number; min_stock: number;
  category_id: string; category_name: string; category_slug?: string;
  description?: string; tags?: string[]; supplier_id?: string; supplier_name?: string;
  supplier_status?: string; supplier_count?: number; own_brand?: boolean; image_url?: string | null;
  images?: string[]; unit?: string; specs?: Record<string, unknown>;
  created_at?: string;
}

interface CategoryNode {
  id: string; name: string; slug: string; icon?: string; imageUrl?: string;
  sortOrder: number; _count?: { products: number }; children?: CategoryNode[];
}

interface BannerItem {
  id: string; title?: string; subtitle?: string; imageUrl: string;
  linkUrl?: string; color?: string; sortOrder: number;
}

interface PromotionItem {
  id: string; title: string; description?: string; type: string;
  discountPercent?: number; discountAmount?: number;
}

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, duration: 0.4 } };

/**
 * Native <option> popups are drawn by the OS, so utility classes do not reach
 * them — the colour has to be inline. It reads the theme variable rather than a
 * hardcoded navy, so the list stays legible in the light theme too.
 */
const OPTION_STYLE = { background: 'var(--dv-surface-1)', color: 'var(--dv-text-primary)' } as const;

export default function Shop() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { cart, favorites, cartCount, cartTotal, addToCart, toggleFav, updateQty, removeFromCart } = useCart();
  const { user } = useAuth();

  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [promotions, setPromotions] = useState<PromotionItem[]>([]);
  const [recommendations, setRecommendations] = useState<ProductItem[]>([]);
  const [search, setSearch] = useState(() => searchParams.get('q') || '');
  const [city, setCity] = useState(() => searchParams.get('city') || '')
  const [cityOpen, setCityOpen] = useState(false);
  const [selectedCat, setSelectedCat] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [loading, setLoading] = useState(true);
  const [deliveryMap, setDeliveryMap] = useState<Record<string, { cost: number; freeFrom: number | null; days: number | null }>>({});
  const [showCart, setShowCart] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [activeBanner, setActiveBanner] = useState(0);
  const bannerInterval = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = city ? { city, limit: '200' } : { limit: '200' };
    Promise.all([
      api.getShopBanners(),
      api.getShopCategories(),
      api.getShopProducts(params),
      api.getShopPromotions(),
      api.getShopRecommendations(),
    ]).then(([b, c, p, prom, rec]) => {
      setBanners(Array.isArray(b) ? b : []);
      setCategories(Array.isArray(c) ? c : []);
      setProducts(Array.isArray(p) ? p : []);
      setPromotions(Array.isArray(prom) ? prom : []);
      setRecommendations(Array.isArray(rec) ? rec : []);
      // Fetch delivery previews for loaded products
      const allProducts = (Array.isArray(p) ? p : []);
      const ids = allProducts.slice(0, 30).map((pr: any) => pr.id).join(',');
      if (ids) {
        api.getShopDeliveryPreview(ids).then((preview: any) => {
          const map: Record<string, any> = {};
          (Array.isArray(preview) ? preview : preview?.data || []).forEach((d: any) => {
            if (d.productId) map[d.productId] = {
              cost: d.deliveryCost ?? d.cost ?? 0,
              freeFrom: d.freeFrom ?? null,
              days: d.estimatedDays ?? d.days ?? null,
            };
          });
          setDeliveryMap(map);
        }).catch(() => {});
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [city]);

  useEffect(() => {
    if (banners.length <= 1) return;
    bannerInterval.current = setInterval(() => {
      setActiveBanner((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(bannerInterval.current);
  }, [banners.length]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/shop?q=${encodeURIComponent(search.trim())}`);
    }
  };

  const updateCity = (nextCity: string) => {
    setCity(nextCity);
    const next = new URLSearchParams(searchParams);
    if (nextCity) next.set('city', nextCity);
    else next.delete('city');
    setSearchParams(next, { replace: true });
  };

  const filteredProducts = useMemo(() => {
    let result = [...products];
    if (selectedCat) {
      result = result.filter(p => p.category_id === selectedCat || p.category_slug === selectedCat);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      );
    }
    switch (sortBy) {
      case 'price_asc': result.sort((a, b) => a.price - b.price); break;
      case 'price_desc': result.sort((a, b) => b.price - a.price); break;
      case 'rating': result.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)); break;
      default: result.sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()); break;
    }
    return result;
  }, [products, selectedCat, search, sortBy]);

  const featuredProducts = useMemo(() => {
    return [...products].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 8);
  }, [products]);

  const promotedProducts = useMemo(() => {
    return products.filter(p => p.old_price != null && p.old_price > 0).slice(0, 8);
  }, [products]);

  const ProductCard = ({ product }: { product: ProductItem }) => {
    const isFav = favorites.some(f => f.id === product.id);
    const inCart = cart.find(c => c.id === product.id);
    const imgSrc = product.image_url || product.images?.[0] || '';
    const hasDiscount = product.old_price != null && product.old_price > product.price;
    const discountPercent = hasDiscount ? Math.round((1 - product.price / (product.old_price || product.price)) * 100) : 0;

    return (
      <motion.div variants={fadeUp}
        className="group relative rounded-xl overflow-hidden transition-all duration-300 cursor-pointer bg-surface-1 hover:bg-surface-2 border border-bdr-subtle"
        onClick={() => navigate(`/shop/${product.id}`)}
      >
        <div className="relative aspect-square overflow-hidden bg-surface-1">
          {imgSrc ? (
            <img src={imgSrc} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-txt-ghost">
              <Package size={48} />
            </div>
          )}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {hasDiscount && (
              <span className="text-txt-primary text-[10px] font-bold px-2 py-0.5 rounded-md bg-error">-{discountPercent}%</span>
            )}
            {product.own_brand && (
              <span className="text-txt-primary text-[10px] font-bold px-2 py-0.5 rounded-md bg-dv-gold">DentVision</span>
            )}
            {product.stock <= 0 && (
              <span className="text-txt-primary text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface-2">Нет в наличии</span>
            )}
          </div>
          <button onClick={(e) => { e.stopPropagation(); toggleFav(product as any); }}
            className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-colors bg-black/40"
            style={{ backdropFilter: 'blur(4px)' }}>
            <Heart size={14} className={isFav ? 'fill-red-500 text-red-500' : 'text-txt-muted'} />
          </button>
        </div>
        <div className="p-3 space-y-2">
          {product.brand && (
            <p className="text-[10px] font-medium uppercase tracking-wider truncate text-txt-muted">{product.brand}</p>
          )}
          <h3 className="text-sm font-semibold leading-tight line-clamp-2 min-h-[2.5rem] transition-colors text-dv-gold-on"
            onClick={(e) => { e.stopPropagation(); navigate(`/shop/${product.id}`); }}>
            {product.name}
          </h3>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center">
              <Star size={12} className={product.rating ? 'fill-warning text-warning' : 'text-txt-ghost'} />
              <span className="text-xs font-medium ml-1 text-txt-muted">{product.rating?.toFixed(1) || '—'}</span>
            </div>
            <span className="text-[10px] text-txt-ghost">({product.review_count})</span>
            <span className="text-[10px] text-txt-ghost">·</span>
            <span className={cn('text-[10px]', product.stock > 0 ? 'text-success' : 'text-error')}>
              {product.stock > 0 ? `В наличии: ${product.stock}` : 'Нет'}
            </span>
          </div>
          {/* Supplier count */}
          {product.supplier_count && product.supplier_count > 1 && (
            <p className="text-[10px] text-info">
              {product.supplier_count} поставщика
            </p>
          )}
          {/* Delivery preview */}
          {deliveryMap[product.id] && (
            <div className="flex items-center gap-1">
              <Truck size={12} className={deliveryMap[product.id].cost === 0 ? 'text-success' : 'text-txt-muted'} />
              <span className={cn('text-[11px]', deliveryMap[product.id].cost === 0 ? 'text-success' : 'text-txt-muted')}>
                {deliveryMap[product.id].cost === 0 ? 'Бесплатно' : `от ${deliveryMap[product.id].cost.toLocaleString()} ₸`}
                {deliveryMap[product.id].days ? ` · ${deliveryMap[product.id].days} дн` : ''}
              </span>
              {deliveryMap[product.id].freeFrom && deliveryMap[product.id].cost > 0 && (
                <span className="text-[10px] text-txt-ghost">
                  (беспл. от {deliveryMap[product.id].freeFrom!.toLocaleString()} ₸)
                </span>
              )}
            </div>
          )}
          <div className="flex items-center justify-between pt-1">
            <div>
              <span className="text-lg font-bold text-dv-gold">{product.price.toLocaleString()} ₸</span>
              {hasDiscount && (
                <span className="text-xs line-through ml-2 text-txt-muted">{product.old_price!.toLocaleString()} ₸</span>
              )}
            </div>
            <button onClick={(e) => { e.stopPropagation(); addToCart(product); }}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-40 bg-dv-gold text-dv-gold-on"
              disabled={product.stock <= 0}>
              {inCart ? <Check size={14} /> : <Plus size={14} />}
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  const BannerCarousel = () => {
    if (!banners.length) return null;
    const current = banners[activeBanner];
    const gradients = [
      'linear-gradient(135deg, #2980B9 0%, #1a1a3e 100%)',
      'linear-gradient(135deg, #27AE60 0%, #0d2137 100%)',
      'linear-gradient(135deg, #C9A96E 0%, #1a1a2e 100%)',
    ];
    return (
      <div className="relative overflow-hidden rounded-2xl bg-surface-0" style={{ minHeight: 260 }}>
        {banners.map((b, i) => (
          <div key={b.id} className={`absolute inset-0 transition-opacity duration-700 ${i === activeBanner ? 'opacity-100' : 'opacity-0'}`}>
            {b.imageUrl && <img src={b.imageUrl} alt="" className="w-full h-full object-cover" />}
            <div className="absolute inset-0" style={{ background: gradients[i % gradients.length], opacity: 0.75 }} />
          </div>
        ))}
        <div className="relative z-10 p-8 md:p-12 flex flex-col justify-center" style={{ minHeight: 260 }}>
          {current.title && <h2 className="text-2xl md:text-4xl font-bold text-white mb-2 max-w-lg">{current.title}</h2>}
          {current.subtitle && <p className="text-white/70 text-sm md:text-base max-w-md mb-4">{current.subtitle}</p>}
          {current.linkUrl && (
            <Button variant="primary" className="w-fit" onClick={() => navigate(current.linkUrl!)}>
              Смотреть <ChevronRight size={16} />
            </Button>
          )}
        </div>
        {banners.length > 1 && (
          <>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
              {banners.map((_, i) => (
                <button key={i} onClick={() => setActiveBanner(i)}
                  aria-label={`Баннер ${i + 1}`}
                  className={cn(
                    'h-2 rounded-full transition-all',
                    i === activeBanner ? 'w-6 bg-dv-gold' : 'w-2 bg-white/30',
                  )} />
              ))}
            </div>
            <button onClick={() => setActiveBanner((p) => (p - 1 + banners.length) % banners.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full flex items-center justify-center text-white bg-white/15"
              style={{ backdropFilter: 'blur(4px)' }}>
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setActiveBanner((p) => (p + 1) % banners.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full flex items-center justify-center text-white bg-white/15"
              style={{ backdropFilter: 'blur(4px)' }}>
              <ChevronRight size={16} />
            </button>
          </>
        )}
      </div>
    );
  };

  const CategoryGrid = () => {
    if (!categories.length) return null;
    const displayCats = categories.slice(0, 12);
    return (
      <section>
        <div className="flex items-center justify-between mb-4 flex-wrap">
          <h2 className="text-lg font-bold text-txt-primary">Категории</h2>
            <button onClick={() => navigate('/shop?all_categories=1')} className="text-xs font-medium hover:underline text-dv-gold">
              Все категории <ChevronRight size={14} className="inline" />
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {displayCats.map((cat) => (
            <button key={cat.id} onClick={() => { setSelectedCat(cat.slug); navigate(`/shop?category=${cat.slug}`); }}
              className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all group bg-surface-1 hover:bg-surface-2 border border-bdr-subtle">
              <div className="w-12 h-12 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform bg-dv-gold/10 text-dv-gold">
                <Package size={20} />
              </div>
              <span className="text-xs font-medium text-center leading-tight text-txt-primary">{cat.name}</span>
              {cat._count && <span className="text-[10px] text-txt-muted">{cat._count.products} товаров</span>}
            </button>
          ))}
        </div>
      </section>
    );
  };

  const PromoBar = () => {
    if (!promotions.length) return null;
    const promo = promotions[0];
    return (
      <div className="rounded-xl p-4 flex items-center justify-between bg-gradient-to-br from-dv-gold-from to-dv-gold-to">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-txt-ghost">
            <Zap size={20} className="text-txt-primary" />
          </div>
          <div>
            <p className="text-txt-primary font-bold text-sm">{promo.title}</p>
            {promo.description && <p className="text-txt-primary/70 text-xs">{promo.description}</p>}
          </div>
        </div>
        <Badge variant="default" className="text-xs font-bold whitespace-nowrap bg-surface-0 text-dv-gold">
          {promo.discountPercent ? `-${promo.discountPercent}%` : 'Скидка'}
        </Badge>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="max-w-full overflow-x-hidden mx-auto px-4 py-8 space-y-8 sm:max-w-7xl">
        <div className="rounded-2xl animate-pulse bg-surface-1" style={{ height: 260 }} />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-surface-1">
              <div className="w-12 h-12 rounded-full bg-surface-2" />
              <div className="h-3 w-16 rounded bg-surface-2" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl overflow-hidden bg-surface-1">
              <div className="aspect-square animate-pulse bg-surface-2" />
              <div className="p-3 space-y-2">
                <div className="h-3 w-12 rounded animate-pulse bg-surface-2" />
                <div className="h-4 w-full rounded animate-pulse bg-surface-2" />
                <div className="h-3 w-24 rounded animate-pulse bg-surface-2" />
                <div className="h-6 w-20 rounded animate-pulse bg-surface-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-full overflow-x-hidden mx-auto px-4 py-6 space-y-8 pb-24 sm:max-w-7xl">
      {/* --- Top Bar --- */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 relative">
          <form onSubmit={handleSearch}>
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Поиск товаров, брендов..."
              className="w-full h-10 min-h-11 pl-9 pr-3 rounded-xl border border-bdr-subtle bg-surface-2 text-[13px] text-txt-primary outline-none placeholder:text-txt-muted focus:border-dv-gold/50 transition-colors" />
          </form>
        </div>
        <div className="relative">
          <button onClick={() => setCityOpen(!cityOpen)}
            className={cn(
              'flex items-center gap-1.5 h-10 px-3 rounded-xl border border-bdr-subtle bg-surface-2 text-xs font-medium transition-colors whitespace-nowrap min-h-11',
              city ? 'text-txt-primary' : 'text-txt-muted',
            )}>
            <MapPin size={14} className={city ? 'text-dv-gold' : ''} />
            {city || 'Весь Казахстан'}
            <ChevronDown size={12} className="text-txt-muted" />
          </button>
          {cityOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setCityOpen(false)} />
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="absolute right-0 top-full mt-1 z-50 w-64 rounded-xl p-2 shadow-2xl bg-surface-1 border border-bdr"
                style={{ maxHeight: 320, overflowY: 'auto' }}>
                <button onClick={() => { updateCity(''); setCityOpen(false) }}
                  className={cn(
                    'w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors',
                    !city ? 'bg-dv-gold/10 text-dv-gold' : 'text-txt-muted',
                  )}>
                  Весь Казахстан
                </button>
                <div className="flex flex-wrap gap-1 my-2 px-1">
                  {KZ_POPULAR_CITIES.filter(c => !city || city === c).slice(0, 6).map(c => (
                    <button key={c} onClick={() => { updateCity(c); setCityOpen(false) }}
                      className={cn(
                        'px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors',
                        city === c ? 'bg-dv-gold/15 text-dv-gold' : 'bg-surface-2 text-txt-muted',
                      )}>
                      {c}
                    </button>
                  ))}
                </div>
                <div className="border-t border-bdr-subtle" />
                <select value={city} onChange={(e) => { updateCity(e.target.value); setCityOpen(false) }}
                  className="w-full mt-2 rounded-lg px-3 py-1.5 text-xs outline-none min-h-11 bg-surface-2 border border-bdr-subtle text-txt-primary">
                  {KZ_CITY_OPTIONS.map(o => (
                    <option key={o.value} value={o.value} className="bg-surface-1">{o.label}</option>
                  ))}
                </select>
              </motion.div>
            </>
          )}
        </div>
        <button onClick={() => setShowCart(true)}
          className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors min-h-11 bg-surface-2 border border-bdr-subtle">
          <ShoppingCart size={18} className="text-txt-muted" />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-txt-primary text-[10px] font-bold flex items-center justify-center bg-dv-gold">
              {cartCount > 99 ? '99+' : cartCount}
            </span>
          )}
        </button>
        <button onClick={() => navigate('/supplier')}
          className="flex items-center gap-1.5 h-10 px-3 rounded-xl text-xs font-medium whitespace-nowrap transition-colors min-h-11 bg-dv-gold/10 border border-dv-gold/30 text-dv-gold">
          <Store size={14} /> Стать поставщиком
        </button>
      </div>

      {/* --- Banner --- */}
      <BannerCarousel />

      {/* --- Promo Bar --- */}
      <PromoBar />

      {/* --- Categories --- */}
      <CategoryGrid />

      {/* --- Promoted (discounted) --- */}
      {promotedProducts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4 flex-wrap">
            <h2 className="text-lg font-bold text-txt-primary flex items-center gap-2">
              <Zap size={18} className="text-error" /> Хиты продаж
            </h2>
            <button onClick={() => navigate('/shop?sort=price_asc')} className="text-xs font-medium hover:underline text-dv-gold">
              Все товары <ChevronRight size={14} className="inline" />
            </button>
          </div>
          <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {promotedProducts.map((p) => <ProductCard key={p.id} product={p} />)}
          </motion.div>
        </section>
      )}

      {/* --- AI Recommendations --- */}
      {recommendations.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4 flex-wrap">
            <h2 className="text-lg font-bold text-txt-primary flex items-center gap-2">
              <Sparkles size={18} className="text-info" /> Рекомендуем
            </h2>
          </div>
          <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {recommendations.map((p) => <ProductCard key={p.id} product={p} />)}
          </motion.div>
        </section>
      )}

      {/* --- Featured --- */}
      {featuredProducts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4 flex-wrap">
            <h2 className="text-lg font-bold text-txt-primary flex items-center gap-2">
              <TrendingUp size={18} className="text-dv-gold" /> Популярные бренды
            </h2>
            <button onClick={() => navigate('/shop?sort=rating')} className="text-xs font-medium hover:underline text-dv-gold">
              Все бренды <ChevronRight size={14} className="inline" />
            </button>
          </div>
          <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {featuredProducts.map((p) => <ProductCard key={p.id} product={p} />)}
          </motion.div>
        </section>
      )}

      {/* --- All Products --- */}
      <section>
        <div className="flex items-center justify-between mb-4 flex-wrap">
          <h2 className="text-lg font-bold text-txt-primary">Все товары</h2>
          <div className="flex items-center gap-2 flex-wrap">
            {/* The <option> background has to stay inline — browsers do not apply
                utility classes to the native popup — but it reads the theme
                variable instead of a hardcoded navy, so the list is legible in
                both themes. */}
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="min-h-11 rounded-lg border border-bdr-subtle bg-surface-2 px-2 py-1 text-xs text-txt-primary outline-none">
              <option value="" style={OPTION_STYLE}>Сортировка</option>
              <option value="price_asc" style={OPTION_STYLE}>Сначала дешевле</option>
              <option value="price_desc" style={OPTION_STYLE}>Сначала дороже</option>
              <option value="rating" style={OPTION_STYLE}>По рейтингу</option>
            </select>
          </div>
        </div>
        {filteredProducts.length === 0 ? (
          <EmptyState icon={<Package size={32} />} title="Ничего не найдено" description="Попробуйте изменить параметры поиска" />
        ) : (
          <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.03 } } }}
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map((p) => <ProductCard key={p.id} product={p} />)}
          </motion.div>
        )}
      </section>

      {/* --- Cart Sidebar --- */}
      <AnimatePresence>
        {showCart && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex justify-end bg-black/60" style={{ backdropFilter: 'blur(8px)' }}
            onClick={() => setShowCart(false)}>
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-full h-full overflow-y-auto sm:max-w-sm bg-surface-1 border-l border-bdr"
              onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 z-10 p-4 flex items-center justify-between bg-surface-1 border-b border-bdr-subtle">
                <h2 className="font-bold text-lg text-txt-primary">Корзина</h2>
                <button aria-label="Close cart" onClick={() => setShowCart(false)}><X size={20} className="text-txt-muted" /></button>
              </div>
              {cart.length === 0 ? (
                <EmptyState icon={<ShoppingCart size={32} />} title="Корзина пуста" description="Добавьте товары из каталога" className="py-12" />
              ) : (
                <div className="p-4 space-y-3">
                  {cart.map((item) => (
                    <div key={item.id} className="flex gap-3 rounded-xl p-3 bg-surface-1">
                      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-surface-1">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-txt-ghost">
                            <Package size={20} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-txt-primary truncate">{item.name}</p>
                        <p className="text-xs text-txt-muted">{item.brand}</p>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center rounded-lg overflow-hidden border border-bdr-subtle">
                            <button aria-label="Decrease quantity" onClick={() => updateQty(item.id, item.qty - 1)}
                              className="w-7 h-7 flex items-center justify-center transition-colors text-txt-muted"
                             ><Minus size={12} /></button>
                            <span className="w-7 h-7 flex items-center justify-center text-xs font-medium text-txt-primary border-x border-bdr-subtle"
                             >{item.qty}</span>
                            <button aria-label="Increase quantity" onClick={() => updateQty(item.id, item.qty + 1)}
                              className="w-7 h-7 flex items-center justify-center transition-colors text-txt-muted"
                             ><Plus size={12} /></button>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-dv-gold">{(item.price * item.qty).toLocaleString()} ₸</p>
                            <button onClick={() => removeFromCart(item.id)} className="text-[10px] hover:underline text-error"
                             >Удалить</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="pt-3 mt-3 border-t border-bdr-subtle">
                    <div className="flex justify-between mb-3">
                      <span className="text-txt-muted">Цена:</span>
                      <span className="text-lg font-bold text-dv-gold">{cartTotal.toLocaleString()} ₸</span>
                    </div>
                    <Button variant="primary" className="w-full bg-dv-gold text-dv-gold-on" onClick={() => { setShowCart(false); navigate('/shop/checkout'); }}
                     >
                       Оформить заказ
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
