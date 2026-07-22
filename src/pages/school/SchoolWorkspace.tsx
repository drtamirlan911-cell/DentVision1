import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GraduationCap, BookOpen, Wallet, BarChart3, Plus, Trash2, Users, Award, Building2, Camera, ImageIcon, Radio, BookMarked } from 'lucide-react';
import * as api from '@/utils/api';
import { useToast } from '@/components/ui/ds/Toast';
import { Button } from '@/components/ui/ds/Button';
import { Input, Select } from '@/components/ui/ds/Input';
import { Card, CardContent } from '@/components/ui/ds/Card';
import { Badge } from '@/components/ui/ds/Badge';
import { Modal } from '@/components/ui/ds/Modal';
import { EmptyState } from '@/components/ui/ds/EmptyState';
import { PageHeader } from '@/components/ui/ds/StatCard';
import { PROFILE_PHOTO_ACCEPT, readImageAsDataUrl } from '@/lib/image-upload';

interface LecturerCtx { scopeId: string; level?: string; academy?: { id: string; name: string } | null }

type OfferFormat = 'course' | 'webinar' | 'textbook' | 'office'

const FORMAT_OPTIONS = [
  { value: 'course', label: 'Онлайн-курс' },
  { value: 'webinar', label: 'Вебинар' },
  { value: 'textbook', label: 'Учебник / PDF' },
  { value: 'office', label: 'Офис-курс' },
]

const FORMAT_LABEL: Record<string, string> = {
  course: 'Курс',
  webinar: 'Вебинар',
  textbook: 'Учебник',
  office: 'Офис-курс',
}

const EMPTY_FORM = {
  format: 'course' as OfferFormat,
  title: '',
  price: '',
  category: '',
  duration: '',
  description: '',
  imageUrl: '',
  startsAt: '',
  seats: '50',
  fileUrl: '',
  pages: '',
  venue: '',
}

const LEVEL_LABEL: Record<string, string> = {
  NEW: 'Новый лектор', VERIFIED: 'Проверенный', EXPERT: 'Эксперт', INTERNATIONAL_SPEAKER: 'Международный спикер',
};

function fmtMoney(minor: string | number | undefined): string {
  return (Number(minor || 0) / 100).toLocaleString('ru-RU') + ' ₸';
}

