import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { BellRing, BriefcaseBusiness, CalendarClock, CheckCircle2, FileText, Inbox, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/ds/Card';
import { Badge } from '@/components/ui/ds/Badge';
import { Button } from '@/components/ui/ds/Button';
import { EmptyState } from '@/components/ui/ds/EmptyState';
import { Input } from '@/components/ui/ds/Input';
import { PageHeader } from '@/components/ui/ds/StatCard';
import { useAuth } from '@/store/auth.store';
import { useToast } from '@/components/ui/ds/Toast';
import {
  getMyJobApplications,
  getMyJobResumes,
  getMyJobInvitations,
  getMyJobInterviews,
  getMyJobOffers,
  respondToJobInvitation,
  respondToJobInterview,
  respondToJobOffer,
  updateMyJobResumeStatus,
} from '@/utils/api';

type CareerTab = 'overview' | 'applications' | 'invitations' | 'interviews' | 'offers' | 'resumes';

type CareerApplication = {
  id: string;
  vacancyId: string;
  status: string;
  createdAt?: string;
  coverNote?: string;
  events?: Array<{ id: string; eventType: string; fromStatus?: string; toStatus?: string; message?: string; createdAt: string }>;
  vacancy?: {
    id: string; title: string; clinicName?: string; city?: string; salary?: string; employmentType?: string; status?: string;
    employerOrganization?: { id: string; name: string; logo?: string | null } | null;
    clinic?: { id: string; name: string } | null;
  };
};

type CareerResume = {
  id: string; title: string; city?: string; salary?: string; employmentType?: string;
  description?: string; tags?: string[]; status: string; createdAt?: string; updatedAt?: string;
};

type CareerInvitation = {
  id: string; employerNameSnapshot: string; message?: string; status: string;
  createdAt: string; expiresAt?: string; vacancy?: { id: string; title: string; city: string; salary?: string; status: string } | null;
  employer?: { id: string; name: string; logo?: string | null } | null;
  sender?: { firstName?: string; lastName?: string } | null;
  resume?: { id: string; title: string } | null;
};

type CareerInterview = {
  id: string; scheduledAt: string; durationMinutes: number; timezone: string; mode: string;
  meetingUrl?: string; location?: string; agenda?: string; status: string; candidateResponse?: string;
  employerNameSnapshot: string; employer?: { name: string; logo?: string | null } | null;
  application?: { vacancy?: { title?: string; city?: string } | null } | null;
  createdBy?: { firstName?: string; lastName?: string } | null;
};

type CareerOffer = {
  id: string; title: string; salary?: string; currency: string; employmentType: string;
  startAt?: string; expiresAt: string; status: string; version: number; terms?: Record<string, unknown> | null;
  candidateMessage?: string;
  employerNameSnapshot: string; employer?: { name: string; logo?: string | null } | null;
  vacancy?: { title?: string; city?: string } | null;
  application?: { id: string; status: string } | null;
};

const TABS: Array<{ id: CareerTab; label: string }> = [
  { id: 'overview', label: 'Обзор' },
  { id: 'applications', label: 'Мои отклики' },
  { id: 'invitations', label: 'Приглашения' },
  { id: 'interviews', label: 'Собеседования' },
  { id: 'offers', label: 'Предложения' },
  { id: 'resumes', label: 'Мои резюме' },
];

const STATUS_LABEL: Record<string, string> = {
  new: 'Получен работодателем', reviewing: 'На рассмотрении', interview: 'Собеседование',
  offer: 'Предложение', hired: 'Трудоустройство отмечено', rejected: 'Отказ',
  invited: 'Приглашение', pending: 'Ожидает ответа', accepted: 'Принято',
  declined: 'Отклонено', expired: 'Истекло', proposed: 'Предложено',
  confirmed: 'Подтверждено', reschedule_requested: 'Нужно перенести',
  sent: 'Ожидает вашего ответа',
};

function dateTime(value?: string, timezone?: string) {
  if (!value) return 'Дата не указана';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Дата не указана';
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'medium', timeStyle: 'short', timeZone: timezone || 'Asia/Almaty',
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }
}

function employerName(record: { employerNameSnapshot?: string; employer?: { name?: string } | null }) {
  return record.employer?.name || record.employerNameSnapshot || 'Работодатель';
}

