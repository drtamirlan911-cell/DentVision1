import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import {
  Archive,
  ArchiveRestore,
  BookOpen,
  GraduationCap,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from 'lucide-react';

import { useAuth } from '@/store/auth.store';
import { RequireWorkspaceScope } from '@/components/auth/RequireWorkspaceScope';
import { WorkspaceSwitcher } from '@/components/WorkspaceSwitcher';
import { Badge } from '@/components/ui/ds/Badge';
import { Button } from '@/components/ui/ds/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/ds/Card';
import { EmptyState } from '@/components/ui/ds/EmptyState';
import { Input, Textarea } from '@/components/ui/ds/Input';
import { ListSkeleton } from '@/components/ui/ds/Skeleton';
import { Modal } from '@/components/ui/ds/Modal';
import { PageHeader, StatCard } from '@/components/ui/ds/StatCard';
import * as api from '@/utils/api';
import AcademyTeamTab from './AcademyTeamTab';

type AcademyTab = 'courses' | 'students' | 'team';
type CourseStatus = 'draft' | 'published' | 'archived';

interface AcademyCourse {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  instructor?: string | null;
  author?: string | null;
  price?: number | null;
  durationHours?: number | null;
  publicationStatus?: CourseStatus | string;
  _count?: {
    lessons?: number;
    enrollments?: number;
    assessmentAttempts?: number;
    certificates?: number;
  };
}

interface AcademyEnrollment {
  id: string;
  learner: { id: string; name: string; email: string };
  course: { id: string; title: string; publicationStatus?: string };
  progress: number;
  completed: boolean;
  accessStatus: string;
  acquisitionType: string;
  enrolledAt: string;
  updatedAt?: string | null;
  accessExpiresAt?: string | null;
}

interface CourseForm {
  title: string;
  description: string;
  category: string;
  instructor: string;
  price: string;
  durationHours: string;
  firstLessonTitle: string;
  firstLessonContent: string;
}

const EMPTY_FORM: CourseForm = {
  title: '',
  description: '',
  category: '',
  instructor: '',
  price: '0',
  durationHours: '',
  firstLessonTitle: '',
  firstLessonContent: '',
};

function statusLabel(status?: string) {
  if (status === 'published') return 'Опубликован';
  if (status === 'archived') return 'В архиве';
  return 'Черновик';
}

function statusVariant(status?: string): 'success' | 'warning' | 'default' {
  if (status === 'published') return 'success';
  if (status === 'archived') return 'warning';
  return 'default';
}

function historyCount(course: AcademyCourse) {
  return Number(course._count?.enrollments || 0)
    + Number(course._count?.assessmentAttempts || 0)
    + Number(course._count?.certificates || 0);
}

function progressValue(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : 0;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(date);
}

function accessLabel(status: string, completed: boolean) {
  if (completed) return { label: 'Завершено', variant: 'success' as const };
  if (status === 'active') return { label: 'Доступ открыт', variant: 'success' as const };
  if (status === 'suspended' || status === 'refunded') return { label: 'Приостановлен', variant: 'warning' as const };
  return { label: 'Доступ закрыт', variant: 'default' as const };
}

function AcademyContextPrompt() {
  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <Card>
        <CardContent className="space-y-4 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-dv-gold/10 text-dv-gold">
              <GraduationCap size={22} />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-txt-primary">Кабинет академии</h1>
              <p className="text-sm text-txt-secondary">Сначала выберите организацию Academy</p>
            </div>
          </div>
          <p className="text-sm leading-6 text-txt-secondary">
            Данные курсов и учащихся открываются только в контексте принадлежащей вам академии.
            Выберите её в переключателе рабочего пространства.
          </p>
          <WorkspaceSwitcher />
        </CardContent>
      </Card>
    </div>
  );
}

