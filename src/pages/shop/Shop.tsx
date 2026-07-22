import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, Search, Heart, Star, Package, Truck, TrendingUp,
  X, Plus, Minus, Eye, Sparkles, BarChart3, AlertTriangle, ShoppingBag,
  Brain, ArrowUpDown,
} from 'lucide-react';
import { tg } from '../../utils/constants';
import * as api from '../../utils/api';
import { useCart } from '@/store/cart.store';
import { useAuth, canManageClinicSettings } from '@/store/auth.store';
import { Button } from '../../components/ui/ds/Button';
import { Card, CardContent } from '../../components/ui/ds/Card';
import { Input } from '../../components/ui/ds/Input';
import { Badge } from '../../components/ui/ds/Badge';
import { EmptyState } from '../../components/ui/ds/EmptyState';
import { StatCard, PageHeader } from '../../components/ui/ds/StatCard';
import { estimateCashbackBps, formatCashbackPercent } from '@/lib/dentcash';
import { buildClinicRestockSuggestions } from '@/lib/inventory-shop-match';
import { CityFilter } from '@/components/ui/CityFilter';
import type { InventoryItem } from '@/types';

interface ShopProductItem {
  id: string;
  name: string;
  brand: string;
  price: number;
  old_price?: number;
  rating: number;
  review_count: number;
  stock: number;
  min_stock: number;
  category_id: string;
  category_name: string;
  description?: string;
  tags?: string;
  supplier_id?: string;
  supplier_name?: string;
  supplier_status?: string;
  own_brand?: boolean;
  created_at?: string;
  image_url?: string | null;
  imageUrl?: string | null;
}

interface ShopCategory {
  id: string;
  name: string;
  icon: string;
}

interface ShopSupplier {
  id: string;
  name: string;
  rating?: number;
  status?: string;
  product_count?: number;
}

interface AiResponse {
  query: string;
  results: ShopProductItem[];
  summary: string;
}

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } } };
const scaleIn = { hidden: { opacity: 0, scale: 0.92 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } } };

const SORT_OPTIONS = [
  { value: '', label: 'По рейтингу' },
  { value: 'price_asc', label: 'Сначала дешевле' },
  { value: 'price_desc', label: 'Сначала дороже' },
  { value: 'newest', label: 'Новинки' },
];

