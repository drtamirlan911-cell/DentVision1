import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, Search, Heart, Star, Package, Truck, TrendingUp,
  X, Plus, Minus, Eye, Sparkles, Zap, ChevronRight, ChevronLeft, Check,
  Clock, Shield, ChevronDown, MapPin, SlidersHorizontal, Building2, Wallet,
} from 'lucide-react';
import { T } from '../../lib/design-tokens';
import * as api from '../../utils/api';
import { useCart } from '@/store/cart.store';
import { useAuth, canManageClinicSettings } from '@/store/auth.store';
import { Button } from '../../components/ui/ds/Button';
import { Badge } from '../../components/ui/ds/Badge';
import { EmptyState } from '../../components/ui/ds/EmptyState';
import { CityFilter } from '@/components/ui/CityFilter';
import { cn } from '@/lib/utils';
import type { InventoryItem } from '@/types';

interface ProductItem {
  id: string; name: string; brand: string; price: number; old_price?: number;
  rating: number | null; review_count: number; stock: number; min_stock: number;
  category_id: string; category_name: string; category_slug?: string;
  description?: string; tags?: string[]; supplier_id?: string; supplier_name?: string;
  supplier_status?: string; own_brand?: boolean; image_url?: string | null;
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

const G = T.gold;
const S = T.slate;
const BG = T.bg;
const CARD = T.card;
const CARD_HOV = T.cardHov;
const BDR = T.border;
const BDR_SUB = T.borderSub;

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, duration: 0.4 } };

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
  const [city, setCity] = useState(() => searchParams.get('city') || '');
  const [selectedCat, setSelectedCat] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [loading, setLoading] = useState(true);
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
        className="group relative rounded-xl overflow-hidden transition-all duration-300 cursor-pointer"
        style={{ background: CARD, border: `1px solid ${BDR_SUB}` }}
        onClick={() => navigate(`/shop/${product.id}`)}
        onMouseEnter={(e) => e.currentTarget.style.background = CARD_HOV}
        onMouseLeave={(e) => e.currentTarget.style.background = CARD}
      >
        <div className="relative aspect-square overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
          {imgSrc ? (
            <img src={imgSrc} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.08)' }}>
              <Package size={48} />
            </div>
          )}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {hasDiscount && (
              <span className="text-white text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ background: T.ruby }}>-{discountPercent}%</span>
            )}
            {product.own_brand && (
              <span className="text-white text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ background: G }}>DentVision</span>
            )}
            {product.stock <= 0 && (
              <span className="text-white text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ background: '#1a1a2e' }}>��� � �������</span>
            )}
          </div>
          <button onClick={(e) => { e.stopPropagation(); toggleFav(product as any); }}
            className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
            <Heart size={14} className={isFav ? 'fill-red-500 text-red-500' : 'text-gray-400'} />
          </button>
        </div>
        <div className="p-3 space-y-2">
          {product.brand && (
            <p className="text-[10px] font-medium uppercase tracking-wider truncate" style={{ color: S }}>{product.brand}</p>
          )}
          <h3 className="text-sm font-semibold leading-tight line-clamp-2 min-h-[2.5rem] transition-colors"
            style={{ color: '#FFFFFF' }}
            onClick={(e) => { e.stopPropagation(); navigate(`/shop/${product.id}`); }}>
            {product.name}
          </h3>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center">
              <Star size={12} className={product.rating ? 'fill-yellow-400 text-yellow-400' : ''} style={{ color: product.rating ? undefined : 'rgba(255,255,255,0.1)' }} />
              <span className="text-xs font-medium ml-1" style={{ color: S }}>{product.rating?.toFixed(1) || '�'}</span>
            </div>
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>({product.review_count})</span>
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.15)' }}>�</span>
            <span className="text-[10px]" style={{ color: product.stock > 0 ? T.emerald : T.ruby }}>
              {product.stock > 0 ? `� �������: ${product.stock}` : '���'}
            </span>
          </div>
          <div className="flex items-center justify-between pt-1">
            <div>
              <span className="text-lg font-bold" style={{ color: G }}>{product.price.toLocaleString()} ?</span>
              {hasDiscount && (
                <span className="text-xs line-through ml-2" style={{ color: S }}>{product.old_price!.toLocaleString()} ?</span>
              )}
            </div>
            <button onClick={(e) => { e.stopPropagation(); addToCart(product); }}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-40"
              style={{ background: G, color: T.bg }}
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
      <div className="relative overflow-hidden rounded-2xl" style={{ minHeight: 260, background: BG }}>
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
              ������� <ChevronRight size={16} />
            </Button>
          )}
        </div>
        {banners.length > 1 && (
          <>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
              {banners.map((_, i) => (
                <button key={i} onClick={() => setActiveBanner(i)}
                  className={`w-2 h-2 rounded-full transition-all ${i === activeBanner ? 'w-6' : ''}`}
                  style={{ background: i === activeBanner ? G : 'rgba(255,255,255,0.3)' }} />
              ))}
            </div>
            <button onClick={() => setActiveBanner((p) => (p - 1 + banners.length) % banners.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full flex items-center justify-center text-white"
              style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)' }}>
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setActiveBanner((p) => (p + 1) % banners.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full flex items-center justify-center text-white"
              style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)' }}>
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">���������</h2>
          <button onClick={() => navigate('/shop?all_categories=1')} className="text-xs font-medium hover:underline" style={{ color: G }}>
            ��� ��������� <ChevronRight size={14} className="inline" />
          </button>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {displayCats.map((cat) => (
            <button key={cat.id} onClick={() => { setSelectedCat(cat.slug); navigate(`/shop?category=${cat.slug}`); }}
              className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all group"
              style={{ background: CARD, border: `1px solid ${BDR_SUB}` }}
              onMouseEnter={(e) => e.currentTarget.style.background = CARD_HOV}
              onMouseLeave={(e) => e.currentTarget.style.background = CARD}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"
                style={{ background: 'rgba(201,169,110,0.1)', color: G }}>
                <Package size={20} />
              </div>
              <span className="text-xs font-medium text-center leading-tight text-white">{cat.name}</span>
              {cat._count && <span className="text-[10px]" style={{ color: S }}>{cat._count.products} �������</span>}
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
      <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #8B6F3E 0%, #C9A96E 100%)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
            <Zap size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">{promo.title}</p>
            {promo.description && <p className="text-white/70 text-xs">{promo.description}</p>}
          </div>
        </div>
        <Badge variant="default" className="text-xs font-bold whitespace-nowrap" style={{ background: T.bg, color: G }}>
          {promo.discountPercent ? `-${promo.discountPercent}%` : '�����'}
        </Badge>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <div className="rounded-2xl animate-pulse" style={{ background: CARD, height: 260 }} />
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2 p-3 rounded-xl" style={{ background: CARD }}>
              <div className="w-12 h-12 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
              <div className="h-3 w-16 rounded" style={{ background: 'rgba(255,255,255,0.05)' }} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl overflow-hidden" style={{ background: CARD }}>
              <div className="aspect-square animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
              <div className="p-3 space-y-2">
                <div className="h-3 w-12 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
                <div className="h-4 w-full rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
                <div className="h-3 w-24 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
                <div className="h-6 w-20 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8 pb-24">
      {/* --- Top Bar --- */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <form onSubmit={handleSearch}>
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: S }} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="����� �������, �������..."
              style={{
                width: '100%', height: 40, paddingLeft: 36, paddingRight: 12,
                background: 'rgba(255,255,255,0.05)', border: `1px solid ${BDR_SUB}`,
                color: '#fff', borderRadius: 12, fontSize: 13, outline: 'none'
              }}
              className="placeholder:text-[#7A8899] focus:border-[#C9A96E]/50 transition-colors" />
          </form>
        </div>
        <CityFilter value={city} onChange={updateCity} />
        <button onClick={() => setShowCart(true)}
          className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
          style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${BDR_SUB}` }}>
          <ShoppingCart size={18} style={{ color: S }} />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
              style={{ background: G }}>
              {cartCount > 99 ? '99+' : cartCount}
            </span>
          )}
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Zap size={18} style={{ color: T.ruby }} /> ������ � �����
            </h2>
            <button onClick={() => navigate('/shop?sort=price_asc')} className="text-xs font-medium hover:underline" style={{ color: G }}>
              ��� ����� <ChevronRight size={14} className="inline" />
            </button>
          </div>
          <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {promotedProducts.map((p) => <ProductCard key={p.id} product={p} />)}
          </motion.div>
        </section>
      )}

      {/* --- AI Recommendations --- */}
      {recommendations.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles size={18} style={{ color: T.purple }} /> ����������� ���
            </h2>
          </div>
          <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {recommendations.map((p) => <ProductCard key={p.id} product={p} />)}
          </motion.div>
        </section>
      )}

      {/* --- Featured --- */}
      {featuredProducts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp size={18} style={{ color: G }} /> ���������� ������
            </h2>
            <button onClick={() => navigate('/shop?sort=rating')} className="text-xs font-medium hover:underline" style={{ color: G }}>
              ��� ���������� <ChevronRight size={14} className="inline" />
            </button>
          </div>
          <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {featuredProducts.map((p) => <ProductCard key={p.id} product={p} />)}
          </motion.div>
        </section>
      )}

      {/* --- All Products --- */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">��� ������</h2>
          <div className="flex items-center gap-2">
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              style={{
                fontSize: 12, border: `1px solid ${BDR_SUB}`, borderRadius: 8,
                padding: '4px 8px', background: 'rgba(255,255,255,0.05)', color: '#fff', outline: 'none'
              }}>
              <option value="" style={{ background: '#0D1B2E', color: '#fff' }}>�������</option>
              <option value="price_asc" style={{ background: '#0D1B2E', color: '#fff' }}>������� �������</option>
              <option value="price_desc" style={{ background: '#0D1B2E', color: '#fff' }}>������� ������</option>
              <option value="rating" style={{ background: '#0D1B2E', color: '#fff' }}>�� ��������</option>
            </select>
          </div>
        </div>
        {filteredProducts.length === 0 ? (
          <EmptyState icon={<Package size={32} />} title="������ �� �������" description="���������� �������� ��������� ������" />
        ) : (
          <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.03 } } }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map((p) => <ProductCard key={p.id} product={p} />)}
          </motion.div>
        )}
      </section>

      {/* --- Cart Sidebar --- */}
      <AnimatePresence>
        {showCart && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
            onClick={() => setShowCart(false)}>
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-sm h-full overflow-y-auto" style={{ background: '#0D1B2E', borderLeft: `1px solid ${BDR}` }}
              onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 z-10 p-4 flex items-center justify-between" style={{ background: '#0D1B2E', borderBottom: `1px solid ${BDR_SUB}` }}>
                <h2 className="font-bold text-lg text-white">�������</h2>
                <button aria-label="Close cart" onClick={() => setShowCart(false)}><X size={20} style={{ color: S }} /></button>
              </div>
              {cart.length === 0 ? (
                <EmptyState icon={<ShoppingCart size={32} />} title="������� �����" description="�������� ������ �� ��������" className="py-12" />
              ) : (
                <div className="p-4 space-y-3">
                  {cart.map((item) => (
                    <div key={item.id} className="flex gap-3 rounded-xl p-3" style={{ background: CARD }}>
                      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center" style={{ color: 'rgba(255,255,255,0.1)' }}>
                            <Package size={20} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{item.name}</p>
                        <p className="text-xs" style={{ color: S }}>{item.brand}</p>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center rounded-lg overflow-hidden" style={{ border: `1px solid ${BDR_SUB}` }}>
                            <button aria-label="Decrease quantity" onClick={() => updateQty(item.id, item.qty - 1)}
                              className="w-7 h-7 flex items-center justify-center transition-colors"
                              style={{ color: S }}><Minus size={12} /></button>
                            <span className="w-7 h-7 flex items-center justify-center text-xs font-medium text-white"
                              style={{ borderLeft: `1px solid ${BDR_SUB}`, borderRight: `1px solid ${BDR_SUB}` }}>{item.qty}</span>
                            <button aria-label="Increase quantity" onClick={() => updateQty(item.id, item.qty + 1)}
                              className="w-7 h-7 flex items-center justify-center transition-colors"
                              style={{ color: S }}><Plus size={12} /></button>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold" style={{ color: G }}>{(item.price * item.qty).toLocaleString()} ?</p>
                            <button onClick={() => removeFromCart(item.id)} className="text-[10px] hover:underline"
                              style={{ color: T.ruby }}>�������</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="pt-3 mt-3" style={{ borderTop: `1px solid ${BDR_SUB}` }}>
                    <div className="flex justify-between mb-3">
                      <span style={{ color: S }}>�����:</span>
                      <span className="text-lg font-bold" style={{ color: G }}>{cartTotal.toLocaleString()} ?</span>
                    </div>
                    <Button variant="primary" className="w-full" onClick={() => { setShowCart(false); navigate('/shop/checkout'); }}
                      style={{ background: G, color: T.bg }}>
                      �������� �����
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