export default function SchoolWorkspace() {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [contexts, setContexts] = useState<LecturerCtx[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<'courses' | 'analytics' | 'profile'>('courses');

  const [me, setMe] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [listFilter, setListFilter] = useState<'all' | OfferFormat>('all');
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [bio, setBio] = useState('');
  const [registering, setRegistering] = useState(false);

  const loadAll = useCallback(async (t: string) => {
    const [meRes, cRes, aRes] = await Promise.all([
      api.lecturerWs.me(t).catch(() => null),
      api.lecturerWs.courses(t).catch(() => []),
      api.lecturerWs.analytics(t).catch(() => null),
    ]);
    setMe(meRes);
    setBio(meRes?.bio || '');
    setCourses(Array.isArray(cRes) ? cRes : []);
    setAnalytics(aRes);
  }, []);

  const enter = useCallback(async (scopeId: string) => {
    try {
      const res = await api.switchContext('LECTURER', scopeId);
      setToken(res.accessToken);
      await loadAll(res.accessToken);
    } catch {
      toast.error('Не удалось войти в кабинет лектора');
    }
  }, [loadAll, toast]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getMyContexts();
        const lec = (res.contexts || []).filter((c: any) => c.scopeType === 'LECTURER');
        setContexts(lec);
        if (lec.length > 0) await enter(lec[0].scopeId);
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const becomeLecturer = async () => {
    setRegistering(true);
    try {
      const created = await api.lecturerWs.register({});
      const scopeId = created?.id || created?.lecturer?.id;
      if (!scopeId) throw new Error('Профиль создан, но id не получен');
      setContexts([{ scopeId, level: created.level || 'NEW', academy: created.academy || null }]);
      await enter(scopeId);
      toast.success('Профиль лектора создан');
    } catch (e: any) {
      toast.error(e?.message || 'Не удалось создать профиль лектора');
    } finally {
      setRegistering(false);
    }
  };

  const handlePhotoFile = async (file: File | null) => {
    try {
      setPhotoUploading(true);
      const dataUrl = await readImageAsDataUrl(file);
      setForm((f) => ({ ...f, imageUrl: dataUrl }));
      toast.success('Фото загружено');
    } catch (e: any) {
      toast.error(e?.message || 'Не удалось загрузить фото');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleAdd = async () => {
    if (!token) return;
    if (!form.title.trim()) { toast.error('Введите название'); return; }
    if ((form.format === 'webinar' || form.format === 'office') && !form.startsAt) {
      toast.error('Укажите дату и время');
      return;
    }
    if (form.format === 'textbook' && !form.fileUrl.trim()) {
      toast.error('Укажите ссылку на файл учебника');
      return;
    }
    setSaving(true);
    try {
      await api.lecturerWs.createCourse(token, {
        format: form.format,
        title: form.title.trim(),
        price: form.price ? Number(form.price) : undefined,
        category: form.category || undefined,
        duration: form.duration || undefined,
        description: form.description || undefined,
        imageUrl: form.imageUrl || undefined,
        startsAt: form.startsAt || undefined,
        seats: form.seats ? Number(form.seats) : undefined,
        fileUrl: form.fileUrl || undefined,
        pages: form.pages ? Number(form.pages) : undefined,
        venue: form.venue || undefined,
      });
      toast.success(`${FORMAT_LABEL[form.format] || 'Продукт'} создан`);
      setAddOpen(false);
      setForm({ ...EMPTY_FORM });
      await loadAll(token);
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка при создании');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    try {
      await api.lecturerWs.deleteCourse(token, id);
      toast.success('Удалено');
      await loadAll(token);
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка при удалении');
    }
  };

  const saveBio = async () => {
    if (!token) return;
    try {
      await api.lecturerWs.updateMe(token, { bio });
      toast.success('Профиль сохранён');
      await loadAll(token);
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка при сохранении');
    }
  };

  const handlePayout = async () => {
    if (!token) return;
    const balance = Number(analytics?.balanceMinor || 0);
    if (balance <= 0) { toast.error('Нет средств для вывода'); return; }
    try {
      await api.lecturerWs.requestPayout(token, { amountMinor: String(balance) });
      toast.success('Заявка на выплату создана');
      await loadAll(token);
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка при запросе выплаты');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="h-9 w-9 rounded-full border-[3px] border-[#C9A96E]/30 border-t-[#C9A96E] animate-spin" /></div>;
  }

  if (contexts.length === 0) {
    return (
      <div className="p-6 max-w-[900px] mx-auto">
        <PageHeader title="Кабинет лектора · Academy OS" subtitle="Продажа курсов, вебинаров и учебников · аналитика" icon={<GraduationCap size={22} />} />
        <EmptyState
          icon={<GraduationCap size={36} />}
          title="Станьте лектором Academy OS"
          description="Создайте профиль преподавателя, чтобы публиковать курсы, вебинары и учебники, смотреть аналитику и запрашивать выплаты."
          action={
            <div className="flex flex-wrap gap-2 justify-center">
              <Button
                size="sm"
                icon={<GraduationCap size={14} />}
                disabled={registering}
                onClick={() => void becomeLecturer()}
              >
                {registering ? 'Создание…' : 'Стать лектором'}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => navigate('/school')}>
                Перейти в Academy OS
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  const TABS: Array<{ id: typeof tab; label: string; icon: React.ReactNode }> = [
    { id: 'courses', label: 'Продукты', icon: <BookOpen size={15} /> },
    { id: 'analytics', label: 'Аналитика', icon: <BarChart3 size={15} /> },
    { id: 'profile', label: 'Профиль', icon: <Building2 size={15} /> },
  ];

  const filteredProducts = listFilter === 'all'
    ? courses
    : courses.filter((c) => String(c.format || 'course') === listFilter);

  return (
    <div className="p-6 max-w-[1000px] mx-auto">
      <PageHeader
        title="Кабинет лектора · Academy OS"
        subtitle={me?.academy?.name ? `Академия: ${me.academy.name} · курсы · вебинары · учебники` : 'Курсы · вебинары · учебники · независимый преподаватель'}
        icon={<GraduationCap size={22} />}
        actions={me && (
          <Badge variant={me.level === 'EXPERT' || me.level === 'INTERNATIONAL_SPEAKER' ? 'success' : 'gold'}>
            <Award size={12} className="inline mr-1" />{LEVEL_LABEL[me.level] || me.level}
          </Badge>
        )}
      />

      <div className="flex gap-1 mt-4 mb-5 border-b border-white/[0.06]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.id ? 'border-[#C9A96E] text-[#C9A96E]' : 'border-transparent text-[#7A8899] hover:text-white'}`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab === 'courses' && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex flex-wrap gap-1.5">
              {([{ id: 'all', label: 'Все' }, ...FORMAT_OPTIONS.map((f) => ({ id: f.value, label: f.label }))] as Array<{ id: string; label: string }>).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setListFilter(f.id as typeof listFilter)}
                  className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                    listFilter === f.id
                      ? 'border-[#C9A96E]/50 bg-[#C9A96E]/10 text-[#C9A96E]'
                      : 'border-white/10 text-[#7A8899] hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <Button variant="primary" size="sm" icon={<Plus size={15} />} onClick={() => { setForm({ ...EMPTY_FORM }); setAddOpen(true); }}>
              Создать продукт
            </Button>
          </div>
          <p className="text-sm text-[#7A8899] mb-3">Показано: {filteredProducts.length} из {courses.length}</p>
          {filteredProducts.length === 0 ? (
            <EmptyState
              icon={<BookOpen size={32} />}
              title="Нет продуктов"
              description="Создайте курс, вебинар или учебник для продажи в Academy OS."
              action={<Button size="sm" icon={<Plus size={14} />} onClick={() => setAddOpen(true)}>Создать</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredProducts.map((c, i) => {
                const fmt = String(c.format || 'course');
                return (
                  <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
                    <Card>
                      <CardContent>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex gap-3 min-w-0">
                            <div className="h-14 w-14 shrink-0 rounded-lg overflow-hidden bg-white/5 flex items-center justify-center">
                              {c.imageUrl ? (
                                <img src={c.imageUrl} alt={c.title} className="h-full w-full object-cover" />
                              ) : fmt === 'webinar' ? (
                                <Radio size={18} className="text-[#C9A96E]" />
                              ) : fmt === 'textbook' ? (
                                <BookMarked size={18} className="text-[#C9A96E]" />
                              ) : (
                                <ImageIcon size={18} className="text-[#7A8899]" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge variant="gold" size="xs">{FORMAT_LABEL[fmt] || fmt}</Badge>
                                {c.category && <span className="text-[10px] text-[#7A8899]">{c.category}</span>}
                              </div>
                              <p className="text-sm font-bold text-white truncate mt-1">{c.title}</p>
                              <p className="text-xs text-[#7A8899] mt-0.5">
                                {c._count?.enrollments ?? 0} покупок
                                {fmt === 'course' ? ` · ${c._count?.lessons ?? 0} уроков` : ''}
                                {c.startsAt ? ` · ${String(c.startsAt).slice(0, 16).replace('T', ' ')}` : ''}
                              </p>
                              <p className="text-sm text-[#C9A96E] font-semibold mt-1.5">{c.price ? Number(c.price).toLocaleString('ru-RU') + ' ₸' : 'Бесплатно'}</p>
                            </div>
                          </div>
                          <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded-lg text-[#E74C3C] hover:bg-[#E74C3C]/10 transition-colors shrink-0" aria-label="Удалить">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'analytics' && analytics && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCell icon={<Wallet size={16} />} label="Баланс кошелька" value={fmtMoney(analytics.balanceMinor)} />
            <StatCell icon={<BarChart3 size={16} />} label="Всего заработано" value={fmtMoney(analytics.earnedMinor)} />
            <StatCell icon={<Users size={16} />} label="Студентов" value={String(analytics.studentCount)} />
            <StatCell icon={<BookOpen size={16} />} label="Курсов" value={String(analytics.courseCount)} />
          </div>
          <div className="mt-5">
            <Button variant="outline" icon={<Wallet size={15} />} disabled={Number(analytics.balanceMinor) <= 0} onClick={handlePayout}>
              Запросить выплату ({fmtMoney(analytics.balanceMinor)})
            </Button>
            <p className="text-xs text-[#7A8899] mt-2">Выплаты подтверждаются платформой.</p>
          </div>
        </div>
      )}

      {tab === 'profile' && me && (
        <div className="max-w-[560px] space-y-3">
          <div>
            <label className="text-xs text-[#B0BEC5] mb-1.5 block">Уровень (устанавливается платформой)</label>
            <div className="text-sm text-white">{LEVEL_LABEL[me.level] || me.level}</div>
          </div>
          <Input label="О себе / биография" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Кратко о вашем опыте" />
          <Button variant="primary" onClick={saveBio}>Сохранить профиль</Button>
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Новый продукт Academy OS">
        <div className="space-y-3">
          <Select
            label="Тип продукта *"
            value={form.format}
            onChange={(e) => setForm((f) => ({ ...f, format: e.target.value as OfferFormat }))}
            options={FORMAT_OPTIONS}
          />
          <Input
            label="Название *"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder={
              form.format === 'webinar'
                ? 'Вебинар: цифровой протокол'
                : form.format === 'textbook'
                  ? 'Учебник по эндодонтии'
                  : 'Основы имплантации'
            }
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Цена, ₸" type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="85000" />
            <Input label="Категория" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Хирургия" />
          </div>
          {(form.format === 'webinar' || form.format === 'office') && (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Дата и время *"
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
              />
              <Input
                label="Мест"
                type="number"
                value={form.seats}
                onChange={(e) => setForm((f) => ({ ...f, seats: e.target.value }))}
                placeholder="50"
              />
            </div>
          )}
          {form.format === 'office' && (
            <Input label="Площадка / адрес" value={form.venue} onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))} placeholder="Алматы, ул. …" />
          )}
          {form.format === 'textbook' && (
            <div className="grid grid-cols-2 gap-3">
              <Input label="Ссылка на файл *" value={form.fileUrl} onChange={(e) => setForm((f) => ({ ...f, fileUrl: e.target.value }))} placeholder="https://…/book.pdf" />
              <Input label="Страниц" type="number" value={form.pages} onChange={(e) => setForm((f) => ({ ...f, pages: e.target.value }))} placeholder="120" />
            </div>
          )}
          <Input
            label={form.format === 'webinar' ? 'Длительность (мин)' : 'Длительность'}
            value={form.duration}
            onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
            placeholder={form.format === 'webinar' ? '90' : '24 часа'}
          />
          <Input label="Описание" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Краткое описание" />
          <div>
            <p className="text-xs text-[#7A8899] mb-1.5">Обложка</p>
            <input
              ref={photoInputRef}
              type="file"
              accept={PROFILE_PHOTO_ACCEPT}
              className="hidden"
              onChange={(e) => {
                void handlePhotoFile(e.target.files?.[0] || null);
                e.target.value = '';
              }}
            />
            {form.imageUrl ? (
              <div className="relative h-36 rounded-lg overflow-hidden border border-white/10 mb-2">
                <img src={form.imageUrl} alt="Превью" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}
                  className="absolute top-2 right-2 rounded-md bg-black/50 px-2 py-1 text-[11px] text-white border-none cursor-pointer"
                >
                  Убрать
                </button>
              </div>
            ) : (
              <div className="h-28 rounded-lg border border-dashed border-white/15 bg-white/[0.03] flex items-center justify-center mb-2">
                <ImageIcon size={22} className="text-[#7A8899]" />
              </div>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<Camera size={14} />}
              loading={photoUploading}
              onClick={() => photoInputRef.current?.click()}
            >
              {form.imageUrl ? 'Заменить фото' : 'Добавить фото'}
            </Button>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Отмена</Button>
            <Button variant="primary" loading={saving} onClick={handleAdd} icon={<Plus size={15} />}>
              Создать {FORMAT_LABEL[form.format]?.toLowerCase() || 'продукт'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function StatCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="p-4 bg-[#0D1B2E] border border-[rgba(255,255,255,0.06)] rounded-[14px]">
      <div className="flex items-center gap-2 text-[#C9A96E] mb-2">{icon}</div>
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-xs text-[#7A8899] mt-0.5">{label}</p>
    </div>
  );
}
