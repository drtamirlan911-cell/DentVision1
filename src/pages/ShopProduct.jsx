import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Star, ShoppingCart, Heart, Package, Truck, Clock, Shield, ChevronRight, MessageSquare, ThumbsUp } from 'lucide-react';
import { T, tg } from '../utils/constants';
import * as api from '../utils/api';

export default function ShopProduct() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('description');
  const [reviewForm, setReviewForm] = useState({ rating: 5, pros: '', cons: '', comment: '' });

  useEffect(() => {
    api.getShopProduct(id).then(setProduct).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: `3px solid ${T.gold}30`, borderTopColor: T.gold, animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  if (!product) return <div style={{ padding: 40, textAlign: 'center', color: T.slate }}>Товар не найден</div>;

  const tabs = [
    { key: 'description', label: 'Описание' },
    { key: 'specs', label: 'Характеристики' },
    { key: 'reviews', label: `Отзывы (${product.reviews?.length || 0})` },
    { key: 'delivery', label: 'Доставка' },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 12, color: T.slate }}>
        <button onClick={() => navigate('/shop')} style={{ background: 'none', border: 'none', color: T.gold, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit', fontSize: 12 }}>
          <ArrowLeft size={14} /> Shop
        </button>
        <ChevronRight size={12} />
        <span>{product.category_name}</span>
        <ChevronRight size={12} />
        <span style={{ color: T.white }}>{product.name}</span>
      </motion.div>

      {/* Product Header */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 32 }}>
        {/* Image */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
          style={{
            background: `linear-gradient(135deg, ${T.sapphire}20, ${T.gold}10)`, borderRadius: 16,
            height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
          }}>
          <Package size={80} color={T.gold + '30'} />
          {product.old_price && (
            <div style={{ position: 'absolute', top: 16, left: 16, background: T.ruby, color: '#fff', fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 8 }}>
              -{Math.round((1 - product.price / product.old_price) * 100)}%
            </div>
          )}
        </motion.div>

        {/* Info */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
          <div style={{ fontSize: 12, color: T.gold, fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>{product.brand}</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: T.white, margin: '0 0 8px', lineHeight: 1.3 }}>{product.name}</h1>
          <div style={{ fontSize: 13, color: T.slate, marginBottom: 12 }}>{product.model}</div>

          {/* Rating */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 2 }}>
              {[...Array(5)].map((_, i) => <Star key={i} size={16} color={T.gold} fill={i < Math.round(product.rating) ? T.gold : 'transparent'} />)}
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.gold }}>{product.rating}</span>
            <span style={{ fontSize: 12, color: T.slate }}>({product.review_count} отзывов)</span>
          </div>

          {/* Price */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: T.white }}>{tg(product.price)}</span>
            {product.old_price && <span style={{ fontSize: 16, color: T.slate, textDecoration: 'line-through' }}>{tg(product.old_price)}</span>}
          </div>

          {/* Stock */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: product.stock > 0 ? T.emerald : T.ruby }} />
            <span style={{ fontSize: 13, color: product.stock > 0 ? T.emerald : T.ruby, fontWeight: 600 }}>
              {product.stock > 0 ? `В наличии: ${product.stock} ${product.unit || 'шт'}` : 'Нет в наличии'}
            </span>
          </div>

          {/* Delivery info */}
          {product.supplier_name && (
            <div style={{
              background: `${T.sapphire}10`, border: `1px solid ${T.sapphire}20`, borderRadius: 10,
              padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <Truck size={16} color={T.sapphire} />
              <div>
                <span style={{ fontSize: 12, color: T.slateL }}>Поставщик: </span>
                <span style={{ fontSize: 12, color: T.white, fontWeight: 600 }}>{product.supplier_name} ({product.supplier_country})</span>
                <span style={{ fontSize: 12, color: T.slate }}> · доставка {product.delivery_days} дн.</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              style={{
                flex: 1, padding: '12px 20px', borderRadius: 10, border: 'none',
                background: product.stock > 0 ? `linear-gradient(135deg, ${T.gold}, ${T.gold}dd)` : `${T.slate}30`,
                color: product.stock > 0 ? '#0D1B2E' : T.slate, fontSize: 14, fontWeight: 700,
                cursor: product.stock > 0 ? 'pointer' : 'default', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
              <ShoppingCart size={16} /> {product.stock > 0 ? 'Добавить в корзину' : 'Нет в наличии'}
            </motion.button>
            <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }}
              style={{
                width: 44, height: 44, borderRadius: 10, border: `1px solid ${T.borderSub}`,
                background: 'rgba(255,255,255,0.04)', color: T.slateL, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              <Heart size={18} />
            </motion.button>
          </div>
        </motion.div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: `1px solid ${T.borderSub}`, display: 'flex', gap: 0, marginBottom: 24 }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '12px 20px', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === tab.key ? T.gold : 'transparent'}`,
              color: activeTab === tab.key ? T.gold : T.slate, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {activeTab === 'description' && (
          <div>
            <p style={{ fontSize: 14, color: T.slateL, lineHeight: 1.8 }}>{product.description}</p>
          </div>
        )}

        {activeTab === 'specs' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              ['Бренд', product.brand],
              ['Модель', product.model],
              ['Артикул', product.sku || '—'],
              ['Категория', product.category_name],
              ['Поставщик', product.supplier_name],
              ['Страна', product.supplier_country],
              ['Доставка', `${product.delivery_days} дн.`],
              ['Стоимость доставки', product.delivery_cost === 0 ? 'Бесплатно' : tg(product.delivery_cost)],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                <span style={{ fontSize: 12, color: T.slate }}>{label}</span>
                <span style={{ fontSize: 12, color: T.white, fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div>
            {product.reviews?.length > 0 ? product.reviews.map((review, i) => (
              <div key={i} style={{ padding: '16px 0', borderBottom: `1px solid ${T.borderSub}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `${T.gold}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: T.gold }}>
                      {review.user_name?.[0] || '?'}
                    </div>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.white }}>{review.user_name}</span>
                      <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
                        {[...Array(5)].map((_, j) => <Star key={j} size={10} color={T.gold} fill={j < review.rating ? T.gold : 'transparent'} />)}
                      </div>
                    </div>
                  </div>
                  <ThumbsUp size={14} color={T.slate} />
                </div>
                {review.pros && <p style={{ fontSize: 12, color: T.emerald, margin: '4px 0' }}>+ {review.pros}</p>}
                {review.cons && <p style={{ fontSize: 12, color: T.ruby, margin: '4px 0' }}>- {review.cons}</p>}
                {review.comment && <p style={{ fontSize: 13, color: T.slateL, margin: '8px 0 0' }}>{review.comment}</p>}
              </div>
            )) : (
              <div style={{ textAlign: 'center', padding: 40, color: T.slate }}>
                <MessageSquare size={36} color={T.slate + '40'} style={{ margin: '0 auto 12px' }} />
                <p>Пока нет отзывов</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'delivery' && (
          <div style={{ display: 'grid', gap: 12 }}>
            {[
              { icon: Truck, title: 'Доставка', desc: `${product.supplier_name} — ${product.delivery_days} рабочих дней` },
              { icon: Shield, title: 'Гарантия', desc: 'Оригинальная продукция с сертификатами качества' },
              { icon: Clock, title: 'Обработка заказа', desc: 'В течение 1 рабочего дня после оплаты' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, padding: '14px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${T.gold}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <item.icon size={16} color={T.gold} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.white }}>{item.title}</h4>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: T.slateL }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Related Products */}
      {product.related?.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: T.white, marginBottom: 16 }}>Похожие товары</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {product.related.map(rel => (
              <motion.div key={rel.id} whileHover={{ y: -3 }}
                onClick={() => navigate(`/shop/${rel.id}`)}
                style={{
                  background: T.card, border: `1px solid ${T.borderSub}`, borderRadius: 10, padding: 14,
                  cursor: 'pointer', transition: 'all .2s',
                }}>
                <p style={{ fontSize: 11, color: T.gold, fontWeight: 600, margin: 0 }}>{rel.brand}</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: T.white, margin: '4px 0 6px' }}>{rel.name}</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: T.white, margin: 0 }}>{tg(rel.price)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
