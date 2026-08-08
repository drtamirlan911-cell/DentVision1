import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  StatCard, PageHeader, GlassCard, Card, CardContent, Button, Badge, Modal,
  Input, Select, Textarea, EmptyState, Skeleton,
} from '../../components/ui/ds';
import { useToast } from '../../components/ui/ds/Toast';
import { apiRequest } from '../../utils/api';
import {
  GraduationCap, Users, BookOpen, Award, CheckCircle, XCircle, ChevronRight,
  Search, Plus, RefreshCw, FileText, Star, Pencil, Trash2,
} from 'lucide-react';

const fd = (d: string) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('ru-RU'); } catch { return d; }
};

type SubTab = 'overview' | 'academies' | 'lecturers' | 'verification';

const SUB_TABS: { id: SubTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Обзор', icon: <Award size={14} /> },
  { id: 'academies', label: 'Академии', icon: <GraduationCap size={14} /> },
  { id: 'lecturers', label: 'Лекторы', icon: <Users size={14} /> },
  { id: 'verification', label: 'Верификация', icon: <FileText size={14} /> },
];

const EXPERT_LEVELS = ['new', 'verified', 'expert', 'international_speaker'] as const;

const LEVEL_LABEL: Record<string, string> = {
  new: 'Новый',
  verified: 'Верифицирован',
  expert: 'Эксперт',
  international_speaker: 'Международный спикер',
};

const LEVEL_BADGE: Record<string, 'default' | 'info' | 'gold' | 'success'> = {
  new: 'default',
  verified: 'info',
  expert: 'gold',
  international_speaker: 'success',
};

const LEVEL_COLORS: Record<string, string> = {
  new: 'bg-gray-500',
  verified: 'bg-blue-500',
  expert: 'bg-yellow-500',
  international_speaker: 'bg-emerald-500',
};

const LEVEL_DOT_COLORS: Record<string, string> = {
  new: 'bg-gray-400',
  verified: 'bg-blue-400',
  expert: 'bg-yellow-400',
  international_speaker: 'bg-emerald-400',
};

const LEVEL_FILTER_OPTIONS = [
  { value: '', label: 'Все уровни' },
  { value: 'new', label: 'Новый' },
  { value: 'verified', label: 'Верифицирован' },
  { value: 'expert', label: 'Эксперт' },
  { value: 'international_speaker', label: 'Международный спикер' },
];

const VERIFICATION_STATUS_LABEL: Record<string, string> = {
  pending: 'На проверке',
  approved: 'Одобрено',
  rejected: 'Отклонено',
};

const VERIFICATION_STATUS_BADGE: Record<string, 'warning' | 'success' | 'error'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
};

