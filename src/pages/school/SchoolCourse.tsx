import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronRight, Play, Clock, Users, Star, BookOpen, Check, FileText, Video, HelpCircle, Award, CheckCircle2, Sparkles, Send, QrCode, CreditCard } from 'lucide-react';
import { Button, Badge, EmptyState, Card, ProgressBar } from '../../components/ui/ds';
import { useAuth } from '@/store/auth.store';
import { useToast } from '../../components/ui/ds/Toast';
import * as api from '../../utils/api';

interface Lesson {
  id: string;
  title: string;
  type: string;
  duration_minutes: number;
  durationMinutes?: number;
  content?: string;
  is_free?: boolean;
  videoUrl?: string;
  video_url?: string;
  fileUrl?: string;
  file_url?: string;
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
  price?: number | null;
  image_url?: string | null;
  imageUrl?: string | null;
  modules?: CourseModule[];
}

const DIFF_COLORS: Record<string, string> = { beginner: '#27AE60', intermediate: '#C9A96E', advanced: '#E74C3C' };
const DIFF_LABELS: Record<string, string> = { beginner: 'Начинающий', intermediate: 'Продвинутый', advanced: 'Эксперт' };
const TYPE_ICONS: Record<string, any> = { video: Video, text: FileText, test: HelpCircle, exam: Award, quiz: HelpCircle, homework: FileText, pdf: FileText };
const TYPE_LABELS: Record<string, string> = { video: 'Видео', text: 'Статья', test: 'Тест', exam: 'Экзамен', quiz: 'Квиз', pdf: 'PDF', homework: 'ДЗ' };

function parseLessons(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return []; } }
  return [];
}

