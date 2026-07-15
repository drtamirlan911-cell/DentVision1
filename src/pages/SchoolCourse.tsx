import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronRight, Play, Clock, Users, Star, BookOpen, Check, FileText, Video, HelpCircle } from 'lucide-react';
import { Button, Badge, EmptyState, Card } from '../components/ui/ds';
import * as api from '../utils/api';

interface Lesson {
  id: string;
  title: string;
  type: string;
  duration_minutes: number;
  content?: string;
  is_free?: boolean;
}

interface CourseModule {
  id: string;
  title: string;
  lessons?: Lesson[];
}

interface CourseDetail {
  id: string;
  title: string;
  subtitle?: string;
  category: string;
  difficulty?: string;
  duration_hours: number;
  lesson_count: number;
  enrolled_count: number;
  rating: number;
  modules?: CourseModule[];
}

const DIFF_COLORS: Record<string, string> = { beginner: '#27AE60', intermediate: '#C9A96E', advanced: '#E74C3C' };
const DIFF_LABELS: Record<string, string> = { beginner: 'Начинающий', intermediate: 'Продвинутый', advanced: 'Эксперт' };
const TYPE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = { video: Video, text: FileText, test: HelpCircle };
const TYPE_LABELS: Record<string, string> = { video: 'Видео', text: 'Статья', test: 'Тест' };