function ExpertLevelIndicator({ level }: { level: string }) {
  const currentIdx = EXPERT_LEVELS.indexOf(level as any);
  return (
    <div className="flex items-center gap-1 w-full max-w-[280px]">
      {EXPERT_LEVELS.map((l, i) => {
        const isActive = i <= currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div key={l} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                isActive ? `${LEVEL_COLORS[l]} text-white` : 'bg-surface-3 text-txt-muted'
              } ${isCurrent ? 'ring-2 ring-offset-1 ring-offset-surface-1 ' + LEVEL_COLORS[l] : ''}`}>
                {isActive ? <CheckCircle size={14} /> : <span>{i + 1}</span>}
              </div>
              <span className={`text-[10px] mt-1 text-center leading-tight ${isCurrent ? 'text-txt-primary font-semibold' : 'text-txt-muted'}`}>
                {LEVEL_LABEL[l]}
              </span>
            </div>
            {i < EXPERT_LEVELS.length - 1 && (
              <div className={`h-0.5 w-full mx-0.5 rounded ${i < currentIdx ? 'bg-dv-gold' : 'bg-surface-3'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AcademyTab() {
  const toast = useToast();
  const qc = useQueryClient();

  const [subTab, setSubTab] = useState<SubTab>('overview');
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [academyModal, setAcademyModal] = useState(false);
  const [academyForm, setAcademyForm] = useState({ name: '', description: '' });
  const [lecturerModal, setLecturerModal] = useState(false);
  const [lecturerForm, setLecturerForm] = useState({ userId: '', academyId: '', speciality: '' });
  const [selectedLecturer, setSelectedLecturer] = useState<any>(null);
  const [selectedAcademy, setSelectedAcademy] = useState<any>(null);
  const [editingAcademy, setEditingAcademy] = useState<any>(null);
  const [verifyDetail, setVerifyDetail] = useState<any>(null);

  const academiesQuery = useQuery({
    queryKey: ['academies'],
    queryFn: () => apiRequest('/api/academies'),
    staleTime: 30_000,
  });

  const lecturersQuery = useQuery({
    queryKey: ['lecturers'],
    queryFn: () => apiRequest('/api/lecturers'),
    staleTime: 30_000,
  });

  const academyList: any[] = Array.isArray(academiesQuery.data)
    ? academiesQuery.data
    : (academiesQuery.data?.data || []);

  const lecturerList: any[] = Array.isArray(lecturersQuery.data)
    ? lecturersQuery.data
    : (lecturersQuery.data?.data || []);

  const filteredLecturers = lecturerList.filter((l: any) => {
    if (levelFilter && l.level !== levelFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = (l.user?.name || l.name || '').toLowerCase();
      const spec = (l.speciality || '').toLowerCase();
      const academy = (l.academy?.name || '').toLowerCase();
      if (!name.includes(q) && !spec.includes(q) && !academy.includes(q)) return false;
    }
    return true;
  });

  const pendingVerifications = lecturerList.filter(
    (l: any) => l.verificationStatus === 'pending' || (!l.verified && l.documents?.length > 0)
  );

  const totalCourses = academyList.reduce((acc: number, a: any) => acc + (a.coursesCount || a.courses?.length || 0), 0);

  const createAcademy = useMutation({
    mutationFn: (data: { name: string; description: string }) =>
      apiRequest('/api/academies', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['academies'] });
      toast.success('Академия создана');
      setAcademyModal(false);
      setEditingAcademy(null);
      setAcademyForm({ name: '', description: '' });
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка создания академии'),
  });

  const updateAcademy = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; description?: string } }) =>
      apiRequest(`/api/academies/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['academies'] });
      toast.success('Академия обновлена');
      setAcademyModal(false);
      setEditingAcademy(null);
      setAcademyForm({ name: '', description: '' });
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка обновления академии'),
  });

  const deleteAcademy = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/academies/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['academies'] });
      toast.success('Академия удалена');
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка удаления академии'),
  });

  const createLecturer = useMutation({
    mutationFn: (data: { userId: string; academyId: string; speciality: string }) =>
      apiRequest('/api/lecturers', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lecturers'] });
      toast.success('Лектор добавлен');
      setLecturerModal(false);
      setLecturerForm({ userId: '', academyId: '', speciality: '' });
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка добавления лектора'),
  });

  const advanceLevel = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/lecturers/${id}/level`, { method: 'POST', body: JSON.stringify({ action: 'advance' }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lecturers'] });
      toast.success('Уровень повышен');
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка повышения уровня'),
  });

  const rollbackLevel = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/lecturers/${id}/level`, { method: 'POST', body: JSON.stringify({ action: 'rollback' }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lecturers'] });
      toast.success('Уровень понижен');
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка понижения уровня'),
  });

  const verifyLecturer = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) =>
      apiRequest(`/api/lecturers/${id}/verify`, { method: 'POST', body: JSON.stringify({ action }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lecturers'] });
      toast.success('Статус верификации обновлён');
      setVerifyDetail(null);
    },
    onError: (e: any) => toast.error(e.message || 'Ошибка верификации'),
  });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ['academies'] });
    qc.invalidateQueries({ queryKey: ['lecturers'] });
  };

  const isLoading = academiesQuery.isLoading || lecturersQuery.isLoading;

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      <PageHeader
        title="Academy Management"
        subtitle="Управление академиями и лекторами"
        icon={<GraduationCap size={20} />}
        actions={
          <Button icon={<RefreshCw size={16} />} variant="ghost" onClick={refreshAll} className="min-h-11">Обновить</Button>
        }
      />

      <div className="flex gap-1 bg-surface-2 rounded-lg p-1 overflow-x-auto">
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 min-h-11 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${subTab === t.id ? 'bg-surface-1 text-txt-primary shadow-sm' : 'text-txt-muted hover:text-txt-secondary'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {subTab === 'overview' && (
        <div className="space-y-6">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard label="Академии" value={academyList.length} icon={<GraduationCap size={18} />} />
              <StatCard label="Лекторы" value={lecturerList.length} icon={<Users size={18} />} />
              <StatCard label="Курсы" value={totalCourses} icon={<BookOpen size={18} />} />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <GlassCard padding="md">
              <h3 className="text-sm font-semibold text-txt-primary mb-4">Уровни лекторов</h3>
              {isLoading ? (
                <Skeleton className="h-32 rounded-xl" />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {EXPERT_LEVELS.map(level => {
                    const count = lecturerList.filter((l: any) => l.level === level).length;
                    return (
                      <div key={level} className="flex items-center gap-3 p-2 rounded-lg bg-surface-2 border border-bdr-subtle">
                        <div className={`w-3 h-3 rounded-full ${LEVEL_COLORS[level]}`} />
                        <div>
                          <p className="text-sm font-semibold text-txt-primary">{count}</p>
                          <p className="text-xs text-txt-muted">{LEVEL_LABEL[level]}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </GlassCard>

            <GlassCard padding="md">
              <h3 className="text-sm font-semibold text-txt-primary mb-4">Ожидают верификации</h3>
              {isLoading ? (
                <Skeleton className="h-32 rounded-xl" />
              ) : pendingVerifications.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-txt-muted text-sm">
                  <CheckCircle size={16} className="mr-2" />
                  Все лекторы проверены
                </div>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {pendingVerifications.slice(0, 5).map((l: any) => (
                    <div key={l.id} className="flex items-center justify-between p-2 rounded-lg bg-surface-2 border border-bdr-subtle">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-dv-gold/10 text-dv-gold flex items-center justify-center text-xs font-bold">
                          {(l.user?.name || l.name || '?')[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm text-txt-primary">{l.user?.name || l.name || '—'}</p>
                          <p className="text-xs text-txt-muted">{l.speciality || '—'}</p>
                        </div>
                      </div>
                      <Badge variant="warning" size="sm" dot>Ожидает</Badge>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>

          <GlassCard padding="md">
            <h3 className="text-sm font-semibold text-txt-primary mb-4">Академии</h3>
            {isLoading ? (
              <Skeleton className="h-24 rounded-xl" />
            ) : academyList.length === 0 ? (
              <EmptyState icon={<GraduationCap size={40} />} title="Нет академий" description="Создайте первую академию" />
            ) : (
              <div className="space-y-2">
                {academyList.slice(0, 5).map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-2 border border-bdr-subtle hover:bg-surface-3 transition-colors cursor-pointer"
                    onClick={() => { setSelectedAcademy(a); setSubTab('academies'); }}>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-dv-gold/10 text-dv-gold">
                        <GraduationCap size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-txt-primary">{a.name || '—'}</p>
                        <p className="text-xs text-txt-muted">{a.description || 'Без описания'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="info" size="sm">{a.lecturersCount ?? a.lecturers?.length ?? 0} лекторов</Badge>
                      <ChevronRight size={16} className="text-txt-muted" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {subTab === 'academies' && (
        <div className="space-y-4">
          <div className="flex flex-wrap justify-end gap-2">
            <Button icon={<Plus size={16} />} onClick={() => setAcademyModal(true)} className="min-h-11">Академия</Button>
          </div>

          {academiesQuery.isLoading ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : academyList.length === 0 ? (
            <EmptyState icon={<GraduationCap size={40} />} title="Нет академий" description="Создайте первую академию"
              action={<Button icon={<Plus size={16} />} onClick={() => setAcademyModal(true)}>Создать академию</Button>} />
          ) : (
            <Card padding="none">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-bdr-subtle">
                      {['Название', 'Описание', 'Лекторы', 'Курсы', 'Создана', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-txt-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {academyList.map((a: any) => (
                      <tr key={a.id} className="border-b border-bdr-subtle/50 hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-dv-gold/10 text-dv-gold">
                              <GraduationCap size={14} />
                            </div>
                            <span className="text-sm font-semibold text-txt-primary">{a.name || '—'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-txt-secondary max-w-[240px] truncate">{a.description || '—'}</td>
                        <td className="px-4 py-3">
                          <Badge variant="info" size="sm">{a.lecturersCount ?? a.lecturers?.length ?? 0}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="default" size="sm">{a.coursesCount ?? a.courses?.length ?? 0}</Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-txt-muted">{fd(a.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <Button size="icon-sm" variant="ghost" onClick={() => { setEditingAcademy(a); setAcademyForm({ name: a.name || '', description: a.description || '' }); setAcademyModal(true); }} title="Редактировать">
                              <Pencil size={14} />
                            </Button>
                            <Button size="icon-sm" variant="ghost" onClick={() => { if (confirm('Удалить академию?')) deleteAcademy.mutate(a.id); }} title="Удалить">
                              <Trash2 size={14} className="text-danger" />
                            </Button>
                            <Button size="icon-sm" variant="ghost" onClick={() => setSelectedAcademy(a)} title="Подробнее">
                              <ChevronRight size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Modal open={!!selectedAcademy} onClose={() => setSelectedAcademy(null)} title="Академия" size="lg">
            {selectedAcademy && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-txt-muted mb-1">Название</p>
                    <p className="text-sm font-semibold text-txt-primary">{selectedAcademy.name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-txt-muted mb-1">Создана</p>
                    <p className="text-sm text-txt-secondary">{fd(selectedAcademy.createdAt)}</p>
                  </div>
                </div>
                {selectedAcademy.description && (
                  <div>
                    <p className="text-xs text-txt-muted mb-1">Описание</p>
                    <p className="text-sm text-txt-secondary">{selectedAcademy.description}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-surface-2 border border-bdr-subtle">
                    <p className="text-lg font-bold text-txt-primary">{selectedAcademy.lecturersCount ?? selectedAcademy.lecturers?.length ?? 0}</p>
                    <p className="text-xs text-txt-muted">Лекторов</p>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-2 border border-bdr-subtle">
                    <p className="text-lg font-bold text-txt-primary">{selectedAcademy.coursesCount ?? selectedAcademy.courses?.length ?? 0}</p>
                    <p className="text-xs text-txt-muted">Курсов</p>
                  </div>
                </div>
                {Array.isArray(selectedAcademy.courses) && selectedAcademy.courses.length > 0 && (
                  <div>
                    <p className="text-xs text-txt-muted mb-2">Курсы</p>
                    <div className="space-y-2">
                      {selectedAcademy.courses.map((c: any) => (
                        <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg bg-surface-2 border border-bdr-subtle">
                          <BookOpen size={14} className="text-dv-gold shrink-0" />
                          <span className="text-sm text-txt-primary">{c.name || '—'}</span>
                          {c.duration && <span className="text-xs text-txt-muted ml-auto">{c.duration}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <Button variant="ghost" onClick={() => setSelectedAcademy(null)}>Закрыть</Button>
                </div>
              </div>
            )}
          </Modal>
        </div>
      )}

      {subTab === 'lecturers' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 justify-end items-end">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-txt-muted" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск..."
                className="pl-8 pr-3 py-1.5 min-h-11 rounded-lg bg-surface-2 border border-bdr-subtle text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-1 focus:ring-dv-gold/50 w-full sm:w-48" />
            </div>
            <Select value={levelFilter} onChange={e => setLevelFilter(e.target.value)} options={LEVEL_FILTER_OPTIONS} size="sm" className="w-auto min-w-[140px] min-h-11" />
            <Button icon={<Plus size={16} />} onClick={() => setLecturerModal(true)} className="min-h-11">Лектор</Button>
          </div>

          {lecturersQuery.isLoading ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : filteredLecturers.length === 0 ? (
            <EmptyState icon={<Users size={40} />} title="Нет лекторов" description={search || levelFilter ? 'Попробуйте изменить фильтры' : 'Добавьте первого лектора'}
              action={!search && !levelFilter ? <Button icon={<Plus size={16} />} onClick={() => setLecturerModal(true)}>Добавить лектора</Button> : undefined} />
          ) : (
            <Card padding="none">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-bdr-subtle">
                      {['Лектор', 'Академия', 'Специальность', 'Уровень', 'Прогресс', 'Создан', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-txt-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLecturers.map((l: any) => (
                      <tr key={l.id} className="border-b border-bdr-subtle/50 hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-dv-gold/10 text-dv-gold flex items-center justify-center text-xs font-bold shrink-0">
                              {(l.user?.name || l.name || '?')[0]?.toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-txt-primary">{l.user?.name || l.name || '—'}</p>
                              {l.user?.email && <p className="text-xs text-txt-muted">{l.user.email}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-txt-secondary">{l.academy?.name || '—'}</td>
                        <td className="px-4 py-3 text-sm text-txt-secondary max-w-[160px] truncate">{l.speciality || '—'}</td>
                        <td className="px-4 py-3">
                          <Badge variant={LEVEL_BADGE[l.level] || 'default'} size="sm">{LEVEL_LABEL[l.level] || l.level}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <ExpertLevelIndicator level={l.level || 'new'} />
                        </td>
                        <td className="px-4 py-3 text-xs text-txt-muted">{fd(l.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <Button size="icon-sm" variant="ghost" onClick={() => setSelectedLecturer(l)} title="Подробнее">
                              <ChevronRight size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Modal open={!!selectedLecturer} onClose={() => setSelectedLecturer(null)} title="Лектор" size="lg">
            {selectedLecturer && (() => {
              const l = selectedLecturer;
              const currentIdx = EXPERT_LEVELS.indexOf(l.level as any);
              const canAdvance = currentIdx < EXPERT_LEVELS.length - 1;
              const canRollback = currentIdx > 0;
              return (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-dv-gold/10 text-dv-gold flex items-center justify-center text-xl font-bold shrink-0">
                      {(l.user?.name || l.name || '?')[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-base font-bold text-txt-primary">{l.user?.name || l.name || '—'}</p>
                      {l.user?.email && <p className="text-sm text-txt-muted">{l.user.email}</p>}
                      <Badge variant={LEVEL_BADGE[l.level] || 'default'} size="sm" className="mt-1">{LEVEL_LABEL[l.level] || l.level}</Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-txt-muted mb-1">Академия</p>
                      <p className="text-sm text-txt-primary">{l.academy?.name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-txt-muted mb-1">Специальность</p>
                      <p className="text-sm text-txt-primary">{l.speciality || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-txt-muted mb-1">Создан</p>
                      <p className="text-sm text-txt-secondary">{fd(l.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-txt-muted mb-1">Обновлён</p>
                      <p className="text-sm text-txt-secondary">{fd(l.updatedAt)}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-txt-muted mb-2">Уровень экспертизы</p>
                    <ExpertLevelIndicator level={l.level || 'new'} />
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    {canAdvance && (
                      <Button icon={<Star size={16} />} onClick={() => {
                        advanceLevel.mutate(l.id);
                        setSelectedLecturer({ ...l, level: EXPERT_LEVELS[currentIdx + 1] });
                      }} loading={advanceLevel.isPending}>
                        Повысить уровень
                      </Button>
                    )}
                    {canRollback && (
                      <Button icon={<RefreshCw size={16} />} variant="outline" onClick={() => {
                        rollbackLevel.mutate(l.id);
                        setSelectedLecturer({ ...l, level: EXPERT_LEVELS[currentIdx - 1] });
                      }} loading={rollbackLevel.isPending}>
                        Понизить уровень
                      </Button>
                    )}
                    <Button variant="ghost" onClick={() => setSelectedLecturer(null)}>Закрыть</Button>
                  </div>
                </div>
              );
            })()}
          </Modal>
        </div>
      )}

      {subTab === 'verification' && (
        <div className="space-y-4">
          {lecturersQuery.isLoading ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : lecturerList.length === 0 ? (
            <EmptyState icon={<FileText size={40} />} title="Нет данных" description="Лекторы появятся после добавления" />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <GlassCard padding="md">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gray-500/10 text-gray-400"><FileText size={18} /></div>
                    <div>
                      <p className="text-lg font-bold text-txt-primary">{lecturerList.length}</p>
                      <p className="text-xs text-txt-muted">Всего лекторов</p>
                    </div>
                  </div>
                </GlassCard>
                <GlassCard padding="md">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#F59E0B]/10 text-[#F59E0B]"><Award size={18} /></div>
                    <div>
                      <p className="text-lg font-bold text-txt-primary">{pendingVerifications.length}</p>
                      <p className="text-xs text-txt-muted">Ожидают проверки</p>
                    </div>
                  </div>
                </GlassCard>
                <GlassCard padding="md">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#22C55E]/10 text-[#22C55E]"><CheckCircle size={18} /></div>
                    <div>
                      <p className="text-lg font-bold text-txt-primary">{lecturerList.filter((l: any) => l.verificationStatus === 'approved' || l.verified).length}</p>
                      <p className="text-xs text-txt-muted">Верифицированы</p>
                    </div>
                  </div>
                </GlassCard>
                <GlassCard padding="md">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#EF4444]/10 text-[#EF4444]"><XCircle size={18} /></div>
                    <div>
                      <p className="text-lg font-bold text-txt-primary">{lecturerList.filter((l: any) => l.verificationStatus === 'rejected').length}</p>
                      <p className="text-xs text-txt-muted">Отклонены</p>
                    </div>
                  </div>
                </GlassCard>
              </div>

              {pendingVerifications.length === 0 ? (
                <Card padding="md">
                  <div className="flex items-center justify-center gap-2 py-8">
                    <CheckCircle size={20} className="text-[#22C55E]" />
                    <p className="text-sm text-txt-muted">Все лекторы проверены</p>
                  </div>
                </Card>
              ) : (
                <Card padding="none">
                  <div className="px-4 py-3 border-b border-bdr-subtle">
                    <h3 className="text-sm font-semibold text-txt-primary">Ожидают верификации ({pendingVerifications.length})</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-bdr-subtle">
                          {['Лектор', 'Академия', 'Специальность', 'Документы', 'Дата', 'Действия'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-bold text-txt-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pendingVerifications.map((l: any) => (
                          <tr key={l.id} className="border-b border-bdr-subtle/50 hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-dv-gold/10 text-dv-gold flex items-center justify-center text-xs font-bold shrink-0">
                                  {(l.user?.name || l.name || '?')[0]?.toUpperCase()}
                                </div>
                                <span className="text-sm font-semibold text-txt-primary">{l.user?.name || l.name || '—'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-txt-secondary">{l.academy?.name || '—'}</td>
                            <td className="px-4 py-3 text-sm text-txt-secondary">{l.speciality || '—'}</td>
                            <td className="px-4 py-3">
                              {Array.isArray(l.documents) && l.documents.length > 0 ? (
                                <Badge variant="info" size="sm">{l.documents.length} файл(ов)</Badge>
                              ) : (
                                <span className="text-xs text-txt-muted">Нет</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-txt-muted">{fd(l.createdAt)}</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1">
                                <Button size="icon-sm" variant="ghost" onClick={() => setVerifyDetail(l)} title="Просмотреть">
                                  <FileText size={14} />
                                </Button>
                                <Button size="icon-sm" variant="success" onClick={() => verifyLecturer.mutate({ id: l.id, action: 'approve' })} title="Одобрить"
                                  loading={verifyLecturer.isPending}>
                                  <CheckCircle size={14} />
                                </Button>
                                <Button size="icon-sm" variant="danger" onClick={() => verifyLecturer.mutate({ id: l.id, action: 'reject' })} title="Отклонить"
                                  loading={verifyLecturer.isPending}>
                                  <XCircle size={14} />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </>
          )}

          <Modal open={!!verifyDetail} onClose={() => setVerifyDetail(null)} title="Верификация лектора" size="lg">
            {verifyDetail && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-dv-gold/10 text-dv-gold flex items-center justify-center text-lg font-bold shrink-0">
                    {(verifyDetail.user?.name || verifyDetail.name || '?')[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-base font-bold text-txt-primary">{verifyDetail.user?.name || verifyDetail.name || '—'}</p>
                    <p className="text-sm text-txt-muted">{verifyDetail.speciality || '—'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-txt-muted mb-1">Академия</p>
                    <p className="text-sm text-txt-primary">{verifyDetail.academy?.name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-txt-muted mb-1">Текущий уровень</p>
                    <Badge variant={LEVEL_BADGE[verifyDetail.level] || 'default'} size="sm">{LEVEL_LABEL[verifyDetail.level] || verifyDetail.level}</Badge>
                  </div>
                </div>

                {Array.isArray(verifyDetail.documents) && verifyDetail.documents.length > 0 ? (
                  <div>
                    <p className="text-xs text-txt-muted mb-2">Документы для проверки</p>
                    <div className="space-y-2">
                      {verifyDetail.documents.map((doc: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-surface-2 border border-bdr-subtle">
                          <FileText size={16} className="text-dv-gold shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-txt-primary truncate">{doc.name || doc.filename || `Документ ${idx + 1}`}</p>
                            {doc.type && <p className="text-xs text-txt-muted">{doc.type}</p>}
                          </div>
                          {doc.url && (
                            <a href={doc.url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-dv-gold hover:underline shrink-0">Открыть</a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-surface-2 border border-bdr-subtle text-center">
                    <FileText size={24} className="text-txt-muted mx-auto mb-2" />
                    <p className="text-sm text-txt-muted">Документы не загружены</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button icon={<CheckCircle size={16} />} variant="success" onClick={() => verifyLecturer.mutate({ id: verifyDetail.id, action: 'approve' })}
                    loading={verifyLecturer.isPending}>
                    Одобрить
                  </Button>
                  <Button icon={<XCircle size={16} />} variant="danger" onClick={() => verifyLecturer.mutate({ id: verifyDetail.id, action: 'reject' })}
                    loading={verifyLecturer.isPending}>
                    Отклонить
                  </Button>
                  <Button variant="ghost" onClick={() => setVerifyDetail(null)}>Закрыть</Button>
                </div>
              </div>
            )}
          </Modal>
        </div>
      )}

      <Modal open={academyModal} onClose={() => { setAcademyModal(false); setEditingAcademy(null); setAcademyForm({ name: '', description: '' }); }} title={editingAcademy ? 'Редактировать академию' : 'Новая академия'}>
        <form onSubmit={e => {
          e.preventDefault();
          if (!academyForm.name.trim()) { toast.warn('Укажите название'); return; }
          if (editingAcademy) {
            updateAcademy.mutate({ id: editingAcademy.id, data: { name: academyForm.name, description: academyForm.description } });
          } else {
            createAcademy.mutate({ name: academyForm.name, description: academyForm.description });
          }
        }}         className="space-y-4">
          <Input label="Название *" className="min-h-11" value={academyForm.name} onChange={e => setAcademyForm({ ...academyForm, name: e.target.value })} placeholder="Название академии" />
          <Textarea label="Описание" className="min-h-11" value={academyForm.description} onChange={e => setAcademyForm({ ...academyForm, description: e.target.value })} placeholder="Описание академии" rows={3} />
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit" className="min-h-11" loading={createAcademy.isPending || updateAcademy.isPending}>{editingAcademy ? 'Сохранить' : 'Создать'}</Button>
            <Button type="button" variant="ghost" onClick={() => { setAcademyModal(false); setEditingAcademy(null); setAcademyForm({ name: '', description: '' }); }}>Отмена</Button>
          </div>
        </form>
      </Modal>

      <Modal open={lecturerModal} onClose={() => setLecturerModal(false)} title="Новый лектор">
        <form onSubmit={e => {
          e.preventDefault();
          if (!lecturerForm.userId.trim()) { toast.warn('Укажите ID пользователя'); return; }
          if (!lecturerForm.academyId.trim()) { toast.warn('Выберите академию'); return; }
          if (!lecturerForm.speciality.trim()) { toast.warn('Укажите специальность'); return; }
          createLecturer.mutate({ userId: lecturerForm.userId, academyId: lecturerForm.academyId, speciality: lecturerForm.speciality });
        }} className="space-y-4">
          <Input label="ID пользователя *" className="min-h-11" value={lecturerForm.userId} onChange={e => setLecturerForm({ ...lecturerForm, userId: e.target.value })} placeholder="ID пользователя" />
          <Select label="Академия *" className="min-h-11" value={lecturerForm.academyId} onChange={e => setLecturerForm({ ...lecturerForm, academyId: e.target.value })}
            options={[{ value: '', label: 'Выберите академию' }, ...academyList.map((a: any) => ({ value: a.id, label: a.name || 'Без названия' }))]} />
          <Input label="Специальность *" className="min-h-11" value={lecturerForm.speciality} onChange={e => setLecturerForm({ ...lecturerForm, speciality: e.target.value })} placeholder="Специальность лектора" />
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit" className="min-h-11" loading={createLecturer.isPending}>Добавить</Button>
            <Button type="button" variant="ghost" onClick={() => setLecturerModal(false)}>Отмена</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
