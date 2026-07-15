import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap, Search, Star, Users, Clock, BookOpen,
  Play, Brain, Stethoscope, Microscope,
  Scissors, Heart, Shield, Sparkles, Camera, Scale, Zap, Building2, TrendingUp,
} from 'lucide-react';
import * as api from '../../utils/api';
import { Card } from '../../components/ui/ds/Card';
import { Input } from '../../components/ui/ds/Input';
import { Badge } from '../../components/ui/ds/Badge';
import { EmptyState } from '../../components/ui/ds/EmptyState';
import { StatCard, PageHeader } from '../../components/ui/ds/StatCard';
import { Tabs } from '../../components/ui/ds/Misc';

interface SchoolCourse {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  category: string;
  difficulty?: string;
  rating: number;
  lesson_count: number;
  duration_hours: number;
  enrolled_count: number;
  instructor: string;
}

interface ClinicalCase {
  id?: string;
  title: string;
  description: string;
  category: string;
  difficulty?: string;
  diagnosis: string;
  author: string;
}

interface LibraryItem {
  id?: string;
  title: string;
  type: string;
  category: string;
  author: string;
}

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] } } };
const scaleIn = { hidden: { opacity: 0, scale: 0.9 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } } };

const CATEGORIES = [
  { key: '╨в╨╡╤А╨░╨┐╨╕╤П', label: '╨в╨╡╤А╨░╨┐╨╕╤П', icon: Stethoscope },
  { key: '╨Ю╤А╤В╨╛╨┐╨╡╨┤╨╕╤П', label: '╨Ю╤А╤В╨╛╨┐╨╡╨┤╨╕╤П', icon: Shield },
  { key: '╨е╨╕╤А╤Г╤А╨│╨╕╤П', label: '╨е╨╕╤А╤Г╤А╨│╨╕╤П', icon: Scissors },
  { key: '╨Ш╨╝╨┐╨╗╨░╨╜╤В╨░╤Ж╨╕╤П', label: '╨Ш╨╝╨┐╨╗╨░╨╜╤В╨░╤Ж╨╕╤П', icon: Zap },
  { key: '╨Я╨░╤А╨╛╨┤╨╛╨╜╤В╨╛╨╗╨╛╨│╨╕╤П', label: '╨Я╨░╤А╨╛╨┤╨╛╨╜╤В╨╛╨╗╨╛╨│╨╕╤П', icon: Heart },
  { key: '╨Ю╤А╤В╨╛╨┤╨╛╨╜╤В╨╕╤П', label: '╨Ю╤А╤В╨╛╨┤╨╛╨╜╤В╨╕╤П', icon: Building2 },
  { key: '╨н╨╜╨┤╨╛╨┤╨╛╨╜╤В╨╕╤П', label: '╨н╨╜╨┤╨╛╨┤╨╛╨╜╤В╨╕╤П', icon: Microscope },
  { key: '╨Ф╨╡╤В╤Б╨║╨░╤П ╤Б╤В╨╛╨╝╨░╤В╨╛╨╗╨╛╨│╨╕╤П', label: '╨Ф╨╡╤В╤Б╨║╨░╤П', icon: Heart },
  { key: '╨Ь╨╡╨╜╨╡╨┤╨╢╨╝╨╡╨╜╤В', label: '╨Ь╨╡╨╜╨╡╨┤╨╢╨╝╨╡╨╜╤В', icon: TrendingUp },
  { key: '╨Ь╨░╤А╨║╨╡╤В╨╕╨╜╨│', label: '╨Ь╨░╤А╨║╨╡╤В╨╕╨╜╨│', icon: Sparkles },
  { key: '╨д╨╛╤В╨╛╨│╤А╨░╤Д╨╕╤П', label: '╨д╨╛╤В╨╛╨│╤А╨░╤Д╨╕╤П', icon: Camera },
  { key: 'AI', label: 'AI', icon: Brain },
  { key: '╨о╤А╨╕╨┤╨╕╤З╨╡╤Б╨║╨╕╨╡ ╨▓╨╛╨┐╤А╨╛╤Б╤Л', label: '╨о╤А╨╕╤Б╨┐╤А╤Г╨┤╨╡╨╜╤Ж╨╕╤П', icon: Scale },
];