export default function SchoolCourse() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api.getSchoolCourse(id).then((c: CourseDetail) => {
      setCourse(c);
      if (c.modules?.[0]?.lessons?.[0]) setActiveLesson(c.modules[0].lessons[0]);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const handleEnroll = async () => {
    await api.enrollCourse({ course_id: id });
    setEnrolled(true);
  };

  const toggleModule = (modId: string) => {
    setExpandedModules(prev => ({ ...prev, [modId]: !prev[modId] }));
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-9 h-9 rounded-full border-[3px] border-[#C9A96E]/30 border-t-[#C9A96E] animate-spin" />
    </div>
  );

  if (!course) return <div className="py-10 text-center text-[var(--slate)]">Курс не найден</div>;

  return (
    <div className="min-h-screen">
      <div className="px-6 py-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2 text-xs text-[var(--slate)]">
          <button
            onClick={() => navigate('/school')}
            className="flex items-center gap-1 bg-transparent border-none text-[#C9A96E] cursor-pointer font-inherit text-xs"
          >
            <ArrowLeft size={14} /> School
          </button>
          <ChevronRight size={12} />
          <span>{course.category}</span>
          <ChevronRight size={12} />
          <span className="text-white">{course.title}</span>
        </div>
      </div>

      <div
        className="grid gap-0 min-h-[calc(100vh-60px)]"
        style={{ gridTemplateColumns: activeLesson ? '350px 1fr' : '1fr' }}
      >
        <div className="border-r border-[var(--border-subtle)] overflow-y-auto max-h-[calc(100vh-60px)]">
          <div className="p-5 border-b border-[var(--border-subtle)]">
            <div className="flex gap-1.5 mb-2">
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                style={{ background: DIFF_COLORS[course.difficulty!] + '15', color: DIFF_COLORS[course.difficulty!] }}
              >
                {DIFF_LABELS[course.difficulty!]}
              </span>
              <Badge variant="gold" size="xs">{course.category}</Badge>
            </div>
            <h2 className="text-base font-bold text-white m-0 mb-1.5">{course.title}</h2>
            <p className="text-xs text-[var(--slate)] m-0 mb-2.5">{course.subtitle}</p>
            <div className="flex gap-3 text-[11px] text-[var(--slate)] mb-3 flex-wrap">
              <span className="flex items-center gap-1"><Clock size={12} /> {course.duration_hours}ч</span>
              <span className="flex items-center gap-1"><BookOpen size={12} /> {course.lesson_count} уроков</span>
              <span className="flex items-center gap-1"><Users size={12} /> {course.enrolled_count}</span>
              <span className="flex items-center gap-1"><Star size={12} className="text-[#C9A96E] fill-[#C9A96E]" /> {course.rating}</span>
            </div>
            {!enrolled ? (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleEnroll}
                className="w-full py-2.5 px-4 rounded-[10px] border-none bg-gradient-to-r from-[#C9A96E] to-[#C9A96E]/dd text-[#0D1B2E] text-[13px] font-bold cursor-pointer font-inherit"
              >
                Записаться бесплатно
              </motion.button>
            ) : (
              <div className="flex items-center gap-1.5 text-[#27AE60] text-[13px] font-semibold">
                <Check size={16} /> Вы записаны
              </div>
            )}
          </div>

          <div className="p-2">
            {course.modules?.map((mod, mi) => {
              const isExpanded = expandedModules[mod.id] !== false;
              return (
                <div key={mod.id} className="mb-1">
                  <button
                    onClick={() => toggleModule(mod.id)}
                    className="w-full flex items-center gap-2 py-2.5 px-3 bg-white/[0.02] border-none rounded-lg text-white text-xs font-semibold cursor-pointer font-inherit text-left"
                  >
                    <span className="w-[22px] h-[22px] rounded-md bg-[#C9A96E]/15 flex items-center justify-center text-[10px] font-bold text-[#C9A96E] shrink-0">
                      {mi + 1}
                    </span>
                    <span className="flex-1">{mod.title}</span>
                    <motion.span animate={{ rotate: isExpanded ? 90 : 0 }}>
                      <ChevronRight size={14} className="text-[var(--slate)]" />
                    </motion.span>
                  </button>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        {mod.lessons?.map((lesson) => {
                          const LIcon = TYPE_ICONS[lesson.type] || FileText;
                          const isActive = activeLesson?.id === lesson.id;
                          return (
                            <button
                              key={lesson.id}
                              onClick={() => setActiveLesson(lesson)}
                              className={`w-full flex items-center gap-2.5 py-2 px-3 pl-[42px] bg-transparent border-none rounded text-xs cursor-pointer font-inherit text-left transition-all duration-150 ${
                                isActive
                                  ? 'border-l-[3px] border-l-[#C9A96E] text-[#C9A96E] bg-[#C9A96E]/[0.12]'
                                  : 'border-l-[3px] border-l-transparent text-[var(--slate-light)]'
                              }`}
                            >
                              <LIcon size={13} />
                              <span className="flex-1">{lesson.title}</span>
                              <span className="text-[10px] text-[var(--slate)] flex items-center gap-0.5">
                                <Clock size={10} /> {lesson.duration_minutes}м
                              </span>
                              {lesson.is_free && <span className="text-[9px] text-[#27AE60] font-bold">FREE</span>}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>

        {activeLesson ? (
          <motion.div
            key={activeLesson.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="p-8 overflow-y-auto max-h-[calc(100vh-60px)]"
          >
            <div className="bg-gradient-to-br from-[#2980B9]/20 to-[#C9A96E]/10 rounded-2xl h-[400px] flex items-center justify-center mb-6 border border-[var(--border-subtle)] relative">
              {activeLesson.type === 'video' ? (
                <div className="text-center">
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    className="w-[72px] h-[72px] rounded-full bg-gradient-to-br from-[#C9A96E] to-[#C9A96E]/cc flex items-center justify-center cursor-pointer shadow-[0_0_30px_rgba(201,169,110,0.3)]"
                  >
                    <Play size={30} className="text-[#0D1B2E] fill-[#0D1B2E] ml-1" />
                  </motion.div>
                  <p className="text-xs text-[var(--slate)] mt-3">{activeLesson.duration_minutes} мин</p>
                </div>
              ) : activeLesson.type === 'test' ? (
                <div className="text-center">
                  <HelpCircle size={48} className="text-[#C9A96E]/60" />
                  <p className="text-sm text-[var(--slate-light)] mt-2">Тест: {activeLesson.title}</p>
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    className="mt-3 py-2.5 px-6 rounded-[10px] border-none bg-gradient-to-r from-[#C9A96E] to-[#C9A96E]/dd text-[#0D1B2E] text-[13px] font-bold cursor-pointer font-inherit"
                  >
                    Начать тест
                  </motion.button>
                </div>
              ) : (
                <div className="text-center">
                  <FileText size={48} className="text-[#C9A96E]/60" />
                  <p className="text-sm text-[var(--slate-light)] mt-2">Статья: {activeLesson.title}</p>
                </div>
              )}
            </div>

            <div className="mb-5">
              <h2 className="text-xl font-bold text-white m-0 mb-1.5">{activeLesson.title}</h2>
              <div className="flex gap-3 text-xs text-[var(--slate)] flex-wrap">
                <span className="flex items-center gap-1">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#2980B9]/15 text-[#2980B9]">
                    {TYPE_LABELS[activeLesson.type] || activeLesson.type}
                  </span>
                </span>
                <span className="flex items-center gap-1"><Clock size={12} /> {activeLesson.duration_minutes} мин</span>
              </div>
            </div>

            <div className="bg-white/[0.02] border border-[var(--border-subtle)] rounded-xl p-6 min-h-[200px]">
              <p className="text-sm text-[var(--slate-light)] leading-relaxed">
                {activeLesson.content || `Содержание урока «${activeLesson.title}» будет доступно после начала курса. Видеоматериалы, иллюстрации и интерактивные элементы помогут вам освоить материал.`}
              </p>
            </div>

            <div className="flex justify-between mt-5">
              <button
                onClick={() => {
                  const allLessons = course.modules?.flatMap(m => m.lessons || []) || [];
                  const idx = allLessons.findIndex(l => l.id === activeLesson.id);
                  if (idx > 0) setActiveLesson(allLessons[idx - 1]);
                }}
                className="py-2 px-4 rounded-lg border border-[var(--border-subtle)] bg-white/[0.04] text-[var(--slate-light)] text-xs font-semibold cursor-pointer font-inherit"
              >
                ← Предыдущий
              </button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const allLessons = course.modules?.flatMap(m => m.lessons || []) || [];
                  const idx = allLessons.findIndex(l => l.id === activeLesson.id);
                  if (idx < allLessons.length - 1) setActiveLesson(allLessons[idx + 1]);
                }}
              >
                Следующий →
              </Button>
            </div>
          </motion.div>
        ) : (
          <div className="flex items-center justify-center text-[var(--slate)]">
            <EmptyState
              icon={<Play size={48} className="text-[var(--slate)]/40" />}
              title="Выберите урок для начала обучения"
            />
          </div>
        )}
      </div>
    </div>
  );
}
