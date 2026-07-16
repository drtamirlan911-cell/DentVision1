import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, Star, ShoppingCart, Trash2 } from 'lucide-react';
import { tg } from '../../utils/constants';
import * as api from '../../utils/api';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../components/ui/ds/Toast';
import { Card, CardContent } from '../../components/ui/ds/Card';
import { Button } from '../../components/ui/ds/Button';
import { EmptyState } from '../../components/ui/ds/EmptyState';
import { PageHeader } from '../../components/ui/ds/StatCard';

interface Fav { id: string; productId: string; name: string; brand: string; price: number; rating: number; }

export default function ShopFavorites() {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const toast = useToast();
  const [favs, setFavs] = useState<Fav[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getShopFavorites()
      .then((data: Fav[]) => setFavs(data.map(f => ({ ...f, productId: f.productId || f.id }))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const remove = async (productId: string) => {
    try {
      await api.toggleShopFavorite({ product_id: productId });
      setFavs(prev => prev.filter(f => f.productId !== productId));
    } catch { toast.error('Не удалось удалить'); }
  };

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="h-9 w-9 rounded-full border-[3px] border-[#C9A96E]/30 border-t-[#C9A96E] animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-[900px] mx-auto">
      <PageHeader title="Избранное" subtitle="Сохранённые товары" icon={<Heart size={22} />} />

      {favs.length === 0 ? (
        <EmptyState icon={<Heart size={36} />} title="Нет избранных товаров" description="Нажмите на сердечко у товара, чтобы сохранить его" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
          {favs.map((f, i) => (
            <motion.div key={f.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card hover>
                <CardContent className="flex items-center gap-3">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/shop/${f.productId}`)}>
                    <p className="text-[10px] text-[#C9A96E] font-semibold uppercase">{f.brand}</p>
                    <p className="text-sm font-bold text-white truncate">{f.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-base font-extrabold text-white">{tg(f.price)}</span>
                      {f.rating > 0 && <span className="flex items-center gap-0.5 text-[11px] text-[#C9A96E]"><Star size={11} className="fill-[#C9A96E]" /> {f.rating}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button variant="primary" size="icon" onClick={() => { addToCart({ id: f.productId, name: f.name, brand: f.brand, price: f.price }); toast.success('Добавлено в корзину'); }}>
                      <ShoppingCart size={15} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(f.productId)}>
                      <Trash2 size={15} className="text-error" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
