import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Award, BookOpen, CalendarClock, GraduationCap, PlayCircle, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/ds/Card';
import { Badge } from '@/components/ui/ds/Badge';
import { Button } from '@/components/ui/ds/Button';
import { EmptyState } from '@/components/ui/ds/EmptyState';
import { PageHeader } from '@/components/ui/ds/StatCard';
import { Input } from '@/components/ui/ds/Input';
import { useAuth } from '@/store/auth.store';
import { useToast } from '@/components/ui/ds/Toast';
import { getEnrollments, getSchoolCertificates } from '@/utils/api';

type LearningEnrollment = {
  id: string;
  courseId: string;
  progress?: number;
  completed?: boolean;
  createdAt?: string;
  updatedAt?: string;
  completedLessons?: unknown;
  certificateUrl?: string | null;
  acquisitionType?: string;
  accessStatus?: string;
  paidAmountMinor?: string | number | null;
  currency?: string;
  purchaseConfirmedAt?: string | null;
  accessExpiresAt?: string | null;
  course?: {
    id: string;
    title: string;
    description?: string | null;
    author?: string | null;
    category?: string | null;
    imageUrl?: string | null;
    format?: string | null;
    duration?: string | null;
    startsAt?: string | null;
    academyId?: string | null;
    lecturerId?: string | null;
  };
};

type StudentCertificate = {
  id: string;
  courseId: string;
  title: string;
  instructor?: string;
  certificateNumber?: string;
  issuedAt?: string;
  status?: string;
  certificateUrl?: string;
  verificationCode?: string;
};

type LearningFilter = 'all' | 'in_progress' | 'completed';

const formatLabel: Record<string, string> = {
  course: 'Онлайн-курс',
  webinar: 'Вебинар',
  office: 'Офис-курс',
  textbook: 'Учебник',
};

