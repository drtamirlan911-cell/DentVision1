import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap, Search, Star, Users, Clock, BookOpen, Award,
  ChevronRight, Play, Filter, Brain, Stethoscope, Microscope,
  Scissors, Heart, Shield, Sparkles, Camera, Scale, Zap, Building2, TrendingUp,
} from 'lucide-react';
import { T } from '../utils/constants';
import * as api from '../utils/api';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] } } };
const scaleIn = { hidden: { opacity: 0, scale: 0.9 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } } };

const CATEGORIES = [
  { key: 'Терапия', label: 'Терапия', icon: Stethoscope, color: T.emerald },
  { key: 'Ортопедия', label: 'Ортопедия', icon: Shield, color: T.sapphire },
  { key: 'Хирургия', label: 'Хирургия', icon: Scissors, color: T.ruby },
  { key: 'Имплантация', label: 'Имплантация', icon: Stethoscope, color: T.gold },
  { key: 'Пародонтология', label: 'Пародонтология', icon: Heart, color: T.purple },
  { key: 'Ортодонтия', label: 'Ортодонтия', icon: Building2, color: T.teal },
  { key: 'Эндодонтия', label: 'Эндодонтия', icon: Microscope, color: T.amber },
  { key: 'Детская стоматология', label: 'Детская', icon: Heart, color: T.gold },
  { key: 'Менеджмент', label: 'Менеджмент', icon: TrendingUp, color: T.sapphire },
  { key: 'Маркетинг', label: 'Маркетинг', icon: Sparkles, color: T.emerald },
  { key: 'Фотография', label: 'Фотография', icon: Camera, color: T.purple },
  { key: 'AI', label: 'AI', icon: Brain, color: T.gold },
  { key: 'Юридические вопросы', label: 'Юриспруденция', icon: Scale, color: T.slate },
];

const DIFF_COLORS = { beginner: T.emerald, intermediate: T.gold, advanced: T.ruby };
const DIFF_LABELS = { beginner: 'Начинающий', intermediate: 'Продвинутый', advanced: 'Эксперт' };
const CAT_ICONS = { 'Терапия': Stethoscope, 'Хирургия': Scissors, 'Имплантация': Zap, 'Ортодонтия': Building2, 'Эндодонтия': Microscope, 'Маркетинг': Sparkles, 'Фотография': Camera, 'AI': Brain, 'Ортопедия': Shield };

