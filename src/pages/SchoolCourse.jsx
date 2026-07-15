import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronRight, Play, Clock, Users, Star, Award, BookOpen, Check, Lock, FileText, Video, HelpCircle, Target } from 'lucide-react';
import { T } from '../utils/constants';
import * as api from '../utils/api';

const DIFF_COLORS = { beginner: T.emerald, intermediate: T.gold, advanced: T.ruby };
const DIFF_LABELS = { beginner: 'Начинающий', intermediate: 'Продвинутый', advanced: 'Эксперт' };
const TYPE_ICONS = { video: Video, text: FileText, test: HelpCircle };
const TYPE_LABELS = { video: 'Видео', text: 'Статья', test: 'Тест' };

export default function SchoolCourse() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeLesson, setActiveLesson] = useState(null);
  const [enrolled, setEnrolled] = useState(false);
  const [expandedModules, setExpandedModules] = useState({});

  useEffect(() => {
    api.getSchoolCourse(id).then(c => {
      setCourse(c);
      if (c.modules?.[0]?.lessons?.[0]) setActiveLesson(c.modules[0].lessons[0]);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const handleEnroll = async () => {
    await api.enrollCourse({ course_id: id });
    setEnrolled(true);
  };

  const toggleModule = (modId) => {
    setExpandedModules(prev => ({ ...prev, [modId]: !prev[modId] }));
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: `3px solid ${T.gold}30`, borderTopColor: T.gold, animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  if (!course) return <div style={{ padding: 40, textAlign: 'center', color: T.slate }}>Курс не найден</div>;

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Breadcrumb */}
      <div style={{ padding: '12px 24px', borderBottom: `1px solid ${T.borderSub}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.slate }}>
          <button onClick={() => navigate('/school')} style={{ background: 'none', border: 'none', color: T.gold, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit', fontSize: 12 }}>
            <ArrowLeft size={14} /> School
          </button>
          <ChevronRight size={12} />
          <span>{course.category}</span>
          <ChevronRight size={12} />
          <span style={{ color: T.white }}>{course.title}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: activeLesson ? '350px 1fr' : '1fr', gap: 0, minHeight: 'calc(100vh - 60px)' }}>
        {/* Course sidebar / modules */}
        <div style={{ borderRight: `1px solid ${T.borderSub}`, overflowY: 'auto', maxHeight: 'calc(100vh - 60px)' }}>
          {/* Course info header */}
          <div style={{ padding: 20, borderBottom: `1px solid ${T.borderSub}` }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: DIFF_COLORS[course.difficulty] + '15', color: DIFF_COLORS[course.difficulty] }}>
                {DIFF_LABELS[course.difficulty]}
              </span>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: `${T.gold}15`, color: T.gold }}>
                {course.category}
              </span>
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: T.white, margin: '0 0 6px' }}>{course.title}</h2>
            <p style={{ fontSize: 12, color: T.slate, margin: '0 0 10px' }}>{course.subtitle}</p>
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: T.slate, marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> {course.duration_hours}ч</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><BookOpen size={12} /> {course.lesson_count} уроков</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={12} /> {course.enrolled_count}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Star size={12} color={T.gold} fill={T.gold} /> {course.rating}</span>
            </div>
            {!enrolled ? (
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={handleEnroll}
                style={{
                  width: '100%', padding: '10px 16px', borderRadius: 10, border: 'none',
                  background: `linear-gradient(135deg, ${T.gold}, ${T.gold}dd)`, color: '#0D1B2E',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                Записаться бесплатно
              </motion.button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.emerald, fontSize: 13, fontWeight: 600 }}>
                <Check size={16} /> Вы записаны
              </div>
            )}
          </div>

          {/* Modules */}
          <div style={{ padding: 8 }}>
            {course.modules?.map((mod, mi) => {
              const isExpanded = expandedModules[mod.id] !== false;
              return (
                <div key={mod.id} style={{ marginBottom: 4 }}>
                  <button onClick={() => toggleModule(mod.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                      background: 'rgba(255,255,255,0.02)', border: 'none', borderRadius: 8,
                      color: T.white, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      textAlign: 'left',
                    }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: 6, background: `${T.gold}15`, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: T.gold, flexShrink: 0,
                    }}>
                      {mi + 1}
                    </span>
                    <span style={{ flex: 1 }}>{mod.title}</span>
                    <motion.span animate={{ rotate: isExpanded ? 90 : 0 }}><ChevronRight size={14} color={T.slate} /></motion.span>
                  </button>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: 'hidden' }}>
                        {mod.lessons?.map((lesson) => {
                          const LIcon = TYPE_ICONS[lesson.type] || FileText;
                          const isActive = activeLesson?.id === lesson.id;
                          return (
                            <button key={lesson.id} onClick={() => setActiveLesson(lesson)}
                              style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px 8px 42px',
                                background: isActive ? `${T.gold}12` : 'transparent', borderLeft: isActive ? `3px solid ${T.gold}` : '3px solid transparent',
                                border: 'none', borderLeft: isActive ? `3px solid ${T.gold}` : '3px solid transparent',
                                borderRadius: 4, color: isActive ? T.gold : T.slateL, fontSize: 12, cursor: 'pointer',
                                fontFamily: 'inherit', textAlign: 'left', transition: 'all .15s',
                              }}>
                              <LIcon size={13} />
                              <span style={{ flex: 1 }}>{lesson.title}</span>
                              <span style={{ fontSize: 10, color: T.slate, display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Clock size={10} /> {lesson.duration_minutes}м
                              </span>
                              {lesson.is_free && <span style={{ fontSize: 9, color: T.emerald, fontWeight: 700 }}>FREE</span>}
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

        {/* Lesson content area */}
        {activeLesson ? (
          <motion.div key={activeLesson.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
            style={{ padding: 32, overflowY: 'auto', maxHeight: 'calc(100vh - 60px)' }}>
            {/* Video / content area */}
            <div style={{
              background: `linear-gradient(135deg, ${T.sapphire}20, ${T.gold}10)`, borderRadius: 16,
              height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
              border: `1px solid ${T.borderSub}`, position: 'relative',
            }}>
              {activeLesson.type === 'video' ? (
                <div style={{ textAlign: 'center' }}>
                  <motion.div whileHover={{ scale: 1.1 }} style={{
                    width: 72, height: 72, borderRadius: '50%', background: `linear-gradient(135deg, ${T.gold}, ${T.gold}cc)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    boxShadow: `0 0 30px ${T.gold}30`,
                  }}>
                    <Play size={30} color="#0D1B2E" fill="#0D1B2E" style={{ marginLeft: 4 }} />
                  </motion.div>
                  <p style={{ fontSize: 12, color: T.slate, marginTop: 12 }}>{activeLesson.duration_minutes} мин</p>
                </div>
              ) : activeLesson.type === 'test' ? (
                <div style={{ textAlign: 'center' }}>
                  <HelpCircle size={48} color={T.gold + '60'} />
                  <p style={{ fontSize: 14, color: T.slateL, marginTop: 8 }}>Тест: {activeLesson.title}</p>
                  <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                    style={{
                      marginTop: 12, padding: '10px 24px', borderRadius: 10, border: 'none',
                      background: `linear-gradient(135deg, ${T.gold}, ${T.gold}dd)`, color: '#0D1B2E',
                      fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                    Начать тест
                  </motion.button>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <FileText size={48} color={T.gold + '60'} />
                  <p style={{ fontSize: 14, color: T.slateL, marginTop: 8 }}>Статья: {activeLesson.title}</p>
                </div>
              )}
            </div>

            {/* Lesson info */}
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: T.white, margin: '0 0 6px' }}>{activeLesson.title}</h2>
              <div style={{ display: 'flex', gap: 12, fontSize: 12, color: T.slate, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ padding: '2px 8px', borderRadius: 6, background: `${T.sapphire}15`, color: T.sapphire, fontSize: 10, fontWeight: 600 }}>
                    {TYPE_LABELS[activeLesson.type] || activeLesson.type}
                  </span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> {activeLesson.duration_minutes} мин</span>
              </div>
            </div>

            {/* Content placeholder */}
            <div style={{
              background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.borderSub}`, borderRadius: 12,
              padding: 24, minHeight: 200,
            }}>
              <p style={{ fontSize: 14, color: T.slateL, lineHeight: 1.8 }}>
                {activeLesson.content || `Содержание урока «${activeLesson.title}» будет доступно после начала курса. Видеоматериалы, иллюстрации и интерактивные элементы помогут вам освоить материал.`}
              </p>
            </div>

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
              <button onClick={() => {
                const allLessons = course.modules?.flatMap(m => m.lessons || []) || [];
                const idx = allLessons.findIndex(l => l.id === activeLesson.id);
                if (idx > 0) setActiveLesson(allLessons[idx - 1]);
              }}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: `1px solid ${T.borderSub}`,
                  background: 'rgba(255,255,255,0.04)', color: T.slateL, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                ← Предыдущий
              </button>
              <button onClick={() => {
                const allLessons = course.modules?.flatMap(m => m.lessons || []) || [];
                const idx = allLessons.findIndex(l => l.id === activeLesson.id);
                if (idx < allLessons.length - 1) setActiveLesson(allLessons[idx + 1]);
              }}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none',
                  background: `linear-gradient(135deg, ${T.gold}, ${T.gold}dd)`, color: '#0D1B2E',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                Следующий →
              </button>
            </div>
          </motion.div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.slate }}>
            <div style={{ textAlign: 'center' }}>
              <Play size={48} color={T.slate + '40'} style={{ margin: '0 auto 12px' }} />
              <p>Выберите урок для начала обучения</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
