import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Truck, MapPin, Phone, Globe, Star } from 'lucide-react';
import * as api from '../../utils/api';
import { Card, CardContent } from '../../components/ui/ds/Card';
import { Badge } from '../../components/ui/ds/Badge';
import { EmptyState } from '../../components/ui/ds/EmptyState';
import { PageHeader } from '../../components/ui/ds/StatCard';

interface Supplier { id: string; name: string; country?: string; city?: string; phone?: string; email?: string; website?: string; rating: number; deliveryDays: number; deliveryCost: number; }

export default function ShopSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getShopSuppliers()
      .then((data: Supplier[]) => setSuppliers(data.map(s => ({ ...s, rating: Number(s.rating) || 0, deliveryDays: Number(s.deliveryDays) || 0, deliveryCost: Number(s.deliveryCost) || 0 }))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="h-9 w-9 rounded-full border-[3px] border-[#C9A96E]/30 border-t-[#C9A96E] animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-[900px] mx-auto">
      <PageHeader title="Поставщики" subtitle="Надёжные партнёры Магазина" icon={<Truck size={22} />} />

      {suppliers.length === 0 ? (
        <EmptyState icon={<Truck size={36} />} title="Поставщики не найдены" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
          {suppliers.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card hover>
                <CardContent>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-white m-0">{s.name}</h3>
                    {s.rating > 0 && <span className="flex items-center gap-0.5 text-xs text-[#C9A96E]"><Star size={12} className="fill-[#C9A96E]" /> {s.rating}</span>}
                  </div>
                  <div className="space-y-1.5 text-xs text-[var(--slate-light)]">
                    {s.country && <p className="flex items-center gap-1.5"><MapPin size={12} /> {s.city ? `${s.city}, ${s.country}` : s.country}</p>}
                    {s.phone && <p className="flex items-center gap-1.5"><Phone size={12} /> {s.phone}</p>}
                    {s.website && <p className="flex items-center gap-1.5"><Globe size={12} /> {s.website}</p>}
                    <p className="flex items-center gap-1.5"><Truck size={12} /> Доставка: {s.deliveryDays} дн. {s.deliveryCost === 0 ? '· бесплатно' : `· ${s.deliveryCost} ₸`}</p>
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