const DIFF_BADGE: Record<string, string> = { beginner: 'success', intermediate: 'gold', advanced: 'error' };
const DIFF_LABELS: Record<string, string> = { beginner: '╨Э╨░╤З╨╕╨╜╨░╤О╤Й╨╕╨╣', intermediate: '╨Я╤А╨╛╨┤╨▓╨╕╨╜╤Г╤В╤Л╨╣', advanced: '╨н╨║╤Б╨┐╨╡╤А╤В' };
const CAT_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  '╨в╨╡╤А╨░╨┐╨╕╤П': Stethoscope, '╨е╨╕╤А╤Г╤А╨│╨╕╤П': Scissors, '╨Ш╨╝╨┐╨╗╨░╨╜╤В╨░╤Ж╨╕╤П': Zap,
  '╨Ю╤А╤В╨╛╨┤╨╛╨╜╤В╨╕╤П': Building2, '╨н╨╜╨┤╨╛╨┤╨╛╨╜╤В╨╕╤П': Microscope, '╨Ь╨░╤А╨║╨╡╤В╨╕╨╜╨│': Sparkles,
  '╨д╨╛╤В╨╛╨│╤А╨░╤Д╨╕╤П': Camera, 'AI': Brain, '╨Ю╤А╤В╨╛╨┐╨╡╨┤╨╕╤П': Shield,
};

const TABS = [
  { id: 'courses', label: '╨Ъ╤Г╤А╤Б╤Л', icon: <BookOpen size={15} /> },
  { id: 'cases', label: '╨Ъ╨╗╨╕╨╜╨╕╤З╨╡╤Б╨║╨╕╨╡ ╤Б╨╗╤Г╤З╨░╨╕', icon: <Stethoscope size={15} /> },
  { id: 'library', label: '╨С╨╕╨▒╨╗╨╕╨╛╤В╨╡╨║╨░', icon: <GraduationCap size={15} /> },
];