export default function SchoolCourse() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, activeClinic } = useAuth();
  const toast = useToast();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [certificate, setCertificate] = useState<any>(null);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [exam, setExam] = useState<any>(null);
  const [examAnswers, setExamAnswers] = useState<Record<string, number>>({});
  const [examResult, setExamResult] = useState<any>(null);
  const [examLoading, setExamLoading] = useState(false);
  const [examSubmitting, setExamSubmitting] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [tutorInput, setTutorInput] = useState('');
  const [tutorBusy, setTutorBusy] = useState(false);
  const [tutorMessages, setTutorMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [tutorSuggestions, setTutorSuggestions] = useState<string[]>([
    'Объясни простыми словами',
    'Свяжи с клиническим кейсом',
    'Подготовь к тесту',
  ]);
  const [pendingPay, setPendingPay] = useState<any>(null);
  const [payBusy, setPayBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.getSchoolCourse(id),
      user ? api.getEnrollments(user.id) : Promise.resolve([]),
    ]).then(([c, enr]: [CourseDetail, any]) => {
      setCourse(c);
      const list = Array.isArray(enr) ? enr : (enr?.data || []);
      const e = list.find((x: any) => x.courseId === id);
      if (e) {
        setEnrolled(true);
        setEnrollmentId(e.id);
        setProgress(e.progress || 0);
        setCompletedLessons(parseLessons(e.completedLessons));
      }
      if (c.modules?.[0]?.lessons?.[0]) setActiveLesson(c.modules[0].lessons[0]);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id, user]);

  useEffect(() => {
    setExam(null);
    setExamAnswers({});
    setExamResult(null);
    const type = String(activeLesson?.type || '').toLowerCase();
    if (!activeLesson || !['test', 'exam', 'quiz'].includes(type)) return;
    if (!enrolled) return;
    setExamLoading(true);
    api.getLessonExam(activeLesson.id)
      .then((payload) => setExam(payload || null))
      .catch(() => setExam(null))
      .finally(() => setExamLoading(false));
  }, [activeLesson?.id, enrolled]);

  const allLessons = course?.modules?.flatMap(m => m.lessons || []) || [];
  const totalLessons = allLessons.length;

  const reloadEnrollment = async () => {
    if (!user || !id) return;
    const enr = await api.getEnrollments(user.id).catch(() => []);
    const list = Array.isArray(enr) ? enr : (enr?.data || []);
    const e = list.find((x: any) => x.courseId === id);
    if (e) {
      setEnrolled(true);
      setEnrollmentId(e.id);
      setProgress(e.progress || 0);
      setCompletedLessons(parseLessons(e.completedLessons));
    }
  };

  const handleEnroll = async () => {
    if (!user) { toast.showToast('Войдите, чтобы записаться', 'error'); return; }
    try {
      const res = await api.enrollCourse({ courseId: id, course_id: id, clinic_id: activeClinic?.id || null });
      if (res?.requiresPayment && res?.payment?.id) {
        setPendingPay(res.payment);
        toast.showToast('Оплатите Kaspi QR, чтобы открыть курс', 'info');
        return;
      }
      setEnrolled(true);
      setEnrollmentId(res.id);
      toast.showToast('Вы записаны на курс', 'success');
    } catch { toast.showToast('Не удалось записаться', 'error'); }
  };

  const confirmCoursePay = async () => {
    if (!pendingPay?.id) return;
    setPayBusy(true);
    try {
      const res = await api.confirmPayment(pendingPay.id);
      if (res?.status === 'paid' || res?.settled || res?.alreadyPaid) {
        setPendingPay(null);
        await reloadEnrollment();
        toast.showToast('Оплата прошла — курс открыт', 'success');
      } else {
        toast.showToast('Оплата ещё не подтверждена', 'info');
      }
    } catch (e: any) {
      toast.showToast(e?.message || 'Оплата не подтверждена', 'error');
    } finally {
      setPayBusy(false);
    }
  };

  const markComplete = async (lessonId: string) => {
    if (!enrollmentId) { toast.showToast('Сначала запишитесь на курс', 'error'); return; }
    if (completedLessons.includes(lessonId)) { toast.showToast('Урок уже пройден', 'info'); return; }
    const arr = [...completedLessons, lessonId];
    const prog = totalLessons > 0 ? Math.round((arr.length / totalLessons) * 100) : 100;
    setCompletedLessons(arr);
    setProgress(prog);
    try {
      await api.updateEnrollment(enrollmentId, { progress: prog, completedLessons: arr });
      toast.showToast('Урок отмечен как пройденный', 'success');
      if (prog >= 100) {
        const certs = await api.getSchoolCertificates(user!.id);
        const cert = certs.find((c: any) => c.courseId === id);
        if (cert) setCertificate(cert);
      }
    } catch { toast.showToast('Не удалось сохранить прогресс', 'error'); }
  };

  const submitExam = async () => {
    if (!activeLesson) return;
    if (!enrolled) { toast.showToast('Сначала запишитесь на курс', 'error'); return; }
    setExamSubmitting(true);
    try {
      const result = await api.submitLessonExam(activeLesson.id, examAnswers, id);
      setExamResult(result);
      if (result.passed) {
        if (!completedLessons.includes(activeLesson.id)) {
          setCompletedLessons((prev) => [...prev, activeLesson.id]);
        }
        if (result.score) setProgress((p) => Math.max(p, result.score));
        if (result.certificate) setCertificate(result.certificate);
        toast.showToast(`Сдано: ${result.score}%`, 'success');
      } else {
        toast.showToast(`Не сдано: ${result.score}% (нужно ${result.passingScore || result.passScore || 70}%)`, 'warning');
      }
    } catch {
      toast.showToast('Не удалось отправить экзамен', 'error');
    } finally {
      setExamSubmitting(false);
    }
  };

  const askTutor = async (text?: string) => {
    const message = (text || tutorInput).trim();
    if (!message || tutorBusy) return;
    setTutorOpen(true);
    setTutorBusy(true);
    setTutorInput('');
    const nextHistory = [...tutorMessages, { role: 'user', content: message }];
    setTutorMessages(nextHistory);
    try {
      const res = await api.askSchoolTutor({
        message,
        courseId: id,
        lessonId: activeLesson?.id,
        history: nextHistory.slice(-8),
      });
      setTutorMessages((prev) => [...prev, { role: 'assistant', content: res.reply || 'Готов помочь с материалом.' }]);
      if (Array.isArray(res.suggestions) && res.suggestions.length) {
        setTutorSuggestions(res.suggestions.slice(0, 4));
      }
    } catch {
      setTutorMessages((prev) => [...prev, { role: 'assistant', content: 'Не удалось связаться с AI Tutor. Попробуйте ещё раз.' }]);
      toast.showToast('AI Tutor недоступен', 'error');
    } finally {
      setTutorBusy(false);
    }
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
            <ArrowLeft size={14} /> Academy OS
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
                style={{ background: (DIFF_COLORS[course.difficulty!] || '#C9A96E') + '15', color: DIFF_COLORS[course.difficulty!] || '#C9A96E' }}
              >
                {DIFF_LABELS[course.difficulty!] || course.difficulty}
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

            {enrolled && totalLessons > 0 && (
              <div className="mb-3">
                <div className="flex justify-between text-[11px] text-[var(--slate)] mb-1">
                  <span>Прогресс</span>
                  <span className="text-[#C9A96E] font-semibold">{progress}%</span>
                </div>
                <ProgressBar value={progress} />
              </div>
            )}

            {!enrolled ? (
              <>
                {course.price != null && Number(course.price) > 0 && (
                  <p className="text-lg font-extrabold text-[#C9A96E] m-0 mb-2">
                    {Number(course.price).toLocaleString('ru-RU')} ₸
                  </p>
                )}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleEnroll}
                  className="w-full py-2.5 px-4 rounded-[10px] border-none bg-gradient-to-r from-[#C9A96E] to-[#C9A96E]/dd text-[#0D1B2E] text-[13px] font-bold cursor-pointer font-inherit"
                >
                  {course.price != null && Number(course.price) > 0
                    ? `Купить · ${Number(course.price).toLocaleString('ru-RU')} ₸`
                    : 'Записаться бесплатно'}
                </motion.button>
                <p className="text-[11px] text-[var(--slate)] mt-1.5 text-center">
                  {activeClinic ? `Запись для «${activeClinic.name}»` : 'Запись для личного обучения'}
                </p>
                {pendingPay && (
                  <div className="mt-3 rounded-lg border border-[#C9A96E]/30 bg-[#C9A96E]/10 p-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-[#C9A96E] text-xs font-semibold">
                      <QrCode size={14} /> Оплата Kaspi QR
                    </div>
                    {pendingPay.qr && (
                      <a href={pendingPay.qr} target="_blank" rel="noreferrer" className="text-[11px] text-[#C9A96E] underline break-all">
                        {pendingPay.qr}
                      </a>
                    )}
                    <Button size="sm" icon={<CreditCard size={13} />} loading={payBusy} onClick={confirmCoursePay}>
                      Проверить оплату
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-1.5 text-[#27AE60] text-[13px] font-semibold">
                <Check size={16} /> Вы записаны
              </div>
            )}

            {certificate && (
              <div className="mt-3 flex items-center gap-2 bg-[#C9A96E]/10 border border-[#C9A96E]/30 rounded-lg px-3 py-2">
                <Award size={18} className="text-[#C9A96E]" />
                <div className="min-w-0">
                  <p className="text-[11px] text-[#C9A96E] font-bold m-0">Сертификат получен</p>
                  <p className="text-[10px] text-[var(--slate)] m-0 truncate">№ {certificate.certificateNumber}</p>
                </div>
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
                          const isDone = completedLessons.includes(lesson.id);
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
                              {isDone ? <CheckCircle2 size={13} className="text-[#27AE60]" /> : <LIcon size={13} />}
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
            <div className="bg-gradient-to-br from-[#2980B9]/20 to-[#C9A96E]/10 rounded-2xl h-[400px] flex items-center justify-center mb-6 border border-[var(--border-subtle)] relative overflow-hidden">
              {activeLesson.type === 'video' && (activeLesson.videoUrl || activeLesson.video_url) ? (
                <video
                  controls
                  className="w-full h-full object-contain bg-black/40"
                  src={activeLesson.videoUrl || activeLesson.video_url}
                >
                  Ваш браузер не поддерживает видео.
                </video>
              ) : activeLesson.type === 'video' ? (
                <div className="text-center">
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    className="w-[72px] h-[72px] rounded-full bg-gradient-to-br from-[#C9A96E] to-[#C9A96E]/cc flex items-center justify-center cursor-pointer shadow-[0_0_30px_rgba(201,169,110,0.3)]"
                  >
                    <Play size={30} className="text-[#0D1B2E] fill-[#0D1B2E] ml-1" />
                  </motion.div>
                  <p className="text-xs text-[var(--slate)] mt-3">
                    {(activeLesson.durationMinutes || activeLesson.duration_minutes || '—')} мин · видео скоро
                  </p>
                </div>
              ) : activeLesson.type === 'test' || activeLesson.type === 'exam' || activeLesson.type === 'quiz' ? (
                <div className="w-full h-full overflow-y-auto p-4 text-left">
                  {examLoading ? (
                    <div className="flex justify-center py-16 text-txt-muted">Загрузка экзамена…</div>
                  ) : !enrolled ? (
                    <div className="text-center py-10">
                      <HelpCircle size={48} className="text-[#C9A96E]/60 mx-auto" />
                      <p className="text-sm mt-3">Запишитесь на курс, чтобы пройти тест</p>
                      <Button variant="primary" size="sm" className="mt-3" onClick={handleEnroll}>Записаться</Button>
                    </div>
                  ) : examResult ? (
                    <div className="max-w-xl mx-auto space-y-3 py-6">
                      <h3 className="text-lg font-bold text-white">
                        {examResult.passed ? 'Экзамен сдан' : 'Экзамен не сдан'}
                      </h3>
                      <p className="text-sm text-txt-secondary">
                        Результат: <span className="text-dv-gold font-semibold">{examResult.score}%</span>
                        {' '}· порог {examResult.passingScore || examResult.passScore || 70}% · верно {examResult.correct}/{examResult.total}
                      </p>
                      {examResult.certificate && (
                        <div className="rounded-xl border border-dv-gold/30 bg-dv-gold/10 p-3 text-sm text-dv-gold">
                          Сертификат: {examResult.certificate.certificateNumber || examResult.certificate.id}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => { setExamResult(null); setExamAnswers({}); }}>
                          Пройти ещё раз
                        </Button>
                        {examResult.passed && (
                          <Button size="sm" onClick={() => markComplete(activeLesson.id)}>Отметить урок</Button>
                        )}
                      </div>
                    </div>
                  ) : exam ? (
                    <div className="max-w-xl mx-auto space-y-4 py-2">
                      <div>
                        <h3 className="text-base font-bold text-white">{exam.title || activeLesson.title}</h3>
                        <p className="text-xs text-txt-muted mt-1">
                          {exam.questionCount || exam.questions?.length || 0} вопросов · проходной балл {exam.passingScore || exam.passScore || 70}%
                        </p>
                      </div>
                      {(exam.questions || []).map((q: any, qi: number) => (
                        <div key={q.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
                          <p className="text-sm text-txt-primary font-medium">{qi + 1}. {q.text}</p>
                          <div className="space-y-1.5">
                            {(q.options || []).map((opt: string, oi: number) => (
                              <label key={oi} className={`flex items-center gap-2 text-sm px-2.5 py-2 rounded-lg cursor-pointer border ${
                                examAnswers[q.id] === oi
                                  ? 'border-dv-gold/40 bg-dv-gold/10 text-dv-gold'
                                  : 'border-transparent hover:bg-white/5 text-txt-secondary'
                              }`}>
                                <input
                                  type="radio"
                                  className="accent-[#C9A96E]"
                                  name={q.id}
                                  checked={examAnswers[q.id] === oi}
                                  onChange={() => setExamAnswers((prev) => ({ ...prev, [q.id]: oi }))}
                                />
                                {opt}
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                      <Button
                        size="sm"
                        onClick={submitExam}
                        disabled={examSubmitting || Object.keys(examAnswers).length < (exam.questions?.length || 0)}
                      >
                        {examSubmitting ? 'Проверка…' : 'Сдать экзамен'}
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-10">
                      <HelpCircle size={48} className="text-[#C9A96E]/60 mx-auto" />
                      <p className="text-sm mt-3">Тест временно недоступен</p>
                    </div>
                  )}
                </div>
              ) : activeLesson.type === 'pdf' || activeLesson.fileUrl || activeLesson.file_url ? (
                <div className="text-center px-6">
                  <p className="text-sm text-txt-primary mb-3">PDF / материал урока</p>
                  <a
                    href={activeLesson.fileUrl || activeLesson.file_url || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex px-4 py-2 rounded-lg bg-dv-gold/15 text-dv-gold text-sm border border-dv-gold/30"
                  >
                    Открыть материал
                  </a>
                </div>
              ) : (
                <div className="text-center">
                  <FileText size={48} className="text-[#C9A96E]/60" />
                  <p className="text-sm text-[var(--slate-light)] mt-2">Статья: {activeLesson.title}</p>
                </div>
              )}
              {completedLessons.includes(activeLesson.id) && (
                <div className="absolute top-3 right-3 flex items-center gap-1 bg-[#27AE60]/20 border border-[#27AE60]/40 text-[#27AE60] text-[10px] font-bold px-2 py-0.5 rounded-md">
                  <Check size={11} /> Пройдено
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
              {['test', 'exam', 'quiz'].includes(String(activeLesson.type || '').toLowerCase()) ? (
                <p className="text-sm text-[var(--slate-light)] leading-relaxed">
                  Пройдите вопросы выше. После успешной сдачи урок и сертификат обновятся автоматически.
                </p>
              ) : (
                <p className="text-sm text-[var(--slate-light)] leading-relaxed">
                  {activeLesson.content || `Содержание урока «${activeLesson.title}» будет доступно после начала курса. Видеоматериалы, иллюстрации и интерактивные элементы помогут вам освоить материал.`}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between mt-5">
              <button
                onClick={() => {
                  const idx = allLessons.findIndex(l => l.id === activeLesson.id);
                  if (idx > 0) setActiveLesson(allLessons[idx - 1]);
                }}
                className="py-2 px-4 rounded-lg border border-[var(--border-subtle)] bg-white/[0.04] text-[var(--slate-light)] text-xs font-semibold cursor-pointer font-inherit"
              >
                ← Предыдущий
              </button>
              {enrolled ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => markComplete(activeLesson.id)}
                  disabled={completedLessons.includes(activeLesson.id)}
                >
                  {completedLessons.includes(activeLesson.id) ? 'Пройдено ✓' : 'Отметить пройденным'}
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={handleEnroll}>Записаться, чтобы отмечать</Button>
              )}
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const idx = allLessons.findIndex(l => l.id === activeLesson.id);
                  if (idx < allLessons.length - 1) setActiveLesson(allLessons[idx + 1]);
                }}
              >
                Следующий →
              </Button>
            </div>

            {/* AI Tutor */}
            <div className="mt-8 rounded-2xl border border-[#C9A96E]/25 bg-gradient-to-br from-[#C9A96E]/10 to-transparent p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-[#C9A96E]" />
                  <h3 className="text-sm font-bold text-white m-0">AI Tutor</h3>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setTutorOpen((v) => !v)}>
                  {tutorOpen ? 'Свернуть' : 'Открыть'}
                </Button>
              </div>
              <p className="text-xs text-[var(--slate)] m-0 mb-3">
                Персональный наставник по уроку и курсу. Объяснит материал и свяжет с клиникой без PHI.
              </p>
              {tutorOpen && (
                <div className="space-y-3">
                  <div className="max-h-56 overflow-y-auto space-y-2 rounded-xl bg-black/20 p-3">
                    {tutorMessages.length === 0 ? (
                      <p className="text-xs text-[var(--slate)] m-0">Спросите, например: «Объясни ключевую идею урока».</p>
                    ) : (
                      tutorMessages.map((m, i) => (
                        <div
                          key={i}
                          className={`text-xs leading-relaxed rounded-lg px-3 py-2 ${
                            m.role === 'user'
                              ? 'bg-[#C9A96E]/15 text-[#C9A96E] ml-6'
                              : 'bg-white/[0.04] text-[var(--slate-light)] mr-6'
                          }`}
                        >
                          {m.content}
                        </div>
                      ))
                    )}
                    {tutorBusy && <p className="text-[11px] text-[#C9A96E] m-0">Tutor думает…</p>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tutorSuggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => askTutor(s)}
                        className="text-[10px] px-2.5 py-1 rounded-md border border-[var(--border-subtle)] bg-white/[0.04] text-[var(--slate-light)] cursor-pointer font-inherit"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={tutorInput}
                      onChange={(e) => setTutorInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') askTutor(); }}
                      placeholder="Вопрос AI Tutor…"
                      className="flex-1 rounded-lg bg-white/[0.04] border border-[var(--border-subtle)] px-3 py-2 text-xs text-white font-inherit outline-none"
                    />
                    <Button size="sm" onClick={() => askTutor()} disabled={tutorBusy || !tutorInput.trim()}>
                      <Send size={14} />
                    </Button>
                  </div>
                </div>
              )}
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