export default function School() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [clinicalCases, setClinicalCases] = useState([]);
  const [libraryItems, setLibraryItems] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [activeTab, setActiveTab] = useState('courses');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getSchoolCourses(),
      api.getSchoolClinicalCases(),
      api.getSchoolLibrary(),
    ]).then(([c, cc, lib]) => { setCourses(c); setClinicalCases(cc); setLibraryItems(lib); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filteredCourses = useMemo(() => {
    let list = [...courses];
    if (selectedCat) list = list.filter(c => c.category === selectedCat);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => c.title?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q) || c.instructor?.toLowerCase().includes(q));
    }
    return list;
  }, [courses, selectedCat, search]);

  const filteredCases = useMemo(() => {
    if (!selectedCat) return clinicalCases;
    return clinicalCases.filter(c => c.category === selectedCat);
  }, [clinicalCases, selectedCat]);

  const filteredLibrary = useMemo(() => {
    let list = [...libraryItems];
    if (selectedCat) list = list.filter(l => l.category === selectedCat);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(l => l.title?.toLowerCase().includes(q) || l.author?.toLowerCase().includes(q));
    }
    return list;
  }, [libraryItems, selectedCat, search]);

  const stats = useMemo(() => ({
    courses: courses.length,
    totalLessons: courses.reduce((s, c) => s + (c.lesson_count || 0), 0),
    totalHours: courses.reduce((s, c) => s + (c.duration_hours || 0), 0),
    enrolled: courses.reduce((s, c) => s + (c.enrolled_count || 0), 0),
  }), [courses]);

  return (
    <div style={{ padding: 24, minHeight: '100vh' }}>
      {/* Hero Header */}
      <motion.div initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
        style={{
          background: `linear-gradient(135deg, ${T.gold}12, ${T.sapphire}15, ${T.purple}08)`,
          border: `1px solid ${T.gold}20`, borderRadius: 20, padding: 32, marginBottom: 24, position: 'relative', overflow: 'hidden',
        }}>
        <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: '50%', background: `${T.gold}08`, filter: 'blur(40px)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700, color: T.white, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <GraduationCap size={28} color={T.gold} /> DentVision School
          </h1>
          <p style={{ fontSize: 13, color: T.slateL, margin: 0, maxWidth: 500 }}>
            Образовательная платформа для стоматологов. Курсы, клинические случаи, библиотека и AI-тьютор.
          </p>
          <div style={{ display: 'flex', gap: 20, marginTop: 16, flexWrap: 'wrap' }}>
            {[
              { value: stats.courses, label: 'Курсов', color: T.gold },
              { value: stats.totalLessons, label: 'Уроков', color: T.emerald },
              { value: stats.totalHours, label: 'Часов контента', color: T.sapphire },
              { value: `${Math.round(stats.enrolled / 100) / 10}k`, label: 'Студентов', color: T.purple },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 10, color: T.slate, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: `1px solid ${T.borderSub}`, paddingBottom: 0 }}>
        {[
          { key: 'courses', label: 'Курсы', icon: BookOpen },
          { key: 'cases', label: 'Клинические случаи', icon: Stethoscope },
          { key: 'library', label: 'Библиотека', icon: GraduationCap },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: '8px 8px 0 0', border: 'none', borderBottom: `2px solid ${activeTab === tab.key ? T.gold : 'transparent'}`,
              background: activeTab === tab.key ? `${T.gold}10` : 'transparent', color: activeTab === tab.key ? T.gold : T.slate,
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s',
            }}>
            <tab.icon size={15} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Search + Category Filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.slate }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={activeTab === 'courses' ? 'Поиск курсов, преподавателей...' : 'Поиск...'}
            style={{
              width: '100%', padding: '10px 14px 10px 38px', borderRadius: 10, border: `1px solid ${T.border}`,
              background: 'rgba(255,255,255,0.05)', color: T.white, fontSize: 13, outline: 'none', fontFamily: 'inherit',
            }} />
        </div>
      </div>

      {/* Categories */}
      <motion.div variants={stagger} initial="hidden" animate="visible"
        style={{ display: 'flex', gap: 6, marginBottom: 24, overflowX: 'auto', paddingBottom: 4, flexWrap: 'wrap' }}>
        <motion.button variants={fadeUp} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => setSelectedCat('')}
          style={{
            padding: '7px 14px', borderRadius: 18, border: `1px solid ${!selectedCat ? T.gold + '60' : T.borderSub}`,
            background: !selectedCat ? `${T.gold}18` : 'rgba(255,255,255,0.03)', color: !selectedCat ? T.gold : T.slate,
            fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
          }}>
          Все
        </motion.button>
        {CATEGORIES.map(cat => {
          const CatIcon = cat.icon;
          return (
            <motion.button key={cat.key} variants={fadeUp} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedCat(selectedCat === cat.key ? '' : cat.key)}
              style={{
                padding: '7px 14px', borderRadius: 18, border: `1px solid ${selectedCat === cat.key ? T.gold + '60' : T.borderSub}`,
                background: selectedCat === cat.key ? `${T.gold}18` : 'rgba(255,255,255,0.03)',
                color: selectedCat === cat.key ? T.gold : T.slate, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                whiteSpace: 'nowrap', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5,
              }}>
              <CatIcon size={12} /> {cat.label}
            </motion.button>
          );
        })}
      </motion.div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', border: `3px solid ${T.gold}30`, borderTopColor: T.gold, animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : activeTab === 'courses' ? (
        <motion.div variants={stagger} initial="hidden" animate="visible"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filteredCourses.map(course => {
            const CatIcon = CAT_ICONS[course.category] || BookOpen;
            return (
              <motion.div key={course.id} variants={scaleIn} whileHover={{ y: -4, boxShadow: `0 12px 40px ${T.gold}10` }}
                onClick={() => navigate(`/school/${course.id}`)}
                style={{
                  background: T.card, border: `1px solid ${T.borderSub}`, borderRadius: 14, overflow: 'hidden',
                  cursor: 'pointer', transition: 'all .3s ease',
                }}>
                {/* Thumbnail */}
                <div style={{
                  height: 140, position: 'relative',
                  background: `linear-gradient(135deg, ${T.sapphire}25, ${T.gold}12)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <CatIcon size={48} color={T.gold + '40'} />
                  <div style={{
                    position: 'absolute', top: 10, right: 10,
                    background: DIFF_COLORS[course.difficulty] || T.sapphire,
                    color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 6,
                  }}>
                    {DIFF_LABELS[course.difficulty]}
                  </div>
                  <div style={{
                    position: 'absolute', bottom: 10, left: 10,
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
                    color: '#fff', fontSize: 10, padding: '4px 10px', borderRadius: 6,
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <Play size={10} fill="#fff" /> {course.lesson_count} уроков · {course.duration_hours}ч
                  </div>
                </div>
                {/* Content */}
                <div style={{ padding: 14 }}>
                  <div style={{ fontSize: 10, color: T.gold, fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>
                    {course.category}
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: T.white, margin: '0 0 6px', lineHeight: 1.3 }}>
                    {course.title}
                  </h3>
                  <p style={{ fontSize: 12, color: T.slate, margin: '0 0 10px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {course.subtitle || course.description}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Star size={12} color={T.gold} fill={T.gold} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: T.gold }}>{course.rating}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Users size={12} color={T.slate} />
                      <span style={{ fontSize: 11, color: T.slate }}>{course.enrolled_count}</span>
                    </div>
                    <div style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 800, color: T.emerald }}>
                      Бесплатно
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: T.slate, marginTop: 6 }}>Преподаватель: {course.instructor}</div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      ) : activeTab === 'cases' ? (
        <motion.div variants={stagger} initial="hidden" animate="visible"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {filteredCases.map((c, i) => (
            <motion.div key={c.id || i} variants={scaleIn} whileHover={{ y: -3 }}
              style={{
                background: T.card, border: `1px solid ${T.borderSub}`, borderRadius: 12, padding: 18,
                cursor: 'pointer', transition: 'all .25s',
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: T.gold, textTransform: 'uppercase' }}>{c.category}</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                  background: DIFF_COLORS[c.difficulty] + '15', color: DIFF_COLORS[c.difficulty],
                }}>
                  {DIFF_LABELS[c.difficulty]}
                </span>
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: T.white, margin: '0 0 6px' }}>{c.title}</h3>
              <p style={{ fontSize: 12, color: T.slate, margin: '0 0 8px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {c.description}
              </p>
              <div style={{ fontSize: 11, color: T.slate }}>
                <strong style={{ color: T.slateL }}>Диагноз:</strong> {c.diagnosis}
              </div>
              <div style={{ fontSize: 11, color: T.slate, marginTop: 4 }}>
                <strong style={{ color: T.slateL }}>Автор:</strong> {c.author}
              </div>
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="visible"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {filteredLibrary.map((item, i) => (
            <motion.div key={item.id || i} variants={scaleIn} whileHover={{ y: -3 }}
              style={{
                background: T.card, border: `1px solid ${T.borderSub}`, borderRadius: 12, padding: 16,
                cursor: 'pointer', transition: 'all .25s',
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                  background: `${T.sapphire}15`, color: T.sapphire, textTransform: 'uppercase',
                }}>
                  {item.type}
                </span>
                <span style={{ fontSize: 10, color: T.slate }}>{item.category}</span>
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: T.white, margin: '0 0 6px' }}>{item.title}</h3>
              <div style={{ fontSize: 11, color: T.slate }}>Автор: {item.author}</div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Empty states */}
      {!loading && activeTab === 'courses' && filteredCourses.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: T.slate }}>
          <BookOpen size={48} color={T.slate + '40'} style={{ margin: '0 auto 12px' }} />
          <p>Курсы не найдены</p>
        </div>
      )}
      {!loading && activeTab === 'cases' && filteredCases.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: T.slate }}>
          <Stethoscope size={48} color={T.slate + '40'} style={{ margin: '0 auto 12px' }} />
          <p>Клинические случаи не найдены</p>
        </div>
      )}
      {!loading && activeTab === 'library' && filteredLibrary.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: T.slate }}>
          <GraduationCap size={48} color={T.slate + '40'} style={{ margin: '0 auto 12px' }} />
          <p>Библиотека пуста</p>
        </div>
      )}
    </div>
  );
}