function formatDate(value?: string) {
  if (!value) return 'Дата не указана';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Дата не указана';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export default function MyLearning() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [enrollments, setEnrollments] = useState<LearningEnrollment[]>([]);
  const [certificates, setCertificates] = useState<StudentCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LearningFilter>('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [enrollmentRows, certificateRows] = await Promise.all([
        getEnrollments(user.id),
        getSchoolCertificates(user.id),
      ]);
      setEnrollments(Array.isArray(enrollmentRows) ? enrollmentRows : []);
      setCertificates(Array.isArray(certificateRows) ? certificateRows : []);
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось загрузить ваше обучение');
    } finally {
      setLoading(false);
    }
  }, [toast, user?.id]);

  useEffect(() => {
    if (isAuthenticated && user?.id) void load();
    else if (!authLoading) setLoading(false);
  }, [isAuthenticated, user?.id, authLoading, load]);

  const visibleEnrollments = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return enrollments.filter((enrollment) => {
      const completed = enrollment.completed === true || Number(enrollment.progress || 0) >= 100;
      if (filter === 'completed' && !completed) return false;
      if (filter === 'in_progress' && completed) return false;
      if (!query) return true;
      const course = enrollment.course;
      return [course?.title, course?.author, course?.category, course?.description]
        .some((value) => String(value || '').toLocaleLowerCase().includes(query));
    });
  }, [enrollments, filter, search]);

  const completedCount = enrollments.filter((row) => row.completed === true).length;
  const inProgressCount = Math.max(0, enrollments.length - completedCount);
  const nextLearning = enrollments
    .filter((row) => !row.completed && Number(row.progress || 0) < 100)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime())[0];

  if (authLoading) return <div className="p-8 text-sm text-txt-muted">Загружаем личное пространство…</div>;
  if (!isAuthenticated) return <Navigate to="/login?returnUrl=%2Fschool%2Fmy-learning" replace />;

  return (
    <main className="mx-auto max-w-7xl space-y-6 overflow-x-hidden p-4 md:p-6">
      <PageHeader
        title="Моё обучение"
        subtitle={user?.name ? `${user.name} · личное пространство студента` : 'Ваши курсы, прогресс и сертификаты'}
        icon={<GraduationCap size={22} />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11" variant="secondary" onClick={() => navigate('/school')}>
              <BookOpen size={15} /> Каталог академии
            </Button>
            <Button className="min-h-11" variant="ghost" onClick={() => void load()} disabled={loading}>
              <RefreshCw size={15} /> Обновить
            </Button>
          </div>
        }
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card padding="md">
          <p className="text-xs text-txt-muted">Всего доступно</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-txt-primary">{enrollments.length}</p>
          <p className="mt-1 text-xs text-txt-muted">Курсы и учебные продукты</p>
        </Card>
        <Card padding="md">
          <p className="text-xs text-txt-muted">Продолжаю</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-txt-primary">{inProgressCount}</p>
          <p className="mt-1 text-xs text-txt-muted">Можно продолжить обучение</p>
        </Card>
        <Card padding="md">
          <p className="text-xs text-txt-muted">Завершено</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-txt-primary">{completedCount}</p>
          <p className="mt-1 text-xs text-txt-muted">История обучения сохраняется</p>
        </Card>
        <Card padding="md">
          <p className="text-xs text-txt-muted">Сертификаты</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-txt-primary">{certificates.length}</p>
          <p className="mt-1 text-xs text-txt-muted">Выданные документы</p>
        </Card>
      </section>

      {nextLearning && (
        <Card padding="lg" className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Badge variant="gold">Продолжить обучение</Badge>
              <h2 className="mt-3 text-lg font-semibold text-txt-primary">{nextLearning.course?.title || 'Ваш курс'}</h2>
              <p className="mt-1 text-sm text-txt-muted">{nextLearning.course?.author || 'Академия DentVision'} · {Number(nextLearning.progress || 0)}% пройдено</p>
            </div>
            <Button className="min-h-11" onClick={() => navigate(`/school/course/${nextLearning.courseId}`)}>
              <PlayCircle size={16} /> Продолжить
            </Button>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.max(0, Math.min(100, Number(nextLearning.progress || 0)))} aria-valuemin={0} aria-valuemax={100} aria-label="Прогресс курса">
            <div className="h-full rounded-full bg-dv-gold transition-all" style={{ width: `${Math.max(0, Math.min(100, Number(nextLearning.progress || 0)))}%` }} />
          </div>
          <p className="text-xs text-txt-muted">Ваш прогресс сохранён в аккаунте и будет доступен после следующего входа.</p>
        </Card>
      )}

      <section className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-txt-primary">Мои учебные продукты</h2>
            <p className="mt-1 text-sm text-txt-muted">Курсы, на которые доступ уже подтверждён. Ожидающая оплата не открывает закрытые уроки.</p>
          </div>
          <div className="w-full md:max-w-sm">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Найти курс или преподавателя…" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Фильтр курсов">
          {([
            ['all', 'Все'],
            ['in_progress', 'В процессе'],
            ['completed', 'Завершённые'],
          ] as Array<[LearningFilter, string]>).map(([value, label]) => (
            <Button key={value} className="min-h-10" size="sm" variant={filter === value ? 'secondary' : 'ghost'} onClick={() => setFilter(value)}>
              {label}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"><Card padding="lg">Загружаем курсы…</Card><Card padding="lg">Загружаем курсы…</Card></div>
        ) : visibleEnrollments.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={32} />}
            title={enrollments.length ? 'По этому фильтру курсов нет' : 'У вас пока нет активных курсов'}
            description={enrollments.length ? 'Выберите другой фильтр или измените поиск.' : 'Найдите подходящую программу в каталоге. После бесплатной записи или подтверждения оплаты курс появится здесь.'}
            action={<Button className="min-h-11" onClick={() => navigate('/school')}>Открыть каталог</Button>}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleEnrollments.map((enrollment) => {
              const course = enrollment.course;
              const progress = Math.max(0, Math.min(100, Number(enrollment.progress || 0)));
              const completed = enrollment.completed === true;
              const accessActive = enrollment.accessStatus !== 'suspended' && enrollment.accessStatus !== 'refunded' && enrollment.accessStatus !== 'expired';
              const format = formatLabel[String(course?.format || 'course').toLowerCase()] || 'Учебный продукт';
              const acquisitionLabel = enrollment.acquisitionType === 'purchase'
                ? 'Покупка подтверждена'
                : enrollment.acquisitionType === 'free' ? 'Бесплатный доступ'
                : enrollment.acquisitionType === 'invitation' ? 'Доступ по приглашению'
                : enrollment.acquisitionType === 'grant' ? 'Доступ предоставлен'
                : 'История обучения';
              return (
                <Card key={enrollment.id} padding="md" className="flex min-h-full flex-col gap-3">
                  {course?.imageUrl ? (
                    <img src={course.imageUrl} alt="" className="h-36 w-full rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-28 items-center justify-center rounded-lg bg-surface-2 text-dv-gold"><BookOpen size={30} /></div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge>{format}</Badge>
                    <Badge variant={completed ? 'success' : accessActive ? 'gold' : 'warning'}>
                      {completed ? 'Экзамен сдан' : !accessActive ? 'Доступ не активен' : progress >= 99 ? 'Ожидает итогового экзамена' : 'Доступ открыт'}
                    </Badge>
                  </div>
                  <div className="min-w-0">
                    <h3 className="line-clamp-2 font-semibold text-txt-primary">{course?.title || 'Учебный продукт'}</h3>
                    <p className="mt-1 text-xs text-txt-muted">{course?.author || 'Преподаватель не указан'}{course?.duration ? ` · ${course.duration}` : ''}</p>
                  </div>
                  <div className="mt-auto space-y-2">
                    <div className="flex items-center justify-between text-xs text-txt-muted">
                      <span>Прогресс</span><span className="tabular-nums">{progress}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-full rounded-full bg-dv-gold" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="flex items-center gap-1 text-xs text-txt-muted"><CalendarClock size={13} /> Доступ активирован: {formatDate(enrollment.createdAt)}</p>
                    <p className="text-xs text-txt-muted">{acquisitionLabel}{enrollment.purchaseConfirmedAt ? ` · ${formatDate(enrollment.purchaseConfirmedAt)}` : ''}</p>
                    {enrollment.paidAmountMinor != null && (
                      <p className="text-xs text-txt-muted">Оплачено: {(Number(enrollment.paidAmountMinor) / 100).toLocaleString('ru-RU')} {enrollment.currency || 'KZT'}</p>
                    )}
                    {enrollment.accessExpiresAt && <p className="text-xs text-txt-muted">Доступ до: {formatDate(enrollment.accessExpiresAt)}</p>}
                    <Button className="min-h-11 w-full" disabled={!accessActive} onClick={() => navigate(`/school/course/${enrollment.courseId}`)}>
                      {!accessActive ? 'Доступ приостановлен' : completed ? 'Открыть курс' : 'Продолжить обучение'} <PlayCircle size={15} />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section id="certificates" className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-txt-primary">Мои сертификаты</h2>
          <p className="mt-1 text-sm text-txt-muted">Сертификаты отображаются отдельно от факта покупки курса.</p>
        </div>
        {certificates.length === 0 ? (
          <Card padding="md"><p className="text-sm text-txt-muted">Сертификатов пока нет. Они появятся после выполнения правил завершения программы.</p></Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {certificates.map((certificate) => (
              <Card key={certificate.id} padding="md" className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-dv-gold/10 text-dv-gold"><Award size={20} /></div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-txt-primary">{certificate.title}</p>
                    <p className="mt-1 text-xs text-txt-muted">{certificate.certificateNumber || 'Сертификат'} · {formatDate(certificate.issuedAt)}</p>
                    {certificate.certificateUrl && (
                      <a className="mt-1 inline-block text-xs text-dv-gold underline" href={certificate.certificateUrl}>Проверить подлинность</a>
                    )}
                  </div>
                </div>
                <Badge variant="success">Выдан</Badge>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
