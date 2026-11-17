import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { BriefcaseBusiness, Users, Plus, ArrowLeft, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/ds/Card';
import { Badge } from '@/components/ui/ds/Badge';
import { Button } from '@/components/ui/ds/Button';
import { Input, Textarea } from '@/components/ui/ds/Input';
import { EmptyState } from '@/components/ui/ds/EmptyState';
import { PageHeader } from '@/components/ui/ds/StatCard';
import { useAuth } from '@/store/auth.store';
import { useToast } from '@/components/ui/ds/Toast';
import {
  createEmployerVacancy,
  getEmployerVacancies,
  getEmployerStatus,
  getEmployerResumes,
  getEmployerVacancyApplications,
  updateEmployerApplicationStatus,
} from '@/utils/api';

type EmployerVacancy = { id: string; title: string; city: string; status: string; applicationsCount?: number };
type EmployerStatus = { organizationType: string; organizationName: string; verificationStatus: string; canPublish: boolean };
type EmployerResume = {
  id: string;
  title: string;
  clinicName?: string;
  city: string;
  salary?: string;
  employmentType?: string;
  description?: string;
  tags?: string[];
  createdAt?: string;
};
type EmployerApplication = {
  id: string;
  vacancyId: string;
  userName?: string;
  user?: { firstName?: string; lastName?: string; email?: string };
  coverNote?: string;
  status: string;
  createdAt: string;
};

const NEXT_STATUS: Record<string, string[]> = {
  new: ['reviewing', 'rejected'],
  reviewing: ['interview', 'rejected'],
  interview: ['offer', 'rejected'],
  offer: ['hired', 'rejected'],
  hired: [],
  rejected: [],
};
const STATUS_LABEL: Record<string, string> = {
  new: 'Новый',
  reviewing: 'На рассмотрении',
  interview: 'Собеседование',
  offer: 'Предложение',
  hired: 'Нанят',
  rejected: 'Отклонён',
};

const EMPTY_FORM = {
  title: '',
  city: '',
  salary: '',
  employmentType: 'Полная занятость',
  description: '',
  tags: '',
};

export default function JobsEmployerWorkspace() {
  const navigate = useNavigate();
  const toast = useToast();
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const [vacancies, setVacancies] = useState<EmployerVacancy[]>([]);
  const [workspaceStatus, setWorkspaceStatus] = useState<EmployerStatus | null>(null);
  const [applications, setApplications] = useState<EmployerApplication[]>([]);
  const [resumes, setResumes] = useState<EmployerResume[]>([]);
  const [resumeQuery, setResumeQuery] = useState('');
  const [resumesLoading, setResumesLoading] = useState(false);
  const [selectedVacancyId, setSelectedVacancyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [appsLoading, setAppsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const selectedVacancy = useMemo(
    () => vacancies.find((item) => item.id === selectedVacancyId) || null,
    [vacancies, selectedVacancyId],
  );

  const visibleResumes = useMemo(() => {
    const query = resumeQuery.trim().toLocaleLowerCase();
    if (!query) return resumes;
    return resumes.filter((resume) => [
      resume.title,
      resume.clinicName,
      resume.city,
      resume.description,
      ...(resume.tags || []),
    ].some((value) => String(value || '').toLocaleLowerCase().includes(query)));
  }, [resumes, resumeQuery]);

  const loadVacancies = useCallback(async () => {
    setLoading(true);
    try {
      const [list, status] = await Promise.all([getEmployerVacancies(), getEmployerStatus()]);
      setVacancies(list as EmployerVacancy[]);
      setWorkspaceStatus(status);
      setSelectedVacancyId((current) => current && list.some((item: EmployerVacancy) => item.id === current)
        ? current
        : (list[0]?.id || ''));
    } catch (error: any) {
      setVacancies([]);
      setWorkspaceStatus(null);
      setApplications([]);
      toast.error(error?.message || 'Нет доступа к кабинету работодателя');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadApplications = useCallback(async (vacancyId: string) => {
    if (!vacancyId) {
      setApplications([]);
      return;
    }
    setAppsLoading(true);
    try {
      const list = await getEmployerVacancyApplications(vacancyId);
      setApplications(list as EmployerApplication[]);
    } catch (error: any) {
      setApplications([]);
      toast.error(error?.message || 'Не удалось загрузить отклики');
    } finally {
      setAppsLoading(false);
    }
  }, [toast]);

  const loadResumes = useCallback(async () => {
    if (workspaceStatus?.canPublish !== true) {
      setResumes([]);
      return;
    }
    setResumesLoading(true);
    try {
      const list = await getEmployerResumes();
      setResumes(list as EmployerResume[]);
    } catch (error: any) {
      setResumes([]);
      toast.error(error?.message || 'Не удалось загрузить резюме специалистов');
    } finally {
      setResumesLoading(false);
    }
  }, [toast, workspaceStatus?.canPublish]);

  useEffect(() => {
    if (isAuthenticated) void loadVacancies();
  }, [isAuthenticated, loadVacancies]);

  useEffect(() => {
    if (selectedVacancyId) void loadApplications(selectedVacancyId);
    else setApplications([]);
  }, [selectedVacancyId, loadApplications]);

  useEffect(() => {
    if (workspaceStatus?.canPublish === true) void loadResumes();
    else setResumes([]);
  }, [workspaceStatus?.canPublish, loadResumes]);

  if (authLoading) return <div className="p-8 text-sm text-txt-muted">Загружаем кабинет работодателя…</div>;
  if (!isAuthenticated) return <Navigate to="/login?returnUrl=%2Femployer" replace />;

  const submitVacancy = async () => {
    if (!form.title.trim() || !form.city.trim()) {
      toast.error('Укажите должность и город');
      return;
    }
    setSaving(true);
    try {
      const created = await createEmployerVacancy({
        title: form.title.trim(),
        city: form.city.trim(),
        salary: form.salary.trim() || undefined,
        employmentType: form.employmentType,
        description: form.description.trim() || undefined,
        tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      });
      toast.success('Вакансия опубликована');
      setForm(EMPTY_FORM);
      setShowForm(false);
      await loadVacancies();
      if (created?.id) setSelectedVacancyId(created.id);
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось опубликовать вакансию');
    } finally {
      setSaving(false);
    }
  };

  const changeApplicationStatus = async (application: EmployerApplication, status: string) => {
    setStatusBusyId(application.id);
    try {
      await updateEmployerApplicationStatus(application.id, status);
      toast.success('Этап отклика обновлён');
      await loadApplications(application.vacancyId);
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось изменить этап отклика');
    } finally {
      setStatusBusyId(null);
    }
  };

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <PageHeader
        title="Кабинет работодателя"
        subtitle={user?.name || 'Вакансии и подбор специалистов'}
        icon={<BriefcaseBusiness size={20} />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="min-h-11" onClick={() => navigate('/jobs')}>
              <ArrowLeft size={15} /> Рынок вакансий
            </Button>
            <Button className="min-h-11" disabled={workspaceStatus?.canPublish !== true} onClick={() => setShowForm((value) => !value)}>
              <Plus size={15} /> Новая вакансия
            </Button>
          </div>
        }
      />

      {!workspaceStatus?.canPublish && (
        <Card padding="md" className="border border-amber-500/30 bg-amber-500/[0.04]">
          <p className="font-medium text-txt-primary">Публикация пока недоступна</p>
          <p className="mt-1 text-sm text-txt-secondary">
            Статус проверки организации: {workspaceStatus?.verificationStatus || 'не подтверждён'}.
            Вакансии и поиск кандидатов откроются после юридической проверки, подписи владельца и активации DentVision.
          </p>
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => navigate('/settings')}>
            Открыть документы организации
          </Button>
        </Card>
      )}
      {showForm && (
        <Card padding="lg" className="space-y-3">
          <h2 className="font-semibold text-txt-primary">Новая вакансия</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Должность *" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            <Input label="Город *" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
            <Input label="Зарплата" value={form.salary} onChange={(event) => setForm({ ...form, salary: event.target.value })} />
            <Input label="Тип занятости" value={form.employmentType} onChange={(event) => setForm({ ...form, employmentType: event.target.value })} />
          </div>
          <Input label="Специализации / теги через запятую" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} />
          <Textarea label="Описание" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" className="min-h-11" onClick={() => setShowForm(false)}>Отмена</Button>
            <Button className="min-h-11" loading={saving} onClick={submitVacancy}>Опубликовать вакансию</Button>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card padding="md" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold text-txt-primary">Мои вакансии</h2>
              <p className="text-xs text-txt-muted">{vacancies.length} активных объявлений</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => void loadVacancies()} disabled={loading}>
              <RefreshCw size={14} /> Обновить
            </Button>
          </div>
          {loading ? (
            <div className="py-8 text-center text-sm text-txt-muted">Загружаем вакансии…</div>
          ) : vacancies.length === 0 ? (
            <EmptyState icon={<BriefcaseBusiness size={26} />} title="Вакансий пока нет" description="Опубликуйте первую вакансию от имени активной организации." action={<Button size="sm" onClick={() => setShowForm(true)}>Создать вакансию</Button>} />
          ) : (
            <div className="space-y-2">
              {vacancies.map((vacancy) => (
                <button key={vacancy.id} type="button" onClick={() => setSelectedVacancyId(vacancy.id)} className={`w-full rounded-xl border p-3 text-left transition ${selectedVacancyId === vacancy.id ? 'border-dv-gold/50 bg-dv-gold/[0.04]' : 'border-bdr-subtle hover:bg-surface-2'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-txt-primary">{vacancy.title}</span>
                    <Badge>{vacancy.status}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-txt-muted">
                    <span className="flex items-center gap-1"><BriefcaseBusiness size={12} /> {vacancy.city}</span>
                    <span className="flex items-center gap-1"><Users size={12} /> {vacancy.applicationsCount ?? 'Отклики'}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card padding="md" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold text-txt-primary">Воронка кандидатов</h2>
              <p className="text-xs text-txt-muted">{selectedVacancy?.title || 'Выберите вакансию'}</p>
            </div>
            {selectedVacancy && <Badge>{applications.length} откликов</Badge>}
          </div>
          {!selectedVacancy ? (
            <EmptyState icon={<Users size={26} />} title="Выберите вакансию" description="Здесь появятся кандидаты и этапы их рассмотрения." />
          ) : appsLoading ? (
            <div className="py-8 text-center text-sm text-txt-muted">Загружаем отклики…</div>
          ) : applications.length === 0 ? (
            <EmptyState icon={<Users size={26} />} title="Откликов пока нет" description="Новые отклики появятся здесь." />
          ) : (
            <div className="space-y-3">
              {applications.map((application) => {
                const name = [application.user?.firstName, application.user?.lastName].filter(Boolean).join(' ') || application.userName || 'Кандидат';
                const next = NEXT_STATUS[application.status] || [];
                return (
                  <div key={application.id} className="rounded-xl border border-bdr-subtle p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-txt-primary">{name}</p>
                        <p className="text-xs text-txt-muted">{application.user?.email}</p>
                      </div>
                      <Badge>{STATUS_LABEL[application.status] || application.status}</Badge>
                    </div>
                    {application.coverNote && <p className="mt-2 whitespace-pre-wrap text-sm text-txt-secondary">{application.coverNote}</p>}
                    {next.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {next.map((status) => (
                          <Button key={status} size="sm" variant="secondary" loading={statusBusyId === application.id} disabled={!!statusBusyId} onClick={() => void changeApplicationStatus(application, status)}>
                            {STATUS_LABEL[status] || status}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {workspaceStatus?.canPublish === true && (
        <Card padding="md" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold text-txt-primary">База резюме специалистов</h2>
              <p className="text-xs text-txt-muted">Открытые резюме, опубликованные кандидатами в DentVision Jobs</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => void loadResumes()} disabled={resumesLoading}>
              <RefreshCw size={14} /> Обновить
            </Button>
          </div>
          <Input
            label="Поиск кандидатов"
            value={resumeQuery}
            onChange={(event) => setResumeQuery(event.target.value)}
            placeholder="Специальность, город, навыки…"
          />
          {resumesLoading ? (
            <div className="py-8 text-center text-sm text-txt-muted">Загружаем резюме…</div>
          ) : visibleResumes.length === 0 ? (
            <EmptyState
              icon={<Users size={26} />}
              title={resumeQuery.trim() ? 'Кандидаты не найдены' : 'Открытых резюме пока нет'}
              description={resumeQuery.trim() ? 'Измените поисковый запрос.' : 'Новые резюме появятся здесь после публикации кандидатами.'}
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {visibleResumes.map((resume) => (
                <article key={resume.id} className="rounded-xl border border-bdr-subtle p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-medium text-txt-primary">{resume.title}</h3>
                      {resume.clinicName && <p className="mt-1 text-xs text-txt-muted">{resume.clinicName}</p>}
                    </div>
                    <Badge>Резюме</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-txt-muted">
                    {resume.city && <span>{resume.city}</span>}
                    {resume.salary && <span>{resume.salary}</span>}
                    {resume.employmentType && <span>{resume.employmentType}</span>}
                    {resume.createdAt && <span>{String(resume.createdAt).slice(0, 10)}</span>}
                  </div>
                  {resume.description && (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-txt-secondary">{resume.description}</p>
                  )}
                  {!!resume.tags?.length && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {resume.tags.map((tag) => <Badge key={tag} variant="outline" size="xs">{tag}</Badge>)}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
          <p className="text-xs text-txt-muted">Контактные данные и идентификаторы кандидатов не раскрываются в каталоге резюме.</p>
        </Card>
      )}
    </main>
  );
}