export default function Shop() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { cart, favorites, cartCount, cartTotal, addToCart, toggleFav, updateQty, removeFromCart } = useCart();
  const { role, user, isAuthenticated, activeMembership } = useAuth();
  const clinicId = user?.clinicId || activeMembership?.clinicId || '';
  const canSeeClinicRestock =
    isAuthenticated &&
    !!clinicId &&
    (canManageClinicSettings(role) ||
      canManageClinicSettings(activeMembership?.role) ||
      String(role || '').toLowerCase() === 'buyer');
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [products, setProducts] = useState<ShopProductItem[]>([]);
  const [suppliers, setSuppliers] = useState<ShopSupplier[]>([]);
  const [clinicInventory, setClinicInventory] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState(() => searchParams.get('q') || '');
  const [city, setCity] = useState(() => searchParams.get('city') || '');
  const [selectedCat, setSelectedCat] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCart, setShowCart] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<AiResponse | null>(null);
  const [showAi, setShowAi] = useState(false);
  const [restockDismissed, setRestockDismissed] = useState(false);

  useEffect(() => {
    const q = searchParams.get('q') || '';
    const c = searchParams.get('city') || '';
    if (q !== search) setSearch(q);
    if (c !== city) setCity(c);
  }, [searchParams]);

  useEffect(() => {
    setLoading(true);
    const params = city ? { city, limit: '200' } : { limit: '200' };
    Promise.all([
      api.getShopCategories(params),
      api.getShopProducts(params),
      api.getShopSuppliers(city ? { city } : {}),
    ])
      .then(([c, p, s]) => { setCategories(c); setProducts(p); setSuppliers(s); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [city]);

  const updateCity = (nextCity: string) => {
    setCity(nextCity);
    const next = new URLSearchParams(searchParams);
    if (nextCity) next.set('city', nextCity);
    else next.delete('city');
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (!canSeeClinicRestock || !clinicId) {
      setClinicInventory([]);
      return;
    }
    let cancelled = false;
    api.getInventory(clinicId)
      .then((rows) => { if (!cancelled) setClinicInventory(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (!cancelled) setClinicInventory([]); });
    return () => { cancelled = true; };
  }, [canSeeClinicRestock, clinicId]);

  const clinicRestock = useMemo(
    () => (canSeeClinicRestock
      ? buildClinicRestockSuggestions(clinicInventory, products, { onlyWithMatches: true, limit: 5 })
      : []),
    [canSeeClinicRestock, clinicInventory, products],
  );

  const applyRestockQuery = (query: string) => {
    setSearch(query);
    const next = new URLSearchParams(searchParams);
    if (query) next.set('q', query);
    else next.delete('q');
    setSearchParams(next, { replace: true });
  };

  const filteredProducts = useMemo(() => {
    let list = [...products];
    if (selectedCat) list = list.filter(p => p.category_id === selectedCat);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name?.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
    }
    if (sortBy === 'price_asc') list.sort((a, b) => a.price - b.price);
    else if (sortBy === 'price_desc') list.sort((a, b) => b.price - a.price);
    else if (sortBy === 'newest') list.sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime());
    else list.sort((a, b) => b.rating - a.rating);
    return list;
  }, [products, selectedCat, search, sortBy]);

  const handleAiSearch = () => {
    if (!aiQuery.trim()) return;
    const q = aiQuery.toLowerCase();
    const matched = products.filter(p =>
      p.description?.toLowerCase().includes(q) ||
      p.tags?.toLowerCase().includes(q) ||
      p.name?.toLowerCase().includes(q) ||
      p.brand?.toLowerCase().includes(q)
    ).slice(0, 4);

    setAiResponse({
      query: aiQuery,
      results: matched,
      summary: matched.length > 0
        ? `Нашёл ${matched.length} товаров по запросу «${aiQuery}». Вот лучшие варианты:`
        : `К сожалению, точных совпадений не найдено. Попробуйте другой запрос или выберите категорию.`,
    });
  };

  // Seller warehouse stock is managed in /supplier — buyers only care about availability.
  const outOfStockProducts = products.filter(p => p.stock <= 0);
  const verifiedSuppliers = suppliers.filter((s) => s.status === 'VERIFIED' || s.status === 'OFFICIAL_PARTNER' || !s.status);
  const hotProducts = [...products].filter((p) => p.stock > 0).sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 4);
  const promoProducts = products.filter((p) => (p.description || '').includes('[АКЦИЯ]') || !!p.old_price).slice(0, 4);

  return (
    <div className="p-6 min-h-screen">
      <PageHeader
        title="Маркетплейс"
        subtitle="Закупка расходников с кэшбэком DentCash (1–7%)"
        icon={<ShoppingBag size={22} />}
        actions={
          <>
            {isAuthenticated && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/profile')}
              >
                Мой кэшбэк
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/shop/suppliers')}
            >
              Поставщики
            </Button>
            {isAuthenticated && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/supplier')}
              >
                Кабинет продавца
              </Button>
            )}
            <Button
              variant={showAi ? 'outline' : 'ghost'}
              size="sm"
              icon={<Brain size={15} />}
              onClick={() => setShowAi(!showAi)}
            >
              AI Ассистент
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<ShoppingCart size={15} />}
              onClick={() => setShowCart(true)}
              className="relative"
            >
              Корзина
              {cartCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-success px-1 text-[10px] font-bold text-white"
                >
                  {cartCount}
                </motion.span>
              )}
            </Button>
          </>
        }
      />

      <AnimatePresence>
        {showAi && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-5"
          >
            <Card className="bg-gradient-to-br from-[var(--gold)]/5 to-[var(--sapphire)]/10 border-[var(--gold)]/20">
              <CardContent>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--gold)]/20">
                    <Brain size={20} className="text-[var(--gold)]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white m-0">AI Shopping Assistant</h3>
                    <p className="text-xs text-[var(--slate)] m-0">Спросите что нужно — AI подберёт лучшие товары</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <input
                    value={aiQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAiQuery(e.target.value)}
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleAiSearch()}
                    placeholder="Например: лучший композит для фронтальных реставраций..."
                    className="flex-1 !rounded-xl"
                  />
                  <Button variant="primary" size="md" icon={<Sparkles size={15} />} onClick={handleAiSearch}>
                    Найти
                  </Button>
                </div>
                {aiResponse && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
                    <p className="text-xs text-[var(--slate-light)] mb-3">{aiResponse.summary}</p>
                    {aiResponse.results.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                        {aiResponse.results.map(p => (
                          <motion.div
                            key={p.id}
                            whileHover={{ scale: 1.02 }}
                            onClick={() => navigate(`/shop/${p.id}`)}
                            className="bg-white/5 border border-[var(--border-subtle)] rounded-xl p-3 cursor-pointer transition-all hover:bg-white/[0.08]"
                          >
                            <p className="text-xs font-bold text-white m-0">{p.brand} {p.name}</p>
                            <p className="text-[11px] text-[var(--slate)] mt-1 m-0">{tg(p.price)}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <Star size={11} className="text-[var(--gold)] fill-[var(--gold)]" />
                              <span className="text-[11px] text-[var(--gold)]">{p.rating}</span>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {!restockDismissed && clinicRestock.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-4 py-3"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-txt-primary m-0">
                    На складе клиники заканчивается {clinicRestock.length} позици
                    {clinicRestock.length === 1 ? 'я' : clinicRestock.length < 5 ? 'и' : 'й'}
                  </p>
                  <p className="text-[11px] text-txt-muted m-0 mt-0.5">
                    Подобрали товары и аналоги в маркетплейсе для пополнения.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRestockDismissed(true)}
                  className="text-txt-ghost hover:text-txt-primary p-0.5"
                  aria-label="Скрыть"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {clinicRestock.map((row) => {
                  const best = row.matches[0];
                  return (
                    <div
                      key={row.item.id || row.query}
                      className="flex flex-wrap items-center gap-2 rounded-lg bg-black/20 border border-white/[0.05] px-2.5 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-txt-primary m-0 truncate">
                          <span className="font-semibold">{row.item.name}</span>
                          <span className="text-txt-muted">
                            {' '}· {row.item.quantity ?? 0}/{row.min} {row.item.unit || 'шт'}
                          </span>
                        </p>
                        {best && (
                          <p className="text-[11px] text-txt-muted m-0 truncate">
                            {best.kind === 'exact' ? 'Есть в магазине' : 'Аналог'}: {best.brand ? `${best.brand} · ` : ''}{best.name}
                            {(best.stock || 0) > 0 ? '' : ' (нет в наличии у продавца)'}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => applyRestockQuery(row.query)}
                      >
                        Показать
                      </Button>
                      {best && (best.stock || 0) > 0 && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => navigate(`/shop/${best.id}`)}
                        >
                          Купить
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => navigate('/crm/inventory?filter=lowStock')}
                className="text-[11px] text-dv-gold hover:underline bg-transparent border-none cursor-pointer p-0"
              >
                Открыть склад клиники
              </button>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex gap-2.5 mb-4 flex-wrap items-center"
      >
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--slate)]" />
          <input
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const v = e.target.value;
              setSearch(v);
              const next = new URLSearchParams(searchParams);
              if (v) next.set('q', v);
              else next.delete('q');
              setSearchParams(next, { replace: true });
            }}
            placeholder="Поиск товаров, брендов..."
            className="w-full !pl-10 !rounded-xl"
          />
        </div>
        <select
          className="dv-select !w-auto !rounded-xl min-w-[160px]"
          value={sortBy}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSortBy(e.target.value)}
        >
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="mb-4 rounded-xl border border-bdr-subtle bg-white/[0.02] p-3"
      >
        <CityFilter
          label="Город доставки / склад поставщика"
          value={city}
          onChange={updateCity}
          showPopularChips
        />
        {city && (
          <p className="mt-2 text-2xs text-txt-muted m-0">
            Показаны поставщики и товары по городу «{city}». Смените на «Весь Казахстан», чтобы видеть весь каталог.
          </p>
        )}
      </motion.div>

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="flex gap-2 mb-5 overflow-x-auto pb-1 flex-wrap"
      >
        <motion.button
          variants={fadeUp}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setSelectedCat('')}
          className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap border transition-all ${
            !selectedCat
              ? 'border-[var(--gold)]/60 bg-[var(--gold)]/10 text-[var(--gold)]'
              : 'border-[var(--border-subtle)] bg-white/[0.03] text-[var(--slate)] hover:bg-white/5'
          }`}
        >
          Все категории
        </motion.button>
        {categories.map(cat => (
          <motion.button
            key={cat.id}
            variants={fadeUp}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelectedCat(selectedCat === cat.id ? '' : cat.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap border transition-all ${
              selectedCat === cat.id
                ? 'border-[var(--gold)]/60 bg-[var(--gold)]/10 text-[var(--gold)]'
                : 'border-[var(--border-subtle)] bg-white/[0.03] text-[var(--slate)] hover:bg-white/5'
            }`}
          >
            <span>{cat.icon}</span> {cat.name}
          </motion.button>
        ))}
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
        {[
          { label: 'Всего товаров', value: products.length, icon: Package },
          { label: 'Категорий', value: categories.length, icon: BarChart3 },
          { label: 'Поставщиков', value: suppliers.length, icon: Truck },
          { label: 'Нет в наличии', value: outOfStockProducts.length, icon: AlertTriangle },
        ].map((s, i) => (
          <StatCard key={i} label={s.label} value={s.value} icon={<s.icon size={18} />} />
        ))}
      </div>

      {!loading && verifiedSuppliers.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs uppercase tracking-wide text-[var(--slate)] font-semibold">Проверенные поставщики</p>
            <button onClick={() => navigate('/shop/suppliers')} className="text-xs text-[var(--gold)] bg-transparent border-none cursor-pointer">
              Все →
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {verifiedSuppliers.slice(0, 8).map((s) => (
              <button
                key={s.id}
                onClick={() => navigate('/shop/suppliers')}
                className="shrink-0 rounded-xl border border-[var(--border-subtle)] bg-white/[0.03] px-3 py-2 text-left hover:border-[var(--gold)]/40 transition-colors"
              >
                <p className="text-xs font-semibold text-white m-0">{s.name}</p>
                <p className="text-[10px] text-[var(--slate)] m-0 mt-0.5">
                  ★ {s.rating ?? 4.8} · {s.product_count ?? 0} SKU
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {!loading && (hotProducts.length > 0 || promoProducts.length > 0) && !search && !selectedCat && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          {hotProducts.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--slate)] font-semibold mb-3 flex items-center gap-1.5">
                  <TrendingUp size={12} className="text-[var(--gold)]" /> Сейчас берут клиники
                </p>
                <div className="space-y-2">
                  {hotProducts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => navigate(`/shop/${p.id}`)}
                      className="w-full flex justify-between gap-2 text-left bg-transparent border-none cursor-pointer"
                    >
                      <span className="text-sm text-white truncate">{p.name}</span>
                      <span className="text-xs text-[var(--gold)] shrink-0">{tg(p.price)}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {promoProducts.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--slate)] font-semibold mb-3 flex items-center gap-1.5">
                  <Sparkles size={12} className="text-[var(--gold)]" /> Акции поставщиков
                </p>
                <div className="space-y-2">
                  {promoProducts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => navigate(`/shop/${p.id}`)}
                      className="w-full flex justify-between gap-2 text-left bg-transparent border-none cursor-pointer"
                    >
                      <span className="text-sm text-white truncate">{p.name}</span>
                      <span className="text-xs text-success shrink-0">акция</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-9 w-9 rounded-full border-[3px] border-[var(--gold)]/30 border-t-[var(--gold)] animate-spin" />
        </div>
      ) : (
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          {filteredProducts.map(product => {
            const isFav = favorites.some(f => f.id === product.id);
            return (
              <motion.div
                key={product.id}
                variants={scaleIn}
                whileHover={{ y: -4 }}
                onClick={() => navigate(`/shop/${product.id}`)}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] overflow-hidden cursor-pointer transition-all duration-250 hover:shadow-[0_8px_30px_rgba(201,169,110,0.08)]"
              >
                <div className="relative h-40 bg-gradient-to-br from-[var(--sapphire)]/20 to-[var(--gold)]/10 flex items-center justify-center overflow-hidden">
                  {(product.image_url || product.imageUrl) ? (
                    <img
                      src={product.image_url || product.imageUrl || ''}
                      alt={product.name}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-3 text-center">
                      <Package size={36} className="text-[var(--gold)]/45" />
                      <span className="text-[10px] font-medium text-txt-muted line-clamp-2">
                        {product.brand || product.category_name || 'DentVision Shop'}
                      </span>
                    </div>
                  )}
                  {product.old_price && (
                    <div className="absolute top-2.5 left-2.5 bg-error text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                      -{Math.round((1 - product.price / product.old_price) * 100)}%
                    </div>
                  )}
                  <div
                    className={
                      product.old_price
                        ? 'absolute top-2.5 left-2.5 mt-6 bg-emerald-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md'
                        : 'absolute top-2.5 left-2.5 bg-emerald-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md'
                    }
                  >
                    Кэшбэк {formatCashbackPercent(estimateCashbackBps({
                      category: product.category_name,
                      name: product.name,
                      promo: !!product.old_price || (product.description || '').includes('[АКЦИЯ]'),
                    }))}
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); toggleFav(product); }}
                    className="absolute top-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-lg border-none bg-black/30 hover:bg-black/40 cursor-pointer"
                  >
                    <Heart size={14} className={isFav ? 'text-error fill-error' : 'text-white'} />
                  </motion.button>
                  {product.stock <= 0 && (
                    <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 bg-error/20 border border-error/40 text-error text-[10px] font-semibold px-2 py-0.5 rounded-md">
                      <AlertTriangle size={10} /> Нет в наличии
                    </div>
                  )}
                </div>

                <div className="p-3.5">
                  <div className="text-[10px] text-[var(--gold)] font-semibold mb-1 uppercase tracking-wide">
                    {product.brand || product.supplier_name || 'Поставщик'} · {product.category_name}
                  </div>
                  <h3 className="text-sm font-bold text-white leading-snug mb-1.5 m-0">
                    {product.name}
                  </h3>
                  {product.supplier_name && (
                    <p className="text-[11px] text-[var(--slate)] m-0 mb-1.5">
                      {product.supplier_status === 'VERIFIED' || product.supplier_status === 'OFFICIAL_PARTNER' ? '✓ ' : ''}
                      {product.supplier_name}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="flex items-center gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={11} className={`text-[var(--gold)] ${i < Math.round(product.rating) ? 'fill-[var(--gold)]' : ''}`} />
                      ))}
                    </div>
                    <span className="text-[11px] text-[var(--slate)]">({product.review_count})</span>
                    <Badge variant={product.stock > 0 ? 'success' : 'error'} size="xs">
                      {product.stock > 0 ? `В наличии: ${product.stock}` : 'Нет в наличии'}
                    </Badge>
                  </div>
                  <div className="flex items-baseline gap-2 mb-2.5">
                    <span className="text-lg font-extrabold text-white">{tg(product.price)}</span>
                    {product.old_price && (
                      <span className="text-xs text-[var(--slate)] line-through">{tg(product.old_price)}</span>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        addToCart({
                          id: product.id,
                          name: product.name,
                          brand: product.brand,
                          price: product.price,
                          imageUrl: product.image_url || product.imageUrl || null,
                          supplierId: product.supplier_id || null,
                          category: product.category_name || null,
                          ownBrand: !!product.own_brand,
                        });
                      }}
                      disabled={product.stock <= 0}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border-none transition-all ${
                        product.stock > 0
                          ? 'bg-gradient-to-r from-[var(--gold)] to-[var(--gold)]/dd text-[#0D1B2E] hover:shadow-glow-sm'
                          : 'bg-white/10 text-[var(--slate)] cursor-not-allowed'
                      }`}
                    >
                      <ShoppingCart size={13} /> {product.stock > 0 ? 'В корзину' : 'Нет в наличии'}
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e: React.MouseEvent) => { e.stopPropagation(); navigate(`/shop/${product.id}`); }}
                      className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-white/5 text-[var(--slate-light)] cursor-pointer hover:bg-white/[0.08]"
                    >
                      <Eye size={14} />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {!loading && filteredProducts.length === 0 && (
        <EmptyState
          icon={<Package size={32} />}
          title="Товары не найдены"
          description="Попробуйте изменить параметры поиска или выбрать другую категорию"
        />
      )}

      <AnimatePresence>
        {showCart && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCart(false)}
              className="fixed inset-0 bg-black/60 z-[100]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-[400px] max-w-[90vw] bg-[var(--navy)] border-l border-[var(--border-subtle)] z-[101] flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
                <h3 className="flex items-center gap-2 text-base font-bold text-white m-0">
                  <ShoppingCart size={18} className="text-[var(--gold)]" /> Корзина ({cartCount})
                </h3>
                <button onClick={() => setShowCart(false)} className="text-[var(--slate)] hover:text-white transition-colors bg-transparent border-none cursor-pointer">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {cart.length === 0 ? (
                  <EmptyState
                    icon={<ShoppingBag size={32} />}
                    title="Корзина пуста"
                    description="Добавьте товары из каталога"
                  />
                ) : cart.map(item => (
                  <div key={item.id} className="flex items-center gap-3 py-3 border-b border-[var(--border-subtle)] last:border-b-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-white m-0 truncate">{item.name}</p>
                      <p className="text-[11px] text-[var(--slate)] mt-0.5 m-0">{item.brand}</p>
                      <p className="text-[13px] font-bold text-[var(--gold)] mt-1 m-0">{tg(item.price)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQty(item.id, Math.max(1, item.qty - 1))}
                        className="flex h-[26px] w-[26px] items-center justify-center rounded-md border border-[var(--border-subtle)] bg-white/5 text-white cursor-pointer hover:bg-white/10 transition-colors"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="text-[13px] font-bold text-white min-w-[20px] text-center">{item.qty}</span>
                      <button
                        onClick={() => updateQty(item.id, item.qty + 1)}
                        className="flex h-[26px] w-[26px] items-center justify-center rounded-md border border-[var(--border-subtle)] bg-white/5 text-white cursor-pointer hover:bg-white/10 transition-colors"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-error hover:text-error/80 transition-colors bg-transparent border-none cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              {cart.length > 0 && (
                <div className="px-5 py-4 border-t border-[var(--border-subtle)]">
                  <div className="flex justify-between mb-3">
                    <span className="text-sm text-[var(--slate-light)]">Итого:</span>
                    <span className="text-lg font-extrabold text-white">{tg(cartTotal)}</span>
                  </div>
                  <Button variant="primary" size="lg" className="w-full" onClick={() => navigate('/shop/checkout')}>
                    Оформить заказ
                  </Button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