export default function AcademyOwnerWorkspace() {
  const { user, loading, activeWorkspace, workspaceContexts } = useAuth();
  const organizationType = String(
    activeWorkspace?.scopeType || (workspaceContexts.length === 0 ? (user as any)?.organizationType : '') || '',
  ).toUpperCase();

  if (loading) {
    return <div className="p-6"><ListSkeleton count={4} /></div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (activeWorkspace?.scopeType === 'LECTURER' || organizationType === 'LECTURER') {
    return <Navigate to="/school/workspace" replace />;
  }
  if (organizationType !== 'ACADEMY') {
    return <AcademyContextPrompt />;
  }

  return (
    <RequireWorkspaceScope scopeType="ACADEMY">
      <AcademyManagement />
    </RequireWorkspaceScope>
  );
}

function AcademyManagement() {
  const { activeWorkspace } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab: AcademyTab = searchParams.get('tab') === 'students' ? 'students' : searchParams.get('tab') === 'team' || searchParams.get('section') === 'team' ? 'team' : 'courses';
  const [tab, setTab] = useState<AcademyTab>(requestedTab);
  const requestedSection = searchParams.get('section');
  const sectionTitles: Record<string, string> = {
    content: 'Редактор учебных материалов',
    assessments: 'Оценивание и тесты',
    certificates: 'Сертификаты',
    schedule: 'Расписание занятий',
    finance: 'Финансы академии',
    analytics: 'Аналитика обучения',
  };
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [enrollments, setEnrollments] = useState<AcademyEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<AcademyCourse | null>(null);
  const [form, setForm] = useState<CourseForm>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [busyCourseId, setBusyCourseId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AcademyCourse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const requestGeneration = useRef(0);

  const contextKey = `${activeWorkspace?.scopeType || 'none'}:${activeWorkspace?.scopeId || 'none'}:${activeWorkspace?.organizationId || 'none'}`;

  const loadData = useCallback(async (silent = false) => {
    const generation = ++requestGeneration.current;
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [courseRows, learnerRows] = await Promise.all([
        api.getManagedSchoolCourses(),
        api.getManagedSchoolEnrollments(),
      ]);
      if (generation !== requestGeneration.current) return;
      setCourses(Array.isArray(courseRows) ? courseRows : []);
      setEnrollments(Array.isArray(learnerRows) ? learnerRows : []);
    } catch (cause) {
      if (generation !== requestGeneration.current) return;
      setError(cause instanceof Error ? cause.message : 'Не удалось загрузить данные академии');
    } finally {
      if (generation === requestGeneration.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadData();
    return () => { requestGeneration.current += 1; };
    // The API client reads the active JWT. Reload whenever the selected Academy changes.
  }, [contextKey, loadData]);

  const publishedCount = courses.filter((course) => course.publicationStatus === 'published').length;
  const archivedCount = courses.filter((course) => course.publicationStatus === 'archived').length;
  const activeLearners = enrollments.filter((row) => row.accessStatus === 'active' && !row.completed).length;
  const completedLearners = enrollments.filter((row) => row.completed).length;

  const filteredCourses = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ru-RU');
    if (!normalized) return courses;
    return courses.filter((course) =>
      [course.title, course.category, course.instructor, course.author]
        .some((value) => String(value || '').toLocaleLowerCase('ru-RU').includes(normalized)),
    );
  }, [courses, query]);

  const filteredEnrollments = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ru-RU');
    if (!normalized) return enrollments;
    return enrollments.filter((row) =>
      [row.learner?.name, row.learner?.email, row.course?.title]
        .some((value) => String(value || '').toLocaleLowerCase('ru-RU').includes(normalized)),
    );
  }, [enrollments, query]);

  function selectTab(nextTab: AcademyTab) {
    setTab(nextTab);
    setQuery('');
    setSearchParams({ tab: nextTab }, { replace: true });
  }

  function openCreate() {
    setEditingCourse(null);
    setForm({ ...EMPTY_FORM });
    setFormOpen(true);
  }

  function openEdit(course: AcademyCourse) {
    setEditingCourse(course);
    setForm({
      title: course.title || '',
      description: course.description || '',
      category: course.category || '',
      instructor: course.instructor || course.author || '',
      price: String(course.price ?? 0),
      durationHours: String(course.durationHours ?? ''),
      firstLessonTitle: '',
      firstLessonContent: '',
    });
    setFormOpen(true);
  }

  async function saveCourse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim()) {
      setNotice({ type: 'error', text: 'Введите название курса' });
      return;
    }
    if (!editingCourse && (!form.description.trim() || !form.firstLessonTitle.trim() || !form.firstLessonContent.trim())) {
      setNotice({ type: 'error', text: 'Для черновика заполните описание и первый урок. Без этого курс нельзя будет опубликовать.' });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category.trim() || null,
        instructor: form.instructor.trim() || null,
        price: Math.max(0, Number(form.price) || 0),
        durationHours: Math.max(0, Number(form.durationHours) || 0),
      };
      if (editingCourse) {
        // Do not send modules here: the API preserves lesson IDs and learner progress.
        await api.updateSchoolCourse(editingCourse.id, payload);
        setNotice({ type: 'success', text: 'Данные курса обновлены; уроки и учебная история сохранены.' });
      } else {
        await api.createSchoolCourse({
          ...payload,
          modules: [{
            title: 'Модуль 1',
            lessons: [{
              title: form.firstLessonTitle.trim(),
              type: 'text',
              contentUrl: form.firstLessonContent.trim(),
              duration: 10,
              order: 0,
            }],
          }],
        });
        setNotice({ type: 'success', text: 'Черновик создан с первым уроком. Проверьте материалы и опубликуйте курс, когда он готов.' });
      }
      setFormOpen(false);
      await loadData(true);
    } catch (cause) {
      setNotice({ type: 'error', text: cause instanceof Error ? cause.message : 'Не удалось сохранить курс' });
    } finally {
      setSaving(false);
    }
  }

  async function changePublication(course: AcademyCourse) {
    const status = course.publicationStatus === 'published' ? 'archived' : 'published';
    setBusyCourseId(course.id);
    setNotice(null);
    try {
      await api.updateSchoolCoursePublication(course.id, status);
      setNotice({
        type: 'success',
        text: status === 'published'
          ? 'Курс опубликован. Он снова доступен для новых учащихся.'
          : 'Курс скрыт из каталога. Доступ действующих учащихся сохранён.',
      });
      await loadData(true);
    } catch (cause) {
      setNotice({ type: 'error', text: cause instanceof Error ? cause.message : 'Не удалось изменить публикацию курса' });
    } finally {
      setBusyCourseId(null);
    }
  }

  async function removeCourse() {
    if (!deleteTarget) return;
    setDeleting(true);
    setNotice(null);
    try {
      await api.deleteSchoolCourse(deleteTarget.id);
      setDeleteTarget(null);
      setNotice({ type: 'success', text: 'Курс удалён.' });
      await loadData(true);
    } catch (cause) {
      setNotice({ type: 'error', text: cause instanceof Error ? cause.message : 'Не удалось удалить курс' });
    } finally {
      setDeleting(false);
    }
  }

  const title = activeWorkspace?.name || 'Ваша академия';

  return (
    <div className="mx-auto max-w-[1280px] space-y-5 overflow-x-hidden p-4 sm:p-6">
      <PageHeader
        title="Кабинет академии"
        subtitle={`${title} · каталог, публикация и управление учащимися`}
        icon={<GraduationCap size={22} />}
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="lg" icon={<RefreshCw size={15} />} loading={refreshing} onClick={() => void loadData(true)}>
              Обновить
            </Button>
            {tab === 'courses' && (
              <Button size="lg" icon={<Plus size={16} />} onClick={openCreate}>Новый курс</Button>
            )}
          </div>
        )}
      />

      {notice && (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm ${notice.type === 'success' ? 'border-success/25 bg-success/5 text-success' : 'border-error/25 bg-error/5 text-error'}`}
        >
          {notice.text}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <StatCard label="Всего курсов" value={courses.length} icon={<BookOpen size={18} />} />
        <StatCard label="Опубликовано" value={publishedCount} icon={<BookOpen size={18} />} tone="success" />
        <StatCard label="Действующие учащиеся" value={activeLearners} icon={<Users size={18} />} tone="info" />
        <StatCard label="Завершили обучение" value={completedLearners} icon={<GraduationCap size={18} />} tone="success" />
        <StatCard label="В архиве" value={archivedCount} icon={<Archive size={18} />} tone="warning" />
      </div>

      {requestedSection && sectionTitles[requestedSection] && (
        <div className="rounded-xl border border-bdr-subtle bg-surface-raised px-4 py-3">
          <p className="text-sm font-medium text-txt-primary">{sectionTitles[requestedSection]}</p>
          <p className="mt-1 text-sm leading-5 text-txt-secondary">
            Этот процесс ещё не подключён к рабочему кабинету полностью. Сейчас доступны управление карточками курсов, безопасная публикация и архивирование, а также реестр зачислений и прогресса учащихся. Неисполненные действия здесь не имитируются.
          </p>
          <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => setSearchParams({ tab: 'courses' }, { replace: true })}>
            Открыть управление курсами
          </Button>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Разделы академии">
            <Button
              type="button"
              size="md"
              variant={tab === 'courses' ? 'primary' : 'ghost'}
              role="tab"
              aria-selected={tab === 'courses'}
              onClick={() => selectTab('courses')}
            >
              <BookOpen size={15} /> Курсы <span className="tabular-nums">{courses.length}</span>
            </Button>
            <Button
              type="button"
              size="md"
              variant={tab === 'students' ? 'primary' : 'ghost'}
              role="tab"
              aria-selected={tab === 'students'}
              onClick={() => selectTab('students')}
            >
              <Users size={15} /> Учащиеся <span className="tabular-nums">{enrollments.length}</span>
            </Button>
            <Button
              type="button"
              size="md"
              variant={tab === 'team' ? 'primary' : 'ghost'}
              role="tab"
              aria-selected={tab === 'team'}
              onClick={() => selectTab('team')}
            >
              <GraduationCap size={15} /> Команда
            </Button>
          </div>
          {tab !== 'team' && (
            <div className="w-full sm:max-w-xs">
              <Input
                aria-label={tab === 'courses' ? 'Поиск по курсам' : 'Поиск учащихся'}
                className="min-h-11"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={tab === 'courses' ? 'Найти курс…' : 'Имя, email или курс…'}
                icon={<Search size={16} />}
                clearable
              />
            </div>
          )}
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-xl border border-error/25 bg-error/5 p-4 text-sm text-error">
              <p>{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => void loadData()}>
                Повторить загрузку
              </Button>
            </div>
          )}

          {tab === 'team' ? (
            <AcademyTeamTab organizationId={String(activeWorkspace?.organizationId || '')} />
          ) : loading ? (
            <ListSkeleton count={5} />
          ) : tab === 'courses' ? (
            filteredCourses.length === 0 ? (
              <EmptyState
                icon={<BookOpen size={22} />}
                title={query ? 'Курсы не найдены' : 'Пока нет курсов'}
                description={query ? 'Измените поисковый запрос.' : 'Создайте черновик первого курса. Перед публикацией проверьте содержание и назначьте ответственного лектора.'}
                action={!query ? <Button onClick={openCreate} icon={<Plus size={15} />}>Создать курс</Button> : undefined}
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {filteredCourses.map((course) => {
                  const history = historyCount(course);
                  const countKnown = Boolean(course._count);
                  const canDelete = countKnown && history === 0;
                  const status = String(course.publicationStatus || 'draft');
                  const actionLabel = status === 'published'
                    ? 'Убрать в архив'
                    : status === 'archived' ? 'Вернуть в каталог' : 'Опубликовать';
                  return (
                    <article key={course.id} className="min-w-0 rounded-xl border border-bdr-subtle bg-surface-raised p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="break-words text-base font-semibold text-txt-primary">{course.title}</h3>
                          <p className="mt-1 text-xs text-txt-muted">
                            {[course.category, course.instructor || course.author].filter(Boolean).join(' · ') || 'Категория и лектор не указаны'}
                          </p>
                        </div>
                        <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>
                      </div>

                      {course.description && (
                        <p className="mt-3 line-clamp-2 text-sm leading-5 text-txt-secondary">{course.description}</p>
                      )}

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-txt-muted sm:grid-cols-4">
                        <span>{Number(course._count?.lessons || 0)} уроков</span>
                        <span>{Number(course._count?.enrollments || 0)} зачислений</span>
                        <span>{Number(course.price || 0).toLocaleString('ru-RU')} ₸</span>
                        <span>{course.durationHours ? `${course.durationHours} ч` : 'Длительность —'}</span>
                      </div>

                      {history > 0 ? (
                        <p className="mt-3 text-xs text-txt-secondary">
                          История учащихся защищена: {history} записей об обучении, оценивании и сертификатах. Удаление недоступно.
                        </p>
                      ) : !countKnown ? (
                        <p className="mt-3 text-xs text-txt-muted">История ещё не загружена — удаление временно недоступно.</p>
                      ) : null}

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-bdr-subtle pt-3">
                        <Button type="button" variant="ghost" size="sm" icon={<Pencil size={14} />} onClick={() => openEdit(course)}>
                          Изменить данные
                        </Button>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            icon={status === 'published' ? <Archive size={14} /> : <ArchiveRestore size={14} />}
                            loading={busyCourseId === course.id}
                            disabled={busyCourseId !== null}
                            onClick={() => void changePublication(course)}
                          >
                            {actionLabel}
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            icon={<Trash2 size={14} />}
                            disabled={!canDelete || busyCourseId !== null}
                            title={canDelete ? 'Удалить курс без истории' : 'Удаление запрещено при наличии или неизвестном состоянии учебной истории'}
                            onClick={() => setDeleteTarget(course)}
                          >
                            Удалить
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )
          ) : (
            filteredEnrollments.length === 0 ? (
              <EmptyState
                icon={<Users size={22} />}
                title={query ? 'Учащиеся не найдены' : 'Пока нет зачисленных учащихся'}
                description={query ? 'Измените поисковый запрос.' : 'Когда пользователь запишется на курс вашей академии, его прогресс появится здесь.'}
              />
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-txt-muted">
                  <Badge variant="success">{activeLearners} обучаются</Badge>
                  <Badge variant="default">{completedLearners} завершили</Badge>
                  <span>Показано записей: {filteredEnrollments.length}</span>
                </div>
                <div className="space-y-2 md:hidden">
                  {filteredEnrollments.map((row) => {
                    const progress = progressValue(row.progress);
                    const access = accessLabel(row.accessStatus, row.completed);
                    return (
                      <article key={row.id} className="rounded-xl border border-bdr-subtle bg-surface-raised p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-semibold text-txt-primary">{row.learner?.name || 'Учащийся'}</p>
                            <p className="break-all text-xs text-txt-muted">{row.learner?.email || 'Email не указан'}</p>
                          </div>
                          <Badge variant={access.variant}>{access.label}</Badge>
                        </div>
                        <p className="mt-3 text-sm text-txt-secondary">{row.course?.title || 'Курс удалён'}</p>
                        <div className="mt-2 flex items-center justify-between text-xs text-txt-muted">
                          <span>Прогресс</span><span className="tabular-nums">{progress}%</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
                          <div className="h-full rounded-full bg-dv-gold" style={{ width: `${progress}%` }} />
                        </div>
                        <p className="mt-2 text-xs text-txt-muted">Записан: {formatDate(row.enrolledAt)}</p>
                      </article>
                    );
                  })}
                </div>
                <div className="hidden overflow-x-auto rounded-xl border border-bdr-subtle md:block">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-surface-2 text-xs text-txt-muted">
                      <tr>
                        <th className="px-4 py-3 font-medium">Учащийся</th>
                        <th className="px-4 py-3 font-medium">Курс</th>
                        <th className="px-4 py-3 font-medium">Прогресс</th>
                        <th className="px-4 py-3 font-medium">Доступ</th>
                        <th className="px-4 py-3 font-medium">Дата записи</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEnrollments.map((row) => {
                        const progress = progressValue(row.progress);
                        const access = accessLabel(row.accessStatus, row.completed);
                        return (
                          <tr key={row.id} className="border-t border-bdr-subtle">
                            <td className="px-4 py-3">
                              <p className="font-medium text-txt-primary">{row.learner?.name || 'Учащийся'}</p>
                              <p className="text-xs text-txt-muted">{row.learner?.email || '—'}</p>
                            </td>
                            <td className="px-4 py-3 text-txt-secondary">{row.course?.title || 'Курс удалён'}</td>
                            <td className="px-4 py-3">
                              <div className="flex min-w-[116px] items-center gap-2">
                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                                  <div className="h-full rounded-full bg-dv-gold" style={{ width: `${progress}%` }} />
                                </div>
                                <span className="w-9 text-right text-xs tabular-nums text-txt-muted">{progress}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3"><Badge variant={access.variant}>{access.label}</Badge></td>
                            <td className="px-4 py-3 text-xs text-txt-muted">{formatDate(row.enrolledAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )
          )}
        </CardContent>
      </Card>

      <Modal
        open={formOpen}
        onClose={() => { if (!saving) setFormOpen(false); }}
        title={editingCourse ? 'Редактировать курс' : 'Новый курс'}
        description="Основные данные карточки. Структура уроков и тестов сохраняется отдельно, чтобы не повредить прогресс учащихся."
        size="lg"
      >
        <form className="space-y-3 overflow-y-auto p-4 sm:p-6" onSubmit={(event) => void saveCourse(event)}>
          <Input
            label="Название курса *"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            required
            maxLength={180}
            className="min-h-11"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Категория"
              value={form.category}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              maxLength={80}
              className="min-h-11"
            />
            <Input
              label="Автор / ведущий курса"
              value={form.instructor}
              onChange={(event) => setForm((current) => ({ ...current, instructor: event.target.value }))}
              maxLength={120}
              className="min-h-11"
            />
            <Input
              label="Цена, ₸"
              type="number"
              min="0"
              step="1"
              value={form.price}
              onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
              className="min-h-11"
            />
            <Input
              label="Продолжительность, часов"
              type="number"
              min="0"
              step="1"
              value={form.durationHours}
              onChange={(event) => setForm((current) => ({ ...current, durationHours: event.target.value }))}
              className="min-h-11"
            />
          </div>
          <Textarea
            label="Описание"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            rows={4}
            maxLength={4000}
          />
          {!editingCourse && (
            <>
              <Input
                label="Название первого урока *"
                value={form.firstLessonTitle}
                onChange={(event) => setForm((current) => ({ ...current, firstLessonTitle: event.target.value }))}
                required
                maxLength={180}
                className="min-h-11"
              />
              <Textarea
                label="Материал первого урока *"
                value={form.firstLessonContent}
                onChange={(event) => setForm((current) => ({ ...current, firstLessonContent: event.target.value }))}
                rows={5}
                required
                maxLength={20000}
              />
            </>
          )}
          {!editingCourse && (
            <p className="rounded-lg border border-bdr-subtle bg-surface-2/50 p-3 text-xs leading-5 text-txt-secondary">
              Новый курс создаётся как черновик. Заполните первый урок, затем опубликуйте курс. Автор в карточке — текстовое имя, назначение аккаунта лектора выполняется отдельно.
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 border-t border-bdr-subtle pt-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" className="min-h-11" disabled={saving} onClick={() => setFormOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" className="min-h-11" loading={saving}>
              {editingCourse ? 'Сохранить данные' : 'Создать черновик'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => { if (!deleting) setDeleteTarget(null); }}
        title="Удалить курс?"
        description="Удаление необратимо. Курс можно удалить только при отсутствии зачислений, оцениваний и сертификатов."
        size="sm"
      >
        <div className="space-y-4 p-4 sm:p-5">
          <p className="text-sm leading-6 text-txt-secondary">
            Вы собираетесь удалить «{deleteTarget?.title || 'курс'}» и его материалы. Учебная история с учащимися не затрагивается, поскольку удаление при наличии такой истории запрещено сервером.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" className="min-h-11" disabled={deleting} onClick={() => setDeleteTarget(null)}>
              Отмена
            </Button>
            <Button type="button" variant="danger" className="min-h-11" loading={deleting} onClick={() => void removeCourse()}>
              Удалить курс
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
