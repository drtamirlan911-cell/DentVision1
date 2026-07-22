import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, BookOpen, Tag } from 'lucide-react';
import * as api from '@/utils/api';
import { Card } from '@/components/ui/ds/Card';
import { Badge } from '@/components/ui/ds/Badge';
import { EmptyState } from '@/components/ui/ds/EmptyState';
import { PageHeader } from '@/components/ui/ds/StatCard';
import { DENTAL_ICD10 } from '@/lib/icd10-data';
import type { ICD10Code } from '@/types';

function withCategories(list: ICD10Code[]): ICD10Code[] {
  return list.map((c) => {
    if (c.category) return c;
    const root = String(c.code || '').split('.')[0];
    let category = 'Стоматология';
    if (root.startsWith('K02')) category = 'Кариес';
    else if (root.startsWith('K03')) category = 'Твёрдые ткани зубов';
    else if (root.startsWith('K04')) category = 'Пульпа и периодонт';
    else if (root.startsWith('K05') || root.startsWith('K06')) category = 'Пародонтология';
    else if (root.startsWith('K07') || root.startsWith('M26')) category = 'Ортодонтия';
    else if (root.startsWith('K08') || root.startsWith('K09') || root.startsWith('K10')) category = 'Хирургия / челюсти';
    else if (root.startsWith('K12') || root.startsWith('K13') || root.startsWith('K14')) category = 'Слизистая / язык';
    else if (root.startsWith('S02') || root.startsWith('S09')) category = 'Травмы';
    else if (root.startsWith('Z')) category = 'Обследование / протезирование';
    return { ...c, category };
  });
}

function normalizeCodes(raw: unknown): ICD10Code[] {
  if (!Array.isArray(raw)) return [];
  return withCategories(
    raw
      .map((row: any) => ({
        code: String(row?.code || ''),
        name: String(row?.name || row?.description || ''),
        description: row?.description ? String(row.description) : undefined,
        category: row?.category ? String(row.category) : undefined,
      }))
      .filter((r) => r.code && r.name),
  );
}

export default function ICD10() {
  const [codes, setCodes] = useState<ICD10Code[]>(() => withCategories(DENTAL_ICD10));
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [fromApi, setFromApi] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      setLoading(true);
      const q = search.trim().length >= 1 ? search.trim() : undefined;
      api
        .getICD10(q)
        .then((data) => {
          if (cancelled) return;
          const next = normalizeCodes(data);
          if (next.length > 0) {
            setCodes(next);
            setFromApi(true);
          } else if (!q) {
            // Empty DB / bad payload — keep built-in dental list.
            setCodes(withCategories(DENTAL_ICD10));
            setFromApi(false);
          } else {
            setCodes([]);
          }
        })
        .catch(() => {
          if (cancelled) return;
          // Offline / API error: local catalog with client-side filter.
          const needle = search.trim().toLowerCase();
          const local = withCategories(DENTAL_ICD10).filter((c) => {
            if (!needle) return true;
            return (
              c.code.toLowerCase().includes(needle) ||
              c.name.toLowerCase().includes(needle) ||
              String(c.category || '').toLowerCase().includes(needle)
            );
          });
          setCodes(local);
          setFromApi(false);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, search ? 220 : 0);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [search]);

  const categories = useMemo(() => {
    const cats = new Set(codes.map((c) => c.category).filter(Boolean) as string[]);
    return ['all', ...Array.from(cats).sort()];
  }, [codes]);

  const filteredCodes = useMemo(() => {
    if (selectedCategory === 'all') return codes;
    return codes.filter((c) => c.category === selectedCategory);
  }, [codes, selectedCategory]);

  return (
    <div className="dv-page fade-in space-y-6 py-4 md:py-6">
      <PageHeader
        title="Справочник МКБ-10"
        subtitle="Международная классификация болезней (стоматология)"
        icon={<BookOpen size={24} className="text-dv-gold" />}
      />

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
          <input
            placeholder="Поиск по коду или названию (например K02 или кариес)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          className="dv-select w-full md:w-64"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === 'all' ? 'Все категории' : c}
            </option>
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
            description="Попробуйте изменить запрос или сбросить фильтр категории"
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
                <div className="flex items-start justify-between mb-2 gap-2">
                  <Badge variant="gold" size="sm">
                    {code.code}
                  </Badge>
                  {code.category && (
                    <span className="flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-txt-muted">
                      <Tag size={10} /> {code.category}
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-txt-primary mt-2">{code.name}</h3>
                {code.description && code.description !== code.name && (
                  <p className="mt-1 text-xs text-txt-muted leading-relaxed">{code.description}</p>
                )}
              </Card>
            </motion.div>
          ))
        )}
      </div>

      <div className="text-center text-xs text-txt-ghost">
        Показано {filteredCodes.length} из {codes.length} записей
        {!fromApi ? ' · локальный стоматологический каталог' : ''}
      </div>
    </div>
  );
}
