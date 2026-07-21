import React, { useState, useEffect, useMemo, type ChangeEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, BookOpen, Tag, Filter } from 'lucide-react';
import * as api from '../../utils/api';
import { Card } from '../../components/ui/ds/Card';
import { Badge } from '../../components/ui/ds/Badge';
import { EmptyState } from '../../components/ui/ds/EmptyState';
import { PageHeader } from '../../components/ui/ds/StatCard';
import type { Clinic, User, RoleInfo, ICD10Code } from '../../types';

export default function ICD10() {
  const { clinic } = useOutletContext<{ clinic: Clinic; user: User; roleInfo: RoleInfo }>();
  const [codes, setCodes] = useState<ICD10Code[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getICD10(search.length >= 2 ? search : undefined)
      .then(data => { setCodes(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setCodes([]); setLoading(false); });
  }, [search]);

  const categories = useMemo(() => {
    const cats = new Set(codes.map(c => c.category).filter(Boolean));
    return ['all', ...Array.from(cats).sort()] as string[];
  }, [codes]);

  const filteredCodes = useMemo(() => {
    if (selectedCategory === 'all') return codes;
    return codes.filter(c => c.category === selectedCategory);
  }, [codes, selectedCategory]);

  return (
    <div className="fade-in space-y-6">
      <PageHeader
        title="Справочник МКБ-10"
        subtitle="Международная классификация болезней (стоматология)"
        icon={<BookOpen size={24} className="text-dv-gold" />}
      />

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
          <input
            placeholder="Поиск по коду или названию..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          className="dv-select w-full md:w-64"
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
        >
          {categories.map(c => (
            <option key={c} value={c}>{c === 'all' ? 'Все категории' : c}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-dv-gold/30 border-t-dv-gold" />
          </div>
        ) : filteredCodes.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={48} />}
            title="Ничего не найдено"
            description="Попробуйте изменить запрос"
          />
        ) : (
          filteredCodes.map((code, i) => (
            <motion.div
              key={code.code}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
            >
              <Card hover className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <Badge variant="gold" size="sm">{code.code}</Badge>
                  {code.category && (
                    <span className="flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-txt-muted">
                      <Tag size={10} /> {code.category}
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-txt-primary mt-2">{code.name}</h3>
                {code.description && (
                  <p className="mt-1 text-xs text-txt-muted leading-relaxed">{code.description}</p>
                )}
              </Card>
            </motion.div>
          ))
        )}
      </div>

      <div className="text-center text-xs text-txt-ghost">
        Показано {filteredCodes.length} из {codes.length} записей
      </div>
    </div>
  );
}
