import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, BookOpen, Tag, Filter } from 'lucide-react';
import { T } from '../utils/constants';
import * as api from '../utils/api';

export default function ICD10() {
  const { clinic } = useOutletContext();
  const [codes, setCodes] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getICD10(search.length >= 2 ? search : undefined)
      .then(data => { setCodes(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setCodes([]); setLoading(false); });
  }, [search]);

  const categories = useMemo(() => {
    const cats = new Set(codes.map(c => c.category).filter(Boolean));
    return ['all', ...Array.from(cats).sort()];
  }, [codes]);

  const filteredCodes = useMemo(() => {
    if (selectedCategory === 'all') return codes;
    return codes.filter(c => c.category === selectedCategory);
  }, [codes, selectedCategory]);

  return (
    <div className="fade-in space-y-6">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen size={24} style={{ color: T.gold }} />
            Справочник МКБ-10
          </h1>
          <p className="mt-1 text-sm text-slate-500">Международная классификация болезней (стоматология)</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            placeholder="Поиск по коду или названию..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          className="w-full md:w-64"
        >
          {categories.map(c => (
            <option key={c} value={c}>{c === 'all' ? 'Все категории' : c}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#C9A96E]/30 border-t-[#C9A96E]" />
          </div>
        ) : filteredCodes.length === 0 ? (
          <div className="col-span-full py-20 text-center">
            <BookOpen size={48} className="mx-auto mb-3 text-slate-600" />
            <p className="text-lg font-semibold text-slate-500">Ничего не найдено</p>
            <p className="text-sm text-slate-600">Попробуйте изменить запрос</p>
          </div>
        ) : (
          filteredCodes.map((code, i) => (
            <motion.div
              key={code.code}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="rounded-xl border border-white/5 bg-white/[0.02] p-4 hover:border-[#C9A96E]/20 hover:bg-white/[0.04] transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <span className="rounded-md px-2.5 py-1 text-xs font-bold text-black" style={{ background: T.gold }}>
                  {code.code}
                </span>
                {code.category && (
                  <span className="flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-slate-500">
                    <Tag size={10} /> {code.category}
                  </span>
                )}
              </div>
              <h3 className="text-sm font-bold text-white mt-2">{code.name}</h3>
              {code.description && (
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">{code.description}</p>
              )}
            </motion.div>
          ))
        )}
      </div>

      <div className="text-center text-xs text-slate-600">
        Показано {filteredCodes.length} из {codes.length} записей
      </div>
    </div>
  );
}