function tabFromLocation(pathname: string, queryTab: string | null): CareerTab {
  const aliases: Record<string, CareerTab> = {
    applications: 'applications', invitations: 'invitations', interviews: 'interviews',
    offers: 'offers', resumes: 'resumes',
  };
  if (queryTab && TABS.some((tab) => tab.id === queryTab)) return queryTab as CareerTab;
  const last = pathname.split('/').filter(Boolean).pop() || '';
  return aliases[last] || 'overview';
}

export default function CareerWorkspace() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [applications, setApplications] = useState<CareerApplication[]>([]);
  const [resumes, setResumes] = useState<CareerResume[]>([]);
  const [invitations, setInvitations] = useState<CareerInvitation[]>([]);
  const [interviews, setInterviews] = useState<CareerInterview[]>([]);
  const [offers, setOffers] = useState<CareerOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resumeQuery, setResumeQuery] = useState('');
  const activeTab = tabFromLocation(location.pathname, null);

  const setTab = (tab: CareerTab) => {
    navigate(tab === 'overview' ? '/career' : `/career/${tab}`);
  };

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const [applicationRows, resumeRows, invitationRows, interviewRows, offerRows] = await Promise.all([
        getMyJobApplications(), getMyJobResumes(), getMyJobInvitations(), getMyJobInterviews(), getMyJobOffers(),
      ]);
      setApplications(Array.isArray(applicationRows) ? applicationRows : []);
      setResumes(Array.isArray(resumeRows) ? resumeRows : []);
      setInvitations(Array.isArray(invitationRows) ? invitationRows : []);
      setInterviews(Array.isArray(interviewRows) ? interviewRows : []);
      setOffers(Array.isArray(offerRows) ? offerRows : []);
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось загрузить карьерное пространство');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, toast]);

  useEffect(() => { if (isAuthenticated) void load(); else if (!authLoading) setLoading(false); }, [isAuthenticated, authLoading, load]);

  const activeInvitations = invitations.filter((row) => row.status === 'pending');
  const waitingInterviews = interviews.filter((row) => row.status === 'proposed');
  const waitingOffers = offers.filter((row) => row.status === 'sent');
  const visibleResumes = useMemo(() => {
    const query = resumeQuery.trim().toLocaleLowerCase();
    if (!query) return resumes;
    return resumes.filter((row) => [row.title, row.city, row.description, ...(row.tags || [])]
      .some((value) => String(value || '').toLocaleLowerCase().includes(query)));
  }, [resumes, resumeQuery]);

  const respondInvitation = async (id: string, response: 'accepted' | 'declined') => {
    setBusyId(id);
    try {
      await respondToJobInvitation(id, response);
      toast.success(response === 'accepted' ? 'Приглашение принято' : 'Приглашение отклонено');
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось ответить на приглашение');
    } finally { setBusyId(null); }
  };

  const respondInterview = async (id: string, response: 'confirmed' | 'declined' | 'reschedule_requested') => {
    setBusyId(id);
    try {
      await respondToJobInterview(id, response);
      toast.success(response === 'confirmed' ? 'Собеседование подтверждено' : response === 'declined' ? 'Собеседование отклонено' : 'Запрос на перенос отправлен');
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось отправить ответ');
    } finally { setBusyId(null); }
  };

  const respondOffer = async (id: string, response: 'accepted' | 'declined') => {
    setBusyId(id);
    try {
      await respondToJobOffer(id, response);
      toast.success(response === 'accepted' ? 'Предложение принято. Следующий этап — оформление договора.' : 'Предложение отклонено');
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось ответить на предложение');
    } finally { setBusyId(null); }
  };

  const toggleResumeVisibility = async (resume: CareerResume) => {
    setBusyId(resume.id);
    try {
      await updateMyJobResumeStatus(resume.id, resume.status === 'open' ? 'closed' : 'open');
      toast.success(resume.status === 'open' ? 'Резюме скрыто от поиска' : 'Резюме снова опубликовано');
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось изменить видимость резюме');
    } finally { setBusyId(null); }
  };

  if (authLoading) return <div className="p-8 text-sm text-txt-muted">Загружаем карьерное пространство…</div>;
  if (!isAuthenticated) return <Navigate to="/login?returnUrl=%2Fcareer" replace />;

  const renderApplications = () => applications.length === 0 ? (
    <EmptyState icon={<BriefcaseBusiness size={28} />} title="Откликов пока нет" description="Когда вы откликнетесь на вакансию или примете приглашение на конкретную вакансию, история появится здесь." action={<Button className="min-h-11" onClick={() => navigate('/jobs')}>Найти работу</Button>} />
  ) : (
    <div className="space-y-3">
      {applications.map((application) => {
        const vacancy = application.vacancy;
        const employer = vacancy?.employerOrganization?.name || vacancy?.clinic?.name || vacancy?.clinicName || 'Работодатель';
        const sourceEvent = application.events?.find((event) => event.eventType === 'invitation_accepted');
        return (
          <Card key={application.id} padding="md" className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-txt-primary">{vacancy?.title || 'Вакансия'}</p>
                <p className="mt-1 text-sm text-txt-secondary">{employer}</p>
                <p className="mt-1 text-xs text-txt-muted">{vacancy?.city || 'Город не указан'} · отклик отправлен {dateTime(application.createdAt)}</p>
              </div>
              <Badge variant={application.status === 'rejected' ? 'warning' : application.status === 'hired' ? 'success' : 'gold'}>
                {STATUS_LABEL[application.status] || application.status}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{sourceEvent ? 'По приглашению работодателя' : 'Вы откликнулись самостоятельно'}</Badge>
              {vacancy?.status === 'closed' && <Badge variant="outline">Вакансия закрыта · история сохранена</Badge>}
            </div>
            {application.coverNote && <p className="whitespace-pre-wrap text-sm text-txt-secondary">{application.coverNote}</p>}
            {!!application.events?.length && (
              <div className="border-t border-bdr-subtle pt-3">
                <p className="mb-2 text-xs font-semibold text-txt-secondary">История процесса</p>
                <ol className="space-y-2">
                  {application.events.map((event) => (
                    <li key={event.id} className="flex gap-2 text-xs">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-dv-gold" />
                      <div className="min-w-0">
                        <p className="text-txt-primary">{event.message || STATUS_LABEL[event.toStatus || ''] || event.eventType}</p>
                        <p className="mt-0.5 text-txt-muted">{dateTime(event.createdAt)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );

  const renderInvitations = () => invitations.length === 0 ? (
    <EmptyState icon={<Inbox size={28} />} title="Новых приглашений нет" description="Когда работодатель найдёт ваше публичное резюме и пригласит вас, здесь появится его организация, сообщение и вакансия." />
  ) : (
    <div className="space-y-3">
      {invitations.map((invitation) => (
        <Card key={invitation.id} padding="md" className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-txt-primary">{employerName(invitation)}</p>
              <p className="mt-1 text-xs text-txt-muted">Приглашение от {dateTime(invitation.createdAt)} · действует до {dateTime(invitation.expiresAt)}</p>
            </div>
            <Badge variant={invitation.status === 'accepted' ? 'success' : invitation.status === 'declined' || invitation.status === 'expired' ? 'warning' : 'gold'}>
              {STATUS_LABEL[invitation.status] || invitation.status}
            </Badge>
          </div>
          {invitation.vacancy && <div className="rounded-lg bg-surface-2 p-3"><p className="text-sm font-medium text-txt-primary">{invitation.vacancy.title}</p><p className="mt-1 text-xs text-txt-muted">{invitation.vacancy.city}{invitation.vacancy.salary ? ` · ${invitation.vacancy.salary}` : ''}</p></div>}
          {invitation.message && <p className="whitespace-pre-wrap text-sm text-txt-secondary">{invitation.message}</p>}
          {invitation.status === 'pending' && (
            <>
              <div className="flex flex-wrap gap-2">
                <Button className="min-h-11" loading={busyId === invitation.id} disabled={!!busyId} onClick={() => void respondInvitation(invitation.id, 'accepted')}>Принять приглашение</Button>
                <Button className="min-h-11" variant="secondary" disabled={!!busyId} onClick={() => void respondInvitation(invitation.id, 'declined')}>Отклонить</Button>
              </div>
              <p className="text-xs text-txt-muted">Принятие приглашения на конкретную вакансию создаёт отдельный отклик. Оно не является трудовым договором.</p>
            </>
          )}
        </Card>
      ))}
    </div>
  );

  const renderInterviews = () => interviews.length === 0 ? (
    <EmptyState icon={<CalendarClock size={28} />} title="Собеседований пока нет" description="Назначенные работодателями встречи и предложения по времени будут собраны здесь." />
  ) : (
    <div className="space-y-3">
      {interviews.map((interview) => (
        <Card key={interview.id} padding="md" className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-txt-primary">{interview.application?.vacancy?.title || 'Собеседование'}</p>
              <p className="mt-1 text-sm text-txt-secondary">{employerName(interview)}</p>
            </div>
            <Badge variant={interview.status === 'confirmed' ? 'success' : interview.status === 'declined' ? 'warning' : 'gold'}>
              {STATUS_LABEL[interview.status] || interview.status}
            </Badge>
          </div>
          <div className="grid gap-2 rounded-lg bg-surface-2 p-3 text-sm sm:grid-cols-2">
            <p><span className="text-txt-muted">Когда:</span> {dateTime(interview.scheduledAt, interview.timezone)}</p>
            <p><span className="text-txt-muted">Длительность:</span> {interview.durationMinutes} мин.</p>
            <p><span className="text-txt-muted">Формат:</span> {interview.mode === 'online' ? 'Онлайн' : interview.mode === 'in_person' ? 'Лично' : 'Телефон'}</p>
            <p><span className="text-txt-muted">Временная зона:</span> {interview.timezone}</p>
          </div>
          {interview.mode === 'online' && interview.meetingUrl && <a className="break-all text-sm text-dv-gold underline" href={interview.meetingUrl} target="_blank" rel="noreferrer">Открыть ссылку встречи</a>}
          {interview.location && <p className="text-sm text-txt-secondary">Место: {interview.location}</p>}
          {interview.agenda && <p className="text-sm text-txt-secondary">{interview.agenda}</p>}
          {interview.status === 'proposed' && (
            <div className="flex flex-wrap gap-2">
              <Button className="min-h-11" disabled={!!busyId} loading={busyId === interview.id} onClick={() => void respondInterview(interview.id, 'confirmed')}>Подтвердить время</Button>
              <Button className="min-h-11" variant="secondary" disabled={!!busyId} onClick={() => void respondInterview(interview.id, 'reschedule_requested')}>Попросить перенести</Button>
              <Button className="min-h-11" variant="ghost" disabled={!!busyId} onClick={() => void respondInterview(interview.id, 'declined')}>Отклонить</Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );

  const renderOffers = () => offers.length === 0 ? (
    <EmptyState icon={<CheckCircle2 size={28} />} title="Предложений пока нет" description="Официальные предложения работодателей появятся здесь с условиями и сроком ответа." />
  ) : (
    <div className="space-y-3">
      {offers.map((offer) => (
        <Card key={offer.id} padding="md" className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-txt-primary">{offer.title}</p>
              <p className="mt-1 text-sm text-txt-secondary">{employerName(offer)}</p>
              <p className="mt-1 text-xs text-txt-muted">Версия {offer.version} · действует до {dateTime(offer.expiresAt)}</p>
            </div>
            <Badge variant={offer.status === 'accepted' ? 'success' : offer.status === 'declined' ? 'warning' : 'gold'}>
              {STATUS_LABEL[offer.status] || offer.status}
            </Badge>
          </div>
          <div className="grid gap-2 rounded-lg bg-surface-2 p-3 text-sm sm:grid-cols-2">
            <p><span className="text-txt-muted">Оплата:</span> {offer.salary || 'Условия обсуждаются'} {offer.currency}</p>
            <p><span className="text-txt-muted">Занятость:</span> {offer.employmentType}</p>
            <p><span className="text-txt-muted">Начало работы:</span> {offer.startAt ? dateTime(offer.startAt) : 'По согласованию'}</p>
            {offer.vacancy?.city && <p><span className="text-txt-muted">Город:</span> {offer.vacancy.city}</p>}
          </div>
          {offer.terms && Object.keys(offer.terms).length > 0 && (
            <div className="space-y-1 text-sm text-txt-secondary">
              {Object.entries(offer.terms).map(([key, value]) => <p key={key}><span className="font-medium text-txt-primary">{key}:</span> {String(value)}</p>)}
            </div>
          )}
          {offer.status === 'sent' && (
            <div className="flex flex-wrap gap-2">
              <Button className="min-h-11" disabled={!!busyId} loading={busyId === offer.id} onClick={() => void respondOffer(offer.id, 'accepted')}>Принять предложение</Button>
              <Button className="min-h-11" variant="secondary" disabled={!!busyId} onClick={() => void respondOffer(offer.id, 'declined')}>Отклонить</Button>
            </div>
          )}
          {offer.status === 'accepted' && (
            <p className="rounded-lg border border-success/20 bg-success/5 p-3 text-sm text-txt-secondary">
              Вы приняли предложение. Это ещё не подписанный трудовой договор. Дождитесь отдельного документа и проверенного процесса подписания.
            </p>
          )}
        </Card>
      ))}
    </div>
  );

  const renderResumes = () => (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-txt-primary">Мои резюме</h2>
          <p className="mt-1 text-sm text-txt-muted">Открытые резюме доступны для поиска; скрытые остаются в вашем аккаунте.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input value={resumeQuery} onChange={(event) => setResumeQuery(event.target.value)} placeholder="Найти резюме…" />
          <Button className="min-h-11" onClick={() => navigate('/jobs')}>Создать резюме</Button>
        </div>
      </div>
      {visibleResumes.length === 0 ? <EmptyState icon={<FileText size={28} />} title="Резюме пока нет" description="Создайте резюме, чтобы работодатели могли найти вас и отправить приглашение." action={<Button className="min-h-11" onClick={() => navigate('/jobs')}>Создать резюме</Button>} /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {visibleResumes.map((resume) => (
            <Card key={resume.id} padding="md" className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div><p className="font-medium text-txt-primary">{resume.title}</p><p className="mt-1 text-xs text-txt-muted">{resume.city || 'Город не указан'}{resume.salary ? ` · ${resume.salary}` : ''}</p></div>
                <Badge variant={resume.status === 'open' ? 'success' : 'outline'}>{resume.status === 'open' ? 'Открыто для поиска' : 'Скрыто'}</Badge>
              </div>
              {resume.description && <p className="line-clamp-3 text-sm text-txt-secondary">{resume.description}</p>}
              {!!resume.tags?.length && <div className="flex flex-wrap gap-1">{resume.tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}</div>}
              <Button className="min-h-11 w-full" variant="secondary" disabled={!!busyId} loading={busyId === resume.id} onClick={() => void toggleResumeVisibility(resume)}>
                {resume.status === 'open' ? 'Скрыть резюме' : 'Открыть для поиска'}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <main className="mx-auto max-w-7xl space-y-6 overflow-x-hidden p-4 md:p-6">
      <PageHeader
        title="Career OS"
        subtitle={user?.name ? `${user.name} · личное пространство соискателя` : 'Отклики, приглашения и история карьеры'}
        icon={<BriefcaseBusiness size={22} />}
        actions={<div className="flex flex-wrap gap-2"><Button className="min-h-11" variant="secondary" onClick={() => navigate('/jobs')}>Найти работу</Button><Button className="min-h-11" variant="ghost" onClick={() => void load()} disabled={loading}><RefreshCw size={15} /> Обновить</Button></div>}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card padding="md"><p className="text-xs text-txt-muted">Отклики</p><p className="mt-2 text-2xl font-semibold tabular-nums text-txt-primary">{applications.length}</p><p className="mt-1 text-xs text-txt-muted">Ваши заявки работодателям</p></Card>
        <Card padding="md"><p className="text-xs text-txt-muted">Приглашения</p><p className="mt-2 text-2xl font-semibold tabular-nums text-txt-primary">{activeInvitations.length}</p><p className="mt-1 text-xs text-txt-muted">Ждут вашего ответа</p></Card>
        <Card padding="md"><p className="text-xs text-txt-muted">Собеседования</p><p className="mt-2 text-2xl font-semibold tabular-nums text-txt-primary">{waitingInterviews.length}</p><p className="mt-1 text-xs text-txt-muted">Предложенные встречи</p></Card>
        <Card padding="md"><p className="text-xs text-txt-muted">Предложения</p><p className="mt-2 text-2xl font-semibold tabular-nums text-txt-primary">{waitingOffers.length}</p><p className="mt-1 text-xs text-txt-muted">Ожидают решения</p></Card>
      </section>

      <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-bdr-subtle px-1" aria-label="Разделы Career OS">
        {TABS.map((tab) => (
          <button key={tab.id} type="button" onClick={() => setTab(tab.id)} className={`min-h-11 shrink-0 border-b-2 px-3 text-sm font-medium transition ${activeTab === tab.id ? 'border-dv-gold text-dv-gold' : 'border-transparent text-txt-muted hover:text-txt-primary'}`}>
            {tab.label}
            {tab.id === 'invitations' && activeInvitations.length > 0 ? ` · ${activeInvitations.length}` : ''}
            {tab.id === 'offers' && waitingOffers.length > 0 ? ` · ${waitingOffers.length}` : ''}
          </button>
        ))}
      </nav>

      {loading ? <Card padding="lg">Загружаем историю карьеры…</Card> : (
        <>
          {activeTab === 'overview' && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card padding="md" className="space-y-3">
                <div className="flex items-center justify-between"><h2 className="font-semibold text-txt-primary">Последние отклики</h2><Button size="sm" variant="ghost" onClick={() => setTab('applications')}>Все отклики</Button></div>
                {applications.slice(0, 4).map((application) => <div key={application.id} className="flex items-start justify-between gap-3 border-t border-bdr-subtle pt-3"><div><p className="text-sm font-medium text-txt-primary">{application.vacancy?.title || 'Вакансия'}</p><p className="mt-1 text-xs text-txt-muted">{application.vacancy?.employerOrganization?.name || application.vacancy?.clinic?.name || application.vacancy?.clinicName || 'Работодатель'}</p></div><Badge>{STATUS_LABEL[application.status] || application.status}</Badge></div>)}
                {applications.length === 0 && <p className="text-sm text-txt-muted">Здесь появятся ваши отклики.</p>}
              </Card>
              <Card padding="md" className="space-y-3">
                <div className="flex items-center justify-between"><h2 className="font-semibold text-txt-primary">Нужно ответить</h2><Badge>{activeInvitations.length + waitingInterviews.length + waitingOffers.length}</Badge></div>
                {activeInvitations.length > 0 && <button className="flex min-h-11 w-full items-center justify-between border-t border-bdr-subtle pt-3 text-left" onClick={() => setTab('invitations')}><span className="text-sm text-txt-primary">{activeInvitations.length} приглашений</span><BellRing size={16} className="text-dv-gold" /></button>}
                {waitingInterviews.length > 0 && <button className="flex min-h-11 w-full items-center justify-between border-t border-bdr-subtle pt-3 text-left" onClick={() => setTab('interviews')}><span className="text-sm text-txt-primary">{waitingInterviews.length} собеседований</span><CalendarClock size={16} className="text-dv-gold" /></button>}
                {waitingOffers.length > 0 && <button className="flex min-h-11 w-full items-center justify-between border-t border-bdr-subtle pt-3 text-left" onClick={() => setTab('offers')}><span className="text-sm text-txt-primary">{waitingOffers.length} предложений</span><CheckCircle2 size={16} className="text-dv-gold" /></button>}
                {activeInvitations.length + waitingInterviews.length + waitingOffers.length === 0 && <p className="text-sm text-txt-muted">Нет действий, ожидающих ответа.</p>}
              </Card>
            </div>
          )}
          {activeTab === 'applications' && renderApplications()}
          {activeTab === 'invitations' && renderInvitations()}
          {activeTab === 'interviews' && renderInterviews()}
          {activeTab === 'offers' && renderOffers()}
          {activeTab === 'resumes' && renderResumes()}
        </>
      )}
      <p className="text-xs text-txt-muted">Ваши отклики, приглашения и документы принадлежат вашему аккаунту. Принятие предложения не заменяет отдельный трудовой договор и его подписание.</p>
    </main>
  );
}
