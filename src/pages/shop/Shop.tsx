import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, Search, Heart, Star, Package, Truck, TrendingUp,
  X, Plus, Minus, Eye, Sparkles, BarChart3, AlertTriangle, ShoppingBag,
  Brain, ArrowUpDown,
} from 'lucide-react';
import { tg } from '../../utils/constants';
import * as api from '../../utils/api';
import { useCart } from '@/store/cart.store';
import { Button } from '../../components/ui/ds/Button';
import { Card, CardContent } from '../../components/ui/ds/Card';
import { Input } from '../../components/ui/ds/Input';
import { Badge } from '../../components/ui/ds/Badge';
import { EmptyState } from '../../components/ui/ds/EmptyState';
import { StatCard, PageHeader } from '../../components/ui/ds/StatCard';

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
}

interface ShopCategory {
  id: string;
  name: string;
  icon: string;
}

interface ShopSupplier {
  id: string;
  name: string;
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
  const { cart, favorites, cartCount, cartTotal, addToCart, toggleFav } = useCart();
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [products, setProducts] = useState<ShopProductItem[]>([]);
  const [suppliers, setSuppliers] = useState<ShopSupplier[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCart, setShowCart] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<AiResponse | null>(null);
  const [showAi, setShowAi] = useState(false);

  useEffect(() => {
    Promise.all([api.getShopCategories(), api.getShopProducts(), api.getShopSuppliers()])
      .then(([c, p, s]) => { setCategories(c); setProducts(p); setSuppliers(s); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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

  const lowStockProducts = products.filter(p => p.stock <= p.min_stock);

  return (
    <div className="p-6 min-h-screen">
      <PageHeader
        title="DentVision Shop"
        subtitle="Стоматологический маркетплейс"
        icon={<ShoppingBag size={22} />}
        actions={
          <>
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

      {lowStockProducts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 bg-error/10 border border-error/20 rounded-xl px-4 py-2.5 mb-4"
        >
          <AlertTriangle size={16} className="text-error" />
          <span className="text-xs text-[var(--slate-light)]">
            <strong className="text-error">Внимание:</strong> {lowStockProducts.length} товар(ов) требуют пополнения на складе
          </span>
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
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            placeholder="Поиск товаров, брендов..."
            className="w-full !pl-10 !rounded-xl"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSortBy(e.target.value)}
          className="!w-auto !rounded-xl min-w-[160px]"
        >
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
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
          { label: 'Нет в наличии', value: lowStockProducts.length, icon: AlertTriangle },
        ].map((s, i) => (
          <StatCard key={i} label={s.label} value={s.value} icon={<s.icon size={18} />} />
        ))}
      </div>

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
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] overflow-hidden cursor-pointer transition-all duration-250 hover:shadow-[0_8px_30px_rgba(201,169,110,0.08)]"
              >
                <div className="relative h-40 bg-gradient-to-br from-[var(--sapphire)]/20 to-[var(--gold)]/10 flex items-center justify-center">
                  <Package size={40} className="text-[var(--gold)]/40" />
                  {product.old_price && (
                    <div className="absolute top-2.5 left-2.5 bg-error text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                      -{Math.round((1 - product.price / product.old_price) * 100)}%
                    </div>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); toggleFav(product); }}
                    className="absolute top-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-lg border-none bg-black/30 hover:bg-black/40 cursor-pointer"
                  >
                    <Heart size={14} className={isFav ? 'text-error fill-error' : 'text-white'} />
                  </motion.button>
                  {product.stock <= product.min_stock && (
                    <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 bg-warning/20 border border-warning/40 text-warning text-[10px] font-semibold px-2 py-0.5 rounded-md">
                      <AlertTriangle size={10} /> Мало на складе
                    </div>
                  )}
                </div>

                <div className="p-3.5" onClick={() => navigate(`/shop/${product.id}`)}>
                  <div className="text-[10px] text-[var(--gold)] font-semibold mb-1 uppercase tracking-wide">
                    {product.brand} · {product.category_name}
                  </div>
                  <h3 className="text-sm font-bold text-white leading-snug mb-1.5 m-0">
                    {product.name}
                  </h3>
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
                      onClick={(e: React.MouseEvent) => { e.stopPropagation(); addToCart(product); }}
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
                        onClick={() => setCart(prev => prev.map(i => i.id === item.id ? { ...i, qty: Math.max(1, i.qty - 1) } : i))}
                        className="flex h-[26px] w-[26px] items-center justify-center rounded-md border border-[var(--border-subtle)] bg-white/5 text-white cursor-pointer hover:bg-white/10 transition-colors"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="text-[13px] font-bold text-white min-w-[20px] text-center">{item.qty}</span>
                      <button
                        onClick={() => setCart(prev => prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i))}
                        className="flex h-[26px] w-[26px] items-center justify-center rounded-md border border-[var(--border-subtle)] bg-white/5 text-white cursor-pointer hover:bg-white/10 transition-colors"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <button
                      onClick={() => setCart(prev => prev.filter(i => i.id !== item.id))}
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
