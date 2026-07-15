import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, Search, Heart, Star, Filter, ChevronDown, Package,
  Truck, TrendingUp, ArrowRight, X, Plus, Minus, Eye, Sparkles,
  BarChart3, Clock, Check, AlertTriangle, ShoppingBag, Brain,
} from 'lucide-react';
import { T, tg } from '../utils/constants';
import * as api from '../utils/api';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname.includes('vercel.app') ? 'https://dentvision-api.onrender.com' : 'http://localhost:3001');

const fmt = (n) => new Intl.NumberFormat('ru-RU').format(n);

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } } };
const scaleIn = { hidden: { opacity: 0, scale: 0.92 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } } };

const SORT_OPTIONS = [
  { value: '', label: 'По рейтингу' },
  { value: 'price_asc', label: 'Сначала дешевле' },
  { value: 'price_desc', label: 'Сначала дороже' },
  { value: 'newest', label: 'Новинки' },
];

const DIFFICULTY_COLORS = { beginner: T.emerald, intermediate: T.gold, advanced: T.ruby };
const DIFFICULTY_LABELS = { beginner: 'Начинающий', intermediate: 'Продвинутый', advanced: 'Эксперт' };

export default function Shop() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [cart, setCart] = useState(() => { try { return JSON.parse(localStorage.getItem('dv_cart') || '[]'); } catch { return []; } });
  const [favorites, setFavorites] = useState(() => { try { return JSON.parse(localStorage.getItem('dv_favs') || '[]'); } catch { return []; } });
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCart, setShowCart] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState(null);
  const [showAi, setShowAi] = useState(false);

  useEffect(() => {
    Promise.all([api.getShopCategories(), api.getShopProducts(), api.getShopSuppliers()])
      .then(([c, p, s]) => { setCategories(c); setProducts(p); setSuppliers(s); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { localStorage.setItem('dv_cart', JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem('dv_favs', JSON.stringify(favorites)); }, [favorites]);

  const filteredProducts = useMemo(() => {
    let list = [...products];
    if (selectedCat) list = list.filter(p => p.category_id === selectedCat);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name?.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
    }
    if (sortBy === 'price_asc') list.sort((a, b) => a.price - b.price);
    else if (sortBy === 'price_desc') list.sort((a, b) => b.price - a.price);
    else if (sortBy === 'newest') list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    else list.sort((a, b) => b.rating - a.rating);
    return list;
  }, [products, selectedCat, search, sortBy]);

  const cartTotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);

  const addToCart = (product) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === product.id);
      if (ex) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: product.id, name: product.name, brand: product.brand, price: product.price, qty: 1 }];
    });
  };

  const toggleFav = (product) => {
    setFavorites(prev => {
      const exists = prev.find(f => f.id === product.id);
      if (exists) return prev.filter(f => f.id !== product.id);
      return [...prev, { id: product.id, name: product.name, brand: product.brand, price: product.price, rating: product.rating }];
    });
  };

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
    <div style={{ padding: '24px', minHeight: '100vh' }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700, color: T.white, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <ShoppingBag size={24} color={T.gold} /> DentVision Shop
            </h1>
            <p style={{ fontSize: 12, color: T.slate, marginTop: 4 }}>Стоматологический маркетплейс</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
              onClick={() => setShowAi(!showAi)} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10,
                background: showAi ? `linear-gradient(135deg, ${T.gold}25, ${T.sapphire}25)` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${showAi ? T.gold + '50' : T.borderSub}`,
                color: showAi ? T.gold : T.slateL, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>
              <Brain size={15} /> AI Ассистент
            </motion.button>
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
              onClick={() => setShowCart(true)} style={{
                position: 'relative', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                borderRadius: 10, background: cartCount > 0 ? `${T.emerald}18` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${cartCount > 0 ? T.emerald + '40' : T.borderSub}`,
                color: cartCount > 0 ? T.emerald : T.slateL, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>
              <ShoppingCart size={15} /> Корзина
              {cartCount > 0 && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                  style={{
                    position: 'absolute', top: -6, right: -6, background: T.emerald, color: '#fff',
                    fontSize: 10, fontWeight: 700, borderRadius: 10, padding: '1px 6px', minWidth: 18, textAlign: 'center',
                  }}>
                  {cartCount}
                </motion.span>
              )}
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* AI Assistant Panel */}
      <AnimatePresence>
        {showAi && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden', marginBottom: 20 }}>
            <div style={{
              background: `linear-gradient(135deg, ${T.gold}08, ${T.sapphire}12)`, border: `1px solid ${T.gold}25`,
              borderRadius: 16, padding: 24,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${T.gold}30, ${T.sapphire}30)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Brain size={20} color={T.gold} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.white }}>AI Shopping Assistant</h3>
                  <p style={{ margin: 0, fontSize: 11, color: T.slate }}>Спросите что нужно — AI подберёт лучшие товары</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <input value={aiQuery} onChange={e => setAiQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAiSearch()}
                  placeholder="Например: лучший композит для фронтальных реставраций..."
                  style={{
                    flex: 1, padding: '12px 16px', borderRadius: 10, border: `1px solid ${T.border}`,
                    background: 'rgba(255,255,255,0.06)', color: T.white, fontSize: 13, outline: 'none', fontFamily: 'inherit',
                  }} />
                <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                  onClick={handleAiSearch} style={{
                    padding: '12px 20px', borderRadius: 10, background: `linear-gradient(135deg, ${T.gold}, ${T.gold}cc)`,
                    color: '#0D1B2E', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  <Sparkles size={15} /> Найти
                </motion.button>
              </div>
              {aiResponse && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  style={{ marginTop: 16 }}>
                  <p style={{ fontSize: 12, color: T.slateL, marginBottom: 12 }}>{aiResponse.summary}</p>
                  {aiResponse.results.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                      {aiResponse.results.map(p => (
                        <motion.div key={p.id} whileHover={{ scale: 1.02 }}
                          onClick={() => navigate(`/shop/${p.id}`)}
                          style={{
                            background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.borderSub}`, borderRadius: 10,
                            padding: 12, cursor: 'pointer', transition: 'all .2s',
                          }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: T.white, margin: 0 }}>{p.brand} {p.name}</p>
                          <p style={{ fontSize: 11, color: T.slate, margin: '4px 0 0' }}>{tg(p.price)}</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                            <Star size={11} color={T.gold} fill={T.gold} />
                            <span style={{ fontSize: 11, color: T.gold }}>{p.rating}</span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          style={{
            background: `${T.ruby}10`, border: `1px solid ${T.ruby}25`, borderRadius: 12,
            padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
          }}>
          <AlertTriangle size={16} color={T.ruby} />
          <span style={{ fontSize: 12, color: T.slateL }}>
            <strong style={{ color: T.ruby }}>Внимание:</strong> {lowStockProducts.length} товар(ов) требуют пополнения на складе
          </span>
        </motion.div>
      )}

      {/* Search + Filters */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
        style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.slate }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск товаров, брендов..."
            style={{
              width: '100%', padding: '10px 14px 10px 38px', borderRadius: 10, border: `1px solid ${T.border}`,
              background: 'rgba(255,255,255,0.05)', color: T.white, fontSize: 13, outline: 'none', fontFamily: 'inherit',
            }} />
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          style={{
            padding: '10px 14px', borderRadius: 10, border: `1px solid ${T.border}`,
            background: 'rgba(255,255,255,0.05)', color: T.white, fontSize: 12, outline: 'none', fontFamily: 'inherit',
          }}>
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </motion.div>

      {/* Categories */}
      <motion.div variants={stagger} initial="hidden" animate="visible"
        style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4, flexWrap: 'wrap' }}>
        <motion.button variants={fadeUp} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => setSelectedCat('')}
          style={{
            padding: '8px 16px', borderRadius: 20, border: `1px solid ${!selectedCat ? T.gold + '60' : T.borderSub}`,
            background: !selectedCat ? `${T.gold}18` : 'rgba(255,255,255,0.03)',
            color: !selectedCat ? T.gold : T.slate, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            whiteSpace: 'nowrap', fontFamily: 'inherit', transition: 'all .2s',
          }}>
          Все категории
        </motion.button>
        {categories.map(cat => (
          <motion.button key={cat.id} variants={fadeUp} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => setSelectedCat(selectedCat === cat.id ? '' : cat.id)}
            style={{
              padding: '8px 16px', borderRadius: 20, border: `1px solid ${selectedCat === cat.id ? T.gold + '60' : T.borderSub}`,
              background: selectedCat === cat.id ? `${T.gold}18` : 'rgba(255,255,255,0.03)',
              color: selectedCat === cat.id ? T.gold : T.slate, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              whiteSpace: 'nowrap', fontFamily: 'inherit', transition: 'all .2s', display: 'flex', alignItems: 'center', gap: 6,
            }}>
            <span>{cat.icon}</span> {cat.name}
          </motion.button>
        ))}
      </motion.div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Всего товаров', value: products.length, color: T.sapphire, icon: Package },
          { label: 'Категорий', value: categories.length, color: T.gold, icon: BarChart3 },
          { label: 'Поставщиков', value: suppliers.length, color: T.emerald, icon: Truck },
          { label: 'Нет в наличии', value: lowStockProducts.length, color: T.ruby, icon: AlertTriangle },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            style={{
              background: T.card, border: `1px solid ${T.borderSub}`, borderRadius: 12,
              padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
            }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: `${s.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <s.icon size={16} color={s.color} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: T.slate, marginTop: 2 }}>{s.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Products Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', border: `3px solid ${T.gold}30`, borderTopColor: T.gold, animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="visible"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 16 }}>
          {filteredProducts.map(product => {
            const isFav = favorites.some(f => f.id === product.id);
            return (
              <motion.div key={product.id} variants={scaleIn} whileHover={{ y: -4, boxShadow: `0 8px 30px ${T.gold}10` }}
                style={{
                  background: T.card, border: `1px solid ${T.borderSub}`, borderRadius: 14,
                  overflow: 'hidden', cursor: 'pointer', transition: 'all .25s ease',
                }}>
                {/* Image placeholder */}
                <div style={{
                  height: 160, background: `linear-gradient(135deg, ${T.sapphire}20, ${T.gold}10)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                }}>
                  <Package size={40} color={T.gold + '40'} />
                  {product.old_price && (
                    <div style={{
                      position: 'absolute', top: 10, left: 10, background: T.ruby, color: '#fff',
                      fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                    }}>
                      -{Math.round((1 - product.price / product.old_price) * 100)}%
                    </div>
                  )}
                  <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}
                    onClick={(e) => { e.stopPropagation(); toggleFav(product); }}
                    style={{
                      position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 8,
                      background: isFav ? `${T.ruby}20` : 'rgba(0,0,0,0.3)', border: 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    }}>
                    <Heart size={14} color={isFav ? T.ruby : '#fff'} fill={isFav ? T.ruby : 'none'} />
                  </motion.button>
                  {product.stock <= product.min_stock && (
                    <div style={{
                      position: 'absolute', bottom: 10, left: 10, background: `${T.amber}20`,
                      border: `1px solid ${T.amber}40`, color: T.amber, fontSize: 10, fontWeight: 600,
                      padding: '2px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <AlertTriangle size={10} /> Мало на складе
                    </div>
                  )}
                </div>

                {/* Content */}
                <div style={{ padding: 14 }} onClick={() => navigate(`/shop/${product.id}`)}>
                  <div style={{ fontSize: 10, color: T.gold, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>
                    {product.brand} · {product.category_name}
                  </div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: T.white, margin: '0 0 6px', lineHeight: 1.3 }}>
                    {product.name}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={11} color={T.gold} fill={i < Math.round(product.rating) ? T.gold : 'transparent'} />
                      ))}
                    </div>
                    <span style={{ fontSize: 11, color: T.slate }}>({product.review_count})</span>
                    <span style={{ fontSize: 11, color: product.stock > 0 ? T.emerald : T.ruby }}>
                      {product.stock > 0 ? `В наличии: ${product.stock}` : 'Нет в наличии'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 17, fontWeight: 800, color: T.white }}>{tg(product.price)}</span>
                    {product.old_price && (
                      <span style={{ fontSize: 12, color: T.slate, textDecoration: 'line-through' }}>{tg(product.old_price)}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                      style={{
                        flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none',
                        background: product.stock > 0 ? `linear-gradient(135deg, ${T.gold}, ${T.gold}dd)` : `${T.slate}30`,
                        color: product.stock > 0 ? '#0D1B2E' : T.slate, fontSize: 12, fontWeight: 700,
                        cursor: product.stock > 0 ? 'pointer' : 'default', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}>
                      <ShoppingCart size={13} /> {product.stock > 0 ? 'В корзину' : 'Нет в наличии'}
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }}
                      onClick={(e) => { e.stopPropagation(); navigate(`/shop/${product.id}`); }}
                      style={{
                        width: 34, height: 34, borderRadius: 8, border: `1px solid ${T.borderSub}`,
                        background: 'rgba(255,255,255,0.04)', color: T.slateL, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
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
        <div style={{ textAlign: 'center', padding: 60, color: T.slate }}>
          <Package size={48} color={T.slate + '40'} style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14 }}>Товары не найдены</p>
        </div>
      )}

      {/* Cart Drawer */}
      <AnimatePresence>
        {showCart && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowCart(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100 }} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{
                position: 'fixed', right: 0, top: 0, bottom: 0, width: 400, maxWidth: '90vw',
                background: '#0D1B2E', borderLeft: `1px solid ${T.borderSub}`, zIndex: 101,
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
              }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.borderSub}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.white, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShoppingCart size={18} color={T.gold} /> Корзина ({cartCount})
                </h3>
                <button onClick={() => setShowCart(false)} style={{ background: 'none', border: 'none', color: T.slate, cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                {cart.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: T.slate }}>
                    <ShoppingBag size={40} color={T.slate + '40'} style={{ margin: '0 auto 12px' }} />
                    <p>Корзина пуста</p>
                  </div>
                ) : cart.map(item => (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
                    borderBottom: `1px solid ${T.borderSub}`,
                  }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: T.white, margin: 0 }}>{item.name}</p>
                      <p style={{ fontSize: 11, color: T.slate, margin: '2px 0 0' }}>{item.brand}</p>
                      <p style={{ fontSize: 13, fontWeight: 700, color: T.gold, margin: '4px 0 0' }}>{tg(item.price)}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button onClick={() => setCart(prev => prev.map(i => i.id === item.id ? { ...i, qty: Math.max(1, i.qty - 1) } : i))}
                        style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${T.borderSub}`, background: 'rgba(255,255,255,0.05)', color: T.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Minus size={12} />
                      </button>
                      <span style={{ fontSize: 13, fontWeight: 700, color: T.white, minWidth: 20, textAlign: 'center' }}>{item.qty}</span>
                      <button onClick={() => setCart(prev => prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i))}
                        style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${T.borderSub}`, background: 'rgba(255,255,255,0.05)', color: T.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Plus size={12} />
                      </button>
                    </div>
                    <button onClick={() => setCart(prev => prev.filter(i => i.id !== item.id))}
                      style={{ background: 'none', border: 'none', color: T.ruby, cursor: 'pointer' }}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              {cart.length > 0 && (
                <div style={{ padding: '16px 20px', borderTop: `1px solid ${T.borderSub}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 14, color: T.slateL }}>Итого:</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: T.white }}>{tg(cartTotal)}</span>
                  </div>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    style={{
                      width: '100%', padding: '12px 20px', borderRadius: 10, border: 'none',
                      background: `linear-gradient(135deg, ${T.gold}, ${T.gold}dd)`, color: '#0D1B2E',
                      fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                    Оформить заказ
                  </motion.button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