export default function School() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<SchoolCourse[]>([]);
  const [clinicalCases, setClinicalCases] = useState<ClinicalCase[]>([]);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [activeTab, setActiveTab] = useState('courses');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getSchoolCourses(),
      api.getSchoolClinicalCases(),
      api.getSchoolLibrary(),
    ])
      .then(([c, cc, lib]) => { setCourses(c); setClinicalCases(cc); setLibraryItems(lib); })
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
    <div className="p-6 min-h-screen">
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-2xl border border-[var(--gold)]/20 mb-6 p-8"
        style={{ background: 'linear-gradient(135deg, var(--gold)12, var(--sapphire)15, var(--purple)08)' }}
      >
        <div className="absolute -top-12 -right-12 w-[200px] h-[200px] rounded-full bg-[var(--gold)]/5 blur-4xl pointer-events-none" />
        <div className="relative z-10">
          <PageHeader
            icon={<GraduationCap size={22} />}
            title="DentVision School"
            subtitle="╨Ю╨▒╤А╨░╨╖╨╛╨▓╨░╤В╨╡╨╗╤М╨╜╨░╤П ╨┐╨╗╨░╤В╤Д╨╛╤А╨╝╨░ ╨┤╨╗╤П ╤Б╤В╨╛╨╝╨░╤В╨╛╨╗╨╛╨│╨╛╨▓. ╨Ъ╤Г╤А╤Б╤Л, ╨║╨╗╨╕╨╜╨╕╤З╨╡╤Б╨║╨╕╨╡ ╤Б╨╗╤Г╤З╨░╨╕, ╨▒╨╕╨▒╨╗╨╕╨╛╤В╨╡╨║╨░ ╨╕ AI-╤В╤М╤О╤В╨╛╤А."
          />
          <div className="flex gap-5 mt-4 flex-wrap">
            <StatCard label="╨Ъ╤Г╤А╤Б╨╛╨▓" value={stats.courses} icon={<BookOpen size={18} />} />
            <StatCard label="╨г╤А╨╛╨║╨╛╨▓" value={stats.totalLessons} icon={<Clock size={18} />} />
            <StatCard label="╨з╨░╤Б╨╛╨▓ ╨║╨╛╨╜╤В╨╡╨╜╤В╨░" value={stats.totalHours} icon={<Play size={18} />} />
            <StatCard label="╨б╤В╤Г╨┤╨╡╨╜╤В╨╛╨▓" value={`${Math.round(stats.enrolled / 100) / 10}k`} icon={<Users size={18} />} />
          </div>
        </div>
      </motion.div>

      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} className="mb-4" />

      <div className="flex gap-3 mb-5 flex-wrap">
        <Input
          icon={<Search size={16} />}
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          placeholder={activeTab === 'courses' ? '╨Я╨╛╨╕╤Б╨║ ╨║╤Г╤А╤Б╨╛╨▓, ╨┐╤А╨╡╨┐╨╛╨┤╨░╨▓╨░╤В╨╡╨╗╨╡╨╣...' : '╨Я╨╛╨╕╤Б╨║...'}
          className="flex-1 min-w-[200px]"
        />
      </div>

      <motion.div variants={stagger} initial="hidden" animate="visible"
        className="flex gap-2 mb-6 overflow-x-auto pb-1 flex-wrap">
        <motion.button variants={fadeUp} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => setSelectedCat('')}
          className={`px-3.5 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap transition-colors
            ${!selectedCat
              ? 'border-[var(--gold)]/60 bg-[var(--gold)]/10 text-[var(--gold)]'
              : 'border-[var(--border-subtle)] bg-white/[0.03] text-[var(--slate)]'
            }`}
        >
          ╨Т╤Б╨╡
        </motion.button>
        {CATEGORIES.map(cat => {
          const CatIcon = cat.icon;
          const active = selectedCat === cat.key;
          return (
            <motion.button key={cat.key} variants={fadeUp} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedCat(active ? '' : cat.key)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap transition-colors
                ${active
                  ? 'border-[var(--gold)]/60 bg-[var(--gold)]/10 text-[var(--gold)]'
                  : 'border-[var(--border-subtle)] bg-white/[0.03] text-[var(--slate)]'
                }`}
            >
              <CatIcon size={12} /> {cat.label}
            </motion.button>
          );
        })}
      </motion.div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-9 h-9 rounded-full border-[3px] border-[var(--gold)]/30 border-t-[var(--gold)] animate-spin" />
        </div>
      ) : activeTab === 'courses' ? (
        <motion.div variants={stagger} initial="hidden" animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCourses.map(course => {
            const CatIcon = CAT_ICONS[course.category] || BookOpen;
            return (
              <motion.div key={course.id} variants={scaleIn} whileHover={{ y: -4 }}
                onClick={() => navigate(`/school/${course.id}`)}>
                <Card hover padding="none" className="overflow-hidden h-full">
                  <div className="h-[140px] relative flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, var(--sapphire)25, var(--gold)12)' }}>
                    <CatIcon size={48} className="text-[var(--gold)]/40" />
                    <div className="absolute top-2.5 right-2.5">
                      <Badge variant={(DIFF_BADGE[course.difficulty!] || 'info') as 'info' | 'success' | 'gold' | 'error' | 'default'} size="xs">
                        {DIFF_LABELS[course.difficulty!]}
                      </Badge>
                    </div>
                    <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 bg-black/50 backdrop-blur-md text-white text-[10px] px-2.5 py-1 rounded-md">
                      <Play size={10} fill="white" /> {course.lesson_count} ╤Г╤А╨╛╨║╨╛╨▓ ┬╖ {course.duration_hours}╤З
                    </div>
                  </div>
                  <div className="p-3.5">
                    <div className="text-[10px] text-[var(--gold)] font-semibold uppercase mb-1">
                      {course.category}
                    </div>
                    <h3 className="text-[15px] font-bold text-white mb-1.5 leading-snug line-clamp-1">
                      {course.title}
                    </h3>
                    <p className="text-xs text-[var(--slate)] mb-2.5 leading-relaxed line-clamp-2">
                      {course.subtitle || course.description}
                    </p>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1">
                        <Star size={12} className="text-[var(--gold)] fill-[var(--gold)]" />
                        <span className="text-xs font-semibold text-[var(--gold)]">{course.rating}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users size={12} className="text-[var(--slate)]" />
                        <span className="text-[11px] text-[var(--slate)]">{course.enrolled_count}</span>
                      </div>
                      <div className="ml-auto text-sm font-extrabold text-emerald-400">
                        ╨С╨╡╤Б╨┐╨╗╨░╤В╨╜╨╛
                      </div>
                    </div>
                    <div className="text-[11px] text-[var(--slate)] mt-1.5">
                      ╨Я╤А╨╡╨┐╨╛╨┤╨░╨▓╨░╤В╨╡╨╗╤М: {course.instructor}
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      ) : activeTab === 'cases' ? (
        <motion.div variants={stagger} initial="hidden" animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredCases.map((c, i) => (
            <motion.div key={c.id || i} variants={scaleIn} whileHover={{ y: -3 }}>
              <Card hover padding="md" className="h-full">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-semibold text-[var(--gold)] uppercase">{c.category}</span>
                  <Badge variant={(DIFF_BADGE[c.difficulty!] || 'default') as 'info' | 'success' | 'gold' | 'error' | 'default'} size="xs">
                    {DIFF_LABELS[c.difficulty!]}
                  </Badge>
                </div>
                <h3 className="text-sm font-bold text-white mb-1.5">{c.title}</h3>
                <p className="text-xs text-[var(--slate)] mb-2 leading-relaxed line-clamp-2">
                  {c.description}
                </p>
                <div className="text-[11px] text-[var(--slate)]">
                  <strong className="text-[var(--slate-light)]">╨Ф╨╕╨░╨│╨╜╨╛╨╖:</strong> {c.diagnosis}
                </div>
                <div className="text-[11px] text-[var(--slate)] mt-1">
                  <strong className="text-[var(--slate-light)]">╨Р╨▓╤В╨╛╤А:</strong> {c.author}
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredLibrary.map((item, i) => (
            <motion.div key={item.id || i} variants={scaleIn} whileHover={{ y: -3 }}>
              <Card hover padding="md" className="h-full">
                <div className="flex justify-between mb-2">
                  <Badge variant="info" size="xs">{item.type}</Badge>
                  <span className="text-[10px] text-[var(--slate)]">{item.category}</span>
                </div>
                <h3 className="text-sm font-bold text-white mb-1.5">{item.title}</h3>
                <div className="text-[11px] text-[var(--slate)]">╨Р╨▓╤В╨╛╤А: {item.author}</div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {!loading && activeTab === 'courses' && filteredCourses.length === 0 && (
        <EmptyState icon={<BookOpen size={32} />} title="╨Ъ╤Г╤А╤Б╤Л ╨╜╨╡ ╨╜╨░╨╣╨┤╨╡╨╜╤Л" description="╨Я╨╛╨┐╤А╨╛╨▒╤Г╨╣╤В╨╡ ╨╕╨╖╨╝╨╡╨╜╨╕╤В╤М ╤Д╨╕╨╗╤М╤В╤А╤Л ╨╕╨╗╨╕ ╨┐╨╛╨╕╤Б╨║╨╛╨▓╤Л╨╣ ╨╖╨░╨┐╤А╨╛╤Б" />
      )}
      {!loading && activeTab === 'cases' && filteredCases.length === 0 && (
        <EmptyState icon={<Stethoscope size={32} />} title="╨Ъ╨╗╨╕╨╜╨╕╤З╨╡╤Б╨║╨╕╨╡ ╤Б╨╗╤Г╤З╨░╨╕ ╨╜╨╡ ╨╜╨░╨╣╨┤╨╡╨╜╤Л" description="╨Я╨╛╨┐╤А╨╛╨▒╤Г╨╣╤В╨╡ ╨╕╨╖╨╝╨╡╨╜╨╕╤В╤М ╤Д╨╕╨╗╤М╤В╤А╤Л" />
      )}
      {!loading && activeTab === 'library' && filteredLibrary.length === 0 && (
        <EmptyState icon={<GraduationCap size={32} />} title="╨С╨╕╨▒╨╗╨╕╨╛╤В╨╡╨║╨░ ╨┐╤Г╤Б╤В╨░" description="╨Э╨╡╤В ╨╝╨░╤В╨╡╤А╨╕╨░╨╗╨╛╨▓ ╨┤╨╗╤П ╨╛╤В╨╛╨▒╤А╨░╨╢╨╡╨╜╨╕╤П" />
      )}
    </div>
  );
}
